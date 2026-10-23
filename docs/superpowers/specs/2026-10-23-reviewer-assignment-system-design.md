# Reviewer assignment system redesign

**Status:** Proposed design, approved in conversation on 2026-10-23; awaiting document review before implementation planning.

## Goal

Make reviewer assignment predictable, discoverable, and safe under ordinary and concurrent use. Administrators should manage all assignments from Team access. The People page should manage people only. Existing submissions, people, memberships, assignments, links, and audit records must be preserved.

## Product rules

- Each active review target has zero or one active reviewer in its organization.
- Only active reviewer memberships in the same organization may receive assignments.
- Only active review targets may be assigned.
- An assignment grants access to that target's current review work. The API remains the sole authority for authorization.
- Reassignment keeps submissions as historical evidence. Completion is calculated against the currently assigned reviewer, following the existing domain rule. The UI confirms before replacing a different reviewer.
- Unassigning or archiving a target removes active access but does not delete submissions.
- Archiving or changing a reviewer to an administrator removes that membership's active assignments and revokes active reviewer sessions/links, while retaining submission and audit history.
- Repeating an assignment to the same reviewer is idempotent and does not inflate counts or create a second active assignment.

## Findings that motivate this design

1. The Team page currently uses one `Promise.all` for members, links, invitations, and forms. A failure in any one request prevents the Team manager, including assignments, from rendering.
2. The current assignment manager fetches targets in pages of 100 but searches only the already-loaded page in the browser. The API accepts a search parameter, but the manager does not send it. Later targets can look missing.
3. The member endpoint counts all assignment rows, including rows whose target is archived. The assignment list only includes active targets, so the displayed counts can disagree.
4. Assignment writes are implemented through single-target and bulk routes, while target creation still accepts an optional reviewer. This duplicates business rules and audit behavior.
5. The database has a unique organization/target key, but assignment foreign keys independently reference target and reviewer IDs. Same-organization integrity depends on application code.
6. The People page still says “People & Assignments” and tells users to assign people there, despite assignment actions having moved to Team access.

Public deployment checks on 2026-10-23 returned HTTP 200 from the API readiness endpoint and the frontend's proxied API health endpoint. Unauthenticated requests to protected routes returned the expected 401. This confirms API routing and a database connection check, but does not exercise an authenticated assignment read or write. The historical frontend value `API_INTERNAL_URL=http://127.0.0.1:4000` remains a deployment configuration risk when the API is a separate Hostinger application; the currently deployed effective value must be confirmed in Hostinger.

## Approaches considered

### A. Patch the existing assignment UI and routes

Keep the current storage and routes, fix paging/search, fix counts, and relax Team page all-or-nothing loading. This is the smallest change, but leaves multiple write paths and relies on application code for tenant integrity.

### B. One assignment domain service and a Team-owned assignment workspace — recommended

Keep the one-reviewer rule and current active-assignment table. Move all assignment reads/writes behind one domain service. Give Team access a searchable, paginated assignment workspace; keep People focused on people management. Add database-level same-organization constraints and derive counts from active targets. Preserve history in existing audit events and submissions.

### C. Allow multiple reviewers per target

Replace the unique organization/target constraint with a multi-assignment relation. This changes reviewer authorization, completion rules, workload counts, and UI behavior across submissions and progress. The current product glossary explicitly says one reviewer per target, so this is out of scope unless the product rule changes.

## Recommended architecture

### User interface

- Team access is the only place with assignment controls.
- Add a clearly labeled **Reviewer assignments** section to Team access. It supports filtering by reviewer and assignment state, server-side search by target name/email, and cursor pagination.
- Each result shows target name/email, current reviewer or “Unassigned,” and a clear action to assign, reassign, or unassign. Saving is explicit; changing an existing reviewer requires confirmation.
- The reviewer row's assigned count links to or opens this workspace filtered to that reviewer. Counts are refreshed from server results after mutations rather than adjusted optimistically from stale client state.
- People becomes a people-management page: add, edit, archive, search, and view submission history/counts. Remove assignment wording, reviewer filters, and assignment controls from this page. Keep the internal `/review-targets` API resource and existing route aliases; this is a UI/domain naming change, not deletion of target records or APIs.
- Team page sections load independently. A forms, links, or invitations failure must not hide members and assignment management. Each failed section displays a safe error and correlation request ID where available.
- Assignment list loading, empty, filtered-empty, error, saving, stale-data, and mobile states are explicit. Search results are not presented as complete until the server has searched the full matching set.

### API and domain service

Create one assignment domain service responsible for:

1. Listing active targets and current assignment state with organization scoping, filters, bounded limits, and stable cursor pagination.
2. Assigning, reassigning, and unassigning a target inside a transaction.
3. Validating that the actor is an owner/admin, the target is active and in the actor's organization, and the reviewer is an active reviewer in that same organization.
4. Handling idempotency and concurrent changes so retries cannot duplicate work or silently overwrite a newer assignment. A stale client receives a conflict and the current assignment state.
5. Recording a single, consistent audit event for each actual state change, including prior and new reviewer IDs when applicable. No-op retries do not create duplicate change events.

