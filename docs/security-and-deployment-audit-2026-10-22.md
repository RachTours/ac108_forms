# ReviewRoom source, security, and Hostinger readiness audit

**Reviewed:** 2026-10-22  
**Scope:** initial review covered `apps/api`, `apps/web`, `packages/contracts`, Prisma schema/migrations, workspace scripts and deployment docs. The 2026-10-22 follow-up re-counted 72 API source files, 52 web App Router/feature files, and 2 contract source files, and re-ran dependency, type, lint, unit, build and schema checks. Static source review only; no production host, Hostinger account, external edge configuration, or disposable production-like database was available.

## Executive assessment

ReviewRoom is a credible small-team application built with Next.js 16, Express 5, TypeScript, Prisma/MySQL, and shared Zod schemas. Its main security controls are present: session secrets are hashed, cookies are HttpOnly/SameSite and Secure in production, cookie-authenticated writes require CSRF and exact Origin checks, role/tenant checks live in the API, public links are expiring bearer secrets, and request bodies and list sizes are bounded.

**For the stated 15-reviewer/50-target workload, the architecture is plausible on one properly configured web app, one API app, and a correctly sized MySQL database. High-traffic capacity and production stability are not proven.** There is no representative load test, real Hostinger staging deployment, production monitoring, MySQL integration test harness, or recovery rehearsal. The exact Hostinger plan and the deployment route for this npm-workspace monorepo are not confirmed.

The initial review found documentation/configuration drift: an unused compose file defined Redis despite the project constraint, and the architecture guide falsely stated that production rate limits use Redis. The follow-up remediation removed that file and corrected the architecture guide; no Docker or Redis process was started.

## Findings

### A1 — HIGH operational — No measured capacity or production recovery evidence

**Location:** `docs/deployment-readiness-review.md`; `apps/api/src/http/rate-limits.ts:11-43`; `apps/api/src/db/client.ts:12`; `apps/api/src/server.ts:6-7`.

**Evidence:** The API rate-limit store is process-local; the MariaDB pool defaults to 10 connections per API process. The app has liveness/readiness routes and graceful shutdown, but no representative load test, alerting/metrics setup, production deployment, or tested backup restore was found.

**Impact:** Source tests cannot predict tail latency, database saturation, proxy/IP behavior, outage recovery, or how a particular Hostinger plan behaves. Running multiple API processes also multiplies the database pool and gives each process independent rate counters.

**Recommendation:** Before making a high-traffic claim, stage the chosen hosting plan and run a synthetic 15-reviewer/50-target flow, a sustained 3× load, and a brief 5× burst against isolated data. Record p50/p95/p99 latency, errors/timeouts, process memory/CPU, MySQL active connections, and recovery. Set the pool using the actual MySQL connection budget. If multiple API instances are ever used, put shared abuse limits at the existing edge/gateway; keep Redis excluded.

### A2 — HIGH deployment blocker for Git-based Hostinger deploy — This app folder is not tracked by the current Git repository

**Location:** Workspace/repository metadata.

**Evidence:** The current Git root is the parent `C:/Users/Mo/Desktop/udemy enroller`; `git ls-files -- apps/api apps/web packages docs` returns 0, and `git remote` returns no remotes. The app directory currently appears as an untracked directory in the parent repository.

**Impact:** Hostinger’s GitHub deployment cannot deploy this source until it is committed to and connected with a repository. Hostinger also supports ZIP upload, but that path still needs a reproducible archive containing the workspace lockfile and all required packages.

**Recommendation:** Decide the intended Git repository location and push this app as a private repository, or prepare a verified ZIP release artifact. Do not include `.env`, `node_modules`, generated credentials, or local database contents. The audit did not initialize a new Git repository or publish source.

### A3 — HIGH/medium security hardening — Content Security Policy is absent

**Location:** `apps/web/next.config.ts:15-23`; `apps/api/src/app.ts:20-21`.

