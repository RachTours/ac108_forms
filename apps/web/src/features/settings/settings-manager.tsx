"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Moon, Palette, Save, Sun, Users } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { themeUpdatePayload } from "../../lib/theme-settings";
import { workspaceThemeCssVariables } from "../../lib/workspace-theme";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber, type Locale } from "../../lib/locale";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { withSessionSelector } from "../../lib/session-url";
import { notifyWorkspaceUpdate } from "../../lib/workspace-updates";
import "./settings-manager.css";

type Summary = { targetCount: number; submissionGoal: number; activeReviewerCount: number; completionRule: string; activeTargets: number; completedTargets: number; completionPercent: number; groupWorkflowsEnabled?: boolean; groupGoalTotal?: number };
type Theme = { accentColor: string; fontPreset: "sans" | "serif" | "system"; surfacePreset: "mist" | "warm" | "cool"; formStyle: "clean" | "soft" };
type SettingKey = "appearance";
type Feedback = { kind: "success" | "error"; text: string };

const accentChoices = [{ value: "#167354", label: "Forest" }, { value: "#2457A6", label: "Blue" }, { value: "#7A3E9D", label: "Violet" }, { value: "#B45309", label: "Amber" }, { value: "#B4233A", label: "Berry" }];

export function SettingsManager({ summary, initialTheme, initialReviewerTheme }: { summary: Summary; initialTheme: Theme; initialReviewerTheme: Theme }) {
  const t = useTranslations("settings");
  const platformLabels = useTranslations("platformTheme");
  const locale = useLocale();
  const api = useApi();
  const router = useRouter();
  const session = useWorkspaceSession();
  const [theme, setTheme] = useState<Theme>(() => themeUpdatePayload(initialTheme));
  const [platform, setPlatform] = useState<"admin" | "reviewer">("admin");
  const [appearanceDrafts, setAppearanceDrafts] = useState({ admin: themeUpdatePayload(initialTheme), reviewer: themeUpdatePayload(initialReviewerTheme) });
  function switchPlatform(next: "admin" | "reviewer") {
    if (next === platform) return;
    setAppearanceDrafts((current) => ({ ...current, [platform]: theme }));
    setTheme(appearanceDrafts[next]);
    setPlatform(next);
    setFeedback((current) => ({ ...current, appearance: undefined }));
  }
  const [feedback, setFeedback] = useState<Partial<Record<SettingKey, Feedback | undefined>>>({});
  const [saving, setSaving] = useState<SettingKey | null>(null);

  async function submit(key: SettingKey, action: () => Promise<void>) {
    setSaving(key);
    setFeedback((current) => ({ ...current, [key]: undefined }));
    try {
      await action();
      notifyWorkspaceUpdate(session.organizationId);
      router.refresh();
      setFeedback((current) => ({ ...current, [key]: { kind: "success", text: t("appearanceSaved") } }));
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

  return <div className="settings-grid settings-grid-redesigned settings-manager">
    <section className="panel workspace-setting settings-group-goal" aria-labelledby="group-goal-heading">
      <div className="setting-heading"><span className="setting-icon"><Users size={16} /></span><div><h2 id="group-goal-heading">{t("groupSubmissionGoals")}</h2><p>{t("groupSubmissionGoalsHelp")}</p></div></div>
      <div className="settings-goal-total"><strong>{formatNumber(summary.groupGoalTotal ?? 0, locale as Locale, 0)}</strong><span>{t("submissions")}</span></div>
      <p className="help-copy">{t("groupGoalTotalHelp")}</p>
      <Link className="button" href={withSessionSelector("/admin/team", session.sessionId)}><Users size={14} />{t("manageGroupGoals")}</Link>
    </section>

    <form className="panel workspace-setting appearance-setting" onSubmit={(event) => { event.preventDefault(); void submit("appearance", async () => { const result = await api<{ data: Theme }>(`/organization/theme?platform=${platform}`, { method: "PUT", body: JSON.stringify(themeUpdatePayload(theme)) }); setTheme(themeUpdatePayload(result.data)); setAppearanceDrafts((current) => ({ ...current, [platform]: themeUpdatePayload(result.data) })); }); }}>
      <div className="setting-heading"><span className="setting-icon"><Palette size={16} /></span><div><h2>{t("appearance")}</h2><p>{platformLabels("independentHelp")}</p></div></div>
      <fieldset className="settings-platform-picker" disabled={saving !== null}><legend>{platformLabels("platform")}</legend><div>{(["admin", "reviewer"] as const).map((value) => <label key={value} className={platform === value ? "is-selected" : undefined}><input type="radio" name="appearance-platform" value={value} checked={platform === value} onChange={() => switchPlatform(value)} /><span>{platformLabels(value)}</span></label>)}</div></fieldset>
      <fieldset className="settings-appearance-fields" disabled={saving !== null}>
      <legend className="settings-sr-only">{platformLabels(platform)}</legend>
      <div className="appearance-controls">
        <fieldset className="settings-accent-picker"><legend>{t("brandColor")}</legend><div>{accentChoices.map((choice) => <label key={choice.value} title={t(choice.label.toLowerCase())}><input type="radio" name="theme-color" value={choice.value} checked={theme.accentColor === choice.value} onChange={() => setTheme((current) => ({ ...current, accentColor: choice.value }))} /><span className="settings-accent-swatch" style={{ background: choice.value }}>{theme.accentColor === choice.value && <Check size={18} aria-hidden="true" />}</span><span>{t(choice.label.toLowerCase())}</span></label>)}</div></fieldset>
        <div><label htmlFor="theme-font">{t("typeStyle")}</label><select id="theme-font" value={theme.fontPreset} onChange={(event) => setTheme((current) => ({ ...current, fontPreset: event.target.value as Theme["fontPreset"] }))}><option value="sans">{t("cleanSans")}</option><option value="serif">{t("editorialSerif")}</option><option value="system">{t("systemFont")}</option></select></div>
        <div><label htmlFor="theme-surface">{t("pageBackground")}</label><select id="theme-surface" value={theme.surfacePreset} onChange={(event) => setTheme((current) => ({ ...current, surfacePreset: event.target.value as Theme["surfacePreset"] }))}><option value="mist">{t("softSage")}</option><option value="warm">{t("warmPaper")}</option><option value="cool">{t("coolMist")}</option></select></div>
        <div><label htmlFor="theme-form-style">{t("formAppearance")}</label><select id="theme-form-style" value={theme.formStyle} onChange={(event) => setTheme((current) => ({ ...current, formStyle: event.target.value as Theme["formStyle"] }))}><option value="clean">{t("cleanWhite")}</option><option value="soft">{t("softTinted")}</option></select></div>
      </div>
      </fieldset>
      <div className="settings-preview-heading"><strong>{t("livePreview")}</strong><span>{platformLabels(platform)}</span></div>
      <div className="settings-preview-grid" data-preview-platform={platform}>{(["light", "dark"] as const).map((mode) => <div key={mode} className={`theme-preview settings-theme-preview settings-preview-${mode}`} style={workspaceThemeCssVariables(theme) as React.CSSProperties}>
        <span className="settings-preview-mode">{mode === "light" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}{platformLabels(mode)}</span><strong>Reviewroom</strong><span>{t("previewCopy")}</span><div className="theme-preview-form"><strong>{t("reviewForm")}</strong><span>{t("readableQuestions")}</span><div className="settings-preview-input" aria-hidden="true" /></div><span className="settings-preview-action">{t("sampleAction")}</span>
      </div>)}</div>
      <div className="setting-actions"><button type="submit" className="button button-primary" disabled={saving !== null}><Save size={14} />{saving === "appearance" ? t("saving") : t("saveAppearance")}</button>{status("appearance")}</div>
    </form>
  </div>;
}
