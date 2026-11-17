// Builds STQA_Test_Results.pptx: expected vs actual results grouped by testing type.
const pptxgen = require('pptxgenjs');
const { applyTheme } = require('C:/Users/acer/.claude/skills/synced/001fb582-5230-4d23-bfe4-93b09c72faf4_aeff5403-b321-4289-921d-7e44a9bd14ad/pptx/scripts/apply_theme.js');

const OUT = process.argv[2];

const THEME = {
  name: 'Athenaeum STQA',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '1B2433', lt1: 'FFFFFF', dk2: '24364F', lt2: 'EEF2F6',
    accent1: '2E7D4F', // positive
    accent2: 'D9731A', // negative
    accent3: '7B3FA0', // security
    accent4: '1F6FB2', // boundary
    accent5: '4A5568', // white box
    accent6: 'B83227',
    hlink: '1F6FB2', folHlink: '7B3FA0',
  },
};
const HEX = THEME.colors;

// ---------------------------------------------------------------- data
const TYPES = {
  Positive: { color: HEX.accent1, def: 'Valid input, normal use. Checks the feature works when the user does the right thing.' },
  Negative: { color: HEX.accent2, def: 'Invalid or unexpected input. Checks the system rejects it with the right error and does not crash.' },
  Security: { color: HEX.accent3, def: 'Missing or forged tokens, wrong roles, injection. Checks unauthorised access is blocked.' },
  Boundary: { color: HEX.accent4, def: 'Values at and just past each limit (black box BVA). Checks the edges of valid ranges.' },
  'White box': { color: HEX.accent5, def: 'Designed from the source code. Each case forces one branch of POST /api/loans.' },
};

