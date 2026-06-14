import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'ug_campus_nav.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('[DB Reset] Removed existing SQLite database');
}

console.log('[DB Reset] Recreating schema...');

const { query, closePool } = await import('../src/config/db.js');
const { runMigrations } = await import('../src/db/migrate.js');

await runMigrations({ query, closePool });
await closePool();
console.log('[DB Reset] Done');
