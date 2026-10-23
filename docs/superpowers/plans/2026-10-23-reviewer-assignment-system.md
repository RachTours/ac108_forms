# Reviewer Assignment System Implementation Plan

> **For agentic workers:** Implement tasks in order and review each deliverable before continuing. Steps use checkbox syntax to track progress.

**Goal:** Rebuild reviewer assignment management as one reliable, tenant-safe workflow in Team access while keeping the People page focused on people and preserving production records.

**Architecture:** Keep one current assignment per active target. Centralize all reads and writes in an assignment domain service, expose a paginated API, and make Team access the sole assignment UI. Enforce same-organization relations in MySQL and keep submissions/audit events as history.

**Tech Stack:** TypeScript, Express 5, Prisma 7, MySQL/MariaDB, Next.js 16 App Router, React 19, Zod, Node's built-in test runner.

## Global Constraints

- Each active review target has zero or one active reviewer in its organization.
- Only active reviewer memberships in the same organization may receive assignments.
- Only active review targets may be assigned.
- The API remains the sole authority for reviewer assignment and access.
- Reassignment keeps submissions as historical evidence; completion remains based on the current assignee.
- Unassigning or archiving a target does not delete submissions.
- Archiving or changing a reviewer to an administrator removes active assignments and revokes reviewer sessions/links while retaining submission and audit history.
- Repeating the same assignment is idempotent and creates no duplicate change event.
- Team access is the only place with assignment controls; People is for adding, editing, archiving, searching, and viewing people.
- Existing production assignment, target, member, submission, and audit records must survive migration.
- No migration may silently delete, rewrite, or reassign invalid records; preflight must report and stop.
- Protected mutations retain session, role, CSRF, organization scope, and standard API error response checks.
- Hostinger frontend runtime must use the deployed API origin, not an assumed localhost port when the API is a separate application.

---

## File map

| File | Responsibility in this change |
| --- | --- |
| `apps/api/prisma/schema.prisma` | Add assignment concurrency version and composite same-organization relations/indexes. |
| `apps/api/prisma/migrations/202610230001_assignment_integrity/migration.sql` | Non-destructive migration adding required indexes and composite foreign keys. |
| `apps/api/src/scripts/check-assignment-integrity.ts` | Run a read-only preflight against an existing database and fail before migration when tenant-invalid assignment rows exist. |
| `apps/api/package.json` | Add the `db:assignment-preflight` command used by the Hostinger API build. |
| `scripts/build-hostinger-api.mjs` | Generate the Prisma client, run the integrity preflight, and only then apply migrations. |
| `apps/api/src/modules/assignments/assignment.schemas.ts` | Validate list filters and mutation payloads. |
| `apps/api/src/modules/assignments/assignment.service.ts` | Single implementation of listing, assignment, reassignment, unassignment, counting, and audit behavior. |
| `apps/api/src/modules/assignments/assignment.routes.ts` | Owner/admin API boundary for assignment list and mutations. |
| `apps/api/src/modules/assignments/assignment.service.test.mjs` | Test tenant boundaries, active state, idempotency, races, and transaction behavior. |
| `apps/api/src/modules/targets/target.routes.ts` | Keep temporary route aliases delegated to the service; remove inline reviewer creation and duplicate business logic. |
| `apps/api/src/modules/targets/target.schemas.ts` and `target.schemas.test.mjs` | Make target creation independent from assignment. |
| `apps/api/src/modules/members/member.routes.ts` | Derive reviewer assignment counts from active targets and use a shared transaction helper to remove assignments when a reviewer is archived or promoted to admin. |
| `apps/api/src/app.ts` | Mount the new assignment router under `/api/v1/assignments`. |
| `apps/api/src/modules/assignments/assignment.routes.test.mjs` | Check auth, role, CSRF, query validation, and response/error contracts. |
| `apps/web/app/(workspace)/team/page.tsx` | Load core team data independently from optional forms, links, and invitations. |
| `apps/web/src/features/team/team-manager.tsx` | Render the central assignment workspace, server-derived counts, and independent section errors. |
| `apps/web/src/features/team/reviewer-assignment-manager.tsx` | Replace first-page local filtering with server search, state/reviewer filters, explicit save, conflict handling, and accessible mobile results. |
| `apps/web/src/features/team/assignment-view.ts` and `.test.mjs` | Keep only pure assignment display/filter helpers needed by Team access. |
| `apps/web/app/(workspace)/people/page.tsx` | Load only people-management data and stop coupling the page to reviewer/member fetches. |
| `apps/web/src/features/people/people-manager.tsx` | Remove assignment-specific filters, reviewer column, and assignment wording. |
| `apps/web/src/features/people/assignment-view.ts` and `.test.mjs` | Remove obsolete assignment-specific People filters/count helpers after confirming no other consumer remains. |
| `apps/web/src/components/workspace-shell.tsx` | Change the admin navigation label “Review targets” to “People.” |
| `apps/web/app/(workspace)/page.tsx` | Update the admin dashboard link label to “People” for admins while preserving “Review targets” for reviewers and preserving routes. |
| `apps/web/app/globals.css` | Style central assignment states and mobile layout; remove obsolete People assignment styles. |
| `apps/api/src/modules/submissions/public-review.routes.ts` | Confirm current assignment remains the source of public link access; adjust only to use the shared read helper if needed. |
| `apps/api/src/modules/progress/progress.routes.ts` | Align active counts/completion queries with the same active-assignment rule. |
| `docs/architecture.md` | Document assignment route/service ownership and tenant integrity. |
| `docs/CONTEXT.md` | Keep the product glossary/invariants aligned with the implemented rule. |
| `DEPLOYMENT.md` | Document migration preflight and frontend/API origin configuration. |

