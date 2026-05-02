// backend/src/routes/auth.js
// Supabase Auth - Backend only verifies tokens and syncs users

import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { query } from '../config/db.js';

const router = express.Router();

// ─── Get Profile (from your users table using Supabase UUID) ────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const result = await query(
      `SELECT u.id, u.email, u.username, u.created_at, u.is_admin,
              p.active_profile, p.dark_mode, p.notifications_enabled
       FROM users u
       LEFT JOIN user_preferences p ON u.id = p.user_id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('[Auth Me]', error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── Update Preferences ──────────────────────────────────────────────────────
router.patch('/preferences', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { activeProfile, darkMode, notificationsEnabled } = req.body;

    await query(
      `UPDATE user_preferences 
       SET active_profile = COALESCE(?, active_profile),
           dark_mode = COALESCE(?, dark_mode),
           notifications_enabled = COALESCE(?, notifications_enabled),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [activeProfile || null, darkMode !== undefined ? darkMode : null, 
       notificationsEnabled !== undefined ? notificationsEnabled : null, userId]
    );

    const prefs = await query(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [userId]
    );

    res.json({ message: 'Preferences updated', preferences: prefs.rows[0] });
  } catch (error) {
    console.error('[Auth Preferences]', error.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ─── Delete Account (soft delete in your users table) ───────────────────────
router.delete('/me', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;

    await query(
      `UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId]
    );

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('[Auth Delete]', error.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ─── Sync user from Supabase to your users table ────────────────────────────
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const { userId, email } = req.user;
    const { username } = req.body;

    // Check if user exists in your users table
    const existing = await query(
      'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );

    if (existing.rows.length === 0) {
      // Create user in your table
      await query(
        `INSERT INTO users (id, email, username, is_admin)
         VALUES (?, ?, ?, ?)`,
        [userId, email, username || email.split('@')[0], 0]
      );

      // Create default preferences
      await query(
        `INSERT INTO user_preferences (user_id) VALUES (?)`,
        [userId]
      );
    }

    // Get the user
    const userResult = await query(
      'SELECT id, email, username, is_admin, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('[Auth Sync]', error.message);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

export default router;