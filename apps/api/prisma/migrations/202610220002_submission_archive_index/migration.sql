CREATE INDEX `Submission_organizationId_archivedAt_submittedAt_id_idx`
  ON `Submission`(`organizationId`, `archivedAt`, `submittedAt`, `id`);

CREATE INDEX `Submission_organizationId_formId_idx`
  ON `Submission`(`organizationId`, `formId`);
