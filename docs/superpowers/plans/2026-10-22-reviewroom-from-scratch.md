# ReviewRoom From-Scratch Implementation Plan

> **For agentic workers:** Treat this document as the product and engineering source of truth. Use the `executing-plans` skill to execute the tasks sequentially and check them off. Do not spawn agents. Read `docs/CONTEXT.md` first. This plan is intentionally self-contained; linked repository documents are supporting detail, not prerequisites for product decisions.

**Goal:** Build a production-ready, multi-tenant review and feedback workspace with separate admin and reviewer portals, a public form experience, secure identity and recovery, configurable appearance, and responsive, accessible workflows.

**Architecture:** A TypeScript monorepo with a Next.js App Router web application, an Express API, shared Zod contracts, Prisma persistence, and MySQL. The browser uses same-origin `/api/v1` routes rewritten to the API service. The API is the authorization and validation boundary; web route guards improve navigation but never replace API authorization.

**Tech Stack:** Node.js 22.x for the configured Hostinger runtime (Node.js 24.x remains supported), npm workspaces, Next.js 16 App Router, React 19, TypeScript strict mode, Express 5, Prisma 7, MySQL 8.4, Zod 4, Node's test runner, and browser accessibility checks. Use currently supported patch releases at implementation time and lock them in the package lockfile.

## Global Constraints

- Start from an empty repository, then build in the order below. Use TypeScript strict mode and shared runtime schemas for all API input and output contracts.
- Keep tenant identity explicit in every query and write. Never infer organization access from a URL, form ID, reviewer token, or client-supplied organization ID.
- Treat API checks as authoritative. Validate authentication, role, organization membership, resource ownership, CSRF, and input on the server for every protected mutation.
- Admin and reviewer use distinct portal paths, login pages, membership credentials, and session role checks. Do not show cross-portal login links or advertise either portal on the public form experience.
- Reviewer account setup is one-time via invitation token, followed by email and password sign-in. Password recovery uses a separate one-time reset token that an admin can issue and share. Do not depend on SMTP or email delivery.
- Public registration is out of scope. Team access is invitation-only.
- Keep published form versions immutable. A submission always records the exact published version it answered.
- A target has at most one active reviewer assignment. A reviewer can receive multiple targets and form-specific links.
- Never store raw passwords, session tokens, invitation tokens, reset tokens, or reviewer link tokens in the database or logs. Raw invitation/reset/link tokens are revealed only when the relevant admin creates or rotates them; persist hashes for verification and authenticated encryption only where a raw token must be re-shown.
- Never put submission answers, signatures, secrets, or reset tokens in audit metadata, analytics, URLs beyond the required bearer-token route, or application logs.
- Do not accept arbitrary CSS, remote font URLs, or executable theme content. Use allowlisted presets and design tokens.
- A typed signature is a captured signature response, not a claim of legal e-signature compliance.
- Support responsive layouts and pointer/touch/mouse signature input. Use Pointer Events and a typed fallback. Validate current Safari on iOS, Chrome on Android, Chrome, Firefox, Safari, and Edge before claiming compatibility.
- Do not claim production scale or deployment readiness until production-like load, restore, migration, security, and browser gates pass on the selected Hostinger plan.
- Keep `.env` and production credentials out of git. Never invent deployment credentials, DNS records, SMTP configuration, or Hostinger plan capabilities.

## Product Definition and Acceptance

ReviewRoom helps an organization collect structured feedback. An owner/admin creates forms, adds review targets, assigns each target to an active reviewer, shares scoped public review links, and monitors submissions and completion. Reviewers sign in to their private workspace or open a scoped link, complete a published form for an assigned target, and track their work. The public review route is a minimal, branded form flow that does not expose admin or reviewer navigation.

The first release must provide:

1. An owner bootstrap path; separate admin and reviewer login/logout; role-safe sessions; show/hide password controls; one-time reviewer setup; admin-issued, single-use password-reset tokens.
2. Admin overview, target assignment, submissions inbox/detail, form list/editor/publish/archive, team access, progress goal, identity, theme, and audit history.
3. Reviewer overview/progress, assigned targets, submissions, and available forms/links, all scoped to the authenticated reviewer.
4. Public review-link loading and submission with field-specific validation, immutable version association, duplicate-submit protection, and completion updates.
5. Admin-managed themes shared across admin/reviewer portals and form editor/public forms, including brand color, typography, surface/background preset, and public form presentation preset.
6. Responsive, keyboard-accessible, mobile-first layouts; clear empty, loading, validation, success, and unavailable states.
7. Repeatable migrations, backups, health checks, observability, and deployment instructions for the chosen Hostinger Node.js + MySQL hosting plan.

Out of scope unless added in a later version: public self-registration, email/SMS delivery, many-reviewer assignment per target, arbitrary CSS, external identity providers, billing, legal e-signature claims, and multi-region active-active operation.

## Roles, URL Map, and Navigation Contract

