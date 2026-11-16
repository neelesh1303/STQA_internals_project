// Automated execution of the 20 selected STQA cases against a fresh in-memory server.
// Run with:  npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { TEST_CASES, SECTIONS, runCase } from '../public/js/testcases.js';

let server;
let base;

before(async () => {
  const { app } = createApp({ dbFile: ':memory:' });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections?.();
  server.close();
});

for (const tc of TEST_CASES) {
  test(`${tc.id} [${SECTIONS[tc.section]}] ${tc.scenario}`, async (t) => {
    const result = await runCase(tc, base);
    t.diagnostic(`Actual: ${result.actual}`);
    assert.equal(result.status, 'PASS', result.actual);
  });
}
