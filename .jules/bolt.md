# Bolt's Performance Journal ⚡

## 2026-01-26 - [Waterfall Optimization in Assembly Service]
**Learning:** Identifying and parallelizing independent database queries in complex service methods (like `buscarEstadoCompleto`) can significantly reduce latency from the sum of all roundtrips to the latency of the single slowest query. Additionally, fetching a count via `COUNT(*)` is redundant if the full list of items is already being fetched for the same context; using `.length` on the result saves a DB trip.
**Action:** Always look for sequential `await` calls that don't depend on each other's results and group them into `Promise.all`. Check if counts are already available in fetched collections.

## 2026-01-26 - [Fragile Mocks and Service Refactoring]
**Learning:** High-level integration tests using `mockResolvedValueOnce` (like `assembleias.full_flow.test.js`) are extremely sensitive to internal implementation changes. Even performance optimizations that don't change logic but reorder or add/remove DB calls will break these tests.
**Action:** When optimizing, verify if existing tests use strict mock sequencing and be prepared to update mock expectations if the optimization is necessary.

## 2026-01-27 - [Batching and N+1 Resolution in Reports and Votations]
**Learning:** For reports or list views requiring detailed data for each item (like quorums or voting results), replacing loops of queries with single batch queries using `ANY($1)` and grouping in memory significantly reduces overhead. In `criarVotacao`, batching multiple `INSERT` statements into one multi-row `VALUES` query reduces roundtrips from 1+N to 2.
**Action:** Always prefer batch fetches/inserts over per-item loop queries. Use `.filter` or Map grouping in memory to re-associate data.

## 2026-01-29 - [Optimization of Assembly Check-in Broadcast]
**Learning:** High-frequency endpoints like `checkin` (during the start of an event) should avoid fetching the full application state if only a small subset is needed for the real-time broadcast. In this codebase, `buscarEstadoCompleto` was a major bottleneck because it fetched proposals and speaker lists unnecessarily.
**Action:** Always prefer targeted service calls over "get everything" state functions in real-time event handlers. Ensure WebSocket payloads match exactly what the client expects to avoid broken "live" features.

## 2026-02-03 - [FlatList Search Optimization]
**Learning:** Calling expensive normalization functions (`normalizeText`, `onlyDigits`) inside a `filter` that runs on every keystroke (O(N) * M) causes significant UI lag in large lists. Memoizing the list items (`React.memo`) is insufficient if callbacks passed to them (`onEdit`, `renderItem`) are recreated on every render.
**Action:** Pre-calculate normalized search fields once when data is fetched/processed. Stabilize callbacks with `useCallback`. Tune `FlatList` props (`windowSize`, `removeClippedSubviews`) to manage memory and render pressure.

## 2026-02-15 - [Explicit String Normalization]
**Learning:** Type mismatches in email service providers can cause silent failures or obscure errors. Ensuring all dynamic metadata (like target emails or phone numbers) are explicitly cast to `String()` before manipulation or transmission prevents runtime crashes.
**Action:** Added explicit `String()` casts to `extrairEmailDestino` in `email.service.js`, and standardized casting in `push.service.js` and `enviarEmailBase`.

## 2026-02-17 - [Database Constraint Error Mapping]
**Learning:** PostgreSQL constraint violations (e.g., unique index, foreign key) or schema errors (missing column) should be caught and mapped to HTTP 400 (Client Error) instead of 500. This prevents "internal server error" noise for expected validation failures at the DB level.
**Action:** Implemented `handleDbError` in `filiados.controller.js` to catch codes starting with '23' or '42703' and return 400.

## 2026-02-23 - [Controller Media Grouping Optimization]
**Learning:** Nested loops ($O(N \times M)$) in controllers when associating related entities (like news and media) are a hidden performance tax that grows with data size. Using a `Map` to pre-group related items reduces complexity to $O(N+M)$ and is a consistent pattern for high-performance Node.js backends.
**Action:** Always scan controllers for `.filter()` or `.find()` calls inside a `.forEach()` or `.map()` when processing database results. Replace them with `Map`-based aggregation.

## 2026-02-25 - [Sequential DB Queries and Nested Lookups in Repasse Service]
**Learning:** Sequential `await` calls for independent database queries and using `.find()` inside nested loops (creating O(N * M) complexity) significantly slow down complex data aggregation functions like `getRepasseAno`. Parallelizing queries with `Promise.all` and pre-indexing datasets with `Map` can reduce execution time by an order of magnitude as data grows.
**Action:** Always scan for loops containing `.find()` or `.filter()` on other datasets. Replace them with `Map`-based lookups and use `Promise.all` for independent DB operations.

## 2026-03-09 - [Hierarchical Parallelization in Aggregated Reports]
**Learning:** In complex reporting services, sequential "waterfalls" often hide within sub-functions. Parallelizing high-level functions (like `buscarDadosGlobal`) is only half the battle if their dependencies (like `buscarDadosAgregados`) still contain internal sequential loops. Converting sequential `for` loops that perform I/O into `Promise.all(map(...))` is the single most effective way to handle batch data fetching in Node.js.
**Action:** When optimizing a service method, recursively check its internal dependencies for hidden sequential I/O. Use hierarchical parallelization to ensure that both the orchestrator and the worker functions are non-blocking.
