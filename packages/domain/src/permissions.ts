export type Role = "OWNER" | "ADMIN" | "REVIEWER";
export type PermissionActor = Role | "PUBLIC";
export type Resource = "workspace" | "members" | "targets" | "assignments" | "reviewLinks" | "forms" | "submissions" | "settings" | "audit" | "reviewWork" | "publicReview";
export type Action = "read" | "create" | "update" | "archive" | "manage" | "publish" | "readOwn" | "manageOwn" | "submit" | "grantAdmin" | "permanentDelete";

type AuthorizationScope = {
  organizationId: string;
  requestedOrganizationId: string;
  resource: Resource;
  action: Action;
};

type MemberAuthorizationInput = AuthorizationScope & {
  role: Role;
  membershipId?: string;
  membershipStatus: "ACTIVE" | "ARCHIVED";
  resourceMembershipId?: string;
};

type PublicAuthorizationInput = AuthorizationScope & {
  role: "PUBLIC";
  publicCredentialStatus: "ACTIVE" | "INACTIVE";
};

export type AuthorizationInput = MemberAuthorizationInput | PublicAuthorizationInput;

export type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: "MEMBERSHIP_INACTIVE" | "PUBLIC_CREDENTIAL_INACTIVE" | "TENANT_MISMATCH" | "RESOURCE_SCOPE_MISMATCH" | "ROLE_FORBIDDEN" };

const grants: Partial<Record<Resource, Partial<Record<Action, readonly PermissionActor[]>>>> = {
  workspace: { read: ["OWNER", "ADMIN"], manage: ["OWNER", "ADMIN"] },
  members: { read: ["OWNER", "ADMIN"], create: ["OWNER", "ADMIN"], update: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"], grantAdmin: ["OWNER"], permanentDelete: ["OWNER"] },
  targets: { read: ["OWNER", "ADMIN"], create: ["OWNER", "ADMIN"], update: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"] },
  assignments: { read: ["OWNER", "ADMIN"], manage: ["OWNER", "ADMIN"] },
  reviewLinks: { read: ["OWNER", "ADMIN"], create: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"], readOwn: ["REVIEWER"], manageOwn: ["REVIEWER"] },
  forms: { read: ["OWNER", "ADMIN"], create: ["OWNER", "ADMIN"], update: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"], publish: ["OWNER", "ADMIN"] },
  submissions: { read: ["OWNER", "ADMIN"], update: ["OWNER", "ADMIN"], archive: ["OWNER", "ADMIN"] },
  settings: { read: ["OWNER", "ADMIN"], manage: ["OWNER", "ADMIN"] },
  audit: { read: ["OWNER", "ADMIN"] },
  reviewWork: { readOwn: ["REVIEWER"], submit: ["REVIEWER"] },
  publicReview: { read: ["PUBLIC"], submit: ["PUBLIC"] },
};

export function authorize(input: AuthorizationInput): AuthorizationResult {
  if (input.role === "PUBLIC") {
    if (input.publicCredentialStatus !== "ACTIVE") return { allowed: false, reason: "PUBLIC_CREDENTIAL_INACTIVE" };
  } else if (input.membershipStatus !== "ACTIVE") return { allowed: false, reason: "MEMBERSHIP_INACTIVE" };
  if (!input.organizationId || input.organizationId !== input.requestedOrganizationId) return { allowed: false, reason: "TENANT_MISMATCH" };
  const ownResourceAction = input.role !== "PUBLIC" && (input.resource === "reviewWork"
    || (input.resource === "reviewLinks" && (input.action === "readOwn" || input.action === "manageOwn")));
  if (ownResourceAction && (!input.membershipId || input.membershipId !== input.resourceMembershipId)) {
    return { allowed: false, reason: "RESOURCE_SCOPE_MISMATCH" };
  }
  const roles = grants[input.resource]?.[input.action];
  if (!roles?.includes(input.role)) return { allowed: false, reason: "ROLE_FORBIDDEN" };
  return { allowed: true };
}
