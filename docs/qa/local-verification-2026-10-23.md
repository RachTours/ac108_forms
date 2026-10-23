# Local verification — 2026-10-23

This report records checks against the local development stack. It is not a Hostinger staging certification or a production-scale capacity result.

## Environment

- Web: `http://localhost:5000`
- API: `http://localhost:4000`
- MySQL: `127.0.0.1:5307`
- Local database: newly initialized from the checked-in Prisma migrations; no production data was copied or changed.
- Local owner and reviewer test accounts are in the ignored local `.env`/bootstrap state and are not recorded here.

## Results

| Check | Result |
|---|---|
| Admin login route | HTTP 200 |
| Reviewer login route | HTTP 200 |
| API liveness `/health` | HTTP 200 |
| API readiness `/api/v1/health/ready` (includes MySQL check) | HTTP 200 |
| API unit tests | 88 passed, 0 failed |
| Web unit tests | 52 passed, 0 failed |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| Local vertical workflow | Passed: owner login, reviewer invitation/setup/login, target creation and auto-assignment, form creation/publication, reviewer-scoped link, public form load, and submission creation. |
| Local load smoke | Passed with 0 unexpected responses. At concurrency 12: 80 readiness requests (p50 6.8 ms, p95 76.1 ms); 80 invalid public-link lookups (p50 8.4 ms, p95 29.8 ms); 80 web login page requests (p50 351.5 ms, p95 375.3 ms). |

The load smoke ran on the local development server with a small in-memory/local dataset. These figures do not predict Hostinger production capacity or traffic limits.

## Release gates still open

- Run the full production and Hostinger standalone builds against the exact current Hostinger settings, then validate both services on isolated Hostinger staging.
- Verify Hostinger's runtime, startup command, injected `PORT`, environment variables, API-to-web routing, database connectivity and plan resource limits from the live account.
- Rehearse migrations against a sanitized production-like copy; verify backup restoration and rollback. No production migration or data reset was performed.
- Run the automated browser/E2E and accessibility suites, then record hands-on current iOS Safari, Android Chrome, Chrome, Firefox, Safari and Edge results, including drawn and typed signature behavior.
- Run representative sustained and burst load tests on staging and record latency percentiles, error rates, process memory/CPU and MySQL connection usage. The local smoke is not a high-traffic certification.
- Resolve dependency audit findings and add/run real MySQL integration tests and browser E2E coverage where currently absent.
- GitHub Actions workflow is still pending: the GitHub connector is disconnected, and the configured Git credential lacks permission to push files under `.github/workflows/`.

Until these gates are complete, treat the repository as locally verified and deployment-prepared work in progress, not production-ready.
