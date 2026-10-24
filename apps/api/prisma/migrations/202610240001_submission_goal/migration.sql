ALTER TABLE `ProgressConfig`
  ADD COLUMN `submissionGoal` INTEGER NOT NULL DEFAULT 50;

UPDATE `ProgressConfig`
  SET `submissionGoal` = `targetCount`
  WHERE `targetCount` > 0;
