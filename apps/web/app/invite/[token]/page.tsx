import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { invitationAcceptInfoSchema } from "@reviewroom/contracts";
import { InvitationAcceptance } from "../../../src/features/auth/invitation-acceptance";
import { publicApi } from "../../../src/lib/api";
type Invitation = typeof invitationAcceptInfoSchema._output.data;
const loadInvitation = cache(async (token: string): Promise<Invitation | null> => {
  try {
    const response = await publicApi(`/members/invitations/${encodeURIComponent(token)}`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const parsed = invitationAcceptInfoSchema.safeParse(body);
    return parsed.success ? parsed.data.data : null;
  } catch {
    return null;
  }
});
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const invitation = await loadInvitation(token);
  const panelName = invitation?.role === "REVIEWER" ? "Reviewer Panel" : "Admin Panel";
  return { title: { absolute: `Account setup | ${panelName}` }, robots: { index: false, follow: false } };
}
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await loadInvitation(token);
  if (!invitation) notFound();
  const panelName = invitation.role === "REVIEWER" ? "Reviewer Panel" : "Admin Panel";
  return <main className="login-page"><section className="login-card"><div className="brand"><span className="brand-mark">{invitation.role === "REVIEWER" ? "R" : "A"}</span><span>{panelName}</span></div><p className="eyebrow invite-eyebrow">TEAM ACCESS TOKEN</p><h1>Join the review team.</h1><p>{invitation.email ? <>This invitation is for <strong>{invitation.email}</strong> as a {invitation.role.toLowerCase()}.</> : <>This single-use token grants <strong>{invitation.role.toLowerCase()}</strong> access to the workspace. Create your account to join.</>}</p><InvitationAcceptance token={token} email={invitation.email} displayName={invitation.displayName} role={invitation.role} /></section></main>;
}
