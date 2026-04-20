# UG Campus Navigation - Authentication System Architecture & Documentation

**Version:** 1.0.0  
**Last Updated:** April 2026  
**Security Level:** Zero-Trust Implementation  

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Security Implementation](#security-implementation)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Frontend Integration](#frontend-integration)
7. [Setup & Deployment](#setup--deployment)
8. [Best Practices](#best-practices)
9. [Future Enhancements](#future-enhancements)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Campus Navigation App now includes a **production-ready authentication system** built on zero-trust principles. Every request is validated server-side, all database queries use parameterized statements to prevent SQL injection, and all passwords are hashed with bcrypt.

### Key Features

- ✅ **Zero-Trust Architecture** - Never trust frontend validation
- ✅ **SQL Injection Prevention** - Parameterized queries only
- ✅ **Password Security** - bcrypt hashing (10 rounds)
- ✅ **JWT Authentication** - Stateless token-based auth
- ✅ **Rate Limiting** - Prevents brute force attacks
- ✅ **Audit Logging** - Security event tracking
- ✅ **CORS Protection** - Whitelisted origins only
- ✅ **Token Refresh** - Long-lived refresh tokens, short-lived access tokens

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AuthContext + useAuth Hook                          │   │
│  │  Login/Register Components                           │   │
│  │  SessionStorage for tokens                           │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS API Calls
                     │ Authorization: Bearer <JWT>
                     ↓
┌─────────────────────────────────────────────────────────────┐
│               BACKEND (Node.js/Express)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. Helmet - Security headers                        │   │
│  │  2. CORS - Origin whitelisting                       │   │
│  │  3. Rate Limiter - Brute force protection           │   │
│  │  4. Body Parser - JSON validation                    │   │
│  │  5. Validator - Input sanitization                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─── Auth Routes ──────────────────────────────────────┐   │
│  │  POST   /auth/register                               │   │
│  │  POST   /auth/login                                  │   │
│  │  POST   /auth/refresh                                │   │
│  │  POST   /auth/logout                                 │   │
│  │  GET    /auth/me (requires JWT)                      │   │
│  │  PATCH  /auth/preferences (requires JWT)             │   │
│  │  DELETE /auth/me (requires JWT)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─── Middleware ──────────────────────────────────────┐    │
│  │  • JWT Verification (verifyToken)                    │    │
│  │  • Input Validation (express-validator)              │    │
│  │  • Error Handling                                    │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────────┘
                     │ Parameterized Queries
                     │ Connection Pool (20 connections)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  users table                                         │   │
│  │  user_preferences table                              │   │
│  │  refresh_tokens table                                │   │
│  │  audit_logs table                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

```
Frontend:
  • React 18+ (UI framework)
  • Context API (state management)
  • SessionStorage (token storage)
  • Fetch API (HTTP client)

Backend:
  • Node.js 18+ (runtime)
  • Express 4.18+ (web framework)
  • PostgreSQL 12+ (database)
  • bcryptjs (password hashing)
  • jsonwebtoken (JWT signing)
  • express-validator (input validation)
  • helmet (security headers)
  • express-rate-limit (rate limiting)

Security Tools:
  • Helmet - HTTP security headers
  • CORS - Cross-origin protection
  • Rate Limiting - DDoS/brute force prevention
  • bcryptjs - Password hashing
  • JWT - Stateless authentication
```

---

## Security Implementation

### 1. SQL Injection Prevention

**Problem:** Concatenating user input into SQL queries allows attackers to modify queries.

**Bad Example (NEVER DO THIS):**
```javascript
// ❌ VULNERABLE
const result = await db.query(
  `SELECT * FROM users WHERE email = '${userEmail}'`
);
// If email = `'; DROP TABLE users; --` → Entire table deleted!
```

**Good Example (ALWAYS DO THIS):**
```javascript
// ✅ SAFE - Parameterized query
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [userEmail]  // Parameters separated from query
);
// Database driver escapes the value automatically
```

**Implementation in Backend:**
- Every database query uses parameterized statements (`$1`, `$2`, etc.)
- User input NEVER directly concatenates into SQL
- Connection pool uses `pg` library which handles escaping automatically

### 2. Password Security

**Hashing with bcrypt:**
```javascript
// Registration
const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
// Stores hash, never plaintext

// Login
const match = await bcrypt.compare(inputPassword, storedHash);
// Timing-safe comparison (prevents timing attacks)
```

**Why bcrypt?**
- Slow hashing (10 rounds = ~100ms per hash)
- Prevents rainbow table attacks
- Built-in salt generation
- NIST approved

### 3. JWT Token Management

**Access Token (15 minutes):**
- Used for API requests (`Authorization: Bearer <token>`)
- Short lifetime reduces damage if stolen
- Expires automatically

**Refresh Token (7 days):**
- Stored in `refresh_tokens` table (hashed with bcrypt)
- Never exposed to browser (sent as secure cookie preferred, not implemented yet)
- Can be revoked on logout

**Token Flow:**
```
1. User registers/logs in
2. Backend creates access token (15 min) + refresh token (7 days)
3. Frontend stores both in sessionStorage
4. API requests use access token
5. When access token expires:
   a. Frontend sends refresh token
   b. Backend validates + creates new access token
   c. Frontend retries original request
```

### 4. Input Validation & Sanitization

**Validation Rules (Backend only):**

```javascript
// Email
• Must be valid email format
• Normalized (lowercase, trimmed)
• Checked for uniqueness in database

// Username
• 3-50 characters
• Alphanumeric, dash, underscore only
• Checked for uniqueness in database

// Password
• Minimum 8 characters
• At least one uppercase letter
• At least one lowercase letter
• At least one number
```

**Why Server-Side?**
- Frontend validation is UX (helps users)
- Backend validation is SECURITY (prevents attacks)
- Never trust frontend

### 5. Rate Limiting

**Login Endpoint:**
- Max 5 attempts per IP per 15 minutes
- Returns 429 (Too Many Requests) when exceeded
- Prevents brute force password attacks

**General Endpoints:**
- Max 100 requests per IP per 15 minutes
- Prevents API abuse/DoS

### 6. CORS Protection

**Whitelisted Origins:**
```javascript
// Only your frontend domain can make requests
CORS_ORIGIN=http://localhost:5173
```

**Allowed Methods:** GET, POST, PATCH, DELETE  
**Allowed Headers:** Content-Type, Authorization

### 7. Audit Logging

**Logged Events:**
- ✓ Successful registration
- ✓ Successful login
- ✓ Failed login (wrong password, user not found)
- ✓ All security events

**Audit Log Fields:**
- `user_id` - User responsible (nullable for failed attempts)
- `action` - Event type (e.g., LOGIN_SUCCESS)
- `ip_address` - Request IP (behind proxy-safe)
- `user_agent` - Browser/client info
- `success` - Boolean result
- `error_message` - Why it failed (if applicable)

**Query:**
```sql
SELECT * FROM audit_logs WHERE action LIKE '%FAILED%' ORDER BY created_at DESC;
```

---

## Database Schema

### users table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL  -- Soft delete
);
```

**Indexes:** email, username  
**Security:** password_hash only (never plaintext password)

### user_preferences table
```sql
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  active_profile VARCHAR(50) DEFAULT 'standard',
  dark_mode BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### refresh_tokens table
```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,  -- Hashed token
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,  -- Soft revoke
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### audit_logs table
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## API Endpoints

### Authentication Endpoints

#### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "email": "user@university.edu",
  "username": "johnsmith",
  "password": "SecurePass123"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@university.edu",
    "username": "johnsmith"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Errors:**
- `400` - Validation failed (weak password, invalid email)
- `409` - Email or username already registered

---

#### POST /auth/login
Authenticate a user.

**Request:**
```json
{
  "email": "user@university.edu",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "message": "Logged in successfully",
  "user": {
    "id": 1,
    "email": "user@university.edu",
    "username": "johnsmith"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Errors:**
- `401` - Invalid email or password
- `429` - Too many login attempts (rate limited)

---

#### POST /auth/refresh
Get a new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGc..."
}
```

**Errors:**
- `401` - Refresh token expired or revoked
- `403` - Invalid refresh token

---

#### POST /auth/logout
Revoke all refresh tokens (logout).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### GET /auth/me
Get current user data (requires JWT).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@university.edu",
    "username": "johnsmith",
    "created_at": "2026-04-20T10:30:00Z",
    "active_profile": "standard",
    "dark_mode": false,
    "notifications_enabled": true
  }
}
```

---

#### PATCH /auth/preferences
Update user preferences.

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request:**
```json
{
  "activeProfile": "night",
  "darkMode": true,
  "notificationsEnabled": false
}
```

**Response (200):**
```json
{
  "message": "Preferences updated",
  "preferences": {
    "id": 1,
    "user_id": 1,
    "active_profile": "night",
    "dark_mode": true,
    "notifications_enabled": false,
    "updated_at": "2026-04-20T11:45:00Z"
  }
}
```

---

#### DELETE /auth/me
Delete user account (soft delete).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "message": "Account deleted successfully"
}
```

---

## Frontend Integration

### 1. AuthContext Setup

**Wrap App with Provider:**
```javascript
// src/main.jsx
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
```

### 2. Using useAuthContext Hook

**In any component:**
```javascript
import { useAuthContext } from './context/AuthContext';

export function MyComponent() {
  const { user, isAuthenticated, login, logout, getAuthHeader } = useAuthContext();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div>
      Welcome, {user.username}!
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### 3. Protected API Calls

**Make authenticated requests:**
```javascript
const { getAuthHeader } = useAuthContext();

const response = await fetch('/api/some-endpoint', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    ...getAuthHeader()  // Automatically includes JWT
  }
});
```

---

## Setup & Deployment

### Local Development

#### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

#### 2. Setup Database

```bash
# Create PostgreSQL database
createdb ug_campus_nav

