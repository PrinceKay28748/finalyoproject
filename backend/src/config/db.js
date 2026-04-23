// backend/src/config/db.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

// Import both drivers
import pkg from 'pg';
const { Pool } = pkg;
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;
let pool;

// Initialize appropriate database
async function initDatabase() {
  if (isProduction) {
    // ============================================
    // PRODUCTION: PostgreSQL (Supabase on Render)
    // ============================================
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.error('❌ DATABASE_URL is not defined in production');
      process.exit(1);
    }
    
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
    });
    
    console.log('✅ Connected to Supabase PostgreSQL (Production)');
    
  } else {
    // ============================================
    // DEVELOPMENT: SQLite (Local)
    // ============================================
    const dbPath = path.join(__dirname, '../../ug_campus_nav.db');
    console.log(`[DB] Using SQLite at: ${dbPath}`);
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    
    console.log('✅ Connected to SQLite (Development)');
    
    // Create tables if they don't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL
      );
      
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        active_profile TEXT DEFAULT 'standard',
        dark_mode INTEGER DEFAULT 0,
        notifications_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        revoked_at DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
      
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS route_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        start_location TEXT,
        end_location TEXT,
        profile_used TEXT,
        route_distance REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
      
      CREATE TABLE IF NOT EXISTS user_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        activity_type TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  }
}

// Helper to convert ? to $1, $2 for PostgreSQL
function convertPlaceholders(sql, params) {
  if (!isProduction) return sql;
  if (!params || params.length === 0) return sql;
  let result = sql;
  for (let i = 1; i <= params.length; i++) {
    result = result.replace('?', `$${i}`);
  }
  return result;
}

// Main query function
export const query = async (sql, params = []) => {
  try {
    if (isProduction) {
      const convertedSql = convertPlaceholders(sql, params);
      const result = await pool.query(convertedSql, params);
      return { rows: result.rows };
    } else {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return { rows: await db.all(sql, params) };
      }
      const result = await db.run(sql, params);
      return { rows: [], lastID: result.lastID, changes: result.changes };
    }
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    throw error;
  }
};

// Close pool function
export const closePool = async () => {
  if (isProduction && pool) {
    await pool.end();
  } else if (db) {
    await db.close();
  }
};

// Initialize database on module load
await initDatabase();