// Express application: all REST endpoints for the Library Management System.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { signToken, hashPassword, verifyPassword, authenticate, requireRole } from './auth.js';

export const MAX_ACTIVE_LOANS = 3;
export const LOAN_DAYS = 14;

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const SELF_REGISTER_ROLES = ['STUDENT', 'STAFF', 'AUTHOR'];
const READERS = ['STUDENT', 'STAFF'];

const nowIso = () => new Date().toISOString();
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && String(v).trim() === String(n) ? n : null;
};
const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, role: u.role });

export function createApp({ dbFile = ':memory:' } = {}) {
  const db = openDb(dbFile);
  const app = express();
  const auth = authenticate(db);

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(PUBLIC_DIR));

  // ---------- helpers ----------
  const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  const notify = (userId, type, message) =>
    run('INSERT INTO notifications (user_id, type, message, created_at) VALUES (?,?,?,?)', userId, type, message, nowIso());
  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  const BOOK_COLS = `b.id, b.title, b.author, b.genre, b.year, b.description, b.pages, b.total_copies, b.available_copies,
    b.status, b.cover_hue, b.created_at,
    (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.book_id = b.id) AS avg_rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.book_id = b.id) AS review_count`;

  // ================= AUTH =================
  app.post('/api/auth/register', (req, res) => {
    const b = req.body || {};
    const username = str(b.username), email = str(b.email);
    const password = typeof b.password === 'string' ? b.password : '';
    const role = b.role == null || b.role === '' ? 'STUDENT' : String(b.role).toUpperCase();

    const fields = {};
    if (!username) fields.username = 'Username is required';
    else if (!USERNAME_RE.test(username)) fields.username = 'Username must be 3–30 characters (letters, digits, underscore)';
    if (!email) fields.email = 'Email is required';
    else if (email.length > 120 || !EMAIL_RE.test(email)) fields.email = 'Email address is invalid';
    if (!password) fields.password = 'Password is required';
    else if (password.length < 6 || password.length > 72) fields.password = 'Password must be 6–72 characters';
    if (Object.keys(fields).length) return fail(res, 400, 'Validation failed', { fields });

    if (!SELF_REGISTER_ROLES.includes(role))
      return fail(res, 403, `Privilege escalation blocked: role "${role}" cannot be self-assigned`);
    if (one('SELECT 1 FROM users WHERE username = ?', username)) return fail(res, 409, 'Username is already taken', { fields: { username: 'Username is already taken' } });
    if (one('SELECT 1 FROM users WHERE email = ?', email)) return fail(res, 409, 'Email is already registered', { fields: { email: 'Email is already registered' } });

    const info = run('INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?,?,?,?,?)',
      username, email, hashPassword(password), role, nowIso());
    const user = one('SELECT id, username, email, role FROM users WHERE id = ?', info.lastInsertRowid);
    notify(user.id, 'WELCOME', `Welcome to Athenaeum, ${user.username}!`);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const b = req.body || {};
    const username = str(b.username);
    const password = typeof b.password === 'string' ? b.password : '';
    if (!username || !password) return fail(res, 400, 'Username and password are required');
    const user = one('SELECT * FROM users WHERE username = ?', username);
    if (!user || !verifyPassword(password, user.password_hash)) return fail(res, 401, 'Invalid username or password');
    res.json({ token: signToken(user), user: publicUser(user) });
  });

  app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

  // ================= CATALOG =================
  app.get('/api/books', auth, (req, res) => {
    const q = str(req.query.q).slice(0, 100);
    const genre = str(req.query.genre);
    let sql = `SELECT ${BOOK_COLS} FROM books b WHERE b.status = 'APPROVED'`;
    const params = [];
    if (q) {
      // Parameterised LIKE with escaped wildcards — user input never becomes SQL (TC148)
      const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
      sql += ` AND (b.title LIKE ? ESCAPE '\\' OR b.author LIKE ? ESCAPE '\\')`;
      params.push(like, like);
    }
    if (genre) { sql += ' AND b.genre = ?'; params.push(genre); }
    if (req.query.available === 'true') sql += ' AND b.available_copies > 0';
    sql += ' ORDER BY b.title COLLATE NOCASE';
    res.json({ query: q, books: all(sql, ...params) });
  });

  app.get('/api/books/:id', auth, (req, res) => {
    const id = toId(req.params.id);
    if (!id) return fail(res, 400, 'Invalid book id');
    const book = one(`SELECT ${BOOK_COLS} FROM books b WHERE b.id = ? AND b.status = 'APPROVED'`, id);
    if (!book) return fail(res, 404, 'Book not found');
    const reviews = all(`SELECT r.id, r.rating, r.text, r.created_at, u.username FROM reviews r
      JOIN users u ON u.id = r.user_id WHERE r.book_id = ? ORDER BY r.created_at DESC`, id);
    const myLoan = one(`SELECT id, borrowed_at, due_at FROM loans WHERE user_id = ? AND book_id = ? AND status = 'ACTIVE'`, req.user.id, id) || null;
    const myReview = reviews.find((r) => r.username === req.user.username) || null;
    res.json({ book, reviews, myLoan, myReview });
  });

  // ================= REVIEWS =================
  app.post('/api/books/:id/reviews', auth, requireRole(...READERS), (req, res) => {
    const id = toId(req.params.id);
    if (!id) return fail(res, 400, 'Invalid book id');
    const b = req.body || {};
    const rating = b.rating;
    const text = str(b.text);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return fail(res, 400, 'Rating must be a whole number from 1 to 5', { fields: { rating: 'Rating must be 1–5' } });
    if (text.length > 1000) return fail(res, 400, 'Review text must be at most 1000 characters');
    if (!one(`SELECT 1 FROM books WHERE id = ? AND status = 'APPROVED'`, id)) return fail(res, 404, 'Book not found');
    if (one('SELECT 1 FROM reviews WHERE book_id = ? AND user_id = ?', id, req.user.id))
      return fail(res, 409, 'You have already reviewed this book');
    const info = run('INSERT INTO reviews (book_id, user_id, rating, text, created_at) VALUES (?,?,?,?,?)', id, req.user.id, rating, text, nowIso());
    res.status(201).json({ review: one('SELECT * FROM reviews WHERE id = ?', info.lastInsertRowid) });
  });

  // ================= LOANS =================
  app.post('/api/loans', auth, requireRole(...READERS), (req, res) => {
    const bookId = toId((req.body || {}).bookId);
    if (!bookId) return fail(res, 400, 'A valid bookId is required');
    try {
      const result = tx(() => {
        const book = one(`SELECT * FROM books WHERE id = ? AND status = 'APPROVED'`, bookId);
        if (!book) return [404, { error: 'Book not found in the approved catalog' }];
        if (one(`SELECT 1 FROM loans WHERE user_id = ? AND book_id = ? AND status = 'ACTIVE'`, req.user.id, bookId))
          return [409, { error: 'You already have an active loan for this book' }];
        const { c } = one(`SELECT COUNT(*) AS c FROM loans WHERE user_id = ? AND status = 'ACTIVE'`, req.user.id);
        if (c >= MAX_ACTIVE_LOANS)
          return [409, { error: `Borrow limit reached: maximum ${MAX_ACTIVE_LOANS} active loans` }];
        // Conditional decrement keeps availability consistent even under concurrent requests
        const dec = run('UPDATE books SET available_copies = available_copies - 1 WHERE id = ? AND available_copies > 0', bookId);
        if (dec.changes !== 1) return [409, { error: 'No copies of this book are currently available' }];
        const borrowed = new Date();
        const due = new Date(borrowed.getTime() + LOAN_DAYS * 86400000);
        const info = run(`INSERT INTO loans (user_id, book_id, borrowed_at, due_at, status) VALUES (?,?,?,?, 'ACTIVE')`,
          req.user.id, bookId, borrowed.toISOString(), due.toISOString());
        notify(req.user.id, 'BORROW', `You borrowed "${book.title}". It is due back on ${due.toDateString()}.`);
        return [201, { loan: one('SELECT * FROM loans WHERE id = ?', info.lastInsertRowid) }];
      });
      res.status(result[0]).json(result[1]);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return fail(res, 409, 'You already have an active loan for this book');
      throw e;
    }
  });

  app.get('/api/loans/me', auth, (req, res) => {
    const now = nowIso();
    const loans = all(`SELECT l.*, b.title, b.author, b.genre, b.cover_hue, b.pages,
        (l.status = 'ACTIVE' AND l.due_at < ?) AS overdue
      FROM loans l JOIN books b ON b.id = l.book_id WHERE l.user_id = ?
      ORDER BY (l.status = 'ACTIVE') DESC, l.borrowed_at DESC`, now, req.user.id)
      .map((l) => ({ ...l, overdue: !!l.overdue }));
    res.json({ loans, limit: MAX_ACTIVE_LOANS });
  });

  app.post('/api/loans/:id/return', auth, (req, res) => {
    const id = toId(req.params.id);
    if (!id) return fail(res, 400, 'Invalid loan id');
    const result = tx(() => {
      const loan = one('SELECT l.*, b.title FROM loans l JOIN books b ON b.id = l.book_id WHERE l.id = ?', id);
      if (!loan) return [404, { error: 'Loan not found' }];
      if (loan.user_id !== req.user.id && req.user.role !== 'LIBRARIAN')
        return [403, { error: 'Access denied: this loan belongs to another user' }];
      if (loan.status !== 'ACTIVE') return [409, { error: 'This loan has already been returned' }];
      const returnedAt = nowIso();
      const late = loan.due_at < returnedAt;
      run(`UPDATE loans SET status = 'RETURNED', returned_at = ? WHERE id = ?`, returnedAt, id);
      run('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', loan.book_id);
      notify(loan.user_id, 'RETURN', `You returned "${loan.title}"${late ? ' (late)' : ''}. Thank you!`);
      return [200, { loan: one('SELECT * FROM loans WHERE id = ?', id), late }];
    });
    res.status(result[0]).json(result[1]);
  });

  // ================= BOOKMARKS =================
  app.get('/api/bookmarks', auth, (req, res) => {
    const bookId = toId(req.query.bookId);
    const rows = all(`SELECT bm.*, b.title, b.author, b.cover_hue FROM bookmarks bm JOIN books b ON b.id = bm.book_id
      WHERE bm.user_id = ? ${bookId ? 'AND bm.book_id = ?' : ''} ORDER BY bm.created_at DESC`, ...(bookId ? [req.user.id, bookId] : [req.user.id]));
    res.json({ bookmarks: rows });
  });

  app.post('/api/bookmarks', auth, (req, res) => {
    const b = req.body || {};
    const bookId = toId(b.bookId);
    const page = b.page;
    if (!bookId) return fail(res, 400, 'A valid bookId is required');
    const book = one(`SELECT pages FROM books WHERE id = ? AND status = 'APPROVED'`, bookId);
    if (!book) return fail(res, 404, 'Book not found');
    if (!Number.isInteger(page) || page < 1 || page > book.pages) return fail(res, 400, `Page must be between 1 and ${book.pages}`);
    if (one('SELECT 1 FROM bookmarks WHERE user_id = ? AND book_id = ? AND page = ?', req.user.id, bookId, page))
      return fail(res, 409, `Page ${page} is already bookmarked`);
    const info = run('INSERT INTO bookmarks (user_id, book_id, page, note, created_at) VALUES (?,?,?,?,?)',
      req.user.id, bookId, page, str(b.note).slice(0, 200), nowIso());
    res.status(201).json({ bookmark: one('SELECT * FROM bookmarks WHERE id = ?', info.lastInsertRowid) });
  });

  app.delete('/api/bookmarks/:id', auth, (req, res) => {
    const id = toId(req.params.id);
    const bm = id && one('SELECT * FROM bookmarks WHERE id = ?', id);
    if (!bm) return fail(res, 404, 'Bookmark not found');
    if (bm.user_id !== req.user.id) return fail(res, 403, 'Access denied: not your bookmark');
    run('DELETE FROM bookmarks WHERE id = ?', id);
    res.json({ ok: true });
  });

  // ================= BOOK REQUESTS =================
  app.get('/api/requests', auth, (req, res) => {
    res.json({ requests: all('SELECT * FROM book_requests WHERE user_id = ? ORDER BY created_at DESC', req.user.id) });
  });

  app.post('/api/requests', auth, requireRole(...READERS), (req, res) => {
    const b = req.body || {};
    const title = str(b.title), author = str(b.author), reason = str(b.reason);
    if (!title) return fail(res, 400, 'Validation failed', { fields: { title: 'Title is required' } });
    if (title.length > 200 || author.length > 120 || reason.length > 500) return fail(res, 400, 'Input exceeds maximum length');
    const info = run('INSERT INTO book_requests (user_id, title, author, reason, created_at) VALUES (?,?,?,?,?)',
      req.user.id, title, author, reason, nowIso());
    res.status(201).json({ request: one('SELECT * FROM book_requests WHERE id = ?', info.lastInsertRowid) });
  });

  // ================= NOTIFICATIONS =================
  app.get('/api/notifications', auth, (req, res) => {
    const rows = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', req.user.id)
      .map((n) => ({ ...n, is_read: !!n.is_read }));
    res.json({ notifications: rows, unread: rows.filter((n) => !n.is_read).length });
  });
  app.post('/api/notifications/read-all', auth, (req, res) => {
    run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id);
    res.json({ ok: true });
  });
  app.post('/api/notifications/:id/read', auth, (req, res) => {
    const info = run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', toId(req.params.id), req.user.id);
    if (!info.changes) return fail(res, 404, 'Notification not found');
    res.json({ ok: true });
  });

  // ================= AUTHOR PORTAL =================
  app.get('/api/author/manuscripts', auth, requireRole('AUTHOR'), (req, res) => {
    res.json({ manuscripts: all(`SELECT ${BOOK_COLS}, b.review_note FROM books b WHERE b.submitted_by = ? ORDER BY b.created_at DESC`, req.user.id) });
  });

  app.post('/api/author/manuscripts', auth, requireRole('AUTHOR'), (req, res) => {
    const b = req.body || {};
    const title = str(b.title), description = str(b.description), genre = str(b.genre) || 'General';
    const pages = b.pages == null || b.pages === '' ? 120 : Number(b.pages);
    const fields = {};
    if (!title) fields.title = 'Title is required';
    else if (title.length > 200) fields.title = 'Title must be at most 200 characters';
    if (description.length > 2000) fields.description = 'Description must be at most 2000 characters';
    if (!Number.isInteger(pages) || pages < 1 || pages > 5000) fields.pages = 'Pages must be 1–5000';
    if (Object.keys(fields).length) return fail(res, 400, 'Validation failed', { fields });
    const hue = Math.floor(Math.random() * 360);
    const info = run(`INSERT INTO books (title, author, genre, year, description, pages, status, submitted_by, cover_hue, created_at)
      VALUES (?,?,?,?,?,?, 'PENDING', ?,?,?)`, title, req.user.username, genre.slice(0, 40), new Date().getFullYear(), description, pages, req.user.id, hue, nowIso());
    res.status(201).json({ manuscript: one('SELECT * FROM books WHERE id = ?', info.lastInsertRowid) });
  });

  // Edit own manuscript. Approved manuscripts are locked; editing a rejected one resubmits it for review.
  app.put('/api/author/manuscripts/:id', auth, requireRole('AUTHOR'), (req, res) => {
    const id = toId(req.params.id);
    const m = id && one('SELECT * FROM books WHERE id = ? AND submitted_by IS NOT NULL', id);
    if (!m) return fail(res, 404, 'Manuscript not found');
    if (m.submitted_by !== req.user.id) return fail(res, 403, 'Access denied: not your manuscript');
    if (m.status === 'APPROVED') return fail(res, 409, 'Approved manuscripts are locked and cannot be edited');
    const b = req.body || {};
    const title = b.title === undefined ? m.title : str(b.title);
    const description = b.description === undefined ? m.description : str(b.description);
    const genre = b.genre === undefined ? m.genre : (str(b.genre) || 'General');
    const pages = b.pages == null || b.pages === '' ? m.pages : Number(b.pages);
    const fields = {};
    if (!title) fields.title = 'Title is required';
    else if (title.length > 200) fields.title = 'Title must be at most 200 characters';
    if (description.length > 2000) fields.description = 'Description must be at most 2000 characters';
    if (!Number.isInteger(pages) || pages < 1 || pages > 5000) fields.pages = 'Pages must be 1–5000';
    if (Object.keys(fields).length) return fail(res, 400, 'Validation failed', { fields });
    run(`UPDATE books SET title = ?, description = ?, genre = ?, pages = ?, status = 'PENDING', review_note = NULL WHERE id = ?`,
      title, description, genre.slice(0, 40), pages, id);
    res.json({ manuscript: one('SELECT * FROM books WHERE id = ?', id) });
  });

  app.delete('/api/author/manuscripts/:id', auth, requireRole('AUTHOR'), (req, res) => {
    const id = toId(req.params.id);
    const m = id && one('SELECT * FROM books WHERE id = ?', id);
    if (!m) return fail(res, 404, 'Manuscript not found');
    if (m.submitted_by !== req.user.id) return fail(res, 403, 'Access denied: not your manuscript');
    if (m.status === 'APPROVED') return fail(res, 409, 'Approved manuscripts are part of the catalog and cannot be withdrawn');
    run('DELETE FROM books WHERE id = ?', id);
    res.json({ ok: true });
  });

  // ================= LIBRARIAN =================
  const lib = [auth, requireRole('LIBRARIAN')];

  app.get('/api/admin/stats', ...lib, (req, res) => {
    const now = nowIso();
    const books = one(`SELECT COUNT(*) AS titles, COALESCE(SUM(total_copies),0) AS copies, COALESCE(SUM(available_copies),0) AS available
      FROM books WHERE status = 'APPROVED'`);
    const loans = one(`SELECT COUNT(*) AS total, COALESCE(SUM(status='ACTIVE'),0) AS active, COALESCE(SUM(status='RETURNED'),0) AS returned,
      COALESCE(SUM(status='ACTIVE' AND due_at < ?),0) AS overdue FROM loans`, now);
    const roles = Object.fromEntries(all('SELECT role, COUNT(*) AS c FROM users GROUP BY role').map((r) => [r.role, r.c]));
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    const perDay = Object.fromEntries(all(`SELECT substr(borrowed_at,1,10) AS d, COUNT(*) AS c FROM loans WHERE substr(borrowed_at,1,10) >= ? GROUP BY d`, days[0]).map((r) => [r.d, r.c]));
    res.json({
      totalTitles: books.titles, totalCopies: books.copies, availableCopies: books.available,
      totalLoans: loans.total, activeLoans: loans.active, returnedLoans: loans.returned, overdueLoans: loans.overdue,
      usersByRole: roles, totalUsers: Object.values(roles).reduce((a, b) => a + b, 0),
      pendingManuscripts: one(`SELECT COUNT(*) AS c FROM books WHERE status = 'PENDING'`).c,
      pendingRequests: one(`SELECT COUNT(*) AS c FROM book_requests WHERE status = 'PENDING'`).c,
      loansLast7Days: days.map((d) => ({ date: d, count: perDay[d] || 0 })),
      topBooks: all(`SELECT b.id, b.title, b.author, b.cover_hue, COUNT(l.id) AS loans FROM books b JOIN loans l ON l.book_id = b.id
        GROUP BY b.id ORDER BY loans DESC, b.title LIMIT 5`),
      genres: all(`SELECT genre, COUNT(*) AS c FROM books WHERE status = 'APPROVED' GROUP BY genre ORDER BY c DESC`),
    });
  });

  app.get('/api/admin/manuscripts', ...lib, (req, res) => {
    res.json({ manuscripts: all(`SELECT b.*, u.username AS submitted_by_name FROM books b JOIN users u ON u.id = b.submitted_by
      ORDER BY (b.status = 'PENDING') DESC, b.created_at DESC`) });
  });

  app.post('/api/admin/manuscripts/:id/decision', ...lib, (req, res) => {
    const id = toId(req.params.id);
    const b = req.body || {};
    const decision = String(b.decision || '').toUpperCase();
    const copies = b.copies == null ? 3 : Number(b.copies);
    if (!['APPROVED', 'REJECTED'].includes(decision)) return fail(res, 400, 'decision must be APPROVED or REJECTED');
    if (decision === 'APPROVED' && (!Number.isInteger(copies) || copies < 1 || copies > 100)) return fail(res, 400, 'copies must be 1–100');
    const m = id && one('SELECT * FROM books WHERE id = ? AND submitted_by IS NOT NULL', id);
    if (!m) return fail(res, 404, 'Manuscript not found');
    if (m.status !== 'PENDING') return fail(res, 409, `Manuscript already ${m.status.toLowerCase()}`);
    const note = str(b.note).slice(0, 300);
    if (decision === 'APPROVED') {
      run(`UPDATE books SET status = 'APPROVED', total_copies = ?, available_copies = ?, review_note = ? WHERE id = ?`, copies, copies, note, id);
      notify(m.submitted_by, 'MANUSCRIPT', `Your manuscript "${m.title}" was approved and is now in the catalog.`);
    } else {
      run(`UPDATE books SET status = 'REJECTED', review_note = ? WHERE id = ?`, note, id);
      notify(m.submitted_by, 'MANUSCRIPT', `Your manuscript "${m.title}" was not accepted.${note ? ' Note: ' + note : ''}`);
    }
    res.json({ manuscript: one('SELECT * FROM books WHERE id = ?', id) });
  });

  app.get('/api/admin/requests', ...lib, (req, res) => {
    res.json({ requests: all(`SELECT r.*, u.username FROM book_requests r JOIN users u ON u.id = r.user_id
      ORDER BY (r.status = 'PENDING') DESC, r.created_at DESC`) });
  });

  app.post('/api/admin/requests/:id/resolve', ...lib, (req, res) => {
    const id = toId(req.params.id);
    const b = req.body || {};
    const decision = String(b.decision || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(decision)) return fail(res, 400, 'decision must be APPROVED or REJECTED');
    const r = id && one('SELECT * FROM book_requests WHERE id = ?', id);
    if (!r) return fail(res, 404, 'Request not found');
    if (r.status !== 'PENDING') return fail(res, 409, 'Request has already been resolved');
    const note = str(b.note).slice(0, 300);
    run('UPDATE book_requests SET status = ?, librarian_note = ?, resolved_at = ? WHERE id = ?', decision, note, nowIso(), id);
    notify(r.user_id, 'REQUEST', `Your request for "${r.title}" was ${decision.toLowerCase()}.${note ? ' ' + note : ''}`);
    res.json({ request: one('SELECT * FROM book_requests WHERE id = ?', id) });
  });

  app.get('/api/admin/users', ...lib, (req, res) => {
    const q = str(req.query.q);
    const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    res.json({ users: all(`SELECT u.id, u.username, u.email, u.role, u.created_at,
        (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.status = 'ACTIVE') AS active_loans
      FROM users u WHERE u.username LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' ORDER BY u.created_at DESC LIMIT 200`, like, like) });
  });

  app.post('/api/admin/books', ...lib, (req, res) => {
    const b = req.body || {};
    const title = str(b.title), author = str(b.author), genre = str(b.genre) || 'General';
    const copies = Number(b.copies), year = b.year ? Number(b.year) : null;
    if (!title || !author) return fail(res, 400, 'Title and author are required');
    if (!Number.isInteger(copies) || copies < 1 || copies > 100) return fail(res, 400, 'copies must be 1–100');
    const info = run(`INSERT INTO books (title, author, genre, year, description, total_copies, available_copies, cover_hue, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`, title, author, genre, Number.isInteger(year) ? year : null, str(b.description), copies, copies,
      Math.floor(Math.random() * 360), nowIso());
    res.status(201).json({ book: one('SELECT * FROM books WHERE id = ?', info.lastInsertRowid) });
  });

  app.delete('/api/admin/books/:id', ...lib, (req, res) => {
    const id = toId(req.params.id);
    const book = id && one('SELECT * FROM books WHERE id = ?', id);
    if (!book) return fail(res, 404, 'Book not found');
    if (one(`SELECT 1 FROM loans WHERE book_id = ? AND status = 'ACTIVE'`, id)) return fail(res, 409, 'Book has active loans and cannot be removed');
    run('DELETE FROM books WHERE id = ?', id);
    res.json({ ok: true });
  });

  // ---------- fallbacks ----------
  app.use('/api', (req, res) => fail(res, 404, `No route for ${req.method} ${req.originalUrl}`));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return fail(res, 400, 'Malformed JSON request body');
    if (err.type === 'entity.too.large') return fail(res, 413, 'Request body too large');
    console.error(err);
    fail(res, 500, 'Internal server error');
  });

  return { app, db };
}
