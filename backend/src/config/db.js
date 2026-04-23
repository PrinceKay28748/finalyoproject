// src/config/db.js
// SQLite database configuration and query wrapper
// Uses parameterized queries to prevent SQL injection

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../ug_campus_nav.db');

// Create/open database
let dbReady = false;
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] Connection error:', err.message);
  } else {
    console.log('[DB] Connected to SQLite database at:', dbPath);
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.error('[DB] PRAGMA error:', err.message);
      } else {
        dbReady = true;
        console.log('[DB] Foreign keys enabled');
      }
    });
  }
});

/**
 * Execute query with parameterized statements (prevents SQL injection)
 * ALWAYS use this for any user input
 * 
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Values to substitute (safe from injection)
 * @returns {Promise} Query result with {rows}
 * 
 * @example
 * // SAFE - uses parameterized query
 * const result = await query(
 *   'SELECT * FROM users WHERE email = ?',
 *   ['user@example.com']
 * );
 * 
 * // UNSAFE - DON'T DO THIS
 * const result = await query(
 *   `SELECT * FROM users WHERE email = '${userInput}'`
 * );
 */
export async function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const trimmedSql = sql.trim().toUpperCase();
    
    if (trimmedSql.startsWith('SELECT')) {
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('[DB] Query error:', err.message);
          reject(err);
        } else {
          resolve({ rows: rows || [] });
        }
      });
    } else if (trimmedSql.startsWith('INSERT') || trimmedSql.startsWith('UPDATE') || trimmedSql.startsWith('DELETE')) {
      db.run(sql, params, function(err) {
        if (err) {
          console.error('[DB] Query error:', err.message);
          reject(err);
        } else {
          resolve({
            rows: [],
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    } else {
      // For DDL statements (CREATE TABLE, etc.)
      db.run(sql, params, (err) => {
        if (err) {
          console.error('[DB] Query error:', err.message);
          reject(err);
        } else {
          resolve({ rows: [] });
        }
      });
    }
  });
}

/**
 * Close database connection
 */
export async function closePool() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export default db;