| Surface | URL | Access |
|---|---|---|
| Public landing/sign-in selector | `/` | Public; explain product without exposing a portal cross-link from login forms |
| Admin sign-in | `/admin/login` | Public page, admin credentials only |
| Admin overview | `/admin/overview` | Owner/admin |
| Admin targets and assignments | `/admin/people` | Owner/admin |
| Admin submissions inbox | `/admin/submissions` | Owner/admin |
| Admin submission detail | `/admin/submissions/:submissionId` | Owner/admin, tenant scoped |
| Admin forms | `/admin/forms` | Owner/admin |
| Admin form editor | `/admin/forms/:formId` | Owner/admin |
| Admin team | `/admin/team` | Owner/admin; role-grant restrictions apply |
| Admin settings | `/admin/settings` | Owner/admin; owner-only sensitive actions |
| Reviewer sign-in | `/reviewer/login` | Public page, reviewer credentials only |
| Reviewer home/progress | `/reviewer/progress` | Reviewer |
| Reviewer submissions | `/reviewer/submissions` | Reviewer; only own submissions |
| Reviewer forms/work | `/reviewer/forms` | Reviewer; only assigned and linked work |
| Reviewer invitation setup | `/invite/:token` | Public one-time setup, token-gated |
| Password reset | `/reset-password?audience=admin|reviewer&token=…` | Public one-time reset, audience and membership bound |
| Public review | `/r/:token` | Public bearer link, active and unexpired only |
| Liveness/readiness | `/health/live`, `/health/ready` | Operational endpoints; expose no secrets |
| Versioned API | `/api/v1/...` | Same-origin browser path; API performs all authz |

Keep role prefixes in canonical browser URLs. The web proxy may add role/path hints for rendering, but those headers are untrusted and cannot grant access. Every protected page checks the session and redirects to that role's login; every API route independently checks role and tenant ownership. On mobile, use a fixed bottom navigation with safe-area padding; on desktop, use a persistent sidebar. Do not allow content to overflow horizontally to access required actions.

## Architecture and Request Boundaries

```text
Mobile/Desktop Browser
  ├─ Next.js pages, role shells, accessible forms, public form renderer
  └─ same-origin /api/v1 requests
        ↓ Next.js rewrite (preserves URL; no authorization)
Express API
  ├─ request ID, security headers, origin/CSRF, body limits, rate limits
  ├─ authentication + role + organization authorization
  ├─ Zod request/response schemas and domain services
  └─ Prisma repositories and transaction boundaries
        ↓
MySQL 8.4

Shared packages: contracts (Zod schemas/types), domain rules, UI tokens/components.
```

The API returns a stable envelope: success `{ "data": ... }`; failure `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`. Do not return stack traces or database details. Use appropriate HTTP status codes, pagination with a hard server cap, and request IDs in all server logs. Private data responses should not be cached by browsers or shared proxies. Keep writes transactional where a partially completed operation would violate invariants.

## Domain Model and Persistence Rules

Implement these entities in Prisma and MySQL. Use UUIDs (or another documented opaque ID format) consistently, UTC timestamps, explicit foreign keys, and indexes matching access patterns. Every tenant-owned row carries `organizationId` directly or has a required path through a tenant-owned parent that is validated in the same query.

| Entity | Required data and invariants |
|---|---|
| `Organization` | ID, name, stable slug, created/updated timestamps. Slug is unique and used for display/sign-in context, never as authorization. |
| `User` | ID, normalized unique email, display name, timestamps. A single identity may have memberships in multiple organizations. |
| `Membership` | Organization + user unique pair, role `OWNER\|ADMIN\|REVIEWER`, status `ACTIVE\|REMOVED`, password hash, timestamps. Credentials are membership-specific, so admin/reviewer authentication remains independent even for the same email. |
| `Session` | Membership ID, unique hashed session secret, expiry, created/last-seen timestamps, optional revocation. Index hash and expiry. |
| `Invitation` | Organization, normalized invite email, intended role, unique token hash, encrypted token for authorized reveal while pending, expiry, accepted/revoked timestamps, creator. Single-use; acceptance creates/activates the membership and sets its password transactionally. |
| `PasswordResetToken` | Membership, unique token hash, encrypted token for authorized reveal while pending, expiry, used/revoked timestamps, creator. Independent from invitation/access tokens; one use; password change revokes existing sessions. |
| `Form` | Organization, name, description, draft JSON, active/archived status, current published version ID, timestamps. Draft can change without altering already published versions. |
| `FormVersion` | Form, organization, monotonically increasing version number, immutable normalized schema JSON, published timestamp, publisher membership. Unique `(formId, version)`; immutable after publication. |
| `ReviewTarget` | Organization, full name, optional normalized email, creator, timestamps, archived timestamp. Add indexes on `(organizationId, archivedAt, fullName)` and `(organizationId, email)`; avoid global email assumptions. |
| `Assignment` | Organization, target, reviewer membership, status/timestamps. One active assignment per target; reviewer must be active and role REVIEWER in same organization. Enforce unique target assignment and index reviewer/status. |
| `ReviewLink` | Organization, reviewer, optional form scope, token hash, encrypted token while active for authorized reveal, expiry, revoke/rotate metadata. Never grant access outside its reviewer, form, organization, assignment, and active published version scope. |
| `Submission` | Organization, target, reviewer, form, immutable form version, JSON answers, payload hash, idempotency key, submitted/reviewed/archived timestamps. Unique idempotency key within organization; index tenant + submitted date, reviewer, form, target, status. A submission records the actor/link context required for audit. |
| `ProgressConfig` | One row per organization, completion rule `ONE_RESPONSE`, target count/goal, updated by. Goal bounded to 1–100,000. |
| `OrganizationTheme` | One row per organization: allowlisted brand palette, font preset, surface preset, public form style, updated by. No arbitrary CSS/URLs. |
| `AuditEvent` | Organization, actor membership nullable for system action, action enum, resource type/ID, timestamp, safe metadata. Never include form answers, signatures, passwords, bearer/reset tokens, or request bodies. |

