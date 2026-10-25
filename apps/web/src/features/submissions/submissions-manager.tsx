"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Archive, Check, CheckCheck, ClipboardList, Download, RotateCcw, Trash2, X } from "lucide-react";
import { submissionReportResponseSchema, type FormSummary } from "@reviewroom/contracts";
import { useApi } from "../../lib/client-api";
import { ApiClientError } from "../../lib/api-client";
import { formatDate } from "../../lib/date-format";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { workspacePathForRole } from "../../lib/workspace-access";

type Submission = { id: string; submittedAt: string; archivedAt?: string | null; reviewedAt: string | null; target: { id: string; displayName: string }; reviewedPersonName?: string; form: { id: string; title: string }; reviewer: { id: string; user: { displayName: string; email?: string } }; formVersion: { version: number } };
type Reviewer = { id: string; role: string; status: string; user: { displayName: string; email: string } };
type View = "active" | "archived";

type Report = { rows: Array<{ formId: string; formTitle: string; reviewerId: string; reviewerName: string; submissionCount: number; completedPeople: number; reviewedSubmissionCount: number }>; totals: { submissionCount: number; completedPeople: number; reviewedSubmissionCount: number } };

export function SubmissionsManager({ initialRows, initialArchivedRows, reviewers, forms, canManage }: { initialRows: Submission[]; initialArchivedRows: Submission[]; reviewers: Reviewer[]; forms: FormSummary[]; canManage: boolean }) {
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false); const [reportFrom, setReportFrom] = useState(""); const [reportTo, setReportTo] = useState(""); const [reportFormId, setReportFormId] = useState(""); const [reportReviewerId, setReportReviewerId] = useState(""); const [report, setReport] = useState<Report | null>(null); const [reportBusy, setReportBusy] = useState(false);
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
  const visibleIds = visibleRows.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    const visible = new Set(visibleIds);
    setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visible.has(id)) : [...new Set([...current, ...visibleIds])]);
  }

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

  async function archiveSelected() {
    if (selectedIds.length === 0 || selectedIds.length > 100) return;
    if (!window.confirm(`Archive ${selectedIds.length} selected ${selectedIds.length === 1 ? "review" : "reviews"}? They will leave the active inbox and remain available in Archived.`)) return;
    setError(""); setNotice(""); setBusyId("bulk");
    try {
      const result = await api<{ data: { archivedIds: string[] } }>("/submissions/archive-batch", { method: "POST", body: JSON.stringify({ submissionIds: selectedIds }) });
      const archivedAt = new Date().toISOString();
      const archivedSet = new Set(result.data.archivedIds);
      const archived = sourceRows.filter((row) => archivedSet.has(row.id)).map((row) => ({ ...row, archivedAt }));
      setRows((items) => items.filter((row) => !archivedSet.has(row.id)));
      setArchivedRows((items) => [...archived, ...items.filter((row) => !archivedSet.has(row.id))]);
      setReviewerData((current) => current ? { ...current, rows: current.rows.filter((row) => !archivedSet.has(row.id)) } : current);
      setSelectedIds((current) => current.filter((id) => !archivedSet.has(id)));
      setNotice(`${archivedSet.size} ${archivedSet.size === 1 ? "review" : "reviews"} archived. Restore them from the Archived view any time.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Selected reviews could not be archived."); }
    finally { setBusyId(null); }
  }

  async function deleteSelected() {
    if (selectedIds.length === 0 || selectedIds.length > 100) return;
    const confirmation = window.prompt(`Permanently delete ${selectedIds.length} selected ${selectedIds.length === 1 ? "review" : "reviews"} and their answers? This cannot be undone. Type DELETE to confirm.`);
    if (confirmation !== "DELETE") return;
    setError(""); setNotice(""); setBusyId("bulk-delete");
    let deletedIds: string[] = [];
    try {
      try {
        const result = await api<{ data: { deletedIds: string[] } }>("/submissions/permanent-batch", { method: "POST", body: JSON.stringify({ submissionIds: selectedIds }) });
        deletedIds = result.data.deletedIds;
      } catch (cause) {
        // Older API deployments lack the batch route. Reuse the established single-delete route in that case.
        if (!(cause instanceof ApiClientError) || cause.status !== 404 || cause.code !== "NOT_FOUND") throw cause;
        for (const id of selectedIds) {
          await api(`/submissions/${id}/permanent`, { method: "DELETE" });
          deletedIds.push(id);
        }
      }
      const deletedSet = new Set(deletedIds);
      setRows((items) => items.filter((row) => !deletedSet.has(row.id)));
      setArchivedRows((items) => items.filter((row) => !deletedSet.has(row.id)));
      setReviewerData((current) => current ? { ...current, rows: current.rows.filter((row) => !deletedSet.has(row.id)) } : current);
      setSelectedIds((current) => current.filter((id) => !deletedSet.has(id)));
      setNotice(`${deletedSet.size} ${deletedSet.size === 1 ? "review" : "reviews"} and their answers permanently deleted.`);
    } catch (cause) {
      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setRows((items) => items.filter((row) => !deletedSet.has(row.id)));
        setArchivedRows((items) => items.filter((row) => !deletedSet.has(row.id)));
        setReviewerData((current) => current ? { ...current, rows: current.rows.filter((row) => !deletedSet.has(row.id)) } : current);
        setSelectedIds((current) => current.filter((id) => !deletedSet.has(id)));
        setError(`${deletedIds.length} selected ${deletedIds.length === 1 ? "review was" : "reviews were"} deleted before the remaining request failed. Refresh the page and retry the remaining selection.`);
      } else setError(cause instanceof Error ? cause.message : "Selected reviews could not be permanently deleted.");
    }
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

  function reportQuery() {
    const query = new URLSearchParams();
    if (reportFrom) query.set("from", reportFrom);
    if (reportTo) query.set("to", reportTo);
    if (reportFormId) query.set("formId", reportFormId);
    if (reportReviewerId) query.set("reviewerId", reportReviewerId);
    return query;
  }

  async function loadReport() {
    setReportBusy(true); setError("");
    try { const result = await api(`/reports/submissions?${reportQuery()}`, {}, submissionReportResponseSchema); setReport(result.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Report could not be loaded."); }
    finally { setReportBusy(false); }
  }

  async function exportReport() {
    setReportBusy(true); setError("");
    try {
      const headers = new Headers({ "X-Reviewroom-Audience": "admin" });
      if (session.sessionId) headers.set("X-Reviewroom-Session-Id", session.sessionId);
      const response = await fetch(`/api/v1/reports/submissions.csv?${reportQuery()}`, { headers, credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("The summary export could not be downloaded.");
      const href = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = href; anchor.download = "submission-report.csv"; anchor.click(); URL.revokeObjectURL(href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Report export could not be downloaded."); }
    finally { setReportBusy(false); }
  }

  return <>
    {canManage && <div className="manager-toolbar"><button type="button" className={showReport ? "filter-pill active" : "filter-pill"} onClick={() => setShowReport((value) => !value)}>{showReport ? "Back to submissions" : "Summary report"}</button></div>}
    {showReport && canManage ? <section className="panel submission-report"><div className="section-heading"><div><p className="eyebrow">REPORTING</p><h2>Submission summary</h2><p>Summary metrics only. Answer contents are never included.</p></div><button type="button" className="button button-small" disabled={!report || reportBusy} onClick={() => void exportReport()}><Download size={14} /> Export CSV</button></div><div className="report-filters"><label>From<input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label><label>To<input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label><label>Form<select value={reportFormId} onChange={(event) => setReportFormId(event.target.value)}><option value="">All forms</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}</select></label><label>Reviewer<select value={reportReviewerId} onChange={(event) => setReportReviewerId(event.target.value)}><option value="">All reviewers</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName}</option>)}</select></label><button type="button" className="button button-primary" disabled={reportBusy || Boolean(reportFrom && reportTo && reportFrom > reportTo)} onClick={() => void loadReport()}>{reportBusy ? "Loading…" : "Run report"}</button></div>{report && <><div className="report-totals"><div><small>Submissions</small><strong>{report.totals.submissionCount}</strong></div><div><small>People completed</small><strong>{report.totals.completedPeople}</strong></div><div><small>Reviewed submissions</small><strong>{report.totals.reviewedSubmissionCount}</strong></div></div>{report.rows.length ? <div className="table-wrap"><table><thead><tr><th>Form</th><th>Reviewer</th><th>Submissions</th><th>People completed</th><th>Reviewed</th></tr></thead><tbody>{report.rows.map((row) => <tr key={`${row.formId}:${row.reviewerId}`}><td>{row.formTitle}</td><td>{row.reviewerName}</td><td>{row.submissionCount}</td><td>{row.completedPeople}</td><td>{row.reviewedSubmissionCount}</td></tr>)}</tbody></table></div> : <p className="muted-caption">No submissions match these filters.</p>}</>}</section> : <>
    {canManage && <div className="manager-toolbar submission-view-toolbar">
      <div className="filter-pills" aria-label="Submission views">
        <button type="button" className={view === "active" ? "filter-pill active" : "filter-pill"} onClick={() => { setSelectedIds([]); setView("active"); }}>Active</button>
        <button type="button" className={view === "archived" ? "filter-pill active" : "filter-pill"} onClick={() => { setSelectedIds([]); setView("archived"); }}>Archived <span>{archivedRows.length}</span></button>
      </div>
      <label className="reviewer-submission-filter"><span>Reviewer</span><select aria-label="Filter submissions by reviewer" value={reviewerFilter} onChange={(event) => { setSelectedIds([]); setReviewerFilter(event.target.value); }}><option value="">All reviewers</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName} · {reviewer.user.email}</option>)}</select></label>
      {view === "active" && <div className="filter-pills" aria-label="Filter active submissions">{(["all", "unread", "read"] as const).map((value) => <button type="button" key={value} className={filter === value ? "filter-pill active" : "filter-pill"} onClick={() => { setSelectedIds([]); setFilter(value); }}>{value === "all" ? "All responses" : value === "read" ? "Reviewed" : "Needs review"}</button>)}</div>}
      <span className="muted-caption">{loadingReviewer ? "Loading…" : visibleRows.length + " shown"}</span>
    </div>}
    {!canManage && <div className="manager-toolbar"><div className="filter-pills" aria-label="Filter submissions">{(["all", "unread", "read"] as const).map((value) => <button type="button" key={value} className={filter === value ? "filter-pill active" : "filter-pill"} onClick={() => setFilter(value)}>{value === "all" ? "All responses" : value === "read" ? "Reviewed" : "Needs review"}</button>)}</div><span className="muted-caption">{visibleRows.length} shown</span></div>}
    {canManage && !loadingReviewer && <div className="submission-bulk-toolbar"><label className="submission-select-all"><input type="checkbox" aria-label="Select all displayed submissions" checked={allVisibleSelected} disabled={visibleIds.length === 0 || busyId !== null} onChange={toggleAllVisible} /><span>{allVisibleSelected ? "Clear visible selection" : `Select all ${visibleIds.length} shown`}</span></label>{selectedIds.length > 0 && <div className="submission-bulk-actions"><span aria-live="polite">{selectedIds.length} selected</span>{view === "active" && <button type="button" className="button button-small" disabled={busyId !== null || selectedIds.length > 100} onClick={() => void archiveSelected()}><Archive size={13} /> {busyId === "bulk" ? "Archiving…" : "Archive"}</button>}<button type="button" className="button button-small danger-action" disabled={busyId !== null || selectedIds.length > 100} onClick={() => void deleteSelected()}><Trash2 size={13} /> {busyId === "bulk-delete" ? "Deleting…" : "Delete permanently"}</button><button type="button" className="icon-button" aria-label="Clear selection" title="Clear selection" disabled={busyId !== null} onClick={() => setSelectedIds([])}><X size={14} /></button></div>}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {loadingReviewer ? <div className="panel empty-state"><h2>Loading reviewer reviews</h2><p>Getting the selected reviewer’s submissions.</p></div> : visibleRows.length === 0 ? <div className="panel empty-state"><span className="empty-icon"><ClipboardList /></span><h2>{view === "archived" ? "No archived reviews" : "No responses in this view"}</h2><p>{view === "archived" ? "Archived reviews stay here until you restore or permanently delete them." : "Submitted feedback will appear here."}</p></div> :
      <div className="panel submission-list">{visibleRows.map((row) => <article className={`submission-row ${canManage ? "submission-row-managed" : ""} ${selectedIds.includes(row.id) ? "submission-row-selected" : ""}`} key={row.id}>
        {canManage && <label className="submission-select"><input type="checkbox" aria-label={`Select review for ${row.reviewedPersonName || row.target.displayName}`} checked={selectedIds.includes(row.id)} disabled={busyId !== null} onChange={() => toggleSelected(row.id)} /></label>}
        <span className={`submission-status ${row.reviewedAt ? "read" : ""}`}>{row.reviewedAt ? <CheckCheck size={15} /> : <ClipboardList size={15} />}</span>
        <Link className="submission-main" href={`${workspacePathForRole(`/submissions/${row.id}`, session.role)}${view === "archived" ? "?archived=true" : ""}`}><strong>{row.reviewedPersonName || row.target.displayName}</strong><small>{row.form.title} · Submitted by {row.reviewer.user.displayName} · Version {row.formVersion.version}</small></Link>
        <time className="submission-date">{formatDate(row.submittedAt)}</time>
        {view === "archived" ? <span className="status status-pending submission-state">Archived</span> : <span className={`status submission-state ${row.reviewedAt ? "" : "status-pending"}`}>{row.reviewedAt ? "Reviewed" : "Needs review"}</span>}
        {view === "active" && <button className="button button-small submission-mark-action" disabled={busyId !== null} onClick={() => void toggle(row)}><Check size={13} /> {row.reviewedAt ? "Reopen" : "Mark reviewed"}</button>}
        {canManage && view === "archived" && <button type="button" className="button button-small submission-restore-action" disabled={busyId !== null} onClick={() => void restore(row)}><RotateCcw size={13} /> Restore</button>}
      </article>)}</div>}
    {canManage && reviewerCursor && !loadingReviewer && <div className="load-more-row"><button type="button" className="button button-small" disabled={loadingMore} onClick={() => void loadMoreReviewerRows()}>{loadingMore ? "Loading…" : "Load more reviewer reviews"}</button></div>}
    </>}
  </>;
}
