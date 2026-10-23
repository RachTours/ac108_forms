import type { Metadata } from "next";
import { serverApi } from "../../../src/lib/api";
import { TeamManager } from "../../../src/features/team/team-manager";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { requireWorkspaceRole } from "../../../src/lib/page-access";

export const metadata: Metadata = { title: "Team access" };
type Member = { id: string; role: "OWNER" | "ADMIN" | "REVIEWER"; status: "ACTIVE" | "ARCHIVED"; user: { displayName: string; email: string }; assignedTargetCount: number };
type LinkRow = { id: string; reviewer: { id: string; name: string; email: string }; form: { id: string; title: string } | null; formId: string | null; createdAt: string; expiresAt: string | null; revokedAt: string | null; active: boolean; canReveal: boolean };
type FormSummary = { id: string; title: string; status: string };
type Invitation = { id: string; email: string | null; displayName: string | null; role: string; expiresAt: string; createdAt: string; expired: boolean; canReveal: boolean };
export default async function TeamPage() {
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  let members: Member[] = []; let links: LinkRow[] = []; let invitations: Invitation[] = []; let forms: FormSummary[] = []; let error = false; let isOwner = false;
  try { const [memberResponse, linkResponse, invitationResponse, sessionResponse, formResponse] = await Promise.all([serverApi("/members"), serverApi("/review-links"), serverApi("/members/invitations"), serverApi("/auth/session"), serverApi("/forms")]); if (!memberResponse.ok || !linkResponse.ok || !invitationResponse.ok || !formResponse.ok) throw new Error(); const memberBody: { data: Member[] } = await memberResponse.json(); const linkBody: { data: LinkRow[] } = await linkResponse.json(); const invitationBody: { data: Invitation[] } = await invitationResponse.json(); const formBody: { data: FormSummary[] } = await formResponse.json(); members = memberBody.data; links = linkBody.data; invitations = invitationBody.data; forms = formBody.data.filter((form) => form.status === "PUBLISHED"); if (sessionResponse.ok) { const session = sessionResponseSchema.safeParse(await sessionResponse.json()); isOwner = !!session.success && session.data.role === "OWNER"; } } catch { error = true; }
  return <div className="page-content team-page"><div className="page-heading"><div><p className="eyebrow">WORKSPACE ADMIN</p><h1>Team access</h1><p>Manage workspace access, reviewer assignments, and form links.</p></div><div className="count-chip">{members.filter((member) => member.status === "ACTIVE").length} active members</div></div>{error ? <div className="panel empty-state"><h2>Team access could not load</h2><p>Only workspace administrators can view team access. Check your role and try again.</p></div> : <TeamManager initialMembers={members} initialLinks={links} initialInvitations={invitations} forms={forms} isOwner={isOwner} />}</div>;
}
