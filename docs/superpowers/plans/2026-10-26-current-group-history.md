# Current group history implementation plan

> Use executing-plans to implement task by task in the existing isolated feature branch.

**Goal:** Include all past active submissions in a reviewer's current group's totals and goal progress; move those totals when the reviewer moves groups.

**Architecture:** Change read scopes only. Keep submission-time group metadata, membership IDs, immutable form versions, accounts and shared URLs unchanged. Active-group cards/details and v2 progress use current active reviewer membership; archived groups retain their existing recorded-history view. V1 contracts and policy flags remain compatible.

**Tech stack:** Express, Prisma/MySQL, Next.js/React, next-intl.

## Constraints
- Localhost only; no push/deploy and no schema migration/backfill.
- Preserve independent group/personal goals and all shared links.
- Count all forms and earlier ungrouped submissions once, excluding archived submissions.
- Membership moves must invalidate stale source/destination edits as before.
- Remove group means archive/hide, preserving reviewer accounts and submissions.

## Task 1 — Consistent live group history
Files: group.routes.ts; new group-history.ts; progress.routes.ts; scripts/verify-group-workflows-local.mjs.
- [x] Add failing integration expectations for earlier ungrouped history, move A->B, group drawer pagination, board/reviewer/admin progress, no double counting, archived-answer exclusion, and original-row preservation.
- [x] Share active membership/submission scoping between group history and aggregate progress. Keep list queries bounded and avoid per-member database queries.
- [x] Keep stored submission groupId unchanged and preserve archived group history behavior.
- [x] Run integration and repository tests.

## Task 2 — Clear group actions and aligned create controls
Files: reviewer-groups-manager.tsx; globals.css; EN/FR/AR messages; group-management-dialog existing copy through translations.
- [x] Label the archive action Remove group, with confirmation explaining preservation.
- [x] Align name/goal labels above inputs and align inputs/button in one desktop row; stack on narrow screens.
- [x] Update history help to explain that totals follow current members and include earlier submissions.
- [x] Browser-test at320/390/935/1280px in EN/FR/AR; verify history drawer and keyboard navigation.
- [x] Run typecheck/lint/build/diff checks and keep work local.
