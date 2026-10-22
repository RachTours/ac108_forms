CREATE INDEX `Submission_review_filter_idx`
  ON `Submission` (`organizationId`, `reviewerId`, `archivedAt`, `submittedAt`, `id`);
