# ReviewRoom Platform Rebuild Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Follow test-driven development for every behavior change and verification-before-completion before marking any phase complete.

**Goal:** Deliver a clean, maintainable replacement for ReviewRoom’s admin, reviewer, public review, API, authentication, and persistence workflows, with reliable reviewer assignment and a verified, non-destructive production-data cutover path.

**Architecture:** Build the replacement alongside the active application in the existing npm-workspaces monorepo. Keep the current Next.js/React + Express + Prisma/MySQL deployment shape unless a documented feasibility test proves it cannot meet requirements. Put domain rules in pure domain services, tenant-scoped persistence behind repositories, validated/versioned contracts in shared packages, and role-specific responsive UI in feature modules. Deploy to isolated staging first. Preserve production data and switch traffic only after migration, restore, security, workflow, and Hostinger gates pass.

**Tech Stack:** TypeScript; npm workspaces; Next.js 16 / React 19; Express 5; Zod; Prisma 7 with the current MariaDB adapter; MySQL-compatible database; Node `>=22.12 <23 || >=24 <25` until CI and Hostinger runtime selection are fixed. Tests: existing Node test runner in `apps/api` and `apps/web`; add MySQL integration tests and Playwright browser E2E as explicit dependencies. Do not introduce Docker, PM2, Nginx, Redis, or always-on workers as a managed-hosting requirement.

**Design specification:** `docs/superpowers/specs/2026-10-23-reviewroom-platform-rebuild-design.md`.

## Global Constraints

- Production remains on the current application until explicit cutover approval. This plan does not authorize production changes.
- Never reset or destructively rewrite production tables. Use additive/expand-contract migrations, verified backfills, integrity reports, backup and restore rehearsals, and a rollback plan.
- Do not copy `.env`, real credentials, live passwords, bearer tokens, or unredacted personal data into code, tests, artifacts, or documentation.
- Team Access is the sole assignment management surface. People is for review-target records; do not re-add a competing assignment UI there.
- Assignment semantics: one active reviewer per target; active same-organization entities only; deterministic least-loaded balancing; existing assignments stay unless an admin explicitly changes them; if no eligible reviewer exists, target is unassigned; reassigning never deletes historical submissions.
- Auth is membership-scoped and role-specific. Preserve opaque revocable sessions unless a new security review supports a different design. JWT is not an assumed requirement.
- Domain/API authorization remains authoritative. UI visibility and middleware route redirects are supplementary.
- Keep public URL and API compatibility while the old client or production data still depends on them. Document any intentional versioned change.
- For each behavior task, write/update a focused failing test first, implement the minimum complete vertical slice, then rerun focused and workspace checks.
- Every query/mutation is organization-scoped, every write has explicit transaction/audit/concurrency semantics, and every UI request has loading/empty/error/retry states.

## Phase 0 — Inventory, Baseline, and Product Freeze

### Task 0.1 — Record the current product and runtime baseline.

- [x] Update `docs/CONTEXT.md`, `docs/architecture.md`, `docs/routing-and-workspace-architecture.md`, and `docs/hostinger-deployment.md` only where current source has drifted. Inventory `apps/api/prisma/schema.prisma`, migrations, API routers, Next route map, deployment build scripts, environment examples, existing tests, and data constraints. Include exact commands and record pass/fail without exposing secrets. Confirm the two Hostinger apps, current Node version, entry/output paths, and DB version in staging or account settings before locking deployment parameters.
### Task 0.2 — Establish a safe test environment.

- [x] Add `docs/rebuild/test-environments.md` and scripts/configuration for isolated local MySQL and staging DBs. Add an explicit guard that refuses migration/seed/cleanup when the database host/name matches configured production markers. Never use production as an integration-test target.
### Task 0.3 — Baseline actual workflows.

- [ ] Complete `docs/rebuild/current-workflow-baseline.md` using redacted staging screenshots and correlated request/API traces for every workflow. The current document records repository routes and historical user-provided evidence, which is not a substitute for staging reproduction.
### Task 0.4 — Lock decisions.

- [x] Update the design decision log in `docs/rebuild/decisions.md` for roles/session model, route contract, assignment policy, archive/deletion policy, data migration, Hostinger topology, and support matrix. Any departure from the approved design spec requires a written decision before implementation.

## Phase 1 — Domain Model, Contracts, and Information Architecture

### Task 1.1 — Write the canonical domain model.

