// backend/src/routes/analytics.js
import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// ─── Authenticated routes (existing) ────────────────────────────────────────
router.use(verifyToken);

/**
 * POST /analytics/log
 * Log user activity (search, login, route calculations)
 */
router.post('/log', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { activity_type, metadata } = req.body;

    if (!userId)        return res.status(401).json({ error: 'User ID required' });
    if (!activity_type) return res.status(400).json({ error: 'Activity type required' });

    await query(
      `INSERT INTO user_activity (user_id, activity_type, metadata, created_at)
       VALUES (?, ?, ?, NOW())`,
      [userId, activity_type, metadata || null]
    );

    console.log(`[Analytics] Logged ${activity_type} for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics] Error:', error.message);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

/**
 * POST /analytics/feedback
 * Log user feedback for a specific route profile
 */
router.post('/feedback', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { profile, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Valid rating required' });

    await query(
      `INSERT INTO route_feedback (user_id, profile_key, rating, comment, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId || null, profile || 'standard', rating, comment || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics Feedback] Error:', error.message);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

/**
 * POST /analytics/route
 * Log route calculation
 */
router.post('/route', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { start_location, end_location, profile_used, distance } = req.body;

    if (!userId) return res.status(401).json({ error: 'User ID required' });

    await query(
      `INSERT INTO route_logs (user_id, start_location, end_location, profile_used, route_distance, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, start_location || null, end_location || null, profile_used || null, distance || null]
    );

    console.log(`[Analytics] Route logged for user ${userId}: ${start_location} → ${end_location}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics Route] Error:', error.message);
    res.status(500).json({ error: 'Failed to log route' });
  }
});

// ─── Heatmap routes (no auth — we want data from all users) ─────────────────
// These are mounted on a fresh router so verifyToken doesn't apply.
export const heatmapRouter = express.Router();

// Simple in-memory rate limit — max 10 segment posts per IP per minute.
// Lightweight enough for a campus app without needing Redis.
const heatmapRateLimit = (() => {
  const hits = new Map(); // ip → { count, resetAt }
  const MAX  = 10;
  const TTL  = 60_000; // 1 minute

  return (req, res, next) => {
    const ip  = req.ip || 'unknown';
    const now = Date.now();
    const rec = hits.get(ip);

    if (!rec || now > rec.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + TTL });
      return next();
    }

    rec.count++;
    if (rec.count > MAX) {
      return res.status(429).json({ error: 'Too many heatmap requests' });
    }
    next();
  };
})();

/**
 * POST /analytics/heatmap
 * Log sampled route coordinates from a completed route calculation.
 * Body: { segments: [{lat, lng}], hour: 0–23, dayOfWeek: 0–6 }
 *
 * Uses upsert so we increment count instead of inserting duplicates.
 * Coordinates are pre-bucketed on the frontend to 5 decimal places.
 */
heatmapRouter.post('/', heatmapRateLimit, async (req, res) => {
  try {
    const { segments, hour, dayOfWeek } = req.body;

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({ error: 'segments array required' });
    }

    if (segments.length > 200) {
      return res.status(400).json({ error: 'Too many segments (max 200 per request)' });
    }

    const h   = Number(hour);
    const dow = Number(dayOfWeek);

    if (isNaN(h) || h < 0 || h > 23)     return res.status(400).json({ error: 'Invalid hour' });
    if (isNaN(dow) || dow < 0 || dow > 6) return res.status(400).json({ error: 'Invalid dayOfWeek' });

    // Batch upsert — increment count if the cell+time slot already exists.
    // PostgreSQL uses ON CONFLICT; SQLite uses INSERT OR REPLACE.
    // We detect the environment the same way db.js does.
    const isProduction = process.env.NODE_ENV === 'production';

    for (const seg of segments) {
      const lat = Number(seg.lat);
      const lng = Number(seg.lng);

      if (isNaN(lat) || isNaN(lng)) continue;
      // Sanity-check: must be within greater Accra area
      if (lat < 5.5 || lat > 5.8 || lng < -0.4 || lng > 0.1) continue;

      if (isProduction) {
        // PostgreSQL upsert
        await query(
          `INSERT INTO route_segments (lat_bucket, lng_bucket, hour_of_day, day_of_week, count, updated_at)
           VALUES (?, ?, ?, ?, 1, NOW())
           ON CONFLICT (lat_bucket, lng_bucket, hour_of_day, day_of_week)
           DO UPDATE SET count = route_segments.count + 1, updated_at = NOW()`,
          [lat, lng, h, dow]
        );
      } else {
        // SQLite upsert
        await query(
          `INSERT INTO route_segments (lat_bucket, lng_bucket, hour_of_day, day_of_week, count, updated_at)
           VALUES (?, ?, ?, ?, 1, datetime('now'))
           ON CONFLICT (lat_bucket, lng_bucket, hour_of_day, day_of_week)
           DO UPDATE SET count = route_segments.count + 1, updated_at = datetime('now')`,
          [lat, lng, h, dow]
        );
      }
    }

    res.json({ success: true, logged: segments.length });
  } catch (error) {
    console.error('[Heatmap POST] Error:', error.message);
    res.status(500).json({ error: 'Failed to log segments' });
  }
});

