# Local roadmap baseline

Measured 2026-10-24 against the local development services (`http://localhost:4000` and `http://localhost:5000`). No production URL was contacted and no synthetic rows were written.

## Repository checks before roadmap changes

| Check | Result |
| --- | --- |
| `npm test` | Pass |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| Production build | Pass with `API_INTERNAL_URL=https://api.invalid` and `NEXT_DIST_DIR=.next-roadmap-baseline` |

The plain local `npm run build` is expected to fail because `.env` points `API_INTERNAL_URL` at localhost and `next.config.ts` intentionally refuses a loopback origin when Next runs in production mode. The successful baseline build used the reserved `.invalid` HTTPS host for configuration validation only; it does not resolve or contact that host. Its output is isolated from the active localhost app.

## Local endpoint smoke

`npm run load:smoke` completed with zero unexpected responses. It measures small localhost smoke traffic, not authenticated admin/reviewer list or submission operations.

| Scenario | Requests | p50 | p95 | Statuses |
| --- | ---: | ---: | ---: | --- |
| API readiness / database ping | 80 | 7.6 ms | 74.9 ms | 200: 80 |
| Public invalid-link lookup | 80 | 8.2 ms | 30.6 ms | 404: 80 |
| Admin login page | 80 | 376.1 ms | 409.1 ms | 200: 80 |

The test runner caps API requests at 160 and uses concurrency 12 to stay within the API rate limit.

## Representative dataset benchmark

The benchmark created and removed a temporary organization in the local QA database (50 reviewers, 1,000 people, 10,000 synthetic submissions); cleanup verified that no benchmark submissions remained.

| Scenario | Requests | p50 | p95 | Result |
| --- | ---: | ---: | ---: | --- |
| Reviewer progress API, before query change | 24 | 943.5 ms | 1,064.2 ms | 200 |
| Reviewer progress API, after aggregate query | 24 | 126.2 ms | 248.7 ms | 200 |
| People list API | 24 | 25.9 ms | 49.9 ms | 200 |
| Assignment list API | 24 | 29.5 ms | 38.2 ms | 200 |
| Submission list API | 24 | 28.4 ms | 34.9 ms | 200 |
| Admin overview page | 12 | 224.7 ms | 294.6 ms | 200 |
| Admin people page | 12 | 137.2 ms | 285.7 ms | 200 |
| Admin submissions page | 12 | 168.5 ms | 332.6 ms | 200 |

The progress endpoint moved from 1,064 ms p95 to 249 ms p95 after replacing correlated per-reviewer counts with one grouped aggregate. These figures are directional and do not certify production capacity.

## Roadmap verification status

The repository test suite passes (API 146, web 81, contracts 12, plus domain and script tests), as do typecheck, lint, production build, and `git diff --check`. Production build output is isolated under `.next-roadmap-verify`.

The review-draft migration is not applied. The local app database account has no `ALTER` privilege; the migration tool was marked rolled back after the failed attempt. Draft persistence cannot be smoke-tested against this database until its local owner applies the migration. No schema or production database was changed.
