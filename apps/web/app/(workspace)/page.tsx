import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { serverApi } from "../../src/lib/api";
import { ReviewerProgressBoard } from "../../src/features/progress/reviewer-progress-board";
import { ReviewerGroupsManager } from "../../src/features/team/reviewer-groups-manager";
import { getPeopleRemainingForGoal } from "../../src/features/progress/reviewer-board";
import { roleMatchesAudience, signInPathForRole, workspacePathForRole } from "../../src/lib/workspace-access";
import { withSessionSelector } from "../../src/lib/session-url";
import { getLocale, getTranslations } from "next-intl/server";
import { formatNumber, type Locale } from "../../src/lib/locale";

export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations("metadata"); return { title: t("overview") }; }
type Summary = { activeTargets: number; assignedTargets: number; completedTargets: number; responseCount: number; unassignedTargets: number; targetCount: number; submissionGoal: number; activeReviewerCount: number; reviewerSubmissionGoal: number | null; reviewerSubmissionPercent: number; reviewerSubmissionRatio: number | null; reviewerSubmissionsRemaining: number | null; reviewerSubmissionGoalMet: boolean; submissionCompletionPercent: number; completionRule: string };
type ReviewerRow = { reviewerId: string; displayName: string; assigned: number; completed: number; submissionCount: number; reviewerSubmissionGoal: number | null; submissionRatio: number | null; submissionsRemaining: number | null; submissionPercent: number; submissionGoalMet: boolean };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const requestHeaders = await headers();
  const requestPath = requestHeaders.get("x-reviewroom-request-path") ?? "/";
  const audience = requestHeaders.get("x-reviewroom-audience") === "reviewer" ? "reviewer" : "admin";
  const selectedSessionId = requestHeaders.get("x-reviewroom-session-id");
  let sessionResponse: Response;
  try { sessionResponse = await serverApi("/auth/session"); } catch { redirect(`${signInPathForRole(audience)}?reason=service-unavailable`); }
  if (!sessionResponse.ok) redirect(signInPathForRole(audience));
  const session = sessionResponseSchema.safeParse(await sessionResponse.json());
  if (!session.success) redirect(`${signInPathForRole(audience)}?reason=session-invalid`);
  if (requestPath === "/") redirect(selectedSessionId ? withSessionSelector(audience === "reviewer" ? "/reviewer/progress" : "/admin/overview", selectedSessionId) : audience === "reviewer" ? "/reviewer/progress" : "/admin/overview");
  if (!roleMatchesAudience(session.data.role, audience)) redirect(`${signInPathForRole(audience)}?reason=wrong-workspace`);
  const reviewer = session.data.role === "REVIEWER";
  let summary: Summary | null = null;
  let reviewers: ReviewerRow[] = [];
  let error = false;
  try {
    const [summaryResponse, boardResponse] = await Promise.all([serverApi("/progress/summary"), reviewer ? Promise.resolve(null) : serverApi("/progress/reviewer-board")]);
    if (!summaryResponse.ok) throw new Error("unavailable");
    const body: { data: Summary } = await summaryResponse.json();
    summary = body.data;
    if (boardResponse?.ok) { const board: { data: ReviewerRow[] } = await boardResponse.json(); reviewers = board.data; }
  } catch { error = true; }
  const query = await searchParams;
  const href = (path: string) => workspacePathForRole(path, session.data.role);
  const t = await getTranslations("workspaceUi");
  const nav = await getTranslations("navigation");
  const locale = await getLocale() as Locale;
  const number = (value: number, maximumFractionDigits = 2) => formatNumber(value, locale, maximumFractionDigits);
  const noticeText = query.notice === "admin-only" ? t("roleNoticeAdmin") : query.notice === "wrong-workspace" ? t("roleNoticeWrong") : "";
  if (reviewer) return <div className="page-content">
    {noticeText && <p className="form-success" role="status">{noticeText}</p>}
    <div className="page-heading"><div><p className="eyebrow">{t("reviewerWorkspace")}</p><h1>{t("overviewReview")}</h1><p>{t("overviewReviewHelp")}</p></div><div className="button-row"><Link className="button" href={href("/submissions")}>{t("submissionsButton")}</Link><Link className="button button-primary" href={href("/my-link")}>{t("myFormLinks")}</Link></div></div>
    {error || !summary ? <div className="panel empty-state"><h2>{t("progressUnavailable")}</h2><p>{t("apiDatabaseHint")}</p></div> : <>
      <div className="stat-grid reviewer-stat-grid"><article className="stat-card"><label>{t("assignedToYou")}</label><strong>{number(summary.assignedTargets, 0)}</strong><small>{t("reviewQueue")}</small></article><article className="stat-card"><label>{t("completed")}</label><strong>{number(summary.completedTargets, 0)}</strong><small>{t("peopleReviewed")}</small></article><article className="stat-card"><label>{t("submissionsButton")}</label><strong>{number(summary.responseCount, 0)}</strong><small>{t("yourFeedback")}</small></article></div>
      <section className="progress-panel"><div className="progress-heading"><strong>{t("submissionProgress")}</strong><span>{number(summary.reviewerSubmissionPercent, 1)}%</span></div><div className="progress-track" role="progressbar" aria-label={t("submissionProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.reviewerSubmissionPercent}><div className="progress-fill" style={{ width: `${summary.reviewerSubmissionPercent}%` }} /></div><div className="progress-foot"><span>{number(summary.responseCount, 0)} / {summary.reviewerSubmissionGoal == null ? "—" : number(Number(summary.reviewerSubmissionGoal.toFixed(2)))} {nav("submissions").toLowerCase()}</span><span>{summary.reviewerSubmissionGoalMet ? t("goalMet") : summary.reviewerSubmissionsRemaining == null ? t("noReviewerGoal") : summary.reviewerSubmissionsRemaining === 1 ? t("oneSubmissionLeft") : t("submissionsLeft", { count: number(summary.reviewerSubmissionsRemaining, 0) })}</span></div></section>
      <div className="two-columns reviewer-next-steps"><section><div className="section-heading"><h2>{t("nextSteps")}</h2></div><div className="panel"><Link className="panel-row" href={href("/submissions")}><span className="step-dot">↗</span><span className="panel-row-main"><strong>{t("openSubmissions")}</strong><small>{t("continueReviewing")}</small></span></Link><Link className="panel-row" href={href("/my-link")}><span className="step-dot">↗</span><span className="panel-row-main"><strong>{t("shareFormLinks")}</strong><small>{t("linksTied")}</small></span></Link></div></section></div>
    </>}
  </div>;

  return <div className="page-content">
    <div className="page-heading"><div><p className="eyebrow">{t("overviewAdminEyebrow")}</p><h1>{t("overviewAdmin")}</h1><p>{t("overviewAdminHelp")}</p></div><div className="button-row"><Link className="button" href={href("/people")}>{nav("people")}</Link><Link className="button button-primary" href={href("/team")}>{t("manageAssignments")}</Link></div></div>
    {error || !summary ? <div className="panel empty-state"><h2>{t("progressUnavailable")}</h2><p>{t("apiDatabaseHint")}</p></div> : <>
      <div className="stat-grid"><article className="stat-card"><label>{t("reviewGoal")}</label><strong>{number(summary.targetCount, 0)}</strong><small>{t("peopleAdded", { active: number(summary.activeTargets, 0), remaining: number(getPeopleRemainingForGoal(summary.targetCount, summary.activeTargets), 0) })}</small></article><article className="stat-card"><label>{t("assignments")}</label><strong>{number(summary.assignedTargets, 0)}</strong><small>{t("awaitingReviewer", { count: number(summary.unassignedTargets, 0) })}</small></article><article className="stat-card"><label>{nav("people")}</label><strong>{number(summary.completedTargets, 0)}</strong><small>{t("uniqueReviewed")}</small></article><article className="stat-card"><label>{nav("submissions")}</label><strong>{number(summary.responseCount, 0)}</strong><small>{t("feedbackEntries")}</small></article></div>
      <section className="progress-panel"><div className="progress-heading"><strong>{t("workspaceGoalProgress")}</strong><span>{number(summary.submissionCompletionPercent, 1)}%</span></div><div className="progress-track" role="progressbar" aria-label={t("workspaceGoalProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.submissionCompletionPercent}><div className="progress-fill" style={{ width: `${summary.submissionCompletionPercent}%` }} /></div><div className="progress-foot"><span>{t("goalCount", { done: number(summary.responseCount, 0), goal: number(summary.submissionGoal, 0) })}</span></div></section>
      <ReviewerProgressBoard rows={reviewers} />
      <ReviewerGroupsManager compact />
      <div className="two-columns"><section><div className="section-heading"><h2>{t("nextSteps")}</h2><Link className="text-link" href={href("/settings")}>{t("adjustGoal")}</Link></div><div className="panel"><Link className="panel-row" href={href("/team") + "?state=unassigned"}><span className="step-dot">↗</span><span className="panel-row-main"><strong>{t("assignRemaining")}</strong><small>{t("assignmentHint")}</small></span></Link><Link className="panel-row" href={href("/team")}><span className="step-dot">↗</span><span className="panel-row-main"><strong>{t("inviteReviewers")}</strong><small>{t("secureTokens")}</small></span></Link><Link className="panel-row" href={href("/forms")}><span className="step-dot">↗</span><span className="panel-row-main"><strong>{t("prepareForm")}</strong><small>{t("publishFirst")}</small></span></Link></div></section><section><div className="section-heading"><h2>{t("workspaceControls")}</h2></div><div className="panel feature-panel"><span className="feature-kicker">{t("controlCenter")}</span><h3>{t("wholeReview")}</h3><p>{t("manageWorkspace")}</p><Link className="button button-small" href={href("/settings")}>{t("openSettings")}</Link></div></section></div>
    </>}
  </div>;
}