- [x] Expand `docs/CONTEXT.md` and add `docs/rebuild/domain-model.md` with Organization, User, Membership, Session, ReviewTarget, Assignment, Form, FormVersion, ReviewLink, Submission, Invitation, PasswordResetToken, and AuditEvent relationships. Specify tenant ownership, uniqueness, active/archive semantics, deletion rules, actor, and lifecycle transitions. Include an ER diagram and state diagrams for Membership, Assignment, Form, and Submission.
### Task 1.2 — Define the API contract before handlers.

- [ ] Version `packages/contracts/src` schemas for auth/session, members/invitations/reset, people/targets, assignments, forms/versions, links, submissions, progress, settings, audit, pagination, and stable errors. Add schema tests rejecting unknown/oversized/malformed values. Generate or document `docs/rebuild/openapi.yaml` from the shared schemas and verify representative request/response examples against tests.
### Task 1.3 — Define permissions centrally.

- [ ] Add `packages/domain/src/permissions.ts` and table-driven tests covering owner/admin/reviewer/public access for every resource and action. Add explicit same-organization and active-membership requirements. API handlers must call use cases that enforce this policy; do not encode a second divergent policy in the web app.
### Task 1.4 — Define route and page-state maps.

- [x] Add `docs/rebuild/route-map.md` listing canonical browser URLs, page guard, API dependencies, permissions, route redirects, metadata branding, and all loading/empty/error/retry/conflict states. Preserve admin/reviewer path prefixes and public form route behavior.

## Phase 2 — Design System and UX Foundation

### Task 2.1 — Create design tokens and panel shells.

- [ ] Replace ad hoc style growth in `apps/web/app/globals.css` with documented semantic tokens for typography, colors, spacing, dimensions, responsive breakpoints, border/focus, elevation, motion, and safe-area insets. Implement Admin Panel and Reviewer Panel shells with role-specific navigation and stable mobile navigation. Validate theme values through shared schemas; arbitrary CSS/URLs remain rejected.
### Task 2.2 — Build accessible primitives.

- [ ] Add tested shared UI components in `apps/web/src/components/ui/` for inputs, password visibility, buttons, badges, page headers, cards, tabs, responsive data list/table, pagination, skeletons, empty/error states, retry, toast, dialog, drawer, confirmation, avatar, and form controls. Add tests for keyboard operation, visible focus, labels/errors, accessible names, reduced motion, Escape handling, and 44px touch targets.
### Task 2.3 — Build responsive feature foundations.

- [ ] Add page layouts for admin, reviewer, account setup, and public review. Use mobile cards for operational records; avoid horizontal overflow at 320px. Add visual/browser assertions for 320px, 375px, 452px, tablet, and wide desktop. Keep action menus and bottom navigation clear of safe areas and virtual keyboards.
### Task 2.4 — Add a reusable API client and state model.

- [ ] Replace feature-level raw fetch/error handling with typed `apps/web/src/lib/api-client.ts` wrappers that include cookies/CSRF, same-origin API path, abort signals, runtime response parsing, stable errors, and request IDs. Add client tests for 401/403/409/422/429/500, offline, aborted/stale requests, malformed envelopes, retry, and no private-response caching.

## Phase 3 — Authentication, Membership, and Security Core

### Task 3.1 — Implement session and credential domain services.

- [ ] Refactor `apps/api/src/modules/auth/` around membership-scoped credentials and hashed opaque sessions. Add integration tests for correct/incorrect role, wrong password, inactive/archived membership, expiry, revocation, cookie flags, CSRF, origin checks, simultaneous admin/reviewer sessions, and same-browser role navigation. Opening `/admin/*` must not silently redirect into a reviewer session.
### Task 3.2 — Implement separate sign-in and guards.

- [ ] Build `/admin/login` and `/reviewer/login` with distinct copy, role-specific submit, no cross-panel login link, generic credential failure, pending state, and allowlisted same-role return target. Update `apps/web/src/lib/page-access.ts`, `proxy.ts`, and API auth middleware so browser guards and API checks agree. Add Playwright tests for direct deep links, concurrent role cookies, wrong-role access, logout, and no open redirects.
### Task 3.3 — Implement invitations and account setup.

- [ ] Build invitation create/reveal/revoke/rotate/accept use cases and UI under Team Access; verify one-use, expiry, intended email, intended role, organization, and replay behavior. Add reviewer account setup browser tests; invitation state must not reuse password reset or review-link tokens.
### Task 3.4 — Implement password reset and session revocation.

- [ ] Add admin-issued, membership-scoped, one-time reset flows, API error contracts, explicit expiry/revocation UI, and tests proving only the selected membership’s sessions are invalidated. Use secure password hashing and bounded attempts; do not reveal account existence in public recovery responses.
### Task 3.5 — Harden API infrastructure.

