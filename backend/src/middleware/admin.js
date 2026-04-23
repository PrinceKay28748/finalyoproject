// backend/src/middleware/admin.js
// Admin authorization middleware

import { query } from '../config/db.js';

export async function requireAdmin(req, res, next) {
  try {
    console.log('[Admin Middleware] Checking admin status...');
    console.log('[Admin Middleware] req.user:', req.user);
    
    const userId = req.user?.userId;
    
    if (!userId) {
      console.log('[Admin Middleware] No userId found in token');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log('[Admin Middleware] Checking admin for userId:', userId);
    
    const result = await query(
      'SELECT is_admin FROM users WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );
    
    console.log('[Admin Middleware] Query result:', result.rows);
    
    if (result.rows.length === 0) {
      console.log('[Admin Middleware] User not found');
      return res.status(403).json({ error: 'Admin access required - User not found' });
    }
    
    if (!result.rows[0].is_admin) {
      console.log('[Admin Middleware] User is not admin');
      return res.status(403).json({ error: 'Admin access required - Not admin' });
    }
    
    console.log('[Admin Middleware] Admin access granted');
    next();
  } catch (error) {
    console.error('[Admin Middleware] Error:', error.message);
    res.status(500).json({ error: 'Authorization failed' });
  }
}

// Bypass rate limiting for admins
export function adminBypassRateLimit(req, res, next) {
  if (req.user?.isAdmin) {
    req.skipRateLimit = true;
  }
  next();
}