**Evidence:** Next sets `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restrictive Permissions Policy. Helmet is mounted in Express. No CSP is configured in checked-in web or API code.

**Impact:** Current controls cover several important browser protections, but there is no CSP defense-in-depth against script injection. A CSP can break Next.js runtime scripts if enabled without validating the actual production HTML and asset origins.

**Recommendation:** First capture response headers from a Hostinger staging deployment. Add CSP in report-only mode, review violations on login, admin, public review, and invitation pages, then enforce a compatible nonce/hash policy. Do not add broad script `unsafe-inline`/`unsafe-eval` allowances without evidence they are required.

### A4 — MEDIUM operational — Unhandled server errors are not recorded

**Location:** `apps/api/src/http/error-handler.ts:8-20`; `apps/api/src/http/request-context.ts:4-9`.

**Evidence:** Unexpected errors return a generic 500 with request ID, which avoids leaking internals, but the error handler does not log the error or request ID. Request IDs are returned in a response header/body.

**Impact:** A production operator may see generic failures without enough server-side evidence to identify whether the API, Prisma, MySQL, or application code failed. This weakens incident response and stability work.

**Recommendation:** Add structured server-side error logging with request ID, route, status, and sanitized error details. Redact authorization headers, cookies, link/invitation token path segments, passwords, answer bodies, and database URLs. Add alerts for elevated 5xx and readiness failures.

**Remediation status (2026-10-22):** Implemented in Work Package 19. Unexpected 5xx errors now emit one-line JSON to stderr with request ID, method, route template, and error class name; error messages/stacks are omitted to avoid logging user-submitted data. Public 500 responses remain generic. Regression coverage verifies that request URL tokens and error text are not logged. Hosting log retention and alerts remain staging/operations work.

### A5 — MEDIUM deployment correctness — Hostinger workspace/root commands still need a real staging proof

**Location:** `docs/hostinger-deployment.md:17-39`; root `package.json`; `apps/api/package.json`; `apps/web/package.json`.

**Evidence:** The app depends on root npm workspaces and `@reviewroom/contracts`. Prisma Client is generated into the ignored `apps/api/src/generated` directory. The current guide gives root-level build/start commands but describes per-app roots only conditionally. A clean checkout therefore depends on correct root install/build configuration and running Prisma generation before API compilation. Hostinger’s monorepo guide requires a root directory plus build/output/entry settings per Node.js website.

**Impact:** A deploy configured with `apps/web` or `apps/api` as an isolated root can fail to resolve the shared workspace package or lockfile. An API build from a clean clone can fail if `prisma generate` was omitted. Running the whole monorepo build for both websites can also waste build time/resources.

**Recommendation:** On staging, configure each website with the repository root as the workspace install context, set a targeted build command that builds contracts first and Prisma Client before the API, and select that app’s output/start command. Validate the exact Hostinger UI settings with a clean clone. Confirm whether the API origin is reachable from Next server rewrites and whether both apps can use the expected `PORT` behavior. The committed guide should be updated from the tested settings rather than assumed values.

### A6 — MEDIUM security/process — The development dependency audit reports five high findings

**Location:** `package-lock.json`, `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`.

**Evidence:** `npm audit` reports five high-severity advisories through vulnerable `braces` versions. `npm audit --omit=dev` reports 0 vulnerabilities. npm's forced fix would downgrade `eslint-config-next` to 14.2.35, which is incompatible with this Next.js 16 project.

**Impact:** The affected chain is development lint tooling rather than the production dependency graph, so this is not evidence of a production runtime vulnerability. It remains a supply-chain issue for development/CI and should not be “fixed” with an unrelated major framework downgrade.

**Recommendation:** Track the upstream-compatible fix, update the lint dependency chain when compatible versions are available, and continue to run the production-only audit. Do not run lint against attacker-controlled glob patterns. A registry check on 2026-10-22 still resolves the 3.x line to 3.0.3, which remains in the affected range; the only npm suggested fix remains the incompatible eslint-config-next downgrade.

### A7 — RESOLVED — Stale Redis/Docker configuration conflicted with the project constraint

**Location at initial audit:** unused `docker-compose.yml`; stale Redis claims in `docs/architecture.md`.

**Initial evidence:** the unused compose file defined Redis, while the application source used in-memory `express-rate-limit` only. The architecture document incorrectly described Redis-backed limits/readiness. README and deployment notes already stated that Docker and Redis were not application requirements.

**Impact:** The stale configuration could lead a future engineer to start unnecessary services or rely on nonexistent distributed rate limits.

**Recommendation:** Remove the unused Compose file or reduce it to an explicitly opt-in local MySQL tool only after confirming it is not part of the intended workflow; correct the architecture guide to say rate limits are per API process. Neither service was started during this audit.

**Remediation status (2026-10-22):** The unused compose file was removed and the architecture/deployment docs now state that rate limits are per process. No Docker or Redis was run or added.

### A8 — MEDIUM security/availability — Client IP rate limits depend on Hostinger proxy configuration

**Location:** `apps/api/src/app.ts:19`; `apps/api/src/env.ts:18,27`; `apps/api/src/http/rate-limits.ts:11-43`.

**Evidence:** Express trusts no proxies unless `TRUSTED_PROXIES` is configured. Limits use `request.ip`; public limits combine that address with a hash of the bearer token. This is safe against spoofing while proxy trust is disabled, but behind a reverse proxy it may see the proxy address for all users.

**Impact:** If Hostinger routes every request through a shared proxy and the app cannot see the actual client address, unrelated users may share one IP quota. Blindly trusting forwarded headers would permit spoofing and weaken limits.

**Recommendation:** In staging, inspect observed `request.ip` using a temporary privacy-safe diagnostic or provider logs. Configure only Hostinger-documented trusted proxy addresses/CIDRs, if available; otherwise apply IP/burst limits at Hostinger’s edge. Never set Express `trust proxy` to unrestricted `true` just to make rate limits appear correct.

### A9 — LOW/MEDIUM assurance — Automated coverage does not include HTTP/MySQL integration

**Location:** `apps/api/src/**/*.test.mjs`, `apps/web/src/**/*.test.mjs`; workspace scripts in root and package manifests.

**Evidence:** Existing coverage focuses on pure logic and helpers. No disposable MySQL-backed route/integration suite, browser automation, CI workflow, SAST configuration, or dedicated secret scanner was found. Local MySQL health and app health were checked, but test data was not destructively mutated.

**Impact:** Database migration correctness on an existing production schema, tenant boundary behavior through real routes, transaction races, and end-to-end browser behavior are less verified than schema/logic tests.

**Recommendation:** Add a dedicated isolated MySQL integration environment and route tests for role/tenant isolation, token acceptance/rotation/reveal/revocation, public submission/idempotency, and migration from the prior schema. Add CI for typecheck/lint/unit/integration/build and a supported dependency audit. Never point tests at the production workspace database.

### A10 — LOW/MEDIUM privacy — Public bearer secrets occur in URL paths

**Location:** `apps/web/app/r/[token]/page.tsx`; `apps/web/app/invite/[token]/page.tsx`; `apps/api/src/modules/submissions/public-review.routes.ts:29-47`; `apps/api/src/modules/members/member.routes.ts:110-123`.

**Evidence:** Reviewer and invitation secrets are path segments. The web response sets `Referrer-Policy: no-referrer`, and the API hashes tokens before lookup; application request IDs do not log the URL. Host/server access-log handling is outside this repository.

**Impact:** A bearer link can appear in browser history, screenshots, copied chat, and potentially hosting/CDN access logs. Anyone who obtains it can use it until expiry/revocation.

**Recommendation:** Ensure host/CDN/access analytics redact `/r/:token` and `/invite/:token`, avoid third-party scripts on those pages, retain no-referrer, and keep short invitation lifetimes and link revocation. Consider fragment-to-request-body exchange only if access-log exposure is unacceptable; that would be a deliberate link-format migration.

## Product/UX improvements worth building next

Prioritized for a 15-reviewer / 50-person student review:

1. **CSV target import with preview and duplicate detection.** Download a template; validate names/emails; show errors and duplicates before a single transactional import; offer a final count and undo/archive path. Saves time when the 50 targets change.
2. **Assignment balancing with a preview.** Distribute unassigned targets across active reviewer accounts by current workload, preserve manual assignments, show the before/after counts, and require an admin to confirm. Do not auto-assign silently.
3. **Submission export for admins.** Export filtered responses with the reviewed person’s submitted Full name, form/version, reviewer, date, and answers. Enforce role/tenant access, use safe CSV escaping, audit the export, and avoid public URLs.
4. **Account recovery and optional MFA for owners/admins.** Password reset requires a configured email sender; MFA should be introduced after recovery and enrollment flows are designed, not as a half-finished toggle.
5. **Deadline/reminder controls.** Add target or review-cycle due dates and reminders only after choosing an email provider and delivery policy. Hostinger managed Node.js does not support always-running workers; use scheduled/cron execution rather than an in-process timer.
6. **Small UX simplifications:** one explicit “next action” on each page, persistent filter/search state on assignment/submission lists, clear bulk-action preview, and a compact mobile action menu. Validate these through a short reviewer/admin usability session before expanding the editor.

These are proposals; no new product feature was added during this audit because each changes workflows/data or requires a service choice.

## Hostinger compatibility and scale conclusion

Hostinger currently lists Node.js apps on eligible Business/Unlimited and Cloud plans and supports Next.js and Express. Its monorepo flow deploys each app as a separate website with its own root/build/output/start settings. It documents one long-running Node process per app, shared plan process/memory limits, a 120-second request timeout, no inbound WebSockets, no persistent workers, and no custom ports/extra services. Hostinger’s Node-to-MySQL guide uses `127.0.0.1`; its dashboard supports environment variables and phpMyAdmin on eligible plans.

This matches the app’s basic synchronous Next.js + Express + MySQL shape, with the restriction that background email jobs, inbound websockets, or additional Redis services cannot be assumed on managed hosting. A small student team should fit if the exact plan has adequate resources and a working two-app deployment. **Arbitrary high traffic is not established.** A VPS offers more runtime control but adds server patching, proxy, process supervision, monitoring, backup, and firewall responsibilities.

Official source links (checked 2026-10-22):

- [Hostinger Node.js plan limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/)
- [Hostinger Node.js app deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger monorepo deployment](https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/)
- [Hostinger MySQL connection guide](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
- [Hostinger environment variables](https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/)
- [Hostinger phpMyAdmin access](https://www.hostinger.com/support/1583545-how-to-access-phpmyadmin-at-hostinger/)

## Checks performed

- `npm audit --omit=dev`: 0 production dependency vulnerabilities.
- `npm audit`: 5 high findings, all in the development ESLint dependency chain described under A6; no forced major downgrade performed.
- `npm run typecheck`, `npm run lint`, API tests (32), web tests (18), `npm run build`, and Prisma schema validation: all passed.
- Live local checks: `http://localhost:3000/login`, `http://localhost:4000/api/v1/health/live`, and `http://localhost:4000/api/v1/health/ready` returned HTTP 200.
- Source pattern searches covered raw SQL/unsafe HTML/eval/process execution, request body/parameter validation, secret patterns, proxy trust, rate limits, cookies/CSRF, and pagination bounds. No raw SQL unsafe methods, `dangerouslySetInnerHTML`, `eval`, or child process execution were found. No known private-key/cloud-token patterns were found in scanned source/docs. `.env` is ignored and was not read.
- Project facts: 72 API source files, 52 web App Router/feature files and 2 contract source files; Node v24.12.0 / npm 11.6.2; zero tracked project files and no Git remote in the current containing repository.
- Live local checks: web login, API liveness, and API readiness returned HTTP 200.
- Not performed: real Hostinger deployment, browser visual/interaction QA, MySQL migration/integration suite, load test, penetration test, alerting setup, backup restore, or production secret provisioning.

