-- Supports assignment completion checks in the reviewer workload query.
-- Additive index only; existing application versions remain compatible.
CREATE INDEX `Submission_org_target_reviewer_archive_idx`
  ON `Submission` (`organizationId`, `targetId`, `reviewerId`, `archivedAt`);
