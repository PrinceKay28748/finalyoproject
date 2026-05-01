// backend/src/services/emailService.js
// Email service using Nodemailer with Gmail

import nodemailer from 'nodemailer';

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || EMAIL_USER;

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} token - Reset token
 * @param {string} frontendUrl - Frontend URL (e.g., https://ugnavigator.onrender.com)
 */
export async function sendPasswordResetEmail(to, token, frontendUrl = 'https://ugnavigator.onrender.com') {
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reset Your Password</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 500px;
          margin: 50px auto;
          background: white;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        }
        .logo {
          text-align: center;
          margin-bottom: 24px;
        }
        .logo svg {
          width: 48px;
          height: 48px;
        }
        h1 {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: #111;
          margin-bottom: 12px;
          text-align: center;
        }
        p {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          color: #555;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .button {
          display: inline-block;
          background: #1a6d8f;
          color: white;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 15px;
          margin: 16px 0;
        }
        .button:hover {
          background: #0f5570;
        }
        .footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #888;
          text-align: center;
        }
        .token {
          font-family: monospace;
          background: #f0f0f0;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#1a6d8f"/>
          </svg>
        </div>
        <h1>Reset Your Password</h1>
        <p>We received a request to reset your password for your UG Navigator account. Click the button below to create a new password.</p>
        <div style="text-align: center;">
          <a href="${resetLink}" class="button">Reset Password</a>
        </div>
        <p style="margin-top: 16px;">Or copy and paste this link into your browser:</p>
        <p class="token">${resetLink}</p>
        <p>This link will expire in <strong>1 hour</strong>.</p>
        <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
        <div class="footer">
          <p>UG Navigator — University of Ghana, Legon</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Reset Your Password
    
    We received a request to reset your password for your UG Navigator account.
    
    Click this link to reset your password:
    ${resetLink}
    
    This link will expire in 1 hour.
    
    If you didn't request this, please ignore this email.
    
    — UG Navigator, University of Ghana
  `;

  const mailOptions = {
    from: `"UG Navigator" <${EMAIL_USER}>`,
    to: to,
    subject: 'Reset Your UG Navigator Password',
    text: text,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Password reset email sent to:', to);
    console.log('[Email] Message ID:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to admin about new accessibility report
 * @param {Object} report - Report object with id, user_id, lat, lng, issue_type, custom_description, severity, created_at
 */
export async function sendReportNotification(report) {
  const adminEmail = ADMIN_EMAIL;
  
  const issueTypeLabels = {
    blocked_ramp: 'Blocked Ramp',
    missing_curb: 'Missing Curb Cut',
    broken_surface: 'Broken / Uneven Surface',
    poor_lighting: 'Poor Lighting',
    construction: 'Construction / Road Closed',
    other: 'Other Issue'
  };
  
  const severityLabels = { 1: 'Mild', 2: 'Moderate', 3: 'Severe' };
  const issueLabel = issueTypeLabels[report.issue_type] || report.issue_type;
  const severityLabel = severityLabels[report.severity] || 'Moderate';
  
  const mapLink = `https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=18/${report.lat}/${report.lng}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>New Accessibility Report</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 500px;
          margin: 50px auto;
          background: white;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        }
        h1 {
          font-family: 'Syne', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #111;
          margin-bottom: 20px;
        }
        .report-detail {
          background: #f8fafc;
          border-radius: 16px;
          padding: 16px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          margin-bottom: 10px;
        }
        .detail-label {
          width: 100px;
          font-weight: 600;
          color: #475569;
        }
        .detail-value {
          flex: 1;
          color: #0f172a;
        }
        .button {
          display: inline-block;
          background: #2563eb;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 500;
          margin-top: 16px;
        }
        .severity-1 { color: #22c55e; }
        .severity-2 { color: #f59e0b; }
        .severity-3 { color: #ef4444; }
        .footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #94a3b8;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚧 New Accessibility Report</h1>
        <p>A new accessibility issue has been reported on campus.</p>
        
        <div class="report-detail">
          <div class="detail-row">
            <span class="detail-label">Report ID:</span>
            <span class="detail-value">#${report.id}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Issue Type:</span>
            <span class="detail-value">${issueLabel}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Severity:</span>
            <span class="detail-value severity-${report.severity}">${severityLabel}</span>
          </div>
          ${report.custom_description ? `
          <div class="detail-row">
            <span class="detail-label">Description:</span>
            <span class="detail-value">${report.custom_description}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Location:</span>
            <span class="detail-value">${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Reported:</span>
            <span class="detail-value">${new Date(report.created_at).toLocaleString()}</span>
          </div>
        </div>
        
        <a href="${mapLink}" class="button" target="_blank">View on Map →</a>
        
        <div class="footer">
          <p>UG Navigator — University of Ghana, Legon</p>
          <p>Log into the admin dashboard to approve or reject this report.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"UG Navigator Reports" <${EMAIL_USER}>`,
    to: adminEmail,
    subject: `[UG Navigator] New Accessibility Report #${report.id}`,
    text: `A new ${issueLabel} report has been submitted. View at: ${mapLink}`,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[Email] Report notification sent to admin for report #', report.id);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send report notification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send email to user when their report is resolved (approved/rejected)
 * @param {Object} report - Original report object
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} adminNotes - Optional notes from admin
 */
export async function sendReportResolutionEmail(report, status, adminNotes = null) {
  const userEmail = report.email;
  if (!userEmail) return;
  
  const isApproved = status === 'approved';
  const subject = isApproved 
    ? `[UG Navigator] Your accessibility report #${report.id} has been approved`
    : `[UG Navigator] Your accessibility report #${report.id} has been reviewed`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Report Update</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 500px;
          margin: 50px auto;
          background: white;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        }
        h1 {
          font-family: 'Syne', sans-serif;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .status-approved { color: #22c55e; }
        .status-rejected { color: #ef4444; }
        .message {
          background: #f8fafc;
          border-radius: 16px;
          padding: 16px;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          background: #2563eb;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 500;
          margin-top: 16px;
        }
        .footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #94a3b8;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${isApproved ? '✓ Report Approved' : '📋 Report Reviewed'}</h1>
        <p>Thank you for helping improve campus accessibility.</p>
        
        <div class="message">
          <p><strong>Report #${report.id}</strong> — ${report.issue_type}</p>
          <p>Status: <strong class="${isApproved ? 'status-approved' : 'status-rejected'}">${isApproved ? 'Approved' : 'Not accepted at this time'}</strong></p>
          ${adminNotes ? `<p><strong>Admin notes:</strong> ${adminNotes}</p>` : ''}
          <p>Location: ${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}</p>
        </div>
        
        ${isApproved ? '<p>The issue will now be considered in route calculations for the accessibility profile.</p>' : ''}
        
        <div class="footer">
          <p>UG Navigator — University of Ghana, Legon</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"UG Navigator Accessibility" <${EMAIL_USER}>`,
    to: userEmail,
    subject: subject,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[Email] Resolution email sent to user for report #', report.id);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send resolution email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfig() {
  try {
    await transporter.verify();
    console.log('[Email] SMTP connection successful');
    return { success: true };
  } catch (error) {
    console.error('[Email] SMTP connection failed:', error.message);
    return { success: false, error: error.message };
  }
}