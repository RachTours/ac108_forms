# Group workflows and production compatibility — local verification

Update: the user subsequently approved past submission totals following current group membership. See [current-group history QA](2026-10-26-current-group-history.md). The evidence below records the preceding implementation.

Date: 2026-10-26. Branch: codex/reviewer-groups-platform-themes. Nothing pushed or deployed.

## Behavior

- Each active group owns its submission goal and assigned published forms. Default personal goal is the exact group goal divided by its active reviewers; explicit overrides remain independent.
- Group management edits members, forms, names, group goals and personal goals in one transaction. Concurrent changes invalidate affected source/destination group versions.
- Future submissions retain their submission-time group. Moving a reviewer does not move old submissions; archiving a group preserves its links and history. Earlier ungrouped submissions remain visible as legacy history.
- Group policies start disabled. Setup and explicit activation are separate. No historical records, credentials or shared token strings are rewritten.
- Existing form-specific and all-form links retain their scope. Current form assignments govern new link creation; retained links stay visible even if their form is no longer assigned.
- None/unassigned persists through automatic balancing. Admin changes refresh reviewer goals across tabs/focus. Share links filter by reviewer and sort by reviewer/form.
- Global submission goal editing is replaced with the group total; legacy database fields remain. Appearance settings have independent admin/reviewer presets with light/dark previews. No discarded rich-text/color form editor was restored.
- Public validation highlights and focuses the invalid field while preserving answers/signatures. EN/FR/AR, RTL/LTR, western digits and mobile controls remain supported.

## Backward compatibility and recovery

The saved local prototype is commit 4ded4aa; earlier source restore tag is backup/reviewroom-before-groups-20261026. A private local SQL backup was taken before the forward migrations. Those files and synthetic test credentials are ignored by Git.

Migrations 202610260002_group_workflows and 202610260003_manual_unassignment were applied only to MySQL 127.0.0.1:3306/reviewroom_qa_04b92acd. The earlier group/theme expansion migration is retained unchanged. Repeat migrate deploy reports no pending migrations. All new identifier lengths are <=64 characters; assignment and tenant-scoped submission/group integrity checks pass.

V1 membership/progress/error responses preserve legacy shapes. V2 exposes the new group fields. V1 form responses project away newer metadata, and old-client saves preserve unsupported metadata by field ID/type. Submission list/detail responses avoid exposing membership credentials. Existing cookie names, audience/session selection and public URLs remain unchanged.

Archived origin/main source at 52f5b25 was run with its own original generated Prisma client on local port 4001 against the expanded database. Ten checks passed: admin/reviewer sessions, strict legacy members/progress/public contracts, a person edit/restore, legacy submission insert/replay and original-row digests. Additional current-v1 responses were parsed with the archived old contracts: published form, draft and submission list. This old-source rehearsal used genuinely legacy form JSON. Its dependencies came from the installed workspace; it is not a separate frozen dependency installation or an old-web browser build.

An unchanged older backend cannot understand newer form metadata or enforce group policies. After activation, the supported rollback is an older UI with this compatibility API retained, or a policy-aware compatibility build with groups disabled. Do not roll the database backward, drop tables, or deploy a policy-unaware backend after groups are active. Unchanged older backend + newer authored form JSON is not certified.

Deployment preparation now compiles contracts/domain/API before migration. A mocked build rehearsal proves an API compilation failure never reaches database preflight/migration, and the success path attempts migration once. No production build command that mutates a database was executed.

## Verification evidence

- Repository suite:277 tests passed (1 root,15 contracts,11 domain,155 API,95 web). Typecheck, lint and production build passed locally. Lint retains ten existing warnings, zero errors.
- scripts/verify-group-workflows-local.mjs: latest run 524 checks passed; synthetic rows removed and every original row/count matched the fresh baseline across 18 models. Counts vary with local user activity because original rows are checked individually.
- Integration coverage: strict v1 responses, v2 settings, grant/tenant isolation, invalid/stale edit rollback, exact personal overrides, immutable group history, archive behavior, legacy/new retained link visibility, manual-unassignment persistence, and a held-organization-lock race between activation and all-form issuance.
- 45 browser route/language/viewport cases passed on localhost: Team, Settings, reviewer progress, public review and login; English/French/Arabic; 320/768/1280px. No overflow, direction mismatch, missing message, hydration or uncaught console errors in the final paced run. An earlier overly fast scan correctly hit the unchanged API rate limit; the final scan respected it.
- Real UI checks passed: 390px management dialog; group goal30->40->30 and personal10->12->10 saves; another reviewer tab refreshed12 then10; required name and signature errors received focus. Screenshots remain in ignored output/playwright.
- Literal message lookups are checked against every locale, in addition to catalog-key parity.
- The separate theme/control audit is documented in 2026-10-26-theme-controls-local.md; this includes additional dark/light, reduced-motion and keyboard checks.

During the retained-browser phase, a new real user session and an admin edit to gp1 were observed. The original baseline check correctly detected this external activity. Those user changes were preserved, the already-cleaned fixture manifest was archived privately, and the final isolated integration run used a fresh baseline and passed. No real user data was restored to older values to make a test pass.

## Run locally

Web: npm run dev --workspace @reviewroom/web -- --hostname 127.0.0.1 (port 5000).
API: HOST=127.0.0.1 npm run dev --workspace @reviewroom/api (port 4000; use PowerShell env assignment).
Checks: npm test; npm run typecheck; npm run lint; git diff --check.
Integration: node scripts/verify-group-workflows-local.mjs.

Production web compilation uses a non-routable HTTPS API placeholder to satisfy the production URL guard. It does not contact that host; runtime verification uses localhost only. The local web development server remains separate from the production build output.

## Before any future publication

1. Review and approve the source changes and database expansion preview.
2. Confirm the exact production commit, database backup/restore procedure and database migration grants; rehearse on a fresh copy if production changed.
3. Deploy compatibility API before the new UI, with group workflows disabled.
4. Verify existing accounts and shared links, configure groups/forms/goals, then explicitly approve activation separately.
5. Retain the compatibility API during rollback. Production behavior/capacity is not certified by local tests.

Suggested next work: bounded server pagination for remaining large lists, request-ID-based error reporting, automatic database restore rehearsals, and load tests before setting production capacity targets.
