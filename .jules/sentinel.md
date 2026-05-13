# Sentinel Journal - Security Hardening

## 2025-05-15 - [Security Hardening & Exposed Secrets]
**Vulnerability:** Found `google.json` (Service Account Key) committed to the repository and missing rate limiting on sensitive authentication routes.
**Learning:** Even when security-focused dependencies like `express-rate-limit` are present in `package.json`, they might not be applied to all critical paths (like login or password reset). Additionally, critical infrastructure like `trust proxy` must be verified when implementing IP-based rate limiting.
**Prevention:** Always use `.gitignore` for JSON key files and environment variables for secrets. Ensure a baseline of security headers (standard in `helmet`) and rate limiting is applied to all public-facing and sensitive endpoints.

## 2025-05-20 - [XSS Mitigation in Vanilla JS Dashboard]
**Vulnerability:** Extensive use of `innerHTML` with template strings containing user-provided data (names, CPFs, etc.) in the filiados management modules.
**Learning:** In a Vanilla JS application using client-side rendering, it's easy to overlook sanitization when building complex HTML structures in JS. A centralized `escapeHTML` utility is essential.
**Prevention:** Always escape user-controlled variables when using `innerHTML`. Prefer `textContent` for simple text updates, and use a robust escaping helper for template strings.

## 2026-02-15 - [Controller Security Standard]
**Learning:** Canonical security pattern for backend controllers requires: 1) mandatory `atorId = req.user?.id` initialization, 2) immediate 401 guard, 3) extraction of `requestId`, and 4) use of `parseUuid` for ID validation. Success and error paths must consistently log `requestId` and `atorId`.
**Action:** Applied this pattern to `push.controller.js`, `reports.controller.js`, `assembleias.controller.js`, and `filiados.controller.js`, removing local `getUserId` helpers and standardizing error responses with `requestId`.

## 2026-02-17 - [UUID Validation Guard]
**Learning:** Malformed UUIDs passed to PostgreSQL queries (e.g., `WHERE id = $1`) cause immediate 500 errors if not validated at the controller layer. Using a central `parseUuid` utility with regex validation prevents these unhandled exceptions and allows returning a clean 400 error.
**Action:** Created `backend/src/utils/parseUuid.js` and integrated it into `assembleias.controller.js` for all UUID parameters.

## 2026-02-26 - [Global Request Tracing]
**Pattern:** Every controller method must initialize `requestId = req.requestId || uuidv4()` and include it in all log entries and JSON responses.
**Benefit:** Enables seamless cross-referencing between client-side errors and backend logs in distributed environments (Railway/Cloud).
**Implementation:** Standardized in `auth.controller.js` and `pushCampaign.controller.js`.

## 2026-03-03 - [Database Error Masking]
**Pattern:** To prevent sensitive database schema or row details from leaking to the client, all controllers interacting with the database must implement or use a `handleDbError` utility.
**Implementation:** This utility maps PostgreSQL constraint violations (e.g., 23505 - unique key, 23514 - check constraint) to safe, generic 422 or 409 responses, while logging full details with `requestId` on the server.
**Benefit:** Protects internal data structures while providing actionable, non-sensitive feedback to the user. Standardized in `repasse.controller.js` and `noticias.controller.js`.

## 2026-03-07 - [Fixed Layout Content Overlap]
**Vulnerability:** Content being hidden under fixed headers when using `anchor` navigation or initial page load.
**Learning:** Implementing `position: fixed` on headers requires dynamic offset calculation to maintain layout integrity across different viewports. Relying solely on CSS `margin-top` often leads to "white gaps" or overlap on mobile.
**Prevention:** Use a combination of CSS `scroll-margin-top` for anchor links and dynamic JavaScript to apply `padding-top` to the body or main container based on the actual header height.

## 2026-05-25 - [Centralized Authorization Logic]
**Pattern:** Business rules for profile-based access (e.g., "ehPerfilGestao") must be centralized in a shared module (Canon) to prevent drift between Backend and Site.
**Implementation:** Use `Canon.ehPerfilGestao(perfil)` for coarse-grained checks and the `permissions` array for fine-grained UI/API gating.
**Benefit:** Ensures that adding a new administrative role only requires updating one file to maintain system-wide consistency.

## 2026-06-05 - [Rate Limiting for Resource-Intensive Queries]
**Vulnerability:** Resource-intensive endpoints (like Google Drive listings in `/api/publicacoes`) were unprotected by rate limiters, making them targets for DoS or API quota exhaustion.
**Learning:** Rate limiting should not be reserved only for "commands" (POST/PUT/DELETE). Queries that proxy external APIs or perform heavy processing should also be protected.
**Prevention:** Use `stateLimiter` (or similar) for GET routes that involve external service calls or high resource usage.

## 2026-05-13 - [Rate Limiting for Logging Endpoints]
**Vulnerability:** The `/api/diagnostico/log` endpoint was unprotected by rate limiting, allowing authenticated users to flood the system logs (DoS risk).
**Learning:** Diagnostic and logging routes are often overlooked when applying rate limits compared to auth or intensive resource routes.
**Prevention:** Always apply `diagnosticLimiter` or similar middleware to all diagnostic routes, even those that are authenticated.
