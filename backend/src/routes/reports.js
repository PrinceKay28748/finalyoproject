// backend/src/routes/reports.js
// Accessibility reports API - submit, list, approve, reject

import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { sendReportNotification, sendReportResolutionEmail } from '../services/emailService.js';

const router = express.Router();

// ─── Helper to get client IP ────────────────────────────────────────────────
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
}

/**
 * POST /api/reports
 * Submit a new accessibility report (requires authentication)
 * 
 * Body:
 *   - lat: number (required)
 *   - lng: number (required)
 *   - location_name: string (optional)
 *   - issue_type: string (required) - one of: 'blocked_ramp', 'missing_curb', 'broken_surface', 'poor_lighting', 'construction', 'other'
 *   - custom_description: string (required if issue_type is 'other')
 *   - severity: integer (1-3, default 2)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { lat, lng, location_name, issue_type, custom_description, severity = 2 } = req.body;
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (!issue_type) {
      return res.status(400).json({ error: 'Issue type is required' });
    }

    const validIssueTypes = ['blocked_ramp', 'missing_curb', 'broken_surface', 'poor_lighting', 'construction', 'other'];
    if (!validIssueTypes.includes(issue_type)) {
      return res.status(400).json({ error: 'Invalid issue type' });
    }

    if (issue_type === 'other' && !custom_description) {
      return res.status(400).json({ error: 'Custom description is required for "other" issues' });
    }

    if (severity < 1 || severity > 3) {
      return res.status(400).json({ error: 'Severity must be between 1 and 3' });
    }

    // Insert report
    const result = await query(
      `INSERT INTO accessibility_reports (user_id, lat, lng, location_name, issue_type, custom_description, severity, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
      [userId, lat, lng, location_name || null, issue_type, custom_description || null, severity]
    );

    const reportId = result.lastID || result.rows[0]?.id;

    // Send email notification to admin
    await sendReportNotification({
      id: reportId,
      user_id: userId,
      lat,
      lng,
      location_name,
      issue_type,
      custom_description,
      severity,
      created_at: new Date().toISOString()
    });

    console.log(`[Reports] New report ${reportId} submitted by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Admin will review it shortly.',
      report_id: reportId
    });

  } catch (error) {
    console.error('[Reports] Submit error:', error.message);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

/**
 * GET /api/reports
 * List reports (admin only)
 * 
 * Query params:
 *   - status: pending|approved|rejected|all (default: pending)
 *   - limit: number (default: 50)
 *   - offset: number (default: 0)
 */
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;
    
    let statusFilter = '';
    let params = [];
    
    if (status !== 'all') {
      statusFilter = 'WHERE status = ?';
      params.push(status);
    }
    
    const reports = await query(
      `SELECT r.*, u.username, u.email
       FROM accessibility_reports r
       JOIN users u ON r.user_id = u.id
       ${statusFilter}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    // Get count for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total FROM accessibility_reports ${statusFilter}`,
      params
    );
    
    res.json({
      reports: reports.rows,
      total: countResult.rows[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('[Reports] List error:', error.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * GET /api/reports/:id
 * Get single report details (admin only)
 */
router.get('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await query(
      `SELECT r.*, u.username, u.email
       FROM accessibility_reports r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [id]
    );
    
    if (report.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ report: report.rows[0] });
    
  } catch (error) {
    console.error('[Reports] Get error:', error.message);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

/**
 * PATCH /api/reports/:id
 * Approve or reject a report (admin only)
 * 
 * Body:
 *   - status: 'approved' or 'rejected'
 *   - admin_notes: string (optional)
 */
router.patch('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    const adminId = req.user?.userId;
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (approved/rejected) is required' });
    }
    
    // Get report details before update
    const report = await query(
      `SELECT r.*, u.username, u.email
       FROM accessibility_reports r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [id]
    );
    
    if (report.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const reportData = report.rows[0];
    
    // Update report status
    await query(
      `UPDATE accessibility_reports 
       SET status = ?, admin_notes = ?, resolved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, admin_notes || null, id]
    );
    
    // Log resolution
    await query(
      `INSERT INTO report_resolutions (report_id, admin_id, action, notes, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, adminId, status, admin_notes || null]
    );
    
    // Send email notification to the user who submitted the report
    await sendReportResolutionEmail(reportData, status, admin_notes);
    
    console.log(`[Reports] Report ${id} ${status} by admin ${adminId}`);
    
    res.json({ 
      success: true, 
      message: `Report ${status} successfully`,
      report_id: id
    });
    
  } catch (error) {
    console.error('[Reports] Update error:', error.message);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

/**
 * GET /api/reports/stats/summary
 * Get report statistics for admin dashboard
 */
router.get('/stats/summary', verifyToken, requireAdmin, async (req, res) => {
  try {
    const stats = await query(
      `SELECT 
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
         COUNT(CASE WHEN issue_type = 'blocked_ramp' THEN 1 END) as blocked_ramp,
         COUNT(CASE WHEN issue_type = 'missing_curb' THEN 1 END) as missing_curb,
         COUNT(CASE WHEN issue_type = 'broken_surface' THEN 1 END) as broken_surface,
         COUNT(CASE WHEN issue_type = 'poor_lighting' THEN 1 END) as poor_lighting,
         COUNT(CASE WHEN issue_type = 'construction' THEN 1 END) as construction,
         COUNT(CASE WHEN issue_type = 'other' THEN 1 END) as other
       FROM accessibility_reports`
    );
    
    res.json({ stats: stats.rows[0] });
    
  } catch (error) {
    console.error('[Reports] Stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;