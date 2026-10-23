# ReviewRoom Current Runtime Baseline

**Captured:** 2026-10-23  
**Scope:** Repository inspection only. No live Hostinger settings, production database, or secrets were accessed.

## Runtime and repository

- npm workspaces: `apps/*` and `packages/*`; root Node engine accepts `>=22.12 <23 || >=24 <25`.
- Web: `apps/web`, Next.js 16.4.2 App Router, React 19. Build is `next build --webpack`; output is standalone with repository-root tracing. Hostinger preparation is `apps/web/scripts/prepare-hostinger-standalone.mjs`.
- API: `apps/api`, Express 5, TypeScript, Prisma 7 with `@prisma/adapter-mariadb`. Compiled entry is `apps/api/dist/server.js`; npm start script is `node dist/server.js` from the API workspace.
- Shared contract package: `packages/contracts`; no separate domain or UI package exists yet.
- Persistence schema: `apps/api/prisma/schema.prisma`; 11 committed migrations, through `202610230001_assignment_integrity`.
- Current main package test scripts run API Node tests and web Node tests. API package test builds contracts/API and then runs `node --test`; web uses Node's built-in test runner with TypeScript strip-types.

## API modules and current route families

Inspected route modules under `apps/api/src/modules/`:

- `auth/auth.routes.ts`
- `members/member.routes.ts`
- `targets/target.routes.ts`
- `assignments/assignment.routes.ts`
- `forms/form.routes.ts`
- `links/review-link.routes.ts`
- `submissions/public-review.routes.ts` and `submissions/submission.routes.ts`
- `progress/progress.routes.ts`
- `organization/organization.routes.ts`
- `audit/audit.routes.ts`

`apps/api/src/app.ts` registers them under `/api/v1`; health routes are `/health`, `/api/v1/health/live`, and `/api/v1/health/ready`. Root GET `/health` returns the Hostinger-friendly JSON liveness response. `apps/api/src/server.ts` uses `env.API_PORT` and `env.HOST`; `PORT` takes precedence in environment parsing.

## Browser route baseline

App Router files under `apps/web/app` currently include admin entry/sign-in, reviewer entry/sign-in, shared workspace pages for overview, people, submissions, forms, team and settings, plus invitation, reset, and public review routes. `apps/web/next.config.ts` rewrites role-specific URLs to shared internal workspace pages and proxies same-origin `/api/:path*` to `API_INTERNAL_URL`. Role enforcement also exists in page access helpers and API middleware; the rewrite is not an authorization boundary.

## Database model and constraints inspected

Models include Organization, User, Membership, Session, Form, FormVersion, ReviewTarget, Assignment, ReviewLink, Submission, ProgressConfig, OrganizationTheme, Invitation, PasswordResetToken, and AuditEvent. Assignment has a unique `(organizationId, targetId)` key and composite same-organization foreign keys to target and reviewer. Form versions are unique per form/version; submissions carry form-version, target, reviewer, idempotency key and payload hash. The current schema retains historical submission relations when a form, target, or reviewer is referenced.

## Environment and deployment code

- Safe key names/placeholders are in root `.env.example`; `.env` is gitignored. API parsing is in `apps/api/src/env.ts` and MySQL settings in `apps/api/src/db/mysql-config.ts`.
- API accepts Hostinger `PORT` or local `API_PORT`, `HOST`, `DB_*` or compatibility `DATABASE_URL`, pool limit, `SESSION_SECRET`, `WEB_ORIGIN`, optional `TOKEN_ENCRYPTION_KEY`, and optional `TRUSTED_PROXIES`.
- Web config resolves `API_INTERNAL_URL` during build. The web runtime uses Next standalone output.
- `scripts/build-hostinger-api.mjs` generates Prisma, runs assignment preflight and migrations, builds contracts/API, and supports optional one-time bootstrap values. Because it applies migrations during the host build, staging verification and a backup/restore rehearsal are required before any production use.
- `docs/hostinger-deployment.md` documents intended separate web/API Node applications and app-specific root/build/output/entry values. These are repository documentation, not proof of the live account configuration.

## Verification baseline

Inspected commands and results on Node 24.12.0 / npm 11.6.2 in the isolated rebuild worktree:

| Command | Result |
|---|---|
| `npm test` with required API env vars unset | Failed during API test module initialization because `SESSION_SECRET` and `WEB_ORIGIN` are required. |
| `$env:SESSION_SECRET='test-only-session-secret-000000000000000000000000'; $env:WEB_ORIGIN='http://localhost:3000'; $env:NODE_ENV='test'; $env:DB_HOST='127.0.0.1'; $env:DB_PORT='3306'; $env:DB_NAME='reviewroom_test_unused'; $env:DB_USER='reviewroom_test_unused'; $env:DB_PASSWORD='reviewroom_test_unused'; npm test` | Passed. API 84/84; web 46/46. The dummy DB settings allow configuration parsing only; the suite did not connect to MySQL. |
| `git diff --check` on the inventory changes | Passed. |

No local or remote DB migration, integration suite, browser E2E suite, load test, Hostinger staging deploy, or restore rehearsal has been performed in this baseline.

## External facts still requiring account/staging confirmation

The connected Hostinger lookup was interrupted and yielded no verified account data. Before deployment configuration is treated as final, confirm directly in the account: the actual web/API Node app domains, Node version, repository branch/revision, build root, command, output directory, entry file, runtime port behavior, HTTPS origins, database version/host, available app slots and plan resource limits. Do not infer these values from historical screenshots or build logs.
