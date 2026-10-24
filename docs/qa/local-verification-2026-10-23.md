# Local verification — 2026-10-23

This report records checks against the local stack. It is not a Hostinger staging certification or a production-scale capacity result.

## Environment

- Development web: `http://localhost:5000`
- Development API: `http://localhost:4000`
- Local MySQL: `127.0.0.1:5307`
- Local database was initialized from checked-in Prisma migrations. No production data was copied or changed.

## Results

| Check | Result |
|---|---|
| Development admin and reviewer login routes | HTTP 200 |
| Development API liveness `/health` and readiness `/api/v1/health/ready` | HTTP 200; readiness confirms MySQL ping. |
| API unit tests | 92 passed, 0 failed |
| Web unit tests | 52 passed, 0 failed |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| Production-only dependency audit (`npm audit --omit=dev`) | 0 vulnerabilities reported. This does not clear development dependency advisories. |
| Hostinger web build | Passed with `API_INTERNAL_URL=https://api108.rach-tours.com`; standalone package produced at `apps/web/.next/hostinger`. A build with the local `.env` loopback URL correctly fails the production-origin guard. |
| Hostinger API build | Passed; assignment-integrity preflight passed, all 11 migrations were already applied to the local database, Prisma generated, API TypeScript build passed. |
| Production start smoke | Web admin/reviewer routes, API liveness, and API DB readiness returned HTTP 200 on temporary ports 5002/4001. Temporary processes stopped; dev servers remain on 5000/4000. |
| Shutdown lifecycle unit tests | 4 passed: ordered HTTP/DB close, duplicate signal idempotency, HTTP/database failures, and timeout behavior. Windows force-terminates subprocesses on SIGTERM, so OS-level graceful signal handling was not validated on this machine. |
| Local vertical workflow | Passed: owner login, reviewer invitation/setup/login, target creation and auto-assignment, form creation/publication, reviewer-scoped link, public form load, and submission creation. |
| Local load smoke | Passed with 0 unexpected responses. At concurrency 12: 80 readiness requests (p50 6.8 ms, p95 76.1 ms); 80 invalid public-link lookups (p50 8.4 ms, p95 29.8 ms); 80 web login page requests (p50 351.5 ms, p95 375.3 ms). |

The load smoke ran against local development with a small dataset. It does not predict Hostinger capacity or traffic limits.

## Release gates still open

- Verify both applications and exact environment/build settings in isolated Hostinger staging, including injected ports, API routing, TLS, database access, and plan limits. No Hostinger deployment was performed.
- Rehearse migrations against a sanitized production-like copy; verify backup restoration and rollback. No production migration or reset was performed.
- Run automated browser/E2E and accessibility suites; record hands-on current iOS Safari, Android Chrome, Chrome, Firefox, Safari, and Edge results, including signature interactions.
- Run sustained and burst load scenarios on staging; record latency percentiles, errors, CPU/memory, and MySQL connections. Local smoke is not a high-traffic certification.
- Resolve development dependency audit findings and add/run real MySQL integration and browser E2E coverage where absent.
- GitHub Actions workflow remains local-only: GitHub connector is disconnected, and the current Git credential cannot push `.github/workflows/`.

Treat the result as locally verified and Hostinger-build-verified, with staging/release work still open—not production-ready.
