"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Files, LayoutDashboard, Link2, LogOut, Settings2, UsersRound, UserRoundCog } from "lucide-react";
import type { SessionResponse } from "@reviewroom/contracts";
import { createContext, useContext } from "react";
import { getNavigationForRole, homePathForRole, signInPathForRole } from "../lib/workspace-access";
import { workspaceThemeCssVariables, type safeWorkspaceTheme } from "../lib/workspace-theme";
import { panelNameForAudience } from "../lib/panel-brand";

const SessionContext = createContext<SessionResponse | null>(null);
export function useWorkspaceSession(): SessionResponse {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Workspace session is unavailable.");
  return session;
}

export function WorkspaceShell({ session, theme, children }: { session: SessionResponse; theme: ReturnType<typeof safeWorkspaceTheme>; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const icons: Record<string, typeof LayoutDashboard> = { "Overview": LayoutDashboard, "Review targets": UsersRound, "Submissions": ClipboardList, "My form links": Link2, "Forms": Files, "Team access": UserRoundCog, "Settings": Settings2 };
  const navigation = getNavigationForRole(session.role).map((item) => ({ ...item, icon: icons[item.label]! }));
  const panelName = panelNameForAudience(session.role === "REVIEWER" ? "reviewer" : "admin");

  async function signOut() {
    const response = await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": session.csrfToken } });
    if (response.ok) {
      router.replace(signInPathForRole(session.role));
      router.refresh();
    }
  }

  const active = navigation.find((item) => item.href === pathname || (item.href !== "/admin/overview" && item.href !== "/reviewer/progress" && pathname.startsWith(`${item.href}/`)))?.label ?? "Workspace";
  const initials = session.user.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  return <SessionContext.Provider value={session}><div className="app-shell" style={workspaceThemeCssVariables(theme) as React.CSSProperties}>
    <aside className="sidebar" aria-label="Workspace navigation">
      <Link className="brand" href={homePathForRole(session.role)}><span className="brand-mark">{session.role === "REVIEWER" ? "R" : "A"}</span><span>{panelName}</span></Link>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list" aria-label="Main">
        {navigation.map(({ href, label, icon: Icon }) => <Link key={href} className="nav-link" href={href} aria-current={pathname === href ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
      </nav>
      <div className="side-profile"><span className="avatar" aria-hidden="true">{initials || "U"}</span><div><strong>{session.user.displayName}</strong><small>{session.role.toLowerCase()}</small></div><button className="icon-button" onClick={signOut} type="button" aria-label="Sign out"><LogOut size={15} /></button></div>
    </aside>
    <main className="main-region">
      <header className="topbar"><div className="breadcrumb">{panelName}&nbsp; / &nbsp;<strong>{active}</strong></div><div className="top-actions"><span className="avatar" aria-hidden="true">{initials || "U"}</span></div></header>
      {children}
      <nav className="mobile-nav" aria-label="Workspace navigation">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}><Icon size={17} /><span>{label}</span></Link>)}</nav>
    </main>
  </div></SessionContext.Provider>;
}