// [id, scenario, type, expected, actual]   (actual = shortened from reports/STQA_Execution_Report.csv)
const CASES = [
  ['TC001', 'Register with valid student details', 'Positive', 'Account created', 'HTTP 201 – account created, role STUDENT, JWT issued'],
  ['TC019', 'Librarian accesses admin function', 'Positive', 'Access allowed', 'HTTP 200 for stats, users and manuscripts'],
  ['TC028', 'Search by partial title', 'Positive', 'Matching results shown', 'HTTP 200 – 1 match: The Pragmatic Programmer'],
  ['TC040', 'Case variation in search', 'Positive', 'Consistent results', 'All 3 spellings returned the same book'],
  ['TC052', 'Available copies after borrow', 'Positive', 'Count decreases by 1', 'Available copies 3 → 2'],
  ['TC056', 'Return a borrowed book', 'Positive', 'Book returned', 'HTTP 200 – loan RETURNED, copies back to 3'],
  ['TC065', 'Return and verify history', 'Positive', 'History updated', 'History shows book as RETURNED with timestamp'],
  ['TC071', 'Librarian approves request', 'Positive', 'Status APPROVED', 'Request PENDING → APPROVED; student sees it'],
  ['TC072', 'Librarian rejects request', 'Positive', 'Status REJECTED', 'PENDING → REJECTED with note “Out of print”'],
  ['TC091', 'Librarian approves manuscript', 'Positive', 'APPROVED and in catalog', 'PENDING → APPROVED; in catalog with 2 copies'],
  ['TC092', 'Librarian rejects manuscript', 'Positive', 'REJECTED, not in catalog', 'PENDING → REJECTED; not in catalog'],
  ['TC115', 'Remove own bookmark', 'Positive', 'Bookmark removed', 'DELETE HTTP 200; bookmark list empty'],
  ['TC121', 'Receive borrow notification', 'Positive', 'Notification generated', 'Unread BORROW notification with due date'],
  ['TC137', 'View borrowing statistics', 'Positive', 'Correct metrics', 'HTTP 200 – activeLoans 3 → 4, totalLoans 21 → 22'],

  ['TC003', 'Register with duplicate username', 'Negative', 'Rejected', 'HTTP 409 – “Username is already taken”'],
  ['TC009', 'Login with wrong password', 'Negative', 'Login rejected', 'HTTP 401 – “Invalid username or password”'],
  ['TC029', 'Search nonexistent title', 'Negative', 'No results', 'HTTP 200 – 0 results, no error'],
  ['TC035', 'Open nonexistent book', '404 / handled', '', ''],
  ['TC036', 'Catalog excludes unapproved book', 'Negative', 'Not shown', 'PENDING manuscript: 0 search results, GET → 404'],
  ['TC042', 'Borrow unavailable book', 'Negative', 'Borrow rejected', 'HTTP 409 – “No copies … available”'],
  ['TC045', 'Borrow past the 3-loan limit', 'Negative', 'Borrow rejected', '4th loan → HTTP 409 “Borrow limit reached”'],
  ['TC047', 'Borrow same book twice', 'Negative', 'Second borrow prevented', '1st 201; 2nd HTTP 409 “already have an active loan”'],
  ['TC051', 'Borrow unapproved manuscript', 'Negative', 'Rejected', 'HTTP 404 – “Book not found in the approved catalog”'],
  ['TC058', 'Return already returned book', 'Negative', 'No double return', '2nd return HTTP 409; copies not double-counted'],
  ['TC067', 'Create blank book request', 'Negative', 'Validation error', 'HTTP 400 – “Title is required”'],
  ['TC077', 'Modify resolved request', 'Negative', 'Rejected', 'HTTP 409 – “Request has already been resolved”'],
  ['TC082', 'Submit manuscript without title', 'Negative', 'Validation error', 'HTTP 400 – “Title is required”'],
  ['TC098', 'Review with invalid rating', 'Negative', 'Rejected', '7, 0 and 3.5 → all HTTP 400'],
  ['TC105', 'Duplicate review by same user', 'Negative', 'Rejected', '2nd review HTTP 409 “already reviewed”'],
  ['TC116', 'Add duplicate bookmark', 'Negative', 'Duplicate handled', 'HTTP 409 “Page 12 is already bookmarked”'],
  ['TC146', 'Malformed JSON request', 'Negative', '400, error handled', 'HTTP 400 – “Malformed JSON”, no stack trace'],
  ['BB09', 'Review rating 3.5 (decimal class)', 'Negative', 'Rejected (400)', 'HTTP 400 – “Rating must be a whole number”'],

  ['TC012', 'Use malformed JWT', 'Security', 'Rejected', '3 bad tokens (incl. alg “none”) → HTTP 401'],
  ['TC015', 'Protected endpoint, no token', 'Security', '401', 'HTTP 401 – “missing bearer token”'],
  ['TC016', 'Student opens librarian page', 'Security', 'Access denied', 'HTTP 403 – “requires role LIBRARIAN”'],
  ['TC022', "Author edits another's manuscript", 'Security', 'Access denied', 'Edit 403, delete 403; title unchanged'],
  ['TC025', 'Role privilege escalation', 'Security', 'Prevented', 'Self-assign LIBRARIAN 403; forged JWT 401'],
  ['TC063', "Return another user's book", 'Security', 'Access denied', 'HTTP 403; owner’s loan still ACTIVE'],
  ['TC125', 'Notification isolation', 'Security', 'No leakage', 'HTTP 404 for user A; B’s data unchanged'],
  ['TC134', 'Student manages users / books', 'Security', 'Access denied', 'List users 403; add book 403'],
  ['TC148', 'SQL / script input in search', 'Security', 'Handled safely', 'Injection → 200 with 0 rows; script name → 400'],

  ['BB01', 'Password length 5 (below min)', 'Boundary', 'Rejected (400)', 'HTTP 400 – “Validation failed”'],
  ['BB02', 'Password length 6 (min)', 'Boundary', 'Created (201)', 'HTTP 201 – account created'],
  ['BB03', 'Password length 72 (max)', 'Boundary', 'Created (201)', 'HTTP 201 – account created'],
  ['BB04', 'Password length 73 (above max)', 'Boundary', 'Rejected (400)', 'HTTP 400 – “Validation failed”'],
  ['BB05', 'Review rating 0 (below min)', 'Boundary', 'Rejected (400)', 'HTTP 400 – “Rating must be … 1 to 5”'],
  ['BB06', 'Review rating 1 (min)', 'Boundary', 'Saved (201)', 'HTTP 201 – review saved'],
  ['BB07', 'Review rating 5 (max)', 'Boundary', 'Saved (201)', 'HTTP 201 – review saved'],
  ['BB08', 'Review rating 6 (above max)', 'Boundary', 'Rejected (400)', 'HTTP 400 – “Rating must be … 1 to 5”'],

  ['WB01', 'Branch 1: if (!bookId)', 'White box', '400', 'HTTP 400 – “A valid bookId is required”'],
  ['WB02', 'Branch 2: if (!book)', 'White box', '404', 'HTTP 404 – “Book not found in the approved catalog”'],
  ['WB03', 'Branch 3: active loan exists', 'White box', '409 duplicate', 'HTTP 409 – “already have an active loan”'],
  ['WB04', 'Branch 4: c >= MAX_ACTIVE_LOANS', 'White box', '409 limit', 'HTTP 409 – “Borrow limit reached: maximum 3”'],
  ['WB05', 'Branch 5: dec.changes !== 1', 'White box', '409 no copies', 'HTTP 409 – “No copies … available”'],
  ['WB06', 'All branches false', 'White box', '201, copies 2 → 1', 'HTTP 201 – loan ACTIVE; copies 2 → 1'],
];
// TC035 row written in full here to keep the table above aligned
CASES[CASES.findIndex((c) => c[0] === 'TC035')] = ['TC035', 'Open nonexistent book', 'Negative', '404 / handled', 'HTTP 404 – “Book not found”'];

