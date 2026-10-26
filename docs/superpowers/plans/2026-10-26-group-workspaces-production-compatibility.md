# Group Workspaces and Production Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Preserve existing local work. Production changes and GitHub publication require the user's explicit approval.

**Goal:** Add group-owned submission goals and form assignments while preserving production accounts, existing review links, form versions, submissions, and the ability to recover safely.

**Architecture:** Use additive database changes, unchanged legacy API contracts, explicitly versioned new contracts, and an organization-level feature flag. Preserve legacy access for existing links and accounts; activate group policies only after a compatibility release is installed and migration previews are approved. Store submission-time group attribution independently of current membership.

**Tech Stack:** Next.js 16, React 19, next-intl, Express 5, Prisma 7, MySQL, Zod, Node tests, and localhost browser verification.

## Global constraints

- Work locally on `codex/reviewer-groups-platform-themes`; no push, live migration, deployment, or production data writes without explicit user approval.
- This plan supersedes the earlier assumption that a group's goal is always the sum of its current members' goals, and the earlier assumption that moving a reviewer moves their historical group submissions.
- Remove the editable global submission-goal control from the new group interface, but keep the existing database column and legacy API behavior. Do not drop or rename legacy columns, tables, enum values, or endpoints in this release.
- Preserve identifiers, password hashes, session cookie formats, invitations, password-reset tokens, review-link token hashes and encrypted tokens, expiry/revocation dates, published form versions, authored content, answers, and idempotency rules.
- Keep `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, production origin, cookie settings, and database identity stable. No account bootstrap, reseed, password reset, or bulk token rotation during rollout.
- A valid old link remains valid under its original access rules until its normal expiry or an explicit authorized revoke/replace action. Already expired, revoked, archived, or otherwise unauthorized resources remain unavailable.
- Do not infer a past group from a reviewer's current membership. Unknown historical attribution remains in a visible legacy/unassigned history bucket until an admin approves a documented backfill.
- A group change must not silently remove existing member access, erase progress history, or invalidate shared links. Show its access/reporting impact before activation.
- Claims about compatibility require a passing cross-version test matrix. A passing current-version unit suite alone is insufficient.

## Findings that must be resolved before release

1. Local source work started at `2abe2cd`; the currently tracked `origin/main` is `52f5b25`, with later progress, narrow-screen, link-opening, bulk archive, and bulk deletion fixes. Confirm the actual deployed revision from a read-only release record before choosing a release base. Do not overwrite those fixes with the older local source.
2. The production member response schema uses `.strict()`. Returning the new `group`, goal, and form-assignment fields from the existing `/api/v1/members` response would be rejected by an older web client. Restore the legacy response shape and use a versioned response for the new web client.
3. Existing API error schemas are also strict. Keep legacy error envelopes unchanged; field identifiers belong in a versioned response or an already supported details structure whose compatibility is demonstrated.
4. The current local form-access helper reads current membership grants for every link. This is insufficient to guarantee continued access through old links after new restrictions are saved. Link policy must explicitly distinguish preserved legacy access from newly created group access.
5. The current Hostinger build script executes database migration before compilation. A later compile failure can leave the database changed while the old app is still serving. Compilation, migration, activation, and rollback must be rehearsed separately.
6. The local database correctly stores the reported reviewer's override of 10. Trace server response, selected session, browser route caching, and cross-tab refresh before changing the goal formula. Preserve `rr_session` in assignment filters and every navigation URL.
7. The reported `submissions.reviewer` translation is absent in all three dictionaries. Audit literal translation lookups and language-catalog parity, then exercise dynamic labels through real routes.

## Product model

### Groups

- Each group has a name, a positive integer submission goal, assigned published forms, and active reviewers.
- The dashboard's overall total is a reporting aggregate of group totals plus visible legacy/unassigned history, not a second editable global target.
- A group's progress uses its own active submissions and its own configured goal. No goal displays as “not configured,” rather than interpreting zero as completed.
- Default reviewer goal = group goal / active group reviewer count, preserving the exact fraction in calculations. An explicit personal override remains optional and is never reset silently.
- Show when the sum of individual overrides differs from the group goal; these settings are independent, so do not silently rewrite one to match the other.
- The group card opens management for adding existing reviewers, removing/moving members, assigning forms, editing the group goal, and editing individual goals. Account creation, removal and password management continue using the existing Team Access permissions.
- Moving a reviewer changes future group attribution. Earlier submissions keep their recorded group. Archive groups with history; keep their history readable instead of cascading a delete into submissions or links.
- Reviewer history remains accessible. For group-enabled workflows, label current-group progress separately from lifetime/legacy submission totals so old credit is not silently hidden or counted twice.

### Forms and links

- Group form assignments control form choices and newly generated group links after activation.
- Preserve all existing form-specific and legacy all-form links, whether originally created by an admin or a reviewer. Do not regenerate token strings or rewrite shared URLs.
- Existing all-form links retain their previous scope; do not freeze or reduce their scope during migration without an explicit admin decision.
- Record a link policy version and, for new group links, the group/form context. New group links should be form-specific so their scope is explicit and bounded.
- Public reads, link reveal/copy, link creation, and submission validation use one policy module. Legacy links use the legacy branch; group links use the new branch.
- Changing group assignments does not automatically revoke an existing shared link. Expose explicit revocation/replacement and explain its effect.
- Derive submission group attribution on the server. Keep it outside the client's answer payload and canonical idempotency hash so adding metadata cannot turn a retry into a duplicate or conflict.

## File responsibilities

| Files | Responsibility |
| --- | --- |
| `apps/api/prisma/schema.prisma`, new forward migrations | Nullable/defaulted group goals, group-form grants, archived group state, submission-time group attribution, and link policy metadata; retain legacy fields. |
| `packages/contracts/src/platform.ts`, `packages/contracts/src/resources.ts`, new versioned contracts | Exact legacy DTOs and separate group-aware request/response validation. |
| `apps/api/src/app.ts` | Register versioned routes without removing the existing `/api/v1` surface. |
| `apps/api/src/modules/members/group.routes.ts` | Group lifecycle and management with tenant scoping, permissions, transactions and audit records. |
| `apps/api/src/modules/members/member.routes.ts`, `member-summary.ts` | Preserve legacy membership responses; expose group-aware settings through versioned routes. |
| `apps/api/src/modules/members/reviewer-form-access.ts`, new link policy module | Central legacy/group form-access decisions shared by all link and submission operations. |
| `apps/api/src/modules/links/review-link.routes.ts`, `review-link-scope.ts` | Preserve tokens and old scopes; create explicit new group links. |
| `apps/api/src/modules/submissions/public-review.routes.ts`, `submission.routes.ts` | Group attribution, private reads, immutable form-version checks, idempotency, archive/delete compatibility and localized field errors. |
| `apps/api/src/modules/progress/progress.routes.ts`, `progress-metrics.ts` | Group-owned goals and aggregates; retain legacy progress semantics behind the old contract. |
| `apps/web/src/features/team/reviewer-groups-manager.tsx` | Direct group member, form and goal management with responsive layouts and accessible dialogs. |
| `apps/web/src/features/team/reviewer-assignment-manager.tsx`, `assignment-view.ts` | Explicit None state, no accidental reassignment, session-preserving filters and responsive assignment rows. |
| `apps/web/src/features/team/team-manager.tsx` | Person/form filtering and sorting for share links; preserve copy/open/revoke behavior. |
| `apps/web/app/(workspace)/page.tsx`, progress UI | Correct session-specific goal and refresh after settings changes or tab focus. |
| `apps/web/src/features/settings/settings-manager.tsx`, platform appearance helpers, `globals.css` | Clear platform scope, accurate light/dark preview, consistent controls and readable themes across existing pages. |
| `apps/web/messages/en.json`, `fr.json`, `ar.json` | Missing message fixes and complete new interface text. |
| `scripts/build-hostinger-api.mjs`, release documentation | Compile-first rehearsal and controlled migration/feature activation with a compatible rollback target. |
| `scripts/verify-reviewer-groups-local.mjs`, new compatibility verification scripts, API/web tests | Isolated fixtures, old/new schema and API matrices, link/account preservation and real browser regression tests. |

## Task 1: Establish and preserve the production baseline

- [ ] Confirm the deployed source revision read-only; refresh remote refs read-only and record the baseline SHA.
- [ ] Preserve local tracked and untracked work before integrating current main. Keep the existing `backup/reviewroom-before-groups-20261026` tag and local database backup; add a baseline snapshot for the newly confirmed production revision.
- [ ] Integrate current main into the feature branch without discarding either its bug fixes or the local feature work. Re-run its bulk archive/delete, progress and link-opening regressions.
- [ ] Build an isolated local baseline from that revision. Generate synthetic legacy accounts, sessions, invitations, form versions, old encrypted and unrevealable links, all-form links, form-specific links and submissions.
- [ ] Record identifiers, hashes/checksums and counts in a private fixture manifest. Never publish tokens, passwords, answers or backups in Git.

## Task 2: Rehearse additive migrations and source rollback locally

- [ ] Add new schema through forward migrations only. Legacy rows default to legacy behavior; existing per-person overrides remain unchanged.
- [ ] Keep historical attribution nullable. Retain all old migration files/checksums; do not edit migrations that may already be applied to production.
- [ ] Generate a migration preview showing affected row counts, new defaults, ambiguous history, required database grants and every index/foreign key. Check MySQL identifier lengths are at most 64 characters.
- [ ] Apply to an isolated local copy, then compare original-record checksums and relationship integrity against the manifest.
- [ ] Run the baseline backend and its generated Prisma client against the expanded schema. Verify legacy inserts can omit every new field and all old workflows still work.
- [ ] Rehearse repeat migration/no-op deployment, a failed deployment, and source rollback while retaining the expanded schema. Never use a destructive database rollback to recover source code.

## Task 3: Preserve API contracts and existing access

- [ ] Keep v1 membership, theme, progress, submission and error response shapes accepted by the baseline's exact strict schemas.
- [ ] Expose group-aware responses through `/api/v2` routes. New frontend requests must never require an old client to understand extra properties.
- [ ] Keep public page URLs and authentication cookies unchanged; route internally to the appropriate API while resolving the same token hashes.
- [ ] Add explicit legacy/group policy metadata. Exercise old links before and after group creation, form assignment changes, reviewer movement, publishing another form version and source rollback.
- [ ] Preserve normal expiry/revocation and cross-workspace denial. Compatibility must not turn a revoked link back on or allow a reviewer to read another reviewer's submissions.
- [ ] Ensure old and new clients cannot bypass group restrictions through an overlooked endpoint. Install a compatibility backend that understands the new policies before enabling groups. Once enabled, the supported rollback target must also understand those policies.

## Task 4: Add group goals, forms and management behind a disabled flag

- [ ] Persist a per-group goal and group-form assignments. Keep the global field for legacy clients and recovery; remove its editable control only in the group-enabled interface.
- [ ] Add direct group member/goal/form controls. Allow new reviewers to be invited through the existing account flow, then assigned to a group without replacing their account ID.
- [ ] Calculate default personal goals from active members in the group, with preserved optional overrides and explicit empty-group handling.
- [ ] Store future submission-time group attribution. Show legacy history separately; provide a preview and explicit confirmation before any optional historical backfill.
- [ ] Provide an activation preview of reviewers, form access, goals, preserved legacy links and ungrouped records. No background policy conversion.
- [ ] Test admin/reviewer permissions, group isolation, concurrent edits, archived groups, retries and rollback behavior before activation.

## Task 5: Finish the reported UI and Next.js fixes

- [ ] Add the missing `submissions.reviewer` message in all languages. Add a translation-lookup check and exercise submissions, archived submissions and reviewer filters in each language without `MISSING_MESSAGE` or hydration errors.
- [ ] Fix login theme/language alignment with shared control heights and responsive spacing. Standardize select styling across admin, reviewer, public, login and editor surfaces, preserving native keyboard and touch behavior.
- [ ] Make assignment None explicit and keep an unassigned record unassigned after refresh. Preserve the current session selector while updating filters; test with simultaneous admin and multiple reviewer sessions.
- [ ] Trace the reported personal goal 10 versus displayed 25. Verify database value, API response and rendered page for the same membership, then invalidate stale views on settings changes/tab focus without repeated hidden-tab polling.
- [ ] Add reviewer/person and form filtering plus deterministic name sorting to Form share links. Keep copy/open/replacement/expiry/revocation actions available and correctly scoped.
- [ ] Improve group management, assignment rows and appearance settings at 320, 390, 768, 1150 and desktop widths in LTR and RTL. Keep the editor's existing field controls; do not restore the discarded rich text/color editor.
- [ ] Repair malformed preview styling and verify actual saved appearance matches its preview across workspace, login, reviewer and public pages, including readable dark-mode alerts.

## Task 6: Compatibility and acceptance matrix

Run these scenarios on localhost using synthetic legacy fixtures and isolated database copies:

| Web client | Backend | Database | Required result |
| --- | --- | --- | --- |
| Confirmed production version | Production baseline | Legacy schema | Baseline recorded. |
| Confirmed production version | Production baseline | Expanded schema | Same accounts, links, responses and writes still work. |
| Confirmed production version | Compatibility backend | Expanded schema | Strict v1 contracts and existing workflows remain accepted. |
| New version, groups disabled | Compatibility backend | Expanded schema | Existing behavior preserved and optional settings safe. |
| New version, groups enabled | Group-aware backend | Expanded schema | New group workflows, legacy links and old history work together. |
| Rolled-back compatible version | Compatible rollback backend | Expanded schema | Access policies remain enforced and no data is lost. |

- [ ] Test login, logout, concurrent sessions, admin/reviewer identity selection, account updates, invitation acceptance, password reset and reviewer archive/restore using unchanged credentials and identifiers.
- [ ] Test admin-created and reviewer-created links: copy, open, reveal where supported, all-form versus form-specific scope, exact expiry, manual revoke/replace, public loading and final submission with valid signatures.
- [ ] Test old/new form definitions, published-version immutability, validation focus, duplicate-submit retries, assignment changes, archive/restore, bulk archive and permanent deletion permissions.
- [ ] Check active/archived submission totals, original-record checksums and foreign keys before and after each matrix scenario. Include legacy writes performed after expansion.
- [ ] Test malformed input, offline/network failure, expired sessions, unavailable links, conflicts and partial failure. Preserve entered public answers and show actionable errors without secrets.
- [ ] Run the full repository suite, typecheck, lint, production build and `git diff --check`. Record exact output and any pre-existing warnings.
- [ ] Measure group/progress/list queries on representative local fixtures with bounded submission pagination and no query per reviewer. Add indexes only for measured query bottlenecks; keep private responses uncached.
- [ ] Record browser screenshots and console/network evidence in ignored local artifacts. Avoid claiming “no issues” based only on compilation.

## Task 7: Reviewable rollout proposal, no automatic publication

- [ ] Present the completed local changes, compatibility matrix, migration preview, unresolved risks, exact source/backup references and recovery procedure to the user.
- [ ] Wait for explicit approval before pushing to GitHub. A push is not approval to migrate/deploy production.
- [ ] If deployment is later approved: verify a recoverable production database backup, compile the release, apply the rehearsed expansion, install the compatibility backend, deploy the web client, and verify legacy links before proposing group activation.
- [ ] Enable groups only after the activation preview is approved and all running components support the required policies. Keep a compatible rollback build and feature-disable procedure ready.
- [ ] On any rollout regression, disable the new workflow and restore the compatible release. Preserve the expanded database and new submissions; investigate before retrying.

## Status and limits

This document is the updated plan, not evidence that production compatibility has already been certified. Earlier local checks validated the first group prototype; they do not cover the newer main revisions, independent group-goal model or the cross-version matrix above. No production service or data was changed while writing this plan.
