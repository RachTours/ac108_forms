import type { Metadata } from "next";
import { serverApi } from "../../../src/lib/api";
import { TeamManager } from "../../../src/features/team/team-manager";
import { invitationListResponseSchema, memberListResponseSchema, sessionResponseSchema } from "@reviewroom/contracts";
import { requireWorkspaceRole } from "../../../src/lib/page-access";

export const metadata: Metadata = { title: "Team access" };
type Member = { id: string; role: "OWNER" | "ADMIN" | "REVIEWER"; status: "ACTIVE" | "ARCHIVED"; user: { displayName: string; email: string; status: "ACTIVE" | "ARCHIVED" }; assignedTargetCount: number };
type LinkRow = { id: string; reviewer: { id: string; name: string; email: string }; form: { id: string; title: string } | null; formId: string | null; createdAt: string; expiresAt: string | null; revokedAt: string | null; active: boolean; canReveal: boolean };
type FormSummary = { id: string; title: string; status: string };
type Invitation = { id: string; email: string | null; displayName: string | null; role: string; expiresAt: string; createdAt: string; expired: boolean; canReveal: boolean };
type SectionErrors = { invitations?: string; links?: string; forms?: string };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ search?: string; state?: string; reviewerId?: string }> }) {
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  const query = await searchParams;
  const assignmentQuery = new URLSearchParams();
  if (query.search) assignmentQuery.set("search", query.search);
  if (query.state) assignmentQuery.set("state", query.state);
  if (query.reviewerId) assignmentQuery.set("reviewerId", query.reviewerId);
  let members: Member[] = [];
  let links: LinkRow[] = [];
  let invitations: Invitation[] = [];
  let forms: FormSummary[] = [];
  let memberError = false;
  let isOwner = false;
  const sectionErrors: SectionErrors = {};

  const [memberResult, sessionResult] = await Promise.allSettled([serverApi("/members"), serverApi("/auth/session")]);
  if (memberResult.status === "fulfilled" && memberResult.value.ok) {
    const parsed = memberListResponseSchema.safeParse(await memberResult.value.json());
    if (parsed.success) members = parsed.data.data;
    else memberError = true;
  } else memberError = true;
  if (sessionResult.status === "fulfilled" && sessionResult.value.ok) {
    const session = sessionResponseSchema.safeParse(await sessionResult.value.json());
    isOwner = !!session.success && session.data.role === "OWNER";
  }

  const [linkResult, invitationResult, formResult] = await Promise.allSettled([serverApi("/review-links"), serverApi("/members/invitations"), serverApi("/forms")]);
  if (linkResult.status === "fulfilled" && linkResult.value.ok) links = ((await linkResult.value.json()) as { data: LinkRow[] }).data;
  else sectionErrors.links = "Form share links could not load. Member and assignment management remain available.";
  if (invitationResult.status === "fulfilled" && invitationResult.value.ok) {
    const parsed = invitationListResponseSchema.safeParse(await invitationResult.value.json());
    if (parsed.success) invitations = parsed.data.data;
    else sectionErrors.invitations = "Pending access tokens returned an invalid response. Member and assignment management remain available.";
  } else sectionErrors.invitations = "Pending access tokens could not load. Member and assignment management remain available.";
  if (formResult.status === "fulfilled" && formResult.value.ok) forms = ((await formResult.value.json()) as { data: FormSummary[] }).data.filter((form) => form.status === "PUBLISHED");
  else sectionErrors.forms = "Published forms could not load. Existing team links remain visible.";

  return <div className="page-content team-page">
    <div className="page-heading"><div><p className="eyebrow">WORKSPACE ADMIN</p><h1>Team access</h1><p>Manage people on your team, reviewer assignments, and form links.</p></div><div className="count-chip">{members.filter((member) => member.status === "ACTIVE").length} active members</div></div>
    {memberError ? <div className="panel empty-state"><h2>Team members could not load</h2><p>Check your admin access and the API, then refresh this page.</p></div> : <TeamManager initialMembers={members} initialLinks={links} initialInvitations={invitations} forms={forms} isOwner={isOwner} sectionErrors={sectionErrors} assignmentSearch={assignmentQuery.toString()} />}
  </div>;
}
