// backend/src/routes/analytics.js
// Analytics logging endpoints - PostgreSQL version for Supabase

import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// All analytics routes require authentication
router.use(verifyToken);

/**
 * POST /analytics/log
 * Log user activity (search, login, route calculations)
 */
router.post('/log', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { activity_type, metadata } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }
    
    if (!activity_type) {
      return res.status(400).json({ error: 'Activity type required' });
    }
    
    await query(
      `INSERT INTO user_activity (user_id, activity_type, metadata, created_at)
       VALUES ($1, $2, $3, NOW())`,
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
 * POST /analytics/route
 * Log route calculation
 */
router.post('/route', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { start_location, end_location, profile_used, distance } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }
    
    await query(
      `INSERT INTO route_logs (user_id, start_location, end_location, profile_used, route_distance, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, start_location || null, end_location || null, profile_used || null, distance || null]
    );
    
    console.log(`[Analytics] Logged route for user ${userId}: ${start_location} → ${end_location} (${profile_used})`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics Route] Error:', error.message);
    res.status(500).json({ error: 'Failed to log route' });
  }
});

export default router;