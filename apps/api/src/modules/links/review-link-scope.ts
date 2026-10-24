export function activeReviewerKey(reviewerId: string, formId: string | null): string {
  return formId ? `${reviewerId}:${formId}` : reviewerId;
}

export function allowsForm(linkFormId: string | null, requestedFormId: string): boolean {
  return linkFormId === null || linkFormId === requestedFormId;
}

export function calculateLinkExpiry(expiresInDays: number, now = new Date()): Date {
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) throw new RangeError("Link expiry must be between 1 and 365 days.");
  return new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
}
