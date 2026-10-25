"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Pencil, Plus, Search, Upload, UserRound, X } from "lucide-react";
import { paginatedResponseSchema, targetCreateResponseSchema, targetImportCommitResponseSchema, targetImportPreviewResponseSchema, targetSummarySchema, targetUpdateResponseSchema, targetWriteSchema, type TargetSummary } from "@reviewroom/contracts";
import { useApi } from "../../lib/client-api";

type Target = Omit<TargetSummary, "createdAt" | "updatedAt"> & Partial<Pick<TargetSummary, "createdAt" | "updatedAt">>;
const targetListResponseSchema = paginatedResponseSchema(targetSummarySchema);

export function PeopleManager({ initialTargets, initialCursor, canManage }: { initialTargets: Target[]; initialCursor: string | null; canManage: boolean }) {
  const api = useApi();
  const [targets, setTargets] = useState(initialTargets);
  const [cursor, setCursor] = useState(initialCursor);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [importCsv, setImportCsv] = useState("");
  const [importPreview, setImportPreview] = useState<null | { rows: Array<{ rowNumber: number; displayName: string; email: string | null; errors: Array<{ rowNumber: number | null; message: string }> }>; errors: Array<{ rowNumber: number | null; message: string }>; valid: boolean }>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const shown = useMemo(() => targets.filter((target) => !normalizedSearch || `${target.displayName} ${target.email ?? ""}`.toLocaleLowerCase().includes(normalizedSearch)), [targets, normalizedSearch]);

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api(`/review-targets?limit=100&cursor=${encodeURIComponent(cursor)}`, {}, targetListResponseSchema);
      setTargets((items) => [...items, ...result.data]);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "More people could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function addTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = targetWriteSchema.safeParse({ displayName: name, email });
      if (!payload.success) { setError("Enter a name and a valid email address, or leave the email blank."); return; }
      const result = await api("/review-targets", { method: "POST", body: JSON.stringify(payload.data) }, targetCreateResponseSchema);
      setTargets((items) => [...items, result.data].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setName("");
      setEmail("");
      setNotice(`${result.data.displayName} added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this person.");
    } finally {
      setBusy(false);
    }
  }

  async function previewImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importCsv || busy) return;
    setBusy(true); setError(""); setNotice(""); setImportPreview(null);
    try {
      const result = await api("/review-targets/import/preview", { method: "POST", headers: { "Content-Type": "text/csv" }, body: importCsv }, targetImportPreviewResponseSchema);
      setImportPreview(result.data);
    } catch (err) { setError(err instanceof Error ? err.message : "The CSV could not be previewed."); }
    finally { setBusy(false); }
  }

  async function commitImport() {
    if (!importCsv || !importPreview?.valid || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("/review-targets/import", { method: "POST", headers: { "Content-Type": "text/csv" }, body: importCsv }, targetImportCommitResponseSchema);
      const refreshed = await api("/review-targets?limit=100", {}, targetListResponseSchema);
      setTargets(refreshed.data); setCursor(refreshed.nextCursor);
      setImportCsv(""); setImportPreview(null); setNotice(`${result.data.importedCount} people imported${result.data.assignedCount ? `; ${result.data.assignedCount} assigned.` : "."}`);
    } catch (err) { setError(err instanceof Error ? err.message : "The CSV import could not be completed."); }
    finally { setBusy(false); }
  }

  function downloadImportErrors() {
    if (!importPreview || (!importPreview.errors.length && !importPreview.rows.some((row) => row.errors.length))) return;
    const quote = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const allErrors = [...importPreview.errors, ...importPreview.rows.flatMap((row) => row.errors)];
    const report = ["row,error", ...allErrors.map(({ rowNumber, message }) => `${quote(rowNumber)},${quote(message)}`)].join("\r\n");
    const href = URL.createObjectURL(new Blob([report], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = href; anchor.download = "people-import-errors.csv"; anchor.click(); URL.revokeObjectURL(href);
  }

  function beginEdit(target: Target) {
    setEditingId(target.id);
    setEditName(target.displayName);
    setEditEmail(target.email ?? "");
    setError("");
    setNotice("");
  }

  async function saveEdit(targetId: string) {
    setBusy(true);
    setError("");
    try {
      const payload = targetWriteSchema.safeParse({ displayName: editName, email: editEmail });
      if (!payload.success) { setError("Enter a name and a valid email address, or leave the email blank."); return; }
      const result = await api(`/review-targets/${targetId}`, { method: "PATCH", body: JSON.stringify(payload.data) }, targetUpdateResponseSchema);
      setTargets((items) => items.map((target) => target.id === targetId ? { ...target, ...result.data } : target));
      setEditingId(null);
      setNotice("Person details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Person could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(target: Target) {
    if (!window.confirm(`Archive ${target.displayName}? Their existing reviews will remain in submissions.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/review-targets/${target.id}`, { method: "DELETE" });
      setTargets((items) => items.filter((item) => item.id !== target.id));
      setNotice(`${target.displayName} archived.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive this person.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="people-manager">
    <div className="manager-toolbar">
      <label className="search-box"><Search size={15} /><input aria-label="Search people by name or email" placeholder="Search people by name or email" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
      <span className="muted-caption">{shown.length} shown · {targets.length} loaded{cursor ? "+" : ""}</span>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {canManage && <>
      <p className="help-copy">Add, update, archive, and review the submission history for people in this workspace.</p>
      <form className="add-person-panel add-person-guided" onSubmit={addTarget}>
        <div className="add-person-heading"><span className="setting-icon"><Plus size={16} /></span><span><strong>Add a person</strong><small>Add each person once to keep their review history together.</small></span></div>
        <label className="people-field"><span>Full name</span><input required maxLength={160} placeholder="e.g. Alex Morgan" autoComplete="name" aria-label="Full name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="people-field"><span>Email <small>Optional</small></span><input type="email" maxLength={254} placeholder="name@example.com" autoComplete="email" aria-label="Email (optional)" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button className="button button-primary add-person-submit" disabled={busy}><Plus size={13} /> Add person</button>
      </form>
      <form className="add-person-panel add-person-guided" onSubmit={previewImport}>
        <div className="add-person-heading"><span className="setting-icon"><Upload size={16} /></span><span><strong>Import people from CSV</strong><small>Use the exact headers <code>name,email</code>. Up to 500 rows; blank emails are allowed.</small></span></div>
        <label className="people-field"><span>CSV file</span><input aria-label="People CSV file" type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 512_000) { setImportCsv(""); setError("CSV file is too large."); return; } void file.text().then(setImportCsv).catch(() => setError("The selected file could not be read.")); }} /></label>
        <button className="button button-primary add-person-submit" disabled={busy || !importCsv}><Upload size={13} /> Preview import</button>
      </form>
      {importPreview && <div className="panel"><h2>Import preview</h2><p>{importPreview.valid ? `${importPreview.rows.length} people are ready to import.` : "Fix the highlighted rows before importing."}</p>{importPreview.rows.map((row) => <p key={row.rowNumber}>Row {row.rowNumber}: {row.displayName || "(missing name)"}{row.errors.length ? ` — ${row.errors.map((error) => error.message).join(" ")}` : ""}</p>)}{[...importPreview.errors, ...importPreview.rows.flatMap((row) => row.errors)].length > 0 && <button className="button button-small" type="button" onClick={downloadImportErrors}><Download size={13} /> Download error report</button>}{importPreview.valid && <button className="button button-primary" type="button" disabled={busy} onClick={() => void commitImport()}>Import {importPreview.rows.length} people</button>}</div>}
    </>}
    {targets.length === 0 ? <div className="panel empty-state compact-empty"><span className="empty-icon"><UserRound /></span><h2>No people yet</h2><p>Add a person to start a review record.</p></div> : <div className="table-wrap people-target-table"><table><thead><tr><th>Person</th>{canManage && <th>Assigned reviewer</th>}<th>Responses</th>{canManage && <th aria-label="Actions" />}</tr></thead><tbody>
      {shown.map((target) => <tr className={`review-target-row ${canManage ? "managed" : ""}`} key={target.id}>
        <td className="target-person-cell">{editingId === target.id ? <div className="edit-person"><input aria-label="Edit name" value={editName} maxLength={160} onChange={(event) => setEditName(event.target.value)} /><input aria-label="Edit email" type="email" value={editEmail} maxLength={254} onChange={(event) => setEditEmail(event.target.value)} /><button className="icon-button" aria-label="Save person" disabled={busy} onClick={() => void saveEdit(target.id)}><span>Save</span></button></div> : <div className="person-cell"><span className="avatar avatar-soft">{target.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{target.displayName}</strong><small>{target.email || "No email added"}</small></span></div>}</td>
        {canManage && <td className="target-assignment-cell" data-label="Assigned reviewer">{target.assignedReviewer ? <Link className="assignment-context-link" href={`/admin/team?reviewerId=${encodeURIComponent(target.assignedReviewer.membershipId)}`}><strong>{target.assignedReviewer.displayName}</strong><small>Manage in Team Access</small></Link> : <Link className="assignment-context-link unassigned" href="/admin/team?state=unassigned"><strong>Unassigned</strong><small>Assign in Team Access</small></Link>}</td>}
        <td className="target-response-cell" data-label="Responses">{target.submissionCount}</td>
        {canManage && <td className="target-actions-cell"><div className="button-row"><button className="icon-button table-action" aria-label={`Edit ${target.displayName}`} title={`Edit ${target.displayName}'s name and email`} disabled={busy} onClick={() => beginEdit(target)}><Pencil size={13} /></button><button className="icon-button table-action" aria-label={`Archive ${target.displayName}`} title={`Archive ${target.displayName}`} disabled={busy} onClick={() => void archive(target)}><X size={14} /></button></div></td>}
      </tr>)}
      {shown.length === 0 && <tr><td colSpan={canManage ? 4 : 2} className="no-results">No people match this search.</td></tr>}
    </tbody></table></div>}{cursor && <div className="load-more-row"><button className="button button-small" disabled={busy} onClick={() => void loadMore()}>{busy ? "Loading…" : `Load more people · ${targets.length} loaded`}</button></div>}
  </div>;
}

