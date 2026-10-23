# ReviewRoom security and deployment readiness audit

**Review date:** 2026-10-23
**Scope:** Current repository, local services, the Hostinger build/package workflow, official Hostinger managed Node.js documentation.
**Boundary:** No production database, Hostinger setting, domain, or GitHub remote was changed. This is a source/configuration review and bounded local verification, not a penetration test or a Hostinger capacity certification.

## Decision

**Do not describe this release as proven ready for high traffic or fully deployment-ready yet.** The local code checks and packaged frontend build pass, and the measured localhost scenarios were healthy. Two release gates remain: the production-mode API did not pass local database readiness with the current local `.env` configuration, and the exact Hostinger plan/runtime/network/database limits could not be inspected. Resolve those in isolated staging before a production cutover.

## Findings (ordered by release impact)

### [High] Production API readiness has not been demonstrated against the deployment database

`apps/api/src/app.ts:38-43` correctly distinguishes liveness from database readiness. `GET /api/v1/health/ready` runs `SELECT 1` and fails when Prisma cannot connect. In the isolated local production-mode start, the first attempt correctly refused to start without `TOKEN_ENCRYPTION_KEY`. With an ephemeral key supplied, liveness returned 200 but readiness failed with Prisma `P2010` using the existing local `.env` database configuration. The API already running on the isolated local test configuration at port 5001 returned healthy readiness for the measured requests.

**Impact:** A live process can answer requests while unable to serve database-backed workflows. The current local production-mode result does not prove that Hostinger's configured `DB_*`/`DATABASE_URL` works.

**Required gate:** In Hostinger staging, set the API secrets and database values in the API app environment, restart the app, and confirm both `GET /health` and `GET /api/v1/health/ready` return 200 repeatedly. Check the runtime logs for the same interval and exercise a read and a write workflow using staging-only data. Do not publish the local DB error output or secrets.

### [High] Hostinger plan fit, forwarded client IP, and capacity are unverified

`apps/api/src/app.ts:25-27` trusts one reverse-proxy hop by default, and `apps/api/src/http/rate-limits.ts:11-17,36-60` applies in-memory limits. This deployment assumes Hostinger presents one managed proxy hop and correctly overwrites or appends `X-Forwarded-For`. A read-only Hostinger account query did not complete, so the exact plan, app slots, CPU/memory/process caps, MySQL connection quota, and ingress proxy chain were unavailable.

**Impact:** If the proxy chain differs, client IP based throttling may identify the wrong address. Per-process counters reset on restart and are not shared between API replicas. A local burst cannot predict the managed plan's throughput or queueing behavior.

**Required gate:** Verify the plan and proxy behavior in Hostinger staging. Confirm the stated two-app topology fits the available app slots; check actual CPU, memory, process, request timeout, database connections and storage quotas. Keep one API process unless shared rate-limit storage/edge enforcement is introduced. Enable Hostinger edge/WAF limits for shared abuse control and verify spoofed forwarded headers cannot bypass throttles.

### [Medium] Database migrations execute in the API build before publish

The `build:hostinger:api` workflow invokes Prisma migration before the API package is built (see `scripts/build-hostinger-api.mjs` and `DEPLOYMENT.md`). This means a deployment build may alter the database even if the later compile/publish/restart phase fails.

**Impact:** A failed release can leave the old app running against a changed schema. This is especially risky for destructive or non-backward-compatible migrations and one-time bootstrap settings.

**Mitigation/release gate:** Take and verify a restorable backup before each production migration; use additive/expand-contract migrations compatible with the currently running version; rehearse on a sanitized staging copy; keep bootstrap disabled except for a fresh initial database and remove its variables immediately after first use. Do not enable deployment until rollback and restore have been rehearsed.

### [Medium] Test coverage does not establish MySQL concurrency or migration safety

The API suite contains 67 tests and the web suite 45 tests. These pass, but inspection shows important domain-policy tests use mocks/unit-level seams. They do not establish behavior under real concurrent MySQL assignment writes, production collation/index behavior, lock contention, migration rollback, or restore correctness.

**Impact:** Races, database-specific differences, and operational migration failures can remain undiscovered despite green unit tests.

**Required gate:** Add or run staging integration/E2E checks for simultaneous assignment changes, idempotent public submissions, tenant isolation, published form versions, invite acceptance, both roles in one browser, and migration plus backup restoration. Use a staging copy, not production data.

### [Low] Direct cross-origin public submissions need an explicit CORS preflight check

`apps/web/src/features/review/review-portal.tsx:39-43` sends an `Idempotency-Key`; `apps/api/src/app.ts:31` does not list that header in `allowedHeaders`. The intended browser flow uses Next's same-origin `/api` rewrite, so it avoids browser CORS preflight. If a browser calls the API hostname directly from `WEB_ORIGIN`, the submission preflight may be denied.

