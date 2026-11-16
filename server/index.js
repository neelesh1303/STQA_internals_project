import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.resolve('data', 'library.db');
if (DB_FILE !== ':memory:') fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const { app } = createApp({ dbFile: DB_FILE });
const server = app.listen(PORT, () => {
  console.log(`\n  Athenaeum Library running →  http://localhost:${PORT}`);
  console.log(`  Database: ${DB_FILE}`);
  console.log('  Demo logins: librarian/Library@123 · student_demo/Student@123 · staff_demo/Staff@123 · author_demo/Author@123\n');
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use — the app is probably already running at http://localhost:${PORT}`);
    console.error('  Stop the other server (Ctrl+C in its terminal), or use another port:  $env:PORT=3001; npm start\n');
    process.exit(1);
  }
  throw err;
});
