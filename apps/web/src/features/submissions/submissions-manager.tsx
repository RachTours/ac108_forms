"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Archive, Check, CheckCheck, ClipboardList, RotateCcw, Trash2 } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { formatDate } from "../../lib/date-format";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { workspacePathForRole } from "../../lib/workspace-access";

type Submission = { id: string; submittedAt: string; archivedAt?: string | null; reviewedAt: string | null; target: { id: string; displayName: string }; reviewedPersonName?: string; form: { id: string; title: string }; reviewer: { id: string; user: { displayName: string; email?: string } }; formVersion: { version: number } };
type Reviewer = { id: string; role: string; status: string; user: { displayName: string; email: string } };
type View = "active" | "archived";

export function SubmissionsManager({ initialRows, initialArchivedRows, reviewers, canManage }: { initialRows: Submission[]; initialArchivedRows: Submission[]; reviewers: Reviewer[]; canManage: boolean }) {
  const api = useApi();
  const session = useWorkspaceSession();
  const [rows, setRows] = useState(initialRows);
  const [archivedRows, setArchivedRows] = useState(initialArchivedRows);
  const [view, setView] = useState<View>("active");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [reviewerFilter, setReviewerFilter] = useState("");
  const [reviewerData, setReviewerData] = useState<{ key: string; rows: Submission[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const reviewerQueryKey = view + ":" + reviewerFilter;
  const loadingReviewer = Boolean(canManage && reviewerFilter && reviewerData?.key !== reviewerQueryKey);
  const reviewerCursor = reviewerData?.key === reviewerQueryKey ? reviewerData.cursor : null;
  useEffect(() => {
    if (!canManage || !reviewerFilter) return;
    let current = true;
    const endpoint = view === "archived" ? "/submissions/archived" : "/submissions";
    void api<{ data: Submission[]; nextCursor: string | null }>(endpoint + "?limit=100&reviewerId=" + encodeURIComponent(reviewerFilter))
      .then((result) => { if (current) { setReviewerData({ key: reviewerQueryKey, rows: result.data, cursor: result.nextCursor }); setError(""); } })
      .catch((cause) => { if (current) { setReviewerData({ key: reviewerQueryKey, rows: [], cursor: null }); setError(cause instanceof Error ? cause.message : "Reviewer reviews could not be loaded."); } })
    return () => { current = false; };
  }, [api, canManage, reviewerFilter, reviewerQueryKey, view]);

  const sourceRows = reviewerFilter ? (reviewerData?.key === reviewerQueryKey ? reviewerData.rows : []) : view === "archived" ? archivedRows : rows;
  const visibleRows = view === "archived" ? sourceRows : sourceRows.filter((row) => filter === "all" || (filter === "read") === Boolean(row.reviewedAt));

  async function loadMoreReviewerRows() {
    if (!reviewerFilter || !reviewerCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const endpoint = view === "archived" ? "/submissions/archived" : "/submissions";
      const result = await api<{ data: Submission[]; nextCursor: string | null }>(endpoint + "?limit=100&reviewerId=" + encodeURIComponent(reviewerFilter) + "&cursor=" + encodeURIComponent(reviewerCursor));
      setReviewerData((current) => current?.key === reviewerQueryKey ? { ...current, rows: [...current.rows, ...result.data], cursor: result.nextCursor } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "More reviewer reviews could not be loaded."); }
    finally { setLoadingMore(false); }
  }

  async function toggle(row: Submission) {
    try {
      const reviewed = !row.reviewedAt;
      await api(`/submissions/${row.id}/review`, { method: "PATCH", body: JSON.stringify({ reviewed }) });
      setRows((items) => items.map((item) => item.id === row.id ? { ...item, reviewedAt: reviewed ? new Date().toISOString() : null } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review status could not be updated."); }
  }

  async function archive(row: Submission) {
    if (!window.confirm(`Archive the review for “${row.reviewedPersonName || row.target.displayName}”? It will leave the active inbox but remain in the database and Archived view.`)) return;
    setError(""); setNotice(""); setBusyId(row.id);
    try {
      await api(`/submissions/${row.id}`, { method: "DELETE" });
      const archived = { ...row, archivedAt: new Date().toISOString() };
      setRows((items) => items.filter((item) => item.id !== row.id));
      setArchivedRows((items) => [archived, ...items.filter((item) => item.id !== row.id)]);
      setNotice("Review archived. Restore it from the Archived view any time.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review could not be archived."); }
    finally { setBusyId(null); }
  }

  async function restore(row: Submission) {
    setError(""); setNotice(""); setBusyId(row.id);
    try {
      await api(`/submissions/${row.id}/restore`, { method: "POST" });
      const restored = { ...row, archivedAt: null };
      setArchivedRows((items) => items.filter((item) => item.id !== row.id));
      setRows((items) => [restored, ...items.filter((item) => item.id !== row.id)]);
      setNotice(`Review for “${row.reviewedPersonName || row.target.displayName}” was restored.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review could not be restored."); }
    finally { setBusyId(null); }
  }

  async function permanentlyDelete(row: Submission) {
    const personName = row.reviewedPersonName || row.target.displayName;
    if (window.prompt(`This permanently removes the review and its answers from the database. Type “${personName}” to confirm.`) !== personName) return;
    setError(""); setNotice(""); setBusyId(row.id);
    try {
      await api(`/submissions/${row.id}/permanent`, { method: "DELETE" });
      setRows((items) => items.filter((item) => item.id !== row.id));
      setArchivedRows((items) => items.filter((item) => item.id !== row.id));
      setNotice(`Review for “${personName}” and its answers were permanently deleted.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review could not be permanently deleted."); }
    finally { setBusyId(null); }
  }

  return <>
    {canManage && <div className="manager-toolbar submission-view-toolbar">
      <div className="filter-pills" aria-label="Submission views">
        <button type="button" className={view === "active" ? "filter-pill active" : "filter-pill"} onClick={() => setView("active")}>Active</button>
        <button type="button" className={view === "archived" ? "filter-pill active" : "filter-pill"} onClick={() => setView("archived")}>Archived <span>{archivedRows.length}</span></button>
      </div>
      <label className="reviewer-submission-filter"><span>Reviewer</span><select aria-label="Filter submissions by reviewer" value={reviewerFilter} onChange={(event) => setReviewerFilter(event.target.value)}><option value="">All reviewers</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName} · {reviewer.user.email}</option>)}</select></label>
      {view === "active" && <div className="filter-pills" aria-label="Filter active submissions">{(["all", "unread", "read"] as const).map((value) => <button type="button" key={value} className={filter === value ? "filter-pill active" : "filter-pill"} onClick={() => setFilter(value)}>{value === "all" ? "All responses" : value === "read" ? "Reviewed" : "Needs review"}</button>)}</div>}
      <span className="muted-caption">{loadingReviewer ? "Loading…" : visibleRows.length + " shown"}</span>
    </div>}
    {!canManage && <div className="manager-toolbar"><div className="filter-pills" aria-label="Filter submissions">{(["all", "unread", "read"] as const).map((value) => <button type="button" key={value} className={filter === value ? "filter-pill active" : "filter-pill"} onClick={() => setFilter(value)}>{value === "all" ? "All responses" : value === "read" ? "Reviewed" : "Needs review"}</button>)}</div><span className="muted-caption">{visibleRows.length} shown</span></div>}
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {loadingReviewer ? <div className="panel empty-state"><h2>Loading reviewer reviews</h2><p>Getting the selected reviewer’s submissions.</p></div> : visibleRows.length === 0 ? <div className="panel empty-state"><span className="empty-icon"><ClipboardList /></span><h2>{view === "archived" ? "No archived reviews" : "No responses in this view"}</h2><p>{view === "archived" ? "Archived reviews stay here until you restore or permanently delete them." : "Submitted feedback will appear here."}</p></div> :
      <div className="panel submission-list">{visibleRows.map((row) => <article className={`submission-row ${canManage ? "submission-row-managed" : ""}`} key={row.id}>
        <span className={`submission-status ${row.reviewedAt ? "read" : ""}`}>{row.reviewedAt ? <CheckCheck size={15} /> : <ClipboardList size={15} />}</span>
        <Link className="submission-main" href={`${workspacePathForRole(`/submissions/${row.id}`, session.role)}${view === "archived" ? "?archived=true" : ""}`}><strong>{row.reviewedPersonName || row.target.displayName}</strong><small>{row.form.title} · Submitted by {row.reviewer.user.displayName} · Version {row.formVersion.version}</small></Link>
        <time className="submission-date">{formatDate(row.submittedAt)}</time>
        {view === "archived" ? <span className="status status-pending submission-state">Archived</span> : <span className={`status submission-state ${row.reviewedAt ? "" : "status-pending"}`}>{row.reviewedAt ? "Reviewed" : "Needs review"}</span>}
        {view === "active" && <button className="button button-small submission-mark-action" disabled={busyId !== null} onClick={() => void toggle(row)}><Check size={13} /> {row.reviewedAt ? "Reopen" : "Mark reviewed"}</button>}
        {canManage && view === "active" && <button className="icon-button submission-archive-action" type="button" aria-label={`Archive review for ${row.reviewedPersonName || row.target.displayName}`} title="Archive; retain database record" disabled={busyId !== null} onClick={() => void archive(row)}><Archive size={14} /></button>}
        {canManage && view === "archived" && <button type="button" className="button button-small submission-restore-action" disabled={busyId !== null} onClick={() => void restore(row)}><RotateCcw size={13} /> Restore</button>}
        {canManage && <button className="icon-button danger-action submission-delete-action" type="button" aria-label={`Permanently delete review for ${row.reviewedPersonName || row.target.displayName}`} title="Permanently delete review and answers" disabled={busyId !== null} onClick={() => void permanentlyDelete(row)}><Trash2 size={14} /></button>}
      </article>)}</div>}
    {canManage && reviewerCursor && !loadingReviewer && <div className="load-more-row"><button type="button" className="button button-small" disabled={loadingMore} onClick={() => void loadMoreReviewerRows()}>{loadingMore ? "Loading…" : "Load more reviewer reviews"}</button></div>}
  </>;
}