## Follow-up — Progress, deletion, signature, and current readiness

### Verified product behavior and changes

- **Progress display:** `/` now reports the configured goal, assignment rows, completed people, and submission count with distinct labels. The goal card includes active targets added and the remaining goal gap (50 goal, 2 active targets -> 48 still to add). The primary bar is completed people divided by the configured goal (1/50 = 2%). Reviewer completion is a separate workload concept; reviewers with no assignments are excluded from its denominator and shown as waiting for assignments. Source: `apps/web/app/(workspace)/page.tsx`, `apps/web/src/features/progress/reviewer-board.ts`, and `reviewer-progress-board.tsx`.
- **Member removal:** `DELETE /members/:membershipId` is reversible archival; it retains the Membership row and does not hard-delete the member from MySQL. It revokes sessions, assignments, and active links. The separate owner-only `DELETE /members/:membershipId/permanent` deletes only an already archived workspace Membership with no submissions, writes an audit event, and leaves the global User and other-workspace memberships intact. Submission history must be deleted first. The Team table labels the irreversible action “Delete permanently.” Source: `apps/api/src/modules/members/member.routes.ts:176-208`, `member-lifecycle.ts`, and `apps/web/src/features/team/team-manager.tsx`.
- **Signature field:** already implemented from shared schema through editor, public input, server validation, and submission view. It accepts a typed name or normalized Pointer Events strokes; values are bounded and SVG display uses validated coordinates. Current Pointer Events support is widely available for mouse, pen, and touch on modern browsers/devices, with typed input as the accessible keyboard/fallback route. This is a captured mark, not identity verification, tamper-proof signing, or a claim of legal e-signature compliance. Source: `packages/contracts/src/forms.ts:11-16`, `apps/web/src/features/review/signature-input.tsx`, `apps/api/src/modules/submissions/answer-validator.ts:85-88`, and `apps/web/src/features/submissions/submission-detail.tsx`.
- **Login icon:** current source has one show/hide control for password and no email reveal control (`apps/web/src/features/auth/login-form.tsx`). The browser screenshot may represent an older running bundle or injected browser UI; visual confirmation requires a fresh live browser check.