Required referential behavior: preserve submissions and form versions as historical records; archive or revoke access without silently rewriting history. Permanent deletion must be explicit, owner/admin authorized according to policy, and blocked or cascade only where retention semantics have been deliberately defined. Prefer soft archive for targets/forms/submissions. Add migrations and a documented seed/bootstrap command; do not rely on development-only auto-seeding in production.

Critical database invariants: unique normalized user email; unique org+user membership; unique form+version; one active assignment per target; idempotency uniqueness; token hashes unique; foreign keys prevent cross-tenant accidental references. Add composite indexes for tenant-scoped list/filter/sort routes. Verify actual query plans for the most-used list and dashboard queries before production.

## Authentication, Authorization, and Security Contract

- Hash passwords with scrypt using `N=32768,r=8,p=1` (or a reviewed, explicitly versioned stronger format); store algorithm/version parameters with hash. Compare safely and rehash on successful login if policy changes.
- Generate high-entropy random session, invite, reset, and review-link secrets. Store a one-way hash for verification. Encrypt only the pending raw values needed for owner/admin reveal using AES-256-GCM and a dedicated environment key; include key version for rotation.
- Session cookie: HTTP-only, SameSite=Lax, Secure in production, path `/`, host-only `__Host-` prefix in production, expiry 8 hours. Never store credentials/session bearer in localStorage.
- CSRF: HMAC-bound token for cookie-authenticated mutation requests plus same-origin/Origin checks. Require JSON for API mutations and reject cross-site requests. CORS must allow only exact configured origins, with credentials only where required.
- Rate limits: login 8 attempts/15 minutes per normalized identity plus network key; public link reads 60/minute; public submits 12/minute per IP+token; general API 300/minute per identity/network. Bound request body to 64 KiB unless a field-specific justified limit is introduced. Production multi-instance limits must be shared at gateway/edge or a shared store; in-process limits are a single-instance fallback only.
- Security middleware: Helmet, strict content type, request IDs, secure cookies, parameterized database queries through Prisma, input limits, and safe error handling. Do not trust forwarded IP/host headers unless configured trusted proxies are explicit.
- Tenant isolation tests must attempt cross-organization reads/writes for every resource family, including public tokens and guessed UUIDs.
- Permission matrix: Owner may administer workspace, grant admin/reviewer, issue/reveal/revoke access tokens, and perform owner-only destructive actions. Admin manages forms, targets, assignments, submissions, reviewer access, resets, theme and workspace settings, but cannot grant/revoke owner. Reviewer can read own assigned work and submit only as self for active assignments. Public token can access only its scoped form/target operation.
- Reset response must not reveal whether an email exists. Since recovery is admin-issued, the admin UI explains how to copy/share a one-time reset link. Consuming a token atomically changes membership password, marks token used, and revokes all sessions for that membership.

## Form Schema and Answer Contract

Support these field types: `name`, `shortText`, `longText`, `email`, `url`, `phone`, `yesNo`, `number`, `singleChoice`, `checkboxes`, `dropdown`, `rating`, `date`, `consent`, `ranking`, `signature`. Each field has a stable unique UUID, label, required state, help text, and only its type-specific constraints. Choice option IDs are stable and unique. Keep all schema and answer limits explicit: maximum field count, label/help text lengths, option count, text answer length, numeric bounds, date format, and total serialized payload size.

The public API validates answers against the exact immutable `FormVersion` on the server. Required fields cannot be omitted or blank. Choice values must be current option IDs. A ranking must contain each option ID exactly once. Signature input accepts either a typed string or normalized point sequences bounded to `[0,1]` with a strict point count/serialized size; reject malformed, non-finite, or out-of-range points. Client validation is only a usability layer. Render signatures as accessible images/visualizations with a text fallback for typed signatures.

When adding a field type, update in the same vertical slice: shared discriminated schema, editor palette and properties, preview, public renderer, server validator/normalizer, submission detail renderer, fixtures, unit tests, and documentation. Preserve old published schemas indefinitely unless a retention policy is added.

## API Surface

All routes are under `/api/v1`, validate requests with shared schemas, return the envelope above, and apply tenant/role checks. Use cursor pagination with stable ordering and capped page sizes (default 25, maximum 100). Names below define minimum behavior; add route files grouped by feature and OpenAPI documentation generated from schemas.

