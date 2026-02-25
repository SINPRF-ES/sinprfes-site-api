# Sentinel Journal - Security Hardening

## 2026-02-15 - [Controller Security Standard]
**Learning:** Canonical security pattern for backend controllers requires: 1) mandatory `atorId = req.user?.id` initialization, 2) immediate 401 guard, 3) extraction of `requestId`, and 4) use of `parseUuid` for ID validation. Success and error paths must consistently log `requestId` and `atorId`.
**Action:** Applied this pattern to `push.controller.js`, `reports.controller.js`, `assembleias.controller.js`, and `filiados.controller.js`, removing local `getUserId` helpers and standardizing error responses with `requestId`.

## 2026-02-17 - [UUID Validation Guard]
**Learning:** Malformed UUIDs passed to PostgreSQL queries (e.g., `WHERE id = $1`) cause immediate 500 errors if not validated at the controller layer. Using a central `parseUuid` utility with regex validation prevents these unhandled exceptions and allows returning a clean 400 error.
**Action:** Created `backend/src/utils/parseUuid.js` and integrated it into `assembleias.controller.js` for all UUID parameters.

## 2026-05-25 - [Centralized Authorization Logic]
**Pattern:** Business rules for profile-based access (e.g., "ehPerfilGestao") must be centralized in a shared module (Canon) to prevent drift between Backend and Site.
**Implementation:** Use `Canon.ehPerfilGestao(perfil)` for coarse-grained checks and the `permissions` array for fine-grained UI/API gating.
**Benefit:** Ensures that adding a new administrative role only requires updating one file to maintain system-wide consistency.