### Follow-up verification results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Next.js 16.4.2 generated the production app routes.
- `npm test --workspace @reviewroom/api`: 45 passed.
- `npm test --workspace @reviewroom/web`: 27 passed.
- `npx prisma validate --schema apps/api/prisma/schema.prisma`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities. Full `npm audit`: 5 high findings, in the development-only ESLint/Next lint chain ending at `braces`; npm's offered `--force` remedy downgrades Next lint config to 14.2.35 and was not applied.
- **Superseded by the 2026-10-22 implementation follow-up below:** at the earlier audit time the DB connection failed, so no migration was applied. The user subsequently selected a fresh local MySQL database; the app was reconnected to the configured local database and migrations were applied. Do not rely on the earlier failed-connection status.
- The source directory is not connected to a remote Git repository and has no tracked app files in the parent Git root. Git-based Hostinger deployment is blocked until repository ownership, tracking, and a private remote are configured. Do not present this source tree as deploy-ready yet.

### Security, scale, and product limits

- Pattern scan across app source found no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or child-process execution in app source. The API uses Helmet, exact configured CORS origin, explicit proxy trust disabled unless allowlisted, strict JSON parsing capped at 64 KiB, session/CSRF/role checks and per-process rate limits. Verify these protections again at the real proxy/Hostinger edge; app source cannot prove edge behavior.
- The rate limiter is memory-backed and per API process; the Prisma/MySQL pool defaults to 10 per API process. Adding API instances multiplies connection use and does not share quotas. Capacity remains unmeasured; 15 reviewers/50 targets is plausible, but no high-traffic, failover, or production stability claim is justified without the isolated load, monitoring, and restore gates in A1/A8.
- Hostinger's current Node app documentation lists Next.js and Express, Node 18/20/22/24, and eligible Business/Unlimited/Cloud plans. Its managed Node limits document one Node server per app, shared plan process/memory limits, a 120-second timeout, and no inbound WebSockets or always-running workers. Confirm the exact plan supports both apps, root npm-workspace builds, API-to-web routing, MySQL access, and the required 24.x runtime. Prefer scheduled tasks for future reminders; do not add Docker or Redis.
- Recommended next form controls: (1) section/help and page-break fields, which improve long forms without storing answer values; (2) matrix scale after screen-reader/mobile interaction design; (3) address group only with a locale/country model. Defer uploads until private object storage, quotas, file-type/content inspection, malware handling, and retention are implemented.
- Signature values are personal data stored in submission JSON and inherited by database backups. Set the workspace retention policy and access/backup controls before collecting real signatures.