const byType = (t) => CASES.filter((c) => c[2] === t);
if (CASES.length !== 55) throw new Error(`Expected 55 cases, got ${CASES.length}`);

// ---------------------------------------------------------------- deck
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.title = 'Athenaeum STQA Test Results';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: 'Title Dark',
  background: { color: HEX.dk1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 1.5, w: 11.7, h: 1.9, fontSize: 44, bold: true, color: C.background1, fontFace: THEME.headFontFace, valign: 'bottom' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 3.5, w: 11.7, h: 0.9, fontSize: 20, color: 'C9D3E0', valign: 'top' }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'Title Only',
  background: { color: HEX.lt1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 12.1, h: 0.8, fontSize: 32, bold: true, color: C.text1, fontFace: THEME.headFontFace, valign: 'middle' }, text: '' } },
    { text: { text: 'Athenaeum · STQA Test Results', options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: '6B7280', isTextBox: true, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: '6B7280', align: 'right' },
});

// ---- 1. Title
pres.addSection({ title: 'Overview' });
{
  const s = pres.addSlide({ masterName: 'Title Dark', sectionTitle: 'Overview' });
  s.addText('STQA Test Results', { placeholder: 'title' });
  s.addText('Athenaeum Library Management System · expected vs actual results by type of testing', { placeholder: 'body' });
  // stat strip
  const stats = [['55', 'test cases'], ['55', 'passed'], ['0', 'failed'], ['5', 'testing types']];
  stats.forEach(([n, l], i) => {
    const x = 0.8 + i * 2.9;
    s.addText(n, { x, y: 4.9, w: 2.6, h: 0.9, fontSize: 48, bold: true, color: i === 2 ? 'F2A65A' : '8FD3A8', fontFace: THEME.headFontFace, isTextBox: true, margin: 0, objectName: `stat-${l}` });
    s.addText(l, { x, y: 5.8, w: 2.6, h: 0.4, fontSize: 16, color: 'C9D3E0', isTextBox: true, margin: 0 });
  });
  s.addNotes('Introduce the project and the headline: all 55 automated test cases pass. The rest of the deck groups them by type of testing and shows expected vs actual result for each.');
}

