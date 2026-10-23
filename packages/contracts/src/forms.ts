import { z } from "zod";

const baseField = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(160),
  description: z.string().max(500),
  required: z.boolean(),
}).strict();

const option = z.object({ id: z.string().uuid(), label: z.string().trim().min(1).max(120) }).strict();
export const signatureAnswerSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("typed"), text: z.string().trim().min(1).max(160) }).strict(),
  z.object({ mode: z.literal("drawn"), strokes: z.array(z.object({ points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()).min(2).max(1200) }).strict()).min(1).max(20) }).strict().superRefine((value, context) => {
    if (value.strokes.reduce((total, stroke) => total + stroke.points.length, 0) > 1200) context.addIssue({ code: "custom", message: "Signature contains too many points." });
  }),
]);

export const formFieldSchema = z.discriminatedUnion("type", [
  baseField.extend({ type: z.literal("heading") }),
  baseField.extend({ type: z.literal("name"), minLength: z.number().int().min(0).max(160).optional(), maxLength: z.number().int().min(1).max(160).optional() }),
  baseField.extend({ type: z.literal("shortText"), minLength: z.number().int().min(0).max(5000).optional(), maxLength: z.number().int().min(1).max(5000).optional() }),
  baseField.extend({ type: z.literal("longText"), minLength: z.number().int().min(0).max(20000).optional(), maxLength: z.number().int().min(1).max(20000).optional() }),
  baseField.extend({ type: z.literal("email") }),
  baseField.extend({ type: z.literal("url") }),
  baseField.extend({ type: z.literal("phone") }),
  baseField.extend({ type: z.literal("yesNo") }),
  baseField.extend({ type: z.literal("number"), min: z.number().optional(), max: z.number().optional() }),
  baseField.extend({ type: z.literal("singleChoice"), options: z.array(option).min(2).max(100) }),
  baseField.extend({ type: z.literal("checkboxes"), options: z.array(option).min(2).max(100), minSelections: z.number().int().min(0).optional(), maxSelections: z.number().int().min(1).optional() }),
  baseField.extend({ type: z.literal("dropdown"), options: z.array(option).min(2).max(100) }),
  baseField.extend({ type: z.literal("rating"), min: z.number().int(), max: z.number().int(), step: z.number().int().positive() }),
  baseField.extend({ type: z.literal("date"), minDate: z.iso.date().optional(), maxDate: z.iso.date().optional() }),
  baseField.extend({ type: z.literal("consent"), consentText: z.string().trim().min(1).max(1000) }),
  baseField.extend({ type: z.literal("ranking"), options: z.array(option).min(2).max(50), direction: z.string().trim().min(1).max(240) }),
  baseField.extend({ type: z.literal("signature") }),
]);

export const formDefinitionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000),
  fields: z.array(formFieldSchema).max(100),
}).strict().superRefine(({ fields }, context) => {
  const ids = fields.map((field) => field.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Field identifiers must be unique", path: ["fields"] });
  for (const field of fields) {
    if ((field.type === "name" || field.type === "shortText" || field.type === "longText") && field.minLength !== undefined && field.maxLength !== undefined && field.minLength > field.maxLength) {
      context.addIssue({ code: "custom", message: "Minimum length cannot exceed maximum length", path: ["fields", ids.indexOf(field.id)] });
    }
    if ((field.type === "number" || field.type === "rating") && field.min !== undefined && field.max !== undefined && field.min > field.max) {
      context.addIssue({ code: "custom", message: "Minimum value cannot exceed maximum value", path: ["fields", ids.indexOf(field.id)] });
    }
    if (field.type === "rating" && (field.max - field.min) % field.step !== 0) {
      context.addIssue({ code: "custom", message: "Rating step must land exactly on the maximum value", path: ["fields", ids.indexOf(field.id), "step"] });
    }
    if (field.type === "date" && field.minDate && field.maxDate && field.minDate > field.maxDate) {
      context.addIssue({ code: "custom", message: "Earliest date cannot be after latest date", path: ["fields", ids.indexOf(field.id)] });
    }
    if (field.type === "checkboxes") {
      if (field.minSelections !== undefined && field.maxSelections !== undefined && field.minSelections > field.maxSelections) {
        context.addIssue({ code: "custom", message: "Minimum selections cannot exceed maximum selections", path: ["fields", ids.indexOf(field.id)] });
      }
      if (field.maxSelections !== undefined && field.maxSelections > field.options.length) {
        context.addIssue({ code: "custom", message: "Maximum selections cannot exceed the number of options", path: ["fields", ids.indexOf(field.id)] });
      }
    }
    if ("options" in field) {
      const optionIds = field.options.map((item) => item.id);
      if (new Set(optionIds).size !== optionIds.length) context.addIssue({ code: "custom", message: "Option identifiers must be unique", path: ["fields", ids.indexOf(field.id), "options"] });
    }
  }
});

export const formDefinitionWriteSchema = formDefinitionSchema.superRefine(({ fields }, context) => {
  fields.forEach((field, index) => {
    if (field.type === "checkboxes" && field.minSelections !== undefined && field.minSelections > field.options.length) {
      context.addIssue({ code: "custom", message: "Minimum selections cannot exceed the number of options", path: ["fields", index, "minSelections"] });
    }
  });
});

export const formAnswersSchema = z.record(z.string().uuid(), z.unknown()).superRefine((answers, context) => {
  if (Object.keys(answers).length > 100) context.addIssue({ code: "custom", message: "A response cannot contain more than 100 answers." });
});

export const rankingAnswerSchema = (allowedOptionIds: readonly string[]) => z.array(z.string().uuid()).length(allowedOptionIds.length).refine(
  (answer) => new Set(answer).size === answer.length && answer.every((optionId) => allowedOptionIds.includes(optionId)),
  "Ranking must contain every available option exactly once",
);

export type FormField = z.infer<typeof formFieldSchema>;
export type FormDefinition = z.infer<typeof formDefinitionSchema>;
export type SignatureAnswer = z.infer<typeof signatureAnswerSchema>;
