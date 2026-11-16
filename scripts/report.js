// Executes the 20 cases on a fresh in-memory server and writes a filled-in test report
// (Markdown + CSV) to ./reports — ready to paste into the STQA lab record.
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { TEST_CASES, SECTIONS, runCase } from '../public/js/testcases.js';

const { app } = createApp({ dbFile: ':memory:' });
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

const rows = [];
for (const tc of TEST_CASES) {
  const r = await runCase(tc, base);
  rows.push({ ...tc, ...r });
  console.log(`${r.status === 'PASS' ? '✔' : '✘'} ${tc.id} ${tc.scenario}`);
}
server.closeAllConnections?.();
server.close();

const passed = rows.filter((r) => r.status === 'PASS').length;
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
const md = [
  '# STQA Execution Report — Athenaeum Library Management System',
  '',
  `Executed: ${stamp} UTC · Environment: Node ${process.version}, fresh in-memory SQLite · Result: **${passed}/${rows.length} passed**`,
  '',
  '| TC ID | Section | Test Scenario | Test Data | Expected Result | Actual Result | Status |',
  '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.section}. ${SECTIONS[r.section]} | ${r.scenario} | ${r.data.replace(/\|/g, '\\|')} | ${r.expected} | ${r.actual.replace(/\|/g, '\\|')} | **${r.status}** |`),
  '',
].join('\n');

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = [
  ['TC ID', 'Section', 'Test Scenario', 'Test Data', 'Expected Result', 'Actual Result', 'Status', 'Duration (ms)'].map(csvCell).join(','),
  ...rows.map((r) => [r.id, `${r.section}. ${SECTIONS[r.section]}`, r.scenario, r.data, r.expected, r.actual, r.status, r.ms].map(csvCell).join(',')),
].join('\n');

fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(path.join('reports', 'STQA_Execution_Report.md'), md);
fs.writeFileSync(path.join('reports', 'STQA_Execution_Report.csv'), '﻿' + csv);
console.log(`\n${passed}/${rows.length} passed → reports/STQA_Execution_Report.md, reports/STQA_Execution_Report.csv`);
process.exit(passed === rows.length ? 0 : 1);
