# Sentinel Journal - FENAPRF Security Insights

- **Sensitive Log Sanitization**: Never log sensitive fields such as `password_hash` or full CPFs on the mobile client. Even if masked, these fields pose a risk of exposure in logs.
- **Unified UUID Validation**: Standardized on `parseUuid` from `utils/format.js` for all backend controller parameters to ensure type safety and prevent injection/malformed ID errors.
- **Actor ID Pattern**: Mandatory initialization of `atorId = req.user?.id` at the top of controller `try` blocks with a 401 check. This ensures persistent auditing and prevents crashes.
- **Defense in Depth Headers**: Implemented manual security headers in `app.js` (HSTS, CSP, Referrer-Policy) as a fallback/complement to standard security middlewares.
