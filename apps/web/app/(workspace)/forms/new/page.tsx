"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "../../../../src/lib/client-api";
import { useWorkspaceSession } from "../../../../src/components/workspace-shell";
import { withSessionSelector } from "../../../../src/lib/session-url";
import { useTranslations } from "next-intl";

export default function NewFormPage() {
  const t = useTranslations("forms");
  const api = useApi(); const router = useRouter(); const session = useWorkspaceSession(); const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function create(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const result = await api<{ data: { id: string } }>("/forms", { method: "POST", body: JSON.stringify({ title, description }) }); router.replace(withSessionSelector(`/admin/forms/${result.data.id}`, session.sessionId)); } catch (caught) { setError(t("createFailed")); setBusy(false); } }
  return <div className="page-content narrow-content"><div className="page-heading"><div><p className="eyebrow">{t("newEyebrow")}</p><h1>{t("createTitle")}</h1><p>{t("createHelp")}</p></div></div><form className="panel settings-panel form-create" onSubmit={create}><label htmlFor="title">{t("formName")}</label><input id="title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("formNameExample")} /><label htmlFor="description">{t("descriptionField")}</label><textarea id="description" maxLength={2000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("descriptionExample")} />{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? t("creating") : t("createAndEdit")}</button><button className="button" type="button" onClick={() => router.push(withSessionSelector("/admin/forms", session.sessionId))}>{t("cancel")}</button></div></form></div>;
}
