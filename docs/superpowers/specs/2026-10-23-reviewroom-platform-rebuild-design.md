# ReviewRoom Platform Rebuild Design

**Status:** Approved direction; implementation not started
**Date:** 2026-10-23
**Decision:** Build a clean replacement alongside the current application, validate it in staging, and cut over only after data and workflow gates pass.

## 1. Purpose

Replace the accumulated ReviewRoom implementation with a cohesive, maintainable product whose admin, reviewer, public review, API, authentication, assignment, and database behavior share one explicit domain model. The rebuild responds to recurring assignment, reviewer visibility, sign-in, and deployment failures. It is a replacement project, not another isolated patch to the current screens.

The replacement must preserve the production workspace and records. No database reset, destructive import, or production cutover is part of the initial build. The current production application remains the source of truth until staging has passed the acceptance gates in this document.

## 2. Current system baseline

The repository is an npm-workspaces TypeScript monorepo:

- `apps/web`: Next.js App Router 16, React 19, server-rendered pages and browser interactions.
- `apps/api`: Express 5 REST API, Prisma 7 with the MariaDB adapter, and MySQL-compatible persistence.
- `packages/contracts`: shared Zod request/response and form contracts.
- Hostinger runs web and API as separate Node.js applications. The web app forwards same-origin `/api` requests to the API; MySQL is separately configured.
- Production auth uses opaque, database-backed sessions in HttpOnly cookies, not JWTs. Admin and reviewer memberships are role-scoped. Preserve this property unless a documented security review justifies a replacement.
- Existing core routes include `/admin/login`, `/admin/overview`, `/admin/people`, `/admin/submissions`, `/admin/forms`, `/admin/team`, `/admin/settings`, `/reviewer/login`, `/reviewer/progress`, `/reviewer/submissions`, `/reviewer/forms`, `/invite/:token`, `/reset-password`, `/r/:token`, and `/api/v1/*`.
- Current domain tables include Organization, User, Membership, Session, Form, FormVersion, ReviewTarget, Assignment, ReviewLink, Submission, ProgressConfig, OrganizationTheme, Invitation, PasswordResetToken, and AuditEvent.

Repository references: `docs/CONTEXT.md`, `docs/architecture.md`, `docs/routing-and-workspace-architecture.md`, `docs/hostinger-deployment.md`, and `apps/api/prisma/schema.prisma`.

The existing behavior and source are evidence to inspect, not a mandate to preserve confusing implementation details. Existing stable public URLs and data semantics are compatibility constraints unless a reviewed migration plan explicitly changes them.

## 3. Product scope and roles

### Admin Panel

An owner/admin authenticates to one workspace and can manage team access, review targets, assignments, forms and published versions, reviewer links, submissions, progress, and workspace settings. Authorization must be checked by the API on every protected operation. Hiding a control in the web app is not authorization.

### Reviewer Panel

A reviewer authenticates as a workspace membership and sees only work assigned to that membership, the reviewer’s own submissions, and personal share-link controls. Reviewer access cannot be widened by changing a URL, request body, form ID, target ID, or client-supplied membership ID.

### Public review flow

A person opens a reviewer-specific, revocable, expiring bearer link, sees only the allowed published form and targets for that reviewer, submits a validated response, and receives a clear receipt. Public routes never reveal workspace administration or other reviewers’ work.

### Workspace and accounts

An Organization is the tenant boundary. A User is an identity; a Membership is that identity’s active or archived role in a workspace and owns role-specific credentials. No public self-registration. An owner bootstraps a workspace; admins invite reviewers through one-time access tokens. Admin and reviewer sign-in stay separate in routes, copy, cookies/audience, and redirect destinations.

## 4. Core domain rules

The new implementation must encode these invariants in domain services and database constraints where possible:

