export type WorkspaceMembership = { organization: { id: string; name: string; slug: string }; role: string };

export function chooseWorkspaceMembership<T extends WorkspaceMembership>(memberships: T[], slug?: string) {
  if (slug) return memberships.find((membership) => membership.organization.slug === slug)
    ? { kind: "selected" as const, membership: memberships.find((membership) => membership.organization.slug === slug)! }
    : { kind: "missing" as const };
  if (memberships.length === 1) return { kind: "selected" as const, membership: memberships[0]! };
  if (memberships.length > 1) return { kind: "choose" as const, memberships };
  return { kind: "missing" as const };
}
