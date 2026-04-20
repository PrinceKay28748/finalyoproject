// src/config/db.js
// PostgreSQL connection pool with proper configuration
// Uses parameterized queries to prevent SQL injection

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

/**
 * PostgreSQL connection pool
 * - Reuses connections efficiently
 * - Prevents SQL injection via parameterized queries
 * - Handles connection errors gracefully
 */
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ug_campus_nav',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
});

/**
 * Execute query with parameterized statements (prevents SQL injection)
 * ALWAYS use this for any user input
 * 
 * @param {string} query - SQL query with $1, $2 placeholders
 * @param {Array} params - Values to substitute (safe from injection)
 * @returns {Promise} Query result
 * 
 * @example
 * // SAFE - uses parameterized query
 * const result = await query(
 *   'SELECT * FROM users WHERE email = $1',
 *   ['user@example.com']
 * );
 * 
 * // UNSAFE - DON'T DO THIS
 * const result = await query(
 *   `SELECT * FROM users WHERE email = '${userInput}'`
 * );
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[DB] Executed query in ${duration}ms`);
    return result;
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    throw error;
  }
}

/**
 * Get client for transactions
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Close the pool
 */
export async function closePool() {
  await pool.end();
}

export default pool;
