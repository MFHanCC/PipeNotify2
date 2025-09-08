# Security Guidelines for Pipedrive → Google Chat Integration

This document provides a structured set of security requirements and best practices tailored for the Pipedrive → Google Chat (Dealbot-style) integration using Railway backend and Vercel frontend architecture. By adhering to these guidelines, we ensure a resilient, maintainable, and compliant application.

---

## 1. Security Principles

1. **Security by Design**
   - Embed security at every phase: design, implementation, testing, and deployment.
2. **Least Privilege**
   - Grant services, users, and components only the permissions needed to perform their tasks.
3. **Defense in Depth**
   - Layer security controls (network, application, data) so that if one fails, others still protect the system.
4. **Fail Securely**
   - On errors or exceptions, avoid leaking sensitive data; fail closed by default.
5. **Keep Security Simple**
   - Favor clear, maintainable security controls over complex solutions.
6. **Secure Defaults**
   - Ship with the most restrictive configuration; require explicit opt-in for relaxed settings.

---

## 2. Authentication &amp; Access Control

### 2.1 Tenant &amp; User Authentication
- **MVP**: Use Pipedrive API token for user identity; **Phase 2**: OAuth 2.0 with authorization code flow.
- Store tokens encrypted at rest; rotate tokens on credential leaks or revocation.
- Implement multi-factor authentication (MFA) for portal admins (Phase 2).

### 2.2 Session &amp; Token Management
- If using JWTs: sign with RS256 or HS256, validate `exp`, `iss`, `aud`; reject `none` algorithm.
- Enforce short expiration (e.g., 15 minutes access, refresh tokens with prudent rotation).
- Revoke sessions on logout or suspicious activity.

### 2.3 Role-Based Access Control (RBAC)
- Define roles: **Admin**, **User**, **Read-Only**, **Support**.
- Enforce authorization server-side on every API endpoint.
- Apply PostgreSQL Row-Level Security (RLS) or separate schemas per tenant to isolate data.

### 2.4 Least-Privilege Service Accounts
- Database user: only CRUD privileges on specific schemas.
- Job queue user: only access to BullMQ/RQ queues.
- Railway PaaS user: minimal permission to deploy and read logs.
- Vercel deployment: read-only access to build artifacts, no sensitive data.

---

## 3. Input Handling &amp; Processing

### 3.1 Webhook Endpoints
- Validate Pipedrive webhook `X-Pipedrive-Signature` using HMAC SHA256 and shared secret.
- Return `2xx` only after signature and payload schema validation.

### 3.2 API Inputs
- Enforce JSON schema validation (e.g., **AJV** for Node.js, **Pydantic** for FastAPI).
- Reject unexpected properties and deeply nested objects to prevent DoS via overly large payloads.

### 3.3 Prevent Injection Attacks
- Use parameterized queries or ORM (TypeORM, Prisma, SQLAlchemy).
- Escape or sanitize all user-provided strings.

### 3.4 Prevent XSS &amp; Template Injection
- On front end (React): avoid `dangerouslySetInnerHTML` unless content is sanitized.
- On server: escape Mustache/Handlebars/EJS template variables.

### 3.5 File Uploads
- If supporting uploads (avatars, logos):
  - Validate MIME type, extension, and magic bytes.
  - Enforce size limits (e.g., 5 MB).
  - Store outside webroot or in object storage (S3/GCS) with presigned URLs.

---

## 4. Data Protection &amp; Privacy

### 4.1 Encryption
- **In Transit**: TLS 1.2+ for all endpoints (frontend, APIs, database connections).
- **At Rest**:
  - PostgreSQL TDE or disk encryption provided by Railway.
  - Encrypt Pipedrive tokens, webhook secrets, and any PII with AES-256.

### 4.2 Secret Management
- Store backend secrets in Railway environment variables (encrypted at rest).
- Store frontend environment variables in Vercel dashboard (non-sensitive only).
- Do not commit secrets to source control or logs.

### 4.3 Sensitive Data Handling
- Mask PII in logs (e.g., email addresses → `jo***@example.com`).
- Retain delivery logs for 90 days; purge older records automatically.
- Implement data deletion workflows to comply with GDPR/CCPA ("right to be forgotten").

### 4.4 Database Security
- Use dedicated database credentials per environment (dev/test/prod).
- Enforce least-privilege roles and RLS for tenant isolation.
- Regularly back up encrypted snapshots via Railway's automated backup system.

---

## 5. API &amp; Service Security

### 5.1 HTTPS Enforcement
- Redirect all HTTP traffic to HTTPS on both Railway and Vercel.
- HSTS header with `max-age=31536000; includeSubDomains; preload`.

### 5.2 Rate Limiting &amp; Throttling
- Apply per-tenant and global rate limits (e.g., 100 requests/minute).
- Protect login and webhook endpoints from brute-force attacks.

### 5.3 CORS &amp; CSRF Protection
- **CORS**: Railway backend allows only Vercel frontend origins:
```javascript
const allowedOrigins = [
  'http://localhost:3000', // Development
  'https://your-app.vercel.app', // Production Vercel
  process.env.FRONTEND_URL, // Dynamic production URL
];
```
- **CSRF**: use same-site cookies (`SameSite=Lax` or `Strict`) and anti-CSRF tokens on state-changing endpoints.