| Route family | Required operations |
|---|---|
| Health | `GET /health/live`, `GET /health/ready`; readiness checks DB with a short timeout, liveness does not depend on DB. |
| Auth | `POST /auth/admin/login`, `POST /auth/reviewer/login`, `GET /auth/session`, `POST /auth/logout`, `POST /auth/password-reset/consume`; role-specific login enforces the requested role. |
| Organization/settings | `GET/PATCH /organization`, `GET/PATCH /organization/theme`, `GET/PATCH /organization/progress-config`. |
| Members/access | `GET /members`, `POST /members/invitations`, `GET /members/invitations`, `POST /members/invitations/:id/reveal`, `POST /members/invitations/:id/rotate`, `POST /invitations/accept`, `PATCH /members/:id`, `DELETE /members/:id`, `POST /members/:id/password-resets`, `POST /members/password-resets/:id/reveal`, `POST /auth/password-reset/consume`. Owner/admin boundaries apply. |
| Review targets | `GET/POST /review-targets`, `GET/PATCH/DELETE /review-targets/:id`, `PUT/DELETE /review-targets/:id/assignment`, `POST /review-targets/assignments/bulk`. Bulk operations validate every row and report per-item results atomically or document partial behavior. |
| Forms | `GET/POST /forms`, `GET/PATCH/DELETE /forms/:id`, `POST /forms/:id/publish`, `POST /forms/:id/archive`, `POST /forms/:id/restore`. `DELETE` is soft archive only; no permanent form deletion in version one because versions/submissions are retained. Publish snapshots a validated draft into an immutable incrementing version in one transaction. |
| Review links | `GET /review-links`, `POST /review-links`, `POST /review-links/:id/reveal`, `POST /review-links/:id/rotate`, `DELETE /review-links/:id`. Scope must include reviewer and optionally form. |
| Public review | `GET /public/reviews/:token`, `POST /public/reviews/:token/submissions`. The read returns only necessary form/version/target information; submit validates assignment and version, then atomically stores an idempotent submission. |
| Submissions | `GET /submissions` (active/archived, reviewer/form/status filters), `GET /submissions/:id`, `POST /submissions/:id/mark-reviewed`, `POST /submissions/:id/archive`, `POST /submissions/:id/restore`. No permanent submission deletion in version one; retention and legal deletion policy must be designed separately. Reviewer list endpoints expose only own submissions. |
| Progress | `GET /progress/summary`, `GET /progress/reviewers`, `GET /reviewer/progress`. Derived counts must have documented semantics and agree across overview, targets, and reviewer pages. |
| Audit | `GET /audit-events` with tenant-safe pagination and safe filters; owner/admin only. |

Avoid implementing both a client-side-only rule and a different API rule. Put domain policy in service functions with unit tests, then use them from handlers. Keep handlers thin. Verify all response schemas before sending output.

## Frontend System and Page Requirements

### Shared Design System

Build semantic design tokens for color, spacing, typography, radius, border, focus, elevation, motion, and breakpoints. Use CSS variables set from the validated organization theme. Provide light, readable contrast and preserve user reduced-motion preference. Theme controls show an immediate preview; saving persists via API and refreshes all portal/form surfaces consistently. Clearly distinguish unsaved preview from saved theme. Include brand palette, type preset, surface/background preset, and form presentation preset. Provide reset-to-default and accessible color contrast feedback. Never persist the preview before Save.

Shared primitives: Button, IconButton with accessible name, TextField, PasswordField with show/hide toggle, Select, Checkbox, RadioGroup, StatusBadge, Card, PageHeader, EmptyState, ErrorState, Skeleton, ConfirmDialog, Toast/inline status, Tabs, Pagination, Table/Card responsive list, Avatar, SignaturePad, FormFieldRenderer, and mobile/desktop navigation. Touch targets at least 44×44 CSS px, inputs at least 16px on mobile, visible focus, labels and error associations, keyboard operation, and no color-only status.

### Login, Invitation, and Recovery Screens

Admin and reviewer login are separate components/pages with role-specific title, copy, form action, and destination. Each has labeled email/password fields, show/hide password icon with accessible state, autocomplete (`username`, `current-password`), submit pending state, generic invalid-credentials message, server validation feedback, and a recovery link. Never provide a link from admin login to reviewer login or vice versa. For forgotten password, display help that a workspace admin issues a reset link; the reset form accepts the one-time token and new password with show/hide, confirmation, strength guidance, and clear expired/used state. Invitation setup validates the token and intended email/role before password creation. Login preserves no open-redirect destination; redirect only to allowlisted same-role paths.

### Admin Pages

