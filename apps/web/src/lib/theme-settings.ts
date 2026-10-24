export type ThemeUpdateInput = { accentColor: string; fontPreset: "sans" | "serif" | "system"; surfacePreset: "mist" | "warm" | "cool"; formStyle: "clean" | "soft" };

export function themeUpdatePayload(value: ThemeUpdateInput): ThemeUpdateInput {
  return { accentColor: value.accentColor, fontPreset: value.fontPreset, surfacePreset: value.surfacePreset, formStyle: value.formStyle };
}
