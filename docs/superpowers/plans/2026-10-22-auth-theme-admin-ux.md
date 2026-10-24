# Authentication, Workspace Theme, and Admin UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver role-specific admin/reviewer sign-in, admin-issued one-time password reset tokens, an admin-controlled workspace theme across all app surfaces, and focused responsive admin UX improvements.

**Architecture:** Keep the existing Next.js App Router, Express API, Prisma/MySQL data model, and organization-scoped authorization. Separate sign-in pages and endpoint policies by role while reusing the existing password hashing and secure session primitives. Persist validated theme settings per organization and apply them through CSS custom properties; keep reset-token lifecycle in a focused service and consume it transactionally.

**Tech Stack:** Next.js 16.4.2, React 19, TypeScript, Tailwind CSS 4 (existing PostCSS setup), Node.js 24, Express 5, Zod 4, Prisma 7, MySQL.

## Execution status — 2026-10-22

This section is the authoritative handoff state. The checklist farther below records the original design sequence and may contain unchecked items that are now implemented or intentionally deferred; use this summary before starting more work.

### Latest follow-up — settings save and admin workflow UX (2026-10-22)

- Fixed the appearance-save validation failure: the server theme read includes `updatedAt`, while the strict write schema accepts only `accentColor` and `fontPreset`. `themeUpdatePayload` now whitelists those writable keys for both initial state and PUT requests. Regression test: `apps/web/src/lib/theme-settings.test.mjs`.
- Reworked Settings into separate goal, workspace identity, and appearance cards with per-card save status, clearer labels, a live sample, and responsive layout. Updated Team access and Review targets page copy/layout; at tablet widths the token/member panels stack, tables remain usable through horizontal scrolling, and add-person fields are labelled and responsive.
- Fresh verification after this follow-up: web tests (28 passed), root typecheck, lint, and production build all pass. Local API readiness returned 200. The browser automation surface was disabled in Work settings, so authenticated visual click-through QA was not available in this turn.
- Continue from these concrete files: `apps/web/src/features/settings/settings-manager.tsx`, `apps/web/src/lib/theme-settings.ts`, `apps/web/src/features/team/team-manager.tsx`, `apps/web/src/features/people/people-manager.tsx`, and the final admin workflow section of `apps/web/app/globals.css`. Recheck authenticated appearance saving after login, then inspect responsive pages at desktop, tablet, and mobile widths.

### Completed and verified

- Role-specific `/admin/login` and `/reviewer/login` pages and API endpoints; legacy `/login` remains a chooser/compatibility entry. Admin and reviewer credentials are independent per workspace membership. Existing account password hashes were copied to existing memberships before dropping the shared `User.passwordHash` column in migration `202610220005_membership_credentials`.
- Shared accessible `PasswordInput` controls include one show/hide toggle for login and reset-password forms. Reset tokens are a separate kind from invitation tokens.
- Admin-only reset token issue/list/revoke routes are membership- and organization-scoped. Tokens expire in 30 minutes, store SHA-256 hashes only, return raw secret only at issuance (`Cache-Control: no-store`), are one-use, and reset only the selected membership password and its sessions. `/reset-password` accepts email, token, and a 14-character-minimum new password. Team UI shows the fresh token until page navigation and supports copy-again.
- Workspace appearance API and `OrganizationTheme` DB model store a strict allowlisted accent color and system-safe font preset. Owner/admin can save in Settings; member workspace shell and public form read validated theme values. Form-list titles now use the heading token. API CORS explicitly permits the theme `PUT` method.
- Prisma migrations `202610220004_organization_theme` and `202610220005_membership_credentials` were generated and applied to the configured local MySQL database. Do not run a destructive reset against it.
- Fresh verification: root `npm run typecheck`, `npm run lint`, `npm run build`, API tests (54), web tests (28), and `npm audit --omit=dev` (0 production dependency findings) all pass. `prisma migrate status` reports all eight migrations applied and schema up to date. Full `npm audit` reports five high findings in dev-only lint dependencies via `braces@3.0.3`; avoid `npm audit fix --force` because it proposes downgrading Next lint configuration to 14.x.
- Local HTTP check: `/api/v1/health/live` and `/api/v1/health/ready` returned 200; web `/login` returned 200. Earlier auth smoke check: admin owner login returned 200; same owner identity on reviewer login returned 401; reset-token issue/revoke returned 201/204; theme get/update/restore returned 200. Secret values were not output.

