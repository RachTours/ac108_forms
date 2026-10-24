# Reviewer Submission Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add an independent workspace submission goal, divide it evenly as a shared fractional target among active reviewers, and show accurate separate submission and assignment statuses.

**Architecture:** Persist a workspace submission goal next to the existing people goal. Progress APIs return workspace submission totals and author-attributed reviewer counts, while current-assignment completion remains separately derived. The web settings and progress views render these distinct measures, with deterministic sort logic over submission-goal values.

**Tech Stack:** TypeScript, Express 5, Prisma 7, MySQL/MariaDB, Next.js 16 App Router, React 19, Zod, Node built-in test runner.

## Global Constraints

- Keep the existing people/review-target goal separate from the workspace submission goal.
- Each active reviewer receives the same calculated submission target: workspace submission goal divided by the number of active reviewer memberships.
- Use the precise fractional reviewer target in calculations and display it rounded to two decimal places.
- A reviewer meets the target when active submissions are greater than or equal to the fractional target; cap progress at 100%.
- Count every non-archived submission authored by a reviewer, regardless of current assignment or target status.
- Current assignment completion remains a separate measure based on currently assigned active targets.
- Existing organizations with a positive configured goal receive that value as the submission goal; null or zero legacy goals initialize to 50, leaving the people goal unchanged.
- Sort ties by display name A–Z, then reviewer ID.
- Preserve tenant scoping, authorization, CSRF checks, audit behavior, submissions, and existing GitHub UI behavior.
- Verify implementation locally and do not push code to GitHub.

---

## File map

| File | Responsibility |
| --- | --- |
| apps/api/prisma/schema.prisma | Add persisted submissionGoal to ProgressConfig. |
| apps/api/prisma/migrations/202610240001_submission_goal/migration.sql | Forward-only column addition and safe backfill from each positive existing targetCount; null or zero values default to 50. |
| apps/api/src/modules/progress/progress.routes.ts | Validate/read/write the independent submission goal; return separate summary and reviewer submission metrics. |
| apps/api/src/modules/progress/progress-metrics.ts | Pure shared calculations for workspace and fractional reviewer progress, remaining count, and capped percentage. |
| apps/api/src/modules/progress/progress-metrics.test.mjs | API unit tests for fractional goals, goal-met threshold, zero reviewers, and cap behavior. |
| apps/api/src/modules/progress/progress.routes.test.mjs | Verify API payload behavior, reviewer attribution after reassignment, and independent setting updates using the existing API test harness. |
| apps/web/app/(workspace)/page.tsx | Pass separate goals and reviewer metrics to the admin/reviewer overview UI. |
| apps/web/app/(workspace)/settings/page.tsx | Type and pass the expanded progress summary to Settings. |
| apps/web/src/features/settings/settings-manager.tsx | Keep the people goal control and add a separately saved workspace submission goal plus a calculated reviewer-goal explanation. |
| apps/web/src/features/progress/reviewer-board.ts | Calculate reviewer remaining submissions and deterministic sort orders from submission metrics. |
| apps/web/src/features/progress/reviewer-board.test.mjs | Verify each sort, tie-breaking, fractional threshold, and submission/assignment separation. |
| apps/web/src/features/progress/reviewer-progress-board.tsx | Show reviewer submission bars, explicit goal and assignment status chips, and clearly labeled sort choices. |
| apps/web/app/globals.css | Lay out both status labels beside the percentage responsively. |

---

## Task 1: Persist the independent submission goal

**Files:**
- Modify: apps/api/prisma/schema.prisma
- Create: apps/api/prisma/migrations/202610240001_submission_goal/migration.sql

- [ ] **Step 1: Inspect migration conventions and capture the local QA database current ProgressConfig targetCount values and active-submission total with read-only queries.** This establishes a before/after preservation check; never inspect or migrate the live Hostinger database.

- [ ] **Step 2: Add submissionGoal Int @default(50) to ProgressConfig and create the MySQL migration.** Add the column with default 50, then backfill rows from non-null targetCount while leaving targetCount unchanged.
- [ ] **Step 3: Apply the migration and regenerate Prisma Client against the isolated local QA database.** Compare before/after values: people goals and active-submission count must be unchanged; new submissionGoal must equal a positive prior targetCount or default to 50 for null/zero.
- [ ] **Step 4: Run Prisma schema validation and API typecheck.**

---

## Task 2: Return accurate workspace and reviewer submission metrics

