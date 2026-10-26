import type { Metadata } from "next";
import { serverApi } from "../../../src/lib/api";
import { SettingsManager } from "../../../src/features/settings/settings-manager";
import { requireWorkspaceRole } from "../../../src/lib/page-access";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations("metadata"); return { title: t("settings") }; }
type Summary = { targetCount: number; submissionGoal: number; activeReviewerCount: number; completionRule: string; activeTargets: number; completedTargets: number; completionPercent: number };
type Theme = { accentColor: string; fontPreset: "sans" | "serif" | "system"; surfacePreset: "mist" | "warm" | "cool"; formStyle: "clean" | "soft"; updatedAt?: string | null };
export default async function SettingsPage() {
  const t = await getTranslations("settings");
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  let summary: Summary | null = null; let theme: Theme | null = null; let reviewerTheme: Theme | null = null; let failed = false;
  try { const [summaryResponse, themeResponse, reviewerResponse] = await Promise.all([serverApi("/progress/summary"), serverApi("/organization/theme?platform=admin"), serverApi("/organization/theme?platform=reviewer")]); if (!summaryResponse.ok || !themeResponse.ok || !reviewerResponse.ok) throw new Error(); const summaryBody: { data: Summary } = await summaryResponse.json(); const themeBody: { data: Theme } = await themeResponse.json(); const reviewerBody: { data: Theme } = await reviewerResponse.json(); summary = summaryBody.data; theme = themeBody.data; reviewerTheme = reviewerBody.data; } catch { failed = true; }
  return <div className="page-content settings-page"><div className="page-heading"><div><p className="eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p>{t("appearanceHelp")}</p></div></div>{failed || !summary || !theme || !reviewerTheme ? <div className="panel empty-state"><h2>{t("loadFailed")}</h2><p>{t("loadHelp")}</p></div> : <SettingsManager summary={summary} initialTheme={theme} initialReviewerTheme={reviewerTheme} />}</div>;
}
