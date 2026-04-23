// backend/src/config/db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
});

console.log('✅ Connected to Supabase PostgreSQL');

// Convert ? placeholders to $1, $2 for PostgreSQL
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
    console.error('[DB] SQL:', sql);
    throw error;
  }
};

export const closePool = async () => {
  await pool.end();
};