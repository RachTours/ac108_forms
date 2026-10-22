# Deploying ReviewRoom on Hostinger

Reviewed against Hostinger's public documentation on 2026-10-22. Hostinger features and plan limits change; confirm the exact plan before purchasing or deploying. This guide does not claim that any plan has been load-tested for this application.

## Recommended topology

ReviewRoom is a TypeScript monorepo with two long-running Node.js services and one MySQL database:

- Next.js web app: `apps/web`, public hostname such as `reviews.example.com`.
- Express API: `apps/api`, assigned an HTTPS hostname such as `api.example.com`. The browser stays on the web app and uses its same-origin `/api/v1` rewrite; Next.js forwards server-side requests to `API_INTERNAL_URL`. Treat the API hostname as publicly reachable and keep its CORS allowlist exact. Do not assume Hostinger exposes private app-to-app networking.
- MySQL database: private application credentials; phpMyAdmin is for administration only and must not be embedded or linked as a public product page.

The browser calls same-origin `/api/...`; Next.js rewrites that path to Express. Set API `WEB_ORIGIN` to exactly the web app's HTTPS origin. The API honors Hostinger's injected `PORT`, falling back to `API_PORT`; `DATABASE_CONNECTION_LIMIT` controls the per-process MySQL pool (default 10).

Hostinger currently lists managed Node.js apps on Business/Unlimited and Cloud plans. Each app is a separate Node website and consumes an app slot. Managed limits state one long-running process per app, shared process/memory limits across the plan, 120-second request timeouts, and no inbound WebSockets or always-running workers. Confirm the chosen plan supports Node 22.12 or Node 24, two app slots, root-workspace builds, the needed resource budget, and a reachable HTTPS API hostname. Plan limits can change; verify your account's current limits. If managed hosting cannot provide the required routing or capacity, use a VPS/CloudPanel deployment with a reverse proxy.

## Build and start commands

Hostinger deploys each monorepo app as a separate Node.js website. The frontend uses `apps/web` as its app root; the API uses `./` because its migration and build scripts run from the repository workspace. Configure both entries from the same repository and validate in staging before switching DNS.

| Hostinger field | Web (`ac108.rach-tours.com`) | API (`api108.rach-tours.com`) |
|---|---|---|
| Framework preset | `Other` | `Other` or `Express.js` |
| Root directory | `apps/web` | `./` |
| Build command | `npm run build:hostinger:web` | `npm run build:hostinger:api` |
| Output directory | `.next/hostinger` | `apps/api/dist` |
| Entry file | `.next/hostinger/server.js` | `apps/api/dist/server.js` |
| Start command, if requested separately | Not needed when Hostinger runs the entry file | Not needed when Hostinger runs the entry file |

The web workspace build uses Next.js Webpack mode (`next build --webpack`) and standalone output. Set the web root to `apps/web`; the build then packages the standalone server, traced `node_modules` (including React), shared workspace files, and static assets into `.next/hostinger`. For this frontend choose the `Other` preset, output directory `.next/hostinger`, and entry file `.next/hostinger/server.js`. This runs the verified standalone server directly instead of relying on Hostinger's generated Next.js launcher, which failed to resolve React. The API stays rooted at `./` because its migration/build commands use the repository workspace root.

The API build applies committed migrations before compiling, so the `DB_*` variables must be available during build and production releases require a database backup first. The web build command is designed to run from the `apps/web` workspace and compiles `@reviewroom/contracts` before Next.js. Validate both app roots in Hostinger; a local build does not prove the hosting builder uses the same context.

Set `API_INTERNAL_URL=https://api.example.com` in the web app before its build because rewrites are configured at build time. Set `WEB_ORIGIN=https://reviews.example.com` in the API app. The API hostname is public, but browser requests should use the web origin's rewrite. Verify cookie forwarding, Origin, CSRF, CORS, and client IP/rate-limit behavior in staging.

For a local equivalent, install from the root lockfile and build both workspaces:

```sh
npm ci
npm run build
```

Start the web app:

```sh
npm run start --workspace @reviewroom/web
```

Start the API app:

```sh
npm run start --workspace @reviewroom/api
```

The API start script runs `apps/api/dist/server.js`. Let the host supply `PORT`; do not hard-code a public port in Hostinger's app settings. The web app root must remain `apps/web` at build and runtime so the Next.js server finds `.next`. Test this in a staging app before pointing the production domain.

## Database and release sequence

1. Create a MySQL database and a least-privilege application user in Hostinger. Use the connection host Hostinger provides (its Node/MySQL guide uses `127.0.0.1` for a local database). Do not expose MySQL remote access broadly.
2. Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in the API environment. Existing installations may continue using `DATABASE_URL`; the new DB fields take precedence when both are present.
3. Before starting the API, apply committed migrations from the repo root:

   ```sh
   npm run db:migrate
   ```

4. For a fresh database only, keep the API build command as `npm run build:hostinger:api`. Temporarily set `BOOTSTRAP_OWNER_ON_DEPLOY=true` and all five `BOOTSTRAP_*` values in the API environment, then deploy once. The build script applies migrations, generates Prisma, creates the owner, and builds the API. After a successful deployment, immediately remove the flag and all five bootstrap variables. Never commit bootstrap credentials. The command refuses an existing email; changing an existing account uses the password-reset flow, not bootstrap variables.
5. Verify API liveness at `/api/v1/health/live`, readiness at `/api/v1/health/ready`, login, reviewer scoping, and public form submission in staging.

