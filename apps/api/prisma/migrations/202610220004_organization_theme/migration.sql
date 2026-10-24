CREATE TABLE `OrganizationTheme` (
  `id` VARCHAR(36) NOT NULL,
  `organizationId` VARCHAR(36) NOT NULL,
  `accentColor` CHAR(7) NOT NULL DEFAULT '#167354',
  `fontPreset` VARCHAR(16) NOT NULL DEFAULT 'sans',
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `OrganizationTheme_organizationId_key`(`organizationId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OrganizationTheme_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