/**
 * POST /analytics/heatmap/search
 * Log a search destination with coordinates.
 * No auth required — we want data from all users (including unauthenticated searchers).
 * Body: { query, destination_name, lat, lng }
 */
heatmapRouter.post('/search', heatmapRateLimit, async (req, res) => {
  try {
    const { query, destination_name, lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const latitude  = Number(lat);
    const longitude = Number(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Sanity-check: must be within greater Accra area
    if (latitude < 5.5 || latitude > 5.8 || longitude < -0.4 || longitude > 0.1) {
      return res.status(400).json({ error: 'Coordinates outside service area' });
    }

    // Bucket to same precision as route segments (5 decimal places)
    const BUCKET_PRECISION = 5;
    const lat_bucket = parseFloat(latitude.toFixed(BUCKET_PRECISION));
    const lng_bucket = parseFloat(longitude.toFixed(BUCKET_PRECISION));

    const now       = new Date();
    const hour      = now.getHours();
    const dayOfWeek = now.getDay();

    // Upsert into search_destinations table
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // PostgreSQL upsert
      await query(
        `INSERT INTO search_destinations (destination_name, lat_bucket, lng_bucket, hour_of_day, day_of_week, count, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())
         ON CONFLICT (lat_bucket, lng_bucket, hour_of_day, day_of_week)
         DO UPDATE SET count = search_destinations.count + 1, updated_at = NOW()`,
        [destination_name || null, lat_bucket, lng_bucket, hour, dayOfWeek]
      );
    } else {
      // SQLite upsert
      await query(
        `INSERT INTO search_destinations (destination_name, lat_bucket, lng_bucket, hour_of_day, day_of_week, count, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
         ON CONFLICT (lat_bucket, lng_bucket, hour_of_day, day_of_week)
         DO UPDATE SET count = search_destinations.count + 1, updated_at = datetime('now')`,
        [destination_name || null, lat_bucket, lng_bucket, hour, dayOfWeek]
      );
    }

    res.json({ success: true, logged: 1 });
  } catch (error) {
    console.error('[Search Destination POST] Error:', error.message);
    res.status(500).json({ error: 'Failed to log search destination' });
  }
});

/**
 * GET /analytics/heatmap?south=&west=&north=&east=&hour=&dayOfWeek=
 * Returns aggregated heatmap cells within the given bounding box.
 * hour and dayOfWeek are optional filters — omit for all-time data.
 * Response: { points: [{lat, lng, weight}] }
 * weight is normalised 0–1 relative to the max count in the result set.
 */
heatmapRouter.get('/', async (req, res) => {
  try {
    const { south, west, north, east, hour, dayOfWeek } = req.query;

    if (!south || !west || !north || !east) {
      return res.status(400).json({ error: 'Bounding box params required: south, west, north, east' });
    }

    const s = parseFloat(south);
    const w = parseFloat(west);
    const n = parseFloat(north);
    const e = parseFloat(east);

    if ([s, w, n, e].some(isNaN)) {
      return res.status(400).json({ error: 'Invalid bounding box values' });
    }

    // Build dynamic WHERE clause for optional time filters
    // We need to build this carefully for the UNION query
    let timeFilter   = '';
    let timeParams   = [];

    if (hour !== undefined && hour !== '') {
      const h = Number(hour);
      timeFilter += ` AND hour_of_day = ?`;
      timeParams.push(h);
    }

    if (dayOfWeek !== undefined && dayOfWeek !== '') {
      const d = Number(dayOfWeek);
      timeFilter += ` AND day_of_week = ?`;
      timeParams.push(d);
    }

    // UNION both route_segments and search_destinations for combined heatmap data
    // Parameters: [s, n, w, e] for route_segments bbox + timeParams + [s, n, w, e] for search_destinations bbox + timeParams
    const allParams = [s, n, w, e, ...timeParams, s, n, w, e, ...timeParams];

    const result = await query(
      `SELECT lat_bucket AS lat, lng_bucket AS lng, SUM(total_count) AS total
       FROM (
         SELECT lat_bucket, lng_bucket, SUM(count) AS total_count
         FROM route_segments
         WHERE lat_bucket BETWEEN ? AND ?
           AND lng_bucket BETWEEN ? AND ?
           ${timeFilter}
         GROUP BY lat_bucket, lng_bucket
         
         UNION ALL
         
         SELECT lat_bucket, lng_bucket, SUM(count) AS total_count
         FROM search_destinations
         WHERE lat_bucket BETWEEN ? AND ?
           AND lng_bucket BETWEEN ? AND ?
           ${timeFilter}
         GROUP BY lat_bucket, lng_bucket
       )
       GROUP BY lat_bucket, lng_bucket
       ORDER BY total DESC
       LIMIT 2000`,
      allParams
    );

    if (!result.rows.length) {
      return res.json({ points: [] });
    }

    // Normalise weights to 0–1 so Leaflet.heat can scale intensity
    const maxCount = Math.max(...result.rows.map(r => Number(r.total)));

    const points = result.rows.map(r => ({
      lat:    parseFloat(r.lat),
      lng:    parseFloat(r.lng),
      weight: maxCount > 0 ? Number(r.total) / maxCount : 0,
    }));

    res.json({ points });
  } catch (error) {
    console.error('[Heatmap GET] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

export default router;