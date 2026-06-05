// backend/src/routes/auth.js
// Supabase Auth - Backend only verifies tokens and syncs users

import express from 'express';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// ─── Email-based rate limiting (in-memory) ─────────────────────────────────
const passwordResetRequests = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [email, data] of passwordResetRequests.entries()) {
    if (now > data.resetTime) {
      passwordResetRequests.delete(email);
    }
  }
}, 60 * 60 * 1000);

function isEmailRateLimited(email) {
  const now = Date.now();
  const record = passwordResetRequests.get(email);
  
  if (!record) return false;
  if (now > record.resetTime) {
    passwordResetRequests.delete(email);
    return false;
  }
  return record.count >= 3;
}

function updateEmailRateLimit(email) {
  const now = Date.now();
  const record = passwordResetRequests.get(email);
  
  if (!record) {
    passwordResetRequests.set(email, {
      count: 1,
      resetTime: now + 60 * 60 * 1000
    });
  } else {
    record.count++;
  }
}

// ─── Helper: Create or refresh token (idempotent) ──────────────────────────
async function getOrCreateResetToken(email) {
  // Check for existing active token
  const existing = await query(
    `SELECT id, token_hash, expires_at 
     FROM password_resets 
     WHERE email = ? 
       AND used_at IS NULL 
       AND expires_at > NOW()
     LIMIT 1`,
    [email.toLowerCase()]
  );
  
  if (existing.rows.length > 0) {
    // Refresh expiry (extend by 1 hour)
    const tokenHash = existing.rows[0].token_hash;
    await query(
      `UPDATE password_resets 
       SET expires_at = NOW() + INTERVAL '1 hour',
           updated_at = NOW()
       WHERE id = ?`,
      [existing.rows[0].id]
    );
    return tokenHash;
  }
  
  // Create new token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  
  await query(
    `INSERT INTO password_resets (email, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, NOW())`,
    [email.toLowerCase(), tokenHash, expiresAt.toISOString()]
  );
  
  return token;
}

// ─── Forgot Password (with layered rate limiting) ──────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const ip = req.ip || req.socket.remoteAddress;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  if (isEmailRateLimited(email.toLowerCase())) {
    console.warn(`[RateLimit] Password reset rate limit exceeded for email: ${email}, IP: ${ip}`);
    return res.json({
      message: 'If an account exists with that email, you will receive a password reset link.'
    });
  }
  
  try {
    // Get or create token (idempotent)
    const tokenHash = await getOrCreateResetToken(email);
    
    // Update rate limit
    updateEmailRateLimit(email.toLowerCase());
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Send email via Supabase with the token
    const resetLink = `${process.env.FRONTEND_URL || 'https://ugnavigator.onrender.com'}/reset-password?token=${tokenHash}`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetLink,
    });
    
    if (error) {
      console.error('[ForgotPassword] Supabase error:', error.message);
    }
    
    res.json({
      message: 'If an account exists with that email, you will receive a password reset link.'
    });
    
  } catch (error) {
    console.error('[ForgotPassword] Error:', error.message);
    res.json({
      message: 'If an account exists with that email, you will receive a password reset link.'
    });
  }
});

// ─── Update Username ───────────────────────────────────────────────────────
router.patch('/update-username', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { username } = req.body;

    if (!username || username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be 3-50 characters' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    // Check if username is already taken
    const existing = await query(
      'SELECT id FROM users WHERE username = ? AND id != ? AND deleted_at IS NULL',
      [username, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    await query(
      'UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [username, userId]
    );

    res.json({ message: 'Username updated successfully', username });
  } catch (error) {
    console.error('[Update Username] Error:', error.message);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// ─── Resend Password Reset Email (idempotent) ──────────────────────────────
router.post('/resend', async (req, res) => {
  const { email } = req.body;
  const ip = req.ip || req.socket.remoteAddress;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  // Check rate limit (same as forgot-password)
  if (isEmailRateLimited(email.toLowerCase())) {
    console.warn(`[RateLimit] Resend rate limit exceeded for email: ${email}, IP: ${ip}`);
    return res.json({
      message: 'If an account exists with that email, you will receive a password reset link.'
    });
  }
  
  try {
    // Get existing token (don't create new if doesn't exist)
    const existing = await query(
      `SELECT token_hash, expires_at 
       FROM password_resets 
       WHERE email = ? 
         AND used_at IS NULL 
         AND expires_at > NOW()
       LIMIT 1`,
      [email.toLowerCase()]
    );
    
    let tokenHash;
    let isNewToken = false;
    
    if (existing.rows.length > 0) {
      // Refresh existing token
      tokenHash = existing.rows[0].token_hash;
      await query(
        `UPDATE password_resets 
         SET expires_at = NOW() + INTERVAL '1 hour',
             updated_at = NOW()
         WHERE email = ? AND used_at IS NULL`,
        [email.toLowerCase()]
      );
    } else {
      // Create new token
      const token = crypto.randomBytes(32).toString('hex');
      tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      await query(
        `INSERT INTO password_resets (email, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, NOW())`,
        [email.toLowerCase(), tokenHash, expiresAt.toISOString()]
      );
      isNewToken = true;
    }
    
    // Update rate limit
    updateEmailRateLimit(email.toLowerCase());
    
    // Send email via Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const resetLink = `${process.env.FRONTEND_URL || 'https://ugnavigator.onrender.com'}/reset-password?token=${tokenHash}`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetLink,
    });
    
    if (error) {
      console.error('[Resend] Supabase error:', error.message);
    }
    
    res.json({
      message: isNewToken 
        ? 'A new password reset link has been sent to your email.'
        : 'Your password reset link has been refreshed and resent.'
    });
    
  } catch (error) {
    console.error('[Resend] Error:', error.message);
    res.json({
      message: 'If an account exists with that email, you will receive a password reset link.'
    });
  }
});

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

    const existing = await query(
      'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );

    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO users (id, email, username, is_admin)
         VALUES (?, ?, ?, ?)`,
        [userId, email, username || email.split('@')[0], 0]
      );

      await query(
        `INSERT INTO user_preferences (user_id) VALUES (?)`,
        [userId]
      );
    }

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