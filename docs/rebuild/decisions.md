# Rebuild Decision Log

These decisions implement the approved ReviewRoom rebuild direction. A new record is required before changing one of these boundaries.

## D-001 — Parallel replacement and staged cutover

- **Status:** Accepted
- Build a replacement in this repository alongside the live application. Keep current production serving users until the replacement passes staging, migration, restore, workflow, security, and capacity gates.
- “From scratch” means new cohesive architecture and experience; it does not mean deleting production data or history.
- Production deploy, production migration, DNS change, and GitHub push require a separate explicit release authorization after review.

## D-002 — Existing stack and Hostinger target

- **Status:** Accepted, subject to staging feasibility
- Keep TypeScript, npm workspaces, Next.js/React, Express, Zod, Prisma, and MySQL-compatible persistence unless a documented staging feasibility test proves a blocking limitation.
- Hostinger managed Node.js is the target. Account-specific roots, build/output/entry settings, ports, proxy behavior, app-to-app routing, resource limits, and DB connectivity are not considered confirmed until inspected in the account/staging.
- Do not require Docker, PM2, Nginx, or SSH-managed process startup.

## D-003 — Identity, roles, and sessions

- **Status:** Accepted
- Organization is the tenant boundary. User is an identity; Membership is the role and credential scope.
- Roles are Owner, Admin, and Reviewer. API authorization is authoritative and checks active membership and organization for every protected operation.
- Keep opaque, hashed, revocable server sessions. Admin and reviewer sessions use distinct cookie names/audiences so both can coexist in one browser. Do not introduce JWT merely by preference.
- Invitations and password resets are separate, one-time, expiring credentials. No public self-registration.

## D-004 — Assignment ownership and balancing

- **Status:** Accepted
- Team Access is the sole assignment management surface. People maintains review-target details and may display assignment context read-only.
- A target has at most one active reviewer in an organization. Only active same-organization reviewers and targets are eligible.
- Assign unassigned active targets deterministically to the least-loaded active reviewer, with stable tie-breaking. Preserve existing assignments unless an admin explicitly changes them. If no eligible reviewer exists, leave the target unassigned.
- Assignment updates are idempotent, transactional, audited, concurrency-safe, and never delete historical submissions.

## D-005 — Data preservation and lifecycle

- **Status:** Accepted
- Preserve organizations, users, memberships, targets, assignment state/history where represented, forms, immutable published versions, links, submissions, settings, and audit history when technically valid.
- Never export cleartext passwords or tokens. Existing password hashes may be preserved only if algorithm compatibility is confirmed; otherwise require a controlled reset. Reissue or expire bearer secrets instead of exporting cleartext.
- Archive is reversible. No destructive reset or silent repair/reassignment of production records.
- Migration is additive/expand-contract with read-only preflight, resumable dry-run, integrity comparison, verified backup/restore, and rollback rehearsal.

## D-006 — Routes and API compatibility

- **Status:** Accepted
- Preserve `/admin/*`, `/reviewer/*`, `/invite/:token`, `/reset-password`, `/r/:token`, and `/api/v1/*` during transition.
- Shared API contracts use `/api/v1`, runtime schema validation, stable error codes, request IDs, bounded pagination, explicit idempotency/conflict behavior, and no-store policy for private responses.
- Keep compatibility aliases while the current client or rollback path depends on them. Retire only after caller evidence and rollback-window closure.

## D-007 — Verification and release boundary

- **Status:** Accepted
- Behavior work uses tests before implementation. Verify unit/contracts, isolated MySQL integration and migration, browser E2E for both roles in one browser, accessibility/responsive layouts, security, production build/start, and staging restore.
- Capacity claims require staging measurements at expected, 3× sustained, and burst profiles with percentile latency, error rate, resource, connection-pool, and database metrics.
- Production cutover is a brief approved maintenance window: pause writes, backup and verify, final sync/migration, deploy/smoke test, restore traffic; rollback if a release gate fails.

## D-008 — Historical production incidents are not diagnoses

- **Status:** Accepted
- The user-reported People HTTP 500, Prisma P2039 logs, forwarded-header/rate-limit warning, and invitation validation screenshot are evidence to reproduce in staging. They are not by themselves a proven root cause and must not be “fixed” through guesses or destructive production SQL.