### Remaining/partial work

- Appearance controls currently offer accent palette + font preset with a small preview. Logo upload, custom surface colors, separate heading/body presets, reset-to-default button, and full multi-surface preview are intentionally deferred; do not claim they are implemented.
- Team includes member-specific reset action, but the admin page does not currently fetch/render reset-token metadata history or provide an explicit revoke-existing-reset-token action from the UI. API GET/DELETE routes exist; add UI only if needed.
- Review targets layout already has search, reviewer filters, assignment/status/empty state and responsive table, but this implementation did not add new bulk assignment UX. Reinspect current behavior before making visual edits.
- No browser-based mobile visual QA, Hostinger staging deploy, representative load test, penetration test, external monitoring/alert configuration, or backup-restore rehearsal was performed.

### Exact continuation sequence for another developer/agent

1. Read this status block, then `docs/superpowers/specs/2026-10-22-auth-theme-admin-ux-design.md`, `docs/architecture.md`, and `docs/security-and-deployment-audit-2026-10-22.md`.
2. Keep separate per-membership credentials: never reintroduce `User.passwordHash`; reset transaction must update only `Membership.passwordHash` and delete sessions only for that membership. Keep reset token distinct from invitation token and do not put raw secrets in logs/list responses.
3. For remaining Appearance work, extend `OrganizationTheme` using schema/migration, strict allowlists, tests, tenant-scoped APIs, then UI; logo bytes must be signature checked, bounded to 1 MiB, generated filenames only, and stored outside executable/public code directories.
4. For account recovery UI, fetch only metadata through `GET /members/:id/password-reset-tokens`; expose revoke only for active token; never fetch hashes or attempt to recover an old raw secret.
5. For Hostinger, deploy the npm-workspace repo as two separate Node apps (web and API) from the repo root with workspace-specific build/start commands, configure exact HTTPS `WEB_ORIGIN`, set reachable `API_INTERNAL_URL` before web build, apply Prisma migrations as a release step, and test on staging. Current directory is not connected to a private Git remote; ZIP packaging is the alternative.
6. Before final claims, rerun `npm run typecheck`, `npm run lint`, both workspace test scripts, `npm run build`, `npm audit --omit=dev`, and API health/login integration smoke checks. Do not claim high-traffic capacity without a load test and metrics.

## Global Constraints

- Do not add Docker or Redis.
- Do not add email delivery; password recovery is admin-issued token only.
- Invitation tokens and password-reset tokens are separate credential types.
- Store only hashes for reset tokens; never return or log token hashes.
- Server-side role and workspace authorization is mandatory for every protected action.
- Use allowlisted font presets and validated colors; never accept arbitrary CSS or remote font URLs.
- Keep the existing owner account and existing reviewer invitations, sessions, and published forms compatible.
- User approved the design at `docs/superpowers/specs/2026-10-22-auth-theme-admin-ux-design.md`.

---

## File map

### Authentication and recovery

