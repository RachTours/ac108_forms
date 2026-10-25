import type { FormField } from "@reviewroom/contracts/forms";
import type { SignatureAnswer } from "@reviewroom/contracts/forms";

export function shouldShowReviewTargetSelector(targetCount: number): boolean {
  return targetCount > 1;
}

export function signatureAnswerIsComplete(answer: SignatureAnswer | undefined): boolean {
  return answer?.mode === "drawn" && answer.strokes.some((stroke) => stroke.points.length >= 2);
}

export function buildInitialAnswers(fields: FormField[]): Record<string, string[]> {
  return Object.fromEntries(fields
    .filter((field): field is Extract<FormField, { type: "ranking" }> => field.type === "ranking")
    .map((field) => [field.id, field.options.map((option) => option.id)]));
}
