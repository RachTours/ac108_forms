# ReviewRoom deployment readiness review

**Reviewed:** 2026-10-22  
**Scope:** repository configuration and code, plus local verification. No production host, traffic history, load test, or external edge configuration was available.

## Executive summary

ReviewRoom has a reasonable foundation for a small student review workspace: session tokens are hashed, session cookies are HttpOnly/SameSite and Secure in production, mutations require CSRF/origin checks, role and organization checks run in Express, request bodies and several list queries are bounded, and MySQL indexes cover common tenant-scoped lookups. The application builds and its current API/web tests pass.

**High-traffic capacity and production stability are not yet demonstrated.** The main scale constraint visible in code is the in-memory API rate limiter, which does not coordinate across replicas. Each API process opens a configurable MariaDB pool (default 10). There is no representative load test, performance telemetry, alerting configuration, or production deployment definition in this repository. Do not treat build/test results as proof of a traffic capacity.

## Findings

### MEDIUM — Rate limits are per API process

**Evidence:** [rate-limits.ts](</C:/Users/Mo/Desktop/udemy enroller/enroll_ex/apps/api/src/http/rate-limits.ts:11>) uses `express-rate-limit` without a shared store; [app.ts](</C:/Users/Mo/Desktop/udemy enroller/enroll_ex/apps/api/src/app.ts:31>) mounts it across the API. The README correctly documents that counters are per process.

**Impact:** A client can receive a fresh quota on each replica, and load-balancer routing can make authentication/public submission limits inconsistent. Restarting a process also clears its counters.

**Recommendation:** Keep the current in-process limit for a single API instance. For multiple instances, enforce shared limits at the existing gateway/load balancer (no Redis required), with tighter policies for login, token acceptance, and public submissions. Confirm trusted proxy configuration so IP-based limits see the real client address.

### MEDIUM — High-traffic capacity has not been measured

**Evidence:** There are unit/service tests and health endpoints, but no load-test or monitoring setup found. The API has a liveness endpoint and a MySQL-backed readiness endpoint in [app.ts](</C:/Users/Mo/Desktop/udemy enroller/enroll_ex/apps/api/src/app.ts:32>). Personal server-rendered pages intentionally use `cache: "no-store"` in [api.ts](</C:/Users/Mo/Desktop/udemy enroller/enroll_ex/apps/web/src/lib/api.ts:6>).

**Impact:** Build, typecheck, and unit tests show correctness for covered behavior, not throughput, tail latency, connection saturation, or recovery under load.

**Recommendation:** Before public/high-volume deployment, run a representative 15-reviewer/50-target scenario, then a 3× burst and a 5× short burst. Record p50/p95/p99 API latency, 4xx/5xx/timeouts, web-server CPU/memory, API CPU/memory, MySQL CPU/IO/active connections, and recovery after a process restart. Set an initial service target such as p95 < 500 ms for authenticated reads and < 1 s for submission writes, with < 1% server errors during the sustained scenario; revise from observed needs. Add structured metrics/logging and alerts before increasing traffic.

### MEDIUM — Database connection pool size is fixed per API process

**Evidence:** [client.ts](</C:/Users/Mo/Desktop/udemy enroller/enroll_ex/apps/api/src/db/client.ts:12>) reads `DATABASE_CONNECTION_LIMIT` (default 10).

**Impact:** The API can request roughly `replica count × 10` MySQL connections, excluding migrations, admin tools, and other applications. Adding API replicas may overload MySQL before app CPU becomes a bottleneck; the pool cannot currently be tuned through an environment setting.

**Recommendation:** Budget the MySQL connection ceiling first, then set the pool size per environment. Keep API replica count × pool size below the DB budget with headroom. Check slow-query logs and `EXPLAIN` for the reviewer-board aggregate before adding caching or denormalized counters.

### LOW — A Content Security Policy is not visible in the web configuration

**Evidence:** [next.config.ts](</C:/Users/Mo/Desktop/udemy enroller/enroll_ex/apps/web/next.config.ts:15>) sets `nosniff`, frame denial, referrer, and permissions headers, but no CSP.

**Impact:** Other browser protections are present, but there is no CSP defense-in-depth against script injection if an XSS defect is introduced. A CDN or ingress may add one, but no such deployment configuration is included here.

**Recommendation:** Verify response headers at the production edge. Add a tested CSP in report-only mode first, then enforce a policy compatible with Next.js runtime scripts and the app’s asset/API origins. Avoid broad `unsafe-eval`/`unsafe-inline` allowances unless the chosen Next.js setup demonstrably requires them.

