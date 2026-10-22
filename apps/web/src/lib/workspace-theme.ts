export const defaultWorkspaceTheme = { accentColor: "#167354", fontPreset: "sans" as const, surfacePreset: "mist" as const, formStyle: "clean" as const };
const allowedAccents = new Set(["#167354", "#2457A6", "#7A3E9D", "#B45309", "#B4233A"]);
const allowedFonts = new Set(["sans", "serif", "system"]);
const allowedSurfaces = new Set(["mist", "warm", "cool"]);
const allowedFormStyles = new Set(["clean", "soft"]);

export function safeWorkspaceTheme(value: unknown) {
  if (!value || typeof value !== "object") return defaultWorkspaceTheme;
  const candidate = value as { accentColor?: unknown; fontPreset?: unknown; surfacePreset?: unknown; formStyle?: unknown };
  return {
    accentColor: typeof candidate.accentColor === "string" && allowedAccents.has(candidate.accentColor) ? candidate.accentColor : defaultWorkspaceTheme.accentColor,
    fontPreset: typeof candidate.fontPreset === "string" && allowedFonts.has(candidate.fontPreset) ? candidate.fontPreset as "sans" | "serif" | "system" : defaultWorkspaceTheme.fontPreset,
    surfacePreset: typeof candidate.surfacePreset === "string" && allowedSurfaces.has(candidate.surfacePreset) ? candidate.surfacePreset as "mist" | "warm" | "cool" : defaultWorkspaceTheme.surfacePreset,
    formStyle: typeof candidate.formStyle === "string" && allowedFormStyles.has(candidate.formStyle) ? candidate.formStyle as "clean" | "soft" : defaultWorkspaceTheme.formStyle,
  };
}

export function workspaceThemeCssVariables(theme: ReturnType<typeof safeWorkspaceTheme>) {
  const fontFamily = theme.fontPreset === "serif" ? 'Georgia, "Times New Roman", serif' : theme.fontPreset === "system" ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const surface = {
    mist: { canvas: "#f4f7f4", softForm: "#f8fbf9", softBorder: "#dfe9e2" },
    warm: { canvas: "#f7f4ef", softForm: "#fbfaf7", softBorder: "#e9e1d6" },
    cool: { canvas: "#f1f5fb", softForm: "#f8faff", softBorder: "#dfe7f3" },
  }[theme.surfacePreset];
  return {
    "--green": theme.accentColor,
    "--green-soft": `color-mix(in srgb, ${theme.accentColor} 11%, white)`,
    "--canvas": surface.canvas,
    "--form-surface": theme.formStyle === "soft" ? surface.softForm : "#ffffff",
    "--form-border": theme.formStyle === "soft" ? surface.softBorder : "#e4e9e5",
    "--sans": fontFamily,
    "--display": fontFamily,
  };
}
