# Security Guidelines

This document outlines security improvements and best practices implemented in this project.

## 🔒 Security Improvements Implemented

### Authentication & Authorization

1. **JWT Secret Validation**
   - JWT secret must be at least 32 characters long
   - Application will fail to start if JWT_SECRET is not properly configured
   - No insecure fallback values

2. **Strong Password Requirements**
   - Admin password must be at least 8 characters long
   - Application will not create admin user with weak passwords
   - Password verification uses bcrypt with proper error handling

3. **Timing Attack Prevention**
   - Login endpoint uses constant-time password verification
   - Dummy hash verification when user doesn't exist
   - Additional delay to prevent timing-based user enumeration

4. **Input Validation**
   - Username validation (max 50 chars, alphanumeric + special chars)
   - Password validation (max 128 chars)
   - Tutorial data validation (title, description, content size limits)
   - ID validation to prevent injection attacks

### Security Headers

The following security headers are automatically added to all responses:

- `Content-Security-Policy`: Restricts resource loading
- `Strict-Transport-Security`: Enforces HTTPS
- `X-Content-Type-Options: nosniff`: Prevents MIME sniffing
- `X-Frame-Options: DENY`: Prevents clickjacking

### Request Security

1. **Request Body Limits**
   - Maximum request body size: 10 MB
   - Prevents DoS attacks via large payloads

2. **CORS Configuration**
   - Configurable allowed origins via `FRONTEND_ORIGINS`
   - Credentials support enabled for same-origin requests

3. **JWT Token Validation**
   - Proper expiration validation
   - 60-second leeway for clock skew
   - Invalid tokens are rejected immediately

### Database Security

1. **SQL Injection Prevention**
   - All queries use parameterized statements
   - Input validation before database operations

2. **Transaction Safety**
   - Default tutorial insertion uses transactions
   - Prevents race conditions during initialization

3. **Connection Pool Configuration**
   - Proper timeouts (connect: 5s, acquire: 10s)
   - Connection lifetime limits (3600s)
   - Idle timeout (600s)

## 🚨 Known Limitations

### Client-Side Token Storage

**Issue**: JWT tokens are stored in `localStorage`, which is vulnerable to XSS attacks.

**Mitigation Options**:
- Keep dependencies updated to prevent XSS vulnerabilities
- Implement Content Security Policy (already done)
- Consider migrating to httpOnly cookies (requires backend changes)

**To Implement httpOnly Cookies**:
1. Modify backend to set JWT in httpOnly cookie
2. Update CORS to include credentials
3. Remove localStorage usage from frontend

### Rate Limiting

**Current State**: No rate limiting implemented on login endpoint.

**Recommendation**: Add rate limiting middleware (e.g., tower-governor for Rust backend)

```rust
// Example implementation needed:
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};

let governor_conf = Box::new(
    GovernorConfigBuilder::default()
        .per_second(2)
        .burst_size(5)
        .finish()
        .unwrap()
);
```

### Session Management

**Current State**: JWT tokens cannot be revoked before expiration.

**Recommendation**: Implement one of:
- Token blacklist with Redis
- Short-lived access tokens + refresh tokens
- Session database

## 🔐 Production Deployment Checklist

### Environment Variables

- [ ] Set strong `JWT_SECRET` (min. 32 characters)
  ```bash
  export JWT_SECRET=$(openssl rand -base64 48)
  ```

- [ ] Set strong `ADMIN_PASSWORD` (min. 8 characters)
  ```bash
  export ADMIN_PASSWORD=$(openssl rand -base64 16)
  ```

- [ ] Configure `FRONTEND_ORIGINS` for production domain
  ```bash
  export FRONTEND_ORIGINS=https://yourdomain.com
  ```

### HTTPS Configuration

- [ ] Enable HTTPS in production (required for HSTS header)
- [ ] Configure SSL certificates in nginx
- [ ] Update `Strict-Transport-Security` header if needed

### Monitoring & Logging

- [ ] Enable proper logging level (`RUST_LOG=info` or `warn`)
- [ ] Monitor failed login attempts
- [ ] Set up alerts for security events
- [ ] Regular security audits

### Database

- [ ] Ensure database file has proper permissions (600)
- [ ] Regular backups of SQLite database
- [ ] Consider migrating to PostgreSQL for production

### Updates

- [ ] Keep Rust dependencies updated
  ```bash
  cargo update
  cargo audit
  ```

- [ ] Keep npm dependencies updated
  ```bash
  npm audit
  npm update
  ```

## 📝 Security Incident Response

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for a fix before public disclosure

## 🔍 Security Audit Log

### Version 1.1.0 (October 2025)

- ✅ Removed insecure JWT secret fallbacks
- ✅ Added JWT secret length validation
- ✅ Implemented password strength requirements
- ✅ Added timing attack prevention in login
- ✅ Implemented comprehensive input validation
- ✅ Added security headers middleware
- ✅ Added request body size limits
- ✅ Improved bcrypt error handling
- ✅ Added database connection configuration
- ✅ Implemented transaction safety

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Rust Security Guidelines](https://anssi-fr.github.io/rust-guide/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Web Security Checklist](https://github.com/virajkulkarni14/WebDeveloperSecurityChecklist)
