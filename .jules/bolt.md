# Bolt's Performance Journal ⚡

## 2026-01-26 - [Waterfall Optimization in Assembly Service]
**Learning:** Identifying and parallelizing independent database queries in complex service methods (like `buscarEstadoCompleto`) can significantly reduce latency from the sum of all roundtrips to the latency of the single slowest query. Additionally, fetching a count via `COUNT(*)` is redundant if the full list of items is already being fetched for the same context; using `.length` on the result saves a DB trip.
**Action:** Always look for sequential `await` calls that don't depend on each other's results and group them into `Promise.all`. Check if counts are already available in fetched collections.

## 2026-01-26 - [Fragile Mocks and Service Refactoring]
**Learning:** High-level integration tests using `mockResolvedValueOnce` (like `assembleias.full_flow.test.js`) are extremely sensitive to internal implementation changes. Even performance optimizations that don't change logic but reorder or add/remove DB calls will break these tests.
**Action:** When optimizing, verify if existing tests use strict mock sequencing and be prepared to update mock expectations if the optimization is necessary.