Use Hostinger's phpMyAdmin through its control panel for database inspection. Keep backups and test restoration. Do not make a database account available to phpMyAdmin or the public app with more privileges than needed.

## Runtime configuration

Set these as application environment variables in Hostinger. Never commit production values to `.env` or source control.

| Variable | Service | Guidance |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | API and migration job | Values from Hostinger's MySQL page; use a dedicated least-privilege user. Existing `DATABASE_URL` deployments remain supported as a compatibility fallback. |
| `DB_SSL` | API and migration job | Optional. Loopback Hostinger MySQL does not force TLS; remote production hosts use verified TLS by default. Set `true` to force verified TLS. |
| `SESSION_SECRET` | API | Unique high-entropy value, at least 32 characters. |
| `TOKEN_ENCRYPTION_KEY` | API and release jobs | Exactly 32 random bytes, base64url encoded. Generate in a secure local environment and store in Hostinger secrets. Back up separately from the database. |
| `WEB_ORIGIN` | API | Exact HTTPS origin of the web app, with no path or trailing slash. |
| `API_INTERNAL_URL` | Web | API origin reachable by the Next.js server. Set it before the web build because rewrites are configured in Next config. |
| `PORT` | API and web | Let Hostinger provide this. The API uses it automatically; Next.js uses the platform port. |
| `DATABASE_CONNECTION_LIMIT` | API | Start at a conservative value, and set total API instances × pool size below MySQL's connection budget with headroom for migrations and admin tools. |
| `TRUSTED_PROXIES` | API | Configure only if needed and only for the real proxy addresses/CIDRs. Do not trust arbitrary forwarded IP headers. |
| `NODE_ENV` | API | `production`. |
| `HOST` | API | Optional; defaults to `0.0.0.0`. Hostinger's injected `PORT` is used when present. |
| `BOOTSTRAP_OWNER_ON_DEPLOY`, `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`, `BOOTSTRAP_PASSWORD`, `BOOTSTRAP_ORGANIZATION`, `BOOTSTRAP_SLUG` | API build, first deployment only | Set `BOOTSTRAP_OWNER_ON_DEPLOY=true` and all five values only for initial owner creation on a fresh database; remove immediately after bootstrap. Password minimum is 14 characters. |

One way to create the encryption key locally is `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; copy the output directly into the host secret store and do not paste it into chat or commit it. Changing this key makes existing encrypted URLs unrevealable. Token validation remains possible because the separate hash is retained, but active links must be rotated to restore copy/reveal. Coordinate key changes as a deliberate migration.

Hostinger docs state that environment changes may require an app restart/redeployment and build-time values require rebuilding. After changing `API_INTERNAL_URL`, rebuild/redeploy the web app and check the rewrite. After changing API secrets, restart the API and verify readiness. `.env.example` is local guidance only; keep `.env` ignored and enter production values through Hostinger's environment settings. Never upload `.env`.

## Security and operations gates

- Terminate TLS on the custom domain and verify automatic SSL issuance before sharing links. Enforce HTTPS and check session cookie flags in the browser.
- Configure edge request-size, burst, and abuse limits. The API's current rate-limit counters are in-memory and per process; multiple replicas do not share quotas. Use Hostinger's gateway/WAF or another existing edge layer for shared limits rather than adding Redis.
- Configure alerts for readiness failures, elevated 5xx/timeouts, DB connection saturation, CPU/memory, disk, and backup failures. This repository does not currently include production telemetry or alert rules.
- Unexpected API 5xx errors are written as single-line JSON to stderr with request ID, method, route template, and error class name. Error messages and stacks are omitted because they can contain user-submitted values. Use the hosting log viewer to correlate an API error by request ID; request URLs, cookies, headers, request bodies, answers, and route parameter values are intentionally excluded. Verify log retention and access permissions on the chosen plan.
- Dynamic HTML matched by Next's proxy now receives a per-request nonce CSP and `private, no-store`; all API responses use `no-store`. After deployment, verify these headers on login, admin, reviewer, invitation, reset, and public review routes. Do not CDN-cache authenticated HTML or API responses; hashed `/_next/static` assets remain cacheable.
- Rehearse database restore and application rollback. Keep migrations backward-compatible with the prior app version where practical.
- Run a representative load test before making capacity claims. Include the expected 15 reviewers/50 targets plus a 3× sustained scenario and short burst; record latency percentiles, 5xx/timeouts, CPU/memory, and MySQL active connections.

## Capacity assessment

The current architecture is reasonable for a small student team on a properly sized single web/API deployment and MySQL. The source review, typecheck, unit tests, and production build do not prove high-traffic capacity, failover behavior, or Hostinger plan fit. Hostinger managed Node.js has plan-specific process, memory, timeout, and routing limits; inspect those limits for the exact plan. Use a VPS if the managed environment cannot provide the routing, scaling controls, observability, or process management required by measured load. Static hashed assets can be cached; private HTML and API data are explicitly no-store.

## Official Hostinger references

- [Node.js hosting options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/)
- [Deploy a Node.js website](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Deploy a monorepo](https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/)
- [Node.js limits on Web and Cloud plans](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/)
- [Connect a Hostinger MySQL database from Node.js](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
- [Access phpMyAdmin](https://support.hostinger.com/en/articles/1583545-how-to-access-phpmyadmin-at-hostinger)
- [Environment variables after deployment](https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/)
- [Connect a custom domain](https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/)
- [VPS Node.js with CloudPanel](https://www.hostinger.com/support/9553137-how-to-set-up-a-node-js-application-using-hostinger-cloudpanel/)
