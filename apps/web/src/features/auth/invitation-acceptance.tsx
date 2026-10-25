"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiErrorSchema, invitationAcceptRequestSchema, invitationAcceptResponseSchema } from "@reviewroom/contracts";
import { PasswordInput } from "./password-input";
import { useLocale, useTranslations } from "next-intl";
import { localizeApiError } from "../../lib/api-error-locale";
import type { Locale } from "../../lib/locale";
import { invitationEmailError } from "./invitation-acceptance-validation";

export function InvitationAcceptance({ token, email, displayName, role }: { token: string; email: string | null; displayName: string | null; role: string }) {
  const t = useTranslations("invitation");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 14 || password.length > 1024) { setError(t("passwordLength")); return; }
    if (password !== String(form.get("confirmPassword") ?? "")) { setError(t("passwordMismatch")); return; }
    const emailValue = String(form.get("email") ?? "");
    const displayNameValue = String(form.get("displayName") ?? "");
    const identity = {
      ...(emailValue ? { email: emailValue } : {}),
      ...(displayNameValue ? { displayName: displayNameValue } : {}),
    };
    if (identity.email) {
      if (invitationEmailError(identity.email)) { setError(t("invalidDetails")); return; }
    }
    const requestBody = invitationAcceptRequestSchema.safeParse({ ...identity, password });
    if (!requestBody.success) { setError(t("invalidDetails")); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/members/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", credentials: "same-origin", body: JSON.stringify(requestBody.data) });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const parsed = apiErrorSchema.safeParse(body);
        setError(parsed.success ? localizeApiError(parsed.data.error.code, locale) : t("tokenRejected"));
        setBusy(false);
        return;
      }
      const accepted = invitationAcceptResponseSchema.safeParse(await response.json().catch(() => null));
      if (!accepted.success) { setError(t("invalidResponse")); setBusy(false); return; }
      router.replace(role === "REVIEWER" ? "/reviewer/login?invited=1" : "/admin/login?invited=1");
    } catch {
      setError(t("tokenRejected"));
      setBusy(false);
    }
  }

  return <form onSubmit={(event) => void accept(event)}>
    {!displayName && <><label htmlFor="display-name">{t("name")}</label><input id="display-name" name="displayName" autoComplete="name" minLength={1} maxLength={120} required /></>}
    {!email && <><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></>}
    {displayName && <p className="help-copy">{t("preparedFor", { name: displayName })}</p>}
    <label htmlFor="password">{t("createPassword")}</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={14} maxLength={1024} />
    <label htmlFor="confirm-password">{t("confirmPassword")}</label><PasswordInput id="confirm-password" name="confirmPassword" autoComplete="new-password" minLength={14} maxLength={1024} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="help-copy">{t("membershipScope")}</p>
    <button className="button button-primary" disabled={busy}>{busy ? t("joining") : t("accept")}</button>
  </form>;
}
