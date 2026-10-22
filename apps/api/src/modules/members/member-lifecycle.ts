import { HttpError } from "../../http/errors.js";

export function assertMemberCanBePermanentlyDeleted(input: { role: string; status: string; submissionCount: number }) {
  if (input.role === "OWNER") throw new HttpError(409, "OWNER_PROTECTED", "Transfer ownership before permanently deleting the owner account.");
  if (input.status !== "ARCHIVED") throw new HttpError(409, "MEMBER_MUST_BE_REMOVED", "Remove this member from the workspace before permanently deleting access.");
  if (input.submissionCount > 0) throw new HttpError(409, "MEMBER_HAS_SUBMISSIONS", "Permanently delete or remove this member’s submitted reviews before deleting their membership record.");
}
