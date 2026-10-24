# Local ReviewRoom Product Roadmap Implementation Plan

> **For agentic workers:** Execute each task in order and test-first. Keep all changes on `codex/reviewroom-product-roadmap`; do not push or deploy.

**Goal:** Add CSV people import, reviewer drafts and queue, admin summary reports/CSV export, assignment due dates with in-app reminders, and measured performance improvements for growing workspaces.

**Architecture:** Preserve Next.js/Express/Prisma/MySQL boundaries and shared Zod contracts. Keep data authorization in the API. Add persistent drafts and due dates through migrations; compute reminders and reports from scoped data; use bounded list/import/export operations. Capture a local baseline before optimizing.

**Tech Stack:** Next.js App Router, React, Express 5, Prisma 7, MySQL/MariaDB, TypeScript, shared Zod contracts, Node test runner.

## Global Constraints

- Work only on localhost and the configured local MySQL database; fail closed if any benchmark/migration target is not loopback.
- Do not push, merge into `main`, or deploy.
- CSV import is capped at 500 rows and all-or-nothing; duplicate detection uses normalized non-empty email against active people and within the upload.
- Review drafts are isolated by organization, reviewer, target assignment, and immutable form version; expire after 90 days of inactivity.
- Exports contain summary data only, never answer payloads; authorize and audit export requests.
- Reminders are in-app only; do not add an email provider or outbound email.
- Tune the existing Hostinger/MySQL architecture only after recording local measurements; avoid private-data caching.

---

### Task 1: Local baseline and benchmark harness

- [ ] Record current test/typecheck/lint/build state and local endpoint latency for overview, people, assignment, and submission reads.
- [ ] Add a benchmark runner using a disposable loopback MySQL schema and synthetic data (50 reviewers, 10,000 submissions); redact credentials and response data from output.
- [ ] Record p50/p95, status/error counts, page/API timings, query counts where available, memory, and DB connections in `docs/performance/local-roadmap-baseline.md`.
- [ ] Verify no production URL can be used by the runner; do not seed the existing QA schema.

### Task 2: CSV people import

- [ ] Add failing tests for quoted fields, CRLF/newlines, missing/extra headers, malformed rows, invalid names/emails, normalized duplicate emails, existing active-email duplicates, blank emails, and the 500-row cap.
- [ ] Implement a bounded CSV parser/validator and preview/commit contracts. Preview writes nothing; commit revalidates inside one transaction and rejects the whole file if any row is invalid or duplicated.
- [ ] Reuse current auto-assignment balancing for new people and emit organization-scoped audit metadata without storing file contents.
- [ ] Add an admin preview UI with row numbers/errors, confirmation, success counts, and a downloadable error report; preserve existing add-one-person workflow.

### Task 3: Reviewer queue and resumable drafts

- [ ] Add a `ReviewDraft` model keyed by organization/reviewer/target/form version, with JSON answers and `updatedAt`; add migration and local-only migration tests.
- [ ] Add token-scoped public API endpoints to list the reviewer’s assigned pending/completed work, read/upsert/delete their draft, and continue enforcing current link, form-version, workspace, and assignment access checks.
- [ ] Validate draft answers as partial data against the immutable form definition; final submission uses the existing strict validator and atomically deletes the matching draft.
- [ ] Expire drafts after 90 inactive days on reads/writes and provide a local cleanup command for test/maintenance use.
- [ ] Add reviewer queue filters, “Next review,” draft indicators, autosave state, resume, and explicit discard confirmation.

### Task 4: Admin reporting and safe CSV export

- [ ] Add bounded date/form/reviewer filters and an organization-scoped server-side aggregate endpoint for submission and completion totals.
- [ ] Add CSV export from the same filtered summary projection; neutralize spreadsheet formula cells and exclude `answers` and form definitions.
- [ ] Require the existing submissions-read permission and record export actor, filters, row count, and timestamp in audit metadata without recording answers.
- [ ] Add admin filters, summary cards/table, export action, loading/error/empty states, and contract tests.

### Task 5: Assignment due dates and in-app reminders

- [ ] Add nullable `dueAt` to `Assignment` with a migration and shared assignment contracts.
- [ ] Add an authorized admin mutation/UI for setting or clearing a due date; preserve assignment concurrency/version protections.
- [ ] Derive due-soon (within seven days) and overdue states from outstanding assignment work; show them in admin and reviewer queues without creating emails or uncached notification records.
- [ ] Test reassignment, completion, timezone/date boundaries, and organization isolation.

### Task 6: Measured optimization and local acceptance

- [ ] Compare new measurements to Task 1; inspect query plans and optimize only demonstrated hot paths with suitable indexes/selects and bounded server-side filters.
- [ ] Virtualize lists only if measured render time or DOM size warrants it; retain accessible table/list semantics.
- [ ] Re-run the 50-reviewer/10,000-submission benchmark and document before/after values; target local read p95 under 500 ms and bounded query growth for reviewer progress.
- [ ] Run full repository tests, typecheck, lint, production build, migration against the disposable local schema, and localhost admin/reviewer/public flow smoke checks.
- [ ] Review `git diff --check`, secret/status files, branch name, and confirm no push/deploy occurred.