### HIGH (development tooling only) — npm audit flags the lint dependency chain

**Evidence:** `npm audit` reports five high-severity advisories through `braces <=3.0.3`, pulled by `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`. `npm audit --omit=dev` reports zero vulnerabilities. `npm audit fix` does not resolve it; npm's suggested automatic fix downgrades `eslint-config-next` to 14.2.35, a major version mismatch with this Next.js 16 app.

**Impact:** The affected package is development lint tooling and is not included in the production dependency audit. A crafted deeply nested glob pattern may cause stack exhaustion when the tool processes it. Avoid running lint on untrusted pattern inputs. Keep this open until an upstream-compatible dependency release or safe override is available; do not force the major downgrade.

### LOW — Unit coverage does not exercise MySQL-backed invite acceptance or progress aggregation

**Evidence:** Existing API test output covers field validation and bulk-assignment service logic, but no HTTP/MySQL integration test suite or disposable database workflow was found.

**Impact:** Transaction isolation, migration behavior on existing invitation rows, uniqueness races, and SQL aggregation differences remain less directly verified than pure logic.

**Recommendation:** Add integration coverage against a dedicated test MySQL database for token issue/claim/replay/expiry/revoke, role restrictions, cross-organization access, migration of bound invitations, and progress-board aggregation. Keep this separate from the developer’s real workspace data.

## Positive controls verified in code

- Session and reviewer-link bearer secrets are stored as hashes; reviewer links are checked for expiry/revocation and active reviewer status.
- Production sessions use an HttpOnly, SameSite cookie with Secure enabled; mutations require the configured web Origin and a session-derived CSRF token.
- Express uses Helmet, exact-origin credentialed CORS, strict JSON parsing capped at 64 KB, and removes `X-Powered-By`.
- Role checks and organization-scoped Prisma queries are applied in API modules; membership, assignment, form, submission, and audit tables have tenant/query indexes and relevant uniqueness constraints.
- Public review reads set `Cache-Control: no-store`; submissions include idempotency handling.
- Invitation and review-link tokens are stored as a one-way hash for validation and authenticated AES-256-GCM ciphertext for owner/admin reveal. Reveal actions are audited, scoped, and returned with `Cache-Control: no-store`. `TOKEN_ENCRYPTION_KEY` is mandatory in production and must be backed up outside MySQL; older rows without ciphertext must be rotated before they can be copied again.
- Readiness checks MySQL; shutdown closes the HTTP server and disconnects Prisma.
- No Docker or Redis dependency was introduced. phpMyAdmin is an administration tool, not an app runtime dependency; on Hostinger it is accessed through the account's database control panel and should not be exposed as a ReviewRoom application route.
- Unexpected API 5xx responses now write a JSON diagnostic to stderr containing the request ID, Express route template, and error class name. Error messages and stacks are omitted because they can contain user-submitted data. Hosting log retention/access still needs staging verification.

## Practical conclusion

For the stated student-team use case (about 15 reviewers and 50 review targets), the architecture is a sensible starting point on a properly sized single web/API deployment with MySQL. It is **not possible to certify high-traffic behavior or production stability from source inspection and unit tests alone**. An earlier 2026-10-22 follow-up had failed readiness because MySQL at `127.0.0.1:3307` was unreachable; that local database state was later restored and migrations/readiness succeeded. Current revalidation evidence and remaining deployment gates are recorded below. The workspace still has no dedicated Git remote for this app, so Git-based Hostinger deployment is blocked until a release repository or validated ZIP workflow is prepared.

## Revalidation: mobile workflow and bounded production smoke (2026-10-22)

