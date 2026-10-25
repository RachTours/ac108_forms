import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { invitationAcceptInfoSchema } from "@reviewroom/contracts";
import { InvitationAcceptance } from "../../../src/features/auth/invitation-acceptance";
import { publicApi } from "../../../src/lib/api";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "../../../src/components/language-switcher";
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
  const navigation = await getTranslations("navigation");
  const copy = await getTranslations("invitation");
  const panelName = navigation(invitation?.role === "REVIEWER" ? "reviewerPanel" : "adminPanel");
  return { title: { absolute: `${copy("title")} | ${panelName}` }, robots: { index: false, follow: false } };
}
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await loadInvitation(token);
  if (!invitation) notFound();
  const navigation = await getTranslations("navigation");
  const copy = await getTranslations("invitation");
  const panelName = navigation(invitation.role === "REVIEWER" ? "reviewerPanel" : "adminPanel");
  return <main className="login-page"><section className="login-card"><LanguageSwitcher /><div className="brand"><span className="brand-mark">{invitation.role === "REVIEWER" ? "R" : "A"}</span><span>{panelName}</span></div><p className="eyebrow invite-eyebrow">{copy("title")}</p><h1>{copy("title")}</h1><p>{copy("description")}</p><InvitationAcceptance token={token} email={invitation.email} displayName={invitation.displayName} role={invitation.role} /></section></main>;
}
