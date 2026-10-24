export type PanelAudience = "admin" | "reviewer";

export function panelNameForAudience(audience: string | null | undefined): string {
  return audience === "reviewer" ? "Reviewer Panel" : "Admin Panel";
}
