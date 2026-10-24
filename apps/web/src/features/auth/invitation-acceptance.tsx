"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiErrorSchema, invitationAcceptRequestSchema, invitationAcceptResponseSchema } from "@reviewroom/contracts";
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
    const emailValue = String(form.get("email") ?? "");
    const displayNameValue = String(form.get("displayName") ?? "");
    const identity = {
      ...(emailValue ? { email: emailValue } : {}),
      ...(displayNameValue ? { displayName: displayNameValue } : {}),
    };
    if (identity.email) {
      const emailError = invitationEmailError(identity.email);
      if (emailError) { setError(emailError); return; }
    }
    const requestBody = invitationAcceptRequestSchema.safeParse({ ...identity, password });
    if (!requestBody.success) { setError("Check the name, email address, and password, then try again."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/members/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", credentials: "same-origin", body: JSON.stringify(requestBody.data) });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const parsed = apiErrorSchema.safeParse(body);
        throw new Error(parsed.success ? parsed.data.error.message : "The access token could not be accepted.");
      }
      const accepted = invitationAcceptResponseSchema.safeParse(await response.json().catch(() => null));
      if (!accepted.success) throw new Error("The server returned an invalid response. The invitation may still have been accepted; try signing in.");
      router.replace(role === "REVIEWER" ? "/reviewer/login?invited=1" : "/admin/login?invited=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The access token could not be accepted.");
      setBusy(false);
    }
  }

  return <form onSubmit={(event) => void accept(event)}>
    {!displayName && <><label htmlFor="display-name">Your name</label><input id="display-name" name="displayName" autoComplete="name" minLength={1} maxLength={120} required /></>}
    {!email && <><label htmlFor="email">Your email address</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></>}
    {displayName && <p className="help-copy">This access token was prepared for {displayName}.</p>}
    <label htmlFor="password">Create a password for this workspace</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={14} maxLength={1024} />
    <label htmlFor="confirm-password">Confirm password</label><PasswordInput id="confirm-password" name="confirmPassword" autoComplete="new-password" minLength={14} maxLength={1024} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="help-copy">This password applies to this workspace membership. Other workspace access remains separate.</p>
    <button className="button button-primary" disabled={busy}>{busy ? "Joining workspace…" : "Accept access token"}</button>
  </form>;
}