- `apps/api/prisma/schema.prisma`: add `PasswordResetToken` with workspace, membership, user, lifecycle timestamps, and indexes.
- `apps/api/prisma/migrations/<timestamp>_password_reset_tokens/migration.sql`: create the table and foreign keys.
- `apps/api/src/modules/auth/auth-policy.ts`: pure role-acceptance rule for admin and reviewer login flows.
- `apps/api/src/modules/auth/auth-policy.test.mjs`: role-policy regression tests.
- `apps/api/src/modules/auth/password-reset.ts`: token creation, consume, and expiry policy helpers.
- `apps/api/src/modules/auth/password-reset.test.mjs`: lifecycle unit tests.
- `apps/api/src/modules/auth/auth.routes.ts`: keep legacy `/login`; add `/admin/login`, `/reviewer/login`, and `/password-reset` handlers with role checks.
- `apps/api/src/modules/members/member.routes.ts`: admin-only reset-token issue/list/revoke handlers scoped to the active organization and membership.
- `packages/contracts/src/auth.ts`: role-login and password-reset request/response Zod schemas.
- `packages/contracts/src/index.ts`: export the new auth schemas.
- `apps/web/src/features/auth/password-input.tsx`: reusable labeled password input with one visibility toggle.
- `apps/web/src/features/auth/login-form.tsx`: accept the login audience and submit to its role-specific endpoint.
- `apps/web/app/admin/login/page.tsx`, `apps/web/app/reviewer/login/page.tsx`: role-specific entry pages.
- `apps/web/app/login/page.tsx`: compatibility chooser with links to the dedicated pages.
- `apps/web/app/reset-password/page.tsx` and `apps/web/src/features/auth/password-reset-form.tsx`: reset-token form.
- `apps/web/src/features/team/team-manager.tsx`: member-scoped reset-token issue/copy/reissue UI.

### Workspace theme

