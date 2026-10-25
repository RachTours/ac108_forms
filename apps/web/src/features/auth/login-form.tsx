"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiErrorSchema, loginRequestSchema, loginResponseSchema, workspaceChoiceResponseSchema } from "@reviewroom/contracts";
import Link from "next/link";
import { PasswordInput } from "./password-input";
import { homePathForRole, roleMatchesAudience, safeWorkspaceReturnPath } from "../../lib/workspace-access";
import { withSessionSelector } from "../../lib/session-url";
import { useLocale, useTranslations } from "next-intl";
import { localizeApiError } from "../../lib/api-error-locale";
import type { Locale } from "../../lib/locale";

export function LoginForm({ audience }: { audience: "admin" | "reviewer" }) {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; slug: string; role: string }>>([]);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const input = loginRequestSchema.safeParse({ email: form.get("email"), password: form.get("password"), ...(workspaceSlug ? { organizationSlug: workspaceSlug } : {}) });
    if (!input.success) { setError(t("invalidCredentials")); return; }
    setPending(true);
    try {
      const response = await fetch(`/api/v1/auth/${audience}/login`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const choice = workspaceChoiceResponseSchema.safeParse(body);
        if (response.status === 409 && choice.success) {
          const options = choice.data.data.workspaces;
          if (options.length > 1) { setWorkspaces(options); setWorkspaceSlug(options[0]!.slug); setError(t("multipleWorkspaces")); return; }
        }
        const parsed = apiErrorSchema.safeParse(body);
        setError(parsed.success ? localizeApiError(parsed.data.error.code, locale) : t("loginFailed"));
        return;
      }
      const body: unknown = await response.json();
      const session = loginResponseSchema.safeParse(body);
      if (!session.success || !roleMatchesAudience(session.data.role, audience)) {
        setError(t("invalidSession"));
        return;
      }
      const requestedPath = safeWorkspaceReturnPath(new URLSearchParams(window.location.search).get("returnTo"), audience);
      router.replace(withSessionSelector(requestedPath ?? homePathForRole(session.data.role), session.data.sessionId));
      router.refresh();
    } catch {
      setError(t("loginUnavailable"));
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} noValidate>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
    <label htmlFor="password">{t("password")}</label><PasswordInput id="password" name="password" autoComplete="current-password" />
    {workspaces.length > 1 && <><label htmlFor="workspace">{t("workspaceLabel")}</label><select id="workspace" value={workspaceSlug} onChange={(event) => setWorkspaceSlug(event.target.value)}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.slug}>{workspace.name} · {workspace.role === "REVIEWER" ? t("reviewerAccess") : t("adminAccess")}</option>)}</select></>}
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? t("signingIn") : t("signInSecurely")}</button>
    <Link className="login-secondary-link" href={`/reset-password?audience=${audience}`}>{t("forgotPassword")}</Link>
    <p className="login-reset-hint">{t("resetHint")}</p>
  </form>;
}
