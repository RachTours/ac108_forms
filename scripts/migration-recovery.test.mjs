import assert from "node:assert/strict";
import test from "node:test";
import { isRecoverableReviewDraftMigrationFailure } from "./migration-recovery.mjs";

test("recognizes only the known failed ReviewDraft migration", () => {
  assert.equal(isRecoverableReviewDraftMigrationFailure("Error: P3018\nMigration name: 202610240002_review_drafts"), true);
  assert.equal(isRecoverableReviewDraftMigrationFailure("Error: P3018\nMigration name: 202610230001_assignment_integrity"), false);
  assert.equal(isRecoverableReviewDraftMigrationFailure("Error: P3009\nMigration name: 202610240002_review_drafts"), false);
});