1. Every workspace-owned query and mutation is scoped to the authenticated `organizationId`.
2. A target is a person being reviewed; a reviewer is an active reviewer Membership. They are different entities.
3. Team Access is the single place to manage reviewer membership and target assignment. People manages target details only. Do not duplicate assignment controls on People.
4. At most one active reviewer is assigned to a target in a workspace. The reviewer and target must be active and belong to the same workspace.
5. New targets are automatically assigned to the least-loaded active reviewer. When a reviewer joins or becomes active, unassigned active targets are balanced across eligible reviewers. Existing assignments remain stable unless an administrator changes them. Ties are deterministic. If no active reviewer exists, a target remains explicitly unassigned.
6. Assignment is idempotent for a repeated same-value request, audited, and safe against simultaneous requests. Stale updates return a conflict that lets the UI refresh; they do not silently overwrite a newer choice.
7. Assignment changes affect current access, not historical submissions. Removing/deactivating a reviewer revokes that member’s sessions and links and leaves submissions and audit history interpretable.
8. A Form has a mutable draft and immutable, numbered published versions. A Submission points to the exact published version it answered.
9. Public review links grant access only to their active reviewer membership, permitted forms, and currently assigned targets. Revoked, expired, archived, or mismatched tokens fail closed.
10. Progress is derived from documented active target/submission rules, not manually maintained counters.
11. Archive is reversible and preserves records. Permanent deletion requires explicit policy, impact preview, and a safe referential-integrity check; it is outside the initial rebuild cutover.
12. Audit metadata records actor, action, entity, and time, but excludes passwords, raw tokens, full answers, and signature payloads.

The canonical domain glossary and compatibility details are in `docs/CONTEXT.md`; revise that document as part of implementation if the approved rules change.

## 5. Information architecture

Keep role-scoped public routes so opening admin and reviewer panels in one browser remains predictable:

| Audience | Routes | Main responsibility |
|---|---|---|
| Admin | `/admin/login`, `/admin/overview`, `/admin/people`, `/admin/submissions`, `/admin/forms`, `/admin/team`, `/admin/settings` | Workspace management and current review-cycle operations |
| Reviewer | `/reviewer/login`, `/reviewer/progress`, `/reviewer/submissions`, `/reviewer/forms` | Personal assigned workload and share links |
| Shared account setup | `/invite/:token`, `/reset-password?audience=admin\|reviewer` | One-time invite acceptance and membership-scoped credential recovery |
| Public review | `/r/:token` | Reviewer-bound feedback completion |
| API | `/api/v1/*`, `/api/v1/health/live`, `/api/v1/health/ready` | Contracts, authentication, domain policy, persistence |

Admin and reviewer sessions may coexist in the same browser through separate role-scoped session cookies or an equally explicit, secure design. Route guards and API authorization must agree. Opening an admin route must never silently switch the user to reviewer identity, or vice versa.

Team Access is designed as the operational hub: member/access management and a reviewer-to-target assignment workspace. Provide assignment search/filter, reviewer workload, target current state, per-target reassignment/unassign, and clear loading/empty/error/success states. People is the target registry and target detail edit surface; it must not own a second assignment workflow.

## 6. User flows and critical states

### Authentication and team access

1. Owner/admin enters through Admin Panel sign-in; reviewer enters through Reviewer Panel sign-in.
2. The API authenticates against an active membership and the requested role, verifies credentials, and issues a membership-scoped session.
3. Invited reviewer follows a one-time token, verifies the invitation’s intended identity/role, sets a password, and is directed to Reviewer Panel.
4. Admin creates a one-time reset token for a specific membership. Reset invalidates that membership’s sessions only.
5. Admin creates/revokes/reissues access links and can see the member’s state and assigned workload without exposing raw secrets in normal list views.

### Assignment

1. Admin creates or activates an eligible reviewer; existing unassigned active targets are balanced in a single auditable operation.
2. Admin can see assignment state and load on Team Access, with pagination/filtering at scale.
3. New target creation triggers deterministic least-loaded assignment when an eligible reviewer exists.
4. Admin can change/unassign from Team Access. UI sends the assignment version or equivalent optimistic concurrency token and refreshes on conflict.
5. Reviewer sees only their own assigned target work and allowed links; reassignment immediately changes future access while preserving prior submissions.

### Form and response

1. Admin creates/edits a draft and previews desktop/mobile rendering.
2. Publish validates fields and atomically creates an immutable version.
3. Reviewer creates or rotates a personal share link; admin can manage reviewer-scoped links.
4. Public respondent submits against a specific active reviewer, assigned target, and published version.
5. Submission appears in the appropriately scoped reviewer and admin inbox; archive/review state changes do not mutate answers.

Every flow must define: initial, loading, empty, validation error, unauthorized, expired/revoked, API error with request reference, retry, success, and stale/conflict states. Do not render empty content as if it were a successful zero-row response when the request failed.

## 7. Product design and UI system

Design for clarity and trust over dashboard density. Establish one coherent visual language across Admin Panel, Reviewer Panel, account setup, and public review while making each audience obvious.

### Design principles

