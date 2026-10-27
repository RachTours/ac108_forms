# Field Settings Implementation Plan

> **For agentic workers:** Execute inline, one task at a time, with a test before each behavior change.

**Goal:** Add working, type-specific form settings while preserving existing saved form data and validation.

**Architecture:** Extend the strict form definition contracts with optional input constraints; render those settings in the admin inspector and bind them to actual reviewer controls; enforce the same constraints in the API. Keep existing `singleChoice` and `checkboxes` storage/answer formats, with a settings control that converts between the two while preserving option IDs and labels.

**Tech Stack:** TypeScript, React, Zod, Next.js, Node test runner, Prisma-backed API.

## Global Constraints

- Keep work on the current local feature branch; do not push or deploy.
- Do not add design/color controls.
- Existing forms without new optional properties keep current behavior.
- Validate submissions on the server regardless of browser constraint validation.

---

### Task 1: Form-setting contract and conversion model

**Files:** `packages/contracts/src/forms.ts`, `apps/web/src/features/forms/form-editor-model.ts`; tests in `packages/contracts/test/forms-settings.test.mjs` and `apps/web/src/features/forms/form-editor-model.test.mjs`.

- Add bounded `placeholder` to input-based fields and email/URL fields; keep date placeholder unsupported.
- Add optional `step` to number fields, defaulting to HTML's unit step when absent.
- Add optional `placeholder` to dropdowns; required dropdowns use the empty first option as the placeholder label.
- Preserve existing text min/max, number/date bounds, rating ranges, and checkbox min/max settings.
- Add a conversion helper to switch `singleChoice` ↔ `checkboxes`, preserving options, common field properties, and selection limits when representable; discard checkbox-only limits when converting to single.
- Test accepted bounds, rejected invalid ranges/steps, and choice conversion preserving option identity.

### Task 2: Admin inspector controls

**Files:** `apps/web/src/features/forms/form-editor.tsx`, `apps/web/app/globals.css`.

- Add choice-mode selection for either choice type and call the conversion helper.
- Add placeholder inputs for text, email, URL, phone, number, and dropdown fields.
- Expose available min/max length, numeric min/max/step, date bounds, rating range/step, and checkbox selection limits.
- Ensure control IDs are unique per selected question and show inline browser-usable constraints.
- Manually verify creating/editing fields does not alter unrelated question data.

### Task 3: Reviewer inputs and server enforcement

**Files:** `apps/web/src/features/review/review-portal.tsx`, `apps/api/src/modules/submissions/answer-validator.ts`, related API tests.

- Render configured placeholders and native `min`, `max`, `step`, `minLength`, and `maxLength` attributes.
- Keep radio answers as one option ID and checkbox answers as unique option-ID arrays.
- Enforce text bounds, number step alignment (relative to configured minimum or HTML's default base), and choice count limits on the API.
- Verify invalid values return `INVALID_ANSWER`; blank optional fields remain omitted and required fields remain rejected.

### Task 4: Verification

- Run focused contract, model, and answer-validator tests.
- Run repository typecheck, lint, production web build, and `git diff --check`.
- Smoke-check admin field settings and a local reviewer form without publishing or modifying production data.
