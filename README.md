# Athenaeum — Library Management System (STQA project)

A full-stack library management system: a **Node.js + Express** REST API, a **SQLite** database (Node's built-in `node:sqlite`) and a **vanilla-JS single-page frontend**. It includes a built-in **QA Lab** that runs 40 selected STQA test cases live against the API.

## Run it

Requires Node.js 22.13 or newer (tested on Node 24).

```bash
npm install
npm start          # → http://localhost:3000
npm test           # runs the 40 test cases on a fresh in-memory DB
npm run report     # writes reports/STQA_Execution_Report.md + .csv (Actual Result / Status filled in)
```

Delete `data/library.db` to reset to the demo seed data. If port 3000 is busy: `$env:PORT=3001; npm start` (PowerShell).

| Role | Username | Password |
|---|---|---|
| Librarian | `librarian` | `Library@123` |
| Student | `student_demo` | `Student@123` |
| Staff | `staff_demo` | `Staff@123` |
| Author | `author_demo` | `Author@123` |

## Features by role

- **Student / Staff:** browse and search the catalog, filter by genre or availability, borrow (14 days, max 3 active), return, read in the built-in reader, bookmark pages, review books (1–5★, one review per book), request new books, and get notifications.
- **Author:** submit, edit and withdraw manuscripts, and track their review status. Approved manuscripts are locked; editing a rejected one resubmits it.
- **Librarian:** statistics dashboard, approve or reject manuscripts and book requests, search members, and add or remove catalog books.
- **Security:** HS256 JWT (8h), scrypt password hashing, and role checks on every endpoint. The user's role is reloaded from the database on each request, so a forged role claim does nothing. Queries are parameterised and all output is HTML-escaped.

## The 40 selected test cases (at least two from every section)

| TC ID | Section | Scenario | Expected |
|---|---|---|---|
| TC001 | 1. Auth | Register with valid student details | Account created |
| TC003 | 1. Auth | Register with duplicate username | Rejected (409) |
| TC009 | 1. Auth | Login with wrong password | Rejected (401) |
| TC012 | 1. Auth | Use malformed JWT | Rejected (401) |
| TC015 | 1. Auth | Access protected endpoint without token | 401 |
| TC016 | 2. RBAC | Student opens librarian page | Access denied (403) |
| TC019 | 2. RBAC | Librarian accesses admin function | Allowed (200) |
| TC022 | 2. RBAC | Author edits another author's manuscript | Access denied (403) |
| TC025 | 2. RBAC | Role privilege escalation attempt | Prevented |
| TC028 | 3. Catalog | Search by partial title | Matching results |
| TC029 | 3. Catalog | Search nonexistent title | No results |
| TC035 | 3. Catalog | Open nonexistent book | 404 |
| TC036 | 3. Catalog | Catalog excludes unapproved submission | Not shown |
| TC040 | 3. Catalog | Case variation in search | Consistent results |
| TC042 | 4. Borrowing | Borrow unavailable book | Rejected (409) |
| TC045 | 4. Borrowing | Borrow when active-borrow limit reached | Rejected (409) |
| TC047 | 4. Borrowing | Borrow same book twice | Prevented (409) |
| TC051 | 4. Borrowing | Borrow unapproved manuscript | Rejected (404) |
| TC052 | 4. Borrowing | Available-copy count after borrow | Decreases by 1 |
| TC056 | 5. Return | Return currently borrowed book | Returned |
| TC058 | 5. Return | Return already returned book | Rejected (409), no double count |
| TC063 | 5. Return | Unauthorized return | Access denied (403) |
| TC065 | 5. Return | Return and verify history | History updated |
| TC067 | 6. Requests | Create blank book request | Validation error (400) |
| TC071 | 6. Requests | Librarian approves request | APPROVED |
| TC072 | 6. Requests | Librarian rejects request | REJECTED |
| TC077 | 6. Requests | Modify resolved request | Rejected (409) |
| TC082 | 7. Author | Submit manuscript without title | Validation error (400) |
| TC091 | 7. Author | Librarian approves manuscript | APPROVED + in catalog |
| TC092 | 7. Author | Librarian rejects manuscript | REJECTED, not in catalog |
| TC098 | 8. Reviews | Review with invalid rating | Rejected (400) |
| TC105 | 8. Reviews | Duplicate review by same user | Rejected (409) |
| TC115 | 9. Reading | Remove own bookmark | Removed |
| TC116 | 9. Reading | Add duplicate bookmark | Duplicate handled (409) |
| TC121 | 10. Notifications | Receive borrow notification | Notification generated |
| TC125 | 10. Notifications | Notification isolation | No leakage (404) |
| TC134 | 11. Librarian | Unauthorized user manages users | Access denied (403) |
| TC137 | 11. Librarian | View borrowing statistics | Correct metrics |
| TC146 | 12. Validation | Malformed JSON request | 400 |
| TC148 | 12. Validation | SQL / script-like input in search | Handled safely |

All 40 cases are defined in one place, [public/js/testcases.js](public/js/testcases.js). The same module runs in three places:
1. **QA Lab page** (`#/qa` in the app): click **Run all 40** to watch each case run against the live server, then **Export CSV**.
2. **`npm test`**: the Node test runner against an isolated in-memory server.
3. **`npm run report`**: produces a Markdown/CSV execution report for the lab record.

Each case creates its own throwaway `qa_*` users and cleans up the books, loans, bookmarks and manuscripts it creates. It can be re-run any number of times.

A step-by-step guide to demonstrating every case by hand is in [docs/STQA_Test_Cases_Demo_Guide.pdf](docs/STQA_Test_Cases_Demo_Guide.pdf).

## Project layout

```
server/  index.js (entry) · app.js (routes) · auth.js (JWT, hashing, RBAC) · db.js (schema + seed)
public/  index.html · css/styles.css · js/app.js (SPA) · js/testcases.js (40 STQA cases)
tests/   stqa.test.js        scripts/ report.js        docs/ demo guide PDF
```
