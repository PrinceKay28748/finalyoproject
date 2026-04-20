// src/db/migrate.js
// Database migration script - creates schema on startup

import { query, closePool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  try {
    console.log('[Migration] Starting database migrations...');
    
    // Read schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements and execute
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement.trim());
      }
    }
    
    console.log('[Migration] ✓ Database schema created successfully');
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ✗ Migration failed:', error.message);
    await closePool();
    process.exit(1);
  }
}

// Run migrations
runMigrations();
