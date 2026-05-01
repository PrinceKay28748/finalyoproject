// src/server.js
import 'dotenv/config';
console.log('[DEBUG] EMAIL_USER:', process.env.EMAIL_USER);
console.log('[DEBUG] EMAIL_PASS:', process.env.EMAIL_PASS ? '***LOADED***' : 'MISSING');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { query } from './config/db.js';
import { sanitizeParams } from './middleware/validation.js';
import { handleError } from './utils/errorHandler.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import analyticsRoutes, { heatmapRouter } from './routes/analytics.js';
import reportsRoutes from './routes/reports.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// ─── LocationIQ Rate Limit Queue (3 requests per second) ────────────────────
let lastLocationIQRequest = 0;
const locationIQQueue = [];
let processingLocationIQ = false;

async function processLocationIQQueue() {
  if (processingLocationIQ || locationIQQueue.length === 0) return;

  processingLocationIQ = true;

  const now = Date.now();
  const timeSinceLast = now - lastLocationIQRequest;
  if (timeSinceLast < 334) {
    const waitTime = 334 - timeSinceLast;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  const { url, res } = locationIQQueue.shift();

  try {
    lastLocationIQRequest = Date.now();
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      res.status(400).json({ error: data.error });
    } else {
      res.json(data);
    }
  } catch (err) {
    console.error('[LocationIQ] Error:', err.message);
    res.status(500).json({ error: 'Geocoding failed' });
  } finally {
    processingLocationIQ = false;
    processLocationIQQueue();
  }
}

// ─── Helper to check if email belongs to admin ──────────────────────────────
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

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://ugnavigator.onrender.com',
    process.env.CORS_ORIGIN,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: async (req) => {
    const email = req.body?.email;
    if (email) {
      const isAdmin = await isAdminEmail(email);
      if (isAdmin) {
        console.log('[RateLimit] Bypassing rate limit for admin email:', email);
        return true;
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(sanitizeParams);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// ============================================
// LOCATIONIQ PROXY
// ============================================

// UG main gate — used to bias search results toward campus area
const UG_LAT = 5.6502;
const UG_LON = -0.1869;
// Soft bounding box ~12 km around UG (lon_min,lat_min,lon_max,lat_max)
const UG_VIEWBOX = `-0.2969,5.5402,0.0231,5.7602`;

app.get('/api/locationiq/search', (req, res) => {
  const searchQuery = req.query.q;
  if (!searchQuery) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const url =
    `https://us1.locationiq.com/v1/search.php` +
    `?q=${encodeURIComponent(searchQuery)}` +
    `&format=json` +
    `&limit=10` +           // fetch more — geocoding.js radius-filters down to 5
    `&countrycodes=gh` +
    `&addressdetails=1` +   // returns address.suburb, address.neighbourhood, etc.
    `&viewbox=${UG_VIEWBOX}` + // biases results toward UG campus area
    `&bounded=0` +          // soft bias, not hard clip — avoids zero-result edge cases
    `&key=${process.env.LOCATIONIQ_API_KEY}`;

  locationIQQueue.push({ url, res });
  processLocationIQQueue();
});

app.get('/api/locationiq/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing lat or lon' });
  }

  try {
    const url = `https://us1.locationiq.com/v1/reverse.php?lat=${lat}&lon=${lon}&format=json&key=${process.env.LOCATIONIQ_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[LocationIQ Reverse] Error:', err.message);
    res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

// ============================================
// REPORTS ROUTES
// ============================================
app.use('/api/reports', reportsRoutes);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/admin', adminRoutes);
app.use('/auth/login', loginLimiter);
app.use('/auth/register', generalLimiter);
app.use('/auth', authRoutes);
app.use('/analytics/heatmap', heatmapRouter);
app.use('/analytics', analyticsRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  handleError(err, req, res);
});

// ─── Server Startup ───────────────────────────────────────────────────────────
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
║    • GET    /api/locationiq/* - LocationIQ proxy          ║
║    • POST   /api/reports     - Submit accessibility report ║
║    • GET    /api/reports     - List reports (admin)        ║
║    • PATCH  /api/reports/:id - Approve/reject report       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// ─── Keep-alive ping (prevents Render free tier cold starts) ─────────────────
if (process.env.NODE_ENV === 'production') {
  const PING_URL = process.env.RENDER_EXTERNAL_URL || 'https://api-ug-navigator.onrender.com';
  setInterval(async () => {
    try {
      await fetch(`${PING_URL}/health`);
      console.log('[Keep-alive] Pinged /health');
    } catch (err) {
      console.error('[Keep-alive] Ping failed:', err.message);
    }
  }, 10 * 60 * 1000);
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

export default app;