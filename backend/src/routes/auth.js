// backend/src/routes/auth.js
import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Validates if a token exists and is structurally a valid JWT.
 * Prevents common "junk" strings from being sent to the backend.
 * 
 * @param {string|null} token 
 * @returns {boolean}
 */
export const isTokenValid = (token) => {
  if (!token || typeof token !== 'string') return false;
  const junkValues = ['undefined', 'null', '[object Object]'];
  if (junkValues.includes(token)) return false;
  // Support development mock tokens or standard 3-part JWTs
  return token === 'mock-token' || token.split('.').length === 3;
};

// POST /auth/sync - Syncs Supabase Auth user with local database
router.post('/sync', async (req, res) => {
  try {
    const { user: supabaseUser } = req.body;
    
    if (!supabaseUser || !supabaseUser.id) {
      return res.status(400).json({ error: 'Invalid user data provided for sync' });
    }

    const username = supabaseUser.user_metadata?.username || supabaseUser.email.split('@')[0];

    // Perform an UPSERT to ensure the user exists in our local metadata table
    const result = await query(
      `INSERT INTO users (id, email, username, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         username = excluded.username,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, email, username, is_admin, created_at`,
      [supabaseUser.id, supabaseUser.email, username]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Auth Sync] Critical error:', error);
    res.status(500).json({ error: 'Failed to synchronize user session' });
  }
});

// GET /auth/me - Fetches the current authenticated user's profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await query(
      'SELECT id, email, username, is_admin, created_at FROM users WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Auth Me] Fetch error:', error);
    res.status(500).json({ error: 'Internal server error fetching profile' });
  }
});

export default router;