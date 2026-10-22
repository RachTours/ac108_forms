# ReviewRoom

ReviewRoom is a multi-tenant peer review and form platform. The web app uses Next.js App Router, TypeScript, and Tailwind CSS; an Express 5 API owns authorization and persistence; shared Zod contracts define network payloads; Prisma 7 connects to MySQL. **Local development and production do not require Docker or Redis.** phpMyAdmin is optional and local-only.

## Product areas

- **Overview:** assignment and response totals, progress goal, and a sortable reviewer completion board without ordinal ranks.
- **Form studio:** create, edit, archive, and publish forms with short/long text, email, URL, phone, number, single choice, checkboxes, dropdown, rating, date, consent, yes/no, and ranking fields. Each publication is an immutable version.
- **Review targets:** add and edit people, assign or unassign reviewers, filter by work status or reviewer, bulk assign selected targets, and archive targets while preserving responses.
- **Team access:** invite users with reviewer/admin roles, revoke invitations, change roles, remove or restore members, and create, rotate, or revoke individual reviewer links. Owners alone can grant admin access.
- **Reviewer account:** reviewers can create, copy, rotate, or revoke their own share link. The raw secret is shown only once on issue or rotation.
- **Review portal:** a share-link holder can submit only for targets assigned to that reviewer, using published form versions. Ranking choices are reordered without displayed rank numbers.
- **Submissions:** view answers against their original form version, mark them reviewed or reopen them, and archive them as an administrator.
- **Settings and audit:** change the review goal and inspect organization-scoped audit events.

The default owner bootstrap creates a progress goal of 50. Overview and reviewer-board completion use the configured `ONE_RESPONSE` rule. Zero assigned targets are shown as “No targets assigned,” never as 100% complete.

## Architecture and security

`apps/web` contains server-rendered workspace pages and focused client components. Its server-side API helper forwards the HttpOnly session cookie; browser requests use the same-origin `/api` rewrite. Express validates requests and enforces roles and organization scope for every protected operation. `packages/contracts` contains shared Zod schemas. MySQL stores domain data; published form snapshots are immutable.

Session tokens and reviewer/invitation token validation values are stored as SHA-256 hashes. Reviewer and pending invitation links also have AES-256-GCM ciphertext so authorized owners/admins can copy an active link again without rotating it. Reveal endpoints are role-checked, audited, no-store, and never expose ciphertext or hashes in list responses. Production requires a stable `TOKEN_ENCRYPTION_KEY` (32 random bytes encoded as base64url); back it up separately from the database. Losing or changing this key prevents revealing existing links, though their hash-based validation continues. Older links without ciphertext need replacement before they can be copied again. Sessions use HttpOnly, SameSite cookies and CSRF protection for mutations. Passwords use Node scrypt. Reviewer links expire after 90 days by default and admins can select 7–365 days for new links. Inputs are bounded and validated, and audit events omit answer content and raw secrets. API rate limits cover general requests, authentication, public reads, and public submissions. They use the `express-rate-limit` in-memory store and are **per API process**; separate replicas do not share counters. When deploying multiple API instances, enforce shared rate limiting at the existing gateway/load balancer if required. This app does not use Redis.

## Requirements

- Node.js 24.12+ and npm
- A reachable MySQL 8.4 database and a database/schema plus credentials
- phpMyAdmin is optional; install/run it separately for local database inspection if desired. Never expose it as a public production admin surface.

## Local setup (PowerShell)

1. Install dependencies and create the environment file:

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

2. Edit `.env` with the MySQL URL for your running MySQL server. Replace `SESSION_SECRET` with at least 32 random bytes and set unique bootstrap owner credentials. Keep `.env` out of version control. Example URL shape:

   ```text
   DATABASE_URL=mysql://reviewroom:your-local-password@127.0.0.1:3306/reviewroom
   ```

   Create the database first if it does not exist. No container or Redis service is started by this project.

3. Generate Prisma Client and apply the checked-in migration:

   ```powershell
   npm run db:generate
   npm run db:migrate
   ```

   For future schema changes, create migrations against a configured shadow database and apply committed migrations with `npm run db:migrate` in each environment.

4. Create the first workspace owner once, then remove `BOOTSTRAP_*` values from `.env`:

   ```powershell
   npm run db:bootstrap-owner --workspace @reviewroom/api
   ```

5. Run both applications:

   ```powershell
   npm run dev
   ```

   Web: <http://localhost:3000>. API liveness: <http://localhost:4000/api/v1/health/live>. API readiness: <http://localhost:4000/api/v1/health/ready>.

## Production deployment notes

Deploy web and API as separate services behind HTTPS. Supply unique `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, database credentials, and exact `WEB_ORIGIN` through the deployment secret manager. Set `API_INTERNAL_URL` to an API HTTPS hostname reachable from the Next.js server before building web. Configure `TRUSTED_PROXIES` only for the actual proxy layer and `DATABASE_CONNECTION_LIMIT` to fit the DB connection budget. The Next proxy issues a per-request nonce CSP and prevents HTML caching; every API response is `no-store`. Hashed Next static assets remain cacheable. Run migrations as a controlled release step, back up MySQL and the encryption key, monitor API and database health, and configure request/body limits at the edge. In-memory API rate limits are local to each process; use the gateway for shared multi-instance enforcement when needed. Production dependencies currently pass `npm audit --omit=dev`; the full audit still identifies five high findings in the development-only Next lint dependency chain, with no compatible upstream fix available at this audit. See [Hostinger deployment notes](docs/hostinger-deployment.md) and the [readiness review](docs/deployment-readiness-review.md).

## Workspace map

```text
apps/
  api/       Express routes, authorization, Prisma schema, bootstrap command
  web/       Next.js screens, reviewer portal, responsive UI
packages/
  contracts/ Shared Zod schemas and TypeScript types
docs/        Architecture decisions and field-type support matrix
```
