/** Prisma relation-count filter shared by the people list and its regression test. */
export function targetSubmissionCountFilter(organizationId: string) {
  return { organizationId, archivedAt: null };
}
