"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Search, UserRound, X } from "lucide-react";
import { paginatedResponseSchema, targetCreateResponseSchema, targetSummarySchema, targetUpdateResponseSchema, targetWriteSchema, type TargetSummary } from "@reviewroom/contracts";
import { useApi } from "../../lib/client-api";

type Target = Omit<TargetSummary, "createdAt" | "updatedAt"> & Partial<Pick<TargetSummary, "createdAt" | "updatedAt">>;
const targetListResponseSchema = paginatedResponseSchema(targetSummarySchema);

export function PeopleManager({ initialTargets, initialCursor, canManage }: { initialTargets: Target[]; initialCursor: string | null; canManage: boolean }) {
  const api = useApi();
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
      setError(err instanceof Error ? err.message : "More people could not be loaded.");
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
      if (!payload.success) { setError("Enter a name and a valid email address, or leave the email blank."); return; }
      const result = await api("/review-targets", { method: "POST", body: JSON.stringify(payload.data) }, targetCreateResponseSchema);
      setTargets((items) => [...items, result.data].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setName("");
      setEmail("");
      setNotice(result.data.assignedReviewer
        ? `${result.data.displayName} added and assigned to ${result.data.assignedReviewer.displayName}.`
        : `${result.data.displayName} added. No active reviewers are available, so they are waiting for assignment.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this person.");
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
      if (!payload.success) { setError("Enter a name and a valid email address, or leave the email blank."); return; }
      const result = await api(`/review-targets/${targetId}`, { method: "PATCH", body: JSON.stringify(payload.data) }, targetUpdateResponseSchema);
      setTargets((items) => items.map((target) => target.id === targetId ? { ...target, ...result.data } : target));
      setEditingId(null);
      setNotice("Person details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Person could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(target: Target) {
    if (!window.confirm(`Archive ${target.displayName}? Their existing reviews will remain in submissions.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/review-targets/${target.id}`, { method: "DELETE" });
      setTargets((items) => items.filter((item) => item.id !== target.id));
      setNotice(`${target.displayName} archived.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive this person.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="people-manager">
    <div className="manager-toolbar">
      <label className="search-box"><Search size={15} /><input aria-label="Search people by name or email" placeholder="Search people by name or email" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
      <span className="muted-caption">{shown.length} shown · {targets.length} loaded{cursor ? "+" : ""}</span>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {canManage && <>
      <p className="help-copy">Add, update, archive, and review the submission history for people in this workspace.</p>
      <form className="add-person-panel add-person-guided" onSubmit={addTarget}>
        <div className="add-person-heading"><span className="setting-icon"><Plus size={16} /></span><span><strong>Add a person</strong><small>Add each person once to keep their review history together.</small></span></div>
        <label className="people-field"><span>Full name</span><input required maxLength={160} placeholder="e.g. Alex Morgan" autoComplete="name" aria-label="Full name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="people-field"><span>Email <small>Optional</small></span><input type="email" maxLength={254} placeholder="name@example.com" autoComplete="email" aria-label="Email (optional)" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button className="button button-primary add-person-submit" disabled={busy}><Plus size={13} /> Add person</button>
      </form>
    </>}
    {targets.length === 0 ? <div className="panel empty-state compact-empty"><span className="empty-icon"><UserRound /></span><h2>No people yet</h2><p>Add a person to start a review record.</p></div> : <div className="table-wrap people-target-table"><table><thead><tr><th>Person</th>{canManage && <th>Assigned reviewer</th>}<th>Responses</th>{canManage && <th aria-label="Actions" />}</tr></thead><tbody>
      {shown.map((target) => <tr className={`review-target-row ${canManage ? "managed" : ""}`} key={target.id}>
        <td className="target-person-cell">{editingId === target.id ? <div className="edit-person"><input aria-label="Edit name" value={editName} maxLength={160} onChange={(event) => setEditName(event.target.value)} /><input aria-label="Edit email" type="email" value={editEmail} maxLength={254} onChange={(event) => setEditEmail(event.target.value)} /><button className="icon-button" aria-label="Save person" disabled={busy} onClick={() => void saveEdit(target.id)}><span>Save</span></button></div> : <div className="person-cell"><span className="avatar avatar-soft">{target.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{target.displayName}</strong><small>{target.email || "No email added"}</small></span></div>}</td>
        {canManage && <td className="target-assignment-cell" data-label="Assigned reviewer">{target.assignedReviewer ? <Link className="assignment-context-link" href={`/admin/team?reviewerId=${encodeURIComponent(target.assignedReviewer.membershipId)}`}><strong>{target.assignedReviewer.displayName}</strong><small>Manage in Team Access</small></Link> : <Link className="assignment-context-link unassigned" href="/admin/team?state=unassigned"><strong>Unassigned</strong><small>Assign in Team Access</small></Link>}</td>}
        <td className="target-response-cell" data-label="Responses">{target.submissionCount}</td>
        {canManage && <td className="target-actions-cell"><div className="button-row"><button className="icon-button table-action" aria-label={`Edit ${target.displayName}`} title={`Edit ${target.displayName}'s name and email`} disabled={busy} onClick={() => beginEdit(target)}><Pencil size={13} /></button><button className="icon-button table-action" aria-label={`Archive ${target.displayName}`} title={`Archive ${target.displayName}`} disabled={busy} onClick={() => void archive(target)}><X size={14} /></button></div></td>}
      </tr>)}
      {shown.length === 0 && <tr><td colSpan={canManage ? 4 : 2} className="no-results">No people match this search.</td></tr>}
    </tbody></table></div>}{cursor && <div className="load-more-row"><button className="button button-small" disabled={busy} onClick={() => void loadMore()}>{busy ? "Loading…" : `Load more people · ${targets.length} loaded`}</button></div>}
  </div>;
}