- Reviewer work rows on Overview now open submission details inside the existing drawer and include sequential review numbers. The target-row edit control exposes a clear accessible label and inline editing for name/email.
- Submissions, target lists, submission details, mobile workspace navigation, and the form editor received narrow-screen layout changes. The tablet-only editor grid no longer overrides the phone layout.
- Root typecheck and lint passed; web tests: 37 passed; API tests: 59 passed; isolated Next production build passed. `npm audit --omit=dev` reports zero production dependency vulnerabilities. Full audit still reports five HIGH advisories in the development-only lint dependency chain; forcing npm's suggested fix would downgrade the Next lint config across major versions and was not applied.
- A bounded smoke run against the isolated production Next server on port 3100 and local API/MySQL used concurrency 24. API readiness: 120/120 HTTP 200 (p50 9.3 ms, p95 22.6 ms); random invalid public review lookups: 120/120 expected HTTP 404 (p50 14.7 ms, p95 18.3 ms); production web login HTML: 120/120 HTTP 200 (p50 24.6 ms, p95 36.7 ms). No unexpected responses. A back-to-back run inside the same minute returned 100 HTTP 429s after the shared 300/minute API limiter was reached; readiness and web responses stayed 200. The smoke script now treats 429 as an expected throttling outcome for public lookup and shows its count.
- These are local, short smoke measurements, not a high-traffic test: they do not simulate authenticated reviewer submissions, large datasets, concurrent database writes, 3×/5× bursts, resource saturation, multiple API replicas, or Hostinger network/plan limits. They cannot establish a maximum safe request rate or availability SLO.
- Browser automation remains disabled in Work settings, so no visual device/browser verification was possible for iOS Safari, Android Chrome, Firefox, or Edge. The form signature continues to use responsive SVG/Pointer Events, but platform certification requires the manual staging matrix documented in `docs/ui-responsive-and-signature-support.md`.
- Before a public release, run the representative workload and burst/recovery scenarios listed above against a staging deployment on the intended Hostinger plan; capture p50/p95/p99, error rates, CPU/memory, DB active connections and I/O, and verify backup restoration, TLS/domain routing, CSP/headers, and multi-instance rate-limit behavior.

## Follow-up: fixed mobile navigation and phone cards (2026-10-22)

- The narrow-screen workspace navigation is now fixed to the viewport bottom with safe-area spacing, and page content reserves room so the nav does not cover the last controls.
- Review-target entry fields and target cards now constrain their widths on phones; long names and reviewer select values can wrap/shrink. Team member rows render as labeled cards instead of forcing a 680px-wide table scroll.
- Root typecheck, lint, and production build pass. Web tests: 37 passed. API tests: 59 passed.
- Repeated maximum bounded burst at concurrency 24: API readiness 120/120 HTTP 200 (p50 14.8 ms, p95 88.4 ms); random public review lookups 120/120 HTTP 404 (p50 14.9 ms, p95 43.8 ms); production web login 120/120 HTTP 200 (p50 26.9 ms, p95 92.1 ms). No unexpected responses.
- Visual phone checks remain unavailable because the local browser automation is disabled. These results still do not show a sustained high-traffic ceiling, authenticated write contention, replica scaling, or performance on Hostinger. Keep the previously listed staging load, recovery, monitoring, and platform checks as pre-launch gates.

## Hostinger deployment result

Hostinger’s current docs list managed Node.js support for Next.js/Express on eligible Business/Cloud plans, support for MySQL and phpMyAdmin on Web/Cloud hosting, and separate Node.js applications for monorepo subdirectories. The API now honors the hosting-provided `PORT` (falling back to `API_PORT`) and accepts a configurable `DATABASE_CONNECTION_LIMIT`. Confirm your exact plan supports the required Node.js version, monorepo layout, application count, process/memory limits, and how app-to-app routing is exposed before deployment. Managed Node hosting has plan and process limits, so “can run” does not establish high traffic capacity. If you need custom reverse proxy/port behavior or more runtime control, Hostinger’s VPS/CloudPanel route is the alternative.

Official references: [Node.js hosting options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/), [deploy a Node.js website](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [deploy monorepos](https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/), [Node.js limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/), [connect MySQL from Node.js](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/), and [phpMyAdmin access](https://support.hostinger.com/en/articles/1583545-how-to-access-phpmyadmin-at-hostinger).

## Follow-up product behavior

- Admin progress metrics now distinguish goal size, added targets, assignments, completed people, and submissions. The main progress bar uses completed people / configured goal; the reviewer workload panel has a separate denominator of active reviewers with assignments.
- Member “Remove” is a reversible archive, not a physical database delete. The owner-only “Delete permanently” action hard-deletes an archived membership only when no submissions reference it. The global user account and other workspaces remain.
- Signature is implemented as a typed name or normalized drawing using browser Pointer Events and safe SVG rendering. The API bounds and validates all stored values. This supports current browsers/devices with typed fallback; it is not identity verification or certified e-signing.
- Follow-up check: TypeScript, lint, build, API tests (45), web tests (27), Prisma schema validation passed. Production dependency audit: 0; full audit: 5 high findings in a development-only lint chain. Local database readiness remains blocked as stated above.
