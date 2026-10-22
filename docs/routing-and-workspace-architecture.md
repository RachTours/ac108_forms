# Workspace routing and deployment structure

## Panel identity and browser titles

- The admin workspace is labeled **Admin Panel** and the reviewer workspace **Reviewer Panel** in the sidebar, sign-in screens, public review form, and page titles.
- The sidebar does not show a workspace switcher/organization card. The top breadcrumb uses the panel name instead of the organization name.
- The shared Next.js metadata template reads the role audience set by `proxy.ts`; `/reset-password?audience=reviewer` retains reviewer branding. Invitation metadata uses the invited role. The public `/r/:token` page is always branded as Reviewer Panel.
- Keep page metadata titles role-neutral (for example, `Team access`); the request-aware root template appends the correct panel name. Use absolute metadata titles only for dedicated public/role-specific pages.

## Public URL contract

The browser URL is role-scoped. Production deployments use the same paths under the chosen domain (for example `https://reviews.example.com/admin/login`); no Hostinger-specific routing rule is required for these Next.js routes.

| Audience | Public URL | Purpose | Internal implementation |
|---|---|---|---|
| Admin | `/admin` | Entry point; sends signed-in users to their role home | `app/admin/page.tsx` |
| Admin | `/admin/login` | Owner/admin sign-in | `app/admin/login/page.tsx` |
| Admin | `/admin/overview` | Team-wide progress dashboard | rewrite to shared overview page |
| Admin | `/admin/people` | Review targets and assignments | rewrite to `/people` |
| Admin | `/admin/submissions` and `/admin/submissions/:id` | Feedback inbox, archive, details | rewrite to `/submissions...` |
| Admin | `/admin/forms`, `/admin/forms/new`, `/admin/forms/:id` | Form list, create, editor | rewrite to `/forms...` |
| Admin | `/admin/team` | Members, access tokens, reviewer links | rewrite to `/team` |
| Admin | `/admin/settings` | Workspace settings | rewrite to `/settings` |
| Reviewer | `/reviewer` | Entry point; sends signed-in users to reviewer home | `app/reviewer/page.tsx` |
| Reviewer | `/reviewer/login` | Reviewer sign-in | `app/reviewer/login/page.tsx` |
| Reviewer | `/reviewer/progress` | Personal progress | rewrite to shared overview page |
| Reviewer | `/reviewer/submissions` and `/reviewer/submissions/:id` | Own feedback inbox and details | rewrite to `/submissions...` |
| Reviewer | `/reviewer/forms` | Personal form share links | rewrite to `/my-link` |
| Shared/public | `/invite/:token` | Accept one-time team access token and choose password | invitation acceptance route |
| Shared/public | `/reset-password?audience=admin\|reviewer` | Use a separate one-time reset token | reset flow; role-specific sign-in return |
| Public review | `/r/:token` | Submit feedback through a reviewer-bound link | public review portal |
| API | `/api/v1/*` | JSON API, role and workspace authorization | API service via Next rewrite |

## Compatibility redirects

`/login` redirects to `/admin`. Legacy admin-only browser paths `/people`, `/forms...`, `/team`, `/settings`, and `/submissions...` redirect into `/admin/...`; the legacy `/my-link` path redirects to `/reviewer/forms`. App code should use only canonical role-scoped paths.

## Request and authorization flow

1. The Next.js Proxy records the incoming audience and original path in request headers. These headers are routing hints only; they do not grant access.
2. Rewrites map canonical role URLs to the current shared page implementations without changing the URL in the browser.
3. The workspace layout checks the signed-in session and loads workspace appearance. Unauthenticated admin URLs go to `/admin/login`; reviewer URLs go to `/reviewer/login`.
4. `requireWorkspaceRole` checks the actual session role and audience at the page boundary. It routes a user who opens the other role's URL to their own home.
5. API middleware and endpoint-level checks remain the authority for organization scope, role access, and reviewer assignment scope. A hidden navigation link is never treated as security.
6. Successful sign-in and invitation acceptance use the appropriate role route. Login pages do not offer links to the other role's login.

## Source layout

- `apps/web/app/admin` and `apps/web/app/reviewer`: public entry pages and distinct sign-in screens.
- `apps/web/app/(workspace)`: shared Next page implementations behind one authenticated shell.
- `apps/web/proxy.ts`: request audience/path hints for role-aware redirects.
- `apps/web/next.config.ts`: browser-preserving rewrites for canonical URLs and `/api/*` forwarding.
- `apps/web/src/lib/workspace-access.ts`: central route mapping, navigation, and role path helpers.
- `apps/web/src/lib/page-access.ts`: server page guard using the real session role.
- `apps/api`: API authorization, persistence, business rules, and health endpoints.
- `packages/contracts`: shared request/response validation and form field schemas.

## Maintenance rules

- Add a new admin or reviewer page to the route table, navigation helper, rewrite config, and page access guard together.
- Keep internal links canonical (`/admin/...` or `/reviewer/...`) so users remain in the role URL namespace.
- Keep API authorization tests for each new endpoint; front-end route protection is an additional UX boundary, not a substitute.
- Do not expose token hashes or reusable secrets in list APIs. Only explicitly authorized creation/rotation responses return a raw secret.
- Smoke-check direct unauthenticated deep links and wrong-role direct links after route changes.

## Deployment notes

Build and run the Next.js server as a Node.js application on Hostinger's supported Node.js hosting plan or VPS. Configure the reverse proxy/domain to forward HTTPS traffic to the app and keep the API/database network private. Set the production API origin, database URL, cookie/security secrets, allowed origin, and email configuration as deployment environment variables. Configure the database and backups independently from the web process. The app routes themselves are domain-relative, so replacing localhost with a production domain does not require changing route code.
