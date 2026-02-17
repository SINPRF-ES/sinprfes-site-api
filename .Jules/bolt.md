# Bolt Journal - Performance & Efficiency

## 2026-02-15 - [Explicit String Normalization]
**Learning:** Type mismatches in email service providers can cause silent failures or obscure errors. Ensuring all dynamic metadata (like target emails or phone numbers) are explicitly cast to `String()` before manipulation or transmission prevents runtime crashes.
**Action:** Added explicit `String()` casts to `extrairEmailDestino` in `email.service.js`, and standardized casting in `push.service.js` and `enviarEmailBase`.

## 2026-02-17 - [Database Constraint Error Mapping]
**Learning:** PostgreSQL constraint violations (e.g., unique index, foreign key) or schema errors (missing column) should be caught and mapped to HTTP 400 (Client Error) instead of 500. This prevents "internal server error" noise for expected validation failures at the DB level.
**Action:** Implemented `handleDbError` in `filiados.controller.js` to catch codes starting with '23' or '42703' and return 400.
