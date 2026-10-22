ALTER TABLE `OrganizationTheme`
  ADD COLUMN `surfacePreset` VARCHAR(16) NOT NULL DEFAULT 'mist',
  ADD COLUMN `formStyle` VARCHAR(16) NOT NULL DEFAULT 'clean';
