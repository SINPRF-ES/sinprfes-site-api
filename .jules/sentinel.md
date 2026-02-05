## 2025-05-15 - [Security Hardening & Exposed Secrets]
**Vulnerability:** Found `google.json` (Service Account Key) committed to the repository and missing rate limiting on sensitive authentication routes.
**Learning:** Even when security-focused dependencies like `express-rate-limit` are present in `package.json`, they might not be applied to all critical paths (like login or password reset). Additionally, critical infrastructure like `trust proxy` must be verified when implementing IP-based rate limiting.
**Prevention:** Always use `.gitignore` for JSON key files and environment variables for secrets. Ensure a baseline of security headers (standard in `helmet`) and rate limiting is applied to all public-facing and sensitive endpoints.

## 2025-05-20 - [XSS Mitigation in Vanilla JS Dashboard]
**Vulnerability:** Extensive use of `innerHTML` with template strings containing user-provided data (names, CPFs, etc.) in the filiados management modules.
**Learning:** In a Vanilla JS application using client-side rendering, it's easy to overlook sanitization when building complex HTML structures in JS. A centralized `escapeHTML` utility is essential.
**Prevention:** Always escape user-controlled variables when using `innerHTML`. Prefer `textContent` for simple text updates, and use a robust escaping helper for template strings.
