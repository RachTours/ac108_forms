# Task 1.2 report — API contracts and OpenAPI

## Changes
- Added `packages/contracts/test/openapi-contract.test.mjs`, a focused inventory/drift guard for the documented route families and representative shared schemas, plus a check that private credential fields are absent from the OpenAPI document.
- Expanded `docs/rebuild/openapi.yaml` for the current auth/reset, member/reset, targets/bulk assignments, forms, review links, submissions, progress, settings, audit, and readiness route families; added representative schemas for pagination and the target/member/form/link/submission/progress/theme/audit projections.
- Documented that OpenAPI is hand-maintained and that contract fixtures and route/schema inventory must be kept synchronized. Existing Zod schemas and tests already cover representative valid request/response values and reject unknown, malformed, overlong, and secret-bearing data; no runtime handlers or schema behavior needed changing.

## Verification
- RED: `npm run test --workspace @reviewroom/contracts` failed as expected on the missing `/auth/login` OpenAPI route.
- GREEN: `npm run test --workspace @reviewroom/contracts` passed (12 tests).
- `npm test` ran contracts and domain successfully. API tests built successfully but 3 test files failed at module initialization because `SESSION_SECRET` and `WEB_ORIGIN` are absent in the environment. The remaining API tests shown passed; the root command stopped in the API workspace before web tests.
- `git diff --check` passed.

## Remaining gaps
- OpenAPI is intentionally hand-maintained. The drift test verifies route/schema inventory and representative examples are exercised by the existing Zod contract tests; it does not parse YAML or mechanically prove each YAML schema is equivalent to Zod. Some endpoints are documented at route-family level with response descriptions rather than full component refs.
