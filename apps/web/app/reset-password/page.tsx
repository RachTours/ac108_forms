"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "../../src/features/auth/password-input";
import { apiErrorSchema } from "@reviewroom/contracts";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="login-page"><section className="login-card"><h1>Reset your password</h1></section></main>}><ResetPasswordContent /></Suspense>;
}

function ResetPasswordContent() {
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
    if (!email || token.length < 40 || password.length < 14) { setError("Enter your email, the full reset token, and a password of at least 14 characters."); setBusy(false); return; }
    try {
      const response = await fetch("/api/v1/auth/password-reset", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token, password }) });
      if (!response.ok) { const body: unknown = await response.json().catch(() => null); const parsed = apiErrorSchema.safeParse(body); throw new Error(parsed.success ? parsed.data.error.message : "Password reset failed."); }
      setSuccess(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Password reset failed. Request a new token from your administrator."); }
    finally { setBusy(false); }
  }

  const isReviewer = signInPath === "/reviewer/login";
  return <main className="login-page"><section className="login-card"><Link className="brand" href={signInPath}><span className="brand-mark">{isReviewer ? "R" : "A"}</span><span>{isReviewer ? "Reviewer Panel" : "Admin Panel"}</span></Link><h1>Reset your password</h1><p>Enter the separate one-time reset token provided by your workspace administrator. It expires after 30 minutes.</p>{success ? <div role="status" className="success-message">Password changed. All existing sessions were signed out. <button className="button" onClick={() => router.replace(signInPath)}>Return to sign in</button></div> : <form onSubmit={(event) => void submit(event)} noValidate>{error && <p role="alert" className="form-error">{error}</p>}<label htmlFor="reset-email">Email address</label><input id="reset-email" name="email" type="email" autoComplete="username" required maxLength={254} /><label htmlFor="reset-token">Reset token</label><input id="reset-token" name="token" type="text" autoComplete="one-time-code" required minLength={40} maxLength={100} /><label htmlFor="password">New password</label><PasswordInput id="password" name="password" autoComplete="new-password" /><small className="help-copy">Use at least 14 characters.</small><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Resetting…" : "Set new password"}</button><Link className="login-secondary-link" href={signInPath}>Back to sign in</Link></form>}</section></main>;
}