- Overview: goal, assigned targets, people reviewed, submissions, completion bar, reviewer workload. Clicking a reviewer opens a same-page drawer (not a route navigation) with active/archive tabs, numbered review rows `1..N`, status/date/version, and accessible close/escape/backdrop behavior. Selecting a review opens its detail in the intended same-page context or an explicit view transition without losing the overview.
- Review targets: clear add-person form (name required, email optional, reviewer optional), search, status filters, counts, reviewer filters, target list. Reviewer selector is populated from active reviewer memberships on Team; users do not type reviewer names/emails. Show each reviewer and assignment directly. Assignment changes are one click from the row and include “Unassigned/Choose later”. Support bulk selection and assignment with confirmation and a clear success/error summary. On narrow screens, render stacked target cards with person, reviewer selector, response count/status, and actions; do not squeeze a wide table or require sideways scrolling.
- Submissions inbox: active/archive, all/needs review/reviewed, reviewer filter populated from active reviewers, form/target filters, counts, pagination, cards on mobile and table/list on desktop. Show assigned reviewer, target, form/version, date, review status and actions. Detail displays every answer safely and supports mark reviewed/archive/restore. Keep back navigation and filters. Avoid destructive controls adjacent without confirmation.
- Forms: active/archive list, search, create, duplicate if supported, archive/restore/delete rules, submission counts and updated timestamps. Form editor has explicit draft/published version state, autosave or explicit save with dirty-state indication, publish confirmation, all field types, reorder/remove/edit actions, preview at responsive widths, and no data loss on navigation. Published version remains separate from draft.
- Team: member search, role/status tabs and counts; role changes with authorization and confirmation; create one-time invitation; reveal/copy pending invitation; revoke/rotate expired tokens; issue/reveal/copy separate reset link; remove/reactivate member; display assigned-work counts. On mobile use member cards with actions in an accessible menu. Do not expose raw token after its safe reveal window.
- Settings: progress goal, workspace identity, appearance. Identity should remain because it names the tenant for team sign-in and records; explain that it does not change the deployed domain. Separate save states and validation. Appearance includes shared live preview and form-specific preview; theme affects both portals and public forms after save.

### Reviewer Pages

Reviewer home shows assigned, in progress, completed counts and accessible work list. Assignment rows open the corresponding form link without revealing other reviewers’ work. Reviewer submissions filters and detail are restricted to self. Show invitation/account setup and reset states with no admin controls. Mobile navigation should not obscure submit buttons; account sign-out stays reachable.

### Public Review Experience

Token route validates active status and expiry, then displays organization branding, form title/description, target identity only as configured, progress if useful, and the exact published version. Provide autosave only if a durable, secure draft model is explicitly implemented; otherwise warn before navigating away when dirty. Validate field errors inline and in a summary, focus the first error, prevent accidental duplicate submit, and show a receipt/success state. On unavailable/revoked/expired links, show a helpful neutral state that does not reveal private data. Ensure keyboard and screen-reader input for all fields and provide typed-signature fallback. Do not add admin/reviewer links to this surface.

## Repository Layout

```text
apps/
  web/
    app/                  # route groups for public, admin, reviewer
    components/           # shared UI and role-specific components
    features/             # auth, forms, people, submissions, team, settings
    lib/                  # API client, session helpers, theme, validation
    public/
  api/
    src/
      routes/             # HTTP parsing/response only
      middleware/         # request ID, auth, csrf, validation, limits
      services/           # domain use cases and transaction boundaries
      repositories/       # Prisma query layer; every query tenant-scoped
      config/             # validated environment
      server.ts
    prisma/schema.prisma
    prisma/migrations/
packages/
  contracts/              # shared Zod schemas, DTOs, errors, field types
  domain/                 # pure policy, status/progress calculations
  design-tokens/          # theme presets and semantic token definitions
docs/
  CONTEXT.md
  architecture.md
  superpowers/plans/2026-10-22-reviewroom-from-scratch.md
  deployment/              # operational/deployment runbooks
```

Keep dependency direction one-way: web and API depend on shared packages; shared packages must not import either app. Services depend on repository interfaces or explicit repository modules, not HTTP request objects. UI feature components call typed API functions and do not embed raw fetch/error parsing throughout the tree.

## Build Tasks (Execute Sequentially)

For each task: first add or update the named tests, run them and confirm the relevant failure, implement the smallest complete slice, rerun focused tests, then rerun typecheck/lint at the end of the phase. Do not mark a task complete when only its UI or only its route exists. Use a disposable MySQL database for repository/API integration tests; do not silently substitute SQLite for MySQL semantics.

### Phase 1 — Foundation and Contracts

- [ ] **1. Create the monorepo shell.** Add root `package.json`, workspace config, lockfile, strict TS configs, formatting/lint configuration, `.editorconfig`, `.gitignore`, `.env.example`, and CI workflow. Create `apps/web`, `apps/api`, `packages/contracts`, `packages/domain`, and `packages/design-tokens`. Define root scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, and `test:e2e`. Verify a clean install and each empty-app command. Pin Node 22.x in `.nvmrc`/CI for Hostinger.
- [ ] **2. Implement shared primitives and errors.** In `packages/contracts`, define IDs, email normalization, pagination, success/error envelopes, auth roles, status enums, theme presets, and strict request/response schemas. Add schema tests under `packages/contracts/src/**/*.test.ts`, including unknown-key rejection and boundary values. Publish shared package exports; prohibit app-specific imports.
- [ ] **3. Implement domain policies.** In `packages/domain`, define assignment eligibility, permission matrix, form validation/normalization, progress completion, and submission lifecycle as pure functions. Add table-driven tests for each role, inactive membership, cross-tenant resource, form field type, and progress edge case.

### Phase 2 — Database and API Core

