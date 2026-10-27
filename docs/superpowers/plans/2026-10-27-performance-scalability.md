# ReviewRoom Performance, Reliability, and Scale Plan

## Goal

Reduce lag across admin, reviewer, and public form workflows while preserving existing accounts, sessions, reviewer links, forms, submissions, API behavior, and the live database schema. Establish measurements before changing queries or indexes. Work locally first; do not push or deploy without explicit approval.

## Architecture

Keep the current Next.js, Fastify, Prisma, and MySQL/MariaDB architecture. Improve measured query plans, bounded data access, request behavior, and operational visibility before considering caches, queues, or additional services. Treat every organization boundary and existing public/reviewer token as a compatibility and security invariant.

## Tech Stack

Next.js, Fastify, Prisma with the MariaDB adapter, MySQL/MariaDB, the repository's existing test/typecheck/lint/build scripts, and a local-only representative benchmark dataset.

## Global Constraints

- Do not use production data for load tests. Generate synthetic records locally.
- Do not change live data or apply production migrations as part of this plan.
- Preserve old application compatibility: start with additive indexes and backward-compatible query/API changes.
- Do not add caching for private reviewer responses or submissions without a tenant/session isolation design and invalidation tests.
- Keep all result sets bounded and deterministically ordered.
- Record a recoverable database backup and migration/recovery procedure before any later production schema change.

## Plan

### 1. Establish a reproducible baseline

- Record runtime and database versions, pool configuration (`DATABASE_CONNECTION_LIMIT` currently defaults to 10), hosting limits, and existing migration state without exposing secrets.
- Create a synthetic local dataset covering multiple organizations, 50+ reviewers per representative workspace, thousands of people/targets, many forms, and 10,000–50,000 submissions. Include archived rows, unassigned targets, multiple groups, and English/French/Arabic names. Never copy production personal data.
- Measure API p50/p95/p99 latency, throughput, error rate, SQL query count/duration, rows examined, connection-pool wait/saturation, memory, and event-loop delay.
- Measure page load and interaction latency for admin overview, people, team/assignments, forms, submissions, reviewer overview/queue/submissions, and public form submission at desktop and mobile sizes.
- Capture baseline results and dataset-generation instructions so later comparisons are repeatable.

### 2. Profile and fix database hot paths

- Capture slow query samples and `EXPLAIN`/`EXPLAIN ANALYZE` plans for overview/progress, reviewer workload, people search, assignment lists and auto-assignment, submission lists, group totals/history, form totals, and public submission validation.
- Review current compound indexes against real filter, join, and sort shapes. Add only indexes shown to help; avoid duplicate indexes and measure write/storage cost. Candidate areas include organization-scoped status/sort queries, group/member filters, and submission date/form/reviewer filters, but confirm each from query plans before migration.
- Keep index migrations additive and compatible with the current live binary. Test migration duration and locking behavior on a local database snapshot and the hosting database engine/version before proposing production rollout.
- Investigate substring search separately: `contains` commonly produces a leading-wildcard search that a normal B-tree cannot accelerate. Benchmark current behavior before choosing prefix search, a supported full-text index, or a carefully tested search table. Preserve Arabic/French behavior and clearly define whether matching remains substring-based.
- Consolidate duplicate aggregate/count queries only where measurements show repeated work. Preserve the current response contract and exactness first; consider approximate or cached counters only as a separate approved design.

### 3. Bound query work and remove avoidable growth

- Audit every list endpoint and relation include for a hard page-size limit, narrow `select`, stable sort with a unique tie-breaker, and cursor semantics that match the selected sort.
- Ensure dashboards and group/reviewer views use batched aggregates rather than per-row queries; verify query counts stay flat as reviewer count increases.
- Profile auto-assignment under load. If it is a bottleneck, replace per-target writes with bounded batches while preserving organization-level concurrency control, least-loaded assignment behavior, idempotency, and rollback semantics.
- Avoid loading entire submission histories or form/link inventories into browser memory. Keep cursor pagination and add server-side filtering where needed.
- Set request-size, page-size, and concurrency limits consistently; return useful validation errors for limits.

### 4. Reduce repeated application and browser work

- Use request tracing to find duplicate API calls, waterfall fetches, oversized payloads, unnecessary rerenders, and expensive table/modal rendering.
- Deduplicate safe reads and invalidate them after mutations. Any client cache must be scoped to the authenticated user and organization, cleared on account/workspace changes, and tested against reviewer/admin permission boundaries.
- Keep private API responses non-cacheable by shared proxies. Cache only versioned public static assets and explicitly public data.
- Optimize only measured frontend bottlenecks; preserve responsive layouts, RTL/LTR, accessibility, and all existing form behavior.

### 5. Add reliability and security guardrails

- Set and document connection-pool sizing based on the host's total application instances and database connection limit; validate behavior under saturation rather than increasing the limit blindly.
- Add bounded timeouts, safe overload responses, and graceful shutdown. Retry only operations that are demonstrably idempotent; use idempotency protection for writes that clients may retry.
- Add structured metrics for route latency/error rate, slow SQL, pool wait, queue depth if introduced, memory, and event-loop delay. Redact tokens, emails, answers, and other sensitive payloads from logs.
- Verify tenant-scoped authorization in every optimized query and test cross-workspace IDs, reviewer tokens, expired/revoked links, and archived data.
- Keep readiness and liveness distinct: readiness checks required dependencies; liveness should not trigger restart storms during a temporary database slowdown.

### 6. Validate compatibility and release safely

- Run existing unit/integration tests, typecheck, lint, production build, and repository smoke checks. Add focused regression coverage for each query or behavior changed.
- Compare API contracts and behavior against the current production version using fixtures for existing users, assignments, forms, links, sessions, groups, and submissions. Confirm old links and authentication flows remain valid.
- Run local load tests at the representative dataset and concurrency levels; compare against the recorded baseline and check database write latency as well as reads.
- Verify every changed query plan, organization isolation, stable pagination (including equal timestamps/names), group totals, archived filtering, and public submission validation.
- Prepare a staged rollout: backup, schema preflight, additive index migration, deploy-compatible code, health checks, latency/error monitoring, and a documented rollback path. No production action occurs until separately approved.

## Acceptance Gates

- No unbounded list query or reviewer-count-dependent N+1 query remains in the measured workflows.
- On the local representative dataset, common list/progress endpoints meet a directional p95 target of 500 ms or improve materially over baseline; report p50/p95/p99 and database time so the result is interpretable.
- No increase in authorization, validation, or data-integrity failures; existing reviewer links, sessions, published forms, and submissions remain usable.
- Index plans show the intended access path, and measured write latency/storage overhead remain acceptable.
- No production database migration, GitHub push, or deployment occurs without explicit user approval.

## Risks and Decisions to Resolve During Profiling

- Exact dashboard totals and `%term%` search may remain costly at scale; any change to their semantics needs product approval.
- Indexes improve reads but consume storage and add write cost; add them only from measured plans.
- Local performance is directional and cannot certify shared-host capacity. Production rollout requires the actual engine/version, connection limits, backup, and migration-lock characteristics.
- If a single database remains the measured limit after query and index work, evaluate read replicas, asynchronous aggregation, or a managed database only as a later architecture proposal.
