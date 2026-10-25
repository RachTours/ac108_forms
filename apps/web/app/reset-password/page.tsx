"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "../../src/features/auth/password-input";
import { apiErrorSchema } from "@reviewroom/contracts";
import { validatePasswordResetInput } from "../../src/features/auth/password-reset-validation";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "../../src/components/language-switcher";
import { localizeApiError } from "../../src/lib/api-error-locale";
import type { Locale } from "../../src/lib/locale";

export default function ResetPasswordPage() {
  return <Suspense fallback={<ResetPasswordFallback />}><ResetPasswordContent /></Suspense>;
}

function ResetPasswordFallback() {
  const t = useTranslations("auth");
  return <main className="login-page"><section className="login-card"><LanguageSwitcher /><h1>{t("resetTitle")}</h1></section></main>;
}

function ResetPasswordContent() {
  const t = useTranslations("auth");
  const navigation = useTranslations("navigation");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const signInPath = searchParams.get("audience") === "reviewer" ? "/reviewer/login" : "/admin/login";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const token = String(form.get("token") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const requestBody = validatePasswordResetInput({ email, token, password });
    if (!requestBody.success) { setError(t("invalidReset")); setBusy(false); return; }
    try {
      const response = await fetch("/api/v1/auth/password-reset", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody.data) });
      if (!response.ok) { const body: unknown = await response.json().catch(() => null); const parsed = apiErrorSchema.safeParse(body); setError(parsed.success ? localizeApiError(parsed.data.error.code, locale) : t("resetFailed")); return; }
      if (response.status !== 204) { setError(t("resetFailed")); return; }
      setSuccess(true);
    } catch { setError(t("resetUnavailable")); }
    finally { setBusy(false); }
  }

  const isReviewer = signInPath === "/reviewer/login";
  return <main className="login-page"><section className="login-card"><LanguageSwitcher /><Link className="brand" href={signInPath}><span className="brand-mark">{isReviewer ? "R" : "A"}</span><span>{isReviewer ? navigation("reviewerPanel") : navigation("adminPanel")}</span></Link><h1>{t("resetTitle")}</h1><p>{t("resetDescription")}</p>{success ? <div role="status" className="success-message">{t("passwordChanged")} <button className="button" onClick={() => router.replace(signInPath)}>{t("returnSignIn")}</button></div> : <form onSubmit={(event) => void submit(event)} noValidate>{error && <p role="alert" className="form-error">{error}</p>}<label htmlFor="reset-email">{t("email")}</label><input id="reset-email" name="email" type="email" autoComplete="username" required maxLength={254} /><label htmlFor="reset-token">{t("resetToken")}</label><input id="reset-token" name="token" type="text" autoComplete="one-time-code" required minLength={40} maxLength={100} /><label htmlFor="password">{t("newPassword")}</label><PasswordInput id="password" name="password" autoComplete="new-password" /><small className="help-copy">{t("passwordLength")}</small><button className="button button-primary" type="submit" disabled={busy}>{busy ? t("resetting") : t("setPassword")}</button><Link className="login-secondary-link" href={signInPath}>{t("backSignIn")}</Link></form>}</section></main>;
}
