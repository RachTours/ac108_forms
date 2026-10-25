import { Router } from "express";
import { submissionReportQuerySchema } from "@reviewroom/contracts";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/client.js";
import { HttpError } from "../../http/errors.js";
import { requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { submissionReportCsv } from "./report-export.js";

export const reportRouter = Router();
reportRouter.use(requireSession, requirePermission("submissions", "read"));

type ReportFilters = { from?: string | undefined; to?: string | undefined; formId?: string | undefined; reviewerId?: string | undefined };

function reportFilters(organizationId: string, input: ReportFilters): Prisma.Sql[] {
  const filters = [Prisma.sql`s.organizationId = ${organizationId}`, Prisma.sql`s.archivedAt IS NULL`];
  if (input.from) filters.push(Prisma.sql`s.submittedAt >= ${new Date(`${input.from}T00:00:00.000Z`)}`);
  if (input.to) {
    const endExclusive = new Date(`${input.to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    filters.push(Prisma.sql`s.submittedAt < ${endExclusive}`);
  }
  if (input.formId) filters.push(Prisma.sql`s.formId = ${input.formId}`);
  if (input.reviewerId) filters.push(Prisma.sql`s.reviewerId = ${input.reviewerId}`);
  return filters;
}

async function loadReport(organizationId: string, input: ReportFilters) {
  if (input.from && input.to && new Date(`${input.to}T00:00:00Z`).getTime() - new Date(`${input.from}T00:00:00Z`).getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, "REPORT_RANGE_TOO_WIDE", "Choose a date range of 366 days or less.");
  }
  if (input.formId && !await prisma.form.findFirst({ where: { id: input.formId, organizationId }, select: { id: true } })) throw new HttpError(404, "FORM_NOT_FOUND", "Form not found.");
  if (input.reviewerId && !await prisma.membership.findFirst({ where: { id: input.reviewerId, organizationId, role: "REVIEWER" }, select: { id: true } })) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Reviewer not found.");
  const filters = reportFilters(organizationId, input);
  const [groups, totals] = await Promise.all([
    prisma.$queryRaw<Array<{ formId: string; formTitle: string; reviewerId: string; reviewerName: string; submissionCount: bigint; completedPeople: bigint; reviewedSubmissionCount: bigint }>>(Prisma.sql`
      SELECT s.formId, f.title AS formTitle, s.reviewerId, u.displayName AS reviewerName,
        COUNT(*) AS submissionCount,
        COUNT(DISTINCT s.targetId) AS completedPeople,
        SUM(CASE WHEN s.reviewedAt IS NOT NULL THEN 1 ELSE 0 END) AS reviewedSubmissionCount
      FROM Submission s
      INNER JOIN Form f ON f.id = s.formId AND f.organizationId = s.organizationId
      INNER JOIN Membership m ON m.id = s.reviewerId AND m.organizationId = s.organizationId
      INNER JOIN User u ON u.id = m.userId
      WHERE ${Prisma.join(filters, " AND ")}
      GROUP BY s.formId, f.title, s.reviewerId, u.displayName
      ORDER BY f.title ASC, u.displayName ASC, s.formId ASC, s.reviewerId ASC
      LIMIT 1001
    `),
    prisma.$queryRaw<Array<{ submissionCount: bigint; completedPeople: bigint; reviewedSubmissionCount: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS submissionCount, COUNT(DISTINCT s.targetId) AS completedPeople,
        SUM(CASE WHEN s.reviewedAt IS NOT NULL THEN 1 ELSE 0 END) AS reviewedSubmissionCount
      FROM Submission s WHERE ${Prisma.join(filters, " AND ")}
    `),
  ]);
  if (groups.length > 1000) throw new HttpError(422, "REPORT_TOO_LARGE", "The report has more than 1,000 summary rows. Add filters and try again.");
  const rows = groups.map((row) => ({ ...row, submissionCount: Number(row.submissionCount), completedPeople: Number(row.completedPeople), reviewedSubmissionCount: Number(row.reviewedSubmissionCount) }));
  const [summary] = totals;
  return { rows, totals: { submissionCount: Number(summary?.submissionCount ?? 0n), completedPeople: Number(summary?.completedPeople ?? 0n), reviewedSubmissionCount: Number(summary?.reviewedSubmissionCount ?? 0n) } };
}

reportRouter.get("/submissions", async (request, response, next) => {
  try {
    const filters = submissionReportQuerySchema.parse(request.query);
    response.json({ data: await loadReport(request.auth!.organizationId, filters) });
  } catch (error) { next(error); }
});

reportRouter.get("/submissions.csv", async (request, response, next) => {
  try {
    const filters = submissionReportQuerySchema.parse(request.query);
    const report = await loadReport(request.auth!.organizationId, filters);
    await prisma.auditEvent.create({ data: { organizationId: request.auth!.organizationId, actorId: request.auth!.userId, action: "SUBMISSION_REPORT_EXPORTED", entityType: "SubmissionReport", metadata: { ...filters, rowCount: report.rows.length } } });
    response.type("text/csv; charset=utf-8").setHeader("Content-Disposition", 'attachment; filename="submission-report.csv"').send(submissionReportCsv(report.rows));
  } catch (error) { next(error); }
});
