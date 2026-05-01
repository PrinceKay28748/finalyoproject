// backend/src/config/db.js
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

let query, closePool;

if (isProduction) {
  // ============================================
  // PRODUCTION: PostgreSQL (Supabase on Render)
  // ============================================
  const { default: pkg } = await import('pg');
  const { Pool } = pkg;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in production');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    family: 4,
  });

  console.log('✅ Connected to Supabase PostgreSQL (Production)');

  // REMOVED the broken convertPlaceholders function
  // Your SQL already uses $1, $2 format - no conversion needed

  query = async (sql, params = []) => {
    try {
      // Directly use pool.query - no placeholder conversion needed
      const result = await pool.query(sql, params);
      return { rows: result.rows };
    } catch (error) {
      console.error('[DB] Query error:', error.message);
      console.error('[DB] SQL:', sql);
      console.error('[DB] Params:', params);
      throw error;
    }
  };

  closePool = async () => {
    await pool.end();
  };

} else {
  // ============================================
  // DEVELOPMENT: SQLite (Local only)
  // ============================================
  const sqlite3 = await import('sqlite3');
  const { open } = await import('sqlite');
  const { default: path } = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dbPath = path.join(__dirname, '../../ug_campus_nav.db');

  console.log(`[DB] Using SQLite at: ${dbPath}`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.default.Database,
  });

  console.log('✅ Connected to SQLite (Development)');

  // SQLite uses ? placeholders - keep conversion here
  function convertSqlitePlaceholders(sql, params) {
    if (!params || params.length === 0) return sql;
    let result = sql;
    for (let i = 0; i < params.length; i++) {
      result = result.replace('?', `$${i + 1}`);
    }
    return result;
  }

  query = async (sql, params = []) => {
    try {
      // SQLite needs ? placeholders, not $1
      // So keep original SQL with ? for SQLite
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return { rows: await db.all(sql, params) };
      }
      const result = await db.run(sql, params);
      return { rows: [], lastID: result.lastID, changes: result.changes };
    } catch (error) {
      console.error('[DB] Query error:', error.message);
      console.error('[DB] SQL:', sql);
      throw error;
    }
  };

  closePool = async () => {
    if (db) await db.close();
  };
}

export { query, closePool };