"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, X } from "lucide-react";
import { sortReviewerProgress, toReviewerProgress, type ReviewerSort } from "./reviewer-board";
import { useApi } from "../../lib/client-api";
import { formatDate } from "../../lib/date-format";
import { SubmissionDetail } from "../submissions/submission-detail";

type Source = { reviewerId: string; displayName: string; assigned: number; completed: number };
type Review = { id: string; submittedAt: string; reviewedAt: string | null; archivedAt?: string | null; target: { displayName: string }; reviewedPersonName?: string; form: { title: string }; formVersion: { version: number } };
type ReviewDetail = { id: string; submittedAt: string; archivedAt: string | null; reviewedAt: string | null; answers: unknown; target: { displayName: string }; reviewedPersonName?: string; form: { title: string }; reviewer: { user: { displayName: string } }; formVersion: { version: number; definition: unknown } };

function ReviewerReviewsDrawer({ reviewer, onClose }: { reviewer: Source; onClose: () => void }) {
  const api = useApi();
  const [rows, setRows] = useState<Review[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadedView, setLoadedView] = useState<"active" | "archived" | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; data: ReviewDetail } | null>(null);
  const loading = loadedView !== view;
  const detailLoading = Boolean(selectedReviewId && detail?.id !== selectedReviewId);

  useEffect(() => {
    let current = true;
    const endpoint = view === "archived" ? "/submissions/archived" : "/submissions";
    void api<{ data: Review[]; nextCursor: string | null }>(endpoint + "?limit=100&reviewerId=" + encodeURIComponent(reviewer.reviewerId))
      .then((result) => { if (current) { setRows(result.data); setCursor(result.nextCursor); setLoadedView(view); setError(""); } })
      .catch((cause) => { if (current) { setRows([]); setCursor(null); setError(cause instanceof Error ? cause.message : "Reviews could not be loaded."); setLoadedView(view); } });
    return () => { current = false; };
  }, [api, reviewer.reviewerId, view]);

  useEffect(() => {
    if (!selectedReviewId) return;
    let current = true;
    const archivedQuery = view === "archived" ? "?archived=true" : "";
    void api<{ data: ReviewDetail }>(`/submissions/${encodeURIComponent(selectedReviewId)}${archivedQuery}`)
      .then((result) => { if (current) { setDetail({ id: selectedReviewId, data: result.data }); setError(""); } })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Review details could not be loaded."); });
    return () => { current = false; };
  }, [api, selectedReviewId, view]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const endpoint = view === "archived" ? "/submissions/archived" : "/submissions";
      const result = await api<{ data: Review[]; nextCursor: string | null }>(endpoint + "?limit=100&reviewerId=" + encodeURIComponent(reviewer.reviewerId) + "&cursor=" + encodeURIComponent(cursor));
      setRows((current) => [...current, ...result.data]);
      setCursor(result.nextCursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "More reviews could not be loaded."); }
    finally { setLoadingMore(false); }
  }

  return <div className="reviewer-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="reviewer-reviews-drawer" role="dialog" aria-modal="true" aria-labelledby="reviewer-reviews-title">
      <header className="reviewer-drawer-heading"><div><p className="eyebrow">REVIEWER WORK</p><h2 id="reviewer-reviews-title">{reviewer.displayName}</h2><p>{reviewer.assigned} assigned · {reviewer.completed} completed</p></div><button className="icon-button" type="button" aria-label="Close reviewer reviews" autoFocus onClick={onClose}><X size={18} /></button></header>
      {!selectedReviewId && <div className="filter-pills reviewer-drawer-filters" aria-label="Review status">
        <button type="button" className={view === "active" ? "filter-pill active" : "filter-pill"} onClick={() => setView("active")}>Active reviews</button>
        <button type="button" className={view === "archived" ? "filter-pill active" : "filter-pill"} onClick={() => setView("archived")}>Archived</button>
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {selectedReviewId ? <div className="reviewer-drawer-detail">
        <button type="button" className="back-link reviewer-drawer-back" onClick={() => { setSelectedReviewId(null); setError(""); }}><ArrowLeft size={14} /> Back to {rows.length} reviews</button>
        {detailLoading ? <p className="reviewer-drawer-state" role="status">Loading review details…</p> : detail?.id === selectedReviewId ? <SubmissionDetail data={detail.data} /> : null}
      </div> : loading ? <p className="reviewer-drawer-state" role="status">Loading {view} reviews…</p> : rows.length === 0 ? <div className="reviewer-drawer-state"><ClipboardList size={22} /><strong>No {view} reviews</strong><span>Submitted reviews for this reviewer will appear here.</span></div> :
        <div className="reviewer-drawer-list">{rows.map((row, index) => <article className="reviewer-drawer-row" key={row.id}>
          <button className="reviewer-drawer-row-trigger" type="button" aria-label={`Review ${index + 1}: ${row.reviewedPersonName || row.target.displayName}`} onClick={() => { setSelectedReviewId(row.id); setError(""); }}>
            <span className="reviewer-review-number" aria-hidden="true">{index + 1}</span>
            <span className="reviewer-review-copy"><strong>{row.reviewedPersonName || row.target.displayName}</strong><span>{row.form.title} · Version {row.formVersion.version}</span><small>{formatDate(row.submittedAt)} · {row.reviewedAt ? "Reviewed" : "Needs review"}</small></span>
          </button>
          {view === "archived" && <span className="status status-pending">Archived</span>}
        </article>)}</div>}
      {!selectedReviewId && cursor && !loading && <button type="button" className="button reviewer-drawer-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more reviews"}</button>}
    </section>
  </div>;
}

