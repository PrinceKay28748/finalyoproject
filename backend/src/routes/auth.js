// src/routes/auth.js
// Authentication endpoints - register, login, refresh, logout
// ZERO-TRUST: All input validated server-side, all queries parameterized
// SQLite version - uses ? placeholders instead of $1, $2

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../services/emailService.js';
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
            'SELECT id FROM users WHERE email = ? OR username = ?',
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
       VALUES (?, ?, ?)`,
            [email, username, passwordHash]
        );

        const userId = result.lastID;

        // Create default preferences (parameterized query)
        await query(
            `INSERT INTO user_preferences (user_id)
       VALUES (?)`,
            [userId]
        );

        // Create tokens
        const accessToken = createAccessToken(userId, email);
        const refreshToken = createRefreshToken(userId, email);

        // Hash refresh token before storing (never store tokens plaintext)
        const refreshTokenHash = await bcrypt.hash(refreshToken, 5);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Store refresh token (parameterized query)
        await query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
            [userId, refreshTokenHash, expiresAt.toISOString()]
        );

        await logAudit(query, userId, 'REGISTER_SUCCESS', ip, userAgent, true);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: userId,
                email: email,
                username: username,
                is_admin: 0  // ← New users are not admins by default
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
        // Include is_admin field in the query
        const result = await query(
            'SELECT id, email, username, password_hash, is_admin FROM users WHERE email = ? AND deleted_at IS NULL',
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
       VALUES (?, ?, ?)`,
            [user.id, refreshTokenHash, expiresAt.toISOString()]
        );

        await logAudit(query, user.id, 'LOGIN_SUCCESS', ip, userAgent, true);

        res.json({
            message: 'Logged in successfully',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                is_admin: user.is_admin || 0  // ← Include is_admin in response
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
       WHERE user_id = ? AND expires_at > datetime('now') AND revoked_at IS NULL`,
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
            `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND revoked_at IS NULL`,
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
            `SELECT u.id, u.email, u.username, u.created_at, u.is_admin,
              p.active_profile, p.dark_mode, p.notifications_enabled
       FROM users u
       LEFT JOIN user_preferences p ON u.id = p.user_id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
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
       SET active_profile = COALESCE(?, active_profile),
           dark_mode = COALESCE(?, dark_mode),
           notifications_enabled = COALESCE(?, notifications_enabled),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
            [activeProfile || null, darkMode !== undefined ? darkMode : null, notificationsEnabled !== undefined ? notificationsEnabled : null, userId]
        );

        // Fetch updated preferences
        const prefs = await query(
            'SELECT * FROM user_preferences WHERE user_id = ?',
            [userId]
        );

        res.json({
            message: 'Preferences updated',
            preferences: prefs.rows[0]
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
            `UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [userId]
        );

        // Revoke all tokens
        await query(
            `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
            [userId]
        );

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('[Auth Delete]', error.message);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// ============================================
// FORGOT PASSWORD ROUTES
// ============================================

/**
 * POST /auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req, res) => {
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Find user by email
        const userResult = await query(
            'SELECT id, email, username, is_admin FROM users WHERE email = ? AND deleted_at IS NULL',
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            await logAudit(query, null, 'FORGOT_PASSWORD_EMAIL_NOT_FOUND', ip, userAgent, false, 'Email not found');
            return res.status(404).json({ error: 'No account found with this email address' });
        }

        const user = userResult.rows[0];

        // Rate limit: max 3 reset requests per hour per user
        // Admins bypass rate limiting
        if (user.is_admin !== 1) {
            const rateCheck = await query(
                `SELECT COUNT(*) as count FROM password_resets 
         WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`,
                [user.id]
            );

            if (rateCheck.rows[0].count >= 3) {
                return res.status(429).json({ error: 'Too many requests. Please try again later.' });
            }
        }

        // Generate reset token
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Store token in database
        await query(
            `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
            [user.id, tokenHash, expiresAt.toISOString()]
        );

        // Send email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const emailResult = await sendPasswordResetEmail(email, token, frontendUrl);

        if (!emailResult.success) {
            console.error('[ForgotPassword] Email failed:', emailResult.error);
            return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
        }

        await logAudit(query, user.id, 'FORGOT_PASSWORD_EMAIL_SENT', ip, userAgent, true);

        res.json({
            message: 'Password reset email sent. Check your inbox.',
            email: email
        });

    } catch (error) {
        console.error('[ForgotPassword] Error:', error.message);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

/**
 * POST /auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req, res) => {
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        // Validate password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Hash token for lookup
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find valid reset request
        const resetResult = await query(
            `SELECT pr.user_id, pr.token_hash, pr.expires_at, pr.used_at, u.email, u.username
       FROM password_resets pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.token_hash = ? AND pr.used_at IS NULL`,
            [tokenHash]
        );

        if (resetResult.rows.length === 0) {
            await logAudit(query, null, 'RESET_PASSWORD_INVALID_TOKEN', ip, userAgent, false, 'Token not found');
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }

        const reset = resetResult.rows[0];

        // Check if token expired
        if (new Date(reset.expires_at) < new Date()) {
            await logAudit(query, reset.user_id, 'RESET_PASSWORD_TOKEN_EXPIRED', ip, userAgent, false, 'Token expired');
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

        // Update user password
        await query(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, reset.user_id]
        );

        // Mark token as used
        await query(
            'UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ?',
            [tokenHash]
        );

        // Revoke all refresh tokens for security
        await query(
            'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
            [reset.user_id]
        );

        await logAudit(query, reset.user_id, 'RESET_PASSWORD_SUCCESS', ip, userAgent, true);

        res.json({
            message: 'Password reset successfully. You can now log in with your new password.'
        });

    } catch (error) {
        console.error('[ResetPassword] Error:', error.message);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

export default router;