// ---- 2. Types of testing
{
  const s = pres.addSlide({ masterName: 'Title Only', sectionTitle: 'Overview' });
  s.addText('Types of testing used', { placeholder: 'title' });
  const names = Object.keys(TYPES);
  const cardW = 2.3, gap = 0.15, y = 1.5;
  names.forEach((t, i) => {
    const x = 0.6 + i * (cardW + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cardW, h: 4.9, fill: { color: HEX.lt2 }, line: { color: HEX.lt2 }, rectRadius: 0.1, objectName: `card-${t}` });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.3, w: 0.9, h: 0.9, fill: { color: TYPES[t].color }, line: { color: TYPES[t].color } });
    s.addText(String(byType(t).length), { x: x + 0.25, y: y + 0.3, w: 0.9, h: 0.9, fontSize: 24, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
    s.addText(t, { x: x + 0.25, y: y + 1.45, w: cardW - 0.5, h: 0.5, fontSize: 22, bold: true, color: TYPES[t].color, fontFace: THEME.headFontFace, isTextBox: true, margin: 0 });
    s.addText(TYPES[t].def, { x: x + 0.25, y: y + 2.05, w: cardW - 0.5, h: 2.6, fontSize: 15, color: HEX.dk2, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addNotes('Five kinds of testing. Positive checks the happy path. Negative feeds invalid input and expects a clean rejection. Security tries to get access the user should not have. Boundary tests the edges of ranges (black box BVA). White box tests are designed from the code to cover every branch. The number in each circle is how many cases of that type.');
}

// ---- 3. Results summary chart
{
  const s = pres.addSlide({ masterName: 'Title Only', sectionTitle: 'Overview' });
  s.addText('Every test type passed in full', { placeholder: 'title' });
  const names = Object.keys(TYPES);
  s.addChart(pres.charts.BAR, [
    { name: 'Passed', labels: names, values: names.map((t) => byType(t).length) },
    { name: 'Failed', labels: names, values: names.map(() => 0) },
  ], {
    x: 0.6, y: 1.4, w: 7.6, h: 5.3, barDir: 'bar', barGrouping: 'stacked',
    chartColors: [HEX.accent1, HEX.accent6],
    showValue: true, dataLabelPosition: 'inEnd', dataLabelColor: 'FFFFFF', dataLabelFontSize: 14, dataLabelFontFace: '+mn-lt',
    catAxisLabelColor: HEX.dk2, catAxisLabelFontSize: 16, catAxisLabelFontFace: '+mn-lt', catAxisOrientation: 'maxMin',
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    showLegend: true, legendPos: 'b', legendFontSize: 14, legendFontFace: '+mn-lt',
    showTitle: true, title: 'Test cases by type (passed vs failed)', titleFontSize: 16, titleColor: HEX.dk2, titleFontFace: '+mn-lt',
  });
  const facts = [['55 / 55', 'cases passed'], ['0', 'failures'], ['100%', 'branch coverage of the borrow endpoint (white box)']];
  facts.forEach(([n, l], i) => {
    const y = 1.6 + i * 1.75;
    s.addText(n, { x: 8.7, y, w: 4.0, h: 0.8, fontSize: 40, bold: true, color: i === 1 ? HEX.accent2 : HEX.accent1, fontFace: THEME.headFontFace, isTextBox: true, margin: 0 });
    s.addText(l, { x: 8.7, y: y + 0.8, w: 4.0, h: 0.7, fontSize: 16, color: HEX.dk2, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addNotes('All 55 cases passed when run with npm run report on a fresh database. The white box cases reach every branch of the borrow handler.');
}

// ---- result tables
const headerCell = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: HEX.dk2 }, fontSize: 13 } });
function tableSlide(type, rows, part, parts) {
  pres.addSection && null;
  const s = pres.addSlide({ masterName: 'Title Only', sectionTitle: 'Results' });
  const suffix = parts > 1 ? ` (${part} of ${parts})` : '';
  s.addText([
    { text: `${type} testing`, options: { color: TYPES[type].color } },
    { text: ` · expected vs actual${suffix}`, options: { color: HEX.dk1, bold: false } },
  ], { placeholder: 'title' });
  s.addText(TYPES[type].def, { x: 0.6, y: 1.12, w: 12.1, h: 0.4, fontSize: 14, italic: true, color: '4B5563', isTextBox: true, margin: 0 });
  const body = rows.map((r, i) => {
    const fill = { color: i % 2 ? HEX.lt2 : 'FFFFFF' };
    return [
      { text: r[0], options: { bold: true, color: TYPES[type].color, fill } },
      { text: r[1], options: { fill } },
      { text: r[3], options: { fill } },
      { text: r[4], options: { fill } },
      { text: 'PASS', options: { bold: true, color: HEX.accent1, fill, align: 'center' } },
    ];
  });
  s.addTable([[headerCell('ID'), headerCell('Test scenario'), headerCell('Expected result'), headerCell('Actual result'), { text: 'Status', options: { bold: true, color: 'FFFFFF', fill: { color: HEX.dk2 }, fontSize: 13, align: 'center' } }], ...body], {
    x: 0.6, y: 1.65, w: 12.1, colW: [0.85, 3.2, 2.45, 4.6, 1.0],
    fontSize: 12, color: HEX.dk1, valign: 'middle', margin: [0.04, 0.08, 0.04, 0.08],
    border: { type: 'solid', pt: 0.5, color: 'D1D9E3' }, rowH: 0.5, autoPage: false, objectName: `table-${type}-${part}`,
  });
  return s;
}

pres.addSection({ title: 'Results' });
for (const type of Object.keys(TYPES)) {
  const rows = byType(type);
  const per = 9;
  const parts = Math.ceil(rows.length / per);
  const size = Math.ceil(rows.length / parts);
  for (let p = 0; p < parts; p++) {
    const s = tableSlide(type, rows.slice(p * size, (p + 1) * size), p + 1, parts);
    s.addNotes(`${type} cases. For each row, read the expected result, then the actual result returned by the running server. All rows passed.`);
  }
}

// ---- conclusion
pres.addSection({ title: 'Conclusion' });
{
  const s = pres.addSlide({ masterName: 'Title Dark', sectionTitle: 'Conclusion' });
  s.addText('Actual results matched expected in all 55 cases', { placeholder: 'title' });
  s.addText('Re-run any time: npm test · npm run report · QA Lab page (#/qa) → Run all', { placeholder: 'body' });
  s.addNotes('Wrap up: every case passed. The same 55 cases run in three places: the npm test runner, the report script, and live in the browser in the QA Lab, where they can be filtered by functional, black box and white box.');
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT, 'slides:', pres.slides.length);
})();
