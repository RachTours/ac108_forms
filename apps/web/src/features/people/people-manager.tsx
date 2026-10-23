"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { useApi } from "../../lib/client-api";
import { workspacePathForRole } from "../../lib/workspace-access";
import { assignmentCounts, filterAssignmentTargets, type AssignmentFilter, type AssignmentTarget } from "./assignment-view";

type Target = AssignmentTarget;
type Member = { id: string; role: string; status: string; user: { displayName: string; email: string } };

export function PeopleManager({ initialTargets, initialCursor, reviewers, canManage }: { initialTargets: Target[]; initialCursor: string | null; reviewers: Member[]; canManage: boolean }) {
  const api = useApi();
  const session = useWorkspaceSession();
  const [targets, setTargets] = useState(initialTargets);
  const [cursor, setCursor] = useState(initialCursor);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AssignmentFilter>("all");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const counts = useMemo(() => assignmentCounts(targets), [targets]);
  const shown = useMemo(() => filterAssignmentTargets(targets, search, filter), [targets, search, filter]);

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ data: Target[]; nextCursor: string | null }>(`/review-targets?limit=100&cursor=${encodeURIComponent(cursor)}`);
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
      const result = await api<{ data: Target }>("/review-targets", { method: "POST", body: JSON.stringify({ displayName: name, email }) });
      setTargets((items) => [...items, result.data].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setName("");
      setEmail("");
      setNotice(`${result.data.displayName} added. Assign a reviewer from Team access.`);
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
      const result = await api<{ data: { displayName: string; email: string | null } }>(`/review-targets/${targetId}`, { method: "PATCH", body: JSON.stringify({ displayName: editName, email: editEmail }) });
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
      <label className="search-box"><Search size={15} /><input aria-label="Search people or reviewers" placeholder="Search people or reviewers" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
      <span className="muted-caption">{shown.length} shown · {targets.length} loaded{cursor ? "+" : ""}</span>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {canManage && <>
      <p className="help-copy">Add the people being reviewed here. Assign active reviewers from Team access.</p>
      {reviewers.length === 0 && <div className="permission-note" role="status"><span><strong>No active reviewers yet</strong><small>Invite a reviewer in <Link href={workspacePathForRole("/team", session.role)}>Team access</Link>. They can be assigned after accepting their access token.</small></span></div>}
      <div className="assignment-summary people-filter-row" aria-label="Review status filters">
        <button className={filter === "all" ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter("all")}>All <span>{counts.all}</span></button>
        <button className={filter === "unassigned" ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter("unassigned")}>Unassigned <span>{counts.unassigned}</span></button>
        <button className={filter === "in-progress" ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter("in-progress")}>In progress <span>{counts.inProgress}</span></button>
        <button className={filter === "completed" ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter("completed")}>Completed <span>{counts.completed}</span></button>
        {reviewers.map((reviewer) => <button key={reviewer.id} title={reviewer.user.email} aria-label={`Filter by active reviewer ${reviewer.user.displayName}, ${reviewer.user.email}`} className={filter === `reviewer:${reviewer.id}` ? "assignment-filter active" : "assignment-filter"} onClick={() => setFilter(`reviewer:${reviewer.id}`)}>Reviewer · {reviewer.user.displayName}</button>)}
      </div>
      <form className="add-person-panel add-person-guided" onSubmit={addTarget}>
        <div className="add-person-heading"><span className="setting-icon"><Plus size={16} /></span><span><strong>Add someone to review</strong><small>Add each person once, then assign a reviewer in Team access.</small></span></div>
        <label className="people-field"><span>Full name</span><input required maxLength={160} placeholder="e.g. Alex Morgan" autoComplete="name" aria-label="Full name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="people-field"><span>Email <small>Optional</small></span><input type="email" maxLength={254} placeholder="name@example.com" autoComplete="email" aria-label="Email (optional)" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button className="button button-primary add-person-submit" disabled={busy}><Plus size={13} /> Add person</button>
      </form>
    </>}
    {targets.length === 0 ? <div className="panel empty-state compact-empty"><span className="empty-icon"><UserRound /></span><h2>No review targets yet</h2><p>Add people to begin assigning reviews.</p></div> : <div className="table-wrap people-target-table"><table><thead><tr><th>Person</th><th>Assigned reviewer</th><th>Responses</th><th>Review status</th>{canManage && <th aria-label="Actions" />}</tr></thead><tbody>
      {shown.map((target) => <tr className={`review-target-row ${canManage ? "managed" : ""}`} key={target.id}>
        <td className="target-person-cell">{editingId === target.id ? <div className="edit-person"><input aria-label="Edit name" value={editName} maxLength={160} onChange={(event) => setEditName(event.target.value)} /><input aria-label="Edit email" type="email" value={editEmail} maxLength={254} onChange={(event) => setEditEmail(event.target.value)} /><button className="icon-button" aria-label="Save person" disabled={busy} onClick={() => void saveEdit(target.id)}><span>Save</span></button></div> : <div className="person-cell"><span className="avatar avatar-soft">{target.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{target.displayName}</strong><small>{target.email || "No email added"}</small></span></div>}</td>
        <td className="target-reviewer-cell" data-label="Assigned reviewer">{target.assignedReviewer?.displayName ?? "Unassigned"}</td>
        <td className="target-response-cell" data-label="Responses">{target.submissionCount}</td>
        <td className="target-status-cell" data-label="Review status"><span className={`status ${target.submissionCount === 0 ? "status-pending" : ""}`}>{target.submissionCount ? "Completed" : target.assignedReviewer ? "In progress" : "Unassigned"}</span></td>
        {canManage && <td className="target-actions-cell"><div className="button-row"><button className="icon-button table-action" aria-label={`Edit ${target.displayName}`} title={`Edit ${target.displayName}'s name and email`} disabled={busy} onClick={() => beginEdit(target)}><Pencil size={13} /></button><button className="icon-button table-action" aria-label={`Archive ${target.displayName}`} title={`Archive ${target.displayName}`} disabled={busy} onClick={() => void archive(target)}><X size={14} /></button></div></td>}
      </tr>)}
      {shown.length === 0 && <tr><td colSpan={canManage ? 5 : 4} className="no-results">No people match this filter and search.</td></tr>}
    </tbody></table></div>}{cursor && <div className="load-more-row"><button className="button button-small" disabled={busy} onClick={() => void loadMore()}>{busy ? "Loading…" : `Load more people · ${targets.length} loaded`}</button></div>}
  </div>;
}
