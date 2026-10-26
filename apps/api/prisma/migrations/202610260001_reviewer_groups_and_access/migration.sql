ALTER TABLE `OrganizationTheme`
  ADD COLUMN `adminAppearance` JSON NULL,
  ADD COLUMN `reviewerAppearance` JSON NULL;

ALTER TABLE `Membership`
  ADD COLUMN `groupId` VARCHAR(36) NULL,
  ADD COLUMN `submissionGoalOverride` INTEGER NULL,
  ADD COLUMN `formAssignmentsConfigured` BOOLEAN NOT NULL DEFAULT false,
  ADD INDEX `Membership_organizationId_groupId_role_status_idx` (`organizationId`, `groupId`, `role`, `status`);

CREATE TABLE `ReviewerGroup` (
  `id` VARCHAR(36) NOT NULL,
  `organizationId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ReviewerGroup_organizationId_id_key` (`organizationId`, `id`),
  UNIQUE INDEX `ReviewerGroup_organizationId_name_key` (`organizationId`, `name`),
  INDEX `ReviewerGroup_organizationId_createdAt_id_idx` (`organizationId`, `createdAt`, `id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReviewerGroup_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Membership`
  ADD CONSTRAINT `Membership_reviewerGroup_org_fkey`
    FOREIGN KEY (`organizationId`, `groupId`) REFERENCES `ReviewerGroup` (`organizationId`, `id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Form` ADD UNIQUE INDEX `Form_organizationId_id_key` (`organizationId`, `id`);

CREATE TABLE `ReviewerFormGrant` (
  `id` VARCHAR(36) NOT NULL,
  `organizationId` VARCHAR(36) NOT NULL,
  `reviewerId` VARCHAR(36) NOT NULL,
  `formId` VARCHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ReviewerFormGrant_organizationId_reviewerId_formId_key` (`organizationId`, `reviewerId`, `formId`),
  INDEX `ReviewerFormGrant_organizationId_formId_reviewerId_idx` (`organizationId`, `formId`, `reviewerId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReviewerFormGrant_reviewer_org_fkey` FOREIGN KEY (`organizationId`, `reviewerId`) REFERENCES `Membership` (`organizationId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReviewerFormGrant_form_org_fkey` FOREIGN KEY (`organizationId`, `formId`) REFERENCES `Form` (`organizationId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
