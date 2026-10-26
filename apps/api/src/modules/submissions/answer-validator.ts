import { z } from "zod";
import { formDefinitionSchema, rankingAnswerSchema, signatureDrawingAnswerSchema, type FormDefinition } from "@reviewroom/contracts/forms";
import { HttpError } from "../../http/errors.js";

type JsonAnswer = string | number | boolean | string[] | { mode: "typed"; text: string } | { mode: "drawn"; strokes: Array<{ points: Array<{ x: number; y: number }> }> };
function validateFieldValue(field: FormDefinition["fields"][number], value: unknown): JsonAnswer {
  const invalid = (): never => { throw new HttpError(422, "INVALID_ANSWER", `Answer for “${field.label}” is invalid.`, field.id); };
  switch (field.type) {
    case "shortText":
    case "longText": {
      const result = z.string().trim().safeParse(value);
      if (!result.success || (field.minLength !== undefined && result.data.length < field.minLength) || (field.maxLength !== undefined && result.data.length > field.maxLength)) return invalid();
      return result.data;
    }
    case "name": {
      const result = z.string().trim().safeParse(value);
      if (!result.success || (field.minLength !== undefined && result.data.length < field.minLength) || (field.maxLength !== undefined && result.data.length > field.maxLength)) return invalid();
      return result.data;
    }
    case "email": {
      const result = z.string().trim().email().max(254).safeParse(value);
      if (!result.success || (field.minLength !== undefined && result.data.length < field.minLength) || (field.maxLength !== undefined && result.data.length > field.maxLength)) return invalid();
      return result.data.toLowerCase();
    }
    case "url": {
      const result = z.string().trim().max(field.maxLength ?? 2048).safeParse(value);
      if (!result.success || (field.minLength !== undefined && result.data.length < field.minLength) || (field.maxLength !== undefined && result.data.length > field.maxLength)) return invalid();
      try {
        const url = new URL(result.data);
        if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return invalid();
      } catch {
        return invalid();
      }
      return result.data;
    }
    case "phone": {
      const result = z.string().trim().max(32).regex(/^\+?[0-9][0-9\s().-]*$/).safeParse(value);
      if (!result.success) return invalid();
      const digitCount = result.data.replace(/\D/g, "").length;
      if (digitCount < 7 || digitCount > 15) return invalid();
      const digits = result.data.replace(/\D/g, "");
      return result.data.startsWith("+") ? `+${digits}` : digits;
    }
    case "yesNo": {
      if (typeof value !== "boolean") return invalid();
      return value;
    }
    case "number": {
      const result = z.number().finite().safeParse(value);
      if (!result.success || (field.min !== undefined && result.data < field.min) || (field.max !== undefined && result.data > field.max)) return invalid();
      const step = field.step ?? 1;
      const stepQuotient = (result.data - (field.min ?? 0)) / step;
      if (Math.abs(stepQuotient - Math.round(stepQuotient)) > 1e-9) return invalid();
      return result.data;
    }
    case "singleChoice":
    case "dropdown": {
      const result = z.string().uuid().safeParse(value);
      if (!result.success || !field.options.some((option) => option.id === result.data)) return invalid();
      return result.data;
    }
    case "checkboxes": {
      const result = z.array(z.string().uuid()).max(field.options.length).safeParse(value);
      if (!result.success || new Set(result.data).size !== result.data.length || result.data.some((id) => !field.options.some((option) => option.id === id))) return invalid();
      if (field.minSelections !== undefined && result.data.length < field.minSelections) return invalid();
      if (field.maxSelections !== undefined && result.data.length > field.maxSelections) return invalid();
      return result.data;
    }
    case "rating": {
      const result = z.number().int().safeParse(value);
      if (!result.success || result.data < field.min || result.data > field.max || (result.data - field.min) % field.step !== 0) return invalid();
      return result.data;
    }
    case "date": {
      const result = z.iso.date().safeParse(value);
      if (!result.success || (field.minDate !== undefined && result.data < field.minDate) || (field.maxDate !== undefined && result.data > field.maxDate)) return invalid();
      return result.data;
    }
    case "consent": {
      if (value !== true) return invalid();
      return true;
    }
    case "ranking": {
      const result = rankingAnswerSchema(field.options.map((option) => option.id)).safeParse(value);
      if (!result.success) return invalid();
      return result.data;
    }
    case "signature": {
      const result = signatureDrawingAnswerSchema.safeParse(value);
      if (!result.success) return invalid();
      return result.data;
    }
    default: return invalid();
  }
}

function isBlankAnswer(field: FormDefinition["fields"][number], value: unknown): boolean {
  if (value === undefined) return !(field.type === "checkboxes" && (field.minSelections ?? 0) > 0);
  if (field.type === "consent") return value !== true;
  if (field.type === "signature") {
    if (value === undefined) return true;
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const signature = value as { mode?: unknown; text?: unknown; strokes?: unknown[] };
    return signature.mode === "typed" && typeof signature.text === "string" && signature.text.trim().length === 0 || signature.mode === "drawn" && Array.isArray(signature.strokes) && signature.strokes.length === 0;
  }
  if (typeof value === "string") return value.trim().length === 0;
  if (field.type === "checkboxes" && Array.isArray(value)) return value.length === 0 && (field.minSelections === undefined || field.minSelections === 0);
  if (field.type === "ranking" && Array.isArray(value)) return value.length === 0;
  return false;
}

export function validateAnswers(definitionValue: unknown, answersValue: unknown): Record<string, JsonAnswer> {
  const definition = formDefinitionSchema.parse(definitionValue);
  const answers = z.record(z.string().uuid(), z.unknown()).safeParse(answersValue);
  if (!answers.success) throw new HttpError(422, "INVALID_ANSWERS", "Submitted answers have an invalid format.");
  const fieldsById = new Map(definition.fields.map((field) => [field.id, field]));
  const unknownField = Object.keys(answers.data).find((fieldId) => !fieldsById.has(fieldId));
  if (unknownField) throw new HttpError(422, "UNKNOWN_FIELD", "The response includes a field that is not part of this form.");
  const normalized: Record<string, JsonAnswer> = {};
  for (const field of definition.fields) {
    const value = answers.data[field.id];
    if (isBlankAnswer(field, value)) {
      if (field.required) throw new HttpError(422, "REQUIRED_ANSWER_MISSING", `Answer “${field.label}” is required.`, field.id);
      continue;
    }
    normalized[field.id] = validateFieldValue(field, value);
  }
  return normalized;
}
