# Sentinel Journal - Security Hardening

## 2026-02-15 - [Controller Security Standard]
**Learning:** Canonical security pattern for backend controllers requires: 1) mandatory `atorId = req.user?.id` initialization, 2) immediate 401 guard, 3) extraction of `requestId`, and 4) use of `parseUuid` for ID validation. Success and error paths must consistently log `requestId` and `atorId`.
**Action:** Applied this pattern to `push.controller.js`, removing local `getUserId` helpers and standardizing error responses with `requestId`.
