# Athenaeum — Library Management System (STQA project)

A full-stack library management system: a **Node.js + Express** REST API, a **SQLite** database (Node's built-in `node:sqlite`) and a **vanilla-JS single-page frontend**. It includes a built-in **QA Lab** that runs 20 selected STQA test cases live against the API.

## Run it

Requires Node.js 22.13 or newer (tested on Node 24).

```bash
npm install
npm start          # → http://localhost:3000
npm test           # runs the 20 test cases on a fresh in-memory DB
npm run report     # writes reports/STQA_Execution_Report.md + .csv (Actual Result / Status filled in)
```

Delete `data/library.db` to reset to the demo seed data.

| Role | Username | Password |
|---|---|---|
| Librarian | `librarian` | `Library@123` |
| Student | `student_demo` | `Student@123` |
| Staff | `staff_demo` | `Staff@123` |
| Author | `author_demo` | `Author@123` |

## Features by role

- **Student / Staff:** browse and search the catalog, filter by genre or availability, borrow (14 days, max 3 active), return, read in the built-in reader, bookmark pages, review books (1–5★), request new books, and get notifications.
- **Author:** submit manuscripts, track their review status, and withdraw pending or rejected manuscripts.
- **Librarian:** statistics dashboard, approve or reject manuscripts and book requests, search members, and add or remove catalog books.
- **Security:** HS256 JWT (8h), scrypt password hashing, and role checks on every endpoint. The user's role is reloaded from the database on each request, so a forged role claim does nothing. Queries are parameterised and all output is HTML-escaped.

## The 20 selected test cases (at least one from every section)

| TC ID | Section | Scenario | Expected |
|---|---|---|---|
| TC001 | 1. Auth | Register with valid student details | Account created |
| TC015 | 1. Auth | Access protected endpoint without token | 401 |
| TC016 | 2. RBAC | Student opens librarian page | Access denied (403) |
| TC025 | 2. RBAC | Role privilege escalation attempt | Prevented (self-assign → 403, forged JWT → 401) |
| TC028 | 3. Catalog | Search by partial title | Matching results |
| TC036 | 3. Catalog | Catalog excludes unapproved submission | Not shown |
| TC045 | 4. Borrowing | Borrow when active-borrow limit reached | Rejected (409) |
| TC047 | 4. Borrowing | Borrow same book twice | Prevented (409) |
| TC052 | 4. Borrowing | Available-copy count after borrow | Decreases by 1 |
| TC056 | 5. Return | Return currently borrowed book | Returned, availability restored |
| TC063 | 5. Return | Unauthorized return (other user's loan) | Access denied (403) |
| TC067 | 6. Requests | Create blank book request | Validation error (400) |
| TC071 | 6. Requests | Librarian approves request | Status APPROVED |
| TC082 | 7. Author | Submit manuscript without title | Validation error (400) |
| TC091 | 7. Author | Librarian approves manuscript | APPROVED + visible in catalog |
| TC098 | 8. Reviews | Review with invalid rating | Rejected (400) |
| TC116 | 9. Reading | Add duplicate bookmark | Duplicate handled (409) |
| TC121 | 10. Notifications | Receive borrow notification | Notification generated |
| TC137 | 11. Librarian | View borrowing statistics | Correct metrics |
| TC148 | 12. Validation | SQL / script-like input in search | Handled safely |

All 20 cases are defined in one place, [public/js/testcases.js](public/js/testcases.js). The same module runs in three places:
1. **QA Lab page** (`#/qa` in the app): click **Run all 20** to watch each case run against the live server, then **Export CSV**.
2. **`npm test`**: the Node test runner against an isolated in-memory server.
3. **`npm run report`**: produces a Markdown/CSV execution report for the lab record.

Each case creates its own throwaway `qa_*` users and returns borrowed books, deletes test books and deletes test bookmarks afterwards. It can be re-run any number of times.

## Demonstrating the cases manually in the UI

- TC016: sign in as `student_demo` and open `http://localhost:3000/#/librarian`. The 403 page shows the server's response.
- TC045 / TC047 / TC052 / TC056: borrow and return from a book's detail window or from **My Shelf**. The copy count updates live.
- TC116: open a borrowed book, click **Read now**, and bookmark the same page twice.
- TC036 / TC091: as `author_demo`, submit a manuscript. As `librarian`, go to **Manuscripts** and approve it. It then appears in the catalog.
- TC148: type `' OR 1=1 --` into the catalog search.

## Project layout

```
server/  index.js (entry) · app.js (routes) · auth.js (JWT, hashing, RBAC) · db.js (schema + seed)
public/  index.html · css/styles.css · js/app.js (SPA) · js/testcases.js (20 STQA cases)
tests/   stqa.test.js        scripts/ report.js
```
