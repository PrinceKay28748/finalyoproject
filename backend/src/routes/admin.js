// backend/src/routes/admin.js
// Admin analytics routes - PostgreSQL version for Supabase

import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(verifyToken);
router.use(requireAdmin);

/**
 * GET /admin/stats
 * Get real-time dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Get total users
    const totalUsers = await query(
      'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL'
    );
    
    // Get active users today (PostgreSQL syntax)
    const activeToday = await query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM user_activity 
       WHERE DATE(created_at) = CURRENT_DATE`
    );
    
    // Get active users this week (PostgreSQL syntax)
    const activeWeek = await query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM user_activity 
       WHERE created_at > NOW() - INTERVAL '7 days'`
    );
    
    // Get new registrations this week
    const newUsers = await query(
      `SELECT COUNT(*) as count 
       FROM users 
       WHERE created_at > NOW() - INTERVAL '7 days'`
    );
    
    // Get total routes calculated
    const totalRoutes = await query(
      'SELECT COUNT(*) as count FROM route_logs'
    );
    
    // Get routes today
    const routesToday = await query(
      `SELECT COUNT(*) as count 
       FROM route_logs 
       WHERE DATE(created_at) = CURRENT_DATE`
    );
    
    // Get top destinations
    const topDestinations = await query(
      `SELECT end_location, COUNT(*) as count 
       FROM route_logs 
       WHERE created_at > NOW() - INTERVAL '30 days'
       AND end_location IS NOT NULL
       GROUP BY end_location 
       ORDER BY count DESC 
       LIMIT 5`
    );
    
    // Get route profile preferences
    const profileUsage = await query(
      `SELECT profile_used, COUNT(*) as count 
       FROM route_logs 
       WHERE created_at > NOW() - INTERVAL '30 days'
       AND profile_used IS NOT NULL
       GROUP BY profile_used`
    );
    
    // Get security events (last 24h)
    const failedLogins = await query(
      `SELECT COUNT(*) as count 
       FROM audit_logs 
       WHERE action LIKE '%LOGIN_FAILED%' 
       AND created_at > NOW() - INTERVAL '1 day'`
    );
    
    const passwordResets = await query(
      `SELECT COUNT(*) as count 
       FROM audit_logs 
       WHERE action = 'FORGOT_PASSWORD_EMAIL_SENT' 
       AND created_at > NOW() - INTERVAL '1 day'`
    );
    
    const rateLimitHits = await query(
      `SELECT COUNT(*) as count 
       FROM audit_logs 
       WHERE action = 'FORGOT_PASSWORD_RATE_LIMIT' 
       AND created_at > NOW() - INTERVAL '1 day'`
    );
    
    // Get daily activity for chart (last 7 days)
    const dailyActivity = await query(
      `SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as count 
       FROM user_activity 
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );
    
    res.json({
      users: {
        total: totalUsers.rows[0]?.count || 0,
        activeToday: activeToday.rows[0]?.count || 0,
        activeWeek: activeWeek.rows[0]?.count || 0,
        newThisWeek: newUsers.rows[0]?.count || 0
      },
      routes: {
        total: totalRoutes.rows[0]?.count || 0,
        today: routesToday.rows[0]?.count || 0
      },
      topDestinations: topDestinations.rows || [],
      profilePreferences: profileUsage.rows || [],
      security: {
        failedLogins24h: failedLogins.rows[0]?.count || 0,
        passwordResets24h: passwordResets.rows[0]?.count || 0,
        rateLimitHits24h: rateLimitHits.rows[0]?.count || 0
      },
      dailyActivity: dailyActivity.rows || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Admin Stats] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /admin/users
 * List all users
 */
router.get('/users', async (req, res) => {
  try {
    const users = await query(
      `SELECT id, email, username, is_admin, created_at, 
              (SELECT COUNT(*) FROM route_logs WHERE user_id = users.id) as route_count,
              (SELECT MAX(created_at) FROM user_activity WHERE user_id = users.id) as last_active
       FROM users 
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );
    
    res.json({ users: users.rows });
  } catch (error) {
    console.error('[Admin Users] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /admin/activity
 * Get recent user activity
 */
router.get('/activity', async (req, res) => {
  try {
    const activity = await query(
      `SELECT a.*, u.username, u.email 
       FROM user_activity a
       JOIN users u ON a.user_id = u.id
       WHERE u.deleted_at IS NULL
       ORDER BY a.created_at DESC
       LIMIT 50`
    );
    
    res.json({ activity: activity.rows });
  } catch (error) {
    console.error('[Admin Activity] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;