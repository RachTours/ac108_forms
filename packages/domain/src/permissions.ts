export type Role = "OWNER" | "ADMIN" | "REVIEWER";
export type Resource = "workspace" | "members" | "targets" | "assignments" | "forms" | "submissions" | "settings" | "audit" | "reviewWork" | "publicReview";
export type Action = "read" | "create" | "update" | "archive" | "manage" | "publish" | "readOwn" | "submit" | "grantAdmin";

export type AuthorizationInput = {
  role: Role;
  organizationId: string;
  requestedOrganizationId: string;
  membershipId?: string;
  membershipStatus: "ACTIVE" | "ARCHIVED";
  resource: Resource;
  action: Action;
  resourceMembershipId?: string;
};

export type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: "MEMBERSHIP_INACTIVE" | "TENANT_MISMATCH" | "RESOURCE_SCOPE_MISMATCH" | "ROLE_FORBIDDEN" };

const grants: Partial<Record<Resource, Partial<Record<Action, readonly Role[]>>>> = {
  workspace: { read: ["OWNER", "ADMIN"], manage: ["OWNER", "ADMIN"] },
  members: { read: ["OWNER", "ADMIN"], create: ["OWNER", "ADMIN"], update: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"], grantAdmin: ["OWNER"] },
  targets: { read: ["OWNER", "ADMIN"], create: ["OWNER", "ADMIN"], update: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"] },
  assignments: { read: ["OWNER", "ADMIN"], manage: ["OWNER", "ADMIN"] },
  forms: { read: ["OWNER", "ADMIN"], create: ["OWNER", "ADMIN"], update: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"], publish: ["OWNER", "ADMIN"] },
  submissions: { read: ["OWNER", "ADMIN"], update: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"] },
  settings: { read: ["OWNER", "ADMIN"], manage: ["OWNER", "ADMIN"] },
  audit: { read: ["OWNER", "ADMIN"] },
  reviewWork: { readOwn: ["REVIEWER"], submit: ["REVIEWER"] },
};

export function authorize(input: AuthorizationInput): AuthorizationResult {
  if (input.membershipStatus !== "ACTIVE") return { allowed: false, reason: "MEMBERSHIP_INACTIVE" };
  if (!input.organizationId || input.organizationId !== input.requestedOrganizationId) return { allowed: false, reason: "TENANT_MISMATCH" };
  if (input.resource === "reviewWork" && (!input.membershipId || input.membershipId !== input.resourceMembershipId)) {
    return { allowed: false, reason: "RESOURCE_SCOPE_MISMATCH" };
  }
  const roles = grants[input.resource]?.[input.action];
  if (!roles?.includes(input.role)) return { allowed: false, reason: "ROLE_FORBIDDEN" };
  return { allowed: true };
}
