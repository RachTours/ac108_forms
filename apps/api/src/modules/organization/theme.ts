import { z } from "zod";

export const themeAccentColors = ["#167354", "#2457A6", "#7A3E9D", "#B45309", "#B4233A"] as const;

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

export function contrastRatioAgainstWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

export const themeSchema = z.object({
  accentColor: z.enum(themeAccentColors).refine((color) => contrastRatioAgainstWhite(color) >= 4.5),
  fontPreset: z.enum(["sans", "serif", "system"]),
  surfacePreset: z.enum(["mist", "warm", "cool"]),
  formStyle: z.enum(["clean", "soft"]),
}).strict();

export type WorkspaceTheme = z.infer<typeof themeSchema>;

export const defaultWorkspaceTheme: WorkspaceTheme = { accentColor: "#167354", fontPreset: "sans", surfacePreset: "mist", formStyle: "clean" };

export function resolvePlatformTheme(record: unknown, platform: "admin" | "reviewer"): WorkspaceTheme {
  const row = record && typeof record === "object" ? record as Record<string, unknown> : {};
  const selected = themeSchema.safeParse(row[platform === "admin" ? "adminAppearance" : "reviewerAppearance"]);
  if (selected.success) return selected.data;
  const legacy = themeSchema.safeParse({ accentColor: row.accentColor, fontPreset: row.fontPreset, surfacePreset: row.surfacePreset, formStyle: row.formStyle });
  return legacy.success ? legacy.data : defaultWorkspaceTheme;
}

export function themeCssVariables(theme: WorkspaceTheme) {
  const font = theme.fontPreset === "serif"
    ? 'Georgia, "Times New Roman", serif'
    : theme.fontPreset === "system"
      ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      : 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const surfaces = {
    mist: { canvasColor: "#f4f7f4", softForm: "#f8fbf9", softBorder: "#dfe9e2" },
    warm: { canvasColor: "#f7f4ef", softForm: "#fbfaf7", softBorder: "#e9e1d6" },
    cool: { canvasColor: "#f1f5fb", softForm: "#f8faff", softBorder: "#dfe7f3" },
  } as const;
  const surface = surfaces[theme.surfacePreset];
  return { accentColor: theme.accentColor, fontFamily: font, canvasColor: surface.canvasColor, formSurface: theme.formStyle === "soft" ? surface.softForm : "#ffffff", formBorder: theme.formStyle === "soft" ? surface.softBorder : "#e4e9e5" };
}
