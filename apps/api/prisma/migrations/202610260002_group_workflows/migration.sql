-- Expansion only. Legacy accounts/links remain in policy version 1.
ALTER TABLE `Organization` ADD COLUMN `groupWorkflowsEnabled` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `ReviewerGroup` ADD COLUMN `submissionGoal` INTEGER NULL, ADD COLUMN `archivedAt` DATETIME(3) NULL;
ALTER TABLE `ReviewLink` ADD COLUMN `groupId` VARCHAR(36) NULL, ADD COLUMN `accessPolicyVersion` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `Submission` ADD COLUMN `groupId` VARCHAR(36) NULL;

CREATE TABLE `ReviewerGroupFormGrant` (
 `id` VARCHAR(36) NOT NULL,
 `organizationId` VARCHAR(36) NOT NULL,
 `groupId` VARCHAR(36) NOT NULL,
 `formId` VARCHAR(36) NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE INDEX `GroupForm_org_group_form_key` (`organizationId`, `groupId`, `formId`),
 INDEX `GroupForm_org_form_idx` (`organizationId`, `formId`),
 CONSTRAINT `GroupForm_group_org_fkey` FOREIGN KEY (`organizationId`, `groupId`) REFERENCES `ReviewerGroup` (`organizationId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `GroupForm_form_org_fkey` FOREIGN KEY (`organizationId`, `formId`) REFERENCES `Form` (`organizationId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReviewLink` ADD CONSTRAINT `ReviewLink_group_org_fkey` FOREIGN KEY (`organizationId`, `groupId`) REFERENCES `ReviewerGroup` (`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_group_org_fkey` FOREIGN KEY (`organizationId`, `groupId`) REFERENCES `ReviewerGroup` (`organizationId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD INDEX `Submission_group_filter_idx` (`organizationId`, `groupId`, `archivedAt`, `submittedAt`, `id`);