- [ ] Review and test `apps/api/src/server.ts`, middleware, configuration, and logging: strict env validation, proxy trust only for confirmed host proxy ranges, request IDs, Helmet, CSP integration, body limits, safe 404/500, rate-limit policy, timeouts, graceful shutdown, readiness/liveness, redaction, and no-store headers. Test forwarded headers through the actual staging proxy before setting trust behavior.

## Phase 4 — People, Team Access, and Assignment (Critical Path)

### Task 4.1 — Define assignment policy as pure functions.

- [x] Add `packages/domain/src/assignment-policy.ts` with eligibility, deterministic least-load selection, tie-breaking, rebalancing scope, and stale-version decisions. Add table-driven tests for zero reviewers, one/multiple reviewers, workload ties, archived reviewers/targets, organization mismatch, existing assignments, and retry/idempotency.
### Task 4.2 — Create tenant-safe persistence constraints.

- [ ] Update `apps/api/prisma/schema.prisma` and a forward-only migration to enforce unique active target assignment per organization, same-organization relations, indexes for reviewer workload and target lookup, and optimistic version data. Add migration preflight/report scripts that stop on orphan/cross-tenant records; never auto-delete or silently reassign during migration.
### Task 4.3 — Implement assignment application service.

- [ ] Consolidate assignment creation, change, unassign, auto-assignment, reviewer activation/removal rebalancing, concurrency handling, and audit in one service under `apps/api/src/modules/assignments/`. Use transactions and deterministic locks/order to prevent two requests from assigning the same target or producing inconsistent load decisions. Add MySQL integration tests with concurrent requests and two organizations. Preserve submissions when assignment changes.
### Task 4.4 — Implement target/person operations.

- [ ] Refactor `apps/api/src/modules/people/` or the current target module to support tenant-scoped create/list/update/archive, search, bounded pagination, and explicit assignment summary. New targets should invoke assignment policy once. Remove assignment mutation controls/endpoints from People UI while preserving safe compatibility aliases only if existing clients require them.
### Task 4.5 — Build the Team Access assignment hub.

- [ ] Refactor `apps/web/src/features/team/` into member access and assignment sections; add reviewer workload rows and target assignment list/cards with search, filters, counts, assign/reassign/unassign, bulk preview, conflict refresh, accessible confirmations, and empty/error/retry states. Include only active reviewer memberships in choices. Add Playwright tests for adding a reviewer, accepting invite, automatic balance, assignment changes, no reviewers, and mobile layout.
### Task 4.6 — Keep People focused on targets.

- [ ] Refactor `apps/web/src/features/people/` to add/edit/archive target details and show current reviewer as read-only context linking to Team Access. Verify no second assignment control remains and API failure displays the request reference plus retry rather than `0 people loaded` alone.
### Task 4.7 — Add assignment security regression suite.

- [ ] Test every route by admin/reviewer/public role, direct IDs, guessed IDs, cross-organization references, archived entities, reviewer removal, link revocation, stale writes, and simultaneous writes. Verify a reviewer can never list another reviewer’s target or submission through UI or direct API.

## Phase 5 — Forms, Links, and Public Review

### Task 5.1 — Rebuild form draft and editor flow.

- [ ] Refactor `apps/api/src/modules/forms/` and `apps/web/src/features/forms/` against shared versioned contracts. Implement draft state, dirty-state indicator, save/retry/conflict, field palette and type-specific editor, reorder/delete confirmation, accessible preview, and responsive editor. Preserve current supported field catalog and add a test for each field type.
### Task 5.2 — Implement immutable publication.

- [ ] Add publish validation and transaction that creates an immutable version, advances current published pointer, and records audit. Add MySQL tests for invalid definitions, concurrent publish, version immutability, draft changes after publish, archive/restore, and submissions referring to an exact version.
### Task 5.3 — Rebuild reviewer link lifecycle.

- [ ] Refactor `apps/api/src/modules/review-links/` and `apps/web/src/features/review/` to create/reveal/rotate/revoke/expire reviewer-specific links. Hash secrets at rest, encrypt only when safe reveal-after-creation is an approved requirement, and audit reveal/rotation. Test expiry, revocation, membership removal, organization/form scope, and token replay.
### Task 5.4 — Rebuild public renderer and submission path.

- [ ] Implement `/r/:token` read/submit contracts, minimal response DTO, exact published-version rendering, server-side validation, idempotency, duplicate-submit behavior, receipt, accessible field errors, and neutral expired/revoked/unavailable screen. Add browser tests for valid submission, all field types, invalid payloads, duplicate requests, changed assignment, changed form version, and token isolation.

