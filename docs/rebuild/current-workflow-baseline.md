# Current Workflow Baseline

**Captured:** 2026-10-23  
**Evidence class:** repository inspection plus user-provided production screenshots/log excerpts. No direct production login, write, or database query was run for this baseline.

This document is an operational snapshot, not a claim that the reported failures still reproduce against the latest deployment. The user-provided screenshots and logs are summarized without copying credentials, raw invitation/review tokens, or personal response content.

## Roles and tenant boundary

| Actor | Intended scope | Current source evidence | Known issue/evidence |
|---|---|---|---|
| Owner/admin membership | Manage one organization: people, team, assignments, forms, submissions, settings, audit | Membership role enum and API auth middleware; `/admin/*` pages | User reported assignment controls and people loading failed in production. |
| Reviewer membership | Assigned targets, own submissions/progress, own reviewer links | Reviewer-scoped routes and assignment model | User reported reviewer assignment/access flow did not work as expected. |
| Public link holder | One reviewer-bound, active public review link and its permitted targets/form | `/r/:token` and public review endpoints | Not live-tested for this baseline. |

Membership, not a global user role, is the authority boundary. All organization-owned reads and writes must use the authenticated organization ID. Admin and reviewer sessions are intended to coexist in separate role-scoped cookies.

## Workflow status

| Workflow | Intended route | Baseline status | Evidence and limitation |
|---|---|---|---|
| Admin sign-in | `/admin/login` | Implemented in current source; not end-to-end verified | Existing tests cover role session behavior. A historical screenshot showed admin page in production, but it is not proof of current behavior. |
| Reviewer sign-in | `/reviewer/login` | Implemented in current source; not end-to-end verified | Existing tests cover role session behavior. |
| Invitation/account setup | `/invite/:token` | Implemented in current source; production acceptance failed for one reported user | A user screenshot showed an invalid-submission message after entering a malformed email (`fatima@ac.108`); the image does not establish whether the email format, password confirmation, token, or another validation caused it. |
| People/targets | `/admin/people` | Current code has target routes; reported live failure | Production UI showed “People could not load” with HTTP 500 and reference `bf93be77-da69-4933-bc50-726a2b0a5ea4`. Logs supplied later included Prisma error `P2039`; the exact failing query, deployed schema/client pairing, and current reproducibility remain unverified. |
| Assignment | Admin team access and assignment API | Assignment model/service exist; historical workflow reported broken | User reports reviewer assignment choices were missing or unavailable, and requested Team Access as sole assignment-management surface. No staging workflow has yet been run. |
| Reviewer share link | Reviewer panel/link APIs | Current source routes exist; not end-to-end verified | Requires assigned-target authorization and link lifecycle test. |
| Public submission | `/r/:token` | Current source route exists; not end-to-end verified | Must test exact published version, idempotency, revocation, assignment changes, and receipt. |
| Admin/reviewer inbox | Submissions routes | Current source routes exist; not end-to-end verified | Must verify tenant and reviewer scoping directly through API and browser. |
| Password reset | `/reset-password` | Current source route exists; not end-to-end verified | Must verify one-time, membership-scoped reset and session revocation. |

## Historical server evidence

The following log excerpts were supplied by the user during earlier troubleshooting. They are historical, not fetched from Hostinger during this rebuild:

- Repeated `PrismaClientKnownRequestError`, code `P2039`, logged as `http.unhandled_error` on `GET /` (the logger showed route `/`, so the original mounted API path is not recoverable from that excerpt).
- `express-rate-limit` validation error because the request included `X-Forwarded-For` while Express `trust proxy` was false. This indicates a proxy configuration mismatch; the correct trust boundary must be based on verified Hostinger proxy behavior.
- A failed API deployment while running the owner bootstrap reported that the configured bootstrap email already had an account. That is a bootstrap idempotency/configuration issue, distinct from the later People API 500.

The request ID for the People UI failure is retained above. Do not infer a root cause from that error code alone. Obtain correlated route/controller diagnostics from staging, inspect the generated Prisma client and migration state, and run the failing query against an isolated staging copy before fixing it.

## Existing route/API inventory pointers

- Browser routes and rewrite behavior: `docs/routing-and-workspace-architecture.md`
- API modules and health routes: `docs/rebuild/current-runtime-baseline.md`
- Current entity definitions: `apps/api/prisma/schema.prisma`
- Current test and environment limitations: `docs/rebuild/test-environments.md`

## Verification still required

For each workflow above, capture a staging request ID, API result, role, organization scope, browser width, and final state. Test both expected success and denied/error paths. No screenshot or anecdotal production observation counts as a staging release gate. Do not use production accounts, production database credentials, or live tokens in automated tests.
