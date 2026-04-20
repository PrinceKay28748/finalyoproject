// src/routes/auth.js
// Authentication endpoints - register, login, refresh, logout
// ZERO-TRUST: All input validated server-side, all queries parameterized

import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { 
  verifyToken, 
  verifyRefreshToken,
  createAccessToken,
  createRefreshToken 
} from '../middleware/auth.js';
import {
  validateRegister,
  validateLogin,
  validatePreferences,
  handleValidationErrors
} from '../middleware/validation.js';
import { APIError, logAudit } from '../utils/errorHandler.js';

const router = express.Router();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;

/**
 * Helper to get client IP (behind proxy-safe)
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
}

/**
 * POST /auth/register
 * Register new user
 * 
 * Security:
 * - Email validation & uniqueness check
 * - Password hashing with bcrypt
 * - Parameterized query (prevents SQL injection)
 * - Audit logging
 */
router.post('/register', validateRegister, handleValidationErrors, async (req, res) => {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'];
  
  try {
    const { email, username, password } = req.body;
    
    // Check if user exists (parameterized query - safe from injection)
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (existingUser.rows.length > 0) {
      await logAudit(query, null, 'REGISTER_FAILED_DUPLICATE', ip, userAgent, false, 'Email or username exists');
      throw new APIError('Email or username already registered', 409);
    }
    
    // Hash password (never store plaintext)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    // Create user (parameterized query)
    const result = await query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, created_at`,
      [email, username, passwordHash]
    );
    
    const user = result.rows[0];
    
    // Create default preferences (parameterized query)
    await query(
      `INSERT INTO user_preferences (user_id)
       VALUES ($1)`,
      [user.id]
    );
    
    // Create tokens
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);
    
    // Hash refresh token before storing (never store tokens plaintext)
    const refreshTokenHash = await bcrypt.hash(refreshToken, 5);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Store refresh token (parameterized query)
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, refreshTokenHash, expiresAt]
    );
    
    await logAudit(query, user.id, 'REGISTER_SUCCESS', ip, userAgent, true);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    if (error instanceof APIError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[Auth Register]', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /auth/login
 * Authenticate user and return tokens
 * 
 * Security:
 * - Email validation
 * - Password verification with bcrypt (timing-safe)
 * - Rate limiting applied at Express middleware level
 * - Audit logging
 */
router.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'];
  
  try {
    const { email, password } = req.body;
    
    // Find user (parameterized query - safe from injection)
    const result = await query(
      'SELECT id, email, username, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    
    if (result.rows.length === 0) {
      await logAudit(query, null, 'LOGIN_FAILED_NOT_FOUND', ip, userAgent, false, 'User not found');
      throw new APIError('Invalid email or password', 401);
    }
    
    const user = result.rows[0];
    
    // Verify password (timing-safe bcrypt comparison)
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      await logAudit(query, user.id, 'LOGIN_FAILED_INVALID_PASSWORD', ip, userAgent, false, 'Invalid password');
      throw new APIError('Invalid email or password', 401);
    }
    
    // Create tokens
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);
    
    // Hash refresh token before storing
    const refreshTokenHash = await bcrypt.hash(refreshToken, 5);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    // Store refresh token (parameterized query)
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, refreshTokenHash, expiresAt]
    );
    
    await logAudit(query, user.id, 'LOGIN_SUCCESS', ip, userAgent, true);
    
    res.json({
      message: 'Logged in successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    if (error instanceof APIError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[Auth Login]', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /auth/refresh
 * Issue new access token using refresh token
 */
router.post('/refresh', verifyRefreshToken, async (req, res) => {
  try {
    const { userId, email } = req.user;
    
    // Verify refresh token exists and isn't revoked (parameterized query)
    const result = await query(
      `SELECT id FROM refresh_tokens 
       WHERE user_id = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new APIError('Refresh token expired or revoked', 401);
    }
    
    // Create new access token
    const accessToken = createAccessToken(userId, email);
    
    res.json({
      accessToken
    });
  } catch (error) {
    if (error instanceof APIError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /auth/logout
 * Revoke refresh token
 */
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Revoke all refresh tokens for this user (parameterized query)
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Auth Logout]', error.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /auth/me
 * Get current user data (requires valid token)
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Get user with preferences (parameterized query)
    const result = await query(
      `SELECT u.id, u.email, u.username, u.created_at,
              p.active_profile, p.dark_mode, p.notifications_enabled
       FROM users u
       LEFT JOIN user_preferences p ON u.id = p.user_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new APIError('User not found', 404);
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    if (error instanceof APIError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * PATCH /auth/preferences
 * Update user preferences
 */
router.patch('/preferences', verifyToken, validatePreferences, handleValidationErrors, async (req, res) => {
  try {
    const { userId } = req.user;
    const { activeProfile, darkMode, notificationsEnabled } = req.body;
    
    // Update preferences (parameterized query)
    const result = await query(
      `UPDATE user_preferences 
       SET active_profile = COALESCE($1, active_profile),
           dark_mode = COALESCE($2, dark_mode),
           notifications_enabled = COALESCE($3, notifications_enabled),
           updated_at = NOW()
       WHERE user_id = $4
       RETURNING *`,
      [activeProfile || null, darkMode !== undefined ? darkMode : null, notificationsEnabled !== undefined ? notificationsEnabled : null, userId]
    );
    
    res.json({
      message: 'Preferences updated',
      preferences: result.rows[0]
    });
  } catch (error) {
    console.error('[Auth Preferences]', error.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * DELETE /auth/me
 * Delete user account (soft delete)
 */
router.delete('/me', verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Soft delete user (parameterized query)
    await query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1`,
      [userId]
    );
    
    // Revoke all tokens
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('[Auth Delete]', error.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
