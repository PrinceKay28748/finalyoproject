// src/middleware/auth.js
// JWT verification middleware - supports both Supabase Auth and custom JWT tokens

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Verify JWT access token - Supports Supabase tokens and custom JWT
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

    // First, try to decode as Supabase token (without verification)
    try {
      const decoded = jwt.decode(token);
      
      if (decoded && decoded.sub) {
        // This is a Supabase token - trust it since Supabase already verified it
        req.user = { 
          userId: decoded.sub,  // UUID from Supabase
          email: decoded.email 
        };
        console.log('[Auth] Supabase token accepted for user:', decoded.email);
        return next();
      }
    } catch (decodeErr) {
      // Not a Supabase token, continue to custom verification
      console.log('[Auth] Not a Supabase token, trying custom verification');
    }
    
    // Fallback: Verify with your custom JWT secret (for existing tokens)
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded;
    console.log('[Auth] Custom JWT token accepted for user:', decoded.email);
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired, please refresh' 
      });
    }
    
    console.error('[Auth] Token verification failed:', error.message);
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
 * Create JWT access token (for custom auth - kept for compatibility)
 */
export function createAccessToken(userId, email) {
  return jwt.sign(
    { userId, email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
}

/**
 * Create JWT refresh token (for custom auth - kept for compatibility)
 */
export function createRefreshToken(userId, email) {
  return jwt.sign(
    { userId, email },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
}