## 2025-05-15 - [Security Hardening & Exposed Secrets]
**Vulnerability:** Found `google.json` (Service Account Key) committed to the repository and missing rate limiting on sensitive authentication routes.
**Learning:** Even when security-focused dependencies like `express-rate-limit` are present in `package.json`, they might not be applied to all critical paths (like login or password reset). Additionally, critical infrastructure like `trust proxy` must be verified when implementing IP-based rate limiting.
**Prevention:** Always use `.gitignore` for JSON key files and environment variables for secrets. Ensure a baseline of security headers (standard in `helmet`) and rate limiting is applied to all public-facing and sensitive endpoints.
