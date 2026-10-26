import type { Metadata } from "next";
import { serverApi } from "../../../src/lib/api";
import { TeamManager } from "../../../src/features/team/team-manager";
import { invitationListResponseSchema, reviewerMemberListResponseSchema, sessionResponseSchema } from "@reviewroom/contracts";
import { requireWorkspaceRole } from "../../../src/lib/page-access";
import { getLocale, getTranslations } from "next-intl/server";
import { formatNumber, type Locale } from "../../../src/lib/locale";

export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations("metadata"); return { title: t("team") }; }
type Member = { id: string; role: "OWNER" | "ADMIN" | "REVIEWER"; status: "ACTIVE" | "ARCHIVED"; user: { displayName: string; email: string; status: "ACTIVE" | "ARCHIVED" }; assignedTargetCount: number };
type LinkRow = { id: string; reviewer: { id: string; name: string; email: string }; form: { id: string; title: string } | null; formId: string | null; createdAt: string; expiresAt: string | null; revokedAt: string | null; active: boolean; canReveal: boolean };
type FormSummary = { id: string; title: string; status: string };
type Invitation = { id: string; email: string | null; displayName: string | null; role: string; expiresAt: string; createdAt: string; expired: boolean; canReveal: boolean };
type SectionErrors = { invitations?: string; links?: string; forms?: string };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ search?: string; state?: string; reviewerId?: string }> }) {
  const t = await getTranslations("team");
  const locale = await getLocale() as Locale;
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
    const parsed = reviewerMemberListResponseSchema.safeParse(await memberResult.value.json());
    if (parsed.success) members = parsed.data.data;
    else memberError = true;
  } else memberError = true;
  if (sessionResult.status === "fulfilled" && sessionResult.value.ok) {
    const session = sessionResponseSchema.safeParse(await sessionResult.value.json());
    isOwner = !!session.success && session.data.role === "OWNER";
  }

  const [linkResult, invitationResult, formResult] = await Promise.allSettled([serverApi("/review-links"), serverApi("/members/invitations"), serverApi("/forms")]);
  if (linkResult.status === "fulfilled" && linkResult.value.ok) links = ((await linkResult.value.json()) as { data: LinkRow[] }).data;
  else sectionErrors.links = t("linksLoadError");
  if (invitationResult.status === "fulfilled" && invitationResult.value.ok) {
    const parsed = invitationListResponseSchema.safeParse(await invitationResult.value.json());
    if (parsed.success) invitations = parsed.data.data;
    else sectionErrors.invitations = t("invitationLoadError");
  } else sectionErrors.invitations = t("invitationLoadError");
  if (formResult.status === "fulfilled" && formResult.value.ok) forms = ((await formResult.value.json()) as { data: FormSummary[] }).data.filter((form) => form.status === "PUBLISHED");
  else sectionErrors.forms = t("formsLoadError");

  return <div className="page-content team-page">
    <div className="page-heading"><div><p className="eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p>{t("description")}</p></div><div className="count-chip">{formatNumber(members.filter((member) => member.status === "ACTIVE").length, locale, 0)} {t("activeMembers")}</div></div>
    {memberError ? <div className="panel empty-state"><h2>{t("membersLoadFailed")}</h2><p>{t("adminApiHint")}</p></div> : <TeamManager initialMembers={members} initialLinks={links} initialInvitations={invitations} forms={forms} isOwner={isOwner} sectionErrors={sectionErrors} assignmentSearch={assignmentQuery.toString()} />}
  </div>;
}