**Impact:** Only direct cross-origin browser API consumers are affected; current same-origin rewrite usage is not.

**Recommendation:** Keep the same-origin rewrite as the supported browser interface. If direct browser-to-API submission is intended, allow `Idempotency-Key` explicitly and verify an OPTIONS preflight from the configured origin in staging.

## Positive controls observed

- API uses exact configured CORS origin, Helmet, disables `x-powered-by`, caps JSON request bodies at 64 KB, and marks API responses no-store (`apps/api/src/app.ts:24-34`).
- Health separates process liveness from database readiness (`apps/api/src/app.ts:36-43`).
- Auth throttling is keyed by normalized account identity plus IP and shared across role-specific login routes; public review limits use an IP plus a hash of the token (`apps/api/src/http/rate-limits.ts:5-9,19-43`). The threshold behavior was exercised locally: eight failed attempts followed by 429; sixty public lookups followed by 429.
- Production configuration requires an encryption key; production remote database connections use verified TLS by default (`apps/api/src/env.ts`).
- Session and role separation, CSRF/origin checks, tenant-scoped queries, Zod validation, safe error responses, and structured request IDs were present in the reviewed implementation.
- Frontend build output is standalone and the Hostinger packaging process includes the generated server, React runtime dependencies, and static assets. The fallback launcher starts that built server directly rather than invoking `next start` against standalone output.
- A fresh dependency audit on 2026-10-23 reported zero known vulnerabilities across the lockfile and zero production-only vulnerabilities. This is a snapshot; rerun before release.

## Verification evidence

- `npm run lint`: passed after excluding the generated `.next-audit` build directory from ESLint and Git.
- `npm run typecheck`: passed for contracts, API, and web.
- `npm test`: passed, API 67/67 and web 45/45.
- `npm audit --json`: 0 total findings (0 high/critical); `npm audit --omit=dev`: 0 findings.
- `npm run build`: passed with `NEXT_DIST_DIR=.next-audit` before the final web-only packaging check.
- `npm run build:hostinger:web`: passed and produced `.next-audit/hostinger/server.js`, bundled React/React DOM runtime dependencies, and `.next/static` assets. A transient webpack cache rename `EPERM` warning appeared during one build; compilation and packaging succeeded. Recheck if it recurs in Hostinger's Linux builder.
- Standalone production web start: started successfully on an isolated local port, selected the Hostinger package, and served the login route. After the bounded load run, the temporary process was stopped.
- Bounded local traffic, concurrency 24, 120 requests per scenario, no unexpected statuses: API readiness (200 ×120; ~807 req/s; p50 13.8 ms; p95 83.9 ms); invalid public review lookup (expected 404 ×120; ~1295 req/s; p50 13.9 ms; p95 38.3 ms); standalone web login page (200 ×120; ~290 req/s; p50 57.4 ms; p95 186.5 ms). This is a short localhost smoke burst, not a soak test or Hostinger capacity result.
- Rate-limit boundary checks: auth 401 ×8 then 429 ×1; public read 404 ×60 then 429 ×1. Tests used only local services and synthetic invalid identities/tokens.
- No live Hostinger deploy, migration, settings change, DNS action, or GitHub push was performed.

## Hostinger release checklist

1. Confirm the exact managed Node.js plan supports two Node apps, the selected Node version, root/workspace build behavior, memory/process budget, and MySQL connection budget.
2. Confirm API `PORT` binding, app-to-app URL reachability, forwarded client-IP behavior, HTTPS, CORS/Origin/CSRF, cookies, and the production `API_INTERNAL_URL` rewrite in staging.
3. Keep database pool size within the total MySQL connection quota with headroom for both app maintenance and phpMyAdmin; the API pool defaults to 10 per process (`apps/api/src/db/client.ts:5-13`).
4. Rehearse the exact migration and a restore from backup on staging. Review generated migration SQL before production.
5. Run both-role login, reviewer access isolation, assignment changes, invite acceptance, form publish, public submission/idempotency, pagination, and health checks end to end.
6. Run representative sustained and burst traffic on staging while recording p50/p95/p99, 5xx/timeouts, CPU/memory/process count, and active DB connections. Set explicit acceptance limits from the subscribed plan before testing.
7. Only then schedule a controlled production cutover with backup verification and a rollback owner/runbook.

## Official platform references

- [Hostinger managed Node.js limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/)
- [Deploy a Node.js website on Hostinger](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger Node.js hosting options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/)

Hostinger limits and supported options can change; verify the current account plan and deployment screen before a release.
