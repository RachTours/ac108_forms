"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Archive, Files, RotateCcw, Trash2 } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { formatDate } from "../../lib/date-format";
import { formatNumber, type Locale } from "../../lib/locale";

export type FormListRow = { id: string; title: string; description: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; updatedAt: string; currentPublishedId: string | null; submissionCount: number };

export function FormListManager({ initialActive, initialArchived }: { initialActive: FormListRow[]; initialArchived: FormListRow[] }) {
  const api = useApi();
  const t = useTranslations("forms");
  const locale = useLocale() as Locale;
  const [active, setActive] = useState(initialActive);
  const [archived, setArchived] = useState(initialArchived);
  const [view, setView] = useState<"active" | "archived">("active");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = view === "active" ? active : archived;

  async function archiveForm(form: FormListRow) {
    if (!window.confirm(t("archiveConfirm", { title: form.title }))) return;
    setError(""); setNotice(""); setBusyId(form.id);
    try {
      await api(`/forms/${form.id}`, { method: "DELETE" });
      setActive((items) => items.filter((item) => item.id !== form.id));
      setArchived((items) => [{ ...form, status: "ARCHIVED", updatedAt: new Date().toISOString() }, ...items.filter((item) => item.id !== form.id)]);
      setNotice(t("archiveNotice", { title: form.title }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("archiveFailed")); }
    finally { setBusyId(null); }
  }

  async function restoreForm(form: FormListRow) {
    setError(""); setNotice(""); setBusyId(form.id);
    try {
      await api(`/forms/${form.id}/restore`, { method: "POST" });
      const restored = { ...form, status: form.currentPublishedId ? "PUBLISHED" as const : "DRAFT" as const, updatedAt: new Date().toISOString() };
      setArchived((items) => items.filter((item) => item.id !== form.id));
      setActive((items) => [restored, ...items.filter((item) => item.id !== form.id)]);
      setNotice(t("restoreNotice", { title: form.title }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("restoreFailed")); }
    finally { setBusyId(null); }
  }

  async function permanentlyDelete(form: FormListRow) {
    if (form.submissionCount > 0) {
      setError(t("deleteBlocked", { title: form.title, count: formatNumber(form.submissionCount, locale, 0) }));
      return;
    }
    if (window.prompt(t("deleteConfirm", { title: form.title })) !== form.title) return;
    setError(""); setNotice(""); setBusyId(form.id);
    try {
      await api(`/forms/${form.id}/permanent`, { method: "DELETE" });
      setActive((items) => items.filter((item) => item.id !== form.id));
      setArchived((items) => items.filter((item) => item.id !== form.id));
      setNotice(t("deleteNotice", { title: form.title }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("deleteFailed")); }
    finally { setBusyId(null); }
  }

  return <>
    <div className="manager-toolbar form-lifecycle-toolbar">
      <div className="filter-pills" aria-label={t("filterForms")}>
        <button type="button" className={view === "active" ? "filter-pill active" : "filter-pill"} onClick={() => setView("active")}>{t("active")} <span>{formatNumber(active.length, locale, 0)}</span></button>
        <button type="button" className={view === "archived" ? "filter-pill active" : "filter-pill"} onClick={() => setView("archived")}>{t("archived")} <span>{formatNumber(archived.length, locale, 0)}</span></button>
      </div>
      <span className="muted-caption">{t("shown", { count: formatNumber(rows.length, locale, 0) })}</span>
    </div>
    {error && <p className="form-error" role="alert">{error} <Link href="/admin/submissions">Open submissions</Link></p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {rows.length === 0 ? <div className="panel empty-state"><span className="empty-icon"><Files /></span><h2>{view === "active" ? t("noActiveForms") : t("noArchivedForms")}</h2><p>{view === "active" ? t("createAndPublishHelp") : t("archivedHelp")}</p></div> :
      <div className="panel form-list">{rows.map((form) => <article className="form-list-row" key={form.id}>
        <span className="form-icon"><Files size={17} /></span>
        {view === "active" ? <Link className="form-list-main" href={`/admin/forms/${form.id}`} aria-label={t("editForm", { title: form.title })}><strong>{form.title}</strong><small>{form.description || t("noDescription")} · {t("updated", { date: formatDate(form.updatedAt, locale) })} · {t("submissionsCount", { count: formatNumber(form.submissionCount, locale, 0) })}</small></Link> : <span className="form-list-main"><strong>{form.title}</strong><small>{form.description || t("noDescription")} · {t("updated", { date: formatDate(form.updatedAt, locale) })} · {t("submissionsCount", { count: formatNumber(form.submissionCount, locale, 0) })}</small></span>}
        <span className={`status ${form.status === "DRAFT" || view === "archived" ? "status-pending" : ""}`}>{view === "archived" ? t("archived") : form.status === "PUBLISHED" ? t("published") : t("draft")}</span>
        {view === "active" ? <button type="button" className="icon-button" aria-label={t("archiveTitle")} title={t("archiveTitle")} disabled={busyId !== null} onClick={() => void archiveForm(form)}><Archive size={14} /></button> : <button type="button" className="button button-small" disabled={busyId !== null} onClick={() => void restoreForm(form)}><RotateCcw size={13} /> {t("restore")}</button>}
        <button type="button" className="icon-button danger-action" aria-label={t("deleteTitle")} title={form.submissionCount ? t("deleteBlockedTitle") : t("deleteTitle")} disabled={busyId !== null} onClick={() => void permanentlyDelete(form)}><Trash2 size={14} /></button>
      </article>)}</div>}
  </>;
}
