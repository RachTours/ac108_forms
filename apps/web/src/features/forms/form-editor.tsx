"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, CalendarDays, ChevronDown, CirclePlus, Copy, Eye, Grip, Languages, MessageSquare, MoveVertical, Plus, Save, Send, Trash2 } from "lucide-react";
import { formDefinitionSchema, formDefinitionWriteSchema, type FormDefinition, type FormField } from "@reviewroom/contracts/forms";
import { useApi } from "../../lib/client-api";
import { duplicateField, moveField, moveFieldTo, persistForm } from "./form-editor-actions";
import { changeChoiceMode, fieldPalette as palette, makeField } from "./form-editor-model";
import { defaultFieldTranslationKeys, getDefaultFieldDescription, isDefaultFieldLabel } from "./field-default-labels";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { withSessionSelector } from "../../lib/session-url";
import { useLocale, useTranslations } from "next-intl";
import { directionForLocale, formatNumber, type Locale } from "../../lib/locale";

type FormRecord = { id: string; title: string; description: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; draftDefinition: unknown; currentPublishedId: string | null };
type ActionFeedback = { phase: "idle" | "pending" | "success" | "error"; message: string };
function getRatingPreviewValues(field: Extract<FormField, { type: "rating" }>): number[] | null {
  const count = (field.max - field.min) / field.step + 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > 21) return null;
  return Array.from({ length: count }, (_, index) => field.min + index * field.step);
}

