type MemberSummaryRecord = {
  id: string;
  organizationId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "REVIEWER";
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  user: { id: string; email: string; displayName: string; status: "ACTIVE" | "ARCHIVED" };
  _count: { assignments: number; reviewLinks: number };
  reviewerGroup?: { id: string; name: string } | null;
  submissionGoalOverride?: number | null;
  formAssignmentsConfigured?: boolean;
  formAssignments?: Array<{ formId: string }>;
};

export function toMemberSummary(member: MemberSummaryRecord) {
  return {
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
    role: member.role,
    status: member.status,
    createdAt: member.createdAt.toISOString(),
    user: {
      id: member.user.id,
      email: member.user.email,
      displayName: member.user.displayName,
      status: member.user.status,
    },
    assignedTargetCount: member._count.assignments,
    linkCount: member._count.reviewLinks,
    group: member.reviewerGroup ?? null,
    submissionGoalOverride: member.submissionGoalOverride ?? null,
    formAssignmentsConfigured: member.formAssignmentsConfigured ?? false,
    assignedFormIds: (member.formAssignments ?? []).map((assignment) => assignment.formId),
  };
}
