# Local reviewer groups, reviewer settings, themes and validation

Implemented on `codex/reviewer-groups-platform-themes`, based on `2abe2cd`.
Local source recovery tag: `backup/reviewroom-before-groups-20261026`.
No Git push or production deployment was performed.

## Delivered behavior

- Admins can create, rename and delete reviewer groups in Team Access. Reviewers belong to at most one group. Deleting a group leaves its reviewers ungrouped and preserves their submissions.
- Group cards on Overview and Team Access show member counts, active submission totals and the sum of member goals. The group submission dialog is paginated and shows only submissions by that group's current active reviewers. These views are admin-only; reviewers keep personal-only submission access.
- Reviewer settings support a group, published form assignments, and a personal submission-goal override. A blank override restores the exact workspace-goal / active-reviewer-count calculation. The workspace goal remains independent. Personal progress counts all active authored submissions, including history from forms that are no longer assigned.
- Existing memberships retain access to all published forms until specific assignments are saved. An explicit empty form list permits no forms. Clearing the restriction restores all current and future published forms. Public link reads, submissions, and reviewer link creation enforce the assignments on the server.
- Settings can save a separate admin and reviewer appearance using the existing curated appearance controls. Reviewer appearance also applies to public forms. Existing organizations fall back to their original appearance until an independent appearance is saved.
- Admin and reviewer light/dark preferences are remembered independently in the browser. A preference cookie supplies the initial server-rendered mode; browser storage synchronizes subsequent choices. No editor font/color tooling was added.
- Published forms highlight invalid fields, show localized inline messages, scroll to and focus the first invalid control, and offer a jump-to-error action. Missing signatures focus the drawing pad. API validation errors include an optional safe field ID. Link/session/network errors use a page alert and keep entered answers.

## Database compatibility

Applied `202610260001_reviewer_groups_and_access` only to
`127.0.0.1:3306/reviewroom_qa_04b92acd`.

The migration adds nullable/defaulted membership settings, two tables, nullable platform appearances, and indexes/foreign keys. It neither removes nor rewrites existing review data. Composite foreign keys prevent cross-workspace memberships and form grants.

The runtime app account lacked ALTER permission. Its first migration attempt stopped on the first statement before changing tables. After confirming that condition, the failed attempt was marked rolled back and the migration was applied with the local administrator account. Runtime credentials remain unchanged.

Local backup: `output/backups/before-reviewer-groups-20261026.sql`.
Backups, fixture credentials, browser storage and local preview build artifacts are ignored by Git.

Counts before migration and after verification-fixture cleanup:

| Table | Before | After |
| --- | ---: | ---: |
| Organization | 1 | 1 |
| Membership | 2 | 2 |
| Form | 4 | 4 |
| Submission | 17 | 17 |

The local origin setting was aligned to `http://127.0.0.1:5000` so browser writes pass the existing strict origin/CSRF checks.

## Verification

- `npm test`: 270 passing, zero failures.
- `npm run typecheck`: passed.
- `npm run lint`: zero errors; 12 pre-existing warnings in unchanged code.
- `git diff --check`: passed.
- `npm run build`: passed. The pre-existing production config rejects loopback API origins, so this local compile used the reserved `https://api.reviewroom.invalid` placeholder. No production service was contacted. Local preview continues to use the loopback API.
- `node scripts/verify-reviewer-groups-local.mjs`: 37 successful HTTP assertions against `127.0.0.1:4000`, plus database assertions. Covered duplicate group names, rename/delete, group pagination and totals, current-membership history movement, reviewer denial, cross-workspace API and database rejection, default and custom goals, explicit form grants/no access, old access defaults, public submission validation, separate themes, and preserved history.
- Temporary organizations and users were removed with `node scripts/verify-reviewer-groups-local.mjs --cleanup`.
- Real Chromium checks on localhost covered reviewer-setting save/reload persistence, modal focus and Escape, English/French/Arabic labels, RTL, independent theme persistence, native and server field errors, signature focus/drawing, successful public submission, and non-field errors preserving answers.
- Admin and public layouts had no horizontal overflow at 320, 390, 768 and 1280 pixels.
- Representative screenshots are retained in ignored `output/playwright/`.

## Local preview

API: `http://127.0.0.1:4000`; web: `http://127.0.0.1:5000`.

PowerShell commands from the repository root:

```powershell
$env:HOST = '127.0.0.1'
npm run dev --workspace @reviewroom/api
```

In another terminal:

```powershell
$env:NEXT_DIST_DIR = '.next-groups-local-preview'
npm run dev --workspace @reviewroom/web -- --hostname 127.0.0.1
```

Open `/admin/team` for groups and reviewer settings, `/admin/settings` for platform appearances, and `/reviewer/progress` for the reviewer panel.

Keep the additive schema when switching back to the recovery source tag; do not drop columns or tables as part of a source rollback.