- Clear next action and visible ownership: show who can act, which reviewer owns a target, and what state the record is in.
- Stable navigation and role identity: separate admin/reviewer destinations, titles, sign-in copy, and return links.
- Mobile-first operational workflows: assignment and review tasks must work without a wide desktop table or horizontal scrolling.
- Honest feedback: API failures, stale data, conflicts, partial bulk outcomes, and saved/unsaved state are explicit.
- Accessible by construction: semantic HTML, labels/error descriptions, keyboard use, visible focus, contrast, reduced motion, zoom, and touch targets.
- Progressive detail: show the essential action in the row/card; move secondary/rare actions into an accessible action menu.

### System foundations

Create documented semantic tokens for color, typography, spacing, layout breakpoints, radii, border, focus, elevation, motion, and z-index. Theme customization uses validated built-in presets; do not inject arbitrary CSS or remote font URLs. Establish roles and permission-aware UI state separately from colors.

Shared components include button/icon button, text/password/email fields, select, checkbox/radio, form field/error summary, badges, cards, page header, tabs, responsive data list/table, pagination, avatar, skeleton, empty/error/retry states, toast/inline status, confirmation dialog, drawer, navigation, and form-field renderer. Components must expose accessible names and predictable states.

Set mobile acceptance at 320 CSS px, include 44 CSS px minimum touch targets, avoid iOS zoom by appropriate input sizing, respect safe areas and virtual keyboards, and keep primary actions reachable above fixed navigation. Verify keyboard-only, screen reader semantics, reduced motion, 200% zoom, and high contrast.

## 8. Technical architecture

### Runtime shape

Keep a two-service deployment compatible with the current hosting topology unless staging proves otherwise:

```text
Browser
  └─ Next.js web (role routes, SSR, accessible feature UI)
       └─ same-origin /api/v1 proxy
            └─ Express API (auth, authorization, domain use cases)
                 └─ Prisma repositories → MySQL/MariaDB
```

Current stack is Next.js 16 + React 19, Express 5, TypeScript, Zod, Prisma 7/MariaDB adapter, and MySQL-compatible Hostinger DB. Prefer the existing supported versions and runtime until a written evaluation finds a concrete blocker. Pin and verify one Node runtime compatible with local CI and both Hostinger apps; current repository accepts Node 22.12.x or 24.x. Do not silently depend on Docker, Redis, process managers, web sockets, or always-on workers on managed hosting.

### Module boundaries

- `packages/contracts`: versioned HTTP DTO schemas, form definitions, error envelopes; no database or UI dependencies.
- `packages/domain`: pure assignment, permission, lifecycle, progress, and version policies.
- `apps/api/src/modules/<domain>`: routes/transport, application use cases, repository access, and transaction boundary grouped by bounded context.
- `apps/web/src/features/<domain>`: typed API calls and route-specific accessible UI; do not duplicate business rules as authority.
- `apps/web/src/components` or `packages/ui`: design-system primitives only after cross-feature APIs stabilize.
- `apps/api/prisma`: schema and forward-only migrations.

Services accept explicit organization and actor context rather than raw Express request objects. All repository entry points require tenant context. The API independently validates every request and returns stable error codes with request IDs.

### Persistence and transaction strategy

Use MySQL-compatible constraints, indexes, transactions, and optimistic version fields intentionally. Keep changes additive first: add new tables/columns/indexes, dual-read only where required for migration, backfill with verified scripts, compare counts/checksums and domain invariants, switch reads/writes at a controlled cutover, and remove legacy fields only after rollback window expiry. Never run a destructive reset or auto-delete malformed production rows.

For current assignment design, retain an explicit `Assignment` relation unless a reviewed normalized model is demonstrably simpler and safely migratable. Unique organization+target constraints prevent duplicate active rows; same-organization foreign keys protect tenant isolation. Assignment balancing must be transactionally safe and deterministic; handle contention with retries only for known transient conflicts and return explicit conflicts for stale user changes.

### Authentication and security

