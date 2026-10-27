# ReviewRoom security, quality and release review

Date: 2026-10-27. Source baseline: `1c6fa72`, matching fetched
`ac108_forms/main` in `RachTours/ac108_forms` at review start.
Checkout: `codex/reviewer-groups-platform-themes`.

## Decision

The continuation has been reviewed and its confirmed defects corrected locally.
This is evidence for the checked source and local scenarios, not a guarantee of
zero vulnerabilities or bugs. Production readiness still depends on the
Hostinger staging and infrastructure checks below. No Hostinger settings,
production database, or production deployment was changed during this review.

A GitHub push can trigger hosting-side deployment automation.
`scripts/build-hostinger-api.mjs:39` onward runs integrity preflight and database
migration as part of the build. The initial review held the push under the user's
earlier hosting-access instruction. The user subsequently explicitly authorized
pushing the new code to GitHub main after the compatibility recheck below.
No direct Hostinger deployment or configuration operations are included.

## Final compatibility recheck before GitHub push

- Fetched `RachTours/ac108_forms/main` again: it still points to `1c6fa72`, so the
  reviewed changes can be pushed as a normal fast-forward without rewriting
  history. The unrelated `origin` remote and desktop checkout are not modified.
- Compared this release with that exact main revision: Prisma schema and
  migrations, shared API contracts, dependency manifests/lockfile and API deploy
  script are unchanged. This release introduces no database migration.
- Local `prisma migrate status` reports all 16 existing migrations applied and
  the schema up to date. This establishes compatibility with the schema already
  required by current main; it does not support arbitrary historical databases
  missing main's existing migrations or establish the live Hostinger schema.
- The group-history endpoint preserves existing fields, pagination and sort
  parameters. Reviewer metadata is additive and reviewer filtering is optional.
  The client tolerates an absent reviewer-metadata array, retaining the history
  list while the backend is rolled out. New filtering requires the updated API.
- Fresh verification: 285 tests passed; typecheck, lint and full API/web production
  build passed; production dependency audit returned zero known vulnerabilities.
  Lint retains eight existing warnings. The local workflow suite passed 601
  checks, including legacy v1 paths, and removed its fixtures while verifying
  every original row/count. Assertion counts include preserved baseline rows and
  can differ from earlier retained-fixture runs.
- The generated local `next-env.d.ts` path change is excluded from the commit.
  No `.env`, local credentials, database backups or QA session output is included.

## Scope and method

- Read the referenced chat's latest requirements and inspected its actual checkout,
  rather than the divergent desktop checkout. The two configured GitHub remotes
  point to different repositories; `origin/main` is not this release's base.
- Reviewed the uncommitted group history, progress, theme and development-origin
  changes against requirements, domain documentation and local QA records.
- Independent Standards and Spec reviews inspected changed code plus selected
  high-risk authentication, membership, tenant scope and public submission paths.
- Repository-wide tests/typechecking/lint/dependency auditing and searches for
  raw HTML injection, dynamic code execution, unsafe SQL, web storage and tracked
  secret/config files supplemented manual review. These pattern searches cannot
  establish that every source line or dependency is secure.
- Used isolated local database fixtures, browser checks with disabled JavaScript,
  controlled delayed responses, normal sign-in, and a standalone production
  package smoke test. Browser output and synthetic session data remain ignored.

## Standards review

Two actionable findings: credential forms defaulted to GET, and group-history
responses could reopen a dismissed dialog. Both were fixed and reproduced before
and after the fix. No additional confirmed tenant escape or critical source
issue was found in the inspected paths. This is not a penetration-test result.

## Spec review

Four actionable findings: login fallback URL leakage, the wrong metric for
"Fewest submissions left", active/archive pagination mixing, and dismissed group
history reopening. All four were fixed. The group filtering, numbered history,
group-goal aggregation and platform accent behavior match the continuation.
The older design predates group workflows and was not applied as a replacement
for the user's later group requirements.

## Confirmed defects fixed