# Run migrations
cd backend
npm run migrate
```

#### 3. Configure Environment

**Backend** (`.env` in backend/):
```
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ug_campus_nav
DB_USER=postgres
DB_PASSWORD=your_password

JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

CORS_ORIGIN=http://localhost:5173
```

**Frontend** (`.env` in frontend/):
```
VITE_API_URL=http://localhost:3001
```

#### 4. Start Services

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Production Deployment

#### Environment Variables (CRITICAL)

```bash
# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Backend Production (.env):**
```
NODE_ENV=production
PORT=3001
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=ug_campus_nav
DB_USER=postgres
DB_PASSWORD=SECURE_PASSWORD_HERE

JWT_ACCESS_SECRET=SECURE_32_CHAR_RANDOM_STRING
JWT_REFRESH_SECRET=DIFFERENT_32_CHAR_RANDOM_STRING

CORS_ORIGIN=https://yourdomain.com

# Security
BCRYPT_ROUNDS=12  # Increase for production
RATE_LIMIT_MAX_REQUESTS=5
```

#### SSL/TLS Certificate

**CRITICAL:** Always use HTTPS in production
```nginx
# Nginx example
server {
  listen 443 ssl http2;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    proxy_pass http://localhost:3001;
  }
}
```

#### Docker Deployment (Optional)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json .
RUN npm ci --only=production

