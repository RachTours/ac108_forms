ALTER TABLE `Membership` ADD COLUMN `passwordHash` VARCHAR(255) NULL;

UPDATE `Membership` AS m
INNER JOIN `User` AS u ON u.`id` = m.`userId`
SET m.`passwordHash` = u.`passwordHash`;

ALTER TABLE `Membership` MODIFY `passwordHash` VARCHAR(255) NOT NULL;
ALTER TABLE `User` DROP COLUMN `passwordHash`;
