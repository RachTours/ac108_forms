import { HttpError } from "../../http/errors.js";

export type SubmissionLifecycleTransaction = {
  findSubmission(input: { organizationId: string; submissionId: string; state: "active" | "archived" | "any" }): Promise<{ id: string } | null>;
  updateArchivedAt(submissionId: string, archivedAt: Date | null): Promise<void>;
  deleteSubmission(submissionId: string): Promise<void>;
  writeAudit(input: { organizationId: string; actorId: string; action: string; entityId: string }): Promise<void>;
};

export async function setSubmissionArchived(
  transaction: SubmissionLifecycleTransaction,
  input: { organizationId: string; actorId: string; submissionId: string; archived: boolean },
): Promise<void> {
  const current = await transaction.findSubmission({
    organizationId: input.organizationId,
    submissionId: input.submissionId,
    state: input.archived ? "active" : "archived",
  });
  if (!current) throw new HttpError(404, "SUBMISSION_NOT_FOUND", "Submission not found in the requested state.");

  await transaction.updateArchivedAt(current.id, input.archived ? new Date() : null);
  await transaction.writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.archived ? "SUBMISSION_ARCHIVED" : "SUBMISSION_RESTORED",
    entityId: current.id,
  });
}

export async function permanentlyDeleteSubmission(
  transaction: SubmissionLifecycleTransaction,
  input: { organizationId: string; actorId: string; submissionId: string },
): Promise<void> {
  const current = await transaction.findSubmission({
    organizationId: input.organizationId,
    submissionId: input.submissionId,
    state: "any",
  });
  if (!current) throw new HttpError(404, "SUBMISSION_NOT_FOUND", "Submission not found.");

  await transaction.deleteSubmission(current.id);
  await transaction.writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "SUBMISSION_PERMANENTLY_DELETED",
    entityId: current.id,
  });
}
