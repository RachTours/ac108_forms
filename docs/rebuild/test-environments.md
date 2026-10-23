# Local and Staging Database Safety

## Rules

- Never use a production database for unit, integration, browser, migration rehearsal, seed, or cleanup work.
- Use a separately named local database such as `reviewroom_test` and a staging database whose name clearly includes `staging`.
- Give each environment its own database user and credentials. Keep all values in local ignored `.env` files or a hosting secret store.
- Before a data migration or destructive fixture cleanup, take a backup of the isolated environment and verify the target hostname/database name.
- Live Hostinger staging app names, DB host/version, and resource limits still require confirmation in the owner account; this repository does not claim those values were verified.

## Production target guard

The Prisma configuration imports `scripts/db-target-guard.mjs`. Before Prisma migration commands run, the guard checks the active target from `DB_HOST`/`DB_NAME` or `DATABASE_URL` against the optional protected marker pair:

```dotenv
PRODUCTION_DB_HOST=production-database-hostname
PRODUCTION_DB_NAME=production-database-name
```

Configure both markers for local operator machines and CI environments that have access to more than one database. If only one is set, the guard fails closed. If both active target host and database name match the markers (case-insensitive, whitespace-trimmed), the migration is refused before Prisma connects. Incomplete/invalid target details are also refused when protection is enabled. Omit markers only in isolated environments that cannot reach production. Never copy real production credentials into `.env.example` or documentation.

The guard is a defense against accidental target selection, not a production access control system. Production credentials must remain unavailable to local tests and CI. Production migration remains a separately authorized release operation with backup, compatibility review, and rollback plan.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to ignored `.env` and configure only an isolated local MySQL database.
3. If the machine has production DB access, set the production marker pair in `.env` to that protected host and database name.
4. Validate guard behavior without database access:

   ```powershell
   node --test scripts/db-target-guard.test.mjs
   ```

5. Apply local schema migrations only after verifying the DB target in `.env`:

   ```powershell
   npm run db:migrate
   ```

The application test suite does not need an active database connection for its unit and HTTP contract tests, but API module loading does require safe placeholder `SESSION_SECRET`, `WEB_ORIGIN`, and database configuration. Add the dedicated MySQL integration test setup before claiming DB integration coverage; do not point the current unit suite at production.

## Staging setup

Create a staging DB with a separate hostname/database/user where possible. Configure staging app secrets separately from production, verify `WEB_ORIGIN` and build-time `API_INTERNAL_URL`, deploy web and API to staging, then run migrations and the end-to-end workflow checklist. Record Hostinger app roots/build outputs/entry files and tested runtime version in `docs/rebuild/current-runtime-baseline.md` only after inspecting the actual account. No staging-specific credentials or personal production data belong in Git.
