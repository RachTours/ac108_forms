# Local verification — reviewer submission goals

Date: 2026-10-24
Scope: local reviewroom_qa_04b92acd database and detached worktree based on ac108_forms/main. No live database or GitHub push was used.

## Database migration

Before applying the migration, the local configuration had targetCount = 50 and 14 active (archivedAt IS NULL) submissions. After applying 202610240001_submission_goal, the values were targetCount = 50, submissionGoal = 50, and 14 active submissions. One active reviewer membership is present in this local QA database. The people goal and submission goal remain separate persisted fields.

The app-scoped MySQL user lacked ALTER permission. The failed Prisma attempt was resolved as rolled back, then the migration was applied to the explicitly verified localhost QA schema with the local root credential supplied earlier in the conversation. No production host was accessed.

## Automated checks

- npm test: passed (contracts, domain, API, and web suites).
- npm run typecheck: passed for contracts, domain, API, and web.
- npm run lint: passed.
- npm run build: passed. The first attempt correctly rejected the local loopback API under the production-only HTTPS guard. The successful compile used a temporary API_INTERNAL_URL=https://reviewroom-api.local.test solely to satisfy that compile-time guard; that value was not written to .env or used by the running development servers.
- git diff --check: passed.
- Focused progress tests cover shared fractional division, no-reviewer behavior, goal attainment, capped progress, exact-ratio completion sorting, name ordering, submission-count ordering, remaining ordering, deterministic ties, and separate assignment/submission statuses.

## Local service smoke check

Started both applications from this worktree using npm run dev. The local MySQL service was already running on port 3306.

- API readiness: http://127.0.0.1:4000/api/v1/health/ready returned 200.
- Admin login: http://127.0.0.1:5000/admin/login returned 200.
- Reviewer login: http://127.0.0.1:5000/reviewer/login returned 200.
- The existing local browser session also loaded reviewer form links, a public review route, and admin Team access from the updated dev server (HTTP 200 in its server log).

Browser automation is disabled by the desktop Work settings, so I verified sorting through the pure sort-function tests rather than exercising the dropdown in a browser. No test submissions or settings were written to the QA database.

## Local run command

From the repository root:

```powershell
npm run dev
```

This starts the web app on port 5000 and API on port 4000. MySQL remains the existing local service on port 3306.
