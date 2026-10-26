"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, Save, Target } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { themeUpdatePayload } from "../../lib/theme-settings";
import { workspaceThemeCssVariables } from "../../lib/workspace-theme";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber, type Locale } from "../../lib/locale";

type Summary = { targetCount: number; submissionGoal: number; activeReviewerCount: number; completionRule: string; activeTargets: number; completedTargets: number; completionPercent: number };
type Theme = { accentColor: string; fontPreset: "sans" | "serif" | "system"; surfacePreset: "mist" | "warm" | "cool"; formStyle: "clean" | "soft" };
type SettingKey = "progress" | "submission" | "appearance";
type Feedback = { kind: "success" | "error"; text: string };

const accentChoices = [{ value: "#167354", label: "Forest" }, { value: "#2457A6", label: "Blue" }, { value: "#7A3E9D", label: "Violet" }, { value: "#B45309", label: "Amber" }, { value: "#B4233A", label: "Berry" }];

export function SettingsManager({ summary, initialTheme, initialReviewerTheme }: { summary: Summary; initialTheme: Theme; initialReviewerTheme: Theme }) {
  const t = useTranslations("settings");
  const platformLabels = useTranslations("platformTheme");
  const locale = useLocale();
  const api = useApi();
  const router = useRouter();
  const [targetCount, setTargetCount] = useState(summary.targetCount);
  const [submissionGoal, setSubmissionGoal] = useState(summary.submissionGoal);
  const [theme, setTheme] = useState<Theme>(() => themeUpdatePayload(initialTheme));
  const [platform, setPlatform] = useState<"admin" | "reviewer">("admin");
  const [appearanceDrafts, setAppearanceDrafts] = useState({ admin: themeUpdatePayload(initialTheme), reviewer: themeUpdatePayload(initialReviewerTheme) });
  function switchPlatform(next: "admin" | "reviewer") {
    setAppearanceDrafts((current) => ({ ...current, [platform]: theme }));
    setTheme(appearanceDrafts[next]);
    setPlatform(next);
  }
  const [feedback, setFeedback] = useState<Partial<Record<SettingKey, Feedback>>>({});
  const [saving, setSaving] = useState<SettingKey | null>(null);

  async function submit(key: SettingKey, action: () => Promise<void>) {
    setSaving(key);
    setFeedback((current) => ({ ...current, [key]: undefined }));
    try {
      await action();
      setFeedback((current) => ({ ...current, [key]: { kind: "success", text: key === "progress" ? t("peopleGoalSaved") : key === "submission" ? t("submissionGoalSaved") : t("appearanceSaved") } }));
    } catch (caught) {
      setFeedback((current) => ({ ...current, [key]: { kind: "error", text: caught instanceof Error ? caught.message : t("saveFailed") } }));
    } finally {
      setSaving(null);
    }
  }

  function status(key: SettingKey) {
    const item = feedback[key];
    return item ? <p className={item.kind === "error" ? "form-error settings-status" : "success-message settings-status"} role={item.kind === "error" ? "alert" : "status"}>{item.text}</p> : null;
  }

  return <div className="settings-grid settings-grid-redesigned">
    <form className="panel workspace-setting" onSubmit={(event) => { event.preventDefault(); void submit("progress", async () => { await api("/progress/config", { method: "PATCH", body: JSON.stringify({ targetCount, completionRule: "ONE_RESPONSE" }) }); }); }}>
      <div className="setting-heading"><span className="setting-icon"><Target size={16} /></span><div><h2>{t("reviewGoal")}</h2><p>{t("reviewGoalHelp")}</p></div></div>
      <label htmlFor="target-count">{t("peopleInReview")}</label><div className="goal-input"><input id="target-count" type="number" min={0} max={100000} value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))} /><span>{t("people")}</span></div>
      <div className="rule-summary"><strong>{t("completionRule")}</strong><span>{t("completionHelp")}</span></div>
      <div className="setting-actions"><button type="submit" className="button button-primary" disabled={saving !== null}><Save size={14} />{saving === "progress" ? t("saving") : t("saveGoal")}</button>{status("progress")}</div>
    </form>

    <form className="panel workspace-setting" onSubmit={(event) => { event.preventDefault(); void submit("submission", async () => { await api("/progress/config", { method: "PATCH", body: JSON.stringify({ submissionGoal, completionRule: "ONE_RESPONSE" }) }); router.refresh(); }); }}>
      <div className="setting-heading"><span className="setting-icon"><Target size={16} /></span><div><h2>{t("workspaceSubmissionGoal")}</h2><p>{t("submissionGoalHelp")}</p></div></div>
      <label htmlFor="submission-goal">{t("totalSubmissions")}</label><div className="goal-input"><input id="submission-goal" type="number" min={1} max={100000} value={submissionGoal} onChange={(event) => setSubmissionGoal(Number(event.target.value))} /><span>{t("submissions")}</span></div>
      <div className="rule-summary"><strong>{t("sharedReviewerGoal")}</strong><span>{summary.activeReviewerCount === 0 ? t("reviewerGoalNoActive") : t("reviewerGoalCalculation", { goal: formatNumber(submissionGoal, locale as Locale, 0), reviewers: formatNumber(summary.activeReviewerCount, locale as Locale, 0), perReviewer: formatNumber(submissionGoal / summary.activeReviewerCount, locale as Locale) })}</span></div>
      <div className="setting-actions"><button type="submit" className="button button-primary" disabled={saving !== null}><Save size={14} />{saving === "submission" ? t("saving") : t("saveSubmissionGoal")}</button>{status("submission")}</div>
    </form>

    <form className="panel workspace-setting appearance-setting" onSubmit={(event) => { event.preventDefault(); void submit("appearance", async () => { const result = await api<{ data: Theme }>(`/organization/theme?platform=${platform}`, { method: "PUT", body: JSON.stringify(themeUpdatePayload(theme)) }); setTheme(themeUpdatePayload(result.data)); setAppearanceDrafts((current) => ({ ...current, [platform]: themeUpdatePayload(result.data) })); router.refresh(); }); }}>
      <div className="setting-heading"><span className="setting-icon"><Palette size={16} /></span><div><h2>{t("appearance")}</h2><p>{t("appearanceHelp")}</p></div></div>
      <label htmlFor="appearance-platform">{platformLabels("platform")}</label><select id="appearance-platform" value={platform} disabled={saving !== null} onChange={(event) => switchPlatform(event.target.value as "admin" | "reviewer")}><option value="admin">{platformLabels("admin")}</option><option value="reviewer">{platformLabels("reviewer")}</option></select><p className="help-copy">{platformLabels("independentHelp")}</p>
      <div className="appearance-controls">
        <div><label htmlFor="theme-color">{t("brandColor")}</label><select id="theme-color" value={theme.accentColor} onChange={(event) => setTheme((current) => ({ ...current, accentColor: event.target.value }))}>{accentChoices.map((choice) => <option value={choice.value} key={choice.value}>{t(choice.label.toLowerCase())}</option>)}</select></div>
        <div><label htmlFor="theme-font">{t("typeStyle")}</label><select id="theme-font" value={theme.fontPreset} onChange={(event) => setTheme((current) => ({ ...current, fontPreset: event.target.value as Theme["fontPreset"] }))}><option value="sans">{t("cleanSans")}</option><option value="serif">{t("editorialSerif")}</option><option value="system">{t("systemFont")}</option></select></div>
        <div><label htmlFor="theme-surface">{t("pageBackground")}</label><select id="theme-surface" value={theme.surfacePreset} onChange={(event) => setTheme((current) => ({ ...current, surfacePreset: event.target.value as Theme["surfacePreset"] }))}><option value="mist">{t("softSage")}</option><option value="warm">{t("warmPaper")}</option><option value="cool">{t("coolMist")}</option></select></div>
        <div><label htmlFor="theme-form-style">{t("formAppearance")}</label><select id="theme-form-style" value={theme.formStyle} onChange={(event) => setTheme((current) => ({ ...current, formStyle: event.target.value as Theme["formStyle"] }))}><option value="clean">{t("cleanWhite")}</option><option value="soft">{t("softTinted")}</option></select></div>
      </div>
      <div className="theme-preview" style={workspaceThemeCssVariables(theme) as React.CSSProperties}><span className="eyebrow">{t("livePreview")}</span><strong>Reviewroom</strong><span>{t("previewCopy")}</span><div className="theme-preview-form"><strong>{t("reviewForm")}</strong><span>{t("readableQuestions")}</span></div><button type="button" className="button button-primary" tabIndex={-1}>{t("sampleAction")}</button></div>
      <div className="setting-actions"><button type="submit" className="button button-primary" disabled={saving !== null}><Save size={14} />{saving === "appearance" ? t("saving") : t("saveAppearance")}</button>{status("appearance")}</div>
    </form>
  </div>;
}