## Phase 6 — Submission, Reviewer Workspace, Progress, and Settings

### Task 6.1 — Rebuild submissions inbox/detail.

- [ ] Implement admin/reviewer-scoped list, cursor pagination, filters, mark-reviewed/reopen if supported, archive/restore, detail and answer rendering. Add DB/API tests for organization/reviewer scope, lifecycle, exact form version, and retention semantics. Ensure reviewer routes never return other reviewers’ responses.
### Task 6.2 — Rebuild reviewer home and personal links.

- [ ] Implement assigned workload, progress, own submissions, personal link state, sign-out, and no-assigned-work state in `apps/web/src/features/reviewer/` (create the feature module if missing). Add browser E2E for a reviewer through assignment to submission and prevent direct access to unassigned targets.
### Task 6.3 — Rebuild progress calculations and overview.

- [ ] Centralize pure progress calculations in `packages/domain/src/progress.ts`; define denominators and archive behavior. Build admin overview and reviewer progress pages with correct filters, stable counts, responsive charts/summary, and links to the underlying records. Add edge tests for zero goal, unassigned target, multiple submissions, archived response, and missing reviewer.
### Task 6.4 — Rebuild workspace settings and appearance.

- [ ] Implement organization identity, progress goal, safe theme presets, unsaved preview, save/conflict states, and restore defaults. Add API tests for owner/admin permissions and unsafe theme rejection; browser tests prove the saved theme appears on both panels and public forms.
### Task 6.5 — Complete audit views and operational transparency.

- [ ] Add tenant-safe audit query/filter/pagination and admin-only UI for critical access/assignment/form/submission changes. Ensure PII-sensitive answers and secrets are not logged or displayed in audit metadata.

## Phase 7 — Data Migration, Compatibility, and Cutover Tooling

### Task 7.1 — Write a field-by-field mapping.

- [ ] Add `docs/rebuild/data-migration-map.md` mapping every current model/field/index/foreign key to the replacement schema, including memberships, credentials, sessions, assignment history, immutable versions, links, submissions, settings, and audit. Explicitly classify preserve, transform, expire/reissue, derive, or excluded data with justification.
### Task 7.2 — Implement preflight and dry-run migration.

- [ ] Add `apps/api/src/scripts/rebuild-preflight.ts` and `rebuild-dry-run.ts` to read-only inspect source data, detect orphan/cross-tenant relationships, duplicate assignments, invalid versions, malformed answers, and missing membership credentials; output redacted counts and stable row references. Nonzero integrity errors stop migration.
### Task 7.3 — Implement resumable, idempotent backfill.

- [ ] Add a versioned migration tool under `apps/api/src/scripts/migrations/` with checkpoints, bounded batches, transaction boundaries, retry semantics, progress reporting, and no secret/personal-data logs. Add tests that interrupt/restart each batch and prove counts and checksums converge without duplicates.
### Task 7.4 — Reconcile and rehearse restore.

- [ ] Add `docs/rebuild/cutover-runbook.md` covering staging snapshot, backup restore, baseline counts/checksums, migration, application smoke, role/assignment workflows, rollback schema compatibility, and post-cutover monitoring. Rehearse with sanitized production-shaped data and document results. Do not point tool defaults at production.
### Task 7.5 — Preserve API/web compatibility during transition.

- [ ] Add contract tests for legacy browser/API routes still used by the current live version. Use additive endpoints or explicit adapters until the new version is deployed. Remove old aliases only after telemetry/log review shows no callers and the rollback window closes.

## Phase 8 — Quality, Security, Accessibility, and Capacity

### Task 8.1 — Establish complete test layers.

- [ ] Keep existing workspace Node tests. Add MySQL integration test setup/teardown safeguards and Playwright configuration, fixtures, and role/tenant seed helpers. Add CI stages for install, lint, typecheck, unit, migration, integration, browser, and production build. CI never uses production DB or secrets.
### Task 8.2 — Complete workflow E2E suite.

- [ ] Add `apps/web/e2e/` tests for owner bootstrap on an empty test DB, admin/reviewer same-browser sessions, invitation setup, automatic/manual assignment, reviewer link sharing, public submission, admin inbox, role isolation, password reset, archive/restore, and refresh/retry/conflict paths.
### Task 8.3 — Run accessibility and browser matrix.

- [ ] Add automated axe checks and keyboard tests; record manual checks in `docs/qa/rebuild-browser-matrix.md` for supported Chromium, Firefox, WebKit/Safari, mobile widths, touch/signature fallback, reduced motion, zoom, and virtual keyboard. Fix critical/serious accessibility issues before release.
### Task 8.4 — Perform targeted security review.