COPY src/ ./src/

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "src/server.js"]
```

```bash
docker build -t ug-campus-nav-backend .
docker run -e DB_HOST=db_container -p 3001:3001 ug-campus-nav-backend
```

---

## Best Practices

### Security Best Practices (Implemented)

✅ **Parameterized Queries**
- Every database query uses `$1`, `$2` placeholders
- User input never concatenates into SQL

✅ **Password Hashing**
- bcrypt with 10 rounds (100ms per hash)
- Never store plaintext passwords

✅ **JWT Token Separation**
- Access tokens: 15 minutes (API requests)
- Refresh tokens: 7 days (stored in DB, hashed)
- Tokens never exposed in URLs

✅ **Rate Limiting**
- Login: 5 attempts per 15 minutes
- APIs: 100 requests per 15 minutes

✅ **CORS Whitelisting**
- Only specific domains allowed
- Credentials require explicit headers

✅ **Audit Logging**
- All authentication events logged
- IP address and user agent captured

✅ **Input Validation**
- Server-side validation (frontend is UX)
- Email format, password strength, username pattern

✅ **Error Messages**
- Generic messages to clients ("Invalid email or password")
- Detailed logs server-side only

### Code Best Practices

```javascript
// ✅ Good - Clear, secure, maintainable
async function loginUser(email, password) {
  const result = await query(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email]
  );
  
  if (result.rows.length === 0) {
    logAudit(query, null, 'LOGIN_FAILED', ip, 'User not found');
    throw new APIError('Invalid credentials', 401);
  }
  
  const match = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!match) {
    logAudit(query, result.rows[0].id, 'LOGIN_FAILED', ip, 'Invalid password');
    throw new APIError('Invalid credentials', 401);
  }
  
  // ... create tokens
}

