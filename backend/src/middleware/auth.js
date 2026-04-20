// src/middleware/auth.js
// JWT verification middleware - protects routes

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Verify JWT access token
 * Attached to protected routes
 */
export function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No authorization token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired, please refresh' 
      });
    }
    
    return res.status(403).json({ 
      error: 'Invalid token' 
    });
  }
}

/**
 * Verify refresh token and issue new access token
 */
export function verifyRefreshToken(req, res, next) {
  try {
    const token = req.body.refreshToken;
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No refresh token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
      error: 'Invalid refresh token' 
    });
  }
}

/**
 * Create JWT access token
 */
export function createAccessToken(userId, email) {
  return jwt.sign(
    { userId, email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
}

/**
 * Create JWT refresh token
 */
export function createRefreshToken(userId, email) {
  return jwt.sign(
    { userId, email },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
}
