"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Files, RotateCcw, Trash2 } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { formatDate } from "../../lib/date-format";

export type FormListRow = { id: string; title: string; description: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; updatedAt: string; currentPublishedId: string | null; submissionCount: number };

export function FormListManager({ initialActive, initialArchived }: { initialActive: FormListRow[]; initialArchived: FormListRow[] }) {
  const api = useApi();
  const [active, setActive] = useState(initialActive);
  const [archived, setArchived] = useState(initialArchived);
  const [view, setView] = useState<"active" | "archived">("active");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = view === "active" ? active : archived;

  async function archiveForm(form: FormListRow) {
    if (!window.confirm(`Archive “${form.title}”? Existing reviewer links will stop working. The form and its submissions will be retained.`)) return;
    setError(""); setNotice(""); setBusyId(form.id);
    try {
      await api(`/forms/${form.id}`, { method: "DELETE" });
      setActive((items) => items.filter((item) => item.id !== form.id));
      setArchived((items) => [{ ...form, status: "ARCHIVED", updatedAt: new Date().toISOString() }, ...items.filter((item) => item.id !== form.id)]);
      setNotice(`“${form.title}” was archived. You can restore it from Archived forms.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Form could not be archived."); }
    finally { setBusyId(null); }
  }

  async function restoreForm(form: FormListRow) {
    setError(""); setNotice(""); setBusyId(form.id);
    try {
      await api(`/forms/${form.id}/restore`, { method: "POST" });
      const restored = { ...form, status: form.currentPublishedId ? "PUBLISHED" as const : "DRAFT" as const, updatedAt: new Date().toISOString() };
      setArchived((items) => items.filter((item) => item.id !== form.id));
      setActive((items) => [restored, ...items.filter((item) => item.id !== form.id)]);
      setNotice(`“${form.title}” was restored. Previously revoked reviewer links remain revoked.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Form could not be restored."); }
    finally { setBusyId(null); }
  }

  async function permanentlyDelete(form: FormListRow) {
    if (form.submissionCount > 0) {
      setError(`“${form.title}” has ${form.submissionCount} submission(s). Permanently delete those submissions first, then retry.`);
      return;
    }
    if (window.prompt(`Permanently delete “${form.title}” and its published versions and share links? Type the form title to confirm.`) !== form.title) return;
    setError(""); setNotice(""); setBusyId(form.id);
    try {
      await api(`/forms/${form.id}/permanent`, { method: "DELETE" });
      setActive((items) => items.filter((item) => item.id !== form.id));
      setArchived((items) => items.filter((item) => item.id !== form.id));
      setNotice(`“${form.title}” was permanently deleted.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Form could not be permanently deleted."); }
    finally { setBusyId(null); }
  }

  return <>
    <div className="manager-toolbar form-lifecycle-toolbar">
      <div className="filter-pills" aria-label="Filter forms">
        <button type="button" className={view === "active" ? "filter-pill active" : "filter-pill"} onClick={() => setView("active")}>Active <span>{active.length}</span></button>
        <button type="button" className={view === "archived" ? "filter-pill active" : "filter-pill"} onClick={() => setView("archived")}>Archived <span>{archived.length}</span></button>
      </div>
      <span className="muted-caption">{rows.length} shown</span>
    </div>
    {error && <p className="form-error" role="alert">{error} <Link href="/admin/submissions">Open submissions</Link></p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {rows.length === 0 ? <div className="panel empty-state"><span className="empty-icon"><Files /></span><h2>{view === "active" ? "No active forms" : "No archived forms"}</h2><p>{view === "active" ? "Create a form, add questions, and publish it when it is ready." : "Archived forms stay here until you restore or permanently delete them."}</p></div> :
      <div className="panel form-list">{rows.map((form) => <article className="form-list-row" key={form.id}>
        <span className="form-icon"><Files size={17} /></span>
        {view === "active" ? <Link className="form-list-main" href={`/admin/forms/${form.id}`} aria-label={`Edit ${form.title}`}><strong>{form.title}</strong><small>{form.description || "No description"} · Updated {formatDate(form.updatedAt)} · {form.submissionCount} submissions</small></Link> : <span className="form-list-main"><strong>{form.title}</strong><small>{form.description || "No description"} · Updated {formatDate(form.updatedAt)} · {form.submissionCount} submissions</small></span>}
        <span className={`status ${form.status === "DRAFT" || view === "archived" ? "status-pending" : ""}`}>{view === "archived" ? "Archived" : form.status === "PUBLISHED" ? "Published" : "Draft"}</span>
        {view === "active" ? <button type="button" className="icon-button" aria-label={`Archive ${form.title}`} title="Archive form" disabled={busyId !== null} onClick={() => void archiveForm(form)}><Archive size={14} /></button> : <button type="button" className="button button-small" disabled={busyId !== null} onClick={() => void restoreForm(form)}><RotateCcw size={13} /> Restore</button>}
        <button type="button" className="icon-button danger-action" aria-label={`Permanently delete ${form.title}`} title={form.submissionCount ? "Delete submissions before removing this form" : "Permanently delete form"} disabled={busyId !== null} onClick={() => void permanentlyDelete(form)}><Trash2 size={14} /></button>
      </article>)}</div>}
  </>;
}
