// The 20 STQA test cases selected from the 160-case document (at least one from every section).
// This single module runs in BOTH the browser (QA Lab page) and Node (`npm test`), so the
// automated suite and the live demo can never drift apart.

export const SECTIONS = {
  1: 'Registration, Login & Authentication',
  2: 'Role-Based Access Control',
  3: 'Book Catalog & Search',
  4: 'Borrowing / Book Issue',
  5: 'Return & Overdue Handling',
  6: 'Book Requests',
  7: 'Author Portal & Manuscripts',
  8: 'Reviews & Sentiment',
  9: 'Reading, Highlights & Bookmarks',
  10: 'Notifications & Recommendations',
  11: 'Librarian Administration & Statistics',
  12: 'Validation, Boundary, Negative & Integration',
};

export const DEMO_ACCOUNTS = {
  librarian: { username: 'librarian', password: 'Library@123' },
  author: { username: 'author_demo', password: 'Author@123' },
};

const MAX_ACTIVE_LOANS = 3;

// ---------------------------------------------------------------- infrastructure
export function createClient(base = '') {
  return async function call(method, path, { body, token, raw } = {}) {
    const headers = {};
    if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

class AssertionFailure extends Error {}
function check(condition, actualWhenFailing) {
  if (!condition) throw new AssertionFailure(actualWhenFailing);
}
const short = (r) => `HTTP ${r.status} ${JSON.stringify(r.data)?.slice(0, 160)}`;

function createContext(call) {
  const cleanups = [];
  const rnd = () => Math.random().toString(36).slice(2, 8);
  const ctx = {
    call,
    cleanups,
    uid: rnd,
    async login({ username, password }) {
      const r = await call('POST', '/api/auth/login', { body: { username, password } });
      if (r.status !== 200) throw new Error(`Setup failed: login as ${username} → ${short(r)}`);
      return r.data.token;
    },
    librarian: () => ctx.login(DEMO_ACCOUNTS.librarian),
    author: () => ctx.login(DEMO_ACCOUNTS.author),
    async newUser(role = 'STUDENT') {
      const username = `qa_${rnd()}`;
      const r = await call('POST', '/api/auth/register', { body: { username, email: `${username}@qa.test`, password: 'Passw0rd!', role } });
      if (r.status !== 201) throw new Error(`Setup failed: register → ${short(r)}`);
      return { username, token: r.data.token, user: r.data.user };
    },
    async availableBooks(token, n = 1) {
      const r = await call('GET', '/api/books?available=true', { token });
      const books = r.data.books.filter((b) => b.available_copies > 0);
      if (books.length < n) throw new Error(`Setup failed: need ${n} available books, found ${books.length}`);
      return books.slice(0, n);
    },
    async book(token, id) {
      return (await call('GET', `/api/books/${id}`, { token })).data.book;
    },
    async borrow(token, bookId) {
      const r = await call('POST', '/api/loans', { token, body: { bookId } });
      if (r.status === 201) cleanups.push(() => call('POST', `/api/loans/${r.data.loan.id}/return`, { token }));
      return r;
    },
    async submitManuscript(token, title) {
      const r = await call('POST', '/api/author/manuscripts', { token, body: { title, genre: 'QA', description: 'Automated STQA fixture' } });
      if (r.status !== 201) throw new Error(`Setup failed: manuscript → ${short(r)}`);
      return r.data.manuscript;
    },
  };
  return ctx;
}

// ---------------------------------------------------------------- the 20 cases
export const TEST_CASES = [
  {
    id: 'TC001', section: 1, scenario: 'Register with valid student details',
    data: 'Unique username/email + valid password', expected: 'Account created',
    async run({ call, uid }) {
      const username = `qa_${uid()}`;
      const r = await call('POST', '/api/auth/register', { body: { username, email: `${username}@qa.test`, password: 'Passw0rd!', role: 'STUDENT' } });
      check(r.status === 201 && r.data.user?.role === 'STUDENT' && r.data.token, short(r));
      return `HTTP 201 — account "${username}" created with role STUDENT; JWT issued`;
    },
  },
  {
    id: 'TC015', section: 1, scenario: 'Access protected endpoint without token',
    data: 'GET /api/loans/me with no Authorization header', expected: '401 / access denied',
    async run({ call }) {
      const r = await call('GET', '/api/loans/me');
      check(r.status === 401, short(r));
      return `HTTP 401 — "${r.data.error}"`;
    },
  },
  {
    id: 'TC016', section: 2, scenario: 'Student opens librarian page',
    data: 'Student token → GET /api/admin/stats', expected: 'Access denied',
    async run({ call, newUser }) {
      const s = await newUser('STUDENT');
      const r = await call('GET', '/api/admin/stats', { token: s.token });
      check(r.status === 403, short(r));
      return `HTTP 403 — "${r.data.error}"`;
    },
  },
  {
    id: 'TC025', section: 2, scenario: 'Role privilege escalation attempt',
    data: 'Register with role=LIBRARIAN; forge JWT payload role=LIBRARIAN', expected: 'Privilege escalation prevented',
    async run({ call, uid, newUser }) {
      const username = `qa_${uid()}`;
      const reg = await call('POST', '/api/auth/register', { body: { username, email: `${username}@qa.test`, password: 'Passw0rd!', role: 'LIBRARIAN' } });
      check(reg.status === 403, `Self-registering as LIBRARIAN returned ${short(reg)}`);
      // Tamper with a real student token: flip the role claim but keep the old signature
      const s = await newUser('STUDENT');
      const [h, p, sig] = s.token.split('.');
      const b64 = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const claims = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
      const forged = `${h}.${b64(JSON.stringify({ ...claims, role: 'LIBRARIAN' }))}.${sig}`;
      const r = await call('GET', '/api/admin/stats', { token: forged });
      check(r.status === 401, `Forged token returned ${short(r)}`);
      return `Self-assign LIBRARIAN → HTTP 403; forged JWT role claim → HTTP 401 (${r.data.error})`;
    },
  },
  {
    id: 'TC028', section: 3, scenario: 'Search by partial title',
    data: 'q = "prag"', expected: 'Matching results displayed',
    async run({ call, newUser }) {
      const s = await newUser();
      const r = await call('GET', '/api/books?q=prag', { token: s.token });
      check(r.status === 200, short(r));
      const titles = r.data.books.map((b) => b.title);
      check(titles.includes('The Pragmatic Programmer'), `Results: ${JSON.stringify(titles)}`);
      check(r.data.books.every((b) => /prag/i.test(b.title + b.author)), `Non-matching result in ${JSON.stringify(titles)}`);
      return `HTTP 200 — ${titles.length} match(es): ${titles.join(', ')}`;
    },
  },
  {
    id: 'TC036', section: 3, scenario: 'Catalog excludes unapproved submission',
    data: 'Author submits PENDING manuscript, reader searches for it', expected: 'Not shown in approved catalog',
    async run(ctx) {
      const authorToken = await ctx.author();
      const title = `QA Pending ${ctx.uid()}`;
      const m = await ctx.submitManuscript(authorToken, title);
      ctx.cleanups.push(() => ctx.call('DELETE', `/api/author/manuscripts/${m.id}`, { token: authorToken }));
      const s = await ctx.newUser();
      const search = await ctx.call('GET', `/api/books?q=${encodeURIComponent(title)}`, { token: s.token });
      const detail = await ctx.call('GET', `/api/books/${m.id}`, { token: s.token });
      check(search.status === 200 && search.data.books.length === 0, `Search returned ${short(search)}`);
      check(detail.status === 404, `Direct lookup returned ${short(detail)}`);
      return `Manuscript #${m.id} is PENDING → search returned 0 results; GET /api/books/${m.id} → 404`;
    },
  },
  {
    id: 'TC045', section: 4, scenario: 'Borrow when active-borrow limit is reached',
    data: `User with ${MAX_ACTIVE_LOANS} active loans borrows one more`, expected: 'Borrow rejected',
    async run(ctx) {
      const s = await ctx.newUser();
      const books = await ctx.availableBooks(s.token, MAX_ACTIVE_LOANS + 1);
      for (const b of books.slice(0, MAX_ACTIVE_LOANS)) {
        const r = await ctx.borrow(s.token, b.id);
        check(r.status === 201, `Setup borrow of "${b.title}" → ${short(r)}`);
      }
      const r = await ctx.borrow(s.token, books[MAX_ACTIVE_LOANS].id);
      check(r.status === 409 && /limit/i.test(r.data.error), short(r));
      return `${MAX_ACTIVE_LOANS} loans OK; loan #${MAX_ACTIVE_LOANS + 1} → HTTP 409 "${r.data.error}"`;
    },
  },
  {
    id: 'TC047', section: 4, scenario: 'Borrow same book twice',
    data: 'Same user + same book', expected: 'Duplicate / second borrow prevented',
    async run(ctx) {
      const s = await ctx.newUser();
      const [b] = await ctx.availableBooks(s.token, 1);
      const first = await ctx.borrow(s.token, b.id);
      check(first.status === 201, `First borrow → ${short(first)}`);
      const second = await ctx.borrow(s.token, b.id);
      check(second.status === 409, `Second borrow → ${short(second)}`);
      return `1st borrow HTTP 201; 2nd borrow HTTP 409 "${second.data.error}"`;
    },
  },
  {
    id: 'TC052', section: 4, scenario: 'Verify available-copy count after borrow',
    data: 'Book with known availability', expected: 'Availability decreases correctly',
    async run(ctx) {
      const s = await ctx.newUser();
      const [b] = await ctx.availableBooks(s.token, 1);
      const before = (await ctx.book(s.token, b.id)).available_copies;
      const r = await ctx.borrow(s.token, b.id);
      check(r.status === 201, short(r));
      const after = (await ctx.book(s.token, b.id)).available_copies;
      check(after === before - 1, `"${b.title}" availability ${before} → ${after}`);
      return `"${b.title}": available copies ${before} → ${after}`;
    },
  },
  {
    id: 'TC056', section: 5, scenario: 'Return currently borrowed book',
    data: 'Valid active loan', expected: 'Book returned (and availability restored)',
    async run(ctx) {
      const s = await ctx.newUser();
      const [b] = await ctx.availableBooks(s.token, 1);
      const before = (await ctx.book(s.token, b.id)).available_copies;
      const loan = await ctx.borrow(s.token, b.id);
      check(loan.status === 201, short(loan));
      const r = await ctx.call('POST', `/api/loans/${loan.data.loan.id}/return`, { token: s.token });
      check(r.status === 200 && r.data.loan.status === 'RETURNED' && r.data.loan.returned_at, short(r));
      const after = (await ctx.book(s.token, b.id)).available_copies;
      check(after === before, `Availability not restored: ${before} → ${after}`);
      return `HTTP 200 — loan #${r.data.loan.id} RETURNED; availability back to ${after}`;
    },
  },
  {
    id: 'TC063', section: 5, scenario: 'Unauthorized return',
    data: "User B returns User A's loan", expected: 'Access denied',
    async run(ctx) {
      const a = await ctx.newUser();
      const bUser = await ctx.newUser();
      const [book] = await ctx.availableBooks(a.token, 1);
      const loan = await ctx.borrow(a.token, book.id);
      check(loan.status === 201, short(loan));
      const r = await ctx.call('POST', `/api/loans/${loan.data.loan.id}/return`, { token: bUser.token });
      check(r.status === 403, short(r));
      const mine = await ctx.call('GET', '/api/loans/me', { token: a.token });
      check(mine.data.loans.find((l) => l.id === loan.data.loan.id)?.status === 'ACTIVE', 'Loan state changed by unauthorized user');
      return `HTTP 403 "${r.data.error}"; owner's loan still ACTIVE`;
    },
  },
  {
    id: 'TC067', section: 6, scenario: 'Create blank book request',
    data: 'title = "   " (whitespace only)', expected: 'Validation error',
    async run(ctx) {
      const s = await ctx.newUser();
      const r = await ctx.call('POST', '/api/requests', { token: s.token, body: { title: '   ', author: '', reason: '' } });
      check(r.status === 400, short(r));
      return `HTTP 400 — ${r.data.fields?.title || r.data.error}`;
    },
  },
  {
    id: 'TC071', section: 6, scenario: 'Librarian approves request',
    data: 'Pending request from a student', expected: 'Status becomes approved/resolved',
    async run(ctx) {
      const s = await ctx.newUser();
      const created = await ctx.call('POST', '/api/requests', { token: s.token, body: { title: `QA Request ${ctx.uid()}`, author: 'QA', reason: 'STQA' } });
      check(created.status === 201 && created.data.request.status === 'PENDING', short(created));
      const lib = await ctx.librarian();
      const r = await ctx.call('POST', `/api/admin/requests/${created.data.request.id}/resolve`, { token: lib, body: { decision: 'APPROVED', note: 'Ordered for next term' } });
      check(r.status === 200 && r.data.request.status === 'APPROVED', short(r));
      const mine = await ctx.call('GET', '/api/requests', { token: s.token });
      check(mine.data.requests[0]?.status === 'APPROVED', 'Student does not see APPROVED status');
      return `Request #${r.data.request.id}: PENDING → APPROVED; student sees the new status`;
    },
  },
  {
    id: 'TC082', section: 7, scenario: 'Submit manuscript without title',
    data: 'title = ""', expected: 'Validation error',
    async run(ctx) {
      const token = await ctx.author();
      const r = await ctx.call('POST', '/api/author/manuscripts', { token, body: { title: '', description: 'No title here' } });
      check(r.status === 400 && r.data.fields?.title, short(r));
      return `HTTP 400 — ${r.data.fields.title}`;
    },
  },
  {
    id: 'TC091', section: 7, scenario: 'Librarian approves manuscript',
    data: 'Pending submission, approve with 2 copies', expected: 'Status becomes approved (and visible in catalog)',
    async run(ctx) {
      const authorToken = await ctx.author();
      const title = `QA Approved ${ctx.uid()}`;
      const m = await ctx.submitManuscript(authorToken, title);
      const lib = await ctx.librarian();
      ctx.cleanups.push(() => ctx.call('DELETE', `/api/admin/books/${m.id}`, { token: lib }));
      const r = await ctx.call('POST', `/api/admin/manuscripts/${m.id}/decision`, { token: lib, body: { decision: 'APPROVED', copies: 2 } });
      check(r.status === 200 && r.data.manuscript.status === 'APPROVED', short(r));
      const s = await ctx.newUser();
      const search = await ctx.call('GET', `/api/books?q=${encodeURIComponent(title)}`, { token: s.token });
      check(search.data.books.length === 1 && search.data.books[0].available_copies === 2, `Catalog search → ${short(search)}`);
      return `Manuscript #${m.id}: PENDING → APPROVED; now in catalog with 2 copies`;
    },
  },
  {
    id: 'TC098', section: 8, scenario: 'Review with invalid rating',
    data: 'rating = 7, rating = 0, rating = 3.5', expected: 'Rejected',
    async run(ctx) {
      const s = await ctx.newUser();
      const [b] = await ctx.availableBooks(s.token, 1);
      const codes = [];
      for (const rating of [7, 0, 3.5]) {
        const r = await ctx.call('POST', `/api/books/${b.id}/reviews`, { token: s.token, body: { rating, text: 'QA' } });
        check(r.status === 400, `rating=${rating} → ${short(r)}`);
        codes.push(`${rating}→${r.status}`);
      }
      return `All rejected (${codes.join(', ')}): "Rating must be a whole number from 1 to 5"`;
    },
  },
  {
    id: 'TC116', section: 9, scenario: 'Add duplicate bookmark',
    data: 'Same book, same page twice', expected: 'Duplicate handled',
    async run(ctx) {
      const s = await ctx.newUser();
      const [b] = await ctx.availableBooks(s.token, 1);
      const first = await ctx.call('POST', '/api/bookmarks', { token: s.token, body: { bookId: b.id, page: 12, note: 'QA' } });
      check(first.status === 201, short(first));
      const second = await ctx.call('POST', '/api/bookmarks', { token: s.token, body: { bookId: b.id, page: 12 } });
      check(second.status === 409, short(second));
      const list = await ctx.call('GET', `/api/bookmarks?bookId=${b.id}`, { token: s.token });
      check(list.data.bookmarks.length === 1, `Found ${list.data.bookmarks.length} bookmarks`);
      return `1st bookmark HTTP 201; duplicate HTTP 409 "${second.data.error}"; only 1 stored`;
    },
  },
  {
    id: 'TC121', section: 10, scenario: 'Receive borrow notification',
    data: 'Successful borrow', expected: 'Notification generated',
    async run(ctx) {
      const s = await ctx.newUser();
      const [b] = await ctx.availableBooks(s.token, 1);
      const r = await ctx.borrow(s.token, b.id);
      check(r.status === 201, short(r));
      const n = await ctx.call('GET', '/api/notifications', { token: s.token });
      const hit = n.data.notifications.find((x) => x.type === 'BORROW' && x.message.includes(b.title));
      check(hit && !hit.is_read, `Notifications: ${JSON.stringify(n.data.notifications.map((x) => x.type))}`);
      return `Unread BORROW notification: "${hit.message}"`;
    },
  },
  {
    id: 'TC137', section: 11, scenario: 'View borrowing statistics',
    data: 'Librarian account; one new loan created', expected: 'Correct borrowing metrics displayed',
    async run(ctx) {
      const lib = await ctx.librarian();
      const before = (await ctx.call('GET', '/api/admin/stats', { token: lib })).data;
      const s = await ctx.newUser();
      const [b] = await ctx.availableBooks(s.token, 1);
      const loan = await ctx.borrow(s.token, b.id);
      check(loan.status === 201, short(loan));
      const r = await ctx.call('GET', '/api/admin/stats', { token: lib });
      check(r.status === 200, short(r));
      const after = r.data;
      check(after.activeLoans === before.activeLoans + 1 && after.totalLoans === before.totalLoans + 1,
        `activeLoans ${before.activeLoans}→${after.activeLoans}, totalLoans ${before.totalLoans}→${after.totalLoans}`);
      return `HTTP 200 — activeLoans ${before.activeLoans}→${after.activeLoans}, totalLoans ${before.totalLoans}→${after.totalLoans}`;
    },
  },
  {
    id: 'TC148', section: 12, scenario: 'SQL/script-like input in search',
    data: `' OR 1=1 --   /   <script>alert(1)</script>`, expected: 'Input handled safely',
    async run(ctx) {
      const s = await ctx.newUser();
      const out = [];
      for (const q of ["' OR 1=1 --", "x'; DROP TABLE books; --", '<script>alert(1)</script>', '%']) {
        const r = await ctx.call('GET', `/api/books?q=${encodeURIComponent(q)}`, { token: s.token });
        check(r.status === 200 && Array.isArray(r.data.books) && r.data.books.length === 0, `q=${q} → ${short(r)}`);
        out.push(q);
      }
      const reg = await ctx.call('POST', '/api/auth/register', { body: { username: '<script>x</script>', email: 'x@qa.test', password: 'Passw0rd!' } });
      check(reg.status === 400, `Script username → ${short(reg)}`);
      return `Injection/wildcard queries returned HTTP 200 with 0 rows (no leakage); script username → HTTP 400`;
    },
  },
];

// ---------------------------------------------------------------- runner
export async function runCase(tc, base = '') {
  const ctx = createContext(createClient(base));
  const t0 = Date.now();
  try {
    const actual = await tc.run(ctx);
    return { id: tc.id, status: 'PASS', actual, ms: Date.now() - t0 };
  } catch (e) {
    return { id: tc.id, status: 'FAIL', actual: e instanceof AssertionFailure ? e.message : `Error: ${e.message}`, ms: Date.now() - t0 };
  } finally {
    for (const undo of ctx.cleanups.reverse()) { try { await undo(); } catch { /* best effort */ } }
  }
}
