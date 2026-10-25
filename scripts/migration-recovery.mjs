const reviewDraftMigration = "202610240002_review_drafts";

export function isRecoverableReviewDraftMigrationFailure(output) {
  const isMigrationFailure = output.includes("P3009") || output.includes("P3018");
  const namesFailedMigration = output.includes(`Migration name: ${reviewDraftMigration}`)
    || output.includes(`The \`${reviewDraftMigration}\` migration`);
  return isMigrationFailure && namesFailedMigration;
}
