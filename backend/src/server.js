// src/server.js
// Main Express server - UG Campus Navigation Backend
// Zero-Trust Authentication & User Management

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { query } from './config/db.js';
import { sanitizeParams } from './middleware/validation.js';
import { handleError } from './utils/errorHandler.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security Middleware ────────────────────────────────────────────────────
// These run on EVERY request

// 1. Helmet - sets secure HTTP headers
app.use(helmet());

// 2. CORS - whitelist only your frontend domain
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Rate Limiting - prevent brute force attacks
//    These limits apply per IP
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 5. Parameter sanitization (prevent NoSQL injection in logs)
app.use(sanitizeParams);

// ─── Request Logging ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    // Test database connection
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

// Apply rate limiting to auth endpoints
app.use('/auth/login', loginLimiter);
app.use('/auth/register', generalLimiter);

// Mount auth routes
app.use('/auth', authRoutes);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Error Handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  handleError(err, req, res);
});

// ─── Server Startup ─────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║    UG Campus Navigation API                               ║
║    🔐 Zero-Trust Authentication Backend                    ║
║    Server running on http://localhost:${PORT}               ║
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
