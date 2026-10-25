const reviewDraftMigration = "202610240002_review_drafts";

export function isRecoverableReviewDraftMigrationFailure(output) {
  return output.includes("P3018") && output.includes(`Migration name: ${reviewDraftMigration}`);
}