| ID | Severity | Finding and correction | Evidence |
| --- | --- | --- | --- |
| SEC-01 | High | Login, invitation acceptance and reset forms omitted an HTTP method. Failed hydration could trigger native GET with passwords/reset tokens in URLs. Added `method="post"` to all three forms. | JavaScript-disabled browser checks for both login routes, invitation and reset; normal hydrated admin/reviewer sign-in and password toggles also pass. |
| BUG-02 | Medium | "Fewest submissions left" sorted authored submission count instead of remaining-to-goal. It now uses remaining work, puts unconfigured goals last and resolves ties by name/ID. | Failing then passing unit cases include different goals, reached goals, no-goal reviewers and stable ties. |
| BUG-03 | Medium | An active-review load-more response could append rows/cursor into the archived view. Added request generation checks and invalidation on view changes/unmount. | Controlled browser response failed before the fix and passes afterward, with neither stale active rows nor cursor in archived results. |
| BUG-04 | Medium | Closing group history during a filter request reopened it when the request finished. Dismissal/unmount now invalidate pending state updates. | Controlled browser response reproduced reopening before the fix; dialog remains closed afterward. |
| BUG-05 | High for affected packages | Custom `NEXT_DIST_DIR` builds copied JS/CSS into hardcoded `.next/static`, leaving packaged pages unhydrated. Packaging now copies assets into the configured build directory. | Default/custom packaging tests; real custom package initially returned 404 for all 15 referenced JS/CSS URLs, then 200 for every asset after correction and restart. |

Source references:

- SEC-01: `apps/web/src/features/auth/login-form.tsx:59`,
  `apps/web/src/features/auth/invitation-acceptance.tsx:55`,
  `apps/web/app/reset-password/page.tsx:52`.
- BUG-02: `apps/web/src/features/progress/reviewer-board.ts:67`.
- BUG-03: `apps/web/src/features/progress/reviewer-progress-board.tsx:25`.
- BUG-04: `apps/web/src/features/team/reviewer-groups-manager.tsx:54`.
- BUG-05: `apps/web/scripts/prepare-hostinger-standalone.mjs:32`.

POST fallback prevents URL serialization; authentication and account acceptance
still require JavaScript. It does not erase URLs or logs created before the fix.
If actual production credentials were submitted in a URL, rotate affected
credentials and assess retained browser/proxy logs. The reproduced tests used
only synthetic local credentials.

## Verification evidence

| Check | Result |
| --- | --- |
| `npm test` | 285 passing tests across the runner guard, contracts, domain, API and web; zero failures. |
| `npm run typecheck` | Passed for all workspaces. |
| `npm run lint` | Zero errors; eight existing unused-variable warnings remain in unrelated files. Two prior effect-dependency warnings in the touched drawer were resolved. |
| `npm audit --json` | Zero known vulnerabilities reported, including development dependencies, at review time. |
| `npm run build` | Full API/web production build passed. |
| `npm run build:hostinger:web` and package preparation | Passed, including standalone runtime dependencies. Build used the reserved `https://api.reviewroom.invalid` placeholder and an isolated output directory. This artifact is local validation output, not a production-ready origin configuration. |
| Standalone runtime on local port 5055 | Login page returned 200; all 15 referenced JS/CSS URLs returned 200; nonce CSP present. No production API was contacted. |
| `verify-group-workflows-local.mjs` | 395 checks passed in each retained-fixture run; original database rows preserved. Fixtures cleaned after browser verification. |
| Browser regressions | Hydrated admin/reviewer login, password show/hide, HttpOnly cookies, no-JS POST fallbacks, group dismissal and pagination races passed. Scripts retained under `scripts/browser/`. |
| `git diff --check` | Passed. |

Bounded smoke traffic against local development services used concurrency 6:

| Scenario | Requests | p50 | p95 | Unexpected results |
| --- | ---: | ---: | ---: | ---: |
| MySQL readiness | 30 | 2.4 ms | 12.8 ms | 0 |
| Invalid public-link lookup | 30 | 3.2 ms | 4.1 ms | 0 |
| Login HTML | 20 | 220.3 ms | 229.2 ms | 0 |

These are small localhost samples, not production capacity estimates or an
authenticated dashboard/submission load test. Do not use their throughput to
size the Hostinger deployment.

## Prioritized improvements

| Priority | Change | Why and acceptance evidence |
| --- | --- | --- |
| Before production | Verify hosting-side auto-deploy, exact Node/root/output/entry settings, environment origins, migration credentials and connection budget. | A main push may invoke production migration. First deploy to staging and rehearse backup restore, additive migration, cutover and rollback. |
| Before production | Exercise HTTPS, cookies, CSRF/CORS, CSP and forwarded client IP through the actual proxy. | `apps/api/src/app.ts:29` trusts one proxy hop by default; source cannot prove the deployed topology. Test spoofed forwarding headers, real client-IP limits and direct API exposure. |
| Next reliability work | Add database-backed integration and browser regression jobs to CI using ephemeral fixtures. | `.github/workflows/ci.yml` currently runs unit/source checks and builds without a provisioned MySQL workflow environment. Include tenant denial, concurrent edits/submissions, disabled hydration and delayed-request cases. |
| Next performance work | Measure group history query plans with realistic tenants, then separate reviewer summaries from page requests and bound reviewer/group lists. | `apps/api/src/modules/members/group.routes.ts:166` aggregates full history and loads all reviewer metadata for every page. The 100-row submission page limit does not bound aggregate or metadata work. Preserve tenant scope and current-membership history semantics. |
| Next performance work | Reduce list-row payload construction after measurement. | `group.routes.ts:178` reads answers and published definitions to derive a display name for every row. Evaluate a validated submission display-name snapshot or a smaller projection, with a backfill/compatibility plan before changing schema. |
| Next stability work | Extend existing request IDs/health/logging with endpoint latency histograms, DB pool wait time, process memory and error alerts. | Record p50/p95/p99 and timeout/error rates on authenticated dashboards and submission writes under sustained/burst staging traffic; keep tokens, passwords and answers out of telemetry. |
| Before multiple API replicas | Enforce shared rate limiting at the gateway and budget DB connections across all processes. | `apps/api/src/http/rate-limits.ts` uses per-process memory counters. A pool cap of 10 applies to each API process, not each reviewer account; verify actual host quotas. Redis is not required by the current architecture. |
| Next UI/UX work | Trap/restore keyboard focus and lock background scrolling in the reviewer drawer. Localize derived submission-status strings and the single-reviewer sort hint. | The drawer is `aria-modal` but lacks the group dialog's full focus handling (`reviewer-progress-board.tsx:75`). Derived strings in `reviewer-board.ts:20,49` remain English in French/Arabic views. Add keyboard and locale-specific browser assertions. |
| Next product work | Make group setup/activation, historical attribution, personal overrides and workspace/group goals easier to explain in context. | Separate goal units, show configuration preview state clearly, preserve reviewer-private access, and test with admins/reviewers before adding more controls. |
| Gradual structure work | Introduce shared validated contracts for group history and separate history loading from the group editor as complexity grows. | Reduce hand-written client response shapes and shared busy/error state; preserve a single server authority for permissions and goal calculations. Avoid a broad framework rewrite without measured need. |

The current two-service application and relational database are a reasonable
starting point for this workflow. Focus on correct tenant boundaries, bounded
queries, observable failures and verified operations before adding more services.

## Remaining limits

No live Hostinger configuration, production migration/restore, external
penetration test, long-duration load test, full screen-reader audit or exhaustive
browser/device matrix was performed. Accessibility/localization follow-ups and
eight lint warnings remain explicit work items. Dependency auditing only covers
known advisories returned by the registry at the time of the check.

See `docs/deployment-readiness-review.md` for the staging release gates and
`scripts/browser/README.md` for repeatable local browser checks.
