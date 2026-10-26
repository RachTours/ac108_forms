"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Files, LayoutDashboard, Link2, LogOut, Settings2, UsersRound, UserRoundCog } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SessionResponse } from "@reviewroom/contracts";
import { createContext, useContext, useState } from "react";
import { getNavigationForRole, homePathForRole, signInPathForRole } from "../lib/workspace-access";
import { workspaceThemeCssVariables, type safeWorkspaceTheme } from "../lib/workspace-theme";
import { withSessionSelector, workspaceNavigationTarget } from "../lib/session-url";
import { requestSignOut, signOutErrorMessage } from "../lib/sign-out";
import { LanguageSwitcher } from "./language-switcher";
import { PlatformThemeToggle } from "./platform-theme-toggle";

const SessionContext = createContext<SessionResponse | null>(null);
export function useWorkspaceSession(): SessionResponse {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Workspace session is unavailable.");
  return session;
}

export function WorkspaceShell({ session, theme, children }: { session: SessionResponse; theme: ReturnType<typeof safeWorkspaceTheme>; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const t = useTranslations("navigation");
  const icons: Record<string, typeof LayoutDashboard> = { "Overview": LayoutDashboard, "People": UsersRound, "Submissions": ClipboardList, "My form links": Link2, "Forms": Files, "Team access": UserRoundCog, "Settings": Settings2 };
  const navLabels: Record<string, string> = { "Overview": t("overview"), "People": t("people"), "Submissions": t("submissions"), "My form links": t("myLinks"), "Forms": t("forms"), "Team access": t("team"), "Settings": t("settings") };
  const navigation = getNavigationForRole(session.role).map((item) => ({ ...item, label: navLabels[item.label] ?? item.label, icon: icons[item.label]! }));
  const panelName = t(session.role === "REVIEWER" ? "reviewerPanel" : "adminPanel");
  const roleLabel = t(session.role === "OWNER" ? "roleOwner" : session.role === "ADMIN" ? "roleAdmin" : "roleReviewer");

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(undefined);
    try {
      const response = await requestSignOut(session);
      if (response.ok || response.status === 401) {
        window.location.replace(signInPathForRole(session.role));
        return;
      }
      setSignOutError(await signOutErrorMessage(response));
    } catch {
      setSignOutError("The sign-out service could not be reached. Check your connection and try again.");
    } finally {
      setSigningOut(false);
    }
  }

  function preserveTabSession(event: React.MouseEvent<HTMLDivElement>) {
    if (!session.sessionId) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const destination = workspaceNavigationTarget(`${url.pathname}${url.search}${url.hash}`, session.sessionId);
    if (!destination) return;
    event.preventDefault();
    router.push(destination);
  }

  const active = navigation.find((item) => item.href === pathname || (item.href !== "/admin/overview" && item.href !== "/reviewer/progress" && pathname.startsWith(`${item.href}/`)))?.label ?? t("workspace");
  const initials = session.user.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  return <SessionContext.Provider value={session}><div className="app-shell" onClickCapture={preserveTabSession} style={workspaceThemeCssVariables(theme) as React.CSSProperties}>
    <aside className="sidebar" aria-label={t("workspace")}>
      <Link className="brand" href={withSessionSelector(homePathForRole(session.role), session.sessionId)}><span className="brand-mark">{session.role === "REVIEWER" ? "R" : "A"}</span><span>{panelName}</span></Link>
      <div className="nav-label">{t("workspace")}</div>
      <nav className="nav-list" aria-label={t("main")}>
        {navigation.map(({ href, label, icon: Icon }) => <Link key={href} className="nav-link" href={withSessionSelector(href, session.sessionId)} aria-current={pathname === href ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
      </nav>
      <div className="side-profile"><span className="avatar" aria-hidden="true">{initials || "U"}</span><div><strong>{session.user.displayName}</strong><small>{roleLabel}</small></div><button className="icon-button" onClick={() => void signOut()} type="button" aria-label={t("signOut")} title={signingOut ? t("signingOut") : t("signOut")} disabled={signingOut}><LogOut size={15} /></button>{signOutError && <p className="form-error signout-error" role="alert">{signOutError}</p>}</div>
    </aside>
    <main className="main-region">
      <header className="topbar"><div className="breadcrumb" aria-label={t("breadcrumb")}>{panelName}&nbsp; / &nbsp;<strong>{active}</strong></div><div className="top-actions"><PlatformThemeToggle platform={session.role === "REVIEWER" ? "reviewer" : "admin"} /><LanguageSwitcher /><span className="avatar" aria-hidden="true">{initials || "U"}</span></div></header>
      {children}
      <nav className="mobile-nav" aria-label={t("main")}>{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={withSessionSelector(href, session.sessionId)} aria-current={pathname === href ? "page" : undefined}><Icon size={17} /><span>{label}</span></Link>)}</nav>
    </main>
  </div></SessionContext.Provider>;
}
