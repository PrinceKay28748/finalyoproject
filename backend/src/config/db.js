// backend/src/config/db.js
import dotenv from 'dotenv';
dotenv.config();

import { adaptSqlForSqlite } from '../db/sqliteCompat.js';

const isProduction = process.env.NODE_ENV === 'production';
let query, closePool, runDevMigrations;

if (isProduction) {
  // ── PostgreSQL (Supabase on Render) ────────────────────────────────────────
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
    family: 4, // force IPv4 — Render free tier blocks IPv6
  });

  console.log('✅ Connected to Supabase PostgreSQL (Production)');

  function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  query = async (sql, params = []) => {
    try {
      const convertedSql = convertPlaceholders(sql);
      const result = await pool.query(convertedSql, params);
      return { rows: result.rows };
    } catch (error) {
      console.error('[DB] Query error:', error.message);
      console.error('[DB] Original SQL:', sql);
      console.error('[DB] Converted SQL:', convertPlaceholders(sql));
      console.error('[DB] Params:', params);
      throw error;
    }
  };

  closePool = async () => {
    await pool.end();
  };

  runDevMigrations = async () => {};

} else {
  // ── SQLite (Development) ───────────────────────────────────────────────────
  const sqlite3 = await import('sqlite3');
  const { open } = await import('sqlite');
  const { default: path } = await import('path');
  const { fileURLToPath } = await import('url');
  const { default: fs } = await import('fs');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = path.dirname(__filename);
  const dbPath     = path.join(__dirname, '../../ug_campus_nav.db');

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  console.log(`[DB] Using SQLite at: ${dbPath}`);

  const db = await open({
    filename: dbPath,
    driver:   sqlite3.default.Database,
  });

  console.log('✅ Connected to SQLite (Development)');

  query = async (sql, params = []) => {
    const adaptedSql = adaptSqlForSqlite(sql);

    try {
      const trimmed = adaptedSql.trim().toUpperCase();
      const returnsRows =
        trimmed.startsWith('SELECT') ||
        trimmed.startsWith('WITH') ||
        /\bRETURNING\b/i.test(adaptedSql);

      if (returnsRows) {
        return { rows: await db.all(adaptedSql, params) };
      }

      const result = await db.run(adaptedSql, params);
      return { rows: [], lastID: result.lastID, changes: result.changes };
    } catch (error) {
      console.error('[DB] Query error:', error.message);
      console.error('[DB] SQL:', adaptedSql);
      throw error;
    }
  };

  closePool = async () => {
    if (db) await db.close();
  };

  runDevMigrations = async () => {
    const { runMigrations } = await import('../db/migrate.js');
    await runMigrations({ query, closePool });
  };
}

export { query, closePool, runDevMigrations, isProduction };
