import type { Metadata } from "next";
import { serverApi } from "../../../src/lib/api";
import { PeopleManager } from "../../../src/features/people/people-manager";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { requireWorkspaceRole } from "../../../src/lib/page-access";
import { activeReviewers } from "../../../src/features/people/available-reviewers";

export const metadata: Metadata = { title: "Review targets" };

type Target = { id: string; displayName: string; email: string | null; assignedReviewer: { membershipId: string; displayName: string; email: string } | null; submissionCount: number };
type Member = { id: string; role: string; status: string; user: { displayName: string; email: string } };
export default async function PeoplePage() {
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  let targets: Target[] = []; let nextCursor: string | null = null; let members: Member[] = []; let failed = false; let canManage = false;
  try { const [targetResponse, memberResponse, sessionResponse] = await Promise.all([serverApi("/review-targets?limit=100"), serverApi("/members"), serverApi("/auth/session")]); if (!targetResponse.ok) throw new Error(); const targetBody: { data: Target[]; nextCursor: string | null } = await targetResponse.json(); targets = targetBody.data; nextCursor = targetBody.nextCursor; if (memberResponse.ok) { const body: { data: Member[] } = await memberResponse.json(); members = activeReviewers(body.data); } if (sessionResponse.ok) { const session = sessionResponseSchema.safeParse(await sessionResponse.json()); canManage = !!session.success && session.data.role !== "REVIEWER"; } } catch { failed = true; }
  return <div className="page-content people-page"><div className="page-heading"><div><p className="eyebrow">PEOPLE & ASSIGNMENTS</p><h1>Review targets</h1><p>Add the people being reviewed, then assign each to an active reviewer.</p></div><div className="count-chip">{targets.length}{nextCursor ? "+" : ""} people loaded</div></div>{failed ? <div className="panel empty-state"><h2>Targets could not load</h2><p>Check the API and try again.</p></div> : <PeopleManager initialTargets={targets} initialCursor={nextCursor} reviewers={members} canManage={canManage} />}</div>;
}
