import type { Prisma } from "../../generated/prisma/client.js";

type FormSubmissionCountReader = Pick<Prisma.TransactionClient, "submission">;

/** Count submissions for this bounded form page with one tenant-scoped GROUP BY. */
export async function loadFormSubmissionCounts(
  reader: FormSubmissionCountReader,
  organizationId: string,
  formIds: string[],
): Promise<Map<string, number>> {
  if (!formIds.length) return new Map();
  const groups = await reader.submission.groupBy({
    by: ["formId"],
    where: { organizationId, formId: { in: formIds } },
    _count: { _all: true },
  });
  const counts = new Map(formIds.map((id) => [id, 0]));
  for (const group of groups) counts.set(group.formId, group._count._all);
  return counts;
}
