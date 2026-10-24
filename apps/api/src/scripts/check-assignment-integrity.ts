import { prisma } from "../db/client.js";

type InvalidAssignment = { assignmentId: string; organizationId: string; targetOrganizationId: string | null; reviewerOrganizationId: string | null };

try {
  const tables = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT TABLE_NAME AS tableName
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Assignment'
  `;
  if (!tables.length) {
    process.stdout.write("Assignment integrity preflight: no existing Assignment table; clean install is safe.\n");
    process.exitCode = 0;
  } else {
    const invalid = await prisma.$queryRaw<InvalidAssignment[]>`
      SELECT a.id AS assignmentId,
             a.organizationId AS organizationId,
             t.organizationId AS targetOrganizationId,
             m.organizationId AS reviewerOrganizationId
      FROM Assignment a
      LEFT JOIN ReviewTarget t ON t.id = a.targetId
      LEFT JOIN Membership m ON m.id = a.reviewerId
      WHERE t.id IS NULL OR m.id IS NULL
         OR t.organizationId <> a.organizationId
         OR m.organizationId <> a.organizationId
      ORDER BY a.id
      LIMIT 101
    `;
    if (invalid.length) {
      process.stderr.write(`Assignment integrity preflight found ${invalid.length > 100 ? "more than 100" : invalid.length} orphaned or cross-workspace rows. No rows were changed.\n`);
      for (const row of invalid.slice(0, 100)) {
        process.stderr.write(`${row.assignmentId} organization=${row.organizationId} targetOrganization=${row.targetOrganizationId ?? "missing"} reviewerOrganization=${row.reviewerOrganizationId ?? "missing"}\n`);
      }
      process.stderr.write("Review these IDs and repair deliberately before running the assignment integrity migration.\n");
      process.exitCode = 1;
    } else {
      process.stdout.write("Assignment integrity preflight passed; no orphaned or cross-workspace rows found.\n");
      process.exitCode = 0;
    }
  }
} catch (error) {
  process.stderr.write(`Assignment integrity preflight failed safely: ${error instanceof Error ? error.message : "database query failed"}\n`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
