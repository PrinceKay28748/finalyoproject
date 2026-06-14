// SQLite database migration — local development only.
// Production uses migrate-pg.js against Supabase (DATABASE_URL required).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseSchemaStatements(schema) {
  return schema
    .split(';')
    .map((stmt) => {
      const lines = stmt.split('\n');
      return lines
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
    })
    .filter((stmt) => stmt.length > 0);
}

export async function runMigrations({ query, closePool, exitOnComplete = false } = {}) {
  let ownsConnection = false;

  try {
    if (!query) {
      ownsConnection = true;
      const dbModule = await import('../config/db.js');
      query = dbModule.query;
      closePool = dbModule.closePool;
    }

    console.log('[Migration] Starting SQLite migrations...');
    await new Promise((resolve) => setTimeout(resolve, 200));

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = parseSchemaStatements(schema);

    console.log(`[Migration] Found ${statements.length} statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.toUpperCase().startsWith('PRAGMA')) {
        continue;
      }

      try {
        await query(statement);
        console.log(`[Migration] ✓ Statement ${i + 1}/${statements.length}`);
      } catch (err) {
        if (err.message?.includes('already exists')) {
          console.log(`[Migration] ℹ Already exists, skipping statement ${i + 1}`);
        } else {
          throw err;
        }
      }
    }

    console.log('[Migration] ✓ SQLite schema ready');
    return true;
  } catch (error) {
    console.error('[Migration] ✗ Migration failed:', error.message);
    throw error;
  } finally {
    if (exitOnComplete && ownsConnection && closePool) {
      await closePool();
      process.exit(0);
    }
  }
}

const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  runMigrations({ exitOnComplete: true }).catch(async (error) => {
    console.error('[Migration] Error details:', error);
    process.exit(1);
  });
}
