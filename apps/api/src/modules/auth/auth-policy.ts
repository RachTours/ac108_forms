import type { Role } from "@reviewroom/contracts";

export type LoginAudience = "admin" | "reviewer";

export function canRoleSignInAs(audience: LoginAudience, role: Role): boolean {
  if (audience === "admin") return role === "OWNER" || role === "ADMIN";
  return role === "REVIEWER";
}

export async function authenticateMemberships<T extends { role: Role; passwordHash: string }>(
  memberships: readonly T[],
  password: string,
  verify: (password: string, hash: string) => Promise<boolean>,
  audience?: LoginAudience,
): Promise<T[]> {
  const allowed = audience ? memberships.filter((membership) => canRoleSignInAs(audience, membership.role)) : memberships;
  const matches: T[] = [];
  for (const membership of allowed) if (await verify(password, membership.passwordHash)) matches.push(membership);
  return matches;
}
