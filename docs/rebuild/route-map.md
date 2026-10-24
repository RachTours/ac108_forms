# Replacement Route and Page-State Map

This maps public browser URLs to the replacement product. Next.js internal rewrite targets are implementation details and must not change the route audience. The API remains authoritative for permissions. A page guard may redirect to the matching audience login but must never use the other audience’s session as a substitute.

## Browser routes

| Browser URL | Audience/guard | Page purpose and API dependencies | Required UI states |
|---|---|---|---|
| `/` | Entry; inspect valid admin session first, then reviewer session; explicit chooser if both valid | Redirect to audience landing without overwriting either session | Loading, admin/reviewer chooser, signed-out destination, recoverable service error |
| `/admin/login` | Public admin sign-in | `POST /api/v1/auth/admin/login`; `GET /api/v1/auth/session` after success | Idle, validation, pending, generic failure, workspace selection, rate limited |
| `/admin/overview` | Active OWNER/ADMIN membership | Organization, progress, recent submissions and reviewer workload | Loading, empty workspace, populated, partial error/retry |
| `/admin/people` | Active OWNER/ADMIN membership | Target list/create/update/archive; read-only current reviewer context; `GET/POST/PATCH/DELETE /api/v1/review-targets` | Loading, first-use empty, filtered empty, list, validation, conflict, retryable error |
| `/admin/submissions` | OWNER/ADMIN; optional reviewer filter | Paginated organization submission list and review/archive operations | Loading, no submissions, no filter results, list, conflict, retryable error |
| `/admin/submissions/:submissionId` | OWNER/ADMIN; tenant-scoped entity check | Exact published version and safe answer rendering; review/archive/restore | Loading, not found/forbidden-neutral, detail, archived, retryable error |
| `/admin/forms` | OWNER/ADMIN | Draft/published/archived form listing | Loading, empty, list, retryable error |
| `/admin/forms/new` | OWNER/ADMIN | Draft creation and editor | Loading, dirty/saved, validation, save error, conflict, accessible preview |
| `/admin/forms/:formId` | OWNER/ADMIN | Edit draft, inspect publication history, publish immutable version | Loading, not found, clean/dirty, validation, publish confirmation, conflict, retryable error |
| `/admin/team` | OWNER/ADMIN | Membership/invitation lifecycle, password reset, sole assignment hub and reviewer workload; `/api/v1/members`, `/api/v1/assignments`, `/api/v1/review-links` | Loading, no reviewers, no targets, unassigned, assigned, invite pending/expired, stale conflict, retryable error |
| `/admin/settings` | OWNER/ADMIN; sensitive settings may be OWNER-only | Workspace identity, goal, safe appearance tokens | Loading, empty/default, dirty preview, validation, save/conflict, retryable error |
| `/reviewer/login` | Public reviewer sign-in; reviewer audience only | `POST /api/v1/auth/reviewer/login` | Idle, validation, pending, generic failure, rate limited |
| `/reviewer/progress` | Active REVIEWER membership | Assigned target progress; `/api/v1/progress/reviewer-board` | Loading, no assignments, progress, retryable error |
| `/reviewer/submissions` | Active REVIEWER; list restricted by authenticated membership | Own submitted reviews only; `/api/v1/submissions` | Loading, empty, list, retryable error |
| `/reviewer/submissions/:submissionId` | Active REVIEWER; same-membership ownership | Own response and exact form version | Loading, neutral not-found/forbidden, detail, retryable error |
| `/reviewer/forms` | Active REVIEWER | Own reviewer-specific active/expired links and available published forms; `/api/v1/review-links/mine/forms` | Loading, no published forms, no targets, active link, expired/revoked, retryable error |
| `/invite/:token` | Public one-time invitation | GET invitation preview; POST acceptance; no session until success | Loading, invalid/expired/accepted, identity/password validation, pending, success |
| `/reset-password?audience=admin\|reviewer` | Public one-time reset; audience is allowlisted | POST reset request; reset applies only to invited membership | Invalid audience, form, validation, pending, neutral token failure, success |
| `/r/:token` | Public bearer link; no app session required | Link-scoped form/targets and submission APIs | Loading, expired/revoked/unavailable, no assigned targets, form, validation, submitting, duplicate receipt, success |

Every authenticated route must handle session expiry by returning to its own audience sign-in while preserving an allowlisted local return path. Cross-audience redirects are prohibited.

## API route families

All routes are under `/api/v1`; private responses are `Cache-Control: no-store`, and error responses use a stable code plus request ID.

| Prefix | Current purpose | Replacement authorization boundary |
|---|---|---|
| `/health`, `/api/v1/health/live`, `/api/v1/health/ready` | Liveness/readiness | Readiness checks database connectivity; do not expose credentials or query data. |
| `/auth/*` | Login by audience, session, logout, reset | Separate admin/reviewer audience; active membership; CSRF/origin controls for writes. |
| `/members/*` | Team, invitations, reset tokens, membership lifecycle | Same organization; owner-only grant/revoke of admin; reviewer invitations managed by authorized workspace admin. |
| `/review-targets/*` | Target CRUD and legacy assignment aliases | Target CRUD is admin-only. Legacy assignment aliases are compatibility-only and must converge on the single assignment use case until retired. |
| `/assignments/*` | Paginated assignment list, set and remove | Owner/Admin only; same-org active reviewer and target; expected-version concurrency token; audit. |
| `/forms/*` | Draft, publish, archive/restore | Owner/Admin only; published versions immutable. |
| `/review-links/*` | Admin and self reviewer link lifecycle | Admin in tenant or same reviewer membership; hash bearer values and enforce expiry/revocation. |
| `/public/review/*` | Read/submit via reviewer link | Bearer purpose, link, form, target assignment, publication, and idempotency checks; minimal DTO. |
| `/submissions/*` | Admin/reviewer inbox and lifecycle | Tenant-scoped admins; reviewers restricted to own membership and assigned target. |
| `/progress/*` | Admin summary, reviewer board, goal config | Tenant-scoped; reviewer board restricted to own membership. |
| `/organization/*` | Workspace and theme | Tenant-scoped read; authorized admin writes; theme allowlist. |
| `/audit-events/*` | Audit history | Tenant-scoped OWNER/ADMIN read; append-only safe metadata. |

## Global interaction and accessibility requirements

- Every data-fetching surface has loading, empty, error, retry, success and applicable conflict states. Error copy shows a safe request reference, not a stack trace.
- Lists have bounded server pagination and preserve filter state in the URL where practical.
- Mobile layouts use stacked records/cards and avoid horizontal overflow at 320 CSS px. Bottom navigation, dialogs and drawers respect safe areas and virtual keyboards.
- Keyboard-only operation, visible focus, semantic labels/errors, reduced motion, and accessible confirmation for destructive-looking lifecycle actions are release requirements.
- Metadata, page title and visible brand consistently identify `Admin Panel` or `Reviewer Panel`; no browser title or header should imply the wrong role.
