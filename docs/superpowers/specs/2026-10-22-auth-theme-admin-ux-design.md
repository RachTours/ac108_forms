# Authentication, workspace theme, and admin UX design

**Status:** Approved by the workspace owner on 2026-10-22; implementation not started.

## Goal

Make sign-in clearer for workspace owners/admins and reviewers, provide secure admin-issued password recovery without email, and let an admin configure one accessible visual theme that is consistent across the product. Simplify the most-used admin pages without weakening the existing reviewer access boundaries.

## Repository baseline

- Product: Reviewroom, a multi-workspace peer-review application.
- Web: Next.js App Router, React, TypeScript, current Next.js 16.4.2; main UI styles are currently in `apps/web/app/globals.css`.
- API: Node.js and Express, TypeScript, versioned routes under `/api/v1`.
- Persistence: MySQL through Prisma and shared schemas in `packages/contracts`.
- Current login page is `apps/web/app/login/page.tsx`; `apps/web/src/features/auth/login-form.tsx` is the one shared login form and already has a show/hide password toggle.
- Role authorization is enforced at workspace pages and API middleware. Reviewers should only see their assigned work.
- No Docker or Redis. Do not add either dependency.
- The local web, API, and MySQL services were responding on ports 3000, 4000, and 3307 at design time. A direct API login with the saved local owner credential returned HTTP 200 and OWNER. The password string previously sent in chat was mistyped; credentials remain in the owner-only local credential file and must not be committed or repeated in logs/chat.

## Product decisions

1. Provide distinct admin and reviewer login pages and role-specific authentication endpoints/policies. Admin sign-in accepts OWNER/ADMIN memberships only; reviewer sign-in accepts REVIEWER memberships only. A role mismatch fails closed with a generic sign-in error.
2. Reviewers continue to activate once with an admin-issued invitation/access token, then use their own email and password for later sign-ins. Admin and reviewer sign-in flows are distinct. Reuse low-level, audited primitives (password hashing, CSRF protection, session cookies, and session revocation) rather than creating duplicate cryptography or unmaintainable parallel account stores.
3. Password recovery uses a separate, admin-issued, single-use reset token. It is not an invitation token. There is no email delivery in this design.
4. A single organization-scoped theme applies to the owner/admin UI, reviewer UI, form editor, form list typography, and public published forms.
5. Customization is bounded to validated design tokens and approved presets. Do not allow arbitrary CSS, scripts, or external font URLs.
6. True nested teams and team-scoped assignments are deferred. The existing workspace membership model remains the team boundary in this implementation slice.

## Authentication and password recovery

### Sign-in routes

- Add `/admin/login` and `/reviewer/login` with distinct titles, explanatory copy, and role-appropriate navigation after sign-in.
- Keep `/login` as a compatibility entry that presents a clear role choice or redirects according to a documented default; do not infer a role from untrusted query parameters.
- Extract an accessible `PasswordInput` control used by every sign-in and reset form. It has exactly one visibility toggle associated with the password input (never the email field), a stable label, `aria-pressed`, keyboard support, and autocomplete attributes.
- Add role-specific API entry points. They share validated session issuance and password verification primitives, but each performs server-side role enforcement before creating a session. Never rely on client-side routing alone for authorization.
- After successful sign-in, redirect to the role's allowed home. Direct access to unauthorized admin routes remains denied by the server/page boundary.

### Admin-issued reset tokens

- From Team access, an owner/admin selects an active member and issues a reset token. Issuing a replacement invalidates any still-active reset token for that member.
- Show the raw token once with a copy action. Store only a cryptographic hash, plus workspace/member IDs, issue time, expiry, and consumed/revoked timestamps. Never include hashes or raw tokens in list/read API responses or audit logs.
- Admin and reviewer authentication use separate workspace-membership password hashes, even when they share the same email identity. The member opens `/reset-password`, submits their email, token, and a new password. The API validates token hash, target membership, workspace, expiry, and unused state in one transaction, updates only that membership password, consumes the token, and revokes sessions for that membership.
- Use cryptographically secure opaque tokens, a short configurable lifetime (default 30 minutes), one-time use, CSRF protection where a session exists, strict request limits, and audit events without secret values. Return generic request/validation responses that do not reveal account existence. Do not email reset links.
- Expired, revoked, consumed, wrong-member, and cross-workspace tokens fail closed. A new token is issued by an authorized admin rather than recovering a previous raw token.

## Workspace theme system