### 5.4 Payload Minimization
- Only include necessary fields in responses (no excessive data exposure).

### 5.5 API Versioning
- Prefix endpoints with `/v1/` and plan deprecation cycles.

---

## 6. Web Application Security Hygiene

### 6.1 Security Headers
- **Backend (Railway)**: Configure security headers via Express.js middleware.
- **Frontend (Vercel)**: Configure via `vercel.json` or Next.js security headers:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "no-referrer-when-downgrade"
        }
      ]
    }
  ]
}
```

### 6.2 Secure Cookies
- Set `HttpOnly`, `Secure`, and appropriate `SameSite` on session cookies or JWT cookies.

### 6.3 Clickjacking &amp; SRI
- Use Subresource Integrity (SRI) for third-party scripts.
- Ensure Google Chat webhook URLs are never exposed client-side.

---

## 7. Infrastructure &amp; Configuration Management

### 7.1 Server Hardening
- **Railway environment**: Managed platform security; disable SSH access; restrict inbound ports to 443.
- **Vercel environment**: Static hosting with automatic security updates; no server-side access required.
- Disable default database users and sample databases.

### 7.2 Software Updates
- Automate dependency updates via Dependabot or Renovate.
- Schedule monthly audits and patch vulnerable components immediately.
- Railway: Automatic platform security updates.
- Vercel: Automatic CDN and edge security updates.

### 7.3 File &amp; Configuration Permissions
- **Railway**: Application runs under non-root user in containerized environment.
- **Vercel**: Static files served with appropriate permissions.
- Use environment variables for configuration; avoid config files with secrets in code repo.

### 7.4 Disable Debug in Production
- Ensure `NODE_ENV=production` on Railway backend.
- Ensure React production build on Vercel frontend.
- Turn off verbose stack traces and interactive shells.

---

## 8. Dependency Management

- Maintain `package-lock.json` for both frontend and backend to ensure deterministic installs.
- Use SCA tools (e.g., Snyk, Dependabot) to scan for known vulnerabilities.
- Limit dependencies to actively maintained libraries with good security track records.
- **Railway**: Backend dependency scanning in deployment pipeline.
- **Vercel**: Frontend dependency analysis during build process.

---

## 9. CI/CD &amp; DevOps Security

- Store CI secrets (Railway token, Vercel token) in GitHub Actions Secrets.
- Enforce branch protection, code review, and signed commits.
- Run security linting and static analysis (e.g., ESLint, Bandit) on every PR.
- Automate tests for input validation, authorization, and regression security tests.
- **Deployment Security**:
  - Railway: Secure deployment via Railway CLI with token authentication.
  - Vercel: Secure deployment via Vercel CLI with token authentication.

---

## 10. Monitoring &amp; Incident Response

- Integrate Sentry for error monitoring on both Railway backend and Vercel frontend.
- Redact sensitive data in Sentry reports.
- Implement alerting for anomalous rates of errors or failed auth attempts.
- Define an incident response plan: identification, containment, eradication, recovery, and post-mortem.
- **Platform-Specific Monitoring**:
  - Railway: Platform metrics and logs via Railway dashboard.
  - Vercel: Analytics and performance metrics via Vercel dashboard.

---

## 11. Architecture-Specific Security Considerations

### 11.1 Railway Backend Security
- Environment variable encryption at rest
- Managed database with automated security patches
- Network isolation between services
- Automatic SSL certificate management
- Container isolation and security scanning

### 11.2 Vercel Frontend Security
- Automatic HTTPS with managed certificates
- Edge network DDoS protection
- Static file serving with security headers
- Build-time security scanning
- Content Security Policy enforcement

### 11.3 Inter-Service Communication
- Railway backend → Vercel frontend: HTTPS only with CORS validation
- Frontend → Backend API: Authentication token validation on every request
- No direct database access from frontend
- All sensitive operations require backend API validation

---

## 12. Appendix: Checklist Before Production Release

- [ ] Railway backend enforces HTTPS and proper auth
- [ ] Vercel frontend uses HTTPS and secure headers
- [ ] Webhook signature validation is implemented
- [ ] Secrets are stored in Railway environment variables (backend) and Vercel environment variables (frontend, non-sensitive only)
- [ ] CSP and security headers configured on both platforms
- [ ] Database RLS or schema isolation in place
- [ ] Rate limiting configured on sensitive endpoints
- [ ] CORS properly configured to allow only Vercel origins
- [ ] CI/CD pipelines include security scans for both frontend and backend
- [ ] Backup and retention policies set via Railway
- [ ] Incident response playbook documented
- [ ] Sentry configured for both Railway backend and Vercel frontend
- [ ] Environment separation properly implemented (development vs production)

---

Adhering to these guidelines will help maintain a secure, reliable, and compliant integration between Pipedrive and Google Chat using the Railway + Vercel architecture. The split hosting approach requires careful attention to CORS configuration, environment variable management, and cross-service authentication, but provides optimal performance and security characteristics for each component. Regular reviews and updates to this document are recommended as the project evolves and new threats emerge.