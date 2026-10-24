import { hashPassword } from "./password.js";
import { prisma } from "../../db/client.js";

export async function createBootstrapOwner(input: { email: string; displayName: string; password: string; organizationName: string; organizationSlug: string }) {
  return prisma.$transaction(async (transaction) => {
    const email = input.email.trim().toLowerCase();
    const slug = input.organizationSlug.trim().toLowerCase();
    const existing = await transaction.user.findUnique({
      where: { email },
      include: { memberships: { where: { role: "OWNER", organization: { slug } }, select: { id: true, organizationId: true } } },
    });
    if (existing) {
      const existingOwner = existing.memberships[0];
      if (existingOwner) return { organizationId: existingOwner.organizationId, membershipId: existingOwner.id, alreadyExisted: true };
      throw new Error("This email already has an account but is not an owner of the configured bootstrap workspace.");
    }
    const passwordHash = await hashPassword(input.password);
    const organization = await transaction.organization.create({ data: { name: input.organizationName.trim(), slug } });
    const user = await transaction.user.create({ data: { email, displayName: input.displayName.trim() } });
    const membership = await transaction.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "OWNER", passwordHash } });
    await transaction.progressConfig.create({ data: { organizationId: organization.id, targetCount: 50 } });
    await transaction.auditEvent.create({ data: { organizationId: organization.id, actorId: user.id, action: "OWNER_BOOTSTRAPPED", entityType: "Organization", entityId: organization.id } });
    return { organizationId: organization.id, membershipId: membership.id, alreadyExisted: false };
  });
}
