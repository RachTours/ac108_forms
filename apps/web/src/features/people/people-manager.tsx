"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Search, UserRound, X } from "lucide-react";
import { paginatedResponseSchema, targetCreateResponseSchema, targetSummarySchema, targetUpdateResponseSchema, targetWriteSchema, type TargetSummary } from "@reviewroom/contracts";
import { useApi } from "../../lib/client-api";
import { useTranslations } from "next-intl";

type Target = Omit<TargetSummary, "createdAt" | "updatedAt"> & Partial<Pick<TargetSummary, "createdAt" | "updatedAt">>;
const targetListResponseSchema = paginatedResponseSchema(targetSummarySchema);

export function PeopleManager({ initialTargets, initialCursor, canManage }: { initialTargets: Target[]; initialCursor: string | null; canManage: boolean }) {
  const api = useApi();
  const t = useTranslations("people");
  const ui = useTranslations("workspaceUi");
  const [targets, setTargets] = useState(initialTargets);
  const [cursor, setCursor] = useState(initialCursor);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const shown = useMemo(() => targets.filter((target) => !normalizedSearch || `${target.displayName} ${target.email ?? ""}`.toLocaleLowerCase().includes(normalizedSearch)), [targets, normalizedSearch]);

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api(`/review-targets?limit=100&cursor=${encodeURIComponent(cursor)}`, {}, targetListResponseSchema);
      setTargets((items) => [...items, ...result.data]);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(ui("moreLoadFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = targetWriteSchema.safeParse({ displayName: name, email });
      if (!payload.success) { setError(ui("invalidPerson")); return; }
      const result = await api("/review-targets", { method: "POST", body: JSON.stringify(payload.data) }, targetCreateResponseSchema);
      setTargets((items) => [...items, result.data].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setName("");
      setEmail("");
      setNotice(ui("addedNotice", { name: result.data.displayName }));
    } catch (err) {
      setError(ui("addFailed"));
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(target: Target) {
    setEditingId(target.id);
    setEditName(target.displayName);
    setEditEmail(target.email ?? "");
    setError("");
    setNotice("");
  }

  async function saveEdit(targetId: string) {
    setBusy(true);
    setError("");
    try {
      const payload = targetWriteSchema.safeParse({ displayName: editName, email: editEmail });
      if (!payload.success) { setError(ui("invalidPerson")); return; }
      const result = await api(`/review-targets/${targetId}`, { method: "PATCH", body: JSON.stringify(payload.data) }, targetUpdateResponseSchema);
      setTargets((items) => items.map((target) => target.id === targetId ? { ...target, ...result.data } : target));
      setEditingId(null);
      setNotice(ui("savedNotice"));
    } catch (err) {
      setError(ui("updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function archive(target: Target) {
    if (!window.confirm(ui("archiveConfirm", { name: target.displayName }))) return;
    setBusy(true);
    setError("");
    try {
      await api(`/review-targets/${target.id}`, { method: "DELETE" });
      setTargets((items) => items.filter((item) => item.id !== target.id));
      setNotice(ui("archivedNotice", { name: target.displayName }));
    } catch (err) {
      setError(ui("archiveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return <div className="people-manager">
    <div className="manager-toolbar">
      <label className="search-box"><Search size={15} /><input aria-label={t("search")} placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" className="icon-button" aria-label={ui("clearSearch")} onClick={() => setSearch("")}><X size={14} /></button>}</label>
      <span className="muted-caption">{cursor ? ui("shownLoadedMore", { shown: shown.length, loaded: targets.length }) : ui("shownLoaded", { shown: shown.length, loaded: targets.length })}</span>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {canManage && <>
      <p className="help-copy">{ui("peopleHelp")}</p>
      <form className="add-person-panel add-person-guided" onSubmit={addTarget}>
        <div className="add-person-heading"><span className="setting-icon"><Plus size={16} /></span><span><strong>{t("addPerson")}</strong><small>{ui("addOnceHelp")}</small></span></div>
        <label className="people-field"><span>{t("fullName")}</span><input required maxLength={160} placeholder={ui("exampleName")} autoComplete="name" aria-label={t("fullName")} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="people-field"><span>{ui("email")} <small>{t("optional")}</small></span><input type="email" maxLength={254} placeholder="name@example.com" autoComplete="email" aria-label={`${ui("email")} (${t("optional")})`} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button className="button button-primary add-person-submit" disabled={busy}><Plus size={13} /> {t("add")}</button>
      </form>
    </>}
    {targets.length === 0 ? <div className="panel empty-state compact-empty"><span className="empty-icon"><UserRound /></span><h2>{ui("noPeopleYet")}</h2><p>{ui("startRecord")}</p></div> : <div className="table-wrap people-target-table"><table><thead><tr><th>{t("person")}</th>{canManage && <th>{t("assignedReviewer")}</th>}<th>{t("responses")}</th>{canManage && <th aria-label={ui("actions")} />}</tr></thead><tbody>
      {shown.map((target) => <tr className={`review-target-row ${canManage ? "managed" : ""}`} key={target.id}>
        <td className="target-person-cell">{editingId === target.id ? <div className="edit-person"><input aria-label={ui("editName")} value={editName} maxLength={160} onChange={(event) => setEditName(event.target.value)} /><input aria-label={ui("editEmail")} type="email" value={editEmail} maxLength={254} onChange={(event) => setEditEmail(event.target.value)} /><button className="icon-button" aria-label={ui("savePerson")} disabled={busy} onClick={() => void saveEdit(target.id)}><span>{ui("savePerson")}</span></button></div> : <div className="person-cell"><span className="avatar avatar-soft">{target.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{target.displayName}</strong><small>{target.email || ui("noEmail")}</small></span></div>}</td>
        {canManage && <td className="target-assignment-cell" data-label={t("assignedReviewer")}>{target.assignedReviewer ? <Link className="assignment-context-link" href={`/admin/team?reviewerId=${encodeURIComponent(target.assignedReviewer.membershipId)}`}><strong>{target.assignedReviewer.displayName}</strong><small>{ui("manageTeam")}</small></Link> : <Link className="assignment-context-link unassigned" href="/admin/team?state=unassigned"><strong>{t("unassigned")}</strong><small>{ui("assignTeam")}</small></Link>}</td>}
        <td className="target-response-cell" data-label={t("responses")}>{target.submissionCount}</td>
        {canManage && <td className="target-actions-cell"><div className="button-row"><button className="icon-button table-action" aria-label={ui("editPerson", { name: target.displayName })} title={ui("editTitle", { name: target.displayName })} disabled={busy} onClick={() => beginEdit(target)}><Pencil size={13} /></button><button className="icon-button table-action" aria-label={ui("archivePerson", { name: target.displayName })} title={ui("archivePerson", { name: target.displayName })} disabled={busy} onClick={() => void archive(target)}><X size={14} /></button></div></td>}
      </tr>)}
      {shown.length === 0 && <tr><td colSpan={canManage ? 4 : 2} className="no-results">{ui("noMatches")}</td></tr>}
    </tbody></table></div>}
    {cursor && <div className="load-more-row"><button className="button button-small" disabled={busy} onClick={() => void loadMore()}>{busy ? ui("loading") : ui("loadMore", { count: targets.length })}</button></div>}
  </div>;
}

