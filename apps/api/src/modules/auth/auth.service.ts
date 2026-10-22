import { hashPassword } from "./password.js";
import { prisma } from "../../db/client.js";

export async function createBootstrapOwner(input: { email: string; displayName: string; password: string; organizationName: string; organizationSlug: string }) {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (transaction) => {
    const email = input.email.trim().toLowerCase();
    const existing = await transaction.user.findUnique({ where: { email } });
    if (existing) throw new Error("This email already has an account.");
    const organization = await transaction.organization.create({ data: { name: input.organizationName.trim(), slug: input.organizationSlug.trim().toLowerCase() } });
    const user = await transaction.user.create({ data: { email, displayName: input.displayName.trim() } });
    const membership = await transaction.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "OWNER", passwordHash } });
    await transaction.progressConfig.create({ data: { organizationId: organization.id, targetCount: 50 } });
    await transaction.auditEvent.create({ data: { organizationId: organization.id, actorId: user.id, action: "OWNER_BOOTSTRAPPED", entityType: "Organization", entityId: organization.id } });
    return { organizationId: organization.id, membershipId: membership.id };
  });
}
