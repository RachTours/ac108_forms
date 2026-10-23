"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiErrorSchema } from "@reviewroom/contracts";
import { PasswordInput } from "./password-input";
import { invitationEmailError } from "./invitation-acceptance-validation";

export function InvitationAcceptance({ token, email, displayName, role }: { token: string; email: string | null; displayName: string | null; role: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 14 || password.length > 1024) { setError("Use a password with at least 14 characters."); return; }
    if (password !== String(form.get("confirmPassword") ?? "")) { setError("The passwords do not match."); return; }
    const identity = { email: String(form.get("email") ?? "") || undefined, displayName: String(form.get("displayName") ?? "") || undefined };
    if (identity.email) {
      const emailError = invitationEmailError(identity.email);
      if (emailError) { setError(emailError); return; }
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/members/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...identity, password }) });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const parsed = apiErrorSchema.safeParse(body);
        throw new Error(parsed.success ? parsed.data.error.message : "The access token could not be accepted.");
      }
      router.replace(role === "REVIEWER" ? "/reviewer/login?invited=1" : "/admin/login?invited=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The access token could not be accepted.");
      setBusy(false);
    }
  }

  return <form onSubmit={(event) => void accept(event)}>
    {!email && <><label htmlFor="display-name">Your name</label><input id="display-name" name="displayName" autoComplete="name" minLength={1} maxLength={120} required /><label htmlFor="email">Your email address</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></>}
    {displayName && <p className="help-copy">This access token was prepared for {displayName}.</p>}
    <label htmlFor="password">{email ? "Create or confirm your password" : "Create a password"}</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={14} maxLength={1024} />
    <label htmlFor="confirm-password">Confirm password</label><PasswordInput id="confirm-password" name="confirmPassword" autoComplete="new-password" minLength={14} maxLength={1024} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {email && <p className="help-copy">For an existing Reviewroom account, enter its current password.</p>}
    <button className="button button-primary" disabled={busy}>{busy ? "Joining workspace…" : "Accept access token"}</button>
  </form>;
}