- [ ] **4. Define the Prisma schema and migrations.** Implement all entities and unique/index/foreign-key constraints in `apps/api/prisma/schema.prisma`. Create initial SQL migration, generated-client command, seed fixtures for tests, and a separate interactive/one-time owner bootstrap command. Run migrations against disposable MySQL; verify duplicate membership, version, assignment, and idempotency writes fail at DB boundary.
- [ ] **5. Build API foundation.** Implement validated env loading, Express app, request ID, Helmet, exact origin CORS, body limit, safe error middleware, Zod parsing helpers, structured redacted logging, and liveness/readiness routes. Add unit and Supertest tests for malformed JSON, oversized body, unknown route, CORS, request IDs, redaction, and DB readiness timeout.
- [ ] **6. Implement repositories and tenant scoping.** Create tenant-scoped repository methods for organizations, memberships, forms, versions, targets, assignments, links, submissions, and audit events. Add MySQL integration tests that create two organizations and prove each list/get/update/delete is isolated. Require organization context in repository method signatures.
- [ ] **7. Implement sessions and login.** Create scrypt password utilities, random-token utilities, AES-GCM token vault, cookie/session repository, CSRF issuance/verification, role-specific login, session lookup, logout, login limits, and session revocation. Add integration tests for wrong role, wrong password, inactive membership, expiration, CSRF, cookie flags, password change revocation, lockout/rate behavior, and session hash only storage.
- [ ] **8. Implement invitations and password recovery.** Add one-time invitation creation/reveal/rotate/revoke/accept and admin-issued reset create/reveal/consume. Verify invitation and reset secrets are independent; replay, expiry, wrong audience, email mismatch, revoked token, role escalation, and concurrent consume all fail safely. Test transaction rollback and session revocation after reset.
- [ ] **9. Add API authorization matrix and audit.** Add route-level tests for every role × route family and cross-tenant resource IDs. Record safe audit events for logins as policy permits, member changes, invitations/resets, role/assignment changes, form publish/archive, submission state changes, and settings/theme changes. Ensure event metadata excludes answers and secrets.

### Phase 3 — Web Shell and Identity

- [ ] **10. Build the design system and responsive shells.** Implement design tokens, theme provider, UI primitives, accessible status/error/loading states, desktop admin/reviewer sidebar, mobile fixed bottom navigation, focus management, and global responsive rules. Add component tests for password visibility, keyboard navigation, labels/errors, dialogs, and reduced motion. Verify 320px, 452px, tablet, and desktop widths without page-level horizontal overflow.
- [ ] **11. Build route guards and role login screens.** Implement all route paths in the map, server-side session checks, role-specific login forms, show/hide password icons, recovery guidance, invitation setup, and token reset form. Add Playwright tests proving unauthenticated redirect, wrong-role denial, correct role landing, no cross-login links, and safe same-role return paths.
- [ ] **12. Build typed API client and data states.** Implement same-origin `/api/v1` client with credentials, CSRF, request IDs, runtime response parsing, stable user-facing errors, abort support, and pagination. Test success, envelope mismatch, unauthorized, rate-limited, network failure, stale request cancellation, and no private response caching.

### Phase 4 — Admin and Reviewer Workflows

- [ ] **13. Build form editor and draft lifecycle.** Implement form list, editor shell, field palette/properties/reordering, dirty state, draft save, responsive live preview, and every listed field type. Add component tests per field type and editor actions; add Playwright tests for creating/editing/reordering and draft persistence. Confirm the preview and public renderer share the same normalized schema.
- [ ] **14. Publish immutable form versions.** Implement publish validation and transaction that snapshots schema and increments version. Add API/database tests for invalid schema rejection, concurrent publish, immutable prior version, current version pointer, archive, and restore. Show draft versus published status in editor and submission records.
- [ ] **15. Build Team access and recovery UI.** Implement member list/cards, roles/status/search, token create/reveal/copy/revoke/rotate, reviewer invitation setup, reset-link create/reveal/copy, session revocation message, and confirmation states. Test owner/admin restrictions and clipboard failure fallback; never display secrets outside the explicit reveal step.
- [ ] **16. Build target management and assignment.** Implement add-person flow, reviewer choices sourced from active reviewer memberships, row assignment, bulk assignment, filtering/search, counts, response state, archive/restore. Add API tests for invalid reviewer role/org/status and UI tests proving no reviewer identity typing is needed. Mobile must use stacked cards with all actions visible/reachable.
- [ ] **17. Build scoped reviewer links.** Implement create/reveal/rotate/revoke/expiry UI and API for personal or form-specific links. Test token hash verification, encrypted reveal, organization/form/reviewer scope, expiry, revocation, and ensuring one reviewer cannot use another reviewer’s link.
- [ ] **18. Build public review renderer and submission.** Implement server token resolution, exact-version field renderer, server and client validation, submit idempotency, safe receipt, unavailable state, and typed/pointer signature support. Add tests for all field validation, malformed signature input, duplicate requests, inactive/expired links, assignment changes, archived form, immutable version, and cross-tenant token access.
- [ ] **19. Build submissions inbox and detail.** Implement active/archive tabs, status/reviewer/form/target filters, pagination, reviewer column/filter, mark reviewed, archive/restore, detail answers and signature display. Add API integration tests for reviewer scoping and lifecycle, plus Playwright admin/reviewer workflows. Mobile cards replace desktop table; actions stay reachable and labeled.
- [ ] **20. Build reviewer workspace.** Implement reviewer home/progress, assigned targets, available form links, own submissions, status filters, sign-out, and empty/error states. Test a reviewer cannot inspect another member’s assignments or submissions even by direct URL/API calls.
- [ ] **21. Build progress/overview and same-page drawer.** Implement summary and reviewer workload aggregates, documented completion semantics, sort controls, click-to-open same-page drawer, active/archive tabs, and one-based numbering for all review rows. Selecting a row preserves the overview context and presents its review without unintended navigation. Test zero goal, zero targets, multiple submissions per target, archived submissions, unassigned target, and multiple reviewers.
- [ ] **22. Build workspace settings and shared theme.** Implement goal, identity, theme preset editing, immediate unsaved preview, save/error/conflict states, reset defaults, and public form preview. Test persistence across admin, reviewer, editor and public form pages; validate all preset values server-side and reject arbitrary CSS/font URLs.