Expose a cohesive assignment API under `/api/v1/assignments`:

- `GET /` accepts `reviewerId`, state (`all`, `assigned`, `unassigned`), `search`, `limit`, and `cursor`; it returns active targets, current reviewer, a server-derived count summary, and `nextCursor`.
- `PUT /:targetId` assigns or reassigns to `{ reviewerId }`; it returns the authoritative assignment state.
- `DELETE /:targetId` unassigns; repeated deletion returns an idempotent success response.

The service is the only business-rule implementation. Existing single/bulk target-assignment routes can temporarily delegate to it as compatibility aliases, then be removed after checking that no deployed client uses them. Target creation no longer accepts `reviewerId`; creation and assignment become separate, auditable actions. Any bulk operation must call the same service rules within one transaction.

Reviewer and public-link access checks continue to resolve the current assignment from the database on each protected request. No client-supplied reviewer ID grants access. Existing submissions remain visible to their author and administrators according to current submission permissions; reassignment does not rewrite their reviewer attribution.

### Database and migration

- Keep one current `Assignment` row per `(organizationId, targetId)`.
- Add composite uniqueness on `(organizationId, id)` for `ReviewTarget` and `Membership`, then composite foreign keys from `Assignment(organizationId, targetId)` and `Assignment(organizationId, reviewerId)` to those parent pairs.
- Add/adjust indexes for active target search and assignment filtering by organization/reviewer/target.
- Before adding constraints, run a read-only migration preflight that reports cross-organization or orphaned assignment rows. If invalid data exists, stop migration and report the rows for deliberate repair; never delete or silently reassign records.
- Do not drop assignment or audit history. Existing assignments remain active unless their target or reviewer is already inactive; any cleanup must be explicit and audit logged.
- Use an expand-then-constrain migration sequence compatible with MySQL/MariaDB and the current Hostinger deployment process. Keep the old API aliases until the new web version is deployed and confirmed.

### Errors and operations

- Preserve the standard `{ error: { code, message, requestId } }` response contract.
- Use stable conflict codes for stale assignment changes and invalid/inactive reviewer or target states.
- Log Prisma error codes and request IDs without logging names, emails, tokens, or answer payloads.
- Keep readiness checks and schema migrations separate: database connectivity alone must not be described as proof that assignment tables/columns are current.
- Confirm the frontend's production `API_INTERNAL_URL` points to the deployed API origin reachable from the Next.js server; it must not be an assumed localhost port when the API runs as a separate Hostinger site.

## Data flow

1. Admin opens Team access; members load independently from form links/invitations.
2. Admin opens Reviewer assignments or a reviewer-filtered view.
3. Browser requests a bounded, organization-scoped assignment page with server-side search and filters.
4. Admin chooses a reviewer action. The API checks session, role, CSRF, current target/reviewer state, and expected prior assignment.
5. A transaction changes the current assignment and writes an audit event only when state changes.
6. API returns the authoritative row/count. UI refreshes affected data; reviewers' next request observes the new assignment state.

## Acceptance criteria for implementation

- Admin can find a target beyond the first 100 records by name or email without manually paging through unrelated records.
- Team access assignment controls remain available when links, invitations, or forms fail to load.
- One target cannot be actively assigned to two reviewers in the same organization, including concurrent writes.
- Cross-organization assignments are rejected by both application validation and database constraints.
- Inactive targets and inactive/non-reviewer memberships cannot be assigned.
- Reassigning updates access immediately, preserves old submissions, and completion reflects the new assignee according to the documented rule.
- Unassigning, archiving targets, and archiving/reclassifying reviewers keep counts, active lists, links, and reviewer authorization consistent.
- Retrying the same assignment is idempotent; stale concurrent updates return a conflict instead of silently losing a change.
- People page contains no assignment controls or assignment-specific instructions.
- Existing production assignment, target, member, submission, and audit data survives migration.
- Hostinger frontend and API deployments can reach the correct API origin; health checks and authenticated assignment flows are documented separately.

## Verification plan (for implementation phase)

Use focused service/database tests for tenant boundaries, inactive records, idempotency, stale concurrent writes, and rollback; route-level tests for auth/role/CSRF and error envelopes; UI tests for search beyond page one, independent Team section failures, assignment refresh, and mobile layout. Then run the API/web type checks, package tests, production builds, and a local production-start smoke test. Validate the live authenticated flow only after deployment with an admin session; public health checks are insufficient.

## Out of scope

- Multiple reviewers per target.
- Rewriting submission history or changing a submission's reviewer attribution.
- Deleting target, member, submission, or audit records to simplify assignment state.
- Redis, queueing, workload balancing, round-robin assignment, or bulk CSV import.
- Deploying to Hostinger as part of this design-document review.
