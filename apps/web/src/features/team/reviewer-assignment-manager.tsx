"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { buildAssignmentListUrl, readAssignmentFilters, type AssignmentState } from "./assignment-view";

type Reviewer = { id: string; user: { displayName: string; email: string } };
type AssignmentTarget = {
  id: string;
  displayName: string;
  email: string | null;
  assignment: { id: string; reviewerId: string; updatedAt: string; reviewer: { displayName: string; email: string } } | null;
};
type AssignmentPage = { data: AssignmentTarget[]; nextCursor: string | null; counts: { total: number; assigned: number; unassigned: number } };

export function ReviewerAssignmentManager({ reviewers, onAssignmentsChanged, initialSearch }: { reviewers: Reviewer[]; onAssignmentsChanged: () => void; initialSearch: string }) {
  const api = useApi();
  const [targets, setTargets] = useState<AssignmentTarget[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialFilters] = useState(() => readAssignmentFilters(initialSearch));
  const [search, setSearch] = useState(initialFilters.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);
  const [state, setState] = useState<AssignmentState>(initialFilters.state);
  const [reviewerId, setReviewerId] = useState(initialFilters.reviewerId);
  const [counts, setCounts] = useState({ total: 0, assigned: 0, unassigned: 0 });
  const [selectedReviewers, setSelectedReviewers] = useState<Record<string, string>>({});
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [requestError, setRequestError] = useState("");
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestKey = JSON.stringify([debouncedSearch, state, reviewerId, cursor, refreshVersion]);
  const loading = loadedRequestKey !== requestKey;
  const error = requestError;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const queryUrl = buildAssignmentListUrl({ search, state, reviewerId, cursor: null });
    window.history.replaceState(null, "", `${window.location.pathname}${queryUrl.slice("/assignments".length)}`);
  }, [search, state, reviewerId]);

  useEffect(() => {
    let active = true;
    const url = buildAssignmentListUrl({ search: debouncedSearch, state, reviewerId, cursor });
    api<AssignmentPage>(url)
      .then((result) => {
        if (!active) return;
        setTargets((current) => cursor ? [...current, ...result.data] : result.data);
        setNextCursor(result.nextCursor);
        setCounts(result.counts);
        setSelectedReviewers((current) => {
          const next = cursor ? { ...current } : {};
          for (const target of result.data) next[target.id] = (cursor ? current[target.id] : undefined) ?? target.assignment?.reviewerId ?? "";
          return next;
        });
      })
      .catch((err) => { if (active) setRequestError(err instanceof Error ? err.message : "Assignments could not be loaded."); })
      .finally(() => { if (active) setLoadedRequestKey(requestKey); });
    return () => { active = false; };
  }, [api, requestKey, debouncedSearch, state, reviewerId, cursor]);

  function resetList() {
    setCursor(null);
    setRefreshVersion((version) => version + 1);
  }

  async function save(target: AssignmentTarget) {
    const nextReviewerId = selectedReviewers[target.id] ?? "";
    if (!nextReviewerId || nextReviewerId === target.assignment?.reviewerId) return;
    const nextReviewer = reviewers.find((reviewer) => reviewer.id === nextReviewerId);
    if (!nextReviewer) return;
    if (target.assignment && !window.confirm(`Reassign ${target.displayName} from ${target.assignment.reviewer.displayName} to ${nextReviewer.user.displayName}? Previously submitted feedback will remain in history.`)) return;
    setBusyTarget(target.id);
    setRequestError("");
    try {
      await api(`/assignments/${target.id}`, { method: "PUT", body: JSON.stringify({ reviewerId: nextReviewerId, expectedUpdatedAt: target.assignment?.updatedAt ?? null }) });
      onAssignmentsChanged();
      resetList();
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Assignment could not be saved.");
      resetList();
    } finally {
      setBusyTarget(null);
    }
  }

  async function unassign(target: AssignmentTarget) {
    if (!target.assignment) return;
    setBusyTarget(target.id);
    setRequestError("");
    try {
      await api(`/assignments/${target.id}`, { method: "DELETE", body: JSON.stringify({ expectedUpdatedAt: target.assignment.updatedAt }) });
      onAssignmentsChanged();
      setSelectedReviewers((current) => ({ ...current, [target.id]: "" }));
      resetList();
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Assignment could not be removed.");
      resetList();
    } finally {
      setBusyTarget(null);
    }
  }

  return <section className="reviewer-assignment-workspace" aria-labelledby="reviewer-assignments-heading">
    <div className="section-heading assignment-workspace-heading">
      <div><p className="eyebrow">TEAM WORKFLOW</p><h2 id="reviewer-assignments-heading">Reviewer assignments</h2><p className="muted-caption">New people are balanced across active reviewers automatically. Change an assignment here whenever needed.</p></div>
      <div className="assignment-count-summary"><span>{counts.assigned} assigned</span><span>{counts.unassigned} unassigned</span><span>{counts.total} people</span></div>
    </div>
    {reviewers.length === 0 && <div className="permission-note" role="status"><UserRound size={16} /><span><strong>No active reviewers yet</strong><small>Add a reviewer in Members. Once they accept their access token, they will appear here.</small></span></div>}
    <div className="assignment-workspace-filters">
      <label className="search-box reviewer-assignment-search"><Search size={15} /><input aria-label="Search all people by name or email" placeholder="Search all people by name or email" value={search} onChange={(event) => { setRequestError(""); setSearch(event.target.value); setCursor(null); }} /></label>
      <label className="assignment-reviewer-filter"><span>Reviewer</span><select aria-label="Filter assignments by reviewer" value={reviewerId} onChange={(event) => { setRequestError(""); setReviewerId(event.target.value); setCursor(null); }}><option value="">All reviewers</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName}</option>)}</select></label>
    </div>
    <div className="assignment-summary assignment-state-filters" role="group" aria-label="Filter assignments by state">{(["all", "assigned", "unassigned"] as const).map((value) => <button key={value} type="button" className={state === value ? "assignment-filter active" : "assignment-filter"} aria-pressed={state === value} onClick={() => { setRequestError(""); setState(value); setCursor(null); }}>{value === "all" ? "All people" : value[0]!.toUpperCase() + value.slice(1)}</button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && targets.length === 0 ? <div className="panel empty-inline" role="status">Loading assignments…</div> : targets.length === 0 ? <div className="panel empty-inline">{error ? "Assignments could not be loaded." : debouncedSearch ? "No people match this search." : state === "unassigned" ? "Every active person has a reviewer." : "No active people yet. Add people first."}{!debouncedSearch && targets.length === 0 && <Link href="/admin/people" className="text-link"> Open People</Link>}</div> : <div className="assignment-workspace-list" aria-busy={loading}>
      {targets.map((target) => {
        const selected = selectedReviewers[target.id] ?? target.assignment?.reviewerId ?? "";
        const hasChanges = selected !== (target.assignment?.reviewerId ?? "");
        return <article className="assignment-workspace-row" key={target.id}>
          <span className="avatar avatar-soft" aria-hidden="true">{target.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
          <span className="assignment-workspace-person"><strong>{target.displayName}</strong><small>{target.email ?? "No email added"}</small></span>
          <span className="assignment-workspace-current"><small>Currently assigned</small><strong>{target.assignment?.reviewer.displayName ?? "Unassigned"}</strong></span>
          <label className="assignment-workspace-select"><span>Assign reviewer</span><select aria-label={`Assign reviewer for ${target.displayName}`} value={selected} onChange={(event) => setSelectedReviewers((current) => ({ ...current, [target.id]: event.target.value }))} disabled={reviewers.length === 0 || busyTarget !== null}><option value="">Choose reviewer</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName}</option>)}</select></label>
          <span className="assignment-workspace-actions"><button type="button" className="button button-small button-primary" disabled={!hasChanges || !selected || busyTarget !== null} onClick={() => void save(target)}>{busyTarget === target.id ? "Saving…" : target.assignment ? "Save change" : "Assign"}</button>{target.assignment && <button type="button" className="button button-small" disabled={busyTarget !== null} onClick={() => void unassign(target)}>Unassign</button>}</span>
        </article>;
      })}
    </div>}
    {nextCursor && <div className="load-more-row"><button type="button" className="button button-small" disabled={loading} onClick={() => { setRequestError(""); setCursor(nextCursor); }}>{loading ? "Loading…" : "Load more people"}</button></div>}
  </section>;
}
