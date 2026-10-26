"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import { assignmentListResponseSchema, assignmentMutationResponseSchema, assignmentRemoveResponseSchema } from "@reviewroom/contracts";
import { useApi } from "../../lib/client-api";
import { buildAssignmentListUrl, readAssignmentFilters, type AssignmentState } from "./assignment-view";
import { useTranslations } from "next-intl";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { withSessionSelector } from "../../lib/session-url";

type Reviewer = { id: string; user: { displayName: string; email: string } };
type AssignmentTarget = {
  id: string;
  displayName: string;
  email: string | null;
  assignment: { id: string; reviewerId: string; updatedAt: string; reviewer: { displayName: string; email: string } } | null;
};
type AssignmentPage = { data: AssignmentTarget[]; nextCursor: string | null; counts: { total: number; assigned: number; unassigned: number } };

export function ReviewerAssignmentManager({ reviewers, onAssignmentsChanged, initialSearch }: { reviewers: Reviewer[]; onAssignmentsChanged: () => void; initialSearch: string }) {
  const t = useTranslations("team");
  const api = useApi();
  const session = useWorkspaceSession();
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
    window.history.replaceState(null, "", withSessionSelector(`${window.location.pathname}${queryUrl.slice("/assignments".length)}`, session.sessionId));
  }, [search, state, reviewerId, session.sessionId]);

  useEffect(() => {
    let active = true;
    const url = buildAssignmentListUrl({ search: debouncedSearch, state, reviewerId, cursor });
    api<AssignmentPage>(url, {}, assignmentListResponseSchema)
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
      .catch(() => { if (active) setRequestError(t("assignmentsLoadFailed")); })
      .finally(() => { if (active) setLoadedRequestKey(requestKey); });
    return () => { active = false; };
  }, [api, requestKey, debouncedSearch, state, reviewerId, cursor, t]);

  function resetList() {
    setCursor(null);
    setRefreshVersion((version) => version + 1);
  }

  async function save(target: AssignmentTarget) {
    const nextReviewerId = selectedReviewers[target.id] ?? "";
    if (!nextReviewerId) { if (target.assignment) await unassign(target); return; }
    if (nextReviewerId === target.assignment?.reviewerId) return;
    const nextReviewer = reviewers.find((reviewer) => reviewer.id === nextReviewerId);
    if (!nextReviewer) return;
    if (target.assignment && !window.confirm(t("reassignConfirm", { person: target.displayName, from: target.assignment.reviewer.displayName, to: nextReviewer.user.displayName }))) return;
    setBusyTarget(target.id);
    setRequestError("");
    try {
      await api(`/assignments/${target.id}`, { method: "PUT", body: JSON.stringify({ reviewerId: nextReviewerId, expectedUpdatedAt: target.assignment?.updatedAt ?? null }) }, assignmentMutationResponseSchema);
      onAssignmentsChanged();
      resetList();
    } catch (err) {
      setRequestError(t("assignmentSaveFailed"));
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
      await api(`/assignments/${target.id}`, { method: "DELETE", body: JSON.stringify({ expectedUpdatedAt: target.assignment.updatedAt }) }, assignmentRemoveResponseSchema);
      onAssignmentsChanged();
      setSelectedReviewers((current) => ({ ...current, [target.id]: "" }));
      resetList();
    } catch (err) {
      setRequestError(t("assignmentRemoveFailed"));
      resetList();
    } finally {
      setBusyTarget(null);
    }
  }

  return <section className="reviewer-assignment-workspace" aria-labelledby="reviewer-assignments-heading">
      <div className="section-heading assignment-workspace-heading">
      <div><p className="eyebrow">{t("teamWorkflow")}</p><h2 id="reviewer-assignments-heading">{t("reviewerAssignments")}</h2><p className="muted-caption">{t("assignmentHelp")}</p></div>
      <div className="assignment-count-summary"><span>{counts.assigned} {t("assigned")}</span><span>{counts.unassigned} {t("unassigned")}</span><span>{counts.total} {t("people")}</span></div>
    </div>
    {reviewers.length === 0 && <div className="permission-note" role="status"><UserRound size={16} /><span><strong>{t("noReviewers")}</strong><small>{t("addReviewerHelp")}</small></span></div>}
    <div className="assignment-workspace-filters">
      <label className="search-box reviewer-assignment-search"><Search size={15} /><input aria-label={t("searchPeople")} placeholder={t("searchPeople")} value={search} onChange={(event) => { setRequestError(""); setSearch(event.target.value); setCursor(null); }} /></label>
      <label className="assignment-reviewer-filter"><span>{t("reviewer")}</span><select aria-label={t("reviewer")} value={reviewerId} onChange={(event) => { setRequestError(""); setReviewerId(event.target.value); setCursor(null); }}><option value="">{t("allReviewers")}</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName}</option>)}</select></label>
    </div>
    <div className="assignment-summary assignment-state-filters" role="group" aria-label={t("filterAssignments")}>{(["all", "assigned", "unassigned"] as const).map((value) => <button key={value} type="button" className={state === value ? "assignment-filter active" : "assignment-filter"} aria-pressed={state === value} onClick={() => { setRequestError(""); setState(value); setCursor(null); }}>{value === "all" ? t("allPeople") : t(value)}</button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && targets.length === 0 ? <div className="panel empty-inline" role="status">{t("loadingAssignments")}</div> : targets.length === 0 ? <div className="panel empty-inline">{error ? t("assignmentsLoadFailed") : debouncedSearch ? t("noMatches") : state === "unassigned" ? t("everyoneAssigned") : t("noPeopleYet")}{!debouncedSearch && targets.length === 0 && <Link href="/admin/people" className="text-link"> {t("people")}</Link>}</div> : <div className="assignment-workspace-list" aria-busy={loading}>
      {targets.map((target) => {
        const selected = selectedReviewers[target.id] ?? target.assignment?.reviewerId ?? "";
        const hasChanges = selected !== (target.assignment?.reviewerId ?? "");
        return <article className="assignment-workspace-row" key={target.id}>
          <span className="avatar avatar-soft" aria-hidden="true">{target.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
          <span className="assignment-workspace-person"><strong>{target.displayName}</strong><small>{target.email ?? t("noEmail")}</small></span>
          <span className="assignment-workspace-current"><small>{t("currentlyAssigned")}</small><strong>{target.assignment?.reviewer.displayName ?? t("unassigned")}</strong></span>
          <label className="assignment-workspace-select"><span>{t("assignReviewer")}</span><select aria-label={`${t("assignReviewer")} · ${target.displayName}`} value={selected} onChange={(event) => setSelectedReviewers((current) => ({ ...current, [target.id]: event.target.value }))} disabled={reviewers.length === 0 || busyTarget !== null}><option value="">{t("noneUnassigned")}</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.user.displayName}</option>)}</select></label>
          <span className="assignment-workspace-actions"><button type="button" className="button button-small button-primary" disabled={!hasChanges || busyTarget !== null} onClick={() => void save(target)}>{busyTarget === target.id ? t("saving") : target.assignment ? t("saveChange") : t("assign")}</button>{target.assignment && <button type="button" className="button button-small" disabled={busyTarget !== null} onClick={() => void unassign(target)}>{t("unassign")}</button>}</span>
        </article>;
      })}
    </div>}
    {nextCursor && <div className="load-more-row"><button type="button" className="button button-small" disabled={loading} onClick={() => { setRequestError(""); setCursor(nextCursor); }}>{loading ? t("loading") : t("loadMorePeople")}</button></div>}
  </section>;
}
