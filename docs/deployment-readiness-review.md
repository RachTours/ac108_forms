# Hostinger deployment readiness review

**Date:** 2026-10-23
**Target:** Hostinger managed Node.js websites and MySQL
**Decision:** Local deployment configuration is prepared; production readiness is **not yet confirmed**. No Hostinger website setting, DNS record, production database, or deployment was changed in this review.

## Application shape

- Web: Next.js App Router, React, standalone Node server from `apps/web`.
- API: Express and Prisma from `apps/api`.
- Database: MySQL/MariaDB, managed by the Hostinger account.
- Deployment: two Node.js websites from the same npm-workspace repository. Web serves same-origin `/api/v1` requests through a Next.js rewrite to the API origin.
- Recommended runtime: Node.js 22.x; the repository also supports Node.js 24.x.

## Local Hostinger configuration

Use the settings documented in [DEPLOYMENT.md](../DEPLOYMENT.md) and [docs/hostinger-deployment.md](hostinger-deployment.md). The intended web package contains the standalone Next.js server, traced runtime dependencies (including React), and static assets. It uses a custom entry file so the platform does not try to launch an incomplete Next.js auto-package. The API is built as `apps/api/dist/server.js`.

Build output path interpretation depends on the Hostinger root-directory field. The documented package output is `.next/hostinger` relative to `apps/web`; if the configured root is repository root, it is `apps/web/.next/hostinger`. Do not deploy until the final Hostinger build log confirms the selected root, command, output path, and entry path agree. Empty entry is not suitable for the standalone custom-runtime configuration.

## Evidence available locally

- Prior local source checks passed web/API tests, lint, typecheck, production builds, Hostinger standalone packaging, and an isolated local production start. The deployment audit records bounded local burst timings and clearly limits their interpretation: they do not certify Hostinger capacity.
- The current frontend change hides the redundant target dropdown when a private link has one target and retains it for multiple targets. Its regression tests are run with the current change.
- Hostinger runtime logs previously showed the web build publishing successfully and the runtime failing to resolve `react`; this is the reason the standalone package and explicit server entry were added. Local packaging verifies file presence, but the latest staging runtime must still confirm imports and listening behavior.

## Required before deployment is called ready

1. Read the actual Hostinger web and API settings: root, Node version, build command, output directory, entry file, package manager, and environment variables.
2. In isolated staging, deploy the web standalone package and API separately. Confirm both processes bind using Hostinger's injected `PORT`, serve health checks, can reach each other through configured origins, and can reach the intended MySQL database.
3. Apply migrations on a backup-backed staging copy. Rehearse migration failure, restore, rollback, bootstrap cleanup, and representative admin/reviewer/public submission flows.
4. Verify cookie/session behavior, CSRF, CORS, forwarded-client-IP rate limiting, TLS, CSP/cache headers, and role-scoped authorization through the Hostinger proxy.
5. Run MySQL integration/concurrency and browser E2E checks on staging, including both role sessions in one browser, invitations, reviewer assignment, private links, and submissions.
6. Measure sustained and burst traffic against the exact Hostinger plan. Record p50/p95/p99, HTTP errors/timeouts, CPU/memory, process limits, and active database connections. Current in-memory API rate limiting is per process.
7. Confirm verified backup restore and a maintenance-window cutover/rollback runbook. Production cutover remains a separately authorized action.

No arbitrary high-traffic capacity claim is supported by local-only evidence. The Hostinger account, selected plan quotas, live configuration, database readiness, staging end-to-end tests, and traffic metrics remain external release gates.
