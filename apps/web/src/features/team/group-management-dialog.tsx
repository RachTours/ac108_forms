"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useApi } from "../../lib/client-api";
import { formatNumber, type Locale } from "../../lib/locale";

type Group = { id: string; name: string; submissionGoal: number | null; formIds: string[]; updatedAt?: string | undefined };
type Reviewer = { id: string; user: { displayName: string }; group?: { id: string; name: string } | null; submissionGoalOverride?: number | null };

export function GroupManagementDialog({ group, reviewers, forms, onClose, onSaved }: { group: Group; reviewers: Reviewer[]; forms: { id: string; title: string }[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = useTranslations("groups"), locale = useLocale() as Locale, api = useApi();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(group.name), [goal, setGoal] = useState(group.submissionGoal?.toString() ?? "");
  const [memberIds, setMemberIds] = useState(reviewers.filter((reviewer) => reviewer.group?.id === group.id).map((reviewer) => reviewer.id));
  const [formIds, setFormIds] = useState(group.formIds.filter((id) => forms.some((form) => form.id === id)));
  const [goals, setGoals] = useState<Record<string, string>>(() => Object.fromEntries(reviewers.map((reviewer) => [reviewer.id, reviewer.submissionGoalOverride?.toString() ?? ""])));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  const calculated = memberIds.length && Number(goal) > 0 ? Number(goal) / memberIds.length : null;
  const personalTotal = memberIds.reduce((sum, id) => sum + (goals[id] ? Number(goals[id]) : calculated ?? 0), 0);
  function toggle(values: string[], value: string, selected: boolean) { return selected ? [...values, value] : values.filter((id) => id !== value); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api(`/groups/${group.id}`, { method: "PATCH", body: JSON.stringify({ name, submissionGoal: Number(goal), formIds, reviewerIds: memberIds, reviewerGoals: memberIds.map((reviewerId) => ({ reviewerId, goal: goals[reviewerId] ? Number(goals[reviewerId]) : null })), ...(group.updatedAt ? { expectedUpdatedAt: group.updatedAt } : {}) }) });
      await onSaved(); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("saveFailed")); } finally { setBusy(false); }
  }
  return <dialog ref={ref} className="group-management-dialog" aria-labelledby="group-manage-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="group-management-header"><div><p className="eyebrow">{t("manageGroup")}</p><h2 id="group-manage-title" dir="auto">{group.name}</h2></div><button className="button" type="button" onClick={onClose} disabled={busy}>{t("close")}</button></div>
    <form onSubmit={(event) => void submit(event)}><fieldset disabled={busy} className="group-management-fields">
      <div className="group-basics"><label>{t("groupName")}<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></label><label>{t("groupGoal")}<input value={goal} onChange={(event) => setGoal(event.target.value)} required type="number" min={1} max={100000} step={1} /></label></div>
      <div className="group-management-summary"><strong>{t("memberCount", { count: formatNumber(memberIds.length, locale, 0) })}</strong><span>{t("defaultGoal", { count: calculated === null ? "—" : formatNumber(calculated, locale) })}</span></div>
      <section><h3>{t("assignedForms")}</h3><p className="help-copy">{t("groupFormsHelp")}</p><div className="group-form-choices">{forms.length ? forms.map((form) => <label className="group-check" key={form.id}><input type="checkbox" checked={formIds.includes(form.id)} onChange={(event) => setFormIds((current) => toggle(current, form.id, event.target.checked))} /><span dir="auto">{form.title}</span></label>) : <p>{t("noPublishedForms")}</p>}</div></section>
      <section><h3>{t("membersAndGoals")}</h3><p className="help-copy">{t("groupMembersHelp")}</p><div className="group-member-editor">{reviewers.map((reviewer) => <div className="group-member-edit-row" key={reviewer.id}><label className="group-check"><input type="checkbox" checked={memberIds.includes(reviewer.id)} onChange={(event) => setMemberIds((current) => toggle(current, reviewer.id, event.target.checked))} /><span><strong dir="auto">{reviewer.user.displayName}</strong><small>{reviewer.group?.id && reviewer.group.id !== group.id ? t("moveFrom", { name: reviewer.group.name }) : reviewer.group?.name ?? t("ungrouped")}</small></span></label><label>{t("personalGoal")}<input aria-label={`${t("personalGoal")} · ${reviewer.user.displayName}`} type="number" min={1} max={100000} step={1} disabled={!memberIds.includes(reviewer.id)} value={goals[reviewer.id] ?? ""} placeholder={calculated === null ? t("calculated") : formatNumber(calculated, locale)} onChange={(event) => setGoals((current) => ({ ...current, [reviewer.id]: event.target.value }))} /></label></div>)}</div></section>
      {Math.abs(personalTotal - Number(goal)) > 0.01 && memberIds.length > 0 && <p className="group-goal-note">{t("goalDifference", { personal: formatNumber(personalTotal, locale), group: formatNumber(Number(goal) || 0, locale) })}</p>}
      <p className="help-copy">{t("historicalGroupHelp")}</p>
    </fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="group-management-footer"><button className="button" type="button" onClick={onClose} disabled={busy}>{t("cancel")}</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? t("saving") : t("saveGroup")}</button></div></form>
  </dialog>;
}