## Task 1: Add non-destructive assignment integrity migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/202610230001_assignment_integrity/migration.sql`
- Create: `apps/api/src/scripts/check-assignment-integrity.ts`
- Modify: `apps/api/package.json`
- Modify: `scripts/build-hostinger-api.mjs`
- Modify: `docs/architecture.md`

**Interfaces:**
- Produces a documented read-only SQL preflight that reports any `Assignment` whose target/reviewer is missing or belongs to a different organization.
- Produces Prisma relations from `Assignment(organizationId, targetId)` to `ReviewTarget(organizationId, id)` and `Assignment(organizationId, reviewerId)` to `Membership(organizationId, id)`.

- [ ] **Step 1: Add the composite unique keys and relations to Prisma.** Add `@@unique([organizationId, id])` to `ReviewTarget` and `Membership`; replace the two independent Assignment relations with composite relations; add `updatedAt` to `Assignment`. Keep `@@unique([organizationId, targetId])` and existing rows.
- [ ] **Step 2: Generate migration SQL without applying it to production.** Add parent composite keys, drop old single-column assignment FKs, then add composite FKs with existing cascade behavior and `Assignment.updatedAt` populated from `createdAt`. Do not add `DELETE`, `TRUNCATE`, or destructive updates.
- [ ] **Step 3: Implement read-only preflight using the generated Prisma client's raw query API.** Query `INFORMATION_SCHEMA.TABLES` for `Assignment`; if absent on a clean install, report “no existing assignment data” and continue. Otherwise query missing/cross-organization target and membership relations and print only row IDs and organization IDs.
- [ ] **Step 4: Fail safely when preflight finds invalid rows.** Exit non-zero before migration and tell the operator to review the reported rows. Do not auto-repair or log personal data.
- [ ] **Step 5: Wire the Hostinger build order.** Add API script `db:assignment-preflight` as `tsx src/scripts/check-assignment-integrity.ts`. In `scripts/build-hostinger-api.mjs`, run `db:generate`, `db:assignment-preflight`, then `db:migrate`; remove the later duplicate generate call.
- [ ] **Step 6: Review clean-install and failure behavior.** Confirm a clean database with no Assignment table passes preflight and a dirty existing database stops before constraint changes.
- [ ] **Step 7: Add migration acceptance checks.** Verify existing valid assignments remain addressable and a cross-organization insert is rejected by MySQL after migration.
- [ ] **Step 8: Commit the schema/migration slice.** Include only the migration, Prisma schema, preflight, build-script ordering, and architecture update.

## Task 2: Build the single assignment domain service

**Files:**
- Create: `apps/api/src/modules/assignments/assignment.schemas.ts`
- Create: `apps/api/src/modules/assignments/assignment.service.ts`
- Create: `apps/api/src/modules/assignments/assignment.service.test.mjs`
- Modify: `apps/api/src/modules/members/member.routes.ts`

