type UpdatedMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "REVIEWER";
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
};

export function toMemberUpdateSummary(membership: UpdatedMembership) {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt,
  };
}
