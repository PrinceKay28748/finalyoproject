// src/utils/errorHandler.js
// Consistent error handling

export class APIError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function handleError(err, req, res) {
  console.error('[Error]', err.message);
  
  // Don't expose internal errors to client
  const message = err.statusCode ? err.message : 'Internal server error';
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    error: message
  });
}

/**
 * Log security event (successful/failed login)
 */
export async function logAudit(query, userId, action, ip, userAgent, success, errorMessage = null) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, action, ip, userAgent, success ? 1 : 0, errorMessage]
    );
  } catch (err) {
    console.warn('[Audit] Failed to log event:', err.message);
  }
}
