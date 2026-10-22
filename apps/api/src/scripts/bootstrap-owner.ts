import { env } from "../env.js";
import { prisma } from "../db/client.js";
import { createBootstrapOwner } from "../modules/auth/auth.service.js";

const required = ["BOOTSTRAP_EMAIL", "BOOTSTRAP_NAME", "BOOTSTRAP_PASSWORD", "BOOTSTRAP_ORGANIZATION", "BOOTSTRAP_SLUG"] as const;
const values = Object.fromEntries(required.map((key) => [key, process.env[key]])) as Record<(typeof required)[number], string | undefined>;
for (const key of required) {
  if (!values[key]) throw new Error(`${key} must be set for the one-time owner bootstrap command.`);
}
if ((values.BOOTSTRAP_PASSWORD?.length ?? 0) < 14) throw new Error("BOOTSTRAP_PASSWORD must be at least 14 characters.");

try {
  const result = await createBootstrapOwner({
    email: values.BOOTSTRAP_EMAIL!,
    displayName: values.BOOTSTRAP_NAME!,
    password: values.BOOTSTRAP_PASSWORD!,
    organizationName: values.BOOTSTRAP_ORGANIZATION!,
    organizationSlug: values.BOOTSTRAP_SLUG!,
  });
  process.stdout.write(result.alreadyExisted
    ? `Bootstrap owner already exists in the configured workspace; no account or password changes were made.\n`
    : `Owner account created for ${values.BOOTSTRAP_EMAIL}. Remove bootstrap values after use.\n`);
} finally {
  await prisma.$disconnect();
}
