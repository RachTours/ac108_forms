# Task 2 report — accurate workspace and reviewer submission metrics

## Scope delivered

- Added pure workspace and reviewer submission metric helpers. Reviewer quotas retain the exact `submissionGoal / activeReviewerCount` fraction, remaining work rounds up, completion uses the unrounded quota, and displayed percentages are capped at 100.
- Added the migration-compatible workspace submission-goal fallback: null, zero, and invalid legacy values resolve to 50.
- Extended the progress summary with a separate workspace submission goal/progress and active reviewer count. `targetCount` and `completedTargets` remain the people metrics. The pre-existing `completionPercent` remains a compatibility alias for submission completion.
- Extended reviewer-board rows with author-attributed, non-archived submission totals and the reviewer quota fields. These totals use the submitting membership directly, so reassignment does not remove earned credit; current assignment/completion fields retain their active-assignment queries.
- Changed workspace and reviewer submission totals to use only the organization plus `Submission.archivedAt IS NULL`, independent of target status and current assignment.
- Made `PATCH /progress/config` accept either goal independently, preserve the omitted stored field, validate supplied `submissionGoal` as an integer from 1 through 100000, and return both goals. Permission, CSRF, tenant scope, completion-rule validation, and audit behavior remain in the existing route path.

## Test-first evidence

Added focused metric and route-contract tests before implementation. The initial focused run failed because the planned exports did not yet exist:

```text
SyntaxError: ... does not provide an export named 'getReviewerSubmissionGoal'
SyntaxError: ... does not provide an export named 'buildProgressConfigUpdate'
```

The added tests cover 50/5, exact 50/6, one remaining submission at 8/50÷6, goal met at 9/50÷6, zero reviewers, invalid/zero workspace goals, 100% caps, independent PATCH fields, invalid PATCH goals, separate people/submission summary values, and author credit with no current assignment.

## Verification

All commands were run from `apps/api` after the implementation:

```powershell
npm run build --workspace @reviewroom/api
node --test src/modules/progress/progress-metrics.test.mjs src/modules/progress/progress.routes.test.mjs
npm run typecheck --workspace @reviewroom/api
npm run db:generate --workspace @reviewroom/api
git diff --check
```

Results: API build succeeded; the focused suite passed 13/13 tests; API typecheck succeeded; Prisma Client generated successfully; and `git diff --check` reported no whitespace errors. No database fixtures or live database were mutated.

## Self-review and follow-up

The API source is ready for the contract/UI task to consume the expanded fields. Shared contracts and UI rendering were intentionally not changed in this task because they are outside the assigned API/routes/metrics scope. No known implementation concerns remain in this slice.
