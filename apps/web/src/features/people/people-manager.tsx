"use client";

import { useMemo, useState } from "react";
import { Check, CheckSquare, Pencil, Plus, Search, UserRound, X } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { assignmentCounts, filterAssignmentTargets, type AssignmentFilter, type AssignmentTarget } from "./assignment-view";
import Link from "next/link";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { workspacePathForRole } from "../../lib/workspace-access";

type Target = AssignmentTarget;
type Member = { id: string; role: string; status: string; user: { displayName: string; email: string } };

export function PeopleManager({ initialTargets, initialCursor, reviewers, canManage }: { initialTargets: Target[]; initialCursor: string | null; reviewers: Member[]; canManage: boolean }) {
  const api = useApi();
  const session = useWorkspaceSession();
  const [targets, setTargets] = useState(initialTargets);
  const [cursor, setCursor] = useState(initialCursor);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AssignmentFilter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkReviewer, setBulkReviewer] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newReviewerId, setNewReviewerId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const counts = useMemo(() => assignmentCounts(targets), [targets]);
  const shown = useMemo(() => filterAssignmentTargets(targets, search, filter), [targets, search, filter]);
  const visibleIds = shown.map((target) => target.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ data: Target[]; nextCursor: string | null }>(`/review-targets?limit=100&cursor=${encodeURIComponent(cursor)}`);
      setTargets((items) => [...items, ...result.data]); setCursor(result.nextCursor);
    } catch (err) { setError(err instanceof Error ? err.message : "More people could not be loaded."); }
    finally { setBusy(false); }
  }

  function toggleSelection(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function toggleVisible() { setSelected((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]); }

  async function addTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const reviewer = reviewers.find((item) => item.id === newReviewerId);
      const result = await api<{ data: Target }>("/review-targets", { method: "POST", body: JSON.stringify({ displayName: name, email, ...(reviewer ? { reviewerId: reviewer.id } : {}) }) });
      setTargets((items) => [...items, result.data].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setName(""); setEmail(""); setNewReviewerId(""); setNotice(result.data.displayName + " added" + (reviewer ? " and assigned to " + reviewer.user.displayName : "") + ".");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add this person."); }
    finally { setBusy(false); }
  }

  async function assign(targetId: string, reviewerId: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!reviewerId) {
        await api(`/review-targets/${targetId}/assignment`, { method: "DELETE" });
        setTargets((items) => items.map((target) => target.id === targetId ? { ...target, assignedReviewer: null } : target));
        setNotice("Reviewer unassigned."); return;
      }
      const reviewer = reviewers.find((item) => item.id === reviewerId);
      if (!reviewer) throw new Error("Choose an active reviewer.");
      const current = targets.find((target) => target.id === targetId);
      if (current?.assignedReviewer && current.assignedReviewer.membershipId !== reviewerId && !window.confirm(`Replace ${current.assignedReviewer.displayName} with ${reviewer.user.displayName}? Existing reviews will remain recorded.`)) return;
      await api(`/review-targets/${targetId}/assignment`, { method: "PUT", body: JSON.stringify({ reviewerId }) });
      setTargets((items) => items.map((target) => target.id === targetId ? { ...target, assignedReviewer: { membershipId: reviewer.id, displayName: reviewer.user.displayName, email: reviewer.user.email } } : target));
      setNotice(`Assigned to ${reviewer.user.displayName}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not change assignment."); }
    finally { setBusy(false); }
  }

  async function bulkAssign() {
    if (!bulkReviewer || selected.length === 0) return;
    const reviewer = reviewers.find((item) => item.id === bulkReviewer);
    if (!reviewer) { setError("Choose an active reviewer."); return; }
    const replaced = targets.filter((target) => selected.includes(target.id) && target.assignedReviewer && target.assignedReviewer.membershipId !== bulkReviewer).length;
    if (!window.confirm(`Assign ${selected.length} selected ${selected.length === 1 ? "person" : "people"} to ${reviewer.user.displayName}?${replaced ? ` This replaces ${replaced} existing assignment${replaced === 1 ? "" : "s"}; submitted reviews remain in history.` : ""}`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/review-targets/assignments/bulk", { method: "POST", body: JSON.stringify({ targetIds: selected, reviewerId: bulkReviewer }) });
      setTargets((items) => items.map((target) => selected.includes(target.id) ? { ...target, assignedReviewer: { membershipId: reviewer.id, displayName: reviewer.user.displayName, email: reviewer.user.email } } : target));
      setNotice(`${selected.length} ${selected.length === 1 ? "person" : "people"} assigned to ${reviewer.user.displayName}.`); setSelected([]);
    } catch (err) { setError(err instanceof Error ? err.message : "No assignments were changed. Try again."); }
    finally { setBusy(false); }
  }

  function beginEdit(target: Target) { setEditingId(target.id); setEditName(target.displayName); setEditEmail(target.email ?? ""); setError(""); setNotice(""); }
  async function saveEdit(targetId: string) {
    setBusy(true); setError("");
    try {
      const result = await api<{ data: { displayName: string; email: string | null } }>(`/review-targets/${targetId}`, { method: "PATCH", body: JSON.stringify({ displayName: editName, email: editEmail }) });
      setTargets((items) => items.map((target) => target.id === targetId ? { ...target, ...result.data } : target)); setEditingId(null); setNotice("Person details saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Person could not be updated."); }
    finally { setBusy(false); }
  }
  async function archive(target: Target) {
    if (!window.confirm(`Archive ${target.displayName}? Their existing reviews will remain in submissions.`)) return;
    setBusy(true); setError("");
    try { await api(`/review-targets/${target.id}`, { method: "DELETE" }); setTargets((items) => items.filter((item) => item.id !== target.id)); setSelected((items) => items.filter((id) => id !== target.id)); setNotice(`${target.displayName} archived.`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not archive this person."); }
    finally { setBusy(false); }
  }

  return <div className="people-manager">
    <div className="manager-toolbar">
      <label className="search-box"><Search size={15} /><input aria-label="Search people or reviewers" placeholder="Search people or reviewers" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
      <span className="muted-caption">{shown.length} shown · {targets.length} loaded{cursor ? "+" : ""}</span>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {canManage && <>
      <p className="help-copy">Assignments are limited to active reviewer accounts granted access in Team access. Names and emails below identify those accounts.</p>
      {reviewers.length === 0 && <div className="permission-note" role="status"><span><strong>No active reviewers yet</strong><small>Invite a reviewer in <Link href={workspacePathForRole("/team", session.role)}>Team access</Link>. They can be assigned after they accept their access token.</small></span></div>}
      <div className="assignment-summary people-filter-row" aria-label="Assignment status filters">
        <button className={filter === "all" ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter("all")}>All <span>{counts.all}</span></button>
        <button className={filter === "unassigned" ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter("unassigned")}>Unassigned <span>{counts.unassigned}</span></button>
        <button className={filter === "in-progress" ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter("in-progress")}>In progress <span>{counts.inProgress}</span></button>
        <button className={filter === "completed" ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter("completed")}>Completed <span>{counts.completed}</span></button>
        {reviewers.map((reviewer) => <button key={reviewer.id} title={reviewer.user.email} aria-label={`Filter by active reviewer ${reviewer.user.displayName}, ${reviewer.user.email}`} className={filter === `reviewer:${reviewer.id}` ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter(`reviewer:${reviewer.id}`)}>Reviewer · {reviewer.user.displayName}</button>)}
      </div>
      <form className="add-person-panel add-person-guided" onSubmit={addTarget}><div className="add-person-heading"><span className="setting-icon"><Plus size={16} /></span><span><strong>Add someone to review</strong><small>Add each person once, then assign them to an active reviewer.</small></span></div><label className="people-field"><span>Full name</span><input required maxLength={160} placeholder="e.g. Alex Morgan" autoComplete="name" aria-label="Full name" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="people-field"><span>Email <small>Optional</small></span><input type="email" maxLength={254} placeholder="name@example.com" autoComplete="email" aria-label="Email (optional)" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="people-field"><span>Assign reviewer <small>Optional</small></span><select aria-label="Assign to an active reviewer" value={newReviewerId} onChange={(event) => setNewReviewerId(event.target.value)} disabled={busy || reviewers.length === 0}><option value="">Choose later</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName} · {reviewer.user.email}</option>)}</select></label><button className="button button-primary add-person-submit" disabled={busy}><Plus size={13} /> Add person{newReviewerId ? " and assign" : ""}</button></form>
      {selected.length > 0 && <div className="bulk-assignment" role="region" aria-label="Bulk assignment"><span><CheckSquare size={16} /> <strong>{selected.length}</strong> selected</span><select aria-label="Assign selected people to reviewer" value={bulkReviewer} onChange={(event) => setBulkReviewer(event.target.value)}><option value="">Choose an active reviewer</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName} · {reviewer.user.email}</option>)}</select><button className="button button-primary button-small" disabled={busy || !bulkReviewer} onClick={() => void bulkAssign()}>Assign selected</button><button className="button button-small" onClick={() => setSelected([])}>Clear</button></div>}
    </>}
    {targets.length === 0 ? <div className="panel empty-state compact-empty"><span className="empty-icon"><UserRound /></span><h2>No review targets yet</h2><p>Add people to begin assigning reviews.</p></div> : <div className="table-wrap people-target-table"><table><thead><tr>{canManage && <th><input type="checkbox" aria-label="Select all visible people" checked={allVisibleSelected} onChange={toggleVisible} /></th>}<th>Person</th><th>Assigned reviewer</th><th>Responses</th><th>Review status</th>{canManage && <th aria-label="Actions" />}</tr></thead><tbody>
      {shown.map((target) => <tr className={`review-target-row ${canManage ? "managed" : ""}`} key={target.id}>{canManage && <td className="target-select-cell"><input type="checkbox" aria-label={`Select ${target.displayName}`} checked={selected.includes(target.id)} onChange={() => toggleSelection(target.id)} /></td>}<td className="target-person-cell">{editingId === target.id ? <div className="edit-person"><input aria-label="Edit name" value={editName} maxLength={160} onChange={(event) => setEditName(event.target.value)} /><input aria-label="Edit email" type="email" value={editEmail} maxLength={254} onChange={(event) => setEditEmail(event.target.value)} /><button className="icon-button" aria-label="Save person" disabled={busy} onClick={() => void saveEdit(target.id)}><Check size={14} /></button></div> : <div className="person-cell"><span className="avatar avatar-soft">{target.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{target.displayName}</strong><small>{target.email || "No email added"}</small></span></div>}</td><td className="target-reviewer-cell" data-label="Assigned reviewer">{canManage ? <select className="table-select" aria-label={`Assign reviewer for ${target.displayName}`} disabled={busy || reviewers.length === 0} value={target.assignedReviewer?.membershipId ?? ""} onChange={(event) => void assign(target.id, event.target.value)}><option value="">Unassigned</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName} · {reviewer.user.email}</option>)}</select> : target.assignedReviewer?.displayName ?? "Unassigned"}</td><td className="target-response-cell" data-label="Responses">{target.submissionCount}</td><td className="target-status-cell" data-label="Review status"><span className={`status ${target.submissionCount === 0 ? "status-pending" : ""}`}>{target.submissionCount ? "Completed" : target.assignedReviewer ? "In progress" : "Unassigned"}</span></td>{canManage && <td className="target-actions-cell"><div className="button-row"><button className="icon-button table-action" aria-label={`Edit ${target.displayName}`} title={`Edit ${target.displayName}'s name and email`} disabled={busy} onClick={() => beginEdit(target)}><Pencil size={13} /></button><button className="icon-button table-action" aria-label={`Archive ${target.displayName}`} title={`Archive ${target.displayName}`} disabled={busy} onClick={() => void archive(target)}><X size={14} /></button></div></td>}</tr>)}
      {shown.length === 0 && <tr><td colSpan={(canManage ? 6 : 4)} className="no-results">No people match this filter and search.</td></tr>}
    </tbody></table></div>}{cursor && <div className="load-more-row"><button className="button button-small" disabled={busy} onClick={() => void loadMore()}>{busy ? "Loading…" : `Load more people · ${targets.length} loaded`}</button></div>}
  </div>;
}
