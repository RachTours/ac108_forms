"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useApi } from "../../lib/client-api";
import { formatNumber, type Locale } from "../../lib/locale";
import { formatDate } from "../../lib/date-format";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { withSessionSelector } from "../../lib/session-url";
import { reviewerGroupListResponseSchema } from "@reviewroom/contracts";

type Group = { id: string; name: string; memberCount: number; submissionCount: number; submissionGoal: number };
type Reviewer = { id: string; role: string; status: string; user: { displayName: string; status: string }; group?: { id: string; name: string } | null; submissionGoalOverride?: number | null; formAssignmentsConfigured?: boolean; assignedFormIds?: string[] };
type Submission = { id: string; submittedAt: string; targetName: string; formTitle: string; reviewerName: string };

export function ReviewerGroupsManager({ members, forms, onSaved, compact = false }: { members?: Reviewer[]; forms?: { id: string; title: string }[]; onSaved?: () => void; compact?: boolean }) {
  const api = useApi();
  const t = useTranslations("groups");
  const locale = useLocale() as Locale;
  const session = useWorkspaceSession();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [selected, setSelected] = useState<Group | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Reviewer | null>(null);
  const [groupId, setGroupId] = useState("");
  const [goal, setGoal] = useState("");
  const [formIds, setFormIds] = useState<string[]>([]);
  const [restrictForms, setRestrictForms] = useState(false);
  const [defaultGoal, setDefaultGoal] = useState<number | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const reviewers = (members ?? []).filter((member) => member.role === "REVIEWER" && member.status === "ACTIVE" && member.user.status === "ACTIVE");
  const number = (value: number) => formatNumber(value, locale);

  useEffect(() => {
    if (!editing && !selected) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex='0']") ?? []);
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) { setEditing(null); setSelected(null); }
      if (event.key !== "Tab") return;
      const controls = focusable();
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); previousFocus?.focus(); };
  }, [editing, selected, busy]);

  useEffect(() => {
    let active = true;
    void Promise.all([api("/groups", {}, reviewerGroupListResponseSchema), api<{ data: { submissionGoal: number; activeReviewerCount: number } }>("/progress/summary")]).then(([groupResult, summary]) => {
      if (!active) return;
      setGroups(groupResult.data);
      setDefaultGoal(summary.data.activeReviewerCount ? summary.data.submissionGoal / summary.data.activeReviewerCount : null);
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : t("loadFailed")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, t]);

  async function refresh() {
    const result = await api("/groups", {}, reviewerGroupListResponseSchema);
    setGroups(result.data);
    onSaved?.();
  }
  async function saveGroup(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api(renaming ? `/groups/${renaming}` : "/groups", { method: renaming ? "PATCH" : "POST", body: JSON.stringify({ name: groupName }) });
      setGroupName(""); setRenaming(null); await refresh(); setNotice(t("saved"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("saveFailed")); } finally { setBusy(false); }
  }
  async function remove(group: Group) {
    if (!window.confirm(t("deleteConfirm", { name: group.name }))) return;
    setBusy(true); setError("");
    try { await api(`/groups/${group.id}`, { method: "DELETE" }); if (selected?.id === group.id) setSelected(null); await refresh(); setNotice(t("deleted")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("saveFailed")); } finally { setBusy(false); }
  }
  async function open(group: Group, next?: string) {
    setBusy(true); setError("");
    try {
      const result = await api<{ data: { total: number; submissions: Submission[]; nextCursor: string | null } }>(`/groups/${group.id}/submissions${next ? `?cursor=${encodeURIComponent(next)}` : ""}`);
      setSelected(group); setSubmissions((current) => next ? [...current, ...result.data.submissions] : result.data.submissions); setTotal(result.data.total); setCursor(result.data.nextCursor);
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("loadFailed")); } finally { setBusy(false); }
  }
  function edit(member: Reviewer) {
    setEditing(member); setGroupId(member.group?.id ?? ""); setGoal(member.submissionGoalOverride?.toString() ?? ""); setFormIds(member.assignedFormIds ?? []); setRestrictForms(member.formAssignmentsConfigured ?? false); setError(""); setNotice("");
  }
  async function saveReviewer(event: React.FormEvent) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError("");
    try {
      await api(`/members/${editing.id}`, { method: "PATCH", body: JSON.stringify({ groupId: groupId || null, submissionGoalOverride: goal ? Number(goal) : null, formIds: restrictForms ? formIds : null }) });
      setEditing(null); await refresh(); setNotice(t("saved"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("saveFailed")); } finally { setBusy(false); }
  }

  return <section className="reviewer-groups-section" aria-labelledby="reviewer-groups-heading">
    <div className="section-heading"><div><h2 id="reviewer-groups-heading">{t("title")}</h2><p className="muted-caption">{t("help")}</p></div>{compact && <Link className="button button-small" href={withSessionSelector("/admin/team", session.sessionId)}>{t("manage")}</Link>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    {!compact && <form className="group-create-form" onSubmit={(event) => void saveGroup(event)}><label htmlFor="group-name">{renaming ? t("rename") : t("newGroup")}</label><input id="group-name" required maxLength={100} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder={t("namePlaceholder")} /><button type="submit" className="button button-primary" disabled={busy}>{renaming ? t("save") : t("create")}</button>{renaming && <button type="button" className="button" onClick={() => { setRenaming(null); setGroupName(""); }}>{t("cancel")}</button>}</form>}
    {loading ? <p role="status">{t("loading")}</p> : <div className="group-card-grid">{groups.length === 0 && <div className="panel empty-inline">{t("empty")}</div>}{groups.map((group) => <article className="panel group-card" key={group.id}><h3 dir="auto">{group.name}</h3><p>{t("memberCount", { count: number(group.memberCount) })}</p><strong>{t("submissionCount", { count: number(group.submissionCount) })}</strong><small>{t("goal", { count: number(group.submissionGoal) })}</small><div className="progress-track" role="progressbar" aria-label={group.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={group.submissionGoal ? Math.min(100, group.submissionCount / group.submissionGoal * 100) : 0}><div className="progress-fill" style={{ width: `${group.submissionGoal ? Math.min(100, group.submissionCount / group.submissionGoal * 100) : 0}%` }} /></div><div className="button-row"><button type="button" className="button button-small" disabled={busy} onClick={() => void open(group)}>{t("view")}</button>{!compact && <><button type="button" className="button button-small" disabled={busy} onClick={() => { setRenaming(group.id); setGroupName(group.name); }}>{t("rename")}</button><button type="button" className="button button-small danger-action" disabled={busy} onClick={() => void remove(group)}>{t("delete")}</button></>}</div></article>)}</div>}
    {!compact && <><div className="section-heading"><h3>{t("reviewerSettings")}</h3></div><div className="panel reviewer-settings-list">{reviewers.map((member) => <div className="panel-row" key={member.id}><div className="panel-row-main"><strong dir="auto">{member.user.displayName}</strong><small>{member.group?.name ?? t("ungrouped")} · {t("goal", { count: member.submissionGoalOverride != null ? number(member.submissionGoalOverride) : defaultGoal != null ? number(defaultGoal) : "—" })} · {member.formAssignmentsConfigured ? t("assignedFormsCount", { count: number(member.assignedFormIds?.length ?? 0) }) : t("allForms")}</small></div><button type="button" className="button button-small" onClick={() => edit(member)}>{t("edit")}</button></div>)}</div><p className="help-copy">{t("historyHelp")}</p></>}
    {editing && <div className="group-dialog-backdrop" onClick={() => { if (!busy) setEditing(null); }}><section ref={dialogRef} className="panel group-dialog" role="dialog" aria-modal="true" aria-labelledby="reviewer-settings-title" onClick={(event) => event.stopPropagation()}><h2 id="reviewer-settings-title">{t("reviewerSettings")} · {editing.user.displayName}</h2><form className="settings-panel" onSubmit={(event) => void saveReviewer(event)}><label htmlFor="reviewer-group">{t("group")}</label><select id="reviewer-group" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">{t("ungrouped")}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><label htmlFor="reviewer-goal">{t("personalGoal")}</label><input id="reviewer-goal" type="number" min={1} max={100000} step={1} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={defaultGoal != null ? number(defaultGoal) : ""} /><small>{t("calculatedHelp")}</small><button type="button" className="text-button" onClick={() => setGoal("")}>{t("useCalculated")}</button><label className="group-check"><input type="checkbox" checked={restrictForms} onChange={(event) => setRestrictForms(event.target.checked)} />{t("chooseForms")}</label>{restrictForms ? <fieldset className="group-form-choices"><legend>{t("assignedForms")}</legend>{(forms ?? []).map((form) => <label className="group-check" key={form.id}><input type="checkbox" checked={formIds.includes(form.id)} onChange={(event) => setFormIds((current) => event.target.checked ? [...current, form.id] : current.filter((id) => id !== form.id))} /><span dir="auto">{form.title}</span></label>)}<small>{t("noFormsSelected")}</small></fieldset> : <p className="help-copy">{t("allFormsHelp")}</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button type="submit" className="button button-primary" disabled={busy}>{t("save")}</button><button type="button" className="button" disabled={busy} onClick={() => setEditing(null)}>{t("cancel")}</button></div></form></section></div>}
    {selected && <div className="group-dialog-backdrop" onClick={() => setSelected(null)}><section ref={dialogRef} className="panel group-dialog group-submissions-dialog" role="dialog" aria-modal="true" aria-labelledby="group-submissions-title" onClick={(event) => event.stopPropagation()}><div className="section-heading"><h2 id="group-submissions-title" dir="auto">{selected.name}</h2><button className="button button-small" type="button" onClick={() => setSelected(null)}>{t("close")}</button></div><p>{t("submissionCount", { count: number(total) })}</p><p className="help-copy">{t("onlyThisGroup")}</p><div>{submissions.length ? submissions.map((row) => <Link className="panel-row" key={row.id} href={withSessionSelector(`/admin/submissions/${row.id}`, session.sessionId)}><span className="panel-row-main"><strong dir="auto">{row.targetName}</strong><small dir="auto">{row.formTitle} · {row.reviewerName} · {formatDate(row.submittedAt, locale)}</small></span></Link>) : <p>{t("noSubmissions")}</p>}</div>{cursor && <button type="button" className="button" disabled={busy} onClick={() => void open(selected, cursor)}>{t("loadMore")}</button>}</section></div>}
  </section>;
}
