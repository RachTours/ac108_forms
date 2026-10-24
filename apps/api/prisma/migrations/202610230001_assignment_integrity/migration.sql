-- Preserve existing assignments, initialize the concurrency version from creation time,
-- and make it impossible to attach an assignment across workspace boundaries.
ALTER TABLE `Membership`
    ADD UNIQUE INDEX `Membership_organizationId_id_key` (`organizationId`, `id`);

ALTER TABLE `ReviewTarget`
    ADD UNIQUE INDEX `ReviewTarget_organizationId_id_key` (`organizationId`, `id`);

ALTER TABLE `Assignment`
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `Assignment` SET `updatedAt` = `createdAt`;

ALTER TABLE `Assignment`
    DROP FOREIGN KEY `Assignment_targetId_fkey`,
    DROP FOREIGN KEY `Assignment_reviewerId_fkey`;

ALTER TABLE `Assignment`
    ADD CONSTRAINT `Assignment_target_org_fkey`
        FOREIGN KEY (`organizationId`, `targetId`) REFERENCES `ReviewTarget` (`organizationId`, `id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `Assignment_reviewer_org_fkey`
        FOREIGN KEY (`organizationId`, `reviewerId`) REFERENCES `Membership` (`organizationId`, `id`)
        ON DELETE CASCADE ON UPDATE CASCADE;