**Interfaces:**
- `listAssignments(transaction, input)` accepts `{ organizationId, reviewerId?, state, search, cursor?, limit }` and returns `{ rows, nextCursor, counts }`.
- `setAssignment(transaction, input)` accepts `{ organizationId, actorId, targetId, reviewerId, expectedUpdatedAt }` and returns the authoritative assignment plus whether the state changed.
- `removeAssignment(transaction, input)` accepts `{ organizationId, actorId, targetId, expectedUpdatedAt }` and returns `{ removed }`, treating an already absent assignment as a successful retry.
- Service functions receive a Prisma transaction client and never read organization/reviewer IDs from untrusted session-less data.

- [ ] **Step 1: Define Zod schemas for filters and payloads.** Limit `limit` to 100; allow state values `all`, `assigned`, and `unassigned`; trim search; require UUIDs; validate ISO timestamps for optimistic concurrency.
- [ ] **Step 2: Write service tests for list filtering and scoping.** Include other-organization targets, archived targets, inactive reviewers, reviewer-filtered views, unassigned state, name/email search, and deterministic cursor order.
- [ ] **Step 3: Write service tests for writes.** Cover initial assign, reassign, unassign, same-reviewer retry, repeated unassign, inactive target/reviewer rejection, cross-org rejection, stale version conflict, and audit records only for actual changes.
- [ ] **Step 4: Run the focused tests and confirm the new cases fail before implementation.** Use the API workspace's Node test runner against the built `dist` module.
- [ ] **Step 5: Implement list queries using bounded server-side search and counts.** Search target display name/email; filter only active targets; include assignment reviewer only when the membership belongs to this organization and is active. Return stable page metadata and counts from the database.
- [ ] **Step 6: Implement transactional mutation with compare-and-swap.** Add `updatedAt` to `Assignment`. For creation require no existing assignment; for update/delete compare `expectedUpdatedAt`. Return a conflict on a stale competing change. If a retry already produced the requested current state, return success without another audit event.
- [ ] **Step 7: Keep audit metadata stable and private.** Record target ID, previous reviewer ID, new reviewer ID, and operation source; do not store form answers, passwords, session tokens, or review-link secrets.
- [ ] **Step 8: Make member counts count only active targets.** Replace raw `_count.assignments` with a query/aggregate filtered by organization and target active/archive state; use the same result shape for the Team UI.
- [ ] **Step 9: Run focused service tests and API typecheck.** Resolve failures before proceeding.
- [ ] **Step 10: Commit the service slice.** Include tests, schemas, service, member counts, and migration schema follow-ups if needed.

## Task 3: Expose a cohesive assignment API and compatibility aliases

