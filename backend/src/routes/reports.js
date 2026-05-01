// backend/src/routes/reports.js
import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// =============================================
// POST /api/reports - Submit a new report
// =============================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      lat,
      lng,
      location_name,
      issue_type,
      custom_description,
      severity
    } = req.body;

    // Validate required fields
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (!issue_type) {
      return res.status(400).json({ error: 'Issue type is required' });
    }

    if (severity < 1 || severity > 3) {
      return res.status(400).json({ error: 'Severity must be between 1 and 3' });
    }

    // Get user ID from authenticated token
    const userId = req.user.id; // or req.user.userId depending on your auth middleware

    // FIXED: Use 'submitted_by' NOT 'user_id'
    const result = await query(
      `INSERT INTO accessibility_reports 
       (submitted_by, lat, lng, location_name, issue_type, custom_description, severity, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', CURRENT_TIMESTAMP)
       RETURNING id, submitted_by, lat, lng, location_name, issue_type, severity, status, created_at`,
      [userId, lat, lng, location_name, issue_type, custom_description, severity]
    );

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report: result.rows[0]
    });

  } catch (error) {
    console.error('[Reports] Submit error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit report' });
  }
});

// =============================================
// GET /api/reports - Get reports (admin only)
// =============================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;
    
    // Check if user is admin
    const userCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );
    
    if (!userCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    let statusFilter = '';
    const params = [];
    
    if (status !== 'all') {
      statusFilter = 'AND status = $3';
      params.push(status);
    }
    
    const result = await query(
      `SELECT id, submitted_by, lat, lng, location_name, issue_type, 
              custom_description, severity, status, admin_notes, 
              reviewed_by, reviewed_at, created_at, updated_at
       FROM accessibility_reports
       WHERE deleted_at IS NULL ${statusFilter}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset, ...params]
    );
    
    res.json({
      success: true,
      reports: result.rows,
      pagination: { limit, offset }
    });
    
  } catch (error) {
    console.error('[Reports] Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// GET /api/reports/:id - Get single report
// =============================================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT id, submitted_by, lat, lng, location_name, issue_type, 
              custom_description, severity, status, admin_notes, 
              reviewed_by, reviewed_at, created_at, updated_at
       FROM accessibility_reports
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Check if user is admin or report owner
    const isAdmin = await query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (!isAdmin.rows[0]?.is_admin && result.rows[0].submitted_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ success: true, report: result.rows[0] });
    
  } catch (error) {
    console.error('[Reports] Fetch one error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// PATCH /api/reports/:id - Update report status (admin only)
// =============================================
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    
    // Validate status
    if (!['approved', 'rejected', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Check if user is admin
    const userCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );
    
    if (!userCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const result = await query(
      `UPDATE accessibility_reports 
       SET status = $1, 
           admin_notes = COALESCE($2, admin_notes),
           reviewed_by = $3,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, status, admin_notes, reviewed_at`,
      [status, admin_notes, req.user.id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({
      success: true,
      message: `Report ${status}`,
      report: result.rows[0]
    });
    
  } catch (error) {
    console.error('[Reports] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// DELETE /api/reports/:id - Soft delete report (admin only)
// =============================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is admin
    const userCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );
    
    if (!userCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const result = await query(
      `UPDATE accessibility_reports 
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ success: true, message: 'Report deleted successfully' });
    
  } catch (error) {
    console.error('[Reports] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// GET /api/reports/stats/summary - Get report stats (admin only)
// =============================================
router.get('/stats/summary', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const userCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );
    
    if (!userCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const result = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
         COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
         ROUND(AVG(severity)::numeric, 2) as avg_severity
       FROM accessibility_reports
       WHERE deleted_at IS NULL`
    );
    
    res.json({ success: true, stats: result.rows[0] });
    
  } catch (error) {
    console.error('[Reports] Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;