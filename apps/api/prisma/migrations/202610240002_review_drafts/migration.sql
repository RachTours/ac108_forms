ALTER TABLE `Assignment`
    ADD UNIQUE INDEX `Assignment_organizationId_id_key` (`organizationId`, `id`);

CREATE TABLE `ReviewDraft` (
    `id` VARCHAR(36) NOT NULL,
    `organizationId` VARCHAR(36) NOT NULL,
    `reviewerId` VARCHAR(36) NOT NULL,
    `assignmentId` VARCHAR(36) NOT NULL,
    `formVersionId` VARCHAR(36) NOT NULL,
    `answers` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `ReviewDraft_organizationId_reviewerId_assignmentId_formVersionId_key` (`organizationId`, `reviewerId`, `assignmentId`, `formVersionId`),
    INDEX `ReviewDraft_updatedAt_idx` (`updatedAt`),
    INDEX `ReviewDraft_organizationId_reviewerId_updatedAt_idx` (`organizationId`, `reviewerId`, `updatedAt`),
    CONSTRAINT `ReviewDraft_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ReviewDraft_reviewer_org_fkey` FOREIGN KEY (`organizationId`, `reviewerId`) REFERENCES `Membership` (`organizationId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ReviewDraft_assignment_org_fkey` FOREIGN KEY (`organizationId`, `assignmentId`) REFERENCES `Assignment` (`organizationId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ReviewDraft_formVersionId_fkey` FOREIGN KEY (`formVersionId`) REFERENCES `FormVersion` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