Official references checked 2026-10-22:

- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) — widely available, device-agnostic mouse/pen/touch events.
- [MDN SVG polyline](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/polyline) — broadly supported vector rendering used for stored strokes.
- [Hostinger Node.js deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [Node.js plan limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/), and [Node.js version selection](https://www.hostinger.com/support/how-to-select-the-node-js-version-for-your-application/).

## Follow-up — Role credentials, recovery tokens, and theme implementation (2026-10-22)

- Authentication now stores password hashes per `Membership`, not on the shared `User`. Migration `202610220005_membership_credentials` copies each existing account hash to its existing memberships before dropping the old global hash column. Admin and reviewer endpoints select only their own roles and verify against the selected membership credential. Admin password reset changes only the target membership password and invalidates its sessions; other memberships for the same email remain signed in with independent credentials.
- Password recovery is admin-issued only (no email). Each reset token is random, 30-minute, one-use, stored hashed, shown in the issue response only, and can be revoked. The team UI provides explicit “Reset password”, expiry, and “Copy again”; `/reset-password` asks for email, token, and a new password.
- Workspace theme persists an allowlisted brand color and font preset in `OrganizationTheme`; settings can preview/save the appearance. Workspace CSS tokens apply in admin/reviewer panels and form-editor surfaces; the public review bootstrap carries a validated theme. Logo upload and separate surface/body/heading controls are not part of this delivery.
- Migration `202610220004_organization_theme` and `202610220005_membership_credentials` were generated and applied to the configured local MySQL database. The API was rebuilt; `/health/ready` returned HTTP 200. An integration smoke check authenticated the owner on the admin endpoint (200), rejected that identity on reviewer sign-in (401), issued a reset token (201), and revoked it (204). Theme GET/PUT/restore returned 200. Raw credential/token values were not printed.
- Verification for this follow-up: root `npm run typecheck`, `npm run lint`, `npm run build`, API tests (54 passed), web tests (28 passed), production dependency audit (0 findings), and production app routes build passed. A fresh HTTP check returned 200 from `/api/v1/health/live`, `/api/v1/health/ready`, and web `/login`. Full `npm audit` still reports five HIGH findings through development-only `eslint-config-next -> fast-glob -> micromatch -> braces@3.0.3`; no fixed braces release was available at review and npm's forced fix proposes downgrading the Next lint config to v14, so that incompatible downgrade was not applied.
- Fresh online Hostinger documentation confirms Node.js 24 support on eligible Business/Unlimited and Cloud plans and supports deploying each app from a monorepo as a separate Node.js website. The actual plan, app slots, API routing, database connectivity, TLS, resource limits, and deployment have not been exercised in the user's Hostinger account.
- Remaining release gates: choose/configure the tracked private Git repository or verified ZIP; deploy both web and API to staging with production secrets and TLS; verify CSP in report-only mode; confirm edge proxy/rate-limit settings; measure expected and burst traffic; add monitoring and rehearse database restore. No high-traffic/stability claim is made.

## Security and deployment recheck (2026-10-22)

**Scope:** Rechecked API session/auth/role/rate-limit flow, web proxy/API client, cache boundaries, Next headers, environment examples and current Hostinger Node.js docs. This is source and local-runtime verification, not a penetration test or Hostinger staging validation.

### Controls verified

- Authentication uses opaque 32-byte random server sessions, not JWTs. The browser receives only an HttpOnly cookie; the server stores a SHA-256 hash and resolves it against active user/membership/organization rows on protected requests. This supports immediate revocation and fits the app's DB-backed lifecycle; JWT is not required here.
- Cookies are HttpOnly, SameSite=Lax, path `/`, eight-hour lifetime, Secure in production, and use the `__Host-` prefix in production without a Domain attribute.
- Cookie mutations require a session-derived HMAC CSRF token and exact `Origin === WEB_ORIGIN`; login and password reset also reject mismatched origins. CORS allows only the configured exact origin. Express proxy trust stays disabled unless explicit `TRUSTED_PROXIES` is configured.
- Express checks role and tenant membership independently of Next route/UI hints. Reviewer routes are scoped to the authenticated membership. Passwords use scrypt; invitation/reset/review-link tokens are high entropy and verified by hashes; encrypted token reveal is protected and audited.
- API inputs use runtime Zod parsing, JSON is capped at 64 KiB, pagination is bounded, and database access uses Prisma. Error logs omit URLs, headers, bodies, token values, and raw error text.
- The local `.env` is gitignored. It contains service/database configuration, not login credentials. Bootstrap values only create an owner on a fresh DB; changing an existing account uses password recovery. Do not copy local credentials to production or commit `.env`.

### Changes in this recheck

- Added nonce-based Content Security Policy delivery in `apps/web/proxy.ts`, following the installed Next.js 16.4.2 docs. Production scripts require a per-request nonce and `strict-dynamic`; development additionally allows `unsafe-eval` for Next diagnostics. `style-src 'unsafe-inline'` remains because theme tokens and progress indicators currently use React style attributes. All routed HTML responses use private no-store behavior; verify CSP headers and rendering on Hostinger before treating provider behavior as tested.
- Added global API `Cache-Control: no-store, max-age=0` and `Pragma: no-cache` in `apps/api/src/http/no-store.ts`, including success, error, health and unknown API responses. Hashed Next static files remain cacheable. A regression test checks health and 404 responses.
- Added CSP unit tests; added root Hostinger build/start scripts, Prisma generation to root build/typecheck, a root test command, and GitHub Actions checks for typecheck/lint/tests/build/production dependency audit.
- Updated Hostinger instructions for two app slots, public HTTPS API hostname through same-origin rewrites, npm workspace root, build commands, migrations/one-time owner setup, and private cache rules.

### Open findings

**A1 — HIGH operational — Capacity and recovery are not proven.** No real Hostinger staging deployment, representative sustained/burst test, backup restore drill, production alerting, or plan resource data exists. Local smoke does not prove high-traffic capacity. Run the documented workload on the chosen plan and capture latency, errors, CPU/RAM, DB connections, and restore/recovery evidence.

**A2 — MEDIUM operational — Rate limits are process-local.** `apps/api/src/http/rate-limits.ts` uses the in-memory store. It is suitable for one process; replicas have independent counters, and restarts clear them. For multiple API instances, enforce shared limits at the existing gateway and verify client-IP propagation before changing proxy trust.

**A3 — MEDIUM operational — MySQL pool is per API process.** `apps/api/src/db/client.ts` defaults `DATABASE_CONNECTION_LIMIT` to 10. Budget `instanceCount × pool` below the database limit with migration/admin headroom; load-test concurrent submissions and list queries.

**A4 — MEDIUM deployment — Hostinger settings remain unverified.** Current docs support Node 24 and npm monorepo apps, but each app is separate; managed plans cap processes/memory, use a 120-second request limit, and do not support inbound WebSockets or always-running workers. Confirm root workspace build settings, HTTPS API routing, cookies/Origin, `API_INTERNAL_URL`, MySQL access and actual plan capacity in staging.

**A5 — MEDIUM supply chain (development only) — Five high npm audit findings persist.** Fresh `npm audit --json` reports `braces <=3.0.3` through `micromatch`, `fast-glob`, `@next/eslint-plugin-next` and `eslint-config-next`. `npm audit --omit=dev` reports zero vulnerabilities. npm's proposed fix downgrades `eslint-config-next` to 14.2.35, incompatible with Next 16; the registry still has no fixed braces 3.x release. Keep development tooling out of runtime installs where supported, track upstream fixes, and do not force the downgrade.

**A6 — MEDIUM assurance — API tenant authorization lacks comprehensive live-DB coverage.** Current tests cover policy/service functions and HTTP cache headers, but no disposable-MySQL integration suite exercises every route boundary and concurrent write race. Add before broad production use.

**A7 — LOW/MEDIUM security — CSP permits inline styles.** Production scripts use a nonce policy without `unsafe-inline`/`unsafe-eval`, but `style-src 'unsafe-inline'` remains necessary for current inline theme/progress styles. Refactor those styles to allow a stricter style policy before asserting a strict CSP.

### Current conclusion

The source has meaningful authentication, session, CSRF, role, tenant, and token protections; production dependencies audit clean; and private response caching is now explicitly disabled. **It is not accurate to call the site fully security-certified or high-traffic ready yet.** Hostinger deployment is prepared at repository/configuration level; plan fit, provider proxy behavior, edge limits, load behavior, restore, and alerting remain pre-launch gates.
