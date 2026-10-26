"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, LockKeyhole, MoveVertical, Send, UserRoundCheck } from "lucide-react";
import type { FormDefinition, FormField, SignatureAnswer } from "@reviewroom/contracts/forms";
import { apiErrorSchema } from "@reviewroom/contracts";
import { buildInitialAnswers, shouldShowReviewTargetSelector, signatureAnswerIsComplete } from "./review-portal-model";
import { SignatureInput } from "./signature-input";
import { safeWorkspaceTheme, workspaceThemeCssVariables } from "../../lib/workspace-theme";
import { useLocale, useTranslations } from "next-intl";
import { directionForLocale } from "../../lib/locale";
import { LanguageSwitcher } from "../../components/language-switcher";
import { PlatformThemeToggle } from "../../components/platform-theme-toggle";
import { localizeApiError } from "../../lib/api-error-locale";
import { formatNumber, type Locale } from "../../lib/locale";
import { defaultFieldTranslationKeys, getDefaultFieldDescription, isDefaultFieldLabel } from "../forms/field-default-labels";
type PortalData = { reviewerName: string; theme?: unknown; targets: { id: string; displayName: string }[]; forms: { id: string; title: string; description: string; versionId: string; definition: FormDefinition }[] };
type Answer = string | number | boolean | string[] | SignatureAnswer;
function isMissingRequiredAnswer(field: FormField, answer: Answer | undefined): boolean {
  if (!field.required) return false;
  if (answer === undefined) return true;
  if (field.type === "consent") return answer !== true;
  if (field.type === "signature") return !answer || typeof answer !== "object" || !signatureAnswerIsComplete(answer as SignatureAnswer);
  if (typeof answer === "string") return answer.trim().length === 0;
  if ((field.type === "checkboxes" || field.type === "ranking") && Array.isArray(answer)) return answer.length === 0;
  return false;
}
function getCheckboxLimitError(field: FormField, answer: Answer | undefined): string | null {
  if (field.type !== "checkboxes") return null;
  const count = Array.isArray(answer) ? answer.length : 0;
  if (field.minSelections !== undefined && count < field.minSelections) return `Select at least ${field.minSelections} options for “${field.label}”.`;
  if (field.maxSelections !== undefined && count > field.maxSelections) return `Select no more than ${field.maxSelections} options for “${field.label}”.`;
  return null;
}
function getRatingValues(field: Extract<FormField, { type: "rating" }>): number[] | null {
  const valueCount = (field.max - field.min) / field.step + 1;
  if (!Number.isSafeInteger(valueCount) || valueCount < 1 || valueCount > 21) return null;
  return Array.from({ length: valueCount }, (_, index) => field.min + index * field.step);
}
export function ReviewPortal({ token, data }: { token: string; data: PortalData }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("publicReview");
  const tForms = useTranslations("forms");
  const tEditor = useTranslations("editor");
  const tCommon = useTranslations("common");
  const tNavigation = useTranslations("navigation");
  const theme = safeWorkspaceTheme(data.theme);
  const [targetId, setTargetId] = useState(data.targets[0]?.id ?? ""); const [formId, setFormId] = useState(data.forms[0]?.id ?? ""); const [answers, setAnswers] = useState<Record<string, Answer>>(() => buildInitialAnswers(data.forms[0]?.definition.fields ?? [])); const [error, setError] = useState(""); const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); const [complete, setComplete] = useState(false); const [busy, setBusy] = useState(false);
  const form = data.forms.find((item) => item.id === formId); const fields = form?.definition.fields ?? [];
  useEffect(() => {
    if (error) document.getElementById("review-submit-error")?.focus();
  }, [error]);
  function displayedFieldLabel(field: FormField): string {
    if (!isDefaultFieldLabel(field)) return field.label;
    if (field.type === "singleChoice") return tEditor("singleChoiceQuestion");
    if (field.type === "checkboxes") return tEditor("checkboxesQuestion");
    return tEditor(defaultFieldTranslationKeys[field.type]);
  }
  function displayedFieldDescription(field: FormField): string {
    const original = getDefaultFieldDescription(field);
    if (original === null) return field.description;
    return tEditor(field.type === "name" ? "nameDefaultDescription" : "headingDefaultDescription");
  }
  function invalidAnswerMessage(field: FormField): string {
    if (field.type === "email") return t("emailError");
    if (field.type === "url") return t("urlError");
    if (field.type === "phone") return t("phoneError");
    if (field.type === "signature") return t("signatureError");
    return t("invalidFieldAnswer");
  }
  function setAnswer(id: string, answer: Answer) { setAnswers((current) => ({ ...current, [id]: answer })); clearFieldError(id); }
  function focusField(fieldId: string) {
    const container = document.getElementById(`field-${fieldId}`);
    if (!container) return;
    container.scrollIntoView({ behavior: "smooth", block: "center" });
    window.requestAnimationFrame(() => {
      const control = container.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select, button, canvas, [tabindex='0']");
      (control ?? container).focus({ preventScroll: true });
    });
  }
  function reportFieldError(fieldId: string, message: string) {
    setFieldErrors((current) => ({ ...current, [fieldId]: message }));
    focusField(fieldId);
  }
  function clearFieldError(fieldId: string) {
    setFieldErrors((current) => { if (!(fieldId in current)) return current; const next = { ...current }; delete next[fieldId]; return next; });
  }
  function shiftRanking(field: Extract<FormField, { type: "ranking" }>, index: number, delta: -1 | 1) { const list = [...((answers[field.id] as string[] | undefined) ?? field.options.map((option) => option.id))]; const next = index + delta; if (next < 0 || next >= list.length) return; [list[index], list[next]] = [list[next]!, list[index]!]; setAnswer(field.id, list); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    if (!targetId || !form) { setError(t("submitFailed")); return; }
    const invalidFields: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "heading") continue;
      if (isMissingRequiredAnswer(field, answers[field.id])) {
        invalidFields[field.id] = t("needsAnswer", { field: displayedFieldLabel(field) });
      } else if (getCheckboxLimitError(field, answers[field.id]) && field.type === "checkboxes") {
        const count = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]).length : 0;
        const belowMinimum = field.minSelections !== undefined && count < field.minSelections;
        const limit = belowMinimum ? field.minSelections! : field.maxSelections ?? count;
        invalidFields[field.id] = t(belowMinimum ? "minSelectionError" : "maxSelectionError", { count: formatNumber(limit, locale, 0), field: displayedFieldLabel(field) });
      } else {
        const container = document.getElementById(`field-${field.id}`);
        const invalidControl = Array.from(container?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea") ?? []).find((control) => !control.validity.valid);
        const answer = answers[field.id];
        const text = typeof answer === "string" ? answer.trim() : "";
        const invalidLength = text.length > 0 && "minLength" in field && field.minLength !== undefined && text.length < field.minLength;
        if (invalidLength && "minLength" in field) invalidFields[field.id] = t("minLengthError", { count: formatNumber(field.minLength!, locale, 0) });
        else if (invalidControl instanceof HTMLInputElement && invalidControl.validity.rangeUnderflow) invalidFields[field.id] = t("minimumError", { value: invalidControl.min });
        else if (invalidControl instanceof HTMLInputElement && invalidControl.validity.rangeOverflow) invalidFields[field.id] = t("maximumError", { value: invalidControl.max });
        else if (invalidControl instanceof HTMLInputElement && invalidControl.validity.stepMismatch) invalidFields[field.id] = t("stepError", { step: invalidControl.step });
        else if (invalidControl) invalidFields[field.id] = invalidAnswerMessage(field);
      }
    }
    const firstInvalid = fields.find((field) => invalidFields[field.id]);
    if (firstInvalid) {
      setFieldErrors(invalidFields); focusField(firstInvalid.id); return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/public/review/${encodeURIComponent(token)}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ formId: form.id, formVersionId: form.versionId, targetId, answers }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const parsed = apiErrorSchema.safeParse(body);
        if (parsed.success && parsed.data.error.fieldId && fields.some((field) => field.id === parsed.data.error.fieldId)) {
          const invalidField = fields.find((field) => field.id === parsed.data.error.fieldId)!;
          reportFieldError(invalidField.id, parsed.data.error.code === "REQUIRED_ANSWER_MISSING" ? t("needsAnswer", { field: displayedFieldLabel(invalidField) }) : invalidAnswerMessage(invalidField));
          return;
        }
        setError(parsed.success ? localizeApiError(parsed.data.error.code, locale) : t("submitFailed"));
        return;
      }
      setComplete(true);
    } catch (caught) {
      const message = caught instanceof Error && caught.name !== "TypeError" ? caught.message : t("submitFailed");
      setError(message);
    } finally {
      setBusy(false);
    }
  }
  function renderField(field: FormField) {
    const value = answers[field.id];
    const labelId = `question-label-${field.id}`;
    const inputId = `question-input-${field.id}`;
    const invalidProps = { "aria-invalid": fieldErrors[field.id] ? true as const : undefined, "aria-describedby": fieldErrors[field.id] ? `field-error-${field.id}` : undefined };
    if (field.type === "heading") return <section className="public-form-section" key={field.id} aria-labelledby={labelId}>
      <h3 id={labelId} dir="auto">{displayedFieldLabel(field)}</h3>
      {field.description && <p dir="auto">{displayedFieldDescription(field)}</p>}
    </section>;
    return <div className={`public-field${fieldErrors[field.id] ? " public-field-invalid" : ""}`} id={`field-${field.id}`} key={field.id} tabIndex={-1} aria-invalid={fieldErrors[field.id] ? true : undefined} aria-describedby={fieldErrors[field.id] ? `field-error-${field.id}` : undefined}>
      <div className="public-label" id={labelId} dir="auto">{displayedFieldLabel(field)}{field.required && <span className="required-mark">{tForms("fieldRequired")}</span>}</div>
      {field.description && <p className="public-help" dir="auto">{displayedFieldDescription(field)}</p>}
      {field.type === "name" && <input id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} required={field.required} className="public-input" type="text" autoComplete="name" minLength={field.minLength} maxLength={field.maxLength ?? 160} placeholder={field.placeholder} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(field.id, event.target.value)} />}
      {field.type === "shortText" && <input id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} required={field.required} className="public-input" type="text" minLength={field.minLength} maxLength={field.maxLength ?? 5000} placeholder={field.placeholder} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(field.id, event.target.value)} />}
      {field.type === "longText" && <textarea id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} required={field.required} className="public-input public-textarea" minLength={field.minLength} maxLength={field.maxLength ?? 20000} placeholder={field.placeholder} rows={4} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(field.id, event.target.value)} />}
      {field.type === "email" && <input id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} required={field.required} className="public-input" type="email" autoComplete="email" minLength={field.minLength} maxLength={field.maxLength ?? 254} placeholder={field.placeholder} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(field.id, event.target.value)} />}
      {field.type === "url" && <input id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} required={field.required} className="public-input" type="url" inputMode="url" autoCapitalize="none" minLength={field.minLength} maxLength={field.maxLength ?? 2048} placeholder={field.placeholder ?? "https://example.com"} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(field.id, event.target.value)} />}
      {field.type === "phone" && <input id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} required={field.required} className="public-input" type="tel" inputMode="tel" autoComplete="tel" maxLength={32} placeholder={field.placeholder ?? "+1 555 123 4567"} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(field.id, event.target.value)} />}
      {field.type === "number" && <input id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} required={field.required} className="public-input" type="number" min={field.min} max={field.max} step={field.step ?? 1} placeholder={field.placeholder} value={typeof value === "number" || typeof value === "string" ? value : ""} onChange={(event) => event.target.value === "" ? setAnswer(field.id, "") : setAnswer(field.id, Number(event.target.value))} />}
      {field.type === "date" && <input id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} required={field.required} className="public-input" type="date" min={field.minDate} max={field.maxDate} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(field.id, event.target.value)} />}
      {field.type === "singleChoice" && <div className="public-options" role="radiogroup" aria-labelledby={labelId}>{field.options.map((option) => <label className="public-option" key={option.id}><input type="radio" name={field.id} {...invalidProps} required={field.required} checked={value === option.id} onChange={() => setAnswer(field.id, option.id)} /><span dir="auto">{option.label}</span></label>)}</div>}
      {field.type === "checkboxes" && (() => {
        const selectedOptions = (value as string[] | undefined) ?? [];
        const maximumReached = field.maxSelections !== undefined && selectedOptions.length >= field.maxSelections;
        const hasLimits = field.minSelections !== undefined || field.maxSelections !== undefined;
        return <div className="public-options" role="group" aria-labelledby={labelId} aria-describedby={hasLimits ? `${labelId}-selection-help` : undefined}>
          {field.options.map((option) => {
            const checked = selectedOptions.includes(option.id);
            return <label className="public-option" key={option.id}><input type="checkbox" {...invalidProps} checked={checked} disabled={!checked && maximumReached} onChange={(event) => setAnswer(field.id, event.target.checked ? [...selectedOptions, option.id] : selectedOptions.filter((id) => id !== option.id))} /><span dir="auto">{option.label}</span></label>;
          })}
          {hasLimits && <small className="public-help" id={`${labelId}-selection-help`} role="status">{field.minSelections !== undefined && tForms("chooseAtLeast", { count: formatNumber(field.minSelections, locale, 0) })} {field.maxSelections !== undefined && tForms("chooseUpTo", { count: formatNumber(field.maxSelections, locale, 0) })}</small>}
        </div>;
      })()}
      {field.type === "dropdown" && <div className="select-wrap"><select id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} className="public-input" required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => setAnswer(field.id, event.target.value)}><option value="" dir="auto">{field.placeholder ?? tForms("chooseOption")}</option>{field.options.map((option) => <option key={option.id} value={option.id} dir="auto">{option.label}</option>)}</select><ChevronDown size={15} /></div>}
      {field.type === "yesNo" && <div className="public-options" role="radiogroup" aria-labelledby={labelId}><label className="public-option"><input type="radio" name={field.id} {...invalidProps} required={field.required} checked={value === true} onChange={() => setAnswer(field.id, true)} /><span>{tCommon("yes")}</span></label><label className="public-option"><input type="radio" name={field.id} {...invalidProps} required={field.required} checked={value === false} onChange={() => setAnswer(field.id, false)} /><span>{tCommon("no")}</span></label></div>}
      {field.type === "rating" && (() => { const ratings = getRatingValues(field); return ratings ? <div className="rating-picker" role="radiogroup" aria-labelledby={labelId}>{ratings.map((rating) => <button type="button" key={rating} className={value === rating ? "rating-option rating-selected" : "rating-option"} {...invalidProps} role="radio" aria-checked={value === rating} onClick={() => setAnswer(field.id, rating)}>{rating}</button>)}</div> : <input id={inputId} aria-labelledby={labelId} {...invalidProps} aria-required={field.required} className="public-input" type="number" min={field.min} max={field.max} step={field.step} value={typeof value === "number" ? value : ""} onChange={(event) => event.target.value === "" ? setAnswer(field.id, "") : setAnswer(field.id, Number(event.target.value))} />; })()}
      {field.type === "consent" && <label className="public-option consent-option"><input type="checkbox" {...invalidProps} checked={value === true} onChange={(event) => setAnswer(field.id, event.target.checked)} /><span dir="auto">{field.consentText}</span></label>}
      {field.type === "signature" && <SignatureInput id={inputId} errorId={fieldErrors[field.id] ? `field-error-${field.id}` : undefined} value={value && typeof value === "object" && !Array.isArray(value) ? value as SignatureAnswer : undefined} onChange={(answer) => setAnswer(field.id, answer)} />}
      {field.type === "ranking" && <div className="public-ranking"><p dir="auto">{field.direction}</p>{(typeof value === "object" && Array.isArray(value) ? value : field.options.map((option) => option.id)).map((id, index, list) => { const option = field.options.find((item) => item.id === id); if (!option) return null; return <div className="public-rank-row" key={option.id}><MoveVertical size={16} /><span dir="auto">{option.label}</span><span className="rank-controls"><button type="button" aria-label={tForms("moveOptionUp", { option: option.label })} onClick={() => shiftRanking(field, index, -1)} disabled={index === 0}><ArrowUp size={14} /></button><button type="button" aria-label={tForms("moveOptionDown", { option: option.label })} onClick={() => shiftRanking(field, index, 1)} disabled={index === list.length - 1}><ArrowDown size={14} /></button></span></div>; })}<small>{tForms("rankHelp")}</small></div>}
      {fieldErrors[field.id] && <p className="public-field-error" id={`field-error-${field.id}`} role="alert">{fieldErrors[field.id]}</p>}
    </div>;
  }
  return <main className="public-page" style={workspaceThemeCssVariables(theme) as React.CSSProperties}>
    <div className="public-top">
      <a href="/reviewer/login" className="brand"><span className="brand-mark">R</span><span>{tNavigation("reviewerPanel")}</span></a>
      <span className="secure-label"><span /> {t("privateLink")}</span><div className="top-actions"><PlatformThemeToggle platform="reviewer" /><LanguageSwitcher /></div>
    </div>
    <div className="public-wrap">
      {complete ? <section className="public-card success-card"><span className="success-ring"><CheckCircle2 size={27} /></span><p className="eyebrow">{t("responseReceived")}</p><h1>{t("thankYou")}</h1><p>{t("saved")}</p></section> : <>
        <header className="public-intro">
          <p className="eyebrow">{t("reviewBy", { name: data.reviewerName.toUpperCase() })}</p>
          <h1>{t("headline")}</h1>
          <p>{t("intro")}</p>
        </header>
        {data.targets.length === 0 ? <section className="public-card"><h2>{t("noTargets")}</h2><p>{t("noTargetsHelp")}</p></section> : data.forms.length === 0 ? <section className="public-card"><h2>{t("noForms")}</h2><p>{t("noFormsHelp")}</p></section> : <form className="public-card public-form" noValidate onSubmit={(event) => void submit(event)}>
          <div className="public-form-meta">
            <span className="public-meta-chip"><span className="public-meta-dot" /> {t("details")}</span>
            <span className="public-meta-chip public-private-chip"><LockKeyhole size={13} /> {t("privateLink")}</span>
          </div>
          {shouldShowReviewTargetSelector(data.targets.length) ? <div className="public-target-picker">
            <label htmlFor="review-target">{t("whoReviewing")}</label>
            <div className="select-wrap"><select className="public-input" id="review-target" value={targetId} onChange={(event) => setTargetId(event.target.value)}>{data.targets.map((target) => <option key={target.id} value={target.id}>{target.displayName}</option>)}</select><ChevronDown size={15} /></div>
          </div> : <div className="public-target-context" aria-label={`${t("reviewing")} ${data.targets[0]?.displayName}`}>
            <span className="public-target-icon"><UserRoundCheck size={18} aria-hidden="true" /></span>
            <span><small>{t("reviewing")}</small><strong>{data.targets[0]?.displayName}</strong></span>
          </div>}
          {data.forms.length > 1 && <div className="public-form-picker"><label htmlFor="review-form">{t("chooseForm")}</label><div className="select-wrap"><select className="public-input" id="review-form" value={formId} onChange={(event) => { const nextFormId = event.target.value; setFormId(nextFormId); setError(""); setFieldErrors({}); setAnswers(buildInitialAnswers(data.forms.find((item) => item.id === nextFormId)?.definition.fields ?? [])); }}>{data.forms.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><ChevronDown size={15} /></div></div>}
          <div className="public-divider" />
          <div lang={form?.definition.language ?? "en"} dir={directionForLocale(form?.definition.language ?? "en")}>
            <header className="public-form-heading"><p className="public-form-kicker">{t("feedback")}</p><h2 dir="auto">{form?.definition.title}</h2>{(form?.definition.description || form?.description) && <p className="public-form-description" dir="auto">{form?.definition.description || form?.description}</p>}</header>
            <div className="public-fields">{fields.map(renderField)}</div>
          </div>
          {error && <p role="alert" id="review-submit-error" tabIndex={-1} className="form-error public-error">{error}</p>}
          {Object.keys(fieldErrors).length > 0 && <div className="public-error-summary" role="alert"><strong>{Object.keys(fieldErrors).length === 1 ? t("oneError") : t("errorCount", { count: formatNumber(Object.keys(fieldErrors).length, locale, 0) })}</strong><button type="button" className="text-button" onClick={() => focusField(fields.find((field) => fieldErrors[field.id])?.id ?? "")}>{t("jumpToFirstError")}</button></div>}
          <button className="button button-primary public-submit" disabled={busy}><Send size={14} /> {busy ? t("saving") : t("submit")}</button>
          <p className="privacy-note"><LockKeyhole size={12} /> {t("privacy")}</p>
        </form>}
      </>}
    </div>
    <footer className="public-footer"><span>{tNavigation("reviewerPanel")}</span><span>{t("secureFeedback")}</span></footer>
  </main>;
}
