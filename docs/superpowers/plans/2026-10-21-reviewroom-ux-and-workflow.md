# ReviewRoom UX and Workflow Improvements Implementation Plan

## Work package 22 — Progress semantics, member data purge, and signature answer

**Goal:** Make progress counts unambiguous, distinguish archived membership from permanent deletion, verify the login visibility controls and existing cross-device signature implementation, and record reproducible project handoff/readiness evidence.

**Verified current behavior before changes:** Workspace goal progress counts completed review targets against `ProgressConfig.targetCount`; reviewer bars show each reviewer's completed target count against that same goal. `getTeamReviewerProgress` already excludes active reviewers with no assignments from its completion denominator. The current dashboard copy still makes the distinct values (goal, active target records, assignment rows, completed targets, total submissions, and reviewers with assigned work) easy to confuse; make each label and progress denominator explicit. Member `DELETE /members/:id` archives membership, revokes sessions/assignments/links and retains membership/history; it does not physically delete the membership row. An owner-only `DELETE /members/:id/permanent` already hard-deletes an archived membership after a submission-history guard and audit event; make the separate action visible and explain the guard. Login already has password-only visibility toggle in source; the supplied screenshot may be a stale running bundle, so verify the live route before editing. Signature is already implemented end to end in the current source; validate its client interaction, bounded schema, platform fallback, and accessibility rather than duplicating it.

**Signature design already in source:** `FormField.type === "signature"`; answer is either typed text or normalized bounded pointer strokes. Keep the typed-name option, clear action, accessible labels, limits and safe SVG polyline rendering. Treat it as a captured acknowledgement mark, not proof of identity or a legally compliant e-signature.

**Permanent member deletion already exists:** The action is owner-only and only applies to archived non-owner memberships with zero retained submissions. It deletes the membership row after writing an audit event; database relations cascade membership sessions, assignments, and links. It deliberately leaves the global user account and other workspace memberships intact. Preserve archive/restore and make the hard-delete control visible beside Restore.

**Progress semantics:** Team completion denominator is active reviewer memberships with at least one active assignment. Zero-assignment reviewers are excluded from both completed and eligible counts and labelled “Waiting for assignments.” Individual meter remains completed targets / configured workspace goal (1/50 = 2%); “all assigned work done” is a separate status. Dashboard should name its distinct quantities: target goal, active targets added, assignment rows, completed targets, total submissions, and goal gap (goal minus targets added). The main progress bar must always read people reviewed / target goal; reviewer completion belongs in the reviewer workload section.

**Suggested next form tags (backlog):** Section heading/help and page break first (no answer storage); matrix scale later; address group after locale/validation decisions; file upload only with quota, content validation, malware scanning, private object storage and retention policy. Name/email/URL/phone/date/yes-no/rating/choice/checkbox/dropdown/ranking/consent already exist.

**Readiness assessment:** The 15 reviewers/50 people workload is modest in product terms, but production traffic capacity remains unmeasured. Re-run code/security/dependency checks and app verification; do not claim high traffic stability without realistic load tests, database connection budget, shared rate limiting when horizontally scaled, monitoring, backup/restore and rollback rehearsal. Hostinger plan-specific process/memory/request-timeout limits must be checked against the chosen plan; local build success is not deployment proof. No Docker or Redis.

**Files expected:** contracts `forms.ts`; API submission answer validator/tests; web form editor model/preview; review portal/signature control; submission detail; progress board utility/tests and dashboard labels; member routes/tests and team manager; login form/CSS; deployment audit and this handoff plan.

- [x] Confirm team completion denominator excludes unassigned reviewers; add tests that make the denominator explicit.
- [x] Clarify dashboard cards and make the primary progress bar represent completed people / workspace goal. Add test for goal gap (50 goal, 2 targets added -> 48 not yet added).
- [x] Verify login source exposes one password visibility toggle and no email visibility toggle; supplied screenshot is not proof current bundle was loaded.
- [x] Verify signature schema, editor palette/preview, responsive Pointer Events drawing, typed fallback, server answer validation, and safe SVG/text submission display are present; API tests cover bounded valid/invalid values.
- [x] Verify existing owner-only permanent membership delete API, archive-only and no-submission guard, audit event, and separate permanent-delete UI control. Clarify archive vs hard-delete semantics in UI/report.
- [x] Run typecheck, lint, API/web tests, production build, dependency audit, Prisma validation and targeted source scan; document infrastructure-only gates.
- [x] Update `docs/security-and-deployment-audit-2026-10-22.md` and this agent-facing handoff with verified current status.

### Handoff/source map for a new contributor

- Workspace/app constraints and commands: root `README.md`, `docs/architecture.md`, `docs/hostinger-deployment.md`; stack is Next.js/TypeScript/Tailwind-adjacent CSS, Express 5, Prisma 7/MySQL; keep Docker/Redis out.
- Contracts and domain types: `packages/contracts/src/`; Prisma entities and migrations: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`.
- API entry/config/middleware: `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/http/`, `apps/api/src/middleware/`; feature routes/services are under `apps/api/src/modules/<domain>/`.
- Web App Router pages: `apps/web/app/`; reusable feature logic/UI: `apps/web/src/features/<domain>/`; shared API/session helpers: `apps/web/src/lib/`; global responsive styles: `apps/web/app/globals.css`.
- Current domain flows: auth/membership/invitation in `modules/auth` and `modules/members`; form definitions/publication in `modules/forms`; reviewer links in `modules/links`; targets/assignments in `modules/targets`; submissions/validation/archive in `modules/submissions`; progress metrics in `modules/progress`.
- Add new answer types in one vertical slice: shared Zod discriminated union -> editor palette/factory/preview/settings -> public input state/render -> server answer validation/limits -> submission read display -> focused tests. Published form versions are immutable snapshots; preserve old schema compatibility.
- Any database change requires a new timestamped migration, Prisma generate/validate, and deployment migration sequencing. Never apply migrations to a DB without checking the configured target first.
- Rules: inspect relevant `AGENTS.md`; for Next edits read relevant docs from `apps/web/node_modules/next/dist/docs/`; implement failing test first for behavior fixes; no destructive DB action without visible confirmation; keep secrets/tokens out of logs and responses unless the endpoint intentionally reveals a no-store bearer URL.

### Work package 22 implementation/verification record

- [x] Reproduced the goal-gap case in a failing web test, then added `getPeopleRemainingForGoal`; web suite passes 27/27.
- [x] Admin dashboard now labels the target goal, assignment rows, completed people, and submissions separately. Main bar uses `completedTargets / targetCount`; the goal card reports active targets added and people still to add.
- [x] Reviewer workload remains separate: team completion counts only active reviewers with at least one active assignment. Individual bars remain each reviewer's completed target count / shared workspace goal, so 1 of 50 is 2% even if all of that reviewer's assigned work is complete.
- [x] Permanent member delete already existed; surfaced a visible “Delete permanently” label. API permits owner-only hard deletion only after archive and when zero submissions refer to the membership. Ordinary “Remove” stays reversible and preserves the membership/history.
- [x] Signature is present end to end and tested: editor catalog/preview, Pointer Events drawing, typed name fallback, bounded normalized answer schema, server validation, safe SVG/text review display. MDN confirms Pointer Events and SVG polyline are widely available in current browsers. Device-specific visual QA has not been performed; this is not certified electronic-signature or identity-proofing software.
- [x] Source pattern scan, `npm audit`, typecheck, lint, API tests (45), web tests (27), production build and Prisma schema validation completed. Production dependency audit: 0; full audit: 5 high development-chain findings; no `--force` downgrade.
- [x] Started local Next and Express development apps without Docker/Redis. `/login` and API liveness return HTTP 200. **Readiness is blocked:** local MySQL `127.0.0.1:3307` is unreachable, no MySQL/MariaDB Windows service is registered, and read-only Prisma migration status reports a schema-engine error. Do not apply migrations.
- [x] Updated security/deployment audit. Remaining deployment gates include connecting this untracked workspace to a private Git remote or verified ZIP release, bringing up a known isolated MySQL instance, clean Hostinger two-app staging, MySQL-backed integration tests, load/edge tests, monitoring, backup restore and rollback rehearsal.

> **For agentic workers:** Use the executing-plans skill to implement this plan task-by-task. Keep each package independently reviewable and mark checkboxes as work proceeds.

**Goal:** Improve the form editor, assignment workflow, team administration, progress visibility, and mobile usability while preserving ReviewRoom's tenant security and immutable published form versions.

**Architecture:** Keep Next.js App Router as presentation, Express as the authorization and persistence boundary, shared Zod contracts as the network boundary, and MySQL/Prisma as storage. Build on existing feature modules. Every API change retains server-side authorization, organization scoping, validation, and audit behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS and existing global styles, Express 5, shared Zod contracts, Prisma 7, MySQL 8.4, lucide-react.

## Current handoff snapshot — 2026-10-22

Read this section first when continuing the project; the work packages below are the historical implementation record.

- **Current request:** resolve unclear dashboard denominators, clarify reversible member removal versus hard deletion, confirm the signature field and platform fallback, report security/deployment/high-traffic status, and keep this file suitable as an AI-worker handoff.
- **Latest code change:** Work Package 22 clarifies admin dashboard metrics and makes the main progress bar use completed people / configured goal; the workspace goal gap is explicitly computed (50 goal, 2 active targets -> 48 still to add). The member hard-delete control now has a visible label; backend hard deletion already existed as owner-only, archived-only, no-submission, audited deletion of the membership row. Signature field is already fully implemented and tested across contract, editor, public input, validation, and safe submission rendering.
- **Latest verification:** Root typecheck and lint passed; production build passed; API suite 45/45, web suite 27/27, and Prisma schema validation passed. Production-only npm audit reports 0 vulnerabilities. Full npm audit reports 5 high findings in the dev-only `eslint-config-next` -> `@next/eslint-plugin-next` -> `fast-glob` -> `micromatch` -> `braces` chain; do not run `npm audit fix --force` because it downgrades `eslint-config-next` to 14.2.35. Local Next login and API liveness return HTTP 200, but API readiness is blocked: `.env` points at `127.0.0.1:3307` (unreachable); a `mysqld` process is listening on 3306, but the API connector times out waiting for a pooled connection even under a temporary port-only diagnostic override. No `.env` values were changed or printed and no migrations were applied.
- **Primary audit:** `docs/security-and-deployment-audit-2026-10-22.md`; concise operational summary: `docs/deployment-readiness-review.md`; deployment steps: `docs/hostinger-deployment.md`.
- **Unproven/blocking gates:** no Git remote or tracked source in the current parent Git repository; known-good isolated MySQL database; exact Hostinger plan and clean-clone deployment of both monorepo apps; MySQL-backed route integration; trusted-proxy/client IP behavior; CSP report-only review; log retention/alerts; backup restore and rollback; representative and burst load testing. Do not claim deployment readiness, high-traffic capacity, or production stability until the relevant gates are verified on staging.
- **Hosting note:** Hostinger managed Node apps currently run one long-lived process per app, share plan process/memory limits, enforce 120-second request timeout, and do not support inbound WebSockets or persistent workers. Verify the actual account plan; use the documented VPS alternative if managed limits/routing are insufficient.
- **Continuation rule:** Read this snapshot and latest incomplete work package, inspect the live source before assuming older work remains open, then use test-first focused changes. Never inspect/modify production records or disclose secrets; no Docker/Redis. Update this snapshot and relevant checkboxes with evidence after each verified change.

## New-worker build guide

This is the project handoff entry point. Read this guide, then the audit and deployment docs linked above, and finally the latest incomplete work package. The numbered work packages below are the implementation history; they are not a request to rebuild completed features.

### Product boundary and roles

- **Owner:** controls administrators, workspace settings, and all workspace records.
- **Admin:** manages forms, review targets/assignments, submissions, and reviewer access tokens/links.
- **Reviewer:** has a separate panel for own progress, own submissions, and own form links. Do not render admin pages or team-wide data to this role; enforce the same boundary in Express.
- **Review target:** the person being evaluated. This is not a team member. Create targets in Review targets and assign each target to one active reviewer.
- **Invitation access token:** a single-use bearer URL for joining the team, valid seven days. It is hash-validated, encrypted at rest only while pending so authorized admins can copy it again, invalidated on acceptance/expiry/revocation, and never shown in ordinary list responses.
- **Reviewer form link:** a separate bearer URL tied to one reviewer and one published form. It exposes that reviewer’s assigned targets only. Replacing/revoking it invalidates future access; it is not the account login credential.

### Architecture and source map

```text
apps/web (Next.js App Router, React, TypeScript)
  app/(workspace)/...        role-aware admin/reviewer pages
  app/r/[token]/...          public form-link entry
  src/features/<domain>/     client UI and domain view models
  src/lib/api.ts             server-side Express API calls
  src/lib/client-api.ts      browser-side same-origin API calls