- Keep membership-scoped opaque sessions stored by hash, HttpOnly, Secure in production, SameSite, short-lived, revocable, and role-bound; JWT is unnecessary unless a deployment boundary later requires stateless verification.
- Use independent admin/reviewer audience/cookies or equivalent browser isolation; require an explicit role on login; never infer role from the last visited panel.
- Enforce CSRF protection for mutations, exact origin checks, safe cookie scopes, safe return paths, password hashing, bounded login/reset attempts, and account-neutral credential errors.
- Invitation, password-reset, and reviewer-link secrets have independent purpose, expiry/revocation, high entropy, hash-at-rest, one-time semantics where appropriate, and audited reveal only when needed.
- Apply Helmet/CSP, body size limits, request validation, pagination bounds, safe error responses, structured redacted logs, and carefully configured proxy trust/rate limits.
- Cache only immutable hashed public assets. Authenticated HTML, API responses, account routes, and token-backed data use no-store unless a reviewed cache policy proves tenant/user isolation.
- No secret values in repository, browser bundle, logs, deployment documents, or screenshots. Use `.env.example` placeholders only and host secret stores in production.

### Reliability and capacity

Treat capacity as a measured acceptance gate, not a promise. Define pool size × app instances within the MySQL connection budget; bound requests, pagination, concurrency, and response payloads; add liveness/readiness separation, graceful shutdown, timeouts, safe retry/idempotency, and operational logs. Run representative load in isolated staging and document request mix, expected concurrency, p50/p95/p99, error rate, CPU/memory, DB connections/slow queries, and saturation point. Hostinger plan limits and current routing must be confirmed before capacity claims.

## 9. API design rules

- Prefix versioned routes with `/api/v1` and preserve documented compatibility routes until callers are migrated.
- Use shared Zod schemas for request/response shape and server-side enforcement; do not rely on TypeScript alone at runtime.
- Use stable success/error envelopes; errors contain safe code/message/request ID, never Prisma details or secrets.
- Lists are tenant-scoped, sorted deterministically, bounded, and cursor-paginated where volume can grow.
- Mutations define idempotency, concurrency, authorization, audit event, and transaction semantics.
- Public endpoints return only minimum fields needed by the respondent and do not reveal whether unrelated private records exist.
- Liveness does not depend on MySQL; readiness checks required dependencies with a timeout and no sensitive diagnostics.

## 10. Data migration and release safety

Production data must be preserved: workspace, owner/admin/reviewer identities and credentials, memberships, sessions (or deliberately expired and reissued), target records, assignments, forms, immutable versions, review links, submissions, progress/theme settings, invitations/reset records as policy dictates, and audit history. Passwords/tokens are not exported to cleartext. Existing sessions may be revoked only as a documented, user-visible security event; otherwise migration must preserve valid hashed session semantics.

Create a production-like staging database snapshot with secrets and personal data removed or access-restricted. Run migration rehearsal, record pre/post counts and integrity checks, verify every active reviewer/target and submission relationship, exercise rollback/forward repair, and test restore from backup. Production cutover requires a tested migration, backup, maintenance/consistency window, smoke checklist, monitoring, owner approval, and a rollback path that is compatible with the new schema. No user-facing deployment or production database change is authorized by this plan alone.

## 11. Acceptance gates

The replacement is ready for review only when all are true:

1. Admin and reviewer can authenticate independently in the same browser and stay in their requested role route.
2. Invite, setup, sign-in, sign-out, reset, expiry, revocation, and role-denial flows are verified end to end.
3. Admin can create/activate reviewers and targets, see workload, and assign/reassign/unassign from Team Access; automatic balancing follows the documented deterministic rule.
4. Reviewer sees only assigned work and own submissions; a second organization and second reviewer test proves isolation through direct API calls.
5. Form draft, publish, immutable version, public submission, inbox, archive, and restore flow passes end to end.
6. Every route has loading, empty, failure, retry, and unauthorized states and no false success on API errors.
7. Accessibility and responsive gates pass on the documented viewports and supported browser matrix.
8. Unit, API integration against MySQL, migration, browser E2E, security regression, build, and isolated load checks pass with retained evidence.
9. Staging on the intended Hostinger plan verifies both app roots/build outputs/entry files, runtime env, role cookies, same-origin API proxy, database migrations, health checks, restart behavior, and rollback.
10. Backup restore and data reconciliation pass before cutover; production traffic remains on the current app until explicit release approval.

## 12. Exclusions and decisions requiring a later review

- No production deployment, DNS switch, GitHub push, destructive migration, or secret rotation is included in planning approval.
- No promise of arbitrary high traffic or high availability without measured plan capacity and operational controls.
- No email service, object storage, file uploads, external SSO, multi-reviewer-per-target, public self-registration, legal electronic-signature claim, or real-time websocket feature unless separately designed.
- Existing workflow rules listed above are the baseline. Any change to assignment semantics, deletion/retention, credential behavior, or public URLs requires an explicit product decision and migration analysis.
