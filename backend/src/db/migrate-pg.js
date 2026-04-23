// backend/src/db/migrate-pg.js
// PostgreSQL migration script for Supabase

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log('[Migration] Starting PostgreSQL migration...');
  
  try {
    // Read schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements
    const statements = schema
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .filter(stmt => !stmt.trim().startsWith('--'));
    
    console.log(`[Migration] Found ${statements.length} statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await pool.query(statement);
        console.log(`[Migration] ✓ Statement ${i + 1} executed`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`[Migration] ℹ Table already exists, skipping`);
        } else {
          throw err;
        }
      }
    }
    
    console.log('[Migration] ✅ Database schema created successfully');
    
    // Add is_admin column if missing
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'is_admin') THEN
          ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);
    
    console.log('[Migration] ✓ Ensured is_admin column exists');
    
  } catch (error) {
    console.error('[Migration] ❌ Failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();