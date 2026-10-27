# Group review dialog and team controls

Local-only bugfix plan. No database/schema/access-policy changes; no push/deploy.

- [x] Reproduce overview navigation and collapsed blocked-link text in the browser.
- [x] Replace group review navigation with an inline detail view using existing authenticated SubmissionDetail; preserve list/pagination, return focus/scroll, URL and session.
- [x] Make activation explain its purpose and expose named missing-group goals/ungrouped reviewers on click. Keep backend readiness enforcement and explicit confirmation for actual activation. Distinguish loading from unavailable actions.
- [x] Put share-link identity/status on a stable row, actions in a wrapping group, and permission explanation on its own full-width line. Keep replacement disabled when generation is unauthorized and point admins to existing form-access settings.
- [x] Preserve current visual design, EN/FR/AR, RTL/LTR and phone/tablet/desktop layouts.
- [x] Browser regressions: same overview/team URL after opening/closing a review; data shown, mark-reviewed action; activation blockers named without changing flag; readable long blocked rows; authorized replacement works only in synthetic fixtures; responsive keyboard use.
- [x] Repository tests/typecheck/lint/build/diff and isolated integration cleanup; document results.

Follow-up from the group history review:
- [x] Show the reviewed person from the immutable submitted form response, with the submitting reviewer named separately.
- [x] Add server-side reviewer-name sorting with stable cursor pagination.
- [x] Show each configured group’s capped goal percentage on its card.
- [x] Keep details and group history in the existing page/dialog without changing route or session.

Verification: 582 isolated API/database workflow assertions passed, including the legacy API route, and original database rows were preserved. Repository tests and typecheck passed; lint has 10 pre-existing warnings and no errors. Production web build passed with a temporary HTTPS API rewrite setting and isolated `.next-validation` output. Local web login and API health returned HTTP 200. Browser use was unavailable in this turn; prior local UI/browser checks are recorded in the work log.
