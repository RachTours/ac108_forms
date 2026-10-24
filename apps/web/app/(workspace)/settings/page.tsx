import type { Metadata } from "next";
import { serverApi } from "../../../src/lib/api";
import { SettingsManager } from "../../../src/features/settings/settings-manager";
import { requireWorkspaceRole } from "../../../src/lib/page-access";

export const metadata: Metadata = { title: "Settings" };
type Summary = { targetCount: number; completionRule: string; activeTargets: number; completedTargets: number; completionPercent: number };
type Theme = { accentColor: string; fontPreset: "sans" | "serif" | "system"; surfacePreset: "mist" | "warm" | "cool"; formStyle: "clean" | "soft"; updatedAt?: string | null };
export default async function SettingsPage() {
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  let summary: Summary | null = null; let theme: Theme | null = null; let failed = false;
  try { const [summaryResponse, themeResponse] = await Promise.all([serverApi("/progress/summary"), serverApi("/organization/theme")]); if (!summaryResponse.ok || !themeResponse.ok) throw new Error(); const summaryBody: { data: Summary } = await summaryResponse.json(); const themeBody: { data: Theme } = await themeResponse.json(); summary = summaryBody.data; theme = themeBody.data; } catch { failed = true; }
  return <div className="page-content settings-page"><div className="page-heading"><div><p className="eyebrow">WORKSPACE SETTINGS</p><h1>Settings</h1><p>Set your review goal and customize the workspace and review form appearance.</p></div></div>{failed || !summary || !theme ? <div className="panel empty-state"><h2>Settings could not load</h2><p>Check your connection and administrator access, then refresh.</p></div> : <SettingsManager summary={summary} initialTheme={theme} />}</div>;
}