**Files:**
- Create: `apps/api/src/modules/assignments/assignment.routes.ts`
- Create: `apps/api/src/modules/assignments/assignment.routes.test.mjs`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/modules/targets/target.routes.ts`
- Modify: `apps/api/src/modules/targets/target.schemas.ts`
- Modify: `apps/api/src/modules/targets/target.schemas.test.mjs`
- Modify: `apps/api/src/modules/targets/bulk-assignment.ts`
- Modify: `apps/api/src/modules/targets/bulk-assignment.test.mjs`

**Interfaces:**
- `GET /api/v1/assignments?reviewerId=&state=&search=&limit=&cursor=` returns `{ data, nextCursor, counts }`.
- `PUT /api/v1/assignments/:targetId` accepts `{ reviewerId, expectedUpdatedAt }` and returns `{ data }`.
- `DELETE /api/v1/assignments/:targetId` accepts `{ expectedUpdatedAt }`; absent assignment retries return 204, while stale existing state returns a conflict.
- Existing `/review-targets/:targetId/assignment` and `/review-targets/assignments/bulk` paths delegate to the same service for one release cycle.

- [ ] **Step 1: Write route tests for session, role, CSRF, input validation, and API envelopes.** Assert reviewers cannot list or mutate workspace assignments; unauthenticated requests fail before database access.
- [ ] **Step 2: Mount the assignment router after shared middleware.** Use existing `requireSession`, `requireRole`, and `requireCsrf` middleware.
- [ ] **Step 3: Implement list and mutation handlers as thin service adapters.** Route code parses input, derives organization/actor IDs from `request.auth`, opens transactions, and maps domain conflicts to stable `HttpError` codes.
- [ ] **Step 4: Refactor legacy single and bulk handlers to call the service.** Keep current response compatibility for existing UI/deployed clients; remove their independent assignment logic.
- [ ] **Step 5: Remove `reviewerId` from target creation schema and target creation transaction.** Update the schema contract tests so creating a target cannot assign it in the same operation.
- [ ] **Step 6: Run focused route/service tests and API typecheck.** Ensure compatibility aliases and new routes return consistent assignment state.
- [ ] **Step 7: Commit the API slice.** Include route, service integration, compatibility adapters, schema changes, and tests.

## Task 4: Decouple Team access data and add the assignment workspace

**Files:**
- Modify: `apps/web/app/(workspace)/team/page.tsx`
- Modify: `apps/web/src/features/team/team-manager.tsx`
- Modify: `apps/web/src/features/team/reviewer-assignment-manager.tsx`
- Create: `apps/web/src/features/team/assignment-view.ts`
- Create: `apps/web/src/features/team/assignment-view.test.mjs`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- `ReviewerAssignmentManager` receives initial active reviewers and uses `/assignments` for all list and mutation requests.
- It keeps selected reviewer/state/search/cursor in URL query parameters so refresh and deep links reopen the same assignment view.
- Each mutation sends `expectedUpdatedAt` from the row currently displayed; a `409` refreshes that target and explains that another admin changed the assignment.

- [ ] **Step 1: Write pure view tests for the assignment state labels and reviewer/state filters.** Include zero assignments, assigned-to-self, assigned-to-other, and stale/conflict state.
- [ ] **Step 2: Split Team page loading into core and optional sections.** Members and session role determine the shell and assignment area. Forms, links, and invitations load independently and show section-local errors; their failures cannot suppress the member list or assignment manager.
- [ ] **Step 3: Replace per-row first-100 local search with the central assignment workspace.** Add reviewer and state filters; debounce server-side search; request cursor pages; display loading, empty, error, saving, and stale-conflict states distinctly.
- [ ] **Step 4: Make actions explicit.** Use a reviewer selector plus Save; confirm reassignment; allow unassign; refresh server-derived rows/counts after success instead of applying local count deltas.
- [ ] **Step 5: Keep reviewer counts linked to the filtered assignment view.** Opening a reviewer count selects that reviewer and the assigned state; reset filters returns to all targets.
- [ ] **Step 6: Add keyboard and mobile behavior.** Ensure search/select/save controls have labels, focus remains visible after a mutation, and each row stacks without horizontal scrolling on narrow viewports.
- [ ] **Step 7: Run Team component tests and web typecheck.** Verify section-local errors leave assignments usable and page-two search results are reachable by server query.
- [ ] **Step 8: Commit the Team UI slice.** Include UI, styles, and focused tests.

## Task 5: Make People page exclusively manage people

**Files:**
- Modify: `apps/web/app/(workspace)/people/page.tsx`
- Modify: `apps/web/src/features/people/people-manager.tsx`
- Delete if unused: `apps/web/src/features/people/assignment-view.ts`
- Delete if unused: `apps/web/src/features/people/assignment-view.test.mjs`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/src/components/workspace-shell.tsx`
- Modify: `apps/web/app/(workspace)/page.tsx`

**Interfaces:**
- People page reads and mutates people only; it does not request active reviewer memberships to render.
- The table shows name/email and person/submission lifecycle data. It has no assignment selectors, assignment status filters, reviewer filter, or assignment-specific help text.

- [ ] **Step 1: Update the People page heading and navigation label.** Use “People” and describe adding/editing/archive only; keep existing route redirects and API resource paths.
- [ ] **Step 2: Remove assignment-only data and controls from the People manager.** Delete reviewer filter/status filter/count helper imports and columns; retain add/edit/archive behavior and useful response count.
- [ ] **Step 3: Decouple People data loading from `/members`.** A member-list failure must not turn a successful people list into “Targets could not load.”
- [ ] **Step 4: Remove styles/tests/helpers only after repository-wide reference search confirms they have no other consumers.**
- [ ] **Step 5: Run People component tests and web typecheck.** Confirm the People page contains no assignment actions or assignment directions.
- [ ] **Step 6: Commit the People UI slice.**