export function FormEditor({ initial }: { initial: FormRecord }) {
  const router = useRouter();
  const api = useApi();
  const session = useWorkspaceSession();
  const tForms = useTranslations("forms");
  const tEditor = useTranslations("editor");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale, 0);
  const initialDefinition = formDefinitionSchema.safeParse(initial.draftDefinition);
  const [definition, setDefinition] = useState<FormDefinition>(initialDefinition.success ? initialDefinition.data : { title: initial.title, description: initial.description, language: "en", fields: [] });
  const [selected, setSelected] = useState<string | null>(definition.fields[0]?.id ?? null);
  const [status, setStatus] = useState(initial.status);
  const [draftFeedback, setDraftFeedback] = useState<ActionFeedback>({ phase: "idle", message: tEditor("saveDraftHint") });
  const [publishFeedback, setPublishFeedback] = useState<ActionFeedback>(initial.status === "PUBLISHED" ? { phase: "success", message: tEditor("publishedLive") } : { phase: "idle", message: tEditor("notPublishedYet") });
  const [busy, setBusy] = useState(false);
  const current = useMemo(() => definition.fields.find((field) => field.id === selected) ?? null, [definition.fields, selected]);
  function updateField(id: string, patch: Partial<FormField>) { setDefinition((value) => ({ ...value, fields: value.fields.map((field) => field.id === id ? { ...field, ...patch } as FormField : field) })); }
  function reorderField(id: string, direction: -1 | 1) { setDefinition((value) => ({ ...value, fields: moveField(value.fields, id, direction) })); }
  function dropField(id: string, targetId: string) { setDefinition((value) => ({ ...value, fields: moveFieldTo(value.fields, id, targetId) })); }
  function duplicateQuestion(field: FormField, index: number) { const copy = duplicateField(field); setDefinition((value) => ({ ...value, fields: [...value.fields.slice(0, index + 1), copy, ...value.fields.slice(index + 1)] })); setSelected(copy.id); }
  function addField(type: FormField["type"]) { const field = makeField(type); setDefinition((value) => ({ ...value, fields: [...value.fields, field] })); setSelected(field.id); }
  async function save(publish = false) {
    const checked = formDefinitionWriteSchema.safeParse(definition);
    if (!checked.success) {
      const message = tEditor("validationError");
      setDraftFeedback({ phase: "error", message });
      if (publish) setPublishFeedback({ phase: "error", message: tEditor("publishValidationError") });
      return;
    }

    setBusy(true);
    setDraftFeedback({ phase: "pending", message: tEditor("saving") });
    if (publish) setPublishFeedback({ phase: "pending", message: tEditor("publishing") });
    try {
      const result = await persistForm(
        () => api(`/forms/${initial.id}`, { method: "PATCH", body: JSON.stringify(checked.data) }),
        () => api(`/forms/${initial.id}/publish`, { method: "POST" }),
        publish,
      );
      if (result.kind === "saved") setDraftFeedback({ phase: "success", message: tEditor("draftSaved") });
      if (result.kind === "published") {
        setStatus("PUBLISHED");
        setDraftFeedback({ phase: "success", message: tEditor("draftSaved") });
        setPublishFeedback({ phase: "success", message: tEditor("publishedSuccess") });
      }
      if (result.kind === "failed" && result.stage === "save") {
        setDraftFeedback({ phase: "error", message: result.message });
        if (publish) setPublishFeedback({ phase: "error", message: tEditor("publishSaveError", { message: result.message }) });
      }
      if (result.kind === "failed" && result.stage === "publish") {
        setDraftFeedback({ phase: "success", message: tEditor("draftSaved") });
        setPublishFeedback({ phase: "error", message: tEditor("publishError", { message: result.message }) });
      }
    } finally {
      setBusy(false);
    }
  }
  async function archive() { if (!window.confirm(tEditor("archiveConfirm"))) return; setBusy(true); try { await api(`/forms/${initial.id}`, { method: "DELETE" }); router.push(withSessionSelector("/admin/forms", session.sessionId)); } catch (error) { setDraftFeedback({ phase: "error", message: error instanceof Error ? error.message : tEditor("archiveFailed") }); setBusy(false); } }
  async function permanentlyDelete() {
    if (window.prompt(tEditor("deleteConfirm", { title: definition.title })) !== definition.title) return;
    setBusy(true);
    try { await api(`/forms/${initial.id}/permanent`, { method: "DELETE" }); router.push(withSessionSelector("/admin/forms", session.sessionId)); }
    catch (error) { setDraftFeedback({ phase: "error", message: error instanceof Error ? error.message : tEditor("deleteFailed") }); setBusy(false); }
  }
  function updateOption(field: FormField, optionId: string, label: string) { if (!("options" in field)) return; updateField(field.id, { options: field.options.map((option) => option.id === optionId ? { ...option, label } : option) } as Partial<FormField>); }
  function addOption(field: FormField) { if (!("options" in field) || field.options.length >= (field.type === "ranking" ? 50 : 100)) return; updateField(field.id, { options: [...field.options, { id: crypto.randomUUID(), label: tEditor("optionNumber", { number: number(field.options.length + 1) }) }] } as Partial<FormField>); }
  function moveOption(field: FormField, index: number, direction: -1 | 1) { if (!("options" in field)) return; const options = [...field.options]; const target = index + direction; if (target < 0 || target >= options.length) return; [options[index], options[target]] = [options[target]!, options[index]!]; updateField(field.id, { options } as Partial<FormField>); }
  function removeOption(field: FormField, id: string) {
    if (!("options" in field) || field.options.length <= 2) return;
    const options = field.options.filter((option) => option.id !== id);
    if (field.type === "checkboxes") {
      const minSelections = Math.min(field.minSelections ?? 0, options.length);
      const maxSelections = field.maxSelections === undefined ? undefined : Math.max(minSelections, Math.min(field.maxSelections, options.length));
      updateField(field.id, { options, minSelections, maxSelections } as Partial<FormField>);
      return;
    }
    updateField(field.id, { options } as Partial<FormField>);
  }
  function setChoiceMode(mode: "single" | "multiple") {
    if (!current || (current.type !== "singleChoice" && current.type !== "checkboxes")) return;
    setDefinition((value) => ({ ...value, fields: value.fields.map((field) => field.id === current.id && (field.type === "singleChoice" || field.type === "checkboxes") ? changeChoiceMode(field, mode) : field) }));
  }
  function fieldTypeLabel(type: FormField["type"]): string {
    if (type === "singleChoice") return tForms("multipleChoice");
    if (type === "checkboxes") return tForms("checkboxes");
    return tEditor(defaultFieldTranslationKeys[type]);
  }
  function displayedFieldLabel(field: FormField): string {
    if (!isDefaultFieldLabel(field)) return field.label;
    if (field.type === "singleChoice") return tEditor("singleChoiceQuestion");
    if (field.type === "checkboxes") return tEditor("checkboxesQuestion");
    return tEditor(defaultFieldTranslationKeys[field.type]);
  }
  function displayedFieldDescription(field: FormField): string {
    const isDefault = getDefaultFieldDescription(field);
    if (isDefault === null) return field.description;
    return tEditor(field.type === "name" ? "nameDefaultDescription" : "headingDefaultDescription");
  }
  function renderPreview(field: FormField) {
    if (field.type === "heading") return <div className="section-preview"><h3 dir="auto">{displayedFieldLabel(field)}</h3>{field.description && <p dir="auto">{displayedFieldDescription(field)}</p>}</div>;
    if (field.type === "singleChoice") return <div className="option-preview">{field.options.map((option) => <div className="option-line" key={option.id}><span className="radio-indicator" /><span dir="auto">{option.label}</span></div>)}</div>;
    if (field.type === "checkboxes") return <div className="option-preview">{field.options.map((option) => <div className="option-line" key={option.id}><span className="checkbox-indicator" /><span dir="auto">{option.label}</span></div>)}</div>;
    if (field.type === "dropdown") return <div className="preview-input preview-select"><span>{tForms("chooseOption")}</span><ChevronDown size={15} /></div>;
    if (field.type === "yesNo") return <div className="option-preview"><div className="option-line"><span className="radio-indicator" />{tCommon("yes")}</div><div className="option-line"><span className="radio-indicator" />{tCommon("no")}</div></div>;
    if (field.type === "rating") {
      const values = getRatingPreviewValues(field);
      return <div className="rating-preview-wrap">{values ? <div className="rating-preview" aria-label={tEditor("ratingAccessible", { min: number(field.min), max: number(field.max), step: number(field.step) })}>{values.map((value) => <span key={value}>{number(value)}</span>)}</div> : <div className="preview-input">{tEditor("ratingFallback", { min: number(field.min), max: number(field.max), step: number(field.step) })}</div>}<div className="scale-ends"><span>{number(field.min)} · {tEditor("lowest")}</span><span>{number(field.max)} · {tEditor("highest")}</span></div></div>;
    }
    if (field.type === "date") return <div className="preview-input preview-select"><span>{tEditor("chooseDate")}</span><CalendarDays size={15} /></div>;
    if (field.type === "consent") return <div className="option-line"><span className="checkbox-indicator" /><span dir="auto">{field.consentText}</span></div>;
    if (field.type === "ranking") return <div className="rank-list"><small className="ranking-direction" dir="auto">{field.direction}</small>{field.options.map((option, optionIndex) => <div className="rank-option" key={option.id}><MoveVertical size={14} /><span dir="auto">{option.label}</span><span className="rank-controls"><button type="button" aria-label={`Move ${option.label} up`} onClick={(event) => { event.stopPropagation(); moveOption(field, optionIndex, -1); }} disabled={optionIndex === 0}><ArrowUp size={12} /></button><button type="button" aria-label={`Move ${option.label} down`} onClick={(event) => { event.stopPropagation(); moveOption(field, optionIndex, 1); }} disabled={optionIndex === field.options.length - 1}><ArrowDown size={12} /></button></span></div>)}</div>;
    if (field.type === "signature") return <div className="signature-preview"><span>{tEditor("signaturePrompt")}</span><span className="signature-preview-line" /></div>;
    if (field.type === "longText") return <div className="preview-input preview-textarea" />;
    const placeholder = field.type === "email" ? tEditor("emailExample") : field.type === "url" ? tEditor("urlExample") : field.type === "phone" ? tEditor("phoneExample") : field.type === "name" ? tEditor("enterFullName") : tEditor("yourAnswer");
    return <div className="preview-input">{placeholder}</div>;
  }

  return <div className="page-content editor-content"><div className="editor-toolbar"><Link href="/admin/forms" className="icon-button" aria-label={tEditor("backForms")}><ArrowLeft size={16} /></Link><div className="editor-title"><span className="eyebrow">{tEditor("studio")}</span><strong>{definition.title || tForms("untitled")}</strong><small>{status === "PUBLISHED" ? tEditor("published") : tEditor("draft")}</small></div><div className="button-row"><div className="editor-feedback" aria-live="polite" aria-atomic="true"><span className={`save-state feedback-${draftFeedback.phase}`}><span>{tEditor("draftStatus")}</span>{draftFeedback.message}</span><span className={`save-state feedback-${publishFeedback.phase}`}><span>{tEditor("publishStatus")}</span>{publishFeedback.message}</span></div><button className="button" onClick={() => void save()} disabled={busy}><Save size={14} /> {busy && draftFeedback.phase === "pending" ? tEditor("saving") : tEditor("saveDraft")}</button><button className="button button-primary" onClick={() => void save(true)} disabled={busy || definition.fields.length === 0}><Send size={14} /> {publishFeedback.phase === "pending" ? tEditor("publishing") : tEditor("publish")}</button><button className="icon-button archive-action" type="button" aria-label={tEditor("archive")} title={tEditor("archive")} onClick={() => void archive()} disabled={busy}><Archive size={15} /></button><button className="icon-button danger-action" type="button" aria-label={tEditor("delete")} title={tEditor("delete")} onClick={() => void permanentlyDelete()} disabled={busy}><Trash2 size={15} /></button></div></div>
    <div className="editor-title-inputs"><input dir="auto" aria-label={tEditor("formTitle")} value={definition.title} maxLength={160} onChange={(event) => setDefinition({ ...definition, title: event.target.value })} /><textarea dir="auto" aria-label={tEditor("formDescription")} value={definition.description} maxLength={2000} onChange={(event) => setDefinition({ ...definition, description: event.target.value })} placeholder={tForms("description")} rows={2} /><label className="form-language-setting"><Languages size={18} aria-hidden="true" /><span className="form-language-copy"><span>{tForms("language")}</span><small>{tForms("languageHelp")}</small></span><select aria-label={tForms("language")} value={definition.language} onChange={(event) => setDefinition({ ...definition, language: event.target.value as Locale })}><option value="en">{tForms("english")}</option><option value="fr">{tForms("french")}</option><option value="ar">{tForms("arabic")}</option></select></label></div>
    <div className="builder-grid">
      <aside className="builder-panel">
        <h2>{tEditor("addToForm")}</h2>
        {[
          { label: tEditor("structure"), fields: palette.filter((item) => item.type === "heading") },
          { label: tEditor("answerFields"), fields: palette.filter((item) => item.type !== "heading") },
        ].map((group) => <div className="palette-group" key={group.label}>
          <span className="palette-group-title">{group.label}</span>
          <div className="field-palette">{group.fields.map((item) => <button className="field-button" key={item.type} onClick={() => addField(item.type)} type="button"><CirclePlus size={12} />{fieldTypeLabel(item.type)}</button>)}</div>
        </div>)}
        <div className="palette-note">{tEditor("paletteHelp")}</div>
      </aside>
      <section className="builder-panel canvas-panel">
        <div className="canvas-toolbar"><span><Eye size={14} /> {tForms("preview")}</span><span>{number(definition.fields.length)} {definition.fields.length === 1 ? tForms("question") : tForms("questions")}</span></div>
        <div className="form-canvas"><div className="form-sheet" lang={definition.language} dir={directionForLocale(definition.language)}>
          <span className="form-preview-tag">{tForms("reviewForm")}</span>
          <h2 dir="auto">{definition.title || tForms("untitled")}</h2>
          <p dir="auto">{definition.description || tForms("introduction")}</p>
          {definition.fields.length === 0 ? <div className="canvas-empty"><CirclePlus size={19} /><strong>{tForms("addFirst")}</strong><span>{tForms("chooseType")}</span></div> : definition.fields.map((field, index) => <article className={`form-field ${selected === field.id ? "form-field-selected" : ""}`} key={field.id} tabIndex={0} aria-label={tForms("selectField", { field: displayedFieldLabel(field) })} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(field.id); } }} draggable onClick={() => setSelected(field.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", field.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData("text/plain"); if (draggedId) dropField(draggedId, field.id); }}>
            <div className="field-actions"><span title={tEditor("dragReorder")}><Grip size={13} /> {fieldTypeLabel(field.type)}</span><span>
              <button type="button" aria-label={tForms("moveQuestionUp")} onClick={(event) => { event.stopPropagation(); reorderField(field.id, -1); }} disabled={index === 0}><ArrowUp size={13} /></button>
              <button type="button" aria-label={tForms("moveQuestionDown")} onClick={(event) => { event.stopPropagation(); reorderField(field.id, 1); }} disabled={index === definition.fields.length - 1}><ArrowDown size={13} /></button>
              <button type="button" aria-label={tForms("duplicateQuestion", { field: displayedFieldLabel(field) })} onClick={(event) => { event.stopPropagation(); duplicateQuestion(field, index); }}><Copy size={13} /></button>
              <button type="button" aria-label={tForms("deleteQuestion", { field: displayedFieldLabel(field) })} onClick={(event) => { event.stopPropagation(); setDefinition({ ...definition, fields: definition.fields.filter((candidate) => candidate.id !== field.id) }); setSelected(null); }}><Trash2 size={13} /></button>
            </span></div>
            {field.type === "heading" ? renderPreview(field) : <>
              <label dir="auto">{displayedFieldLabel(field)}{field.required && <em>{tForms("fieldRequired")}</em>}</label>
              {field.description && <small className="field-help" dir="auto">{displayedFieldDescription(field)}</small>}
              {renderPreview(field)}
            </>}
          </article>)}
          <div className="preview-submit">{tEditor("submitReview")} <span>{tEditor("responsesSaved")}</span></div>
        </div></div>
      </section>
      <aside className="builder-panel property-panel">
        <h2>{tEditor("settings")}</h2>
        {current ? <div className="settings-panel">
          <label htmlFor="question-label">{current.type === "heading" ? tEditor("heading") : tEditor("label")}</label>
          <input id="question-label" dir="auto" value={displayedFieldLabel(current)} maxLength={160} onChange={(event) => updateField(current.id, { label: event.target.value })} />
          <label htmlFor="question-help">{tEditor("fieldDescription")}</label>
          <textarea id="question-help" dir="auto" rows={3} maxLength={500} value={displayedFieldDescription(current)} onChange={(event) => updateField(current.id, { description: event.target.value })} />
          {current.type !== "heading" && <label className="switch-row"><span>{tEditor("requiredSetting")}</span><input className="switch" type="checkbox" checked={current.required} onChange={(event) => updateField(current.id, { required: event.target.checked })} /></label>}

          {(current.type === "singleChoice" || current.type === "checkboxes") && <>
            <label htmlFor="choice-mode">{tEditor("answerSelection")}</label>
            <select id="choice-mode" value={current.type === "singleChoice" ? "single" : "multiple"} onChange={(event) => setChoiceMode(event.target.value as "single" | "multiple")}>
              <option value="single">{tEditor("chooseOne")}</option>
              <option value="multiple">{tEditor("chooseMany")}</option>
            </select>
            <p className="help-copy">{current.type === "singleChoice" ? tEditor("choiceOneHelp") : tEditor("choiceManyHelp")}</p>
          </>}

          {(current.type === "name" || current.type === "shortText" || current.type === "longText" || current.type === "email" || current.type === "url" || current.type === "phone" || current.type === "number" || current.type === "dropdown") && <>
            <label htmlFor="field-placeholder">{tEditor("placeholder")}</label>
            <input id="field-placeholder" dir="auto" maxLength={250} placeholder={current.type === "url" ? tEditor("urlExample") : current.type === "email" ? tEditor("emailExample") : current.type === "phone" ? tEditor("phoneExample") : current.type === "dropdown" ? tForms("chooseOption") : tEditor("yourAnswer")} value={current.placeholder ?? ""} onChange={(event) => updateField(current.id, { placeholder: event.target.value || undefined } as Partial<FormField>)} />
          </>}

          {"options" in current && <>
            <div className="setting-subhead">{tEditor("answerOptions")}</div>
            {current.options.map((option, index) => <div className="option-editor" key={option.id}>
              <input aria-label={tEditor("optionNumber", { number: number(index + 1) })} dir="auto" value={option.label} maxLength={120} onChange={(event) => updateOption(current, option.id, event.target.value)} />
              <button className="icon-button" aria-label={tEditor("removeOption", { option: option.label })} onClick={() => removeOption(current, option.id)} type="button" disabled={current.options.length <= 2}><Trash2 size={13} /></button>
            </div>)}
            <button className="text-button" type="button" onClick={() => addOption(current)} disabled={current.options.length >= (current.type === "ranking" ? 50 : 100)}><Plus size={13} /> {tEditor("addOption")}</button>
          </>}

          {(current.type === "name" || current.type === "shortText" || current.type === "longText" || current.type === "email" || current.type === "url") && <div className="property-columns">
            <div><label htmlFor="min-length">{tEditor("minimumCharacters")}</label><input id="min-length" type="number" min={0} max={current.type === "name" ? 160 : current.type === "shortText" ? 5000 : current.type === "longText" ? 20000 : current.type === "email" ? 254 : 2048} value={current.minLength ?? ""} onChange={(event) => updateField(current.id, { minLength: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div>
            <div><label htmlFor="max-length">{tEditor("maximumCharacters")}</label><input id="max-length" type="number" min={1} max={current.type === "name" ? 160 : current.type === "shortText" ? 5000 : current.type === "longText" ? 20000 : current.type === "email" ? 254 : 2048} value={current.maxLength ?? ""} onChange={(event) => updateField(current.id, { maxLength: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div>
          </div>}
          {current.type === "number" && <div className="property-columns property-columns-three">
            <div><label htmlFor="number-min">{tEditor("minimum")}</label><input id="number-min" type="number" step="any" value={current.min ?? ""} onChange={(event) => updateField(current.id, { min: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div>
            <div><label htmlFor="number-max">{tEditor("maximum")}</label><input id="number-max" type="number" step="any" value={current.max ?? ""} onChange={(event) => updateField(current.id, { max: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div>
            <div><label htmlFor="number-step">{tEditor("step")}</label><input id="number-step" type="number" min="0.000001" step="any" value={current.step ?? 1} onChange={(event) => updateField(current.id, { step: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div>
          </div>}
          {current.type === "checkboxes" && <div className="property-columns">
            <div><label htmlFor="checkbox-min">{tEditor("minSelections")}</label><input id="checkbox-min" type="number" min={0} max={current.options.length} value={current.minSelections ?? ""} onChange={(event) => updateField(current.id, { minSelections: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div>
            <div><label htmlFor="checkbox-max">{tEditor("maxSelections")}</label><input id="checkbox-max" type="number" min={1} max={current.options.length} value={current.maxSelections ?? ""} onChange={(event) => updateField(current.id, { maxSelections: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div>
          </div>}
          {current.type === "checkboxes" && <p className="help-copy">{tEditor("selectionLimitsHelp")}</p>}
          {current.type === "rating" && <div className="property-columns property-columns-three">
            <div><label htmlFor="rating-min">{tEditor("minimumValue")}</label><input id="rating-min" type="number" value={current.min} onChange={(event) => updateField(current.id, { min: Number(event.target.value) } as Partial<FormField>)} /></div>
            <div><label htmlFor="rating-max">{tEditor("maximumValue")}</label><input id="rating-max" type="number" value={current.max} onChange={(event) => updateField(current.id, { max: Number(event.target.value) } as Partial<FormField>)} /></div>
            <div><label htmlFor="rating-step">{tEditor("stepSize")}</label><input id="rating-step" type="number" min={1} value={current.step} onChange={(event) => updateField(current.id, { step: Number(event.target.value) } as Partial<FormField>)} /></div>
          </div>}
          {current.type === "date" && <div className="property-columns">
            <div><label htmlFor="date-min">{tEditor("minDate")}</label><input id="date-min" type="date" value={current.minDate ?? ""} onChange={(event) => updateField(current.id, { minDate: event.target.value || undefined } as Partial<FormField>)} /></div>
            <div><label htmlFor="date-max">{tEditor("maxDate")}</label><input id="date-max" type="date" value={current.maxDate ?? ""} onChange={(event) => updateField(current.id, { maxDate: event.target.value || undefined } as Partial<FormField>)} /></div>
          </div>}
          {current.type === "consent" && <><label htmlFor="consent-text">{tEditor("consentStatement")}</label><textarea id="consent-text" dir="auto" rows={3} value={current.consentText} onChange={(event) => updateField(current.id, { consentText: event.target.value } as Partial<FormField>)} /></>}
          {current.type === "ranking" && <><label htmlFor="ranking-direction">{tEditor("rankingInstruction")}</label><input id="ranking-direction" dir="auto" maxLength={240} value={current.direction} onChange={(event) => updateField(current.id, { direction: event.target.value } as Partial<FormField>)} /><p className="help-copy">{tEditor("rankingHelp")}</p></>}
        </div> : <div className="properties-empty"><MessageSquare size={18} /><strong>{tEditor("selectQuestion")}</strong><span>{tEditor("fieldControlsHelp")}</span></div>}
      </aside></div>
  </div>;
}