**Files:**
- Modify: apps/api/src/modules/progress/progress.routes.ts
- Modify: apps/api/src/modules/progress/progress-metrics.ts
- Create or modify: apps/api/src/modules/progress/progress-metrics.test.mjs
- Create or modify: apps/api/src/modules/progress/progress.routes.test.mjs

**Interfaces:**
- The progress summary response adds submissionGoal, submissionCompletionPercent, activeReviewerCount, reviewerSubmissionGoal, reviewerSubmissionRatio, reviewerSubmissionsRemaining, reviewerSubmissionPercent, and reviewerSubmissionGoalMet; it retains targetCount as the people goal and completedTargets as unique people reviewed. Reviewer-specific fields are populated for reviewer audience; reviewerSubmissionGoal is null when no active reviewer target can be computed.
- Each reviewer-board row adds submissionCount, reviewerSubmissionGoal (precise fractional value or null when there are no active reviewers), submissionRatio (precise capped 0..1 ratio), submissionsRemaining, submissionPercent (rounded display value), and submissionGoalMet; existing assigned and completed remain current-assignment values.

- [ ] **Step 1: Add failing unit tests for calculation helpers.** Cover 50/5 = 10, 50/6 = 8.333…, a count of 8 leaving 1 submission, a count of 9 meeting 8.333…, zero reviewers returning no reviewer goal, zero/invalid workspace goal producing 0%, and percentages capped at 100%.
- [ ] **Step 2: Run the focused API metric test and verify the new expectations fail.**
- [ ] **Step 3: Implement pure metric helpers.** Calculate exact submissionGoal / activeReviewerCount; derive submissionsRemaining = max(0, ceil(reviewerSubmissionGoal - submissionCount)); derive goal met from count >= exact goal; cap rounded percentage to 100.
- [ ] **Step 4: Add failing API tests for the progress config and summary.** Assert PATCH can update either targetCount or submissionGoal without changing the other, invalid submission goals are rejected, summary separates people and submissions, and reviewer counts remain attributed to their membership after target reassignment.
- [ ] **Step 5: Run focused route tests and verify the new endpoint expectations fail.**
- [ ] **Step 6: Update progress routes.** Validate submissionGoal as an integer from 1 to 100000 when supplied; permit saving the two fields independently while retaining completion rule, CSRF, settings permission, organization scoping, and audit metadata. Query active reviewer count and aggregate non-archived submissions by organization and author membership, independent of current assignment and target status. Use the same archivedAt IS NULL rule for workspace and reviewer totals. Keep existing assignment/completion queries separately scoped to current active assignments.
- [ ] **Step 7: Return the expanded API contract.** Workspace progress uses responseCount / submissionGoal; people progress keeps completedTargets / targetCount as a separate metric. Reviewer-board submission counts use author attribution and do not disappear on reassignment.
- [ ] **Step 8: Run focused API tests, API typecheck, and Prisma client generation.**

---

## Task 3: Add independent settings controls

**Files:**
- Modify: apps/web/app/(workspace)/settings/page.tsx
- Modify: apps/web/src/features/settings/settings-manager.tsx

**Interfaces:**
- Settings summary accepts targetCount, submissionGoal, and activeReviewerCount.
- Settings PATCH supports {targetCount} or {submissionGoal} independently, preserving the other saved value.
- Reviewer-goal explanation is derived as submissionGoal ÷ activeReviewerCount, formatted to at most two decimal places; with no active reviewers, it explains that a reviewer goal is unavailable.

- [ ] **Step 1: Update Settings server response types and client state.** Keep “People in this review” and add “Workspace submission goal”; do not combine or mirror their editable state.
- [ ] **Step 2: Add a separately saved submission-goal form/control.** Keep the existing PATCH behavior for the people goal; send only the field being saved so independent edits cannot overwrite each other. Show the reviewer-count division as read-only text.
- [ ] **Step 3: Verify independent save states and reload persistence.** Run web typecheck and lint for the changed settings code.

---

## Task 4: Render submission and assignment progress with working sorting

**Files:**
- Modify: apps/web/app/(workspace)/page.tsx
- Modify: apps/web/src/features/progress/reviewer-board.ts
- Modify: apps/web/src/features/progress/reviewer-board.test.mjs
- Modify: apps/web/src/features/progress/reviewer-progress-board.tsx
- Modify: apps/web/app/globals.css

