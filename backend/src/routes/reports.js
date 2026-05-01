// backend/src/routes/reports.js
import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';
import { sendReportNotification, sendReportResolutionEmail } from '../services/emailService.js';

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

    // FIXED: Use req.user.userId (matches your auth middleware)
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID not found in token' });
    }

    // Insert the report
    const result = await query(
      `INSERT INTO accessibility_reports 
       (submitted_by, lat, lng, location_name, issue_type, custom_description, severity, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', CURRENT_TIMESTAMP)
       RETURNING id, submitted_by, lat, lng, location_name, issue_type, custom_description, severity, status, created_at`,
      [userId, lat, lng, location_name || null, issue_type, custom_description || null, severity]
    );

    const newReport = result.rows[0];

    // ✅ ADDED: Send email notification to admin
    try {
      // Get user email for the report object
      const userResult = await query(
        'SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL',
        [userId]
      );
      
      const reportWithEmail = {
        ...newReport,
        email: userResult.rows[0]?.email || null
      };
      
      await sendReportNotification(reportWithEmail);
      console.log('[Reports] Admin notification sent for report #', newReport.id);
    } catch (emailError) {
      console.error('[Reports] Failed to send admin notification:', emailError.message);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Admin will review it shortly.',
      report: newReport
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
    
    // FIXED: Use req.user.userId
    const userId = req.user.userId;
    
    // Check if user is admin
    const userCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );
    
    if (!userCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    let statusFilter = '';
    const params = [limit, offset];
    
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
      params
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
    const userId = req.user.userId;
    
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
      [userId]
    );
    
    if (!isAdmin.rows[0]?.is_admin && result.rows[0].submitted_by !== userId) {
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
    const userId = req.user.userId;
    
    // Validate status
    if (!['approved', 'rejected', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Check if user is admin
    const userCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );
    
    if (!userCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // First, get the original report with user email
    const reportResult = await query(
      `SELECT r.*, u.email 
       FROM accessibility_reports r
       LEFT JOIN users u ON r.submitted_by = u.id
       WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [id]
    );
    
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const originalReport = reportResult.rows[0];
    const oldStatus = originalReport.status;
    
    // Update the report status
    const updateResult = await query(
      `UPDATE accessibility_reports 
       SET status = $1, 
           admin_notes = COALESCE($2, admin_notes),
           reviewed_by = $3,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, status, admin_notes, reviewed_at`,
      [status, admin_notes, userId, id]
    );
    
    // ✅ ADDED: Send email notification to user if status changed significantly
    if (oldStatus !== status && (status === 'approved' || status === 'rejected')) {
      try {
        await sendReportResolutionEmail(originalReport, status, admin_notes);
        console.log('[Reports] Resolution email sent to user for report #', id);
      } catch (emailError) {
        console.error('[Reports] Failed to send resolution email:', emailError.message);
        // Don't fail the request if email fails
      }
    }
    
    res.json({
      success: true,
      message: `Report ${status}`,
      report: updateResult.rows[0]
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
    const userId = req.user.userId;
    
    // Check if user is admin
    const userCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
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
    const userId = req.user.userId;
    
    // Check if user is admin
    const userCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
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
         COALESCE(ROUND(AVG(severity)::numeric, 2), 0) as avg_severity
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