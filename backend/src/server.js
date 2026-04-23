// src/server.js
// Main Express server - UG Campus Navigation Backend
// Zero-Trust Authentication & User Management


// Load environment variables and log email config for debugging
import 'dotenv/config';
console.log('[DEBUG] EMAIL_USER:', process.env.EMAIL_USER);
console.log('[DEBUG] EMAIL_PASS:', process.env.EMAIL_PASS ? '***LOADED***' : 'MISSING');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { query } from './config/db.js';
import { sanitizeParams } from './middleware/validation.js';
import { handleError } from './utils/errorHandler.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Helper to check if email belongs to admin ─────────────────────────────
// This allows admins to bypass rate limiting on login
const isAdminEmail = async (email) => {
    if (!email) return false;
    try {
        const result = await query(
            'SELECT is_admin FROM users WHERE email = ? AND deleted_at IS NULL',
            [email.toLowerCase()]
        );
        return result.rows.length > 0 && result.rows[0].is_admin === 1;
    } catch (err) {
        console.error('[RateLimit] Error checking admin status:', err.message);
        return false;
    }
};

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting with admin bypass
const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: async (req) => {
        // Check if the email in the request belongs to an admin
        const email = req.body?.email;
        if (email) {
            const isAdmin = await isAdminEmail(email);
            if (isAdmin) {
                console.log('[RateLimit] Bypassing rate limit for admin email:', email);
                return true; // Skip rate limiting
            }
        }
        return false;
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many login attempts, please try again later'
        });
    }
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later'
        });
    }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Parameter sanitization
app.use(sanitizeParams);

// Request Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({
            status: 'unhealthy',
            error: 'Database connection failed'
        });
    }
});

// ─── Routes ─────────────────────────────────────────────────────────────────

// Mount admin routes FIRST (before auth routes, before 404 handler)
app.use('/admin', adminRoutes);

// Apply rate limiting to auth endpoints
app.use('/auth/login', loginLimiter);
app.use('/auth/register', generalLimiter);

// Mount auth routes
app.use('/auth', authRoutes);

// Mount analytics routes
app.use('/analytics', analyticsRoutes);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Error Handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    handleError(err, req, res);
});

// ─── Server Startup ─────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║    UG Campus Navigation API                               ║
║    🔐 Zero-Trust Authentication Backend                    ║
║    Server running on 0.0.0.0:${PORT} (all interfaces)        ║
║                                                            ║
║    Endpoints:                                              ║
║    • POST   /auth/register   - Create account              ║
║    • POST   /auth/login      - Login                       ║
║    • POST   /auth/refresh    - Refresh token               ║
║    • POST   /auth/logout     - Logout                      ║
║    • GET    /auth/me         - Get profile                 ║
║    • PATCH  /auth/preferences - Update preferences        ║
║    • DELETE /auth/me         - Delete account              ║
║    • GET    /health          - Health check                ║
║    • GET    /admin/*         - Admin dashboard            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });
});

export default app;