**Interfaces:**
- Reviewer rows consume the API fields submissionCount, reviewerSubmissionGoal, submissionsRemaining, submissionPercent, and submissionGoalMet, plus current assigned and completed.
- Sort choices are completion, name, completed, and remaining; visible labels are “Completion”, “Name (A–Z)”, “Most submissions”, and “Fewest submissions left”.
- Reviewer-goal status is “Goal met” or “N submissions left”. Assignment status is “Assigned work done”, “N assigned remaining”, or “No assignments”.

- [ ] **Step 1: Extend pure reviewer-board tests.** Assert completion sorts by exact capped progress ratio descending; name sorts A–Z; completed sorts by submission count descending; remaining sorts by submissions remaining ascending; all ties resolve by name then reviewer ID; fraction 8.333… produces 1 remaining at count 8 and met at count 9.
- [ ] **Step 2: Run the focused web logic test and confirm it fails for the new submission fields and sorting labels.**
- [ ] **Step 3: Update reviewer-board calculations.** Sort by submission-specific values, not assignment completion values. Keep assignment completion values separate and numeric.
- [ ] **Step 4: Update the admin overview and reviewer board.** Display the workspace submission bar against submissionGoal, keep people goal/people reviewed stats separate, and show reviewer submission count/rounded personal goal next to the reviewer name.
- [ ] **Step 5: Render two adjacent status labels beside each reviewer percentage.** Show the submission status Goal met or N submissions left where N = max(0, ceil(reviewerSubmissionGoal - submissionCount)). Show the assignment status independently as Assigned work done, N assigned remaining, or No assignments.
- [ ] **Step 6: Use unambiguous select labels and verify selection changes order immediately.** Options must be Completion, Name (A–Z), Most submissions, and Fewest submissions left; retain numeric ordering and deterministic tie-breaking after selection.
- [ ] **Step 7: Update CSS for desktop and mobile.** Keep both status chips legible and prevent reviewer name, percent, or badges from overlapping or forcing horizontal overflow.
- [ ] **Step 8: Run focused web logic tests, lint, and typecheck.**

---

## Task 5: Show the reviewer’s own calculated submission goal

**Files:**
- Modify: apps/web/app/(workspace)/page.tsx
- Modify: apps/api/src/modules/progress/progress.routes.ts
- Modify: apps/web/src/features/progress/reviewer-board.test.mjs (or the existing reviewer summary metric test)

- [ ] **Step 1: Add failing tests for reviewer summary fields.** Assert that reviewer audience gets its own submission count and the shared fractional goal based on all active reviewers, while retaining assigned targets and unique completed people separately.
- [ ] **Step 2: Run focused API/UI summary tests and verify they fail before implementation.**
- [ ] **Step 3: Extend reviewer-scoped summary.** Filter the submission count to the authenticated reviewer membership, but calculate the shared target using all active reviewer memberships.
- [ ] **Step 4: Update reviewer overview copy and progress bar.** Show your submissions / shared reviewer goal using reviewerSubmissionGoal; preserve assigned-to-you and completed-people metrics as separate cards. Round the displayed target to two decimal places while using the precise goal for percent/met calculations.
- [ ] **Step 5: Run focused tests and web/API typechecks.**

---

## Task 6: Verify locally without pushing

**Files:**
- Modify: docs/qa/local-verification-2026-10-24-reviewer-submission-goals.md

- [ ] **Step 1: Run migration against a local QA database copy only.** Record the selected local database identity and verify the migration preserves configured people goals and active submissions. Do not use the live Hostinger database.
- [ ] **Step 2: Seed isolated local QA examples.** Use a test workspace with 5 reviewers and 50 goal, then 6 reviewers and 50 goal; include target reassignment with an authored non-archived submission and include differing assignment-completion states.
- [ ] **Step 3: Run API metric/route tests and web reviewer-board tests.**
- [ ] **Step 4: Run npm test, npm run typecheck, npm run lint, and npm run build from the repository root.**
- [ ] **Step 5: Start both local websites and the local database using the repository’s documented commands.** Verify admin login/settings/overview and reviewer overview in a local browser, exercise each sort option, and verify both badges update independently as progress data changes.
- [ ] **Step 6: Record results and verify git status and remotes.** Keep all changed code and local commits in the worktree; do not run git push.

---

## Acceptance review

Before declaring the feature complete, confirm every spec criterion: separate goal persistence, migration backfill, fractional shared target, author credit after reassignment, separate people/assignment/submission measures, both per-reviewer status labels, all four sort modes and deterministic ties, no-reviewer handling, capped progress, reviewer self-view, latest GitHub UI baseline, and local verification. Do not push.

