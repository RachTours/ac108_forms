"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import { useApi } from "../../lib/client-api";

type Reviewer = { id: string; user: { displayName: string; email: string } };
type AssignmentTarget = {
  id: string;
  displayName: string;
  email: string | null;
  assignedReviewer: { membershipId: string; displayName: string; email: string } | null;
};
type AssignmentPage = { data: AssignmentTarget[]; nextCursor: string | null };

export function ReviewerAssignmentManager({
  reviewer,
  onClose,
  onCountChange,
}: {
  reviewer: Reviewer;
  onClose: () => void;
  onCountChange: (membershipId: string, delta: number) => void;
}) {
  const api = useApi();
  const [targets, setTargets] = useState<AssignmentTarget[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<AssignmentPage>("/review-targets/assignment-options?limit=100")
      .then((result) => {
        if (!active) return;
        setTargets(result.data);
        setCursor(result.nextCursor);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Review targets could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  const shownTargets = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return targets.filter((target) => `${target.displayName} ${target.email ?? ""} ${target.assignedReviewer?.displayName ?? ""}`.toLocaleLowerCase().includes(normalized));
  }, [search, targets]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await api<AssignmentPage>(`/review-targets/assignment-options?limit=100&cursor=${encodeURIComponent(cursor)}`);
      setTargets((current) => [...current, ...result.data]);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "More review targets could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function assign(target: AssignmentTarget) {
    const current = target.assignedReviewer;
    if (current?.membershipId === reviewer.id) return;
    if (current && !window.confirm(`Replace ${current.displayName} with ${reviewer.user.displayName} for ${target.displayName}? Existing submitted reviews will remain recorded.`)) return;
    setBusyTarget(target.id);
    setError("");
    try {
      await api(`/review-targets/${target.id}/assignment`, { method: "PUT", body: JSON.stringify({ reviewerId: reviewer.id }) });
      setTargets((items) => items.map((item) => item.id === target.id ? {
        ...item,
        assignedReviewer: { membershipId: reviewer.id, displayName: reviewer.user.displayName, email: reviewer.user.email },
      } : item));
      onCountChange(reviewer.id, 1);
      if (current) onCountChange(current.membershipId, -1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reviewer could not be assigned.");
    } finally {
      setBusyTarget(null);
    }
  }

  async function unassign(target: AssignmentTarget) {
    setBusyTarget(target.id);
    setError("");
    try {
      await api(`/review-targets/${target.id}/assignment`, { method: "DELETE" });
      setTargets((items) => items.map((item) => item.id === target.id ? { ...item, assignedReviewer: null } : item));
      onCountChange(reviewer.id, -1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reviewer could not be unassigned.");
    } finally {
      setBusyTarget(null);
    }
  }

  const assignedCount = targets.filter((target) => target.assignedReviewer?.membershipId === reviewer.id).length;

  return <section className="panel reviewer-assignment-panel" aria-label={`Assignments for ${reviewer.user.displayName}`}>
    <div className="section-heading">
      <div><h3>Assignments for {reviewer.user.displayName}</h3><p className="muted-caption">{assignedCount} assigned from {targets.length}{cursor ? "+" : ""} loaded review targets</p></div>
      <button type="button" className="icon-button" aria-label="Close assignment manager" onClick={onClose}><X size={15} /></button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <label className="search-box reviewer-assignment-search"><Search size={14} /><input aria-label="Search review targets to assign" placeholder="Search review targets" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {loading && targets.length === 0 ? <p className="empty-inline">Loading review targets…</p> : shownTargets.length === 0 ? <p className="empty-inline">{targets.length ? "No review targets match this search." : "No active review targets yet. Add people on the Review targets page first."}</p> : <div className="reviewer-assignment-list">
      {shownTargets.map((target) => {
        const assignedToThisReviewer = target.assignedReviewer?.membershipId === reviewer.id;
        return <div className="reviewer-assignment-row" key={target.id}>
          <span className="avatar avatar-soft"><UserRound size={14} /></span>
          <span className="reviewer-assignment-person"><strong>{target.displayName}</strong><small>{target.email ?? "No email added"}</small></span>
          <span className="reviewer-assignment-status">{assignedToThisReviewer ? "Assigned to this reviewer" : target.assignedReviewer ? `Assigned to ${target.assignedReviewer.displayName}` : "Unassigned"}</span>
          {assignedToThisReviewer
            ? <button type="button" className="button button-small" disabled={busyTarget !== null} onClick={() => void unassign(target)}>Unassign</button>
            : <button type="button" className="button button-small button-primary" disabled={busyTarget !== null} onClick={() => void assign(target)}>{target.assignedReviewer ? "Reassign" : "Assign"}</button>}
        </div>;
      })}
    </div>}
    {cursor && <div className="load-more-row"><button type="button" className="button button-small" disabled={loading} onClick={() => void loadMore()}>{loading ? "Loading…" : "Load more review targets"}</button></div>}
  </section>;
}
