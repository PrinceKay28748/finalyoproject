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
import analyticsRoutes from './routes/analytics.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// ─── Nominatim Rate Limit Queue ─────────────────────────────────────────────
// Ensures we never send more than 1 request per second to Nominatim
const nominatimQueue = [];
let nominatimProcessing = false;
let lastNominatimRequest = 0;
const NOMINATIM_RATE_LIMIT_MS = 1000; // 1 request per second

// Cache for Nominatim responses (10 minute TTL)
const nominatimCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCacheKey(url) {
  return url;
}

function isCacheValid(cached) {
  return cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS;
}

async function processNominatimQueue() {
  if (nominatimProcessing || nominatimQueue.length === 0) return;
  
  nominatimProcessing = true;
  
  const now = Date.now();
  const timeSinceLast = now - lastNominatimRequest;
  const waitTime = Math.max(0, NOMINATIM_RATE_LIMIT_MS - timeSinceLast);
  
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  const { url, resolve, reject } = nominatimQueue.shift();
  
  // Check cache first
  const cacheKey = getCacheKey(url);
  const cached = nominatimCache.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    console.log('[Nominatim Proxy] Cache hit for:', url.substring(0, 100));
    lastNominatimRequest = Date.now();
    nominatimProcessing = false;
    resolve(cached.data);
    processNominatimQueue();
    return;
  }
  
  try {
    lastNominatimRequest = Date.now();
    console.log('[Nominatim Proxy] Requesting:', url.substring(0, 120));
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'UGNavigator/1.0 (https://ugnavigator.onrender.com)',
        'Accept': 'application/json',
        'Accept-Language': 'en',
        'Referer': 'https://ugnavigator.onrender.com'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store in cache
    nominatimCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (nominatimCache.size > 200) {
      const firstKey = nominatimCache.keys().next().value;
      nominatimCache.delete(firstKey);
    }
    
    resolve(data);
  } catch (err) {
    console.error('[Nominatim Proxy] Error:', err.message);
    reject(err);
  } finally {
    nominatimProcessing = false;
    processNominatimQueue();
  }
}

function queueNominatimRequest(url) {
  return new Promise((resolve, reject) => {
    nominatimQueue.push({ url, resolve, reject });
    processNominatimQueue();
  });
}

// ─── Helper to check if email belongs to admin ─────────────────────────────
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

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
    }
});

// ============================================
// NOMINATIM PROXY - With Rate Limit Queue
// ============================================
// Proxies /api/nominatim/search and /api/nominatim/reverse to Nominatim
// Queues requests to respect 1 request/second limit
app.get('/api/nominatim/:path(*)', async (req, res) => {
    try {
        const params = new URLSearchParams(req.query);
        
        // Force JSON format
        if (!params.has('format')) {
            params.set('format', 'json');
        }
        
        // Ensure we get address details
        if (req.params.path.includes('reverse') && !params.has('addressdetails')) {
            params.set('addressdetails', '1');
        }
        
        const url = `https://nominatim.openstreetmap.org/${req.params.path}?${params.toString()}`;
        
        const data = await queueNominatimRequest(url);
        
        if (data && data.error) {
            console.error('[Nominatim Proxy] Nominatim error:', data.error);
            return res.status(400).json({ error: data.error });
        }
        
        res.json(data);
    } catch (err) {
        console.error('[Nominatim Proxy] Error:', err.message);
        res.status(500).json({ error: 'Nominatim request failed', details: err.message });
    }
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/admin', adminRoutes);
app.use('/auth/login', loginLimiter);
app.use('/auth/register', generalLimiter);
app.use('/auth', authRoutes);
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
║    • GET    /api/nominatim/* - Nominatim proxy (rate limited) ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// ─── Keep-alive ping (prevents Render free tier cold starts) ────────────────
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

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });
});

export default app;