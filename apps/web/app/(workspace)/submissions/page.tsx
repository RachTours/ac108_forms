import type { Metadata } from "next";
import { serverApi } from "../../../src/lib/api";
import { SubmissionsManager } from "../../../src/features/submissions/submissions-manager";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { requireWorkspaceRole } from "../../../src/lib/page-access";
import { activeReviewers } from "../../../src/features/people/available-reviewers";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations("metadata"); return { title: t("submissions") }; }
type Submission = { id: string; submittedAt: string; archivedAt?: string | null; reviewedAt: string | null; target: { id: string; displayName: string }; reviewedPersonName?: string; form: { id: string; title: string }; reviewer: { id: string; user: { displayName: string; email?: string } }; formVersion: { version: number } };
type Member = { id: string; role: string; status: string; user: { status: string; displayName: string; email: string } };
export default async function SubmissionsPage() {
  const t = await getTranslations("submissions");
  await requireWorkspaceRole(["OWNER", "ADMIN", "REVIEWER"]);
  let rows: Submission[] = []; let archivedRows: Submission[] = []; let reviewers: Member[] = []; let error = false; let canManage = false;
  try {
    const [response, sessionResponse, memberResponse] = await Promise.all([serverApi("/submissions?limit=100"), serverApi("/auth/session"), serverApi("/members")]);
    if (!response.ok) throw new Error();
    const body: { data: Submission[] } = await response.json(); rows = body.data;
    if (sessionResponse.ok) {
      const session = sessionResponseSchema.safeParse(await sessionResponse.json());
      canManage = !!session.success && session.data.role !== "REVIEWER";
    }
    if (canManage) {
      if (memberResponse.ok) { const memberBody: { data: Member[] } = await memberResponse.json(); reviewers = activeReviewers(memberBody.data); }
      const archivedResponse = await serverApi("/submissions/archived?limit=100");
      if (!archivedResponse.ok) throw new Error();
      const archivedBody: { data: Submission[] } = await archivedResponse.json(); archivedRows = archivedBody.data;
    }
  } catch { error = true; }
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p>{t("description")}</p></div><div className="count-chip">{rows.length} {t("responses")}</div></div>{error ? <div className="panel empty-state"><h2>{t("loadFailed")}</h2><p>{t("connectionHint")}</p></div> : <SubmissionsManager initialRows={rows} initialArchivedRows={archivedRows} reviewers={reviewers} canManage={canManage} />}</div>;
}