### Phase 5 — Quality, Operations, and Release

- [ ] **23. Accessibility, responsive, and browser verification.** Run automated axe checks and keyboard-only flows for login, reset, team, target assignment, form editor, public form, inbox, and modal/drawer. Manually verify current iOS Safari, Android Chrome, desktop Safari, Chrome, Firefox, and Edge, including pointer/touch signature drawing, orientation changes, virtual keyboard, safe-area bottom nav, zoom, and reduced-motion. Record browser/OS/build versions and defects in `docs/qa/browser-matrix.md`.
- [ ] **24. Add operational controls.** Configure graceful shutdown, connection pool limits, DB timeout, retry policy only for safe idempotent operations, redacted logs, metrics for latency/status/DB pool/rate-limit events, readiness checks, and alert guidance. Validate process shutdown closes HTTP and Prisma cleanly. Do not add Redis as a requirement unless measured traffic/hosting topology needs shared state.
- [ ] **25. Prepare deployment runbook.** Document Hostinger plan compatibility, Node version, separate web/API process commands, MySQL provisioning, environment variables, HTTPS/domain routing, same-origin rewrite/API internal URL, trusted proxy setup, migration/release/rollback, bootstrap owner, backups, restore, and logs. Require `DATABASE_URL`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `WEB_ORIGIN`, `API_INTERNAL_URL`, `PORT` (hosting supplied), `DATABASE_CONNECTION_LIMIT`, and trusted proxy configuration. Never expose secrets to the browser bundle. Confirm server binds `0.0.0.0` and honors the hosting `PORT` variable.
- [ ] **26. Execute full release gates.** Run format check, lint, typecheck, unit tests, MySQL integration tests, production builds, Playwright critical-path suite, dependency audit, migration from empty DB, migration from previous release, backup/restore drill, tenant isolation suite, browser matrix, and load scenarios below. Publish a release evidence report with command outputs, versions, pass/fail, and known limits. Do not describe the result as deployment-ready if any required gate is skipped or failing.

## Verification and Test Matrix

| Layer | Required checks |
|---|---|
| Shared contracts/domain | Boundary schemas, unknown fields, policy truth tables, form normalization, answer validation, progress derivations, role matrix. |
| API unit | Token hash/encryption, password formats, CSRF/origin, rate limiter behavior, error mapping, audit redaction, pagination. |
| API integration (real MySQL) | Every route family, transaction behavior, constraints, concurrent token use/submit, tenant isolation, role denial, migration correctness, query counts for dashboard/list routes. |
| Web component | Login show/hide and validation; no cross-portal links; editor field controls; assignment selectors; mobile card actions; theme preview/save; drawer close/keyboard; signature pointer/typed modes. |
| E2E | Admin bootstrap/login → invite reviewer → reviewer setup/login → create/publish form → add target/assign reviewer → issue link → submit review → admin inbox/detail/mark reviewed → progress/drawer → reset password → login with new password. Include revoked, expired and wrong-role branches. |
| Accessibility | Automated axe plus manual keyboard and screen reader spot checks; WCAG 2.2 AA target for key flows, contrast, visible focus, labels, errors, status announcement, touch targets. |
| Compatibility | Latest supported stable Safari iOS/macOS, Chrome Android/desktop, Firefox desktop, Edge desktop; test signature canvas and typed fallback, navigation, date/input behavior, viewport and safe areas. |
| Operations | Fresh install, production build, migration, health/readiness, graceful shutdown, backup, restore, token/key rotation plan, rollback rehearsal, logs/metrics contain no secrets or answers. |

Required gates and commands should be declared in package scripts and CI; expected commands are `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run build`, and `npm run test:e2e`. CI must start a disposable MySQL service for integration tests. No test should depend on developer-local data, network email, or a persistent production account.

## Load, Stability, and Scalability Plan

Do not guess “high traffic” from a successful local test. Before selecting thresholds, obtain expected peak concurrent users, submissions/minute, data retention, and the actual Hostinger CPU/RAM/connection limits from the purchased plan. Until that evidence exists, use a documented provisional load profile and label it provisional.