- Add a typed, organization-scoped theme record with defaults and a version/update timestamp. Suggested fields: logo asset reference, primary/accent color, surface/background color preset, heading font preset, and body font preset.
- Use a short allowlist of bundled or system-safe font presets. Apply the selected heading font to form titles in the list, editor canvas, and public form. Apply body font consistently to admin/reviewer controls and public form answers.
- Validate color values and calculate contrast before saving; warn or reject combinations that do not meet accessible text contrast. Theme values are emitted as CSS custom properties, not interpolated CSS text.
- Provide Settings → Appearance with a compact form, live preview for admin/reviewer/editor/public-form samples, save/cancel, and restore-defaults actions. Only owner/admin can change theme. Reviewers and public form respondents get read-only theme data.
- Initial implementation scope is the allowlisted accent palette and system-safe font presets. Logo upload, editable surfaces, and separate heading/body fonts remain later enhancements unless separately specified.
- Theme update applies workspace-wide on next render and never changes form answers or published form definitions. Do not add per-user or per-page theme overrides in this scope.
- For uploaded logos, validate actual MIME/signature, size, and dimensions; use generated server-side filenames and an app-controlled storage path. Keep only metadata/path in MySQL, prevent scriptable uploads, and keep the upload out of public execution paths.

## Admin UX cleanup

- Settings: group Progress, Workspace identity, Appearance, and Access into clear sections with concise descriptions, visible save status, and narrow forms.
- Team access: clarify active members, pending onboarding tokens, form links, and password reset tokens as separate sections. Put member-specific actions with that member and label destructive/revocation actions explicitly.
- Review targets: use a responsive table/list with reviewer assignment, status, response count, search/filter, and an obvious empty state. Preserve bulk actions only where they are already supported.
- Forms: apply the selected workspace heading font to form names. Keep published/draft/archived status and archive/delete actions distinct and explicitly labeled.
- Preserve reviewer navigation limits and make all pages usable at mobile widths; maintain keyboard focus, labels, contrast, and screen-reader status messages.

## Data/API boundaries

- Add Prisma migration(s) for organization theme and reset-token lifecycle data. Follow existing organization scoping and foreign-key conventions.
- Add Zod request/response schemas in `packages/contracts`; new endpoints must validate role and workspace server-side and reject unknown fields.
- Suggested API families: `POST /api/v1/auth/admin/login`, `POST /api/v1/auth/reviewer/login`; `POST /api/v1/members/:memberId/password-reset-tokens`, `POST /api/v1/auth/password-reset`; `GET/PUT /api/v1/organization/theme`.
- Apply existing API rate limiting plus stricter reset-token issuance/consumption limits. Current in-process limits are not shared between multiple API workers; no claim of multi-instance high-traffic capacity is made without a shared gateway limiter or representative load evidence.
- Add audit events for reset-token issue/revoke/consume and theme updates. Redact secrets from errors, logs, and audit metadata.

## Error handling and security invariants

- All UI guards are backed by API role checks. A Reviewer can never gain admin access by changing a URL or request body.
- Invalid login, role mismatch, invalid reset token, expired token, and token/account mismatch do not reveal secrets or other members' existence.
- Token creation/rotation/consumption and password update are transactional. A reset cannot be replayed after success.
- All mutations require session/CSRF protections as appropriate; public token flows are rate-limited and scoped to the intended account/workspace.
- Default theme remains usable if theme data is absent or malformed; server rejects invalid values and clients fall back to safe defaults.
- No Docker, Redis, external auth provider, email sender, arbitrary CSS, or arbitrary remote font loading is introduced.

## Verification criteria

- Role-specific login forms each show/hide only the password field; admin and reviewer credentials cannot cross-sign-in; successful users land on their correct workspace.
- Legacy `/login` behavior is documented and tested. Direct unauthorized page/API requests remain denied.
- Reset-token tests cover issuance, hash-only persistence, copy-on-creation response, replacement invalidation, expiry, replay, wrong member/workspace, password policy, and session revocation.
- Theme tests cover schema validation, organization isolation, role checks, safe fallback, contrast constraints, and CSS token application in admin/reviewer/editor/public form.
- Visual verification at desktop and narrow mobile widths for login, Settings, Team access, Review targets, forms list, editor, and public review.
- Run repository typecheck, lint, existing tests, and production build after implementation. Do not claim high-traffic stability from these checks; report load/operations evidence separately.

## Implementation order

1. Add/verify role-specific auth boundaries and shared password input; keep the current working local owner account intact.
2. Add admin-issued reset-token schema, lifecycle, UI, and tests.
3. Add organization theme schema/API, then admin Appearance settings and CSS variable application.
4. Simplify Settings, Team access, Review targets, and Forms typography/responsive layouts.
5. Run verification and inspect the app in browser. Preserve backward-compatible `/login` and existing invitations/form links.

## Research references

- OWASP Forgot Password Cheat Sheet: reset tokens should be random, securely stored, single-use, and expire; recovery responses should avoid account enumeration. https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

