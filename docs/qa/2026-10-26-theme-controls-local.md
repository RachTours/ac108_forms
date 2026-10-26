# Local theme and controls audit — 2026-10-26

## Scope

Removed the editable people-review goal from Settings; the global submission editor was already replaced by a read-only group total. Goals remain accessible through Group management. Database fields and API behavior are unchanged by this UI task.

Shared theme/control styling lives in apps/web/app/ui-theme.css, imported by the root layout. Fixed hard-coded light colors on labels, help text, badges, form-builder controls, public forms, and dropdowns. Admin dark surfaces use navy; reviewer dark surfaces use forest tones. Preserved native controls, visible keyboard focus, existing saved appearance presets, independent platform mode preferences, and explicit appearance saving. Added restrained control transitions, disabled when reduced motion is requested.

## Verification

- Web suite: 93 tests passed.
- Web typecheck and targeted ESLint: passed.
- Production web build: passed using a non-routable HTTPS API placeholder.
- 270 browser cases: 15 routes × English/French/Arabic × light/dark × 320/768/1280px. Final run: no document overflow, direction/mode mismatches, missing messages, hydration errors or uncaught page errors.
- Targeted computed-style sampling found no contrast ratios below 4.4 among sampled visible text. This is not a full accessibility certification.
- 10 interactive checks passed: independent/persistent platform modes, language direction, toolbar alignment, keyboard focus, reduced motion, normal transitions, and 320px layout.
- 7 preview checks passed: changes stay in preview, platform drafts remain independent, selections survive tab changes, global goal fields are absent, and Group management remains accessible. No appearance was saved.

Browser audit used isolated local ports 5002/4002 to avoid interrupting the main task. Earlier fast scans hit the unchanged API rate limit; the final scan paced navigation. Screenshot-induced caret/hydration interference was avoided by capturing the caret unchanged. Final 270-case run was clean.

No push, deployment, migration, account change, or production mutation was performed by this UI task. Automatic approval review blocked temporary-build cleanup; generated test artifacts remain local and must not be included in a later commit.
