ALTER TABLE `ReviewLink`
  MODIFY `activeReviewerKey` VARCHAR(73) NULL,
  ADD COLUMN `formId` VARCHAR(36) NULL,
  ADD INDEX `ReviewLink_organizationId_formId_reviewerId_revokedAt_idx` (`organizationId`, `formId`, `reviewerId`, `revokedAt`),
  ADD CONSTRAINT `ReviewLink_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `Form` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
