# Bolt Journal - Performance & Efficiency

## 2026-02-15 - [Explicit String Normalization]
**Learning:** Type mismatches in email service providers can cause silent failures or obscure errors. Ensuring all dynamic metadata (like target emails or phone numbers) are explicitly cast to `String()` before manipulation or transmission prevents runtime crashes.
**Action:** Added explicit `String()` casts to `extrairEmailDestino` in `email.service.js`.