export function ReviewerProgressBoard({ rows, targetGoal }: { rows: Source[]; targetGoal: number }) {
  const [sort, setSort] = useState<ReviewerSort>("completion");
  const [selectedReviewer, setSelectedReviewer] = useState<Source | null>(null);
  const visible = useMemo(() => sortReviewerProgress(toReviewerProgress(rows, targetGoal), sort), [rows, sort, targetGoal]);
  const completedReviewers = visible.filter((reviewer) => reviewer.assigned > 0 && reviewer.completed >= reviewer.assigned).length;
  return <section className="reviewer-board" aria-labelledby="reviewer-board-title">
    <div className="section-heading reviewer-board-heading"><div><h2 id="reviewer-board-title">Reviewer workload</h2><p>{visible.length ? `${completedReviewers} of ${visible.filter((reviewer) => reviewer.assigned > 0).length} reviewers with assignments finished their assigned work. Individual bars show each reviewer's completed people against the workspace goal.` : "See how work is moving across the team."}</p></div><label className="reviewer-sort">Sort by <select value={sort} onChange={(event) => setSort(event.target.value as ReviewerSort)}><option value="completion">Completion</option><option value="name">Name</option><option value="completed">Completed</option><option value="remaining">Remaining</option></select></label></div>
    {visible.length === 0 ? <div className="panel empty-inline">No active reviewers yet.</div> : <div className="reviewer-board-list">{visible.map((reviewer) => <button type="button" key={reviewer.reviewerId} className="reviewer-progress-row reviewer-progress-trigger" aria-label={"View reviews by " + reviewer.displayName} onClick={() => setSelectedReviewer(reviewer)}>
      <div className="reviewer-progress-identity"><span className="avatar avatar-soft">{reviewer.displayName.trim().slice(0, 1).toUpperCase()}</span><span><strong>{reviewer.displayName}</strong><small>{reviewer.assigned === 0 ? "No targets assigned yet" : `${reviewer.completed} completed · ${reviewer.remaining} assigned remaining · goal ${targetGoal}`}</small></span></div>
      <div className="reviewer-progress-meter">{reviewer.assigned > 0 ? <div className="progress-track" role="progressbar" aria-label={`${reviewer.displayName} progress toward the shared target goal`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={reviewer.percent}><div className="progress-fill" style={{ width: `${reviewer.percent}%` }} /></div> : <span className="reviewer-unassigned">Waiting for assignments</span>}</div>
      <div className="reviewer-progress-counts">{reviewer.assigned > 0 ? <span>{reviewer.percent}%</span> : <span className="reviewer-unassigned-count">—</span>}{reviewer.assigned > 0 && reviewer.remaining === 0 && <strong className="complete-badge">Assigned work done</strong>}</div>
    </button>)}</div>}
    {selectedReviewer && <ReviewerReviewsDrawer reviewer={selectedReviewer} onClose={() => setSelectedReviewer(null)} />}
  </section>;
}
