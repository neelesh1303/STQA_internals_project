// SQLite schema + demo seed data (uses Node's built-in node:sqlite, no native build needed).
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.js';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('STUDENT','STAFF','AUTHOR','LIBRARIAN')),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  author           TEXT NOT NULL,
  genre            TEXT NOT NULL DEFAULT 'General',
  year             INTEGER,
  description      TEXT NOT NULL DEFAULT '',
  pages            INTEGER NOT NULL DEFAULT 120,
  total_copies     INTEGER NOT NULL DEFAULT 0 CHECK (total_copies >= 0),
  available_copies INTEGER NOT NULL DEFAULT 0 CHECK (available_copies >= 0),
  status           TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  submitted_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_note      TEXT,
  cover_hue        INTEGER NOT NULL DEFAULT 220,
  created_at       TEXT NOT NULL,
  CHECK (available_copies <= total_copies)
);

CREATE TABLE IF NOT EXISTS loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  borrowed_at TEXT NOT NULL,
  due_at      TEXT NOT NULL,
  returned_at TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RETURNED'))
);
-- Database-level guarantee: one ACTIVE loan per user per book (TC047)
CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_loan ON loans(user_id, book_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (book_id, user_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page       INTEGER NOT NULL CHECK (page >= 1),
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (user_id, book_id, page)
);

CREATE TABLE IF NOT EXISTS book_requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  author         TEXT NOT NULL DEFAULT '',
  reason         TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  librarian_note TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL,
  resolved_at    TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`;

const BOOKS = [
  ['The Pragmatic Programmer', 'David Thomas & Andrew Hunt', 'Technology', 1999, 4, 205, 352, 'Timeless advice on craftsmanship, from orthogonality to tracer bullets.'],
  ['Clean Code', 'Robert C. Martin', 'Technology', 2008, 3, 160, 464, 'A handbook of agile software craftsmanship and readable code.'],
  ['Software Testing Techniques', 'Boris Beizer', 'Technology', 1990, 3, 12, 550, 'The classic on path testing, domain testing and test design strategy.'],
  ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest & Stein', 'Technology', 2009, 5, 230, 1312, 'The definitive reference for algorithms and data structures.'],
  ['The Design of Everyday Things', 'Don Norman', 'Design', 1988, 2, 28, 368, 'Why some products satisfy while others frustrate — affordances and feedback.'],
  ['Pride and Prejudice', 'Jane Austen', 'Fiction', 1813, 4, 340, 432, 'Wit, manners and misjudgement in Regency England.'],
  ['Frankenstein', 'Mary Shelley', 'Fiction', 1818, 3, 120, 280, 'A scientist, his creation, and the cost of ambition.'],
  ['Moby-Dick', 'Herman Melville', 'Fiction', 1851, 1, 195, 635, 'Captain Ahab’s obsessive hunt for the white whale.'],
  ['The Time Machine', 'H. G. Wells', 'Science Fiction', 1895, 2, 265, 118, 'A Victorian inventor travels to the far future of humanity.'],
  ['Dune', 'Frank Herbert', 'Science Fiction', 1965, 3, 35, 688, 'Politics, ecology and prophecy on the desert planet Arrakis.'],
  ['A Brief History of Time', 'Stephen Hawking', 'Science', 1988, 3, 250, 256, 'From the big bang to black holes, for the curious reader.'],
  ['The Selfish Gene', 'Richard Dawkins', 'Science', 1976, 2, 140, 360, 'A gene-centred view of evolution that changed biology.'],
  ['Sapiens', 'Yuval Noah Harari', 'History', 2011, 4, 18, 498, 'A brief history of humankind, from foragers to algorithms.'],
  ['Meditations', 'Marcus Aurelius', 'Philosophy', 180, 2, 45, 254, 'Private notes on Stoic discipline by a Roman emperor.'],
  ['Thinking, Fast and Slow', 'Daniel Kahneman', 'Psychology', 2011, 3, 300, 499, 'The two systems that drive the way we think and decide.'],
  ['Atomic Habits', 'James Clear', 'Self-Help', 2018, 3, 175, 320, 'Tiny changes, remarkable results: a framework for habits.'],
];

export function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (c === 0) seed(db);
  return db;
}

function seed(db) {
  const now = Date.now();
  const iso = (offsetDays = 0) => new Date(now + offsetDays * 86400000).toISOString();
  db.exec('BEGIN');
  try {
    const addUser = db.prepare('INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?,?,?,?,?)');
    const uid = {};
    for (const [username, password, role] of [
      ['librarian', 'Library@123', 'LIBRARIAN'],
      ['student_demo', 'Student@123', 'STUDENT'],
      ['staff_demo', 'Staff@123', 'STAFF'],
      ['author_demo', 'Author@123', 'AUTHOR'],
    ]) {
      uid[username] = Number(addUser.run(username, `${username}@athenaeum.edu`, hashPassword(password), role, iso(-30)).lastInsertRowid);
    }

    const addBook = db.prepare(`INSERT INTO books (title, author, genre, year, total_copies, available_copies, cover_hue, pages, description, status, submitted_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const bid = {};
    for (const [title, author, genre, year, copies, hue, pages, desc] of BOOKS) {
      bid[title] = Number(addBook.run(title, author, genre, year, copies, copies, hue, pages, desc, 'APPROVED', null, iso(-60)).lastInsertRowid);
    }
    // Author submissions: one approved, one pending
    bid.quiet = Number(addBook.run('The Quiet Algorithm', 'author_demo', 'Fiction', 2026, 2, 2, 280, 180,
      'A debut novel about a librarian who teaches a search engine to read between the lines.', 'APPROVED', uid.author_demo, iso(-10)).lastInsertRowid);
    addBook.run('Echoes of the Lost Archive', 'author_demo', 'Mystery', 2026, 0, 0, 320, 210,
      'A missing manuscript, a sealed reading room, and a catalogue that lies.', 'PENDING', uid.author_demo, iso(-1));

    // Loans: an overdue one, a fresh one, an unavailable book, and some history for the stats chart
    const addLoan = db.prepare('INSERT INTO loans (user_id, book_id, borrowed_at, due_at, returned_at, status) VALUES (?,?,?,?,?,?)');
    const dec = db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?');
    const active = [
      [uid.student_demo, bid['Dune'], -20],
      [uid.student_demo, bid['Clean Code'], -2],
      [uid.staff_demo, bid['Moby-Dick'], -4],
    ];
    for (const [u, b, d] of active) { addLoan.run(u, b, iso(d), iso(d + 14), null, 'ACTIVE'); dec.run(b); }
    const history = [
      [uid.student_demo, 'Frankenstein', -6], [uid.staff_demo, 'Sapiens', -5], [uid.student_demo, 'Meditations', -5],
      [uid.staff_demo, 'The Pragmatic Programmer', -4], [uid.student_demo, 'Atomic Habits', -3], [uid.staff_demo, 'Dune', -3],
      [uid.student_demo, 'The Time Machine', -1], [uid.staff_demo, 'The Pragmatic Programmer', -1],
    ];
    for (const [u, t, d] of history) addLoan.run(u, bid[t], iso(d), iso(d + 14), iso(d + 0.5), 'RETURNED');

    const addReview = db.prepare('INSERT INTO reviews (book_id, user_id, rating, text, created_at) VALUES (?,?,?,?,?)');
    addReview.run(bid['The Pragmatic Programmer'], uid.student_demo, 5, 'Changed how I approach every project. The broken-windows chapter alone is worth it.', iso(-3));
    addReview.run(bid['The Pragmatic Programmer'], uid.staff_demo, 4, 'Still relevant decades later.', iso(-2));
    addReview.run(bid['Frankenstein'], uid.student_demo, 5, 'Far more haunting than any film adaptation.', iso(-5));
    addReview.run(bid['Dune'], uid.staff_demo, 4, 'Dense world-building, but rewarding.', iso(-2));
    addReview.run(bid.quiet, uid.student_demo, 4, 'Charming and clever — a library story for the search-engine age.', iso(-4));

    db.prepare('INSERT INTO bookmarks (user_id, book_id, page, note, created_at) VALUES (?,?,?,?,?)')
      .run(uid.student_demo, bid['Clean Code'], 42, 'Functions should do one thing', iso(-1));
    db.prepare('INSERT INTO book_requests (user_id, title, author, reason, created_at) VALUES (?,?,?,?,?)')
      .run(uid.student_demo, 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Needed for the distributed systems elective.', iso(-1));

    const notify = db.prepare('INSERT INTO notifications (user_id, type, message, is_read, created_at) VALUES (?,?,?,?,?)');
    notify.run(uid.student_demo, 'BORROW', 'You borrowed "Clean Code". It is due back in 12 days.', 0, iso(-2));
    notify.run(uid.student_demo, 'OVERDUE', '"Dune" is overdue. Please return it as soon as possible.', 0, iso(-0.2));
    notify.run(uid.author_demo, 'MANUSCRIPT', 'Your manuscript "The Quiet Algorithm" was approved and is now in the catalog.', 0, iso(-10));
    for (const u of Object.values(uid)) notify.run(u, 'WELCOME', 'Welcome to Athenaeum — your library, reimagined.', 1, iso(-30));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
