// backend/src/config/db.js - Simplified for production
// Replace your current db.js with this

import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

let query, closePool;

if (isProduction) {
  const { default: pkg } = await import('pg');
  const { Pool } = pkg;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
  });

  console.log('✅ Connected to Supabase PostgreSQL');

  query = async (sql, params = []) => {
    try {
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
  // SQLite for development
  const sqlite3 = await import('sqlite3');
  const { open } = await import('sqlite');
  const { default: path } = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dbPath = path.join(__dirname, '../../ug_campus_nav.db');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.default.Database,
  });

  console.log('✅ Connected to SQLite (Development)');

  query = async (sql, params = []) => {
    try {
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