- [ ] Use `docs/security-and-deployment-audit-2026-10-22.md` as historical evidence, then re-review the new implementation. Test CSRF, role/tenant authorization, rate limits through actual proxy, session fixation/revocation, token purpose/expiry, CSP, cache controls, request size, log redaction, and migration permissions. Record accepted residual risks; a source scan is not a penetration test.
### Task 8.5 — Measure performance and capacity.

- [ ] Add a reproducible isolated load profile in `scripts/load/` for login/session lookup, assignment lists and mutations, public form read/submit, and submission inbox. Test expected traffic, 3× sustained traffic, and short burst against staging with production-like DB sizing. Capture p50/p95/p99, throughput, 4xx/5xx, timeouts, CPU/memory, pool wait, DB active connections, query latency, and saturation point in `docs/rebuild/load-test-results.md`. Tune indexes/pagination/pool limits based on evidence; do not promise arbitrary traffic.
### Task 8.6 — Verify production build and local production start.

- [ ] Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, MySQL migration/integration checks, browser E2E, `npm run build`, and local production start health smoke. Record exact versions/output in `docs/rebuild/release-evidence.md`.

## Phase 9 — Hostinger Staging, Release, and Operational Handoff

### Task 9.1 — Confirm actual managed-hosting compatibility.

- [ ] Verify current Hostinger docs/account for Node 22/24 availability, app slots, root directory behavior, build/output/entry conventions, startup behavior, injected `PORT`, proxy headers, runtime filesystem, request timeout, process/memory/DB limits, domains/TLS, and app-to-app API reachability. Update `docs/hostinger-deployment.md` only with verified values and evidence. If any hard requirement fails, stop and choose a compatible hosting architecture before cutover.
### Task 9.2 — Configure and deploy isolated staging apps.

- [ ] Create separate staging web/API apps using the confirmed repository revision and `.env.example` names only as key references. Put real values in Hostinger secret settings; use a staging DB and unique secrets. Confirm standalone/output folder includes Next runtime dependencies, API entry works, and environment changes are applied at the expected build or runtime phase.
### Task 9.3 — Verify staging end to end.

- [ ] Run health liveness/readiness, admin/reviewer simultaneous session checks, invitation/reset, assignment auto-balance and reassignment, form publish, reviewer link, public submit, admin/reviewer inbox, mobile/accessibility smoke, 404/500/log correlation, restart, and backup restore. Check TLS, cookies, CSP, CORS, CSRF, proxy IP handling, cache headers, DB pool, and no leaked environment values.
### Task 9.4 — Prepare rollback and operational runbooks.

- [ ] Update `DEPLOYMENT.md` and add `docs/runbooks/incident-response.md`, `database-restore.md`, `hostinger-rollback.md`, and `credential-rotation.md`. Define health/error thresholds, who acts, log access, backup schedule/retention, migration ordering, known host limits, and rollback criteria.
### Task 9.5 — Request release review before production.

- [ ] Produce a review packet with commit SHA, migration diff, test/build evidence, data reconciliation, load result, residual risks, backup/restore proof, Hostinger config, and exact rollback steps. Production schema migration, deployment, DNS/domain change, or GitHub push happens only after a separate explicit release authorization.

## Verification Commands

Run from the repository root, with a disposable MySQL test database configured for integration tasks:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run db:generate
npm run db:migrate
npm run test:integration
npm run test:e2e
npm run build
npm run start:hostinger:api
npm run start:hostinger:web
```

The two start commands run in separate terminals/processes. Verify `/api/v1/health/live`, `/api/v1/health/ready`, web login routes, and the complete E2E workflow. Do not run migrations or tests against production. If root script names change, update this plan, `DEPLOYMENT.md`, CI, and the handoff runbook in the same change.

## Definition of Done

- All phases have evidence; tests cover unit, MySQL integration, browser workflow, migration safety, and accessibility.
- Every accepted domain rule has one authoritative implementation and no competing assignment flow remains.
- Admin/reviewer auth works concurrently in one browser with correct authorization across UI and API.
- Existing production data is fully mapped and reconciled in staging; backup restore and rollback were rehearsed.
- Hostinger build and runtime settings are verified on actual staging apps, with no secrets committed and no localhost production origins.
- Capacity results, known limits, residual risks, operational owners, and recovery steps are documented.
- User has reviewed the release packet and separately authorized any production cutover. Planning approval alone is not a deployment instruction.
