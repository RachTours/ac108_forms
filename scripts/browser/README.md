# Local release regression checks

These scripts use Playwright CLI against the isolated group-workflow fixture. They
never require a real account password. Start the API and web on
`127.0.0.1:4000` and `127.0.0.1:5000`, with a local QA database and
`WEB_ORIGIN=http://127.0.0.1:5000`. Build API/contracts before running the fixture.

From the repository root in PowerShell:

```powershell
$env:GROUP_QA_PASSWORD='SyntheticBrowserOnly27!'
node scripts/verify-group-workflows-local.mjs --keep
node scripts/browser/prepare-audit-state.mjs
npx --yes --package @playwright/cli playwright-cli -s=release-audit open http://127.0.0.1:5000/admin/login
npx --yes --package @playwright/cli playwright-cli -s=release-audit state-load output/playwright/audit-state.json
npx --yes --package @playwright/cli playwright-cli -s=release-audit run-code --filename scripts/browser/check-login-flow.js
npx --yes --package @playwright/cli playwright-cli -s=release-audit run-code --filename scripts/browser/check-login-fallback.js
npx --yes --package @playwright/cli playwright-cli -s=release-audit run-code --filename scripts/browser/check-history-close.js
npx --yes --package @playwright/cli playwright-cli -s=release-audit run-code --filename scripts/browser/check-reviewer-pagination.js
```

Inspect each command's exit status and error output. The fallback check creates
one unaccepted invitation inside the isolated fixture; it intercepts native form
navigation to verify POST without sending credentials in a query string. It does
not implement JavaScript-free authentication. The pagination check supplies
controlled list responses and delays one response to reproduce a network race.

Always clean up, including after a failed browser check:

```powershell
node scripts/verify-group-workflows-local.mjs --cleanup
npx --yes --package @playwright/cli playwright-cli -s=release-audit close
```

The fixture cleanup verifies original database rows are unchanged. Browser state,
synthetic sessions, snapshots and test logs stay in ignored local output folders.
Delete retained state after use; it temporarily authenticates as the fixture.
