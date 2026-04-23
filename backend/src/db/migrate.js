// src/db/migrate.js
// SQLite Database migration script - creates schema on startup

import { query, closePool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  try {
    console.log('[Migration] Starting database migrations...');
    
    // Wait a moment for DB connection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Read schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements
    const allSplitStatements = schema.split(';');
    
    const rawStatements = allSplitStatements
      .map(stmt => {
        // Remove SQL comments (lines starting with --)
        const lines = stmt.split('\n');
        const cleanedLines = lines
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
        return cleanedLines;
      })
      .filter(stmt => stmt.length > 0);
    
    console.log(`[Migration] Found ${rawStatements.length} statements to execute`);
    
    for (let i = 0; i < rawStatements.length; i++) {
      const statement = rawStatements[i];
      
      // Skip PRAGMA statements
      if (statement.toUpperCase().startsWith('PRAGMA')) {
        console.log(`[Migration] Skipping PRAGMA statement`);
        continue;
      }
      
      try {
        console.log(`[Migration] Executing statement ${i + 1}/${rawStatements.length}...`);
        await query(statement);
        console.log(`[Migration] ✓ Statement ${i + 1} executed`);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message?.includes('already exists')) {
          console.log(`[Migration] ℹ Table already exists, skipping`);
        } else {
          throw err;
        }
      }
    }
    
    console.log('[Migration] ✓ Database schema created successfully');
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ✗ Migration failed:', error.message);
    console.error('[Migration] Error details:', error);
    await closePool();
    process.exit(1);
  }
}

// Run migrations
runMigrations();
