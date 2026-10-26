-- Preserve an administrator's explicit None selection during future auto-balancing.
ALTER TABLE `ReviewTarget` ADD COLUMN `assignmentPaused` BOOLEAN NOT NULL DEFAULT false;
