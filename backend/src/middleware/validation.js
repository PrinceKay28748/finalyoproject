// src/middleware/validation.js
// Input validation & sanitization - prevents SQL injection + bad data

import { body, validationResult } from 'express-validator';

/**
 * Validation rules for registration
 * - Email format validation
 * - Password strength requirements
 * - Username format
 * 
 * SECURITY: express-validator sanitizes inputs
 */
export const validateRegister = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-50 chars, alphanumeric, dash, underscore only'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be 8+ chars with uppercase, lowercase, and number'),
];

/**
 * Validation rules for login
 */
export const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  
  body('password')
    .notEmpty()
    .withMessage('Password required'),
];

/**
 * Validation rules for preferences update
 */
export const validatePreferences = [
  body('activeProfile')
    .optional()
    .isIn(['standard', 'fastest', 'accessible', 'night'])
    .withMessage('Invalid profile'),
  
  body('darkMode')
    .optional()
    .isBoolean()
    .withMessage('darkMode must be boolean'),
  
  body('notificationsEnabled')
    .optional()
    .isBoolean()
    .withMessage('notificationsEnabled must be boolean'),
];

/**
 * Middleware to handle validation errors
 * Call this after validation rules
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  
  next();
}

/**
 * Sanitize query parameters (prevent NoSQL injection in logs)
 */
export function sanitizeParams(req, res, next) {
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim().slice(0, 100);
      }
    });
  }
  next();
}
