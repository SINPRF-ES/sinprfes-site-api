# Sentinel Journal - FENAPRF Security Insights

- **Sensitive Log Sanitization**: Never log sensitive fields such as `password_hash` or full CPFs on the mobile client. Even if masked, these fields pose a risk of exposure in logs.
- **Unified UUID Validation**: Standardized on `parseUuid` from `utils/format.js` for all backend controller parameters to ensure type safety and prevent injection/malformed ID errors.
- **Actor ID Pattern**: Mandatory initialization of `atorId = req.user?.id` at the top of controller `try` blocks with a 401 check. This ensures persistent auditing and prevents crashes.
- **Defense in Depth Headers**: Implemented manual security headers in `app.js` (HSTS, CSP, Referrer-Policy) as a fallback/complement to standard security middlewares.
- **Controller Security Standard**: Standardized the use of `atorId = req.user?.id` and explicit 401 guards at the top of controller functions to ensure session reliability and prevent unauthenticated access to business logic.
- **Traceability in Logs**: Enforced including `userId: atorId` and `requestId` in all controller log entries to provide a complete audit trail for system operations.
- **Mandatory Shared Drive Flags**: Standardized all Google Drive API calls to include `supportsAllDrives: true` and list operations to include `includeItemsFromAllDrives: true` to ensure consistent behavior across all drive types.