- `packages/contracts/src/organization-theme.ts`: allowlisted theme types and validators.
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_organization_theme/migration.sql`: organization-scoped settings and default values.
- `apps/api/src/modules/organization/theme.ts`: pure conversion from stored theme to validated response and CSS-safe values.
- `apps/api/src/modules/organization/theme.test.mjs`: theme validation, defaults, and color/contrast tests.
- `apps/api/src/modules/organization/theme-assets.ts`: PNG/WebP signature validation, generated filenames, and bounded filesystem storage.
- `apps/api/src/modules/organization/organization.routes.ts`: `GET /theme` for authenticated members and `PUT /theme` for owners/admins.
- `apps/web/src/lib/workspace-theme.ts`: map API theme enum values to CSS custom properties.
- `apps/web/src/components/workspace-theme-provider.tsx`: apply validated theme properties to the workspace root.
- `apps/web/app/(workspace)/layout.tsx`: load theme in the authenticated organization context and pass it to the provider.
- `apps/api/src/modules/submissions/public-review.routes.ts`: include the organization theme in public review bootstrap data.
- `apps/web/app/r/[token]/page.tsx`, `apps/web/src/features/review/public-review-load.ts`, `apps/web/src/features/review/review-portal.tsx`: validate and apply the public form theme.
- `apps/web/src/features/settings/appearance-settings.tsx`: editable theme controls and preview.
- `apps/web/app/(workspace)/settings/page.tsx`, `apps/web/src/features/settings/settings-manager.tsx`: add the Appearance section and simplify settings grouping.
- `apps/web/app/globals.css`: use CSS variables for brand, surface, heading, and body type tokens; apply heading font to form names in list/editor/public form.

### Admin UX

- `apps/web/src/features/team/team-manager.tsx`: clarify member and credential sections and make reset actions member-specific.
- `apps/web/src/features/people/people-manager.tsx`: improve responsive controls and table/list hierarchy without changing assignment authorization.
- `apps/web/src/features/forms/form-list-manager.tsx`: apply heading font to form titles and preserve explicit archive/permanent-delete labels.
- `apps/web/app/globals.css`: responsive and focus/contrast styles for touched pages and login/reset views.

---

## Workstream A — Role-specific sign-in and password recovery

### Task A1: Define and test role-specific login policy

**Interfaces:** `canRoleSignInAs(audience: "admin" | "reviewer", role: Role): boolean`.

- [ ] Write table-driven tests covering OWNER and ADMIN accepted only for admin, REVIEWER accepted only for reviewer, and all cross-role pairs rejected.
- [ ] Run `npm run build --workspace @reviewroom/contracts` and the focused API test; confirm the new policy tests fail before implementation.
- [ ] Implement the pure `canRoleSignInAs` function and export only what routes/tests need.
- [ ] Re-run the focused test and confirm all cases pass.

### Task A2: Add role-specific login endpoints and pages

**Consumes:** `canRoleSignInAs` and existing `verifyPassword`, `setSessionCookie`, `createCsrfToken` helpers.

- [ ] Add request schema tests for strict email/password/audience inputs and reject extra keys.
- [ ] Refactor login handling to accept an explicit allowed-role set, filter workspace memberships before workspace selection, and reject mismatches with the existing generic credential response.
- [ ] Expose `POST /api/v1/auth/admin/login` and `POST /api/v1/auth/reviewer/login`; preserve `/api/v1/auth/login` as a backward-compatible endpoint.
- [ ] Add `/admin/login` and `/reviewer/login`; each page submits only to its matching endpoint and redirects to the role's landing page.
- [ ] Keep `/login` as a role-choice page; no role is selected through an untrusted query parameter.
- [ ] Extract `PasswordInput`; verify one eye button exists only in the password control and has an accessible name and `aria-pressed` state.
- [ ] Run focused API tests, web typecheck, and login route smoke checks for both role classes and cross-role rejection.

### Task A3: Persist and test reset-token lifecycle

**Interfaces:** `issuePasswordResetToken(input)`, `consumePasswordResetToken(input)`, and `assertResetTokenUsable(token)`; persisted records contain only `tokenHash`, user, membership, organization, expiry, and lifecycle timestamps.

- [ ] Add failing pure tests for expired, consumed, revoked, wrong-member, and wrong-workspace tokens; test valid tokens and replacement invalidation.
- [ ] Add the Prisma model and SQL migration with indexed hash uniqueness and cascading workspace/member/user foreign keys.
- [ ] Implement token generation with `randomBytes(32)`, SHA-256 hash storage, 30-minute expiry, and transactional one-use consumption.
- [ ] On successful consume, hash the new password, mark the token consumed, revoke other reset tokens for that member, delete the user's active sessions, and audit the event without token material.
- [ ] Run focused lifecycle tests, Prisma validation/generation, and migration against the local MySQL database.

### Task A4: Add reset-token APIs and UI

- [ ] Add strict Zod schemas for reset-token issue and consume bodies.
- [ ] Add owner/admin-only `POST /api/v1/members/:membershipId/password-reset-tokens`, scoped to `request.auth.organizationId`; reject inactive members and protect owners from accidental reset unless the acting owner explicitly resets themself through the normal process.
- [ ] Add authenticated list/revoke operations that return metadata only; return the raw reset token only in the issue/reissue response with `Cache-Control: no-store`.
- [ ] Add public `POST /api/v1/auth/password-reset` with origin validation, strict rate limiting, generic failure text, and 14-character minimum password validation.
- [ ] Add `/reset-password` with email, reset token, new password, and reusable show/hide control.
- [ ] Add Team access actions to issue/copy a reset token, show expiry and status, and reissue to invalidate a misplaced token.
- [ ] Test CSRF, rate limiting, expired/revoked/replayed/cross-workspace tokens, session deletion, generic errors, and secret redaction.

## Workstream B — Admin-controlled workspace theme

### Task B1: Define and test theme contract

**Interface:** `workspaceThemeSchema` fields: `logoPath`, `primaryColor`, `accentColor`, `surfacePreset`, `headingFont`, and `bodyFont`; enum values are allowlisted and colors must be canonical hex.

- [ ] Add tests for accepted defaults/presets, malformed colors, unknown font names, extra keys, and insufficient text contrast.
- [ ] Implement strict Zod schemas and a pure contrast validator with explicit threshold tests.
- [ ] Add a theme asset utility that accepts only PNG/WebP signatures under 1 MiB, creates cryptographically random filenames, and rejects path-like filenames.
- [ ] Build contracts and run focused theme tests before moving to the API.

### Task B2: Persist theme and enforce API permissions

- [ ] Add `OrganizationTheme` with one-to-one organization relation, default token values, and `updatedAt`.
- [ ] Add migration with safe defaults for existing workspaces; generate Prisma client and verify against MySQL.
- [ ] Add a public, read-only theme-asset endpoint that resolves generated filenames beneath the configured theme asset directory and sets `Content-Type`, `X-Content-Type-Options: nosniff`, and immutable cache headers.
- [ ] Add `GET /api/v1/organization/theme` for active workspace members and `PUT` for OWNER/ADMIN with CSRF.
- [ ] Add owner/admin-only `POST /api/v1/organization/theme/logo` with a 1 MiB raw-body limit, PNG/WebP byte-signature validation, generated filename, and audit event; replace/delete the old asset only after the new logo is safely persisted.
- [ ] Validate all input using the shared schema, write an audit event containing only changed theme field names, and scope every query by authenticated organization ID.
- [ ] Test reviewer read access, reviewer write rejection, cross-organization isolation, and invalid theme rejection.

### Task B3: Apply the theme across workspace and public forms

- [ ] Add a typed mapper from theme settings to `--brand-primary`, `--brand-accent`, `--surface`, `--font-heading`, and `--font-body` CSS custom properties.
- [ ] Load the active workspace theme in `(workspace)/layout.tsx` and apply it through a provider without using `window` during server render.
- [ ] Include the theme in public review bootstrap response and validate it before applying styles.
- [ ] Apply heading font to form names in list/editor/public forms and body font to controls/content across admin and reviewer surfaces.
- [ ] Test server/client style parity and fallback when legacy workspaces have no theme row.

### Task B4: Add Appearance controls and live preview

- [ ] Add failing mapper/preview tests for each supported preset and CSS custom-property output.
- [ ] Build an Appearance section in Settings with PNG/WebP logo upload, native color inputs, preset selects, sample admin/reviewer/form preview, save/cancel, restore-defaults, and saved/error states.
- [ ] Display contrast feedback before saving; keep controls keyboard accessible and responsive.
- [ ] Run web typecheck and verify theme changes persist and appear on admin, reviewer, editor, and public form.

## Workstream C — Focused admin UX cleanup

### Task C1: Simplify Settings and Team access

- [ ] Group Settings into Progress, Workspace identity, and Appearance sections with independent busy/error/success states.
- [ ] In Team access, visually distinguish active memberships, invite tokens, reset tokens, and form links; put actions next to the selected member and label token expiry/reissue clearly.
- [ ] Preserve destructive action confirmations and never show reset hashes or previously generated raw tokens.
- [ ] Verify the layout at desktop and 375px viewport width; test keyboard operation and status announcements.

### Task C2: Improve Review targets and Forms typography

- [ ] Improve Review targets spacing, responsive search/filters, assignment controls, and empty state without changing backend assignment rules.
- [ ] Apply the chosen heading font to form-list titles, editor headings, and public form title; retain the existing archival and permanent-delete behavior.
- [ ] Verify no horizontal overflow at 375px and 785px widths and verify focus-visible states.

## Final verification and handoff

- [ ] Run `npm run typecheck`, `npm run lint`, `npm test --workspace @reviewroom/web`, `npm test --workspace @reviewroom/api`, and `npm run build` from the repository root.
- [ ] Apply all pending Prisma migrations locally and confirm both `/api/v1/health/ready` and `/login` return healthy responses.
- [ ] Verify admin and reviewer sign-in, role mismatch rejection, reset-token expiry/replay/session invalidation, and theme isolation across two workspaces.
- [ ] Inspect owner/admin and reviewer pages plus public forms at desktop and mobile widths.
- [ ] Report remaining deployment prerequisites (real TLS origin, production secrets, MySQL backups/pool sizing, configured outbound rate-limit strategy, and representative load test); do not claim high-traffic capacity without measurements.


## Follow-up: role-scoped public routes

Implemented the canonical browser path design in `docs/routing-and-workspace-architecture.md`. Admin pages now live under `/admin/*`; reviewer pages under `/reviewer/*`. `/admin/login` and `/reviewer/login` are dedicated and do not link to each other. `/login` is a compatibility redirect to `/admin` and is no longer a role chooser.

Next.js rewrites preserve the public URL while reusing the existing shared page implementations. `proxy.ts` forwards audience and original path hints; the authenticated layout and `requireWorkspaceRole` verify the actual session role and redirect wrong-role navigation to that user’s own home. API middleware remains the data authorization boundary. Canonical links are being updated across forms, submissions, password reset, and invitation acceptance.

Route verification still required after implementation: web typecheck, lint, unit tests, production build, unauthenticated deep-link redirect smoke checks, and API readiness check. The source file `docs/routing-and-workspace-architecture.md` is the handoff source of truth for future agents.

### Route implementation and verification status (2026-10-22)

**Completed**
- Added canonical public role route namespaces and preserved browser URLs through Next rewrites.
- Added explicit `/admin` and `/reviewer` entry routes and changed `/login` to a compatibility redirect to `/admin`; the role picker is removed.
- Removed opposite-role login links. Login success and invitation acceptance route users to their role workspace/sign-in. Password reset returns to the role-specific login from its audience query.
- Added Proxy hints for original request path and audience, plus page-boundary role/audience checks. API authorization remains unchanged as the data security boundary.
- Changed page-to-page navigation to canonical admin/reviewer URLs, including forms and submission detail flows.
- Added the handoff document `docs/routing-and-workspace-architecture.md` with route tables, request/authorization flow, source structure, maintenance rules, and deployment notes.

**Verification evidence**
- Web unit tests: 29 passed.
- Web TypeScript typecheck: passed.
- Web ESLint: passed.
- Production Next.js build: passed.
- HTTP smoke checks on the local app: `/admin` → `/admin/login`; `/reviewer` → `/reviewer/login`; `/login` → `/admin`; unauthenticated admin deep links → `/admin/login`; unauthenticated reviewer deep links → `/reviewer/login`; both role login pages return 200.

**Remaining deployment work**
- Configure production secrets, database, SMTP/reset-token delivery policy, HTTPS/domain reverse proxy, backups, monitoring, and capacity/load testing per `docs/hostinger-deployment.md` and `docs/deployment-readiness-review.md`. The successful local build does not establish high-traffic capacity or production readiness by itself.

## Follow-up: shared UI, mobile usability, and signature compatibility (2026-10-22)

- Applied a consistent readability/touch baseline to the shared app: focus styles, larger mobile targets, 16px mobile inputs (avoids Safari auto-zoom), safe-area spacing, improved muted-text contrast, and responsive admin/reviewer/public form layouts.
- Shared password visibility control now covers both login pages, invitation password creation/confirmation, and one-time token reset. Login calls the reset route “Forgot password?” while explaining the reset token comes from the workspace admin; this follows the agreed no-email reset flow.
- Signature input remains native SVG + Pointer Events, with typed alternative, pointer capture fallback, primary-pointer handling, normalized responsive coordinates, non-distorting responsive SVG sizing, clear/redraw, and pinch zoom support.
- Added `docs/ui-responsive-and-signature-support.md` for future agents, including design system rules, route-independent component boundaries, compatibility notes, known legal-signature limitation, and a manual release matrix.
- Browser support is based on current platform documentation for Pointer Events and `touch-action`. Device-level browser testing was unavailable because local browser automation is disabled in Work settings.

**Verification:** web tests (32 passed), web typecheck, web lint, API tests (54 passed), and root production build all passed. This proves compile and test behavior, not a full interactive Safari/Android device matrix.

## Follow-up: reviewer workflow and appearance controls (2026-10-22)

### Implemented in this pass

- Review targets now accept an optional active reviewer membership ID in the create request. The API validates that the reviewer is an active REVIEWER in the same organization, then creates the target and assignment in one Prisma transaction with audit events. The UI chooses from active Team access memberships; it never asks the admin to type a reviewer name.
- Admin submissions now have a reviewer selector. Reviewer-specific active and archived views use reviewerId filters and cursor pagination. The backend checks membership role, active status, and organization before honoring an admin filter. Reviewer sessions remain constrained to their own authenticated membership even if a reviewerId query is supplied.
- Overview reviewer rows open an in-page side panel with active and archived reviews, a load-more action, and links to the corresponding submission. The panel closes with Escape, backdrop click, or its close button.
- Workspace appearance is now persisted as four allowlisted values: accent color, font preset, page-surface preset (mist, warm, or cool), and form-surface style (clean or soft). Shared CSS variables apply to admin/reviewer pages, the form editor sheet, and public review pages. Theme input remains enum-based; no custom CSS, URL, or remote font can be stored.
- Additive Prisma migrations 202610220006_theme_surfaces and 202610220007_reviewer_submission_filter add the appearance columns and a reviewer/archive list index. Run npm run db:migrate before deploying the application version that reads these columns.
- Removed the editable Workspace identity card from Settings because the current workflow does not need another branding control. Keep Organization.name in the model and session: it identifies the active workspace in the navigation and supports a future multi-workspace account. No identity data was deleted.

### Current verification

- Root production build passes with the isolated output directory `.next-verification` (Next.js 16.4.2; contracts, API, and web compile; static generation completes).
- Root typecheck passes.
- Root lint passes. The isolated Next build directory is now ignored by ESLint and Git so generated bundles do not enter source linting.
- Web unit tests: 34 passed. API unit tests: 59 passed, including reviewer scoping, target validation, submission deletion/archive, and theme validation.
- Prisma client generated from the updated schema; migrations `202610220006_theme_surfaces` and `202610220007_reviewer_submission_filter` applied successfully to the local MySQL database.
- Local smoke checks returned HTTP 200 for API readiness, `/admin/login`, and `/reviewer/login`.
- Browser automation is disabled in Work settings, so visual behavior on physical Safari/iOS, Android, Firefox, and Edge remains a manual staging check. The responsive CSS and standard browser APIs were code-reviewed, but this is not a device certification.
- Production capacity remains unmeasured. Before launch, complete Hostinger environment configuration, HTTPS/domain proxy, production secrets, SMTP or agreed reset-token delivery, backups/restore rehearsal, monitoring, database pool sizing, and representative load tests. See `docs/hostinger-deployment.md`, `docs/deployment-readiness-review.md`, and `docs/security-and-deployment-audit-2026-10-22.md`.

### Source map for the next agent

- Assignment create UI and state: apps/web/src/features/people/people-manager.tsx.
- Assignment API validation and transaction: apps/api/src/modules/targets/target.routes.ts; request contracts: apps/api/src/modules/targets/target.schemas.ts.
- Admin/reviewer submission inbox: apps/web/src/features/submissions/submissions-manager.tsx; page bootstrap: apps/web/app/(workspace)/submissions/page.tsx; workspace-scoped queries: apps/api/src/modules/submissions/submission.routes.ts.
- Reviewer overview side panel: apps/web/src/features/progress/reviewer-progress-board.tsx.
- Appearance controls: apps/web/src/features/settings/settings-manager.tsx; persisted API schema and defaults: apps/api/src/modules/organization/theme.ts; database model: apps/api/prisma/schema.prisma; shared CSS mapping: apps/web/src/lib/workspace-theme.ts; shell and public form consumers: apps/web/src/components/workspace-shell.tsx and apps/web/src/features/review/review-portal.tsx.
- Keep API membership/organization checks authoritative. Client reviewer lists are convenience only and never establish permission.

## Follow-up: public review load failures (2026-10-22)

- `loadPublicReview` now models expected request failures as `{ kind: "error" }` instead of throwing during the Next.js server render. Network failures, non-404/410 API statuses, and malformed success payloads show a retry screen. Revoked/expired links retain their distinct unavailable screen.
- A safe `X-Request-Id` is shown as a reference when it matches a restricted alphanumeric/dot/dash/underscore format. Error response bodies and link tokens are not displayed.
- Regression coverage: 6 focused loader tests pass; complete web suite: 37 passed. Root typecheck, lint, and isolated production build pass. Local GET for the previously referenced revoked token returns HTTP 200 and the unavailable screen.
- The original report omitted the failing public URL and API status. The old token referenced earlier currently returns the expected 404, so the exact upstream trigger (for example a throttled request or API failure) cannot be identified from this evidence. If the retry screen persists, use its displayed reference ID to correlate the API error log.

## Follow-up: reviewer detail interaction, mobile layout, and release smoke (2026-10-22)

### Completed from browser feedback

1. The Review targets edit icon edits the target's full name and email inline. Its accessible name tells the user which person will be edited.
2. Selecting a review in the Overview reviewer drawer keeps the user on Overview and displays the submission detail in that drawer. Each active or archived review row shows its sequence number; load-more continues the numbering.
3. Submissions cards and filters reflow to a phone layout.
4. Workspace navigation uses the mobile layout at narrow viewports.
5. Review targets switch from a horizontally scrolling data table to labeled target cards on phones.
6. Submission detail wraps long content and preserves a responsive signature display.
7. The shared mobile navigation remains usable from submission detail.
8. Form editor uses a single-column editor/preview flow on phone widths; a tablet breakpoint no longer overrides the phone layout.

### Verification and release limits

- Root typecheck and lint pass; web suite: 37 passed; API suite: 59 passed; isolated production build passes.
- `npm run load:smoke` provides a bounded, repeatable local smoke check for API readiness, public review lookup, and web login HTML. Run with `LOAD_WEB_URL`, `LOAD_API_URL`, `LOAD_REQUESTS`, and `LOAD_CONCURRENCY` for a controlled staging check. It caps API request volume below the application's current per-process 300/minute global limiter. See `scripts/local-load-check.mjs`.
- Production-mode web + local API smoke at the script maximum (concurrency 24): API readiness 120/120 HTTP 200, p50 9.3 ms/p95 22.6 ms; invalid public review lookups 120/120 HTTP 404, p50 14.7 ms/p95 18.3 ms; production web login 120/120 HTTP 200, p50 24.6 ms/p95 36.7 ms. A second batch within the same minute received 100 HTTP 429 responses after the shared 300/minute API limiter was reached; the runner reports 429 as expected throttling for random public links. This is a short local smoke, not capacity certification.
- Production dependency audit has zero findings. Full audit has five HIGH advisories in development-only lint tooling; no forced cross-major dependency downgrade was made.
- Physical-browser tests and Hostinger staging tests remain release gates. In particular, no results here certify high-request throughput, horizontal scaling, database saturation behavior, multi-instance rate limits, or recovery under real load.
- Update the deployment audit after the intended Hostinger plan is provisioned and the representative sustained, 3× burst, 5× burst, and process restart recovery runs have captured latency/error and resource metrics.

## Follow-up: mobile navigation, people cards, and team access cards (2026-10-22)

- Mobile workspace navigation is fixed to the viewport bottom; safe-area padding and page bottom space preserve access to the final page actions.
- Review-target form fields are constrained to the phone viewport, target cards shrink long reviewer selectors and names, and Team access member records become labeled responsive cards rather than a wide scrolling table.
- Checks rerun: root typecheck and lint pass, web tests 37/37, API tests 59/59, optimized production build passes.
- Maximum configured local burst rerun (24 concurrency): readiness 120/120 HTTP 200 (p50 14.8 ms/p95 88.4 ms); invalid public review lookups 120/120 HTTP 404 (p50 14.9 ms/p95 43.8 ms); production login page 120/120 HTTP 200 (p50 26.9 ms/p95 92.1 ms). This is a bounded smoke/burst only, with no sustained load or DB write scenario.
- Physical device/browser validation remains outstanding. Hostinger plan validation, production configuration, real staging traffic tests, resource monitoring, and backup restore remain required before claiming high-volume deployment readiness.

## Follow-up: role-specific panel identity (2026-10-22)

- Removed the sidebar organization/workspace selector card and replaced the shared product label with `Admin Panel` or `Reviewer Panel` based on the authenticated role. The top breadcrumb now begins with the same panel label.
- Login, reset-password, invitation, and public review surfaces use the correct panel brand. Root metadata reads the role audience from `proxy.ts` so browser titles and `applicationName` follow `/admin/*`, `/reviewer/*`, and the reviewer reset query. Invitation titles follow the invitation role.
- Added an audience-brand mapping unit test. Web suite: 38 passed; typecheck, lint, and production build passed. Production HTTP checks verified Admin/Reviewer login titles, both reset-password audience titles, and public review title/brand.
- Source map: `apps/web/src/lib/panel-brand.ts` owns the brand mapping; `apps/web/app/layout.tsx` owns request-aware metadata; `apps/web/src/components/workspace-shell.tsx` owns the authenticated shell labels; `apps/web/proxy.ts` sets audience headers for metadata.
