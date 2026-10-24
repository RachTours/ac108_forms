"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, Save, Target } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { themeUpdatePayload } from "../../lib/theme-settings";
import { workspaceThemeCssVariables } from "../../lib/workspace-theme";
import { formatReviewerSubmissionGoal } from "./reviewer-submission-goal";

type Summary = { targetCount: number; submissionGoal: number; activeReviewerCount: number; completionRule: string; activeTargets: number; completedTargets: number; completionPercent: number };
type Theme = { accentColor: string; fontPreset: "sans" | "serif" | "system"; surfacePreset: "mist" | "warm" | "cool"; formStyle: "clean" | "soft" };
type SettingKey = "progress" | "submission" | "appearance";
type Feedback = { kind: "success" | "error"; text: string };

const accentChoices = [{ value: "#167354", label: "Forest" }, { value: "#2457A6", label: "Blue" }, { value: "#7A3E9D", label: "Violet" }, { value: "#B45309", label: "Amber" }, { value: "#B4233A", label: "Berry" }];

export function SettingsManager({ summary, initialTheme }: { summary: Summary; initialTheme: Theme }) {
  const api = useApi();
  const router = useRouter();
  const [targetCount, setTargetCount] = useState(summary.targetCount);
  const [submissionGoal, setSubmissionGoal] = useState(summary.submissionGoal);
  const [theme, setTheme] = useState<Theme>(() => themeUpdatePayload(initialTheme));
  const [feedback, setFeedback] = useState<Partial<Record<SettingKey, Feedback>>>({});
  const [saving, setSaving] = useState<SettingKey | null>(null);

  async function submit(key: SettingKey, action: () => Promise<void>) {
    setSaving(key);
    setFeedback((current) => ({ ...current, [key]: undefined }));
    try {
      await action();
      setFeedback((current) => ({ ...current, [key]: { kind: "success", text: key === "progress" ? "People goal saved." : key === "submission" ? "Submission goal saved." : "Appearance saved for your workspace." } }));
    } catch (caught) {
      setFeedback((current) => ({ ...current, [key]: { kind: "error", text: caught instanceof Error ? caught.message : "Changes could not be saved. Try again." } }));
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
      <div className="setting-heading"><span className="setting-icon"><Target size={16} /></span><div><h2>Review goal</h2><p>Choose how many people are included in this review cycle.</p></div></div>
      <label htmlFor="target-count">People in this review</label><div className="goal-input"><input id="target-count" type="number" min={0} max={100000} value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))} /><span>people</span></div>
      <div className="rule-summary"><strong>How completion is counted</strong><span>A person is complete after at least one submitted review. This goal counts people, not submissions.</span></div>
      <div className="setting-actions"><button type="submit" className="button button-primary" disabled={saving !== null}><Save size={14} />{saving === "progress" ? "Saving…" : "Save goal"}</button>{status("progress")}</div>
    </form>

    <form className="panel workspace-setting" onSubmit={(event) => { event.preventDefault(); void submit("submission", async () => { await api("/progress/config", { method: "PATCH", body: JSON.stringify({ submissionGoal, completionRule: "ONE_RESPONSE" }) }); router.refresh(); }); }}>
      <div className="setting-heading"><span className="setting-icon"><Target size={16} /></span><div><h2>Workspace submission goal</h2><p>Set the total number of active feedback submissions for this workspace.</p></div></div>
      <label htmlFor="submission-goal">Total submissions</label><div className="goal-input"><input id="submission-goal" type="number" min={1} max={100000} value={submissionGoal} onChange={(event) => setSubmissionGoal(Number(event.target.value))} /><span>submissions</span></div>
      <div className="rule-summary"><strong>Shared reviewer goal</strong><span>{formatReviewerSubmissionGoal(submissionGoal, summary.activeReviewerCount)}</span></div>
      <div className="setting-actions"><button type="submit" className="button button-primary" disabled={saving !== null}><Save size={14} />{saving === "submission" ? "Saving…" : "Save submission goal"}</button>{status("submission")}</div>
    </form>

    <form className="panel workspace-setting appearance-setting" onSubmit={(event) => { event.preventDefault(); void submit("appearance", async () => { const result = await api<{ data: Theme }>("/organization/theme", { method: "PUT", body: JSON.stringify(themeUpdatePayload(theme)) }); setTheme(themeUpdatePayload(result.data)); router.refresh(); }); }}>
      <div className="setting-heading"><span className="setting-icon"><Palette size={16} /></span><div><h2>Workspace appearance</h2><p>Choose the shared brand color and type style for the admin panel, reviewer panel, form editor, and public forms.</p></div></div>
      <div className="appearance-controls">
        <div><label htmlFor="theme-color">Brand color</label><select id="theme-color" value={theme.accentColor} onChange={(event) => setTheme((current) => ({ ...current, accentColor: event.target.value }))}>{accentChoices.map((choice) => <option value={choice.value} key={choice.value}>{choice.label}</option>)}</select></div>
        <div><label htmlFor="theme-font">Type style</label><select id="theme-font" value={theme.fontPreset} onChange={(event) => setTheme((current) => ({ ...current, fontPreset: event.target.value as Theme["fontPreset"] }))}><option value="sans">Clean sans serif</option><option value="serif">Editorial serif</option><option value="system">Device system font</option></select></div>
        <div><label htmlFor="theme-surface">Page background</label><select id="theme-surface" value={theme.surfacePreset} onChange={(event) => setTheme((current) => ({ ...current, surfacePreset: event.target.value as Theme["surfacePreset"] }))}><option value="mist">Soft sage</option><option value="warm">Warm paper</option><option value="cool">Cool mist</option></select></div>
        <div><label htmlFor="theme-form-style">Form appearance</label><select id="theme-form-style" value={theme.formStyle} onChange={(event) => setTheme((current) => ({ ...current, formStyle: event.target.value as Theme["formStyle"] }))}><option value="clean">Clean white</option><option value="soft">Soft tinted</option></select></div>
      </div>
      <div className="theme-preview" style={workspaceThemeCssVariables(theme) as React.CSSProperties}><span className="eyebrow">LIVE PREVIEW</span><strong>Reviewroom</strong><span>Preview of workspace pages and reviewer forms.</span><div className="theme-preview-form"><strong>Review form</strong><span>Readable questions on your selected surface.</span></div><button type="button" className="button button-primary" tabIndex={-1}>Sample action</button></div>
      <div className="setting-actions"><button type="submit" className="button button-primary" disabled={saving !== null}><Save size={14} />{saving === "appearance" ? "Saving…" : "Save appearance"}</button>{status("appearance")}</div>
    </form>
  </div>;
}
