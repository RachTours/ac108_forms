# Current-group history — local QA

Date: 2026-10-26. This supersedes the earlier active-group counting rule in 2026-10-26-group-workflows-compatibility.md. The user confirmed that past submissions count toward the current group's goal and follow reviewers when they change groups.

## Changes

Active group cards, submission drawers, reviewer progress/board, and combined group progress now count all active submissions authored by current active reviewers, including submissions made before joining and through other forms/groups. A move transfers the full count from the old active group to the new one. Each submission counts once across active groups. Archived answers do not contribute. A reviewer leaving a group keeps their own submission history.

Stored submission-time group metadata remains unchanged for audit purposes. No schema migration, historical backfill, credential change or link rotation was performed. Removed groups retain their existing recorded-group history view, labeled clearly; all submissions remain accessible in the main submissions history.

Archive is now labeled Remove group. Confirmation states that reviewer accounts, submissions and links are kept; members become ungrouped. Removed groups remain accessible in the Removed groups view.

The create-group name and goal have labels above their controls, with the inputs and Create button aligned in a desktop row. Phones use a stacked layout. English, French and Arabic messages explain the current-member history rule.

## Verification

- Regression test first failed as expected: earlier ungrouped submission count was0 rather than1.
- Final local integration run:560 checks passed; fixtures removed, every original row/count preserved across18 models.
- Coverage includes legacy-history inclusion, moves through both membership and group editing, source-group concurrency versions, no double counting, drawer pagination, archived-answer exclusion, reviewer70% from7/10 submissions, group/member isolation, ungrouped reviewer history, and unchanged submission group metadata/shared links.
- Repository suite:277 tests passed. Typecheck and production build passed. Lint: zero errors, ten existing warnings. Diff whitespace check passed.
- Browser checks:12 layout samples (EN/FR/AR at320/390/935/1280px), no document overflow or direction mismatch. Desktop name/goal/button bottom edges matched within1px. Phone controls were44px high.
- Real browser actions passed: drawer contains the7 expected historical submissions; create/remove a synthetic group with confirmation; removed-group visibility; keyboard order from name to goal. No console/page errors during this final browser run.
- Screenshots and synthetic credentials remain in ignored local output folders. Browser fixtures were cleaned afterward.

## Recovery and delivery

Changes stay on the existing local feature branch. Pre-change source is5677f1d; local backup tag backup/reviewroom-before-current-history-20261026 points there. No GitHub push or deployment. Local app/API remain on127.0.0.1 ports5000/4000.
