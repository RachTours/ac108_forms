"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useApi } from "../../lib/client-api";
import { formatNumber, type Locale } from "../../lib/locale";
import { formatDate } from "../../lib/date-format";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { withSessionSelector } from "../../lib/session-url";
import { GroupSubmissionDetail } from "./group-submission-detail";
import { GroupManagementDialog } from "./group-management-dialog";
import { notifyWorkspaceUpdate } from "../../lib/workspace-updates";
import { reviewerGroupListResponseSchema } from "@reviewroom/contracts";

type Group = { id: string; name: string; memberCount: number; submissionCount: number; submissionGoal: number | null; formIds: string[]; archivedAt?: string | null | undefined; updatedAt?: string | undefined };
type Reviewer = { id: string; role: string; status: string; user: { displayName: string; status: string }; group?: { id: string; name: string } | null; submissionGoalOverride?: number | null; formAssignmentsConfigured?: boolean; assignedFormIds?: string[] };
type Submission = { id: string; submittedAt: string; targetName: string; reviewedPersonName: string; formTitle: string; reviewerName: string };

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
  const [newGoal, setNewGoal] = useState("50");
  const [managed, setManaged] = useState<Group | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [config, setConfig] = useState({ enabled: false, legacySubmissions: 0, ungroupedReviewers: 0, unconfiguredGroups: 0 });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [selected, setSelected] = useState<Group | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const listScroll = useRef(0);
  const [activationAttempted, setActivationAttempted] = useState(false);
  const activationFeedback = useRef<HTMLDivElement>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "member">("date");
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
    void Promise.all([api(`/groups?state=${showArchived ? "archived" : "active"}`, {}, reviewerGroupListResponseSchema), api<{ data: { submissionGoal: number; activeReviewerCount: number } }>("/progress/summary"), api<{ data: typeof config }>("/groups/config")]).then(([groupResult, summary, settings]) => {
      if (!active) return;
      setGroups(groupResult.data);
      setConfig(settings.data);
      setDefaultGoal(summary.data.activeReviewerCount ? summary.data.submissionGoal / summary.data.activeReviewerCount : null);
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : t("loadFailed")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, t, showArchived]);

  function calculatedGoal(id?: string | null) { const group = groups.find((item) => item.id === id); return config.enabled ? group?.submissionGoal && group.memberCount ? group.submissionGoal / group.memberCount : null : defaultGoal; }
  function effectiveGoal(member: Reviewer) { return member.submissionGoalOverride ?? calculatedGoal(member.group?.id); }
  async function refresh() {
    const [result, settings] = await Promise.all([api(`/groups?state=${showArchived ? "archived" : "active"}`, {}, reviewerGroupListResponseSchema), api<{ data: typeof config }>("/groups/config")]);
    setConfig(settings.data);
    setGroups(result.data);
    onSaved?.();
    notifyWorkspaceUpdate(session.organizationId);
  }
  async function saveGroup(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api(renaming ? `/groups/${renaming}` : "/groups", { method: renaming ? "PATCH" : "POST", body: JSON.stringify({ name: groupName, ...(!renaming ? { submissionGoal: Number(newGoal) } : {}) }) });
      setGroupName(""); setRenaming(null); await refresh(); setNotice(t("saved"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("saveFailed")); } finally { setBusy(false); }
  }
  async function remove(group: Group) {
    if (!window.confirm(t("deleteConfirm", { name: group.name }))) return;
    setBusy(true); setError("");
    try { await api(`/groups/${group.id}`, { method: "DELETE" }); if (selected?.id === group.id) setSelected(null); await refresh(); setNotice(t("deleted")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("saveFailed")); } finally { setBusy(false); }
  }
  async function open(group: Group, next?: string, sort = sortBy) {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ sort }); if (next) params.set("cursor", next);
      const result = await api<{ data: { total: number; submissions: Submission[]; nextCursor: string | null } }>(`/groups/${group.id}/submissions?${params}`);
      if (!next) { setSelectedReviewId(null); listScroll.current = 0; }
      setSelected(group); setSubmissions((current) => next ? [...current, ...result.data.submissions] : result.data.submissions); setTotal(result.data.total); setCursor(result.data.nextCursor);
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("loadFailed")); } finally { setBusy(false); }
  }
  function edit(member: Reviewer) {
    setEditing(member); setGroupId(member.group?.id ?? ""); setGoal(member.submissionGoalOverride?.toString() ?? ""); setFormIds(member.assignedFormIds ?? []); setRestrictForms(member.formAssignmentsConfigured ?? false); setError(""); setNotice("");
  }
  async function saveReviewer(event: React.FormEvent) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError("");
    try {
      await api(`/members/${editing.id}`, { method: "PATCH", body: JSON.stringify({ groupId: groupId || null, submissionGoalOverride: goal ? Number(goal) : null, ...(!config.enabled ? { formIds: restrictForms ? formIds : null } : {}) }) });
      setEditing(null); await refresh(); setNotice(t("saved"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("saveFailed")); } finally { setBusy(false); }
  }

  const setupIncomplete = config.ungroupedReviewers > 0 || config.unconfiguredGroups > 0;
  async function changeSubmissionSort(value: "date" | "member") {
    setSortBy(value);
    if (selected) await open(selected, undefined, value);
  }
  async function activate() {
    if (!config.enabled && setupIncomplete) {
      setActivationAttempted(true); setShowArchived(false);
      window.requestAnimationFrame(() => activationFeedback.current?.focus());
      return;
    }
    if (!window.confirm(t(config.enabled ? "disableConfirm" : "activateConfirm"))) return;
    setBusy(true); setError("");
    try { await api("/groups/config", { method: "POST", body: JSON.stringify({ enabled: !config.enabled, confirmed: true }) }); await refresh(); setActivationAttempted(false); } catch (caught) { setError(caught instanceof Error ? caught.message : t("saveFailed")); } finally { setBusy(false); }
  }
  return <section className="reviewer-groups-section" aria-labelledby="reviewer-groups-heading">
    <div className="section-heading"><div><h2 id="reviewer-groups-heading">{t("title")}</h2><p className="muted-caption">{t("help")}</p></div>{compact && <Link className="button button-small" href={withSessionSelector("/admin/team", session.sessionId)}>{t("manage")}</Link>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    {!compact && <div className="group-activation-panel"><div><strong>{t(config.enabled ? "groupModeActive" : "groupModePreview")}</strong><p id="group-activation-purpose">{t("activationPurpose")}</p><small>{t("legacyCount", { count: number(config.legacySubmissions) })}</small></div>
      <div className="button-row"><button className="button" type="button" onClick={() => setShowArchived((value) => !value)}>{t(showArchived ? "activeGroups" : "archivedGroups")}</button><button className="button button-primary" type="button" disabled={busy || loading} aria-busy={busy || loading} aria-describedby="group-activation-purpose" onClick={() => void activate()}>{t(config.enabled ? "disableGroups" : "activateGroups")}</button></div>
      {!config.enabled && setupIncomplete && <div ref={activationFeedback} id="group-activation-readiness" tabIndex={-1} className="group-readiness" role={activationAttempted ? "alert" : "status"}><strong>{t("activationBlocked")}</strong><ul>
        {config.unconfiguredGroups > 0 && <li>{t("missingGroupGoals", { count: number(config.unconfiguredGroups) })}</li>}
        {config.ungroupedReviewers > 0 && <li>{t("missingReviewerGroups", { count: number(config.ungroupedReviewers) })}</li>}
      </ul>{activationAttempted && <div className="group-readiness-actions">{groups.filter((group) => !group.archivedAt && group.submissionGoal === null).map((group) => <button className="button button-small" type="button" key={group.id} onClick={() => setManaged(group)}>{t("configureNamedGroup", { name: group.name })}</button>)}{reviewers.filter((member) => !member.group).map((member) => <button className="button button-small" type="button" key={member.id} onClick={() => edit(member)}>{t("assignNamedReviewer", { name: member.user.displayName })}</button>)}</div>}</div>}
    </div>}
    {!compact && !showArchived && <form className="group-create-form" onSubmit={(event) => void saveGroup(event)}>
      <label className="group-create-name" htmlFor="group-name"><span>{renaming ? t("rename") : t("newGroup")}</span><input id="group-name" required maxLength={100} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder={t("namePlaceholder")} /></label>
      {!renaming && <label className="group-create-goal" htmlFor="new-group-goal"><span>{t("groupGoal")}</span><input id="new-group-goal" type="number" min={1} max={100000} step={1} required value={newGoal} onChange={(event) => setNewGoal(event.target.value)} /></label>}
      <button type="submit" className="button button-primary" disabled={busy}>{renaming ? t("save") : t("create")}</button>
      {renaming && <button type="button" className="button" onClick={() => { setRenaming(null); setGroupName(""); }}>{t("cancel")}</button>}
    </form>}
    {loading ? <p role="status">{t("loading")}</p> : <div className="group-card-grid">{groups.length === 0 && <div className="panel empty-inline">{t("empty")}</div>}{groups.map((group) => { const percent = group.submissionGoal ? Math.min(100, Math.round(group.submissionCount / group.submissionGoal * 100)) : null; return <article className="panel group-card" key={group.id}><h3 dir="auto">{group.name}</h3><p>{t("memberCount", { count: number(group.memberCount) })}</p><strong>{t(group.archivedAt ? "recordedSubmissionCount" : "submissionCount", { count: number(group.submissionCount) })}</strong><small>{group.submissionGoal === null ? t("goalNotConfigured") : t("goal", { count: number(group.submissionGoal) })}</small><div className="progress-track" role="progressbar" aria-label={group.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? 0}><div className="progress-fill" style={{ width: `${percent ?? 0}%` }} /></div>{percent !== null && <small className="group-progress-percent">{number(percent)}%</small>}<div className="button-row"><button type="button" className="button button-small" disabled={busy} onClick={() => void open(group)}>{t("view")}</button>{!compact && !group.archivedAt && <><button type="button" className="button button-small" disabled={busy} onClick={() => setManaged(group)}>{t("manageGroup")}</button><button type="button" className="button button-small danger-action" disabled={busy} onClick={() => void remove(group)} title={t("removeHelp")} aria-label={t("removeNamedGroup", { name: group.name })}>{t("removeGroup")}</button></>}</div></article>; })}</div>}
    {!compact && !showArchived && <><div className="section-heading"><h3>{t("reviewerSettings")}</h3></div><div className="panel reviewer-settings-list">{reviewers.map((member) => <div className="panel-row" key={member.id}><div className="panel-row-main"><strong dir="auto">{member.user.displayName}</strong><small>{member.group?.name ?? t("ungrouped")} · {t("goal", { count: effectiveGoal(member) != null ? number(effectiveGoal(member)!) : "—" })} · {config.enabled ? t("assignedFormsCount", { count: number(groups.find((group) => group.id === member.group?.id)?.formIds.length ?? 0) }) : member.formAssignmentsConfigured ? t("assignedFormsCount", { count: number(member.assignedFormIds?.length ?? 0) }) : t("allForms")}</small></div><button type="button" className="button button-small" onClick={() => edit(member)}>{t("edit")}</button></div>)}</div><p className="help-copy">{t("historyHelp")}</p></>}
    {managed && <GroupManagementDialog group={managed} reviewers={reviewers} forms={forms ?? []} onClose={() => setManaged(null)} onSaved={refresh} />}
    {editing && <div className="group-dialog-backdrop" onClick={() => { if (!busy) setEditing(null); }}><section ref={dialogRef} className="panel group-dialog" role="dialog" aria-modal="true" aria-labelledby="reviewer-settings-title" onClick={(event) => event.stopPropagation()}><h2 id="reviewer-settings-title">{t("reviewerSettings")} · {editing.user.displayName}</h2><form className="settings-panel" onSubmit={(event) => void saveReviewer(event)}><label htmlFor="reviewer-group">{t("group")}</label><select id="reviewer-group" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">{t("ungrouped")}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><label htmlFor="reviewer-goal">{t("personalGoal")}</label><input id="reviewer-goal" type="number" min={1} max={100000} step={1} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={calculatedGoal(groupId) != null ? number(calculatedGoal(groupId)!) : ""} /><small>{t("calculatedHelp")}</small><button type="button" className="text-button" onClick={() => setGoal("")}>{t("useCalculated")}</button>{!config.enabled && <><label className="group-check"><input type="checkbox" checked={restrictForms} onChange={(event) => setRestrictForms(event.target.checked)} />{t("chooseForms")}</label>{restrictForms ? <fieldset className="group-form-choices"><legend>{t("assignedForms")}</legend>{(forms ?? []).map((form) => <label className="group-check" key={form.id}><input type="checkbox" checked={formIds.includes(form.id)} onChange={(event) => setFormIds((current) => event.target.checked ? [...current, form.id] : current.filter((id) => id !== form.id))} /><span dir="auto">{form.title}</span></label>)}<small>{t("noFormsSelected")}</small></fieldset> : <p className="help-copy">{t("allFormsHelp")}</p>}</>}{config.enabled && <p className="help-copy">{t("groupFormsApply")}</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button type="submit" className="button button-primary" disabled={busy}>{t("save")}</button><button type="button" className="button" disabled={busy} onClick={() => setEditing(null)}>{t("cancel")}</button></div></form></section></div>}
    {selected && <div className="group-dialog-backdrop" onClick={() => setSelected(null)}><section ref={dialogRef} className="panel group-dialog group-submissions-dialog" role="dialog" aria-modal="true" aria-labelledby="group-submissions-title" onClick={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2 id="group-submissions-title" dir="auto">{selected.name}</h2><button className="button button-small" type="button" onClick={() => setSelected(null)}>{t("close")}</button></div>
      {selectedReviewId ? <GroupSubmissionDetail submissionId={selectedReviewId} onBack={() => { const id = selectedReviewId; setSelectedReviewId(null); window.requestAnimationFrame(() => { dialogRef.current?.scrollTo({ top: listScroll.current }); document.getElementById(`group-review-${id}`)?.focus({ preventScroll: true }); }); }} /> : <>
        <p>{t("submissionCount", { count: number(total) })}</p><p className="help-copy">{t(selected.archivedAt ? "recordedGroupHistory" : "onlyThisGroup")}</p>
        <label className="group-history-sort"><span>{t("sortBy")}</span><select value={sortBy} onChange={(event) => void changeSubmissionSort(event.target.value as "date" | "member")} disabled={busy}><option value="date">{t("sortByDate")}</option><option value="member">{t("sortByMember")}</option></select></label>
        <div>{submissions.length ? submissions.map((row) => <button type="button" className="panel-row group-review-trigger" id={`group-review-${row.id}`} key={row.id} onClick={() => { listScroll.current = dialogRef.current?.scrollTop ?? 0; setSelectedReviewId(row.id); }}><span className="panel-row-main"><strong dir="auto">{row.reviewedPersonName || row.targetName}</strong><small dir="auto">{t("submittedBy", { name: row.reviewerName })} · {row.formTitle} · {formatDate(row.submittedAt, locale)}</small></span></button>) : <p>{t("noSubmissions")}</p>}</div>
        {cursor && <button type="button" className="button" disabled={busy} onClick={() => void open(selected, cursor)}>{t("loadMore")}</button>}
      </>}
    </section></div>}
  </section>;
}