## Task 6: Align lifecycle, reviewer access, progress, and deployment documentation

**Files:**
- Modify: `apps/api/src/modules/members/member.routes.ts`
- Modify: `apps/api/src/modules/submissions/public-review.routes.ts`
- Modify: `apps/api/src/modules/progress/progress.routes.ts`
- Modify: `apps/api/src/modules/targets/target.routes.ts`
- Modify: `apps/api/src/modules/targets/bulk-assignment.ts`
- Modify: `docs/architecture.md`
- Modify: `docs/CONTEXT.md`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Reviewer session and bearer-link access continues to resolve the current active assignment from the API database.
- Progress and assignment counts use identical active target/reviewer semantics.
- Legacy assignment aliases remain until after both deployed web/API versions are confirmed compatible.

- [ ] **Step 1: Route all lifecycle assignment cleanup through the shared transaction helper.** Add `removeReviewerAssignments(tx, { organizationId, reviewerId, actorId, reason })` to the assignment service and call it from member archive and reviewer-to-admin role change in the same transaction as session/link revocation. Ensure archived targets leave active assignment counts and lists immediately.
- [ ] **Step 2: Audit submission and public review paths.** Confirm old submissions remain readable by their original reviewer/admins and new public submissions require the link holder to be the current reviewer for that active target.
- [ ] **Step 3: Align progress SQL/Prisma filters.** Archived targets and inactive reviewers must not contribute to active assignment counts; completion remains based on a non-archived submission from the currently assigned reviewer.
- [ ] **Step 4: Document migration preflight and Hostinger environment requirements.** State that `API_INTERNAL_URL` must be the deployed API origin reachable from the frontend Node process and that health endpoints do not prove authenticated assignment access.
- [ ] **Step 5: Run API/web tests, typechecks, production builds, and local production start smoke checks.** Do not apply migrations to a production database from local development; use the safe Hostinger migration path after preflight.
- [ ] **Step 6: Review the migration and deployment sequence against old and new web/API versions.** Deploy API compatibility aliases first, then the web UI, then remove aliases in a later release after confirming no old caller remains.
- [ ] **Step 7: Commit the lifecycle/documentation slice.**

## Task 7: Local release verification and deployment handoff

**Files:**
- Modify: `DEPLOYMENT.md` if results require clarifications.

- [ ] **Step 1: Run the project test suite, typechecks, lint, and production builds.** Record exact commands and outcomes in the change summary.
- [ ] **Step 2: Run a local production smoke flow against a disposable/test database.** Create two organizations, two reviewers, active/archived targets, and submissions; exercise assign, reassign, unassign, retry, stale conflict, and tenant isolation.
- [ ] **Step 3: Validate the migration against a local disposable database only.** Keep production preflight read-only and provide the command for the owner to run in Hostinger; stop deployment if invalid records are reported.
- [ ] **Step 4: Run local production smoke flows against a disposable database.** Check authenticated assignment listing/mutation, search beyond 100 targets, partial section failures, narrow-screen UI, and immediate reviewer access changes.
- [ ] **Step 5: Document Hostinger API-first rollout settings and manual checks.** Preserve compatibility aliases for at least one release; do not initiate production deployment from this task.
- [ ] **Step 6: Report changed files, verification outcomes, migration command, and any manual Hostinger step.**

## Self-review against the approved design

- The plan covers each design area: Team-only assignment controls, independent Team loading, server-side search/pagination, accurate counts, one transactional service, same-organization database constraints, active-state validation, idempotency/concurrency, audit trail, preserved submissions, People cleanup, and Hostinger origin/migration operations.
- All task files map to current source locations; nav locations are identified in the initial file map.
- The People page response count remains a count of all non-archived submissions for each person, independent of the current reviewer assignment, so moving assignment controls out of People does not discard useful history.
- New API signatures are consistent across the service and route tasks. `updatedAt` is the assignment concurrency token returned to and supplied by the client.
- The migration preflight precedes constraint application and stops on invalid data; no step deletes or silently rewrites production records.
- No placeholder implementation instructions remain. Live authenticated verification is a separate release step; public health checks are not treated as assignment-flow verification.
