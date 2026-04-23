// backend/src/config/db.js
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // ============================================
  // PRODUCTION: PostgreSQL (Supabase on Render)
  // ============================================
  import pkg from 'pg';
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
  });
  
  console.log('✅ Connected to Supabase PostgreSQL (Production)');
  
  function convertPlaceholders(sql, params) {
    if (!params || params.length === 0) return sql;
    let result = sql;
    for (let i = 1; i <= params.length; i++) {
      result = result.replace('?', `$${i}`);
    }
    return result;
  }
  
  export const query = async (sql, params = []) => {
    try {
      const convertedSql = convertPlaceholders(sql, params);
      const result = await pool.query(convertedSql, params);
      return { rows: result.rows };
    } catch (error) {
      console.error('[DB] Query error:', error.message);
      throw error;
    }
  };
  
  export const closePool = async () => {
    await pool.end();
  };
  
} else {
  // ============================================
  // DEVELOPMENT: SQLite (Local only)
  // ============================================
  // Dynamically import sqlite only in development
  const sqlite3 = await import('sqlite3');
  const { open } = await import('sqlite');
  const path = await import('path');
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
  
  export const query = async (sql, params = []) => {
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return { rows: await db.all(sql, params) };
      }
      const result = await db.run(sql, params);
      return { rows: [], lastID: result.lastID, changes: result.changes };
    } catch (error) {
      console.error('[DB] Query error:', error.message);
      throw error;
    }
  };
  
  export const closePool = async () => {
    if (db) await db.close();
  };
}