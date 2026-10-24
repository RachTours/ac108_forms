# ReviewRoom Hostinger Deployment Readiness Audit

**Goal:** Assess and improve release safety and Hostinger compatibility without production changes.
**Architecture reviewed:** Next.js 16/React, Express 5, TypeScript/Zod contracts, Prisma 7 MariaDB adapter, MySQL, Hostinger managed Node.js.
**Boundary:** No production DB writes, deploy, DNS/settings changes, GitHub push, or staging/production traffic test. Local tests only.

## Baseline and source review

- [x] Record initial git state and preserve existing user changes.
- [x] Inventory runtime, packages, scripts, deployment roots/artifacts, environment keys, API route groups, database models/migrations, auth, CSRF, rate limits, health checks, proxy configuration and local listeners.
- [x] Trace auth/session separation, tenant/role scopes, validation, idempotency, logging, error boundaries, graceful shutdown, pool sizing, CSP/security headers, and standalone package contents.
- [x] Review Hostinger documentation and compare deployment assumptions.
- [x] Record prioritized findings and evidence in [security_best_practices_report.md](../../../security_best_practices_report.md).

## Changes made

- [x] Removed redundant effect-time `setLoading(true)` that failed lint.
- [x] Added standalone entry discovery/start scripts and tests; changed the web workspace start script to run the built standalone server directly.
- [x] Made Hostinger packaging honor `NEXT_DIST_DIR`.
- [x] Aligned safe local defaults to web 5000, API 5001, isolated local MySQL 5307 without editing `.env`.
- [x] Excluded temporary audit output from lint and Git.
- [x] Updated local/deployment documentation with current test evidence and constraints.
- [x] Corrected the intended deployment target back to Hostinger, removed the unrelated Heroku-only runner/configuration, selected Node.js 22.x as the Hostinger runtime, and aligned CI/local URL examples.
- [x] Standardized both Hostinger Node.js websites on repository root `./`; documented web standalone output/entry under `apps/web/.next/hostinger` so paths match the root shown in the Hostinger UI.
- [x] Improved the public review target header: a single assigned target is displayed as compact read-only context, while multiple targets retain a labeled selector; made the review/privacy tags and form field spacing clearer.

## Verification

- [x] Re-ran full root `npm run lint`, `npm run typecheck`, and `npm test` after the Hostinger target correction and public form UX changes.
- [x] Web tests, TypeScript check and ESLint passed after the public review change: 47/47 tests.
- [x] API tests passed after removing Heroku-only database URL support: 67/67 tests.
- [x] `npm audit --json` and `npm audit --omit=dev`: zero known findings on 2026-10-23.
- [x] Re-ran the Hostinger web package build with an isolated `NEXT_DIST_DIR`; verified packaged `server.js`, React, React DOM, and Next static assets.
- [x] Re-ran the full production build with an isolated output directory. A local production web server served `/admin/login` and the annotated `/r/:token` page with HTTP 200; the public page rendered the compact assigned target and omitted the old selector.
- [x] Standalone production web launcher started successfully and served login UI.
- [x] Bounded local load and rate-limit boundary checks passed; results and workload are documented in the report. This is not a high-traffic certification.
- [x] Rechecked readiness: local API on the isolated DB passed; production-mode API using existing local `.env` passed liveness but failed DB readiness with Prisma `P2010`. Do not treat production-shaped DB readiness as passed.

## Incomplete release gates

- [ ] Confirm exact Hostinger plan/app slots, resource and DB quotas, request timeout, proxy chain/client-IP behavior, and staging runtime settings. Account-level query did not complete.
- [ ] Confirm Hostinger staging API DB readiness with production-shaped env and run staging read/write checks.
- [ ] Rehearse migrations, backup restore, failed deployment rollback, and bootstrap cleanup on staging.
- [ ] Run MySQL integration/concurrency and browser E2E workflows against staging.
- [ ] Run a sustained/representative plan-sized traffic test and capture p50/p95/p99, errors/timeouts, CPU/memory/processes and DB connections.
- [ ] Production cutover requires separately authorized release after all above gates pass.

## Final record

See [deployment-readiness-review.md](../../deployment-readiness-review.md) for the concise decision and [security_best_practices_report.md](../../../security_best_practices_report.md) for evidence, impacts, and mitigations. Production, GitHub, DNS, Hostinger settings, and production data were left unchanged.
