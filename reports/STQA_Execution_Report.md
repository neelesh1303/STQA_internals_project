# STQA Execution Report — Athenaeum Library Management System

Executed: 2026-11-16 13:26:28 UTC · Environment: Node v24.14.0, fresh in-memory SQLite · Result: **40/40 passed**

| TC ID | Section | Test Scenario | Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC001 | 1. Registration, Login & Authentication | Register with valid student details | Unique username/email + valid password | Account created | HTTP 201 — account "qa_5bk1s1" created with role STUDENT; JWT issued | **PASS** |
| TC003 | 1. Registration, Login & Authentication | Register with duplicate username | Existing username, different email | Registration rejected | HTTP 409 — "Username is already taken" | **PASS** |
| TC009 | 1. Registration, Login & Authentication | Login with wrong password | Valid username + wrong password | Login rejected | HTTP 401 — "Invalid username or password"; no token issued | **PASS** |
| TC012 | 1. Registration, Login & Authentication | Use malformed JWT | Bearer "abc" and "not.a.jwt" | Request rejected | All 3 malformed tokens → HTTP 401/401/401 (incl. alg "none" token) | **PASS** |
| TC015 | 1. Registration, Login & Authentication | Access protected endpoint without token | GET /api/loans/me with no Authorization header | 401 / access denied | HTTP 401 — "Authentication required: missing bearer token" | **PASS** |
| TC016 | 2. Role-Based Access Control | Student opens librarian page | Student token → GET /api/admin/stats | Access denied | HTTP 403 — "Access denied: requires role LIBRARIAN" | **PASS** |
| TC019 | 2. Role-Based Access Control | Librarian accesses admin function | Librarian token → stats, users, manuscripts | Access allowed | HTTP 200 for stats, users, manuscripts | **PASS** |
| TC022 | 2. Role-Based Access Control | Author edits another author's manuscript | Second author edits/deletes author_demo manuscript | Access denied | Edit → HTTP 403, delete → HTTP 403; title unchanged | **PASS** |
| TC025 | 2. Role-Based Access Control | Role privilege escalation attempt | Register with role=LIBRARIAN; forge JWT payload role=LIBRARIAN | Privilege escalation prevented | Self-assign LIBRARIAN → HTTP 403; forged JWT role claim → HTTP 401 (Invalid or expired token (invalid signature)) | **PASS** |
| TC028 | 3. Book Catalog & Search | Search by partial title | q = "prag" | Matching results displayed | HTTP 200 — 1 match(es): The Pragmatic Programmer | **PASS** |
| TC029 | 3. Book Catalog & Search | Search nonexistent title | q = "zzqx no such book" | No results | HTTP 200 — 0 results (empty list, no error) | **PASS** |
| TC035 | 3. Book Catalog & Search | Open nonexistent book | GET /api/books/999999 | 404 / error handled | HTTP 404 — "Book not found" | **PASS** |
| TC036 | 3. Book Catalog & Search | Catalog excludes unapproved submission | Author submits PENDING manuscript, reader searches for it | Not shown in approved catalog | Manuscript #20 is PENDING → search returned 0 results; GET /api/books/20 → 404 | **PASS** |
| TC040 | 3. Book Catalog & Search | Case variation in search | q = "pragmatic" / "PRAGMATIC" / "PrAgMaTiC" | Search behaves consistently | All 3 spellings returned the same result set (book id 1) | **PASS** |
| TC042 | 4. Borrowing / Book Issue | Borrow unavailable book | Book with 1 copy already borrowed by another user | Borrow rejected | Copies 1→0 after user A; user B → HTTP 409 "No copies of this book are currently available" | **PASS** |
| TC045 | 4. Borrowing / Book Issue | Borrow when active-borrow limit is reached | User with 3 active loans borrows one more | Borrow rejected | 3 loans OK; loan #4 → HTTP 409 "Borrow limit reached: maximum 3 active loans" | **PASS** |
| TC047 | 4. Borrowing / Book Issue | Borrow same book twice | Same user + same book | Duplicate / second borrow prevented | 1st borrow HTTP 201; 2nd borrow HTTP 409 "You already have an active loan for this book" | **PASS** |
| TC051 | 4. Borrowing / Book Issue | Borrow unapproved manuscript | PENDING manuscript id | Borrow rejected / not available | HTTP 404 — "Book not found in the approved catalog" | **PASS** |
| TC052 | 4. Borrowing / Book Issue | Verify available-copy count after borrow | Book with known availability | Availability decreases correctly | "A Brief History of Time": available copies 3 → 2 | **PASS** |
| TC056 | 5. Return & Overdue Handling | Return currently borrowed book | Valid active loan | Book returned (and availability restored) | HTTP 200 — loan #18 RETURNED; availability back to 3 | **PASS** |
| TC058 | 5. Return & Overdue Handling | Return already returned book | Completed loan returned again | Handled without duplicate return | 1st return HTTP 200; 2nd HTTP 409 "This loan has already been returned"; copies not double-counted | **PASS** |
| TC063 | 5. Return & Overdue Handling | Unauthorized return | User B returns User A's loan | Access denied | HTTP 403 "Access denied: this loan belongs to another user"; owner's loan still ACTIVE | **PASS** |
| TC065 | 5. Return & Overdue Handling | Return and verify history | Borrow then return a book | History updated | History shows "A Brief History of Time" as RETURNED with a return timestamp | **PASS** |
| TC067 | 6. Book Requests | Create blank book request | title = "   " (whitespace only) | Validation error | HTTP 400 — Title is required | **PASS** |
| TC071 | 6. Book Requests | Librarian approves request | Pending request from a student | Status becomes approved/resolved | Request #2: PENDING → APPROVED; student sees the new status | **PASS** |
| TC072 | 6. Book Requests | Librarian rejects request | Pending request, decision = REJECTED | Status becomes rejected | PENDING → REJECTED; student sees status and note "Out of print" | **PASS** |
| TC077 | 6. Book Requests | Modify resolved request | Already-approved request resolved again | Invalid modification rejected | HTTP 409 — "Request has already been resolved"; status stays APPROVED | **PASS** |
| TC082 | 7. Author Portal & Manuscripts | Submit manuscript without title | title = "" | Validation error | HTTP 400 — Title is required | **PASS** |
| TC091 | 7. Author Portal & Manuscripts | Librarian approves manuscript | Pending submission, approve with 2 copies | Status becomes approved (and visible in catalog) | Manuscript #23: PENDING → APPROVED; now in catalog with 2 copies | **PASS** |
| TC092 | 7. Author Portal & Manuscripts | Librarian rejects manuscript | Pending submission, decision = REJECTED | Status becomes rejected | PENDING → REJECTED; not visible in catalog | **PASS** |
| TC098 | 8. Reviews & Sentiment | Review with invalid rating | rating = 7, rating = 0, rating = 3.5 | Rejected | All rejected (7→400, 0→400, 3.5→400): "Rating must be a whole number from 1 to 5" | **PASS** |
| TC105 | 8. Reviews & Sentiment | Duplicate review by same user | Same book + same user reviews twice | Duplicate handled according to rule | 1st review HTTP 201; 2nd HTTP 409 "You have already reviewed this book" (rule: one review per user per book) | **PASS** |
| TC115 | 9. Reading, Highlights & Bookmarks | Remove own bookmark | Existing bookmark | Bookmark removed | DELETE HTTP 200; bookmark list is now empty | **PASS** |
| TC116 | 9. Reading, Highlights & Bookmarks | Add duplicate bookmark | Same book, same page twice | Duplicate handled | 1st bookmark HTTP 201; duplicate HTTP 409 "Page 12 is already bookmarked"; only 1 stored | **PASS** |
| TC121 | 10. Notifications & Recommendations | Receive borrow notification | Successful borrow | Notification generated | Unread BORROW notification: "You borrowed "A Brief History of Time". It is due back on Mon Nov 30 2026." | **PASS** |
| TC125 | 10. Notifications & Recommendations | Notification isolation | User A reads/marks User B's notification | Access denied / no leakage | HTTP 404 for A; A's list excludes B's notification; B's stays unread | **PASS** |
| TC134 | 11. Librarian Administration & Statistics | Unauthorized user manages users | Student → GET /api/admin/users, POST /api/admin/books | Access denied | List users → HTTP 403; add book → HTTP 403 | **PASS** |
| TC137 | 11. Librarian Administration & Statistics | View borrowing statistics | Librarian account; one new loan created | Correct borrowing metrics displayed | HTTP 200 — activeLoans 3→4, totalLoans 21→22 | **PASS** |
| TC146 | 12. Validation, Boundary, Negative & Integration | Malformed JSON request | {"username": "x",   (truncated JSON) | 400 / error handled | HTTP 400 — "Malformed JSON request body" (no stack trace leaked) | **PASS** |
| TC148 | 12. Validation, Boundary, Negative & Integration | SQL/script-like input in search | ' OR 1=1 --   /   <script>alert(1)</script> | Input handled safely | Injection/wildcard queries returned HTTP 200 with 0 rows (no leakage); script username → HTTP 400 | **PASS** |