apps/api (Express, TypeScript, Prisma)
  src/app.ts                 middleware, health routes, router mounting
  src/modules/<domain>/      route handlers and business services
  src/middleware/            session, CSRF, and role authorization
  src/http/                  request context, errors, rate limits
  prisma/schema.prisma       MySQL persistence and relationship rules
packages/contracts           shared TypeScript/Zod request and form schemas
```

The browser calls Next.js; Next server pages and browser API helpers call Express. Express plus shared Zod schemas are the authorization/validation boundary. Prisma writes workspace-scoped MySQL data. Never rely on hidden UI controls as authorization. Public bearer pages must be noindex/no-store where applicable and must not leak token hashes or ciphertext.

### Core record lifecycle and invariants

| Record | Normal lifecycle | Removal rule |
| --- | --- | --- |
| Membership | active → archived → restored | Keep membership history; revoke sessions, assignments, and links when access is removed. |
| Invitation | pending → accepted / expired / revoked | Pending token may be revealed only through an owner/admin action; rotate when expired or unrecoverable. |
| Review link | active → expired / revoked / replaced | Only hash lookup is used for access; encrypted secret exists to let an authorized admin/reviewer re-copy an active link. |
| Review target | active → archived → restored | Retain existing submissions and audit events. |
| Form | draft → published versions → archived → restored | Preserve immutable published versions and submission history. Hard delete only when relational history allows it, or after the admin explicitly removes dependent submissions. |
| Submission | active → archived → restored → permanently deleted | Archive is reversible and keeps answers; permanent delete is owner/admin-only, confirmed, audited, and removes answer data. |

Every mutation must validate the authenticated role, organization scope, CSRF (for cookie-authenticated writes), input shape, current record state, and expected related-record constraints. Add audit events in the same DB transaction as the mutation. Permanent deletion must not silently cascade into unrelated records; return a useful conflict when dependencies remain.

### Route and page map

| Area | Web route | API area | Owner/admin | Reviewer |
| --- | --- | --- | --- | --- |
| Overview/progress | `/` | `/progress` | workspace total and team board | own progress against workspace goal |
| Review targets | `/people` | `/targets` | create/update/archive/assign targets | hidden |
| Submissions | `/submissions`, `/submissions/[id]` | `/submissions` | view, mark reviewed, archive/restore/purge | own view/review actions only |
| Forms | `/forms`, `/forms/[id]` | `/forms` | draft, publish immutable version, archive/restore/purge | hidden |
| Team access | `/team` | `/members`, `/review-links` | roles, invitations, reviewer links | hidden |
| Reviewer links | `/my-link` | `/review-links/mine` | hidden | own published form links |
| Workspace settings | `/settings` | `/organization`, `/audit` | owner/admin as scoped | hidden |
| Public review | `/r/[token]` | `/public/review` | no session required | bearer scope only; assigned targets + bound published form |

Keep fixed collection routes (for example `/submissions/archived`) registered before parameter routes (`/:submissionId`). Return only the data a page requires and bound collection sizes/cursors.

### Local development and verification

- Prerequisites: Node `>=24.12 <25`, npm, and reachable MySQL configured in the ignored root `.env`; never print or commit `.env` values. Current local `.env` points at port 3307, which was unavailable during this follow-up; confirm the intended MySQL instance and credentials before changing it.
- Install/build from repository root so npm workspaces and shared contracts resolve: `npm ci`, `npm run db:generate`, then `npm run dev`. Apply `npm run db:migrate` only after verifying the configured URL points to the intended disposable/local or staging database.
- Checks from repository root: `npm run typecheck`, `npm run lint`, `npm test --workspace @reviewroom/api`, `npm test --workspace @reviewroom/web`, `npm run build`, and `npx prisma validate --schema apps/api/prisma/schema.prisma`.
- API health checks: `/api/v1/health/live` and `/api/v1/health/ready`; readiness depends on MySQL.
- Keep database-backed destructive tests on disposable test data. Do not run Docker or Redis. Do not deploy or claim load readiness from local build checks.

### Current next implementation scope

Work Packages 20–22 are recorded as complete at the source/test level. The next work is operational and must proceed in this order: establish the intended non-Docker MySQL connection locally or in an isolated staging database; add MySQL-backed route/migration tests; establish a private Git remote or reproducible clean ZIP build; verify exact Hostinger two-app root/build/start/network settings; perform visual browser checks on mobile Safari and Chrome including the signature input and password toggle; then exercise staging migrations, proxy/rate-limit behavior, load, monitoring, backup restore, and rollback. Do not add another field or unrelated feature until these gates or a new user priority is selected. Maintain the user constraint: no Docker or Redis.

## Work package 21 — Recoverable archive and explicit permanent removal

**Goal:** Let workspace administrators find and restore archived submissions/forms, and deliberately erase selected records when requested, without confusing archive with delete or silently cascading through protected review history.

**API contract:**

- `GET /submissions/archived?limit=100` — owner/admin only; organization-scoped page of archived submissions, returning the same safe display projection as the active inbox.
- `POST /submissions/:submissionId/restore` — owner/admin + CSRF; restore only an archived submission; audit `SUBMISSION_RESTORED` in the same transaction.
- `DELETE /submissions/:submissionId/permanent` — owner/admin + CSRF; permanently delete an active or archived submission and its answers, retaining only the audit event `SUBMISSION_PERMANENTLY_DELETED` (no answer content in audit metadata).
- `GET /forms?state=active|archived` — owner/admin only; list the selected lifecycle state and total submission count.
- `POST /forms/:formId/restore` — owner/admin + CSRF; restore an archived form, setting status to `PUBLISHED` when `currentPublishedId` exists, otherwise `DRAFT`; do not reactivate revoked reviewer links.
- `DELETE /forms/:formId/permanent` — owner/admin + CSRF; active or archived form can be removed only if no active or archived submission references it. Return HTTP 409 `FORM_HAS_SUBMISSIONS` without changing the form when dependencies remain. Delete the form; MySQL cascades its versions and reviewer links. Record `FORM_PERMANENTLY_DELETED` in the same transaction.

**Security and data policy:**

- Retain existing `DELETE /submissions/:id` as archive for compatibility; it must never become a hard delete.
- Permanent-delete controls require a second explicit confirmation naming the selected record. The API still enforces role, organization scope, CSRF, and lifecycle constraints; client confirmation is not authorization.
- Do not expose archived data to reviewers. Keep active reviewer submission access scoped to the signed-in membership.
- Archive/restore/delete audit events contain actor, action, entity type/id, and timestamp only; never copy answer payloads into audit data.
- A form with any submission cannot be hard-deleted until those submissions are explicitly deleted. Do not disable FK constraints or cascade through submission history implicitly.
- Invitation tokens: label the existing reveal-and-copy control “Copy token” and keep it available only for a live pending invitation with recoverable encrypted token. Once accepted, expired, or revoked, the join token is not a reusable account credential; issue a fresh invitation instead.

**Web contract:**

- `/submissions` gets `All responses`, `Archived`, `Needs review`, and `Reviewed` views. Archived view shows a read-only detail link plus Restore and Delete permanently; active admin rows show Archive and Delete permanently as distinct actions. Reviewer UI never renders archive/delete controls.
- `/forms` gets active/archived tabs. Active rows open the editor and expose Archive and Delete permanently. Archived rows expose Restore and Delete permanently. Show a useful explanation/link if a form cannot be purged until its submissions are removed.
- `/team` labels the pending invitation row action “Copy token”; the action retrieves the same token from the scoped `no-store` reveal endpoint and copies it, without rotating it.

**Files to inspect/change:** `apps/api/src/modules/submissions/submission.routes.ts` (static archived route before `/:submissionId`), `submission-lifecycle.ts` and tests, `apps/api/src/modules/forms/form.routes.ts`, `form.service.ts`, `form-lifecycle.ts` and tests, `apps/api/prisma/schema.prisma` plus a migration adding composite indexes for archived listing and form submission counts, `apps/web/app/(workspace)/submissions/page.tsx`, `apps/web/src/features/submissions/submissions-manager.tsx`, `apps/web/app/(workspace)/forms/page.tsx`, `apps/web/src/features/forms/form-list-manager.tsx`, `apps/web/src/features/forms/form-editor.tsx`, `apps/web/src/features/team/team-manager.tsx`, related styles, and this plan.

**Execution steps (TDD):**

1. Add unit tests for archived-only restore, organization mismatch/no writes, hard-delete audit/no answer retention, and form purge rejection when submission count is non-zero. Run the focused API tests and confirm they fail for the missing operations.
2. Add the transaction-backed submission lifecycle service; route the new archived/restore/permanent-delete endpoints through it with role and CSRF middleware. Keep archived listing before the dynamic id route. Add an admin-only archived detail mode; return 404 to reviewers and render archived details read-only with Restore. Keep Next `notFound()` outside broad catches. Run focused API tests.
3. Add form list-state, restore, and permanent-delete tests. Implement restore status from `currentPublishedId`, revoke active links during archive, and transactionally reject purge when any submission exists without changing the form. Run focused form lifecycle tests.
4. Add web view-model/component tests for active vs archived tabs and action visibility by role. Add server-loaded archived records only for administrators. Implement explicit confirmations and inline errors/status announcements.
5. Rename invitation “Show token” to “Copy token”; verify the reveal endpoint remains pending-only, workspace-scoped, rate-protected where appropriate, no-store, and never returns token ciphertext/hash.
6. Verify API/web test suites, typecheck, lint, production build, health checks, and safe HTTP smoke behavior. Update this handoff snapshot and every package checkbox with exact counts. MySQL-backed delete/restore integration and backup recovery remain required staging checks.

**Acceptance checks:** no delete action is mislabeled Archive; archive remains reversible; restore makes the record reappear in the active list; permanent deletion removes the row and answers; form purge is blocked while submissions exist; each mutation writes a safe audit record atomically; reviewer role cannot enumerate archived or delete records; copied pending token remains unchanged across copy actions and old accepted tokens are not exposed.

### Work package 21 handoff status

- [x] Added transaction-backed archive, restore, and permanent submission deletion operations with tenant scoping and content-free audit events.
- [x] Added owner/admin-only archived submission listing and restore routes; added permanent-delete route while preserving the existing archive endpoint.
- [x] Added active/archived submission views, archived read-only details with Restore, and separately confirmed permanent-delete controls.
- [x] Added form archive/restore/permanent-delete operations; archiving revokes share links, restore does not reactivate them, and permanent deletion checks submissions before deleting versions/links.
- [x] Added forms Active/Archived UI, restore and permanent-delete controls in the list and editor, plus clear dependency errors.
- [x] Changed the pending invitation action label to “Copy token” and preserved repeat-copy through the existing no-store reveal route; accepted tokens remain unavailable.
- [x] Added composite indexes for archived submission queries and form-scoped submission counts; Prisma schema validated and Prisma Client generated.
- [x] API tests 43/43, web tests 23/23, typecheck, lint, production build all passed.
- [ ] Apply the migration to a disposable local MySQL database and run route-level integration tests for archive/restore/delete, FK conflict mapping, and invitation reveal.
- [ ] Verify pages in browser at desktop/mobile widths and confirm reviewer cannot see archived submissions or delete controls.
- [x] Refresh local health checks: `/forms`, `/submissions`, API live, and API ready returned HTTP 200.
- [ ] Staging load/backup/restore gates from WP18 remain open.

## Global Constraints

- Do not use Docker or Redis.
- Preserve TypeScript types and request validation across web, API, and shared contracts.
- API authorization and organization scoping remain authoritative; hiding controls is not access control.
- Preserve immutable published form snapshots and historical answer rendering.
- Ranking answers remain user-arranged sequences without visible rank numbers.
- Retain accessible labels, keyboard access, visible focus, reduced-motion support, and mobile layouts.
- A new field type is incomplete until editor, public renderer, validation, persistence, and historical rendering all support it.
- phpMyAdmin is optional and local-only, never a public production admin surface.
- Do not introduce Redis-backed limits or claim in-memory rate limits are shared across instances.

## Repository map and verified baseline

- `apps/web/src/features/forms/form-editor.tsx`: question palette, preview, properties, up/down ordering, save, publish, archive.
- `apps/web/app/(workspace)/forms/[formId]/page.tsx`: server page providing initial form data. Verify exact path before edits because PowerShell treats brackets specially.
- `packages/contracts/src/forms.ts`: field discriminated union, answer shape, ranking validation, cross-field constraints.
- `apps/web/src/features/review/review-portal.tsx`: respondent-side answer controls.
- `apps/api/src/modules/forms/form.routes.ts`, `form.service.ts`: form CRUD, draft updates, publishing, archive.
- `apps/api/src/modules/submissions/answer-validator.ts`, `public-review.routes.ts`: submitted answer validation and persistence.
- `apps/web/src/features/people/people-manager.tsx`, `apps/api/src/modules/targets/target.routes.ts`: target CRUD, search/pagination, single-reviewer assignment.
- `apps/web/src/features/team/team-manager.tsx`, `apps/api/src/modules/members/member.routes.ts`, `apps/api/src/modules/links/review-link.routes.ts`: invite/member/link lifecycle.
- `apps/web/app/(workspace)/page.tsx`, `apps/api/src/modules/progress/progress.routes.ts`: overview counts and configured goal.
- `apps/web/app/globals.css`: shared styles and existing 850px/620px breakpoints.
- `apps/api/prisma/schema.prisma`: MySQL domain model and indexes.
- `README.md`: documents the no-Docker/no-Redis setup, local-only phpMyAdmin, and per-process rate-limit behavior; validate any later runtime changes against it.
- Before editing, read `apps/web/AGENTS.md`, the current Next.js guide it references, package scripts, and existing test conventions.

### Existing behavior (avoid rebuilding it)

- The builder supports 15 answer types: full name, short text, long text, email, URL, phone, yes/no, number, single choice, checkboxes, dropdown, rating, date, consent, and ranking.
- Question order uses up/down buttons; no drag interaction exists.
- Save and publish already display inline feedback, but share a message area and the status is hidden on mobile. Publish makes a draft PATCH followed by a publish POST, so failures can be partial.
- Archive currently uses a more-actions glyph.
- One reviewer is assigned per target. Target search and API pagination already exist.
- Team access already supports invitations, role edits, member removal, reviewer-link create/rotate/revoke. Improve lifecycle clarity/discoverability; do not duplicate APIs.
- A target currently counts complete after at least one active submission. The progress configuration already carries a completion rule; use it consistently.
- Mobile styles exist, but team tables, toolbar/status, bulk actions, and editor property panels require deliberate review.

---

## Work package 1 — Editor interaction, feedback, and polish

**Files:** `apps/web/src/features/forms/form-editor.tsx`; relevant rules in `apps/web/app/globals.css`; inspect the form server page and `apps/api/src/modules/forms/form.service.ts`. Add tests within established test locations.

**Implement:**
- Reduce the Required switch's visual dimensions while keeping a touch-sized interactive area, accessible name, and visible focus.
- Give draft save and publish independent idle/pending/success/failure feedback. Keep it visible at mobile widths and announce changes with `aria-live`. Do not report success before the API call succeeds.
- Explain partial outcome accurately: if draft save succeeds but publish fails, report “Draft saved; publish failed” with the API error.
- Use an Archive icon with an action-specific label and preserve confirmation before archiving.
- Keep question reorder accessible with non-pointer up/down controls. Add drag-and-drop only if focus, selection identity, and deterministic ordering remain correct.
- Add question duplication with fresh question and option UUIDs. Preserve values but keep the copy independent.
- Keep selection coherent after reorder, duplicate, or delete. Optional bounded Undo applies only to structural actions; defer if it could silently discard property edits.

**Acceptance:** smaller Required switch; distinct mobile-visible save/publish outcomes; accurate partial failure; Archive glyph and confirmation; accessible reorder; duplicate IDs are all new; historical publish behavior unchanged.

**Verification:** tests for save/publish transitions, partial failure, reorder/duplicate/delete identity. Run focused web tests and typecheck from package scripts; manually inspect desktop/320px and keyboard-only flow.

## Work package 2 — Audit existing field types and add selected types

**Files:** `packages/contracts/src/forms.ts`; `apps/web/src/features/forms/form-editor.tsx`; `apps/web/src/features/review/review-portal.tsx`; `apps/api/src/modules/submissions/answer-validator.ts`; inspect form service and historical submission reads.

**Audit all 11 existing types** for schema constraints, builder defaults/settings/preview, respondent control, serialization, server validation, accessibility, and rendering from a stored published definition. Fix confirmed gaps. Specifically verify checkbox min/max, number bounds, rating step/division behavior, and known option IDs for choice answers. Do not rename persisted discriminants.

**Candidates after audit:** URL (URL validation and safe display), phone (bounded normalized string), yes/no (boolean semantics). File upload is deferred until private storage, upload authorization, size/type scanning, retention, and deletion policies are designed. Signature, payment, GPS/location, and calculated fields are out of scope.

**Acceptance:** maintain an audit matrix in PR notes or a small doc; every added type round-trips through draft, publication, response validation, submission read, and historical snapshot. API rejects invalid answers when browser validation is bypassed. Existing definitions parse without migration.

**Verification:** contract tests per type, API validation tests, builder/public renderer tests; run contract/API/web test and typecheck scripts. No palette-only additions.

## Work package 3 — Easier assignment workflow

**Files:** `apps/web/src/features/people/people-manager.tsx`; change `apps/api/src/modules/targets/target.routes.ts` only for confirmed gaps; inspect `apps/api/prisma/schema.prisma` before any model change.

**Implement:**
- Filters for all, unassigned, selected reviewer, completed, and in-progress targets. Base completion on configured rule.
- Server-derived reviewer workloads: assigned, completed, remaining, with compact progress.
- Bulk assign selected targets to one active reviewer in one all-or-nothing transaction. Preview count and explicitly warn that existing assignments are replaced.
- Preserve search/filter/selection across row refresh and pagination.
- Make unassign, target edit/archive, empty/loading/error/no-results states discoverable. Preserve archived target submissions.
- Do not silently skip rows during a bulk operation. Keep current one-reviewer-per-target semantics.

**Acceptance:** admins quickly identify work status; bulk operation is atomic and reports outcomes; inactive or cross-org reviewer IDs are rejected; reviewer still sees only assigned targets; single assignment still works; reassignment preserves prior submissions.

**Verification:** API tests for tenant isolation, inactive reviewers, atomicity/idempotency, audit. UI tests for filters, selection, confirmation and errors. Add indexes only with evidence.

## Work package 4 — Complete and clarify team CRUD

**Files:** `apps/web/src/features/team/team-manager.tsx`; inspect `apps/api/src/modules/members/member.routes.ts`, `apps/api/src/modules/links/review-link.routes.ts`, organization/audit modules. Change contracts only for real payload changes.

**Implement:**
- Separate Members, Pending invitations, Reviewer links, with counts, search/status/role filters.
- Explicit invite lifecycle: copy link, revoke pending invite, show accepted/expired states. Offer resend only if actual email delivery exists; do not claim delivery when only generating a link.
- Retain role change, removal, and reviewer link create/rotate/revoke; show pending/success/error outcomes and confirm destructive/replacement actions.
- Clarify owner/admin/reviewer permissions and enforce in API.
- Only support editing display name if linked user data can be updated consistently and securely; otherwise leave profile editing as a separate capability.
- Preserve one-time raw secret display and link expiry/revocation warnings.

**Acceptance:** every visible action maps to an authorized endpoint; UI only reflects confirmed API success; secrets are never returned by list endpoints or reloaded; audit data excludes secrets and answers; mobile rows usable.

**Verification:** API role/tenant tests and UI lifecycle tests including one-time secret behavior; inspect audit metadata.

## Work package 5 — Reviewer completion board (no ordinal ranks)

**Files:** `apps/api/src/modules/progress/progress.routes.ts`; `apps/web/app/(workspace)/page.tsx`; add focused component under `apps/web/src/features/progress/` if interaction warrants. Add tests.

**Definition:** sortable progress board rather than numbered leaderboard. No ordinal placement numbers. Each active reviewer row shows assigned, completed, remaining, and percent. Zero assignments means “No targets assigned,” never misleading 100%. Completion is based on configured rule; under current ONE_RESPONSE rule, target completion for that reviewer requires their active submission for that assigned target. Default sort: completion percentage descending, completed count descending, display name ascending. Allow sort by name/completed/remaining. Show full bar and a clear 100% badge. Admin sees active reviewers; confirm reviewer self-scope against current route permissions.

**Acceptance:** server-calculated organization-scoped counts exclude archived targets/submissions and inactive members; exact same completion rule as overview; zero assignment is explicit; completed reviewers easy to identify without numbered ranks; summary reconciles.

**Verification:** API tests for zero/partial/100%, exclusions, role scope, deterministic ties. UI tests for sorting, badge, empty/mobile states. Check row totals against overview under one-reviewer-per-target model.

## Work package 6 — Mobile and accessibility pass

**Files:** `apps/web/app/globals.css`, only feature components with proven responsive issues. Inspect workspace shell, every workspace route, public review route, invitation, and login.

Review 320px, 375px, 768px, 1024px, desktop across Overview, People, submission list/detail, form list/editor, Team, Settings/audit, login/invitation, public review. Eliminate page-level horizontal overflow; use stacked rows or labeled local table scrolling. Keep navigation and final actions reachable with safe-area insets. Ensure editor, assignment, team actions are touch-usable; target 44px for primary touch controls where practical. Keep focus order, labels, validation announcements, text/icon status beyond color, and reduced-motion behavior.

**Acceptance:** no clipped primary action or page-level overflow at 320px; keyboard can complete main flows; no status depends on color alone; no workflow requires desktop.

**Verification:** existing lint/typecheck/tests plus browser viewport and keyboard review; record justified exceptions.

## Work package 7 — Setup and handoff docs

**Files:** `README.md`; inspect `.env.example`, package scripts, DB scripts, compose files, and actual rate-limit middleware before documentation edits. Do not delete unrelated infra files.

Document this workspace's actual local MySQL/phpMyAdmin path without requiring Docker/Redis. Explain rate limit behavior truthfully: if limits are in-memory, they are per API process and not shared across replicas. Do not invent a replacement limiter. Keep phpMyAdmin optional/local-only. Verify prerequisites, env steps, migrations, health URLs against real scripts.

**Acceptance:** a new engineer can follow README without Docker/Redis; no contradictory requirement claims; limit behavior and multi-instance caveat match code.

**Verification:** validate commands against package scripts and local MySQL setup; search for stale user-facing Docker/Redis requirements.

---

## Cross-package quality and security gates

- Read `apps/web/AGENTS.md` and its installed Next.js guide before web edits.
- Validate IDs, bodies, query filters, pagination with shared or route-local Zod schemas.
- New/changed endpoints require tests for role authorization and tenant isolation.
- Mutations retain CSRF and audit behavior; use transactions for bulk assignment and lifecycle operations.
- Keep reads bounded/paginated; compute progress on the server.
- Never log answers, invite tokens, raw reviewer secrets, sessions, or credentials.
- Follow repository test conventions. Discover exact commands from package scripts; do not claim unrun commands passed.
- Group changes by package and provide a handoff note with completed packages, files, executed commands, and remaining limitations.

## Suggested sequence

1. Editor feedback and interaction.
2. Audit and selectively extend field types.
3. Assignment workflow.
4. Team CRUD clarity.
5. Completion board.
6. Mobile/accessibility sweep after feature work.
7. README/runtime documentation, validated against final configuration.

Each package is independently reviewable. Packages 1–5 can land separately; package 6 follows the feature changes to avoid duplicated styling. Package 7 can be drafted independently but must be checked against actual runtime configuration.

## Execution log

- [x] Work package 1: separate save/publish feedback (including save-then-publish partial failure), compact Required switch, Archive icon, pointer and button-based question reordering, and question duplication with fresh IDs. Added six focused Node tests. Verified with `npm test --workspace @reviewroom/web`, web typecheck, root lint, and the editor at 320px in the browser. Replaced the incompatible legacy ESLint bridge with Next.js 16 flat config so lint runs cleanly.
- [x] Work package 2: audited all original field types, added Website/URL, Phone number, and Yes/No, fixed optional blank and required whitespace validation, checkbox minimum bounds for new writes, and guarded very large rating controls. Added API validation tests and the support matrix in `docs/field-types.md`. Verified with API/web tests, root typecheck, and root lint.
- [x] Work package 3: assignment status/reviewer filters, selection across loaded cursor pages, load-more pagination, explicit unassign, replacement confirmation, bulk assignment capped at 100 targets, strict all-target validation, one atomic transaction, and per-assignment audit records. Reviewer progress supplies assigned/completed/remaining workloads. Four service tests cover organization scoping, inactive reviewer rejection, simulated transaction rollback, retry state, and audit records. Real HTTP/MySQL integration coverage remains a future quality improvement.
- [x] Work package 4 implementation: member search and role/status filters, access-role explanation, restore action, invitation/reviewer-link counts, confirmations, success/error/clipboard feedback, and corrected invitation response shape. Existing one-time secrets remain list-safe. **Still needed:** API authorization/tenant and UI lifecycle tests; browser checks of invitation expiry and restore flows.
- [x] Work package 5: organization-scoped reviewer aggregation, reviewer self-scope, active-target/submission filtering, deterministic client sorting, zero-assignment copy, and 100% badge without ordinal placement. Overview and target-list completion use the current assignee's response. Browser checked overview with a reviewer at 100%. Database-backed edge-case tests for zero/partial/full completion and summary reconciliation remain a future improvement.
- [x] Work package 6: responsive assignment/team/progress styles and touch-target adjustments. Browser checked 12 workspace/auth/public routes at 320/375/768/1024/1280px. Fixed team table/filter sizing and editor columns; the final sweep had zero horizontal-overflow cases. Keyboard focus traversed assignment controls; form reorder activated with Enter and saved order was restored by reload.
- [x] Work package 7: rewrote setup documentation for local MySQL without Docker/Redis, optional local-only phpMyAdmin, current health URLs, and truthful per-process in-memory rate limits. Removed Redis packages/config/runtime probes; did not start or depend on Docker/Redis.

### Verification from this execution

- `npm run typecheck` — passed (contracts, API, web).
- `npm test --workspace @reviewroom/web` — passed, 11 tests.
- `npm test --workspace @reviewroom/api` — passed, 12 tests; includes contracts/API builds.
- `npm run build` — passed, including optimized Next.js production build.
- `npm run lint` — passed.
- Browser: `/` loaded reviewer progress with one active target at 100%; `/people` loaded assignment filters and controls. All 12 checked routes had no page-level horizontal overflow at the five viewport widths. No bulk mutation was executed against workspace data.

## Next-model handoff checklist

- [x] Read this plan, current README, `apps/web/AGENTS.md`, and installed Next.js page guide.
- [x] Record `git status --short`; preserve pre-existing/untracked workspace content.
- [x] Inspect package scripts and test conventions before edits.
- [x] Complete work packages 1 and 2 in the earlier execution; continue with assignments, team access, and progress board.
- [ ] Add real HTTP/MySQL integration tests for the bulk assignment transaction and reviewer-board aggregation (service-level and UI-helper tests exist).
- [x] Complete the systematic browser viewport and keyboard pass for work package 6.
- [x] Do not use Docker or Redis; remove Redis integration and document per-process rate limits.
- [x] Record changed areas, verification commands, and remaining limitations in this handoff.

## Continuation: token-only team access, lean settings, and reviewer board polish

**Requested outcomes (2026-10-21):** add an active reviewer-link copy action; replace email/name-based teammate invitation creation with admin-issued access tokens; remove the Recent workspace activity and static Access and data controls sections from Settings; improve reviewer progress readability/actionability; assess scale, stability, and security using repository evidence. Existing workspace changes and database contents must be preserved.

**Design decisions:**
- Admin issues a single-use, expiring, role-scoped invite token without entering teammate email/name or sending email. The raw token/acceptance URL is shown once and can be copied. Acceptance asks the recipient to supply their own display name, email, and password; the token hash is stored, and acceptance is atomic. Existing pending invitations remain usable during migration. Admins cannot mint owner/admin tokens; owner-only privileges remain enforced by API policy.
- Existing reviewer-link secrets stay hash-only and list endpoints never reveal them. Copy the in-memory one-time URL after issue/rotation. For an older active link whose secret cannot be recovered, the interface offers an explicitly labeled rotate-and-copy action that confirms the prior link will stop working. Do not persist plaintext secrets to make old links copyable.
- Remove only the two unnecessary Settings presentation sections; retain audit storage/API and role enforcement. Improve reviewer rows so zero assignments are explicit, assigned/completed/remaining counts are easy to scan, 100% is clear, sorting is deterministic and usable on mobile.
- Keep Next.js + Tailwind/CSS, Express + TypeScript, Prisma + MySQL, and optional local phpMyAdmin. Do not add Docker or Redis.

**Likely files to verify before edits:** `apps/api/prisma/schema.prisma` and migration history; `apps/api/src/modules/members/*`; invite acceptance route/page and shared member contracts; `apps/web/src/features/team/team-manager.tsx`; `apps/web/app/(workspace)/settings/*`; `apps/web/src/features/progress/*` and overview page; API progress queries; README and deployment/config files. Confirm exact names with `rg --files` before changing.

### Work package 8 — Token-only member access

- [ ] Trace current invitation issuance, one-time display, acceptance, password creation, expiry/revocation, audit, CSRF, and role enforcement from UI through DB/API.
- [ ] Add regression tests first for issuing without recipient identity, hashed-only persistence, one-time acceptance, expiration/revocation, duplicate email, role constraints, organization isolation, and current session behavior.
- [ ] Make invitation recipient name/email optional for newly issued tokens while preserving existing pending invitation rows and their prefilled acceptance behavior; use a reviewed additive/nullable MySQL migration. Acceptance requires identity/password only when invitation has no pre-bound email.
- [ ] Simplify Team UI to role + expiry/token issuance, one-time reveal, copy feedback, pending token state, revoke/expired lifecycle, and member CRUD. Remove email delivery claims and unused fields. Never return stored hashes or raw tokens from list APIs.
- [ ] Acceptance criteria: a teammate can join using only a token provided by an admin, claim an account, and receives only the authorized role; an admin cannot elevate to owner/admin; replay, expired, revoked, and cross-workspace tokens fail; migration preserves prior pending invitations.

### Work package 9 — Reviewer link copy + safe rotation

- [ ] Add a copy action for a reviewer link while its raw URL is still in client memory after create/rotate.
- [ ] For existing links without an available raw secret, offer “Rotate & copy” with a clear confirmation that invalidates the current link; copy only the new response secret.
- [ ] Acceptance: secret is never retrievable from a list/read endpoint or persisted in plaintext; clipboard success/failure is communicated; rotation failure leaves old link usable; rotate-and-copy has focused API/UI coverage.

### Work package 10 — Remove unnecessary Settings content

- [ ] Remove the static “Access and data controls” card and “Recent workspace activity” list from Settings UI; retain audit backend and other settings controls.
- [ ] Acceptance: Settings is shorter and retains usable workspace settings; no audit/security enforcement is removed; mobile layout remains clean.

### Work package 11 — Reviewer progress board refinement

- [ ] Inspect current aggregation contract and UI before changing them. Clarify assigned, completed, remaining, and completion percent; render the zero-assignment state without a misleading empty progress bar; make completed-at-100% rows easy to identify; retain deterministic sorting and responsive controls.
- [ ] Add a meaningful route/action from reviewer row to that reviewer's workload only if an existing authorized/filterable route supports it; do not broaden reviewer access.
- [ ] Acceptance: board totals agree with overview and current-assignee completion semantics; zero assignments, no reviewers, ties, and 100% render correctly; mobile and keyboard use work.

### Work package 12 — Evidence-based deployment readiness assessment

- [ ] Inspect auth/session/cookie/CSRF/origin controls, tenant scoping, rate limiting, request bounds, error/logging behavior, SQL query bounds/indexes, schema constraints, connection pool configuration, health checks, process state, and deployment scripts.
- [ ] Record findings with severity, exact file/line evidence, impact, and practical fix. Separate code properties from runtime/deployment controls not present in this repo.
- [ ] State plainly that scalability under high traffic is unproven without representative load tests and deployment metrics. Estimate DB connection exposure as API replica count × configured pool size; call out process-local in-memory rate limits and required edge/shared limiter strategy if horizontal replicas are deployed. Keep Redis excluded; recommend an existing gateway/MySQL-backed strategy only if needed.
- [ ] Acceptance: no unsupported “production ready/high traffic” claim; provide concrete load-test thresholds and next steps; document unresolved deployment evidence.

**Cross-package verification:** focused API/web/contract tests and existing typecheck/lint/build scripts; migration validation against the local MySQL setup without Docker/Redis; browser checks for Team, invitation acceptance, Settings, and dashboard at 320/375/768/1024/1280px; API ready/live checks if services are available. Never test by destructively mutating the user's real workspace records.

**Continuation sequence:** update this plan first (done before feature edits); inspect flows/schema; token flow and tests; reviewer-link copy; remove Settings sections; progress board; complete security/scale evidence; run verification; append exact results and outstanding limitations below.

### Continuation execution log

- [x] Plan updated before implementation to capture current requested changes, design decisions, acceptance criteria, and security/scale assessment.
- [x] Work package 8 implementation: new invitations are email/name-free role tokens, raw URL is returned once, token hashes remain list-safe, acceptance collects recipient identity, claim uses an atomic single-use update in the transaction, existing bound invitations remain compatible. Added and applied the nullable-field migration. **Remaining test gap:** no automated MySQL/HTTP route integration tests cover issuance, token replay/races, expiry, revocation, duplicate email, or role/tenant policy end-to-end.
- [x] Work package 9 implementation: reviewer link rows show Copy link while the raw URL is held in component memory; older links show Rotate & copy and confirm the replacement will revoke the previous link. List APIs continue to omit token hashes.
- [x] Work package 10 implementation: removed the static controls card and recent workspace activity section, and removed the unused audit API fetch from Settings. Audit routes/data remain intact.
- [x] Work package 11 implementation: board summarizes reviewers finished, shows completed/assigned/remaining, removes the progress bar for zero-assignment reviewers, keeps the explicit waiting state, and preserves the existing sort behavior.
- [x] Work package 12 source assessment: documented bounded readiness evidence, risks, and production/load-test gates in `docs/deployment-readiness-review.md`. High-traffic capacity remains unproven without representative load testing and deployment telemetry.

### Continuation verification

- `npm run db:generate --workspace @reviewroom/api` — passed after Prisma schema update.
- `npm run db:migrate --workspace @reviewroom/api` — passed; MySQL at `127.0.0.1:3307` applied `202610210002_token_only_invitations`.
- `npm run typecheck` — passed for contracts, API, and web.
- `npm test --workspace @reviewroom/api` — passed, 12 tests.
- `npm test --workspace @reviewroom/web` — passed, 11 tests.
- `npm run lint` — passed.
- `npm run build` — passed, including Next.js optimized production build.
- API `/health/live` and `/health/ready` — returned `ok` and `ready`.
- Browser: Team and Settings loaded; dashboard, Settings, and Team inspected at 390px. Team presents token-only issuance and “Rotate & copy” for old link secrets; Settings omits both requested sections; board explicitly states “No targets assigned yet” and “Waiting for assignments,” without an empty progress bar.
- No access token was issued to a real teammate and no reviewer link was rotated during verification.

## Continuation: reviewer-owned links for admin-published forms

**User clarified sign-in:** the admin-issued team token is a one-time join token; a member claims it, sets up an account, then uses email/password for later sign-ins. Do not turn the invitation secret into a reusable login credential.

**Design:** the admin creates and publishes form definitions. A reviewer signs in to their own workspace panel and sees the published forms available to share. For each selected form, that reviewer can create, copy, rotate, or revoke a share URL. A URL is bound server-side to both the reviewer membership and the specific form. The public response page renders only that form, and submissions remain restricted to that reviewer’s currently assigned targets. Admins can inspect and revoke these scoped links from Team access. Legacy unscoped reviewer URLs continue to work until revoked/expired, but new links use form scope.

**Data and authorization decisions:** add nullable `ReviewLink.formId` for legacy compatibility and a form relation; preserve one active token per reviewer/form by making `activeReviewerKey` represent the reviewer + form scope, retaining existing reviewer-only key values for legacy links. Link creation verifies the member is the active reviewer and the selected form is published/current in the same organization. Public GET and POST validate the token and its form scope in the API; client-side choice never grants form access. Revocation and membership archival continue to invalidate links. The public page may not accept a different `formId` than the token’s bound form.

**Implementation scope:** shared/member-specific published-form list in Express; reviewer link list/create and per-link revoke controls; public form loader/submission checks; `/my-link` panel as the reviewer’s personal form-sharing center; Team link list identifies form scope; Prisma migration and tests. Keep Next.js/Express/MySQL/TypeScript, no Docker or Redis.

### Work package 13 — Reviewer-owned, form-scoped sharing

- [ ] Add failing tests for scoping invariants: a form link sees only its bound published form; submissions using another form ID fail; link creation rejects unpublished, archived, cross-organization, or non-reviewer scope; reviewers can only create/revoke their own links; old null-form links retain legacy behavior.
- [ ] Add a nullable form foreign key and migration without changing existing reviewer links. Ensure active uniqueness allows one link per reviewer/form and legacy link key; update Prisma Client.
- [ ] Add authenticated endpoint to list only current published forms for the signed-in reviewer’s organization. Add reviewer-owned per-form issue/list operations, using one-time hashed tokens, 90-day expiry, audit records, and transactional revocation of the prior same-form link.
- [ ] Update public form read/write so scoped tokens return one form and reject submissions for any other form; retain current assignment, current publication, revocation, expiry, idempotency, and tenant checks.
- [ ] Rebuild `/my-link` into “My form links”: show published form cards with current link state, one-time copy after creation/rotation, and explicit confirmation that replacement revokes the prior URL. Show a useful empty state when no forms are published. Reviewers must never see admin form editing controls.
- [x] Team access identifies which form each reviewer link opens, supports independent copy/reveal for active encrypted links, keeps owner/admin revoke capability, and never returns hashes/ciphertext from list APIs. Newly issued invite and review-link tokens are encrypted at rest to support repeat copying; the SHA-256 hash remains the validation value.
- [ ] Acceptance: a reviewer can sign in after token redemption, select an admin-published form, issue/copy a link for that form, and collect responses only for targets assigned to that reviewer. An admin can revoke it; publication changes or archival cannot make an unpublished form appear public. Existing global links continue working as before.
- [ ] Verification: API contract/unit tests plus real HTTP/MySQL integration coverage for migration, scope, replay/revocation, and submitted form mismatches; UI at desktop/mobile; typecheck, lint, tests, production build, and API readiness.

### Work package 13 execution log

- [x] Confirmed one-time join token followed by password login with the user.
- [x] Recorded recommended reviewer+form share-token model in this plan before implementation.
- [x] Added nullable `ReviewLink.formId`, form relation, scoped uniqueness key, lookup index, and applied migration `202610210003_form_scoped_reviewer_links` to the local MySQL database.
- [x] Added `/review-links/mine/forms`, reviewer-owned `POST /mine/forms/:formId/rotate`, and admin `POST /:membershipId/forms/:formId/rotate`. Scoped issuance verifies an active reviewer and a published/current form in the same organization, revokes only the previous link for that reviewer/form, hashes the secret, and audits the form scope.
- [x] Public GET now returns only the bound published form for scoped links. Public POST rejects a mismatching form ID before submission validation. Legacy `formId: null` links retain old behavior.
- [x] Rebuilt `/my-link` as “My form links” with one card per published form, one-time URL reveal/copy, per-form rotation with confirmation, revoke action, and empty state.
- [x] Team access identifies issued form links, lets admins issue/replace/copy/revoke scoped links per reviewer/form, and lists pre-existing all-form links separately so admins can identify/revoke them.
- [x] Updated the public review form to hide the form selector when a scoped link exposes only one form; added responsive card styling.
- [x] Verification: Prisma client generation and migration deploy passed; `npm run typecheck`, `npm run lint`, `npm run build`, API tests (15 passed), and web tests (11 passed).
- [x] Browser spot-check: admin Team page loads and shows the active reviewer, published form, create action, and older all-form link as a separate row. Reviewer panel renders “My form links”; current browser account is owner, so API correctly denies reviewer-only data (403) rather than leaking the panel data.
- [ ] Remaining coverage limitation: tests cover the form-scope predicate and key behavior, but not HTTP/MySQL integration for cross-tenant issuance, issue/revoke races, form archival/publication changes, or tampered public submissions. These paths have server-side guards but still need integration coverage before production assurance.

## Work package 14 — Reviewer workspace and pending-token reissue

**Objective:** keep reviewer accounts inside a personal workspace, close admin-only page/API access, and let admins safely issue a replacement for an unclaimed invitation token.

- [x] Reviewer navigation is limited to Overview, Submissions, and My form links. Their overview reads only the existing reviewer-scoped summary and omits team-wide progress and admin next steps.
- [x] Owner/admin-only pages check the session role server-side before rendering or fetching protected page data. Reviewer access redirects to `/?notice=admin-only` with a clear status message.
- [x] Target-list API is owner/admin-only. Existing submission and progress APIs remain reviewer-scoped; reviewer form-link APIs and bound public URLs remain intact.
- [x] Added `POST /members/invitations/:invitationId/rotate` for owner/admin. It replaces only an unaccepted and unrevoked invitation in the current organization, rotates the SHA-256 token hash, resets expiry to seven days, records an audit event, and returns the raw invite URL only on that response with `Cache-Control: no-store`. Owners alone can rotate administrator invitations. Token-hash compare-and-swap is shared with acceptance so only one of acceptance or rotation can win a race.
- [x] Team access now provides “Regenerate token”; after issuing, it copies the URL and displays it with a manual copy option until the page is closed. Lists still contain no raw token or hash.
- [x] Added web navigation/path-policy tests and API role-middleware tests.
- [ ] MySQL-backed HTTP integration for token rotation, expiration, replay, revoke/accept races, and cross-workspace IDs remains a production readiness task. The test suite has no isolated disposable MySQL integration harness; the developer workspace database was not mutated for this change.
- [ ] High-traffic capacity remains unmeasured. Keep the limitations and load-test recommendations in `docs/deployment-readiness-review.md` in force; no Docker or Redis was added.

### Work package 14 verification record

- `npm run typecheck --workspace @reviewroom/web` — passed.
- `npm run typecheck --workspace @reviewroom/api` — passed.
- `npm test --workspace @reviewroom/web` — passed, 13 tests.
- `npm test --workspace @reviewroom/api` — passed, 17 tests.
- `npm run lint` — passed.
- `npm run build --workspace @reviewroom/web` — passed (Next.js production build).

## Work package 15 — Token recovery, reviewer metrics, login, and hosting readiness

- [x] Added independently usable copy/reveal actions for active invitation and reviewer links. Token values remain one-way hashed for validation and are encrypted with AES-256-GCM for authorized re-display; ciphertext/hash are excluded from list responses. Reveal endpoints enforce role/workspace/active/expiry checks, audit the reveal, and return `Cache-Control: no-store`.
- [x] Added configurable 7/30/90/180/365-day reviewer-link expiry for newly issued links; replacement invalidates the previous active URL. Older unencrypted/revoked links are not falsely presented as copyable; owners/admins can replace an active legacy link, while revoked links require a new link.
- [x] Removed the mandatory workspace field from login. A single active membership is selected automatically; after valid password verification, users with multiple workspaces receive a workspace selector.
- [x] Reviewer board uses the shared target goal as denominator (one of fifty is two percent); admin progress bar counts completed reviewers over active reviewers. Reviewer queue completion is labeled separately from organization progress.
- [x] Submission list/detail names the reviewed target separately from the submitting reviewer. Date formatting now uses an explicit UTC locale/timezone to avoid server/browser hydration mismatches.
- [x] Applied migration `202610220001_recoverable_encrypted_tokens` to local MySQL; added `TOKEN_ENCRYPTION_KEY`, `PORT`, and configurable DB pool configuration. Added Hostinger deployment guide and refreshed the readiness review.
- [x] Final verification: typecheck, lint, API tests (22 passed), web tests (16 passed), production build, local web login/API liveness/readiness checks (HTTP 200), and production dependency audit (`npm audit --omit=dev`, zero vulnerabilities).
- [ ] Full `npm audit` still reports five high-severity findings in the development lint chain (`braces` via `eslint-config-next`). `npm audit fix` cannot resolve it without a major Next ESLint config downgrade; recorded in the readiness review.
- [ ] Production requirements still outstanding: production secret provisioning/key backup, Hostinger staging deployment and exact-plan check, CSP report-only review, disposable MySQL integration coverage, representative load test, monitoring/alerting, and backup/restore rehearsal. Do not claim high-traffic readiness before these are completed.

## Work package 16 — Admin-granted reviewers and form-provided name

**Goal:** Keep target assignment limited to reviewers who have active access in this workspace, and make a form's Full name answer the primary reviewed-person label in submissions.

**Architecture:** `PeoplePage` continues to obtain active REVIEWER memberships from the workspace member API; the browser and assignment endpoint enforce that membership boundary. Clarify that source in the assignment controls and include email in reviewer choices. Add a semantic `fullName` form field to the shared versioned form schema; the editor creates and previews it, the public review portal validates and captures its string answer, and submission list/detail resolves that answer for display. For historical submissions or forms without this field, retain `ReviewTarget.displayName` as the fallback.

**Files:** `packages/contracts/src/forms.ts`; `apps/web/src/features/forms/form-editor.tsx`; `apps/web/src/features/review/review-portal.tsx`; answer validation module/tests in `apps/api/src/modules/submissions`; submission list/detail client components; `apps/web/src/features/people/people-manager.tsx`; `apps/web/app/(workspace)/people/page.tsx`; focused tests and this plan.

- [x] Test that the `name` field accepts a valid string, enforces required and configured length rules, and rejects non-string input.
- [x] Test submission display-name resolution uses the submitted name answer when present and falls back to the target display name for historical/missing answers.
- [x] Implement the shared schema and field editor setup/default label, required state, preview, and configurable character bounds.
- [x] Implement public name input with browser name autocomplete and server-side validation; preserve published snapshots and old answer payloads.
- [x] Implement server-resolved submission labels for list/detail and keep the submitting reviewer visibly separate.
- [x] Clarify reviewer assignment as active accounts that accepted a workspace access invitation; show name and email in filters/selects and link to Team access when no active reviewers are available.
- [x] Assignment endpoints still validate active reviewer membership in the same workspace. Typecheck, lint, 26 API tests, 18 web tests, production build, and local web/API health checks pass.
- [ ] Browser interaction could not be automated in this environment; editor and submission rendering received code/build checks, while interactive browser review remains available in the running local UI.

## Work package 17 — Reviewer progress, repeat link copy, and login clarity

**Goal:** Make submission rows easier to scan, allow login visibility toggles, measure reviewer completion against the shared review goal, and let a reviewer copy an active form link again without rotating it.

**Architecture:** Keep reviewer assigned/completed counts scoped to the signed-in member, but calculate the reviewer progress percentage against the organization `ProgressConfig.targetCount`. Add a reviewer-only, CSRF-protected reveal endpoint scoped by organization, membership, form, active link, and published form; it returns a no-store URL and writes an audit event. The existing rotate action remains a separate replacement operation. Login visibility toggles are client-only input presentation state.

**Files:** `apps/api/src/modules/progress/progress.routes.ts` and focused progress utility/tests; `apps/api/src/modules/links/review-link.routes.ts` and reveal-eligibility tests; `apps/web/app/(workspace)/page.tsx`; `apps/web/src/features/team/my-review-link.tsx`; `apps/web/src/features/auth/login-form.tsx`; `apps/web/src/features/submissions/submissions-manager.tsx`; `apps/web/app/globals.css`; this plan.

- [x] Add tests for progress `1 / 50 = 2%`, zero/capped cases, and reviewer link reveal eligibility across member/workspace, expiry, revocation, and publication boundaries.
- [x] Make `/progress/summary` return the shared target goal for reviewers and calculate completion percentage against it, while retaining reviewer-scoped assigned/completed statistics.
- [x] Remove the “Reviewed person:” prefix from submission rows; add accessible independent show/hide controls for email and password on login.
- [x] Add reviewer `POST /review-links/mine/forms/:formId/reveal` with role, CSRF, workspace, ownership, active/expiry, publication, audit, and no-store checks. Expose only a `canReveal` boolean in the list API; never expose hash or ciphertext.
- [x] Add a persistent Copy link action to active reviewer form cards. Copy reuses a locally revealed URL or calls the reveal endpoint; it does not rotate. Keep Rotate and Revoke separate and provide a selectable URL fallback when clipboard access fails.
- [x] Verify typecheck, lint, API/web tests, and production build; inspect touched components for accessible names and responsive layouts.

### Work package 17 verification record

- Added focused tests: API tests passed (32 total); web tests passed (18 total).
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed, including the Next.js production build.
- Interactive browser inspection is unavailable because local browser use is disabled in Work settings. The running UI could not be checked visually in this session.

## Work package 18 — Full source and Hostinger readiness audit

**Goal:** Establish evidence-based security, UX, scale, and deployment status before adding more product behavior or connecting a public Hostinger deployment.

**Audit report:** `docs/security-and-deployment-audit-2026-10-22.md` contains numbered findings, evidence paths, severity, impact, recommendations, official Hostinger references, feature suggestions, scan scope, and verification results.

**Current decision:** Do not add workflow features until the user selects a feature direction. Recommended first feature is CSV target import with duplicate preview, row-level validation, and transactional commit; next is assignment balancing with before/after preview. Do not add Docker or Redis.

- [x] Inspect app/API/workspace configs, deployment docs, auth/CSRF/session flow, API route validation and tenant scoping, link secrecy, SQL/raw patterns, request size/list bounds, server lifecycle, and package audit.
- [x] Research Hostinger against official docs: managed Node hosting limits, supported Node/frameworks, npm monorepo configuration, MySQL connection setup, environment-variable lifecycle, and phpMyAdmin access.
- [x] Run `npm audit --omit=dev` (0 vulnerabilities) and full `npm audit` (5 high findings in development ESLint dependency chain; do not force a Next major downgrade).
- [x] Run source-pattern scans for untrusted HTML/eval/child process/unsafe SQL, credential-like strings, query validation, and rate-limit/proxy configuration. `.env` was not read; it is ignored.
- [x] Run typecheck, lint, API tests (32), web tests (18), production build, Prisma schema validation, and local web/API liveness/readiness checks; all passed.
- [x] Record current repository logistics: current parent Git repository has zero tracked app files and no remote; Hostinger Git-based deployment requires a repository, while ZIP upload remains an alternative.
- [x] Correct stale architecture/deployment docs and remove the unused Compose Redis config in line with the no-Docker/no-Redis project constraint.
- [x] Add sanitized structured API error logs. Review a CSP in report-only mode against a real staging build remains a deployment gate.
- [ ] Select exact Hostinger plan and repository/deployment path; verify clean-clone install/build/start for both separate Node websites with root workspace context and generated Prisma Client.
- [ ] Deploy to staging, verify TLS/cookies/headers/proxy client IP/API rewrite/MySQL readiness, and exercise reviewer/admin/public flows.
- [ ] Add isolated MySQL route/integration coverage and CI; rehearse database backup restore and deployment rollback.
- [ ] Run representative and burst load tests on the selected Hostinger plan; do not claim high-traffic capacity until metrics are measured.
- [ ] After user confirms feature priority, write a focused design/plan for CSV import, assignment balancing, exports, or account-security improvements.

## Work package 19 — Production diagnostics and audit remediations

**Goal:** Improve the application's production diagnosis and eliminate repository contradictions while preserving the no-Docker/no-Redis constraint.

**Architecture:** Log only unexpected server errors as structured JSON to stderr, with request ID, HTTP method, route template, and the error class name. Do not log error messages or stacks because they can embed raw URLs, headers, body values, cookies, or answer payloads. Keep user-facing 500 messages generic. Remove unused container configuration and correct docs to match the in-process limiter. Do not claim managed-hosting behavior until staged.

**Files:** `apps/api/src/http/error-handler.ts`; `apps/api/src/http/error-log.ts`; `apps/api/src/http/error-handler.test.mjs`; `docs/architecture.md`; `docs/hostinger-deployment.md`; `docs/deployment-readiness-review.md`; audit report; this plan. Remove the unused `docker-compose.yml`.

- [x] Add an API regression test that invokes the error handler with an unexpected error, asserts a generic 500 response and structured request/route diagnostics, and proves raw secret values and request URL tokens are absent from logs.
- [x] Implement a formatter that emits one JSON event to stderr; log only the error class name and omit messages/stacks to avoid query strings, headers, cookies, request bodies, raw route params, SQL parameters, and answer data.
- [x] Correctly distinguish expected 4xx/Zod errors from unexpected 5xx logs; preserve the generic public error shape.
- [x] Remove the unused Compose file rather than leaving a Redis/Docker setup that contradicts the workspace's explicit constraint; correct architecture/readiness docs to state rate limits are in-memory and per API process.
- [x] Re-check whether an upstream-compatible `braces` patch can resolve the five development-only audit findings without downgrading Next or disabling lint; only apply a compatible update and verify audit/lint/build. Registry check still resolves to braces 3.0.3; no compatible patched release exists, so retain the finding and do not force a Next downgrade.
- [x] Verify local health endpoints; typecheck, lint, API/web tests, Prisma Client generation, and production build passed after the changes.
- [ ] Keep remaining staged gates explicit: exact Hostinger plan/root/build/start configuration, actual proxy client-IP behavior, CSP report-only evaluation, MySQL integration tests, representative load test, monitoring/alerts, backup restore, and rollback rehearsal.

### Work package 19 handoff status

- [x] Regression test added first and confirmed red before implementation.
- [x] Sanitized structured 5xx stderr logging and generic client response implemented; expected 4xx and Zod validation responses remain unlogged.
- [x] Removed unused Docker Compose configuration and corrected architecture/deployment notes for no Docker/no Redis and process-local rate limits.
- [x] Confirmed no patched braces 3.x release is currently available from the configured npm registry; full audit still reports the dev-only chain and its unsafe forced fix.
- [x] `npm run typecheck`, `npm run lint`, API tests (34), web tests (18), `npm run build`, and `npm run db:generate` passed.
- [x] Verify local web login and API live/ready endpoints after implementation (HTTP 200).
- [ ] Keep Hostinger staging, load, proxy, CSP, backup/restore, and monitoring as production gates; never describe these as passed until measured.

## Work package 20 — Ranking defaults, revoked-link handling, and clarity fixes

**Goal:** Ensure ranking submissions carry the order visibly shown to the reviewer; prevent revoked/expired links from invoking Next.js `notFound()` during Server Component rendering; clean legacy submission headings; make archive and target entry behavior explicit.

**Root-cause notes:** `ReviewPortal` rendered the ranking option order as a visual default but kept `answers` empty, so a required ranking failed if the user accepted the displayed order. The public route called `notFound()` inside a broad `try/catch`; this both swallowed Next.js's navigation exception and triggered an aborted Server Component. Next/React have a documented dev-only negative `Performance.measure` profiler issue for aborted/error component timings. Do not patch `node_modules` or `performance.measure`; return an explicit unavailable-link view for API 404/410 responses and allow API 5xx/network failures to surface as real server errors.

**Files:** `apps/web/src/features/review/review-portal-model.ts`, `review-portal.tsx`, `public-review-load.ts`, `apps/web/app/r/[token]/page.tsx`, `apps/web/src/features/submissions/submissions-manager.tsx`, `apps/web/src/features/people/people-manager.tsx`, `apps/web/app/globals.css`, `apps/api/src/modules/submissions/submission-display.ts`, `submission-display.test.mjs`, focused web tests, this plan.

- [x] Add failing tests first for default ranking answers, expired/revoked-link HTTP statuses, unexpected API failures, and legacy name prefix normalization.
- [x] Seed each ranking answer with option IDs in displayed order on initial render and when changing forms. Explain that the first option is the most preferred. Keep numeric ranks hidden and maintain keyboard-accessible move buttons.
- [x] Return a user-friendly “link is no longer available” view for API 404/410 without throwing Next `notFound()`. Do not turn API 5xx/network errors into fake invalid-link states. Mark bearer-link pages `noindex`.
- [x] Strip the legacy “Reviewed person:” prefix from displayed full-name answers.
- [x] Change the archive icon/confirmation to state that the row leaves the active inbox while its database record is retained. Confirmed API implementation updates `archivedAt` and writes an audit event; it does not delete the submission row.
- [x] Clarify that the people panel adds subjects being reviewed; reviewer accounts are granted separately in Team access.
- [x] Run API/web tests (35/35 and 23/23), typecheck, lint, production build, and local health checks after these edits.
- [x] Exercise a fabricated unknown token through the running Next app; it returned HTTP 200 with the unavailable-link copy and `noindex` metadata. Do not use real bearer URLs for smoke tests.
- [ ] Revoke a disposable staging link and verify the expected unavailable page plus API 404; confirm a concurrent submission already in flight is the only race to consider. Link revocation updates MySQL state and does not restart/terminate the server.

### Future form-field backlog (design only)

- Recommended next: section heading/help text and page break/step fields; these improve long-form UX without storing answers.
- Later: matrix scale, address group, file upload (requires size/type validation, malware handling, storage lifecycle), and drawn/typed signature. Signature can use Pointer Events across mouse, pen, and touch, with a keyboard-accessible typed-name alternative because canvas pixels are not semantic/accessibility content. Treat it as a captured mark; do not claim legally compliant identity verification or e-signature status without a separate requirements review.
- Do not add signature until schema shape, answer size limits, retention/export, consent, and editor/public/submission rendering are planned together.
