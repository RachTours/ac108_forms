ALTER TABLE `Invitation`
  ADD COLUMN `encryptedToken` TEXT NULL;

ALTER TABLE `ReviewLink`
  ADD COLUMN `encryptedToken` TEXT NULL;