Test against a production build and production-like MySQL with realistic seeded tenants, reviewers, forms, targets, published versions, and submissions. Exercise login, dashboard, paginated inbox, public form read, and public submit. Run: (a) 15-minute steady baseline at expected peak, (b) 3× expected peak for 10 minutes, (c) 5× burst for 60 seconds, (d) 60-minute soak at expected sustained load, (e) one DB restart/failover simulation where hosting allows. Record p50/p95/p99, request rate, 4xx/5xx/timeouts, event-loop lag, CPU, RSS, DB query latency, pool wait/usage, active connections, and duplicate submission count.

Initial release targets (review against actual plan and revise with evidence): p95 under 500ms for authenticated list reads and under 1s for public form fetch/submit excluding client network; 5xx under 0.5% during steady load; no lost or duplicate accepted submissions; no pool exhaustion or unbounded memory growth; readiness fails quickly when DB is unavailable and recovers when restored. These are acceptance targets, not current claims.

Scalability rules: use server-side pagination and indexed filters; cap page size and payload; avoid loading all submissions/targets into browser; aggregate progress with bounded SQL queries (or measured rollups later); configure per-process DB pool so `instanceCount × poolSize` stays below DB connection limit with headroom; no N+1 queries; avoid synchronous CPU-heavy work on request paths; cache only public immutable assets and safe published resources, never session-bound/private responses. If horizontally scaling, move rate limiting and any ephemeral coordination to shared infrastructure and verify sessions/secrets are identical across instances. Keep a documented threshold for adding Redis/queues; do not add them preemptively.

## Deployment and Operations Checklist

1. Select and verify the Hostinger plan supports the chosen Node runtime, long-running web/API processes (or documented combined process), MySQL version/connections, persistent storage policy, HTTPS, environment secrets, background execution if needed, and inbound/outbound routing. If not, choose a compatible hosting architecture before coding deployment assumptions.
2. Provision separate production and staging databases; issue unique secrets per environment. `SESSION_SECRET` must have sufficient random entropy. `TOKEN_ENCRYPTION_KEY` must be a dedicated 32-byte key and have a rotation/re-encryption runbook.
3. Configure canonical domain and HTTPS, exact `WEB_ORIGIN`, same-origin `/api/v1` proxy/rewrite, API internal address, trusted-proxy behavior, secure cookie flags, and request size/timeouts.
4. Build immutable artifact from locked dependencies. Run migration as a release step before routing traffic; never run destructive schema reset or seed demo data in production.
5. Bootstrap the first Owner through a one-time command or deployment secret flow that does not print password/token in logs. Force password setup and remove/disable bootstrap capability afterwards.
6. Verify liveness/readiness, login, invitation, reset, public review, database backup, restore to an isolated database, alert/log access, and rollback before public launch.
7. Back up database on a documented schedule, encrypt backups, restrict access, define retention, and rehearse restore. Back up encryption key material separately with restricted access; DB backup without token encryption key cannot restore active re-showable access tokens.
8. Monitor error rates, p95 latency, process restarts, memory, DB storage/connections, failed readiness, and rate-limit abuse. Define owner/on-call steps and incident response for exposed links/secrets.

## Decisions Already Settled (Do Not Re-ask)

- Separate admin and reviewer login pages and credentials; one shared secure backend may serve both, with distinct membership credentials and strict role checks.
- Reviewer access starts with one-time account setup and then email/password authentication.
- Password recovery is admin-issued via a separate one-time reset token; no email delivery/SMTP is required.
- Admin/reviewer portals are at `/admin` and `/reviewer`; public review is at `/r/:token`; the login screens must not advertise the other portal.
- Theme settings are controlled by admins and apply to both portals and form editor/public review surfaces.
- Workspace identity remains as the visible tenant name; it is separate from the custom domain.
- On the overview, clicking a reviewer shows their numbered work in a same-page drawer; review lists include sequential numbers.
- Admin targets and submissions show assigned reviewers. Reviewer choices must come from active Team memberships rather than manual typing.
- Mobile navigation is fixed at the bottom; admin target/team/submission/editor/detail screens must remain usable without horizontal page scrolling.
- Login forms need show/hide password control. Forgot-password guidance leads to admin-issued reset tokens.

## Supporting Repository References

The plan is standalone; consult these documents for implementation evidence and operational details, resolving any conflict in favor of this plan's explicit product decisions and verifying current code before assuming it works:

- `docs/CONTEXT.md` — domain glossary and language.
- `docs/architecture.md` — current system overview and route/API inventory.
- `docs/routing-and-workspace-architecture.md` — role route and workspace routing details.
- `docs/field-types.md` — current form field definitions and rendering constraints.
- `docs/ui-responsive-and-signature-support.md` — responsive and signature compatibility notes.
- `docs/hostinger-deployment.md` — hosting setup notes; confirm platform limits at deployment time.
- `docs/deployment-readiness-review.md` and `docs/security-and-deployment-audit-2026-10-22.md` — known gaps and security/operational review; treat as findings to resolve or explicitly accept, not proof of readiness.

## Completion Criteria

The build is complete only when every task above is checked, all verification gates pass on a clean checkout, MySQL migrations and restore are proven, all roles and tenant boundaries are tested, the E2E journey works, mobile/browser checks are recorded, the load evidence is compared with actual hosting capacity, and deployment/rollback runbooks are complete. Report residual risks and measured limits plainly. A plan or local passing suite alone does not mean production deployment has occurred.