// ❌ Bad - Insecure, leaks info, concatenates input
async function loginUser(email, password) {
  const user = await query(
    `SELECT * FROM users WHERE email = '${email}'`  // SQL injection!
  );
  
  if (!user || user.password !== password) {  // Plaintext comparison!
    throw new Error(`User ${email} not found`);  // Leaks if user exists!
  }
}
```

---

## Future Enhancements

### Short Term (Next Sprint)

- [ ] **Secure Cookies**
  - Store refresh tokens in HttpOnly cookies (not localStorage)
  - CSRF protection middleware
  - SameSite attribute

- [ ] **Email Verification**
  - Send verification link on registration
  - Resend verification email option

- [ ] **Password Reset**
  - Email-based password reset flow
  - Temporary reset tokens (1 hour expiry)

- [ ] **Two-Factor Authentication (2FA)**
  - TOTP (Time-based One-Time Password) support
  - Recovery codes for backup

### Medium Term

- [ ] **Social Login**
  - Google OAuth 2.0
  - Microsoft Azure AD (for university integration)
  - Apple Sign In

- [ ] **Account Recovery**
  - Security questions
  - Account lockout thresholds
  - Admin recovery options

- [ ] **Session Management**
  - Multiple device logins
  - "Sign out all devices" option
  - Session history

- [ ] **Advanced Audit**
  - Suspicious activity detection
  - Geolocation tracking
  - Device fingerprinting

### Long Term

- [ ] **SAML Integration**
  - University SSO (Single Sign-On)
  - Directory sync

- [ ] **Role-Based Access Control (RBAC)**
  - Admin users
  - Campus support staff
  - Analytics access

- [ ] **API Key System**
  - Third-party integrations
  - Scoped permissions

- [ ] **OAuth 2.0 Provider**
  - Allow third-party apps
  - Campus-wide identity provider

---

## Troubleshooting

### "Connection refused" error on backend startup

**Problem:** Cannot connect to PostgreSQL

**Solution:**
```bash
# Check if PostgreSQL is running
brew services list              # macOS
systemctl status postgresql     # Linux
docker ps                       # If using Docker

# Verify connection
psql -U postgres -h localhost
```

### "JWT expired" errors

**Problem:** Tokens expiring too quickly

**Solution:**
- Check system clock synchronization
- Verify JWT_ACCESS_EXPIRY in .env
- Ensure server time matches DB time

### Rate limiting too aggressive

**Problem:** Users locked out too quickly

**Solution:**
```javascript
// Adjust in .env
RATE_LIMIT_WINDOW_MS=900000  # 15 min (increase if needed)
RATE_LIMIT_MAX_REQUESTS=5    # Attempts allowed (increase if needed)
```

### Passwords not hashing

**Problem:** Plaintext passwords stored

**Solution:**
- Check BCRYPT_ROUNDS is set
- Verify bcryptjs is installed (`npm list bcryptjs`)
- Ensure registration route uses bcrypt.hash()

### SQL errors on migration

**Problem:** Schema creation fails

**Solution:**
```bash
# Check schema file syntax
psql -U postgres -d ug_campus_nav -f src/db/schema.sql

# Drop and recreate database
dropdb ug_campus_nav
createdb ug_campus_nav
npm run migrate
```

### CORS errors on API calls

**Problem:** "Access to XMLHttpRequest blocked by CORS"

**Solution:**
```javascript
// .env backend
CORS_ORIGIN=http://localhost:5173  # Match frontend URL exactly

// Restart backend
npm run dev
```

### Refresh token not working

**Problem:** Token refresh fails with 403

**Solution:**
- Verify refresh token exists in database
- Check `revoked_at` is NULL
- Ensure `expires_at` is in the future

---

## Contact & Support

For issues or questions:
- GitHub Issues: [link]
- Email: dev@university.edu
- Documentation: [link]

---

**Last Updated:** April 20, 2026  
**Maintainers:** Development Team  
**License:** MIT
