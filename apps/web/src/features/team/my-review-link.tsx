"use client";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { formatDate } from "../../lib/date-format";
import { getDirectOpenLinkProps } from "./my-review-link-model";
import { useLocale, useTranslations } from "next-intl";

type FormLink = { id: string; createdAt: string; expiresAt: string | null; revokedAt: string | null; active: boolean; canReveal?: boolean };
type PublishedForm = { id: string; title: string; description: string; canGenerate: boolean; link: FormLink | null };

export function MyReviewLink() {
  const t = useTranslations("team");
  const locale = useLocale();
  const api = useApi();
  const [forms, setForms] = useState<PublishedForm[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void api<{ data: PublishedForm[] }>("/review-links/mine/forms").then((result) => { if (live) { setForms(result.data); setUrls({}); } })
      .catch(() => { if (live) setError(t("formSectionFailed")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, t]);

  async function issue(form: PublishedForm) {
    if (!form.canGenerate) return;
    const replacing = !!form.link?.active;
    if (replacing && !window.confirm(t("replaceMyLinkConfirm", { title: form.title }))) return;
    setBusyId(form.id); setError(""); setNotice("");
    try {
      const result = await api<{ data: FormLink & { shareUrl: string } }>(`/review-links/mine/forms/${form.id}/rotate`, { method: "POST" });
      setForms((rows) => rows.map((row) => row.id === form.id ? { ...row, link: { ...result.data, active: true, revokedAt: null } } : row));
      setUrls((current) => ({ ...current, [form.id]: result.data.shareUrl }));
      setNotice(t("shareLinkReady", { title: form.title }));
    } catch { setError(t("linkCreateFailed")); }
    finally { setBusyId(""); }
  }

  async function revoke(form: PublishedForm) {
    if (!form.link) return;
    if (!window.confirm(t("revokeMyLinkConfirm", { title: form.title }))) return;
    setBusyId(form.id); setError(""); setNotice("");
    try {
      await api(`/review-links/${form.link.id}/revoke`, { method: "POST" });
      setForms((rows) => rows.map((row) => row.id === form.id && row.link ? { ...row, link: { ...row.link, active: false, revokedAt: new Date().toISOString() } } : row));
      setUrls((current) => { const next = { ...current }; delete next[form.id]; return next; });
      setNotice(t("linkRevoked", { form: form.title }));
    } catch { setError(t("linkRevokeFailed")); }
    finally { setBusyId(""); }
  }

  async function copy(formId: string) {
    setError(""); setNotice("");
    let shareUrl = urls[formId];
    if (!shareUrl) {
      setBusyId(formId);
      try {
        const result = await api<{ data: { shareUrl: string } }>(`/review-links/mine/forms/${formId}/reveal`, { method: "POST" });
        shareUrl = result.data.shareUrl;
        setUrls((current) => ({ ...current, [formId]: shareUrl! }));
      } catch {
        setError(t("linkLoadFailed"));
        setBusyId("");
        return;
      } finally { setBusyId(""); }
    }
    try { await navigator.clipboard.writeText(shareUrl); setNotice(t("formLinkLoaded")); }
    catch { setNotice(t("manualCopy")); }
  }

  async function open(formId: string) {
    setError(""); setNotice("");
    const tab = window.open("about:blank", "_blank");
    if (!tab) { setError(t("openBlocked")); return; }
    tab.opener = null;
    let shareUrl = urls[formId];
    if (!shareUrl) {
      setBusyId(formId);
      try {
        const result = await api<{ data: { shareUrl: string } }>(`/review-links/mine/forms/${formId}/reveal`, { method: "POST" });
        shareUrl = result.data.shareUrl;
        setUrls((current) => ({ ...current, [formId]: shareUrl! }));
      } catch {
        tab.close();
        setError(t("openFailed"));
        setBusyId("");
        return;
      } finally { setBusyId(""); }
    }
    tab.location.replace(shareUrl);
  }

  return <>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="form-success">{notice}</p>}
    {loading ? <div className="panel empty-inline">{t("loadingForms")}</div> : error && forms.length === 0 ? null : forms.length === 0 ? <section className="panel personal-link-card"><span className="personal-link-icon"><Link2 size={20} /></span><h2>{t("noPublishedForms")}</h2><p>{t("noPublishedHelp")}</p></section> : <div className="personal-form-links">{forms.map((form) => <section className="panel personal-link-card" key={form.id}>
      <span className="personal-link-icon"><Link2 size={20} /></span><h2>{form.title}</h2>{form.description && <p>{form.description}</p>}
      {form.link?.active ? <div className="personal-link-meta"><span><ShieldCheck size={14} /> {t("activeReviewerLink")}</span><span>{t("expires", { date: form.link.expiresAt ? formatDate(form.link.expiresAt, locale) : t("never") })}</span></div> : <p className="muted-caption">{form.link ? t("linkRevokedExpired") : t("noShareLink")}</p>}
      {!form.canGenerate && <p className="muted-caption">{t("linkGenerationUnavailable")}</p>}
      <div className="button-row"><button className="button button-primary" title={!form.canGenerate ? t("linkGenerationUnavailable") : undefined} disabled={!!busyId || !form.canGenerate} onClick={() => void issue(form)}><RefreshCw size={14} /> {busyId === form.id ? t("working") : form.link?.active ? t("rotateLink") : t("createLink")}</button>{form.link?.active && form.link.canReveal && <button className="button button-small" disabled={!!busyId} onClick={() => void copy(form.id)}><Copy size={13} /> {busyId === form.id ? t("loading") : t("copyLink")}</button>}{form.link?.active && <button type="button" className="button button-small icon-button" aria-label={t("openForm")} title={t("openForm")} disabled={!!busyId} onClick={() => void open(form.id)}><ExternalLink size={14} /></button>}{form.link?.active && <button className="button" disabled={!!busyId} onClick={() => void revoke(form)}><X size={14} /> {t("revoke")}</button>}{urls[form.id] && !form.link?.canReveal && <button className="button button-small" onClick={() => void copy(form.id)}><Copy size={13} /> {t("copyLink")}</button>}</div>
      {urls[form.id] && <div className="one-time-secret reviewer-share-url"><strong>{t("yourActiveLink")}</strong><small>{t("linkScope")}</small><div className="reviewer-share-url-controls"><input readOnly value={urls[form.id]} aria-label={`${form.title} ${t("shareLink")}`} /><span className="reviewer-share-url-actions"><button className="button button-small" onClick={() => void copy(form.id)}><Copy size={13} /> {t("copyLink")}</button><a {...getDirectOpenLinkProps(urls[form.id]!)} className="button button-small icon-button" aria-label={t("openForm")} title={t("openForm")}><ExternalLink size={14} /></a></span></div></div>}
    </section>)}</div>}
    <div className="personal-link-note"><ShieldCheck size={16} /><p>{t("linkNote")}</p></div>
  </>;
}
