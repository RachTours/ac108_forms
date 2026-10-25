"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, X } from "lucide-react";
import { getReviewerSortHint, sortReviewerProgress, toReviewerProgress, type ReviewerSort } from "./reviewer-board";
import { useApi } from "../../lib/client-api";
import { formatDate } from "../../lib/date-format";
import { SubmissionDetail } from "../submissions/submission-detail";
import { useLocale, useTranslations } from "next-intl";

type Source = { reviewerId: string; displayName: string; assigned: number; completed: number; submissionCount: number; reviewerSubmissionGoal: number | null; submissionRatio: number | null; submissionsRemaining: number | null; submissionPercent: number; submissionGoalMet: boolean };
type Review = { id: string; submittedAt: string; reviewedAt: string | null; archivedAt?: string | null; target: { displayName: string }; reviewedPersonName?: string; form: { title: string }; formVersion: { version: number } };
type ReviewDetail = { id: string; submittedAt: string; archivedAt: string | null; reviewedAt: string | null; answers: unknown; target: { displayName: string }; reviewedPersonName?: string; form: { title: string }; reviewer: { user: { displayName: string } }; formVersion: { version: number; definition: unknown } };

function ReviewerReviewsDrawer({ reviewer, onClose }: { reviewer: Source; onClose: () => void }) {
  const overview = useTranslations("overview");
  const submissions = useTranslations("submissions");
  const locale = useLocale();
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
      .catch(() => { if (current) { setRows([]); setCursor(null); setError(submissions("loadFailed")); setLoadedView(view); } });
    return () => { current = false; };
  }, [api, reviewer.reviewerId, view]);

  useEffect(() => {
    if (!selectedReviewId) return;
    let current = true;
    const archivedQuery = view === "archived" ? "?archived=true" : "";
    void api<{ data: ReviewDetail }>(`/submissions/${encodeURIComponent(selectedReviewId)}${archivedQuery}`)
      .then((result) => { if (current) { setDetail({ id: selectedReviewId, data: result.data }); setError(""); } })
      .catch(() => { if (current) setError(submissions("loadFailed")); });
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
    } catch { setError(submissions("moreReviewerReviewsFailed")); }
    finally { setLoadingMore(false); }
  }

  return <div className="reviewer-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="reviewer-reviews-drawer" role="dialog" aria-modal="true" aria-labelledby="reviewer-reviews-title">
      <header className="reviewer-drawer-heading"><div><p className="eyebrow">{overview("reviewerWork")}</p><h2 id="reviewer-reviews-title">{reviewer.displayName}</h2><p>{reviewer.assigned} {submissions("assigned")} · {reviewer.completed} {overview("completed")}</p></div><button className="icon-button" type="button" aria-label={overview("closeReviewerReviews")} autoFocus onClick={onClose}><X size={18} /></button></header>
      {!selectedReviewId && <div className="filter-pills reviewer-drawer-filters" aria-label={submissions("reviewed")}>
        <button type="button" className={view === "active" ? "filter-pill active" : "filter-pill"} onClick={() => setView("active")}>{overview("activeReviews")}</button>
        <button type="button" className={view === "archived" ? "filter-pill active" : "filter-pill"} onClick={() => setView("archived")}>{submissions("archived")}</button>
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {selectedReviewId ? <div className="reviewer-drawer-detail">
        <button type="button" className="back-link reviewer-drawer-back" onClick={() => { setSelectedReviewId(null); setError(""); }}><ArrowLeft size={14} /> {overview("backToReviews", { count: rows.length })}</button>
        {detailLoading ? <p className="reviewer-drawer-state" role="status">{overview("loadingReviewDetails")}</p> : detail?.id === selectedReviewId ? <SubmissionDetail data={detail.data} /> : null}
      </div> : loading ? <p className="reviewer-drawer-state" role="status">{overview("loadingViewReviews", { view: view === "active" ? overview("activeReviews").toLowerCase() : submissions("archived").toLowerCase() })}</p> : rows.length === 0 ? <div className="reviewer-drawer-state"><ClipboardList size={22} /><strong>{overview("noViewReviews", { view: view === "active" ? overview("activeReviews").toLowerCase() : submissions("archived").toLowerCase() })}</strong><span>{overview("reviewerReviewsHelp")}</span></div> :
        <div className="reviewer-drawer-list">{rows.map((row, index) => <article className="reviewer-drawer-row" key={row.id}>
          <button className="reviewer-drawer-row-trigger" type="button" aria-label={overview("reviewNumber", { number: index + 1, name: row.reviewedPersonName || row.target.displayName })} onClick={() => { setSelectedReviewId(row.id); setError(""); }}>
            <span className="reviewer-review-number" aria-hidden="true">{index + 1}</span>
            <span className="reviewer-review-copy"><strong>{row.reviewedPersonName || row.target.displayName}</strong><span>{row.form.title} · {submissions("version", { number: row.formVersion.version })}</span><small>{formatDate(row.submittedAt, locale)} · {row.reviewedAt ? submissions("reviewed") : submissions("needsReview")}</small></span>
          </button>
          {view === "archived" && <span className="status status-pending">{submissions("archived")}</span>}
        </article>)}</div>}
      {!selectedReviewId && cursor && !loading && <button type="button" className="button reviewer-drawer-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? submissions("loading") : overview("loadMoreReviews")}</button>}
    </section>
  </div>;
}

export function ReviewerProgressBoard({ rows }: { rows: Source[] }) {
  const t = useTranslations("overview");
  const [sort, setSort] = useState<ReviewerSort>("completion");
  const [selectedReviewer, setSelectedReviewer] = useState<Source | null>(null);
  const visible = useMemo(() => sortReviewerProgress(toReviewerProgress(rows), sort), [rows, sort]);
  const reviewersMeetingSubmissionGoal = visible.filter((reviewer) => reviewer.submissionGoalMet).length;
  const sortHint = getReviewerSortHint(visible.length);
  return <section className="reviewer-board" aria-labelledby="reviewer-board-title">
    <div className="section-heading reviewer-board-heading"><div><h2 id="reviewer-board-title">{t("reviewerWorkload")}</h2><p>{visible.length ? t("goalsReached", { reached: reviewersMeetingSubmissionGoal, total: visible.length }) : t("progressAcrossTeam")}</p></div><div className="reviewer-sort-control"><label className="reviewer-sort">{t("sortBy")} <select value={sort} disabled={sortHint !== null} onChange={(event) => setSort(event.target.value as ReviewerSort)}><option value="completion">{t("completion")}</option><option value="name">{t("nameAsc")}</option><option value="completed">{t("mostSubmissions")}</option><option value="fewest">{t("fewestLeft")}</option></select></label>{sortHint && <small role="status">{sortHint}</small>}</div></div>
    {visible.length === 0 ? <div className="panel empty-inline">{t("noReviewers")}</div> : <div className="reviewer-board-list">{visible.map((reviewer) => <button type="button" key={reviewer.reviewerId} className="reviewer-progress-row reviewer-progress-trigger" aria-label={t("viewReviewsBy", { name: reviewer.displayName })} onClick={() => setSelectedReviewer(rows.find((row) => row.reviewerId === reviewer.reviewerId) ?? null)}>
      <div className="reviewer-progress-identity"><span className="avatar avatar-soft">{reviewer.displayName.trim().slice(0, 1).toUpperCase()}</span><span><strong>{reviewer.displayName}</strong><small>{reviewer.submissionCount} {t("submissions")} · {t("goal")} {reviewer.reviewerSubmissionGoal == null ? t("goalNotAvailable") : Number(reviewer.reviewerSubmissionGoal.toFixed(2))}</small></span></div>
      <div className="reviewer-progress-meter"><div className="progress-track" role="progressbar" aria-label={t("reviewerGoalProgress", { name: reviewer.displayName })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={reviewer.percent}><div className="progress-fill" style={{ width: `${reviewer.percent}%` }} /></div></div>
      <div className="reviewer-progress-counts"><span className="reviewer-progress-percent">{reviewer.percent}%</span>{reviewer.submissionStatus && <span className={reviewer.submissionGoalMet ? "progress-status progress-status-complete" : "progress-status progress-status-pending"}>{reviewer.submissionStatus}</span>}</div>
    </button>)}</div>}
    {selectedReviewer && <ReviewerReviewsDrawer reviewer={selectedReviewer} onClose={() => setSelectedReviewer(null)} />}
  </section>;
}
