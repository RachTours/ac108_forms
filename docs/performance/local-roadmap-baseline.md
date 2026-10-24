# Local roadmap baseline

Measured 2026-10-24 against the local development services (`http://localhost:4000` and `http://localhost:5000`). No production URL was contacted and no synthetic rows were written.

## Repository checks before roadmap changes

| Check | Result |
| --- | --- |
| `npm test` | Pass |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |

## Local endpoint smoke

`npm run load:smoke` completed with zero unexpected responses. It measures small localhost smoke traffic, not authenticated admin/reviewer list or submission operations.

| Scenario | Requests | p50 | p95 | Statuses |
| --- | ---: | ---: | ---: | --- |
| API readiness / database ping | 80 | 7.6 ms | 74.9 ms | 200: 80 |
| Public invalid-link lookup | 80 | 8.2 ms | 30.6 ms | 404: 80 |
| Admin login page | 80 | 376.1 ms | 409.1 ms | 200: 80 |

The test runner caps API requests at 160 and uses concurrency 12 to stay within the API rate limit.

## Representative dataset benchmark status

The requested 50-reviewer/10,000-submission measurements are not yet available. The configured loopback MySQL account can access the existing local QA database but cannot create a disposable schema (`CREATE DATABASE` returned access denied). To avoid polluting the existing QA database, no benchmark data was seeded. The benchmark must use a separately provisioned loopback schema or a specifically approved temporary organization that can be safely removed afterward.

The smoke figures above are a local starting point only. They do not measure the roadmap’s authenticated API flows and do not certify production capacity.
