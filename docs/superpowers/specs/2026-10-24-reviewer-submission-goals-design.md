# Reviewer submission goals and progress

**Status:** Approved in conversation on 2026-10-24; implementation plan prepared.

## Goal

Make progress accurately reflect submitted reviews and make reviewer workloads understandable. Keep the existing goal for people being reviewed separate from a new workspace-wide submission goal. Divide the workspace submission goal evenly across active reviewers and show each reviewer their share.

## Product rules

- The existing people/review-target goal remains a people goal and is not reused as a submission denominator.
- Add a distinct workspace submission goal, such as 50 submissions.
- Each active reviewer receives the same calculated submission target: workspace submission goal divided by the number of active reviewer memberships.
- The calculated reviewer target is fractional when division is uneven. For example, 50 across 6 reviewers is 8.333… for each. Use the precise value in calculations and display a sensible rounded value (two decimal places); do not distribute a remainder by assigning different targets.
- A reviewer meets their target once their active submission count is at least the fractional target. Progress bars cap at 100%, even if the reviewer submits more.
- Count every active, non-archived submission authored by a reviewer, regardless of current assignment or target status. Submission authorship is historical evidence and reassignment or target archiving does not erase that credit.
- Current assignment completion remains a separate measure based on currently assigned active targets. Submission goal attainment must not be inferred from assignment completion.
- The workspace submission progress is total active submissions divided by the workspace submission goal. People-reviewed counts and the people goal remain available as separate metrics.
- Reviewer completion sorting ranks by exact capped submission-goal progress ratio descending (the displayed percentage is rounded); name sorting is alphabetical (A–Z); most submissions sorts by submission count descending; fewest submissions left sorts by the whole number of additional submissions needed to meet the fractional target ascending. Ties are ordered by display name A–Z, then reviewer ID for stability.
- Reviewer population for the division is active reviewer memberships in the organization. When there are no active reviewers, do not divide by zero; explain that no reviewer target can be calculated.
- No per-reviewer overrides are included. The goal is one shared, automatically divided reviewer goal.

## User interface

### Admin settings

- Keep the current people goal setting and its meaning.
- Add an independently saved workspace submission goal.
- Show a read-only explanation of the calculated reviewer target, for example: “50 submissions ÷ 5 active reviewers = 10 per reviewer.” Update the explanation when either setting or reviewer count changes.
- Retain existing unrelated settings and visual styling.

### Admin overview

- The workspace submission progress bar uses total active submissions over the workspace submission goal.
- Keep people reviewed and the people goal visible as distinct statistics; label both goals so their units are clear.
- Each reviewer row shows their active submission count and calculated personal target. Its bar and completion percentage use that target.
- Beside each percentage, show two independent status labels: submission-goal status (“Goal met” or “N submissions left”) and assignment status (“Assigned work done”, “N assigned remaining”, or “No assignments”). Calculate N submissions left as max(0, ceil(calculated target − active submissions)); calculate N assigned remaining from the current assignment completion count.
- Provide clearly named sort choices: “Completion”, “Name (A–Z)”, “Most submissions”, and “Fewest submissions left”. Changing the select immediately reorders rows by the corresponding numeric/string fields; tie-breaking is deterministic.

### Reviewer overview

- Show the reviewer’s active submission count against their calculated reviewer target.
- Preserve the count of people/targets completed and assigned work as separate information.

## Data and API

- Introduce a persisted organization-level submission goal without changing the existing people goal field's meaning.
- For existing organizations, initialize the new submission goal from the existing configured people goal when that value is positive. If no goal is configured or the existing value is zero, initialize the new positive-only submission goal to 50; leave the people goal unchanged. Subsequent changes to either goal are independent.
- Return distinct people-goal and submission-goal values/metrics from progress APIs. Include active reviewer count, total active submissions, each reviewer’s active submission count, calculated target, remaining-to-target (floored at zero), and progress ratio/percentage.
- Count active submissions by organization and author membership using Submission.archivedAt IS NULL, without filtering by current assignment or target status. Apply this same submission-active definition to workspace totals and per-reviewer totals.
- Keep authorization, tenant scoping, and existing submission visibility rules unchanged. Do not expose answer contents in progress responses.
- The settings write validates positive bounded goal values and preserves existing CSRF/auth behavior.
- Use a forward-only database migration and preserve existing goal values and submissions.

## Data flow

1. Admin edits the people goal and/or workspace submission goal in Settings.
2. The server persists the independent settings and returns the active reviewer count and derived shared reviewer target.
3. Overview APIs calculate workspace totals and per-reviewer counts from active submissions, while current assignment completion is computed separately.
4. Admin and reviewer views render the same authoritative derived target and active submission counts.
5. Sorting operates on returned numeric fields; labels and percentages use the same values.

## Acceptance criteria

- Changing the people goal does not silently change the workspace submission goal after migration, and vice versa.
- Existing organizations with a positive configured goal receive that value as their submission goal; null or zero legacy goals initialize the new positive-only submission goal to 50 while the people goal remains unchanged.
- With a submission goal of 50 and 5 active reviewers, each reviewer’s target is 10.
- With a submission goal of 50 and 6 active reviewers, every reviewer has the same precise calculated target of 8.333… (displayed rounded), and 9 active submissions meet that goal.
- Reassigning a target does not remove the former reviewer’s active submission credit.
- The workspace submission bar shows active submissions / workspace submission goal; the separate people count still shows people reviewed / people goal.
- Reviewer bars show reviewer active submissions / shared calculated reviewer target and cap at 100%.
- Assignment completion and submission-goal attainment can differ and are labeled independently beside the percentage. Incomplete rows show both the submissions still needed and assignments still remaining; completed rows show each completed status independently.
- Each sort mode orders reviewers correctly: Completion descending by the exact capped submission-goal ratio (rounded percentage is display-only); Name ascending A–Z; Most submissions descending by active submission count; Fewest submissions left ascending by required additional submissions. Ties resolve by display name A–Z, then reviewer ID.
- Reviewer view shows their own submission progress and keeps people/assignment completion separate.
- Existing latest GitHub UI behavior is retained as the local implementation base, including the current form-link actions.
- The implementation runs and is verified locally; no code is pushed to GitHub.

## Verification plan

After implementation, inspect and test goal migration behavior, division including an uneven split, submission attribution after reassignment, sort ordering, empty/no-reviewer states, capped bars, and separation of people/assignment/submission metrics. Run relevant API and web checks and a local production build/start smoke test. Use local data only, avoid sending credentials to external services, and do not push.

## Out of scope

- Per-reviewer goal overrides.
- Integer remainder allocation that gives reviewers different targets.
- Changing target assignment rules or rewriting submission ownership.
- Deploying or pushing the code.

