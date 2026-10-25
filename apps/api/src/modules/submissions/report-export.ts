export type SubmissionReportRow = {
  formId: string;
  formTitle: string;
  reviewerId: string;
  reviewerName: string;
  submissionCount: number;
  completedPeople: number;
  reviewedSubmissionCount: number;
};

function csvCell(value: string | number): string {
  const text = String(value);
  const formulaProbe = text.replace(/^[\t\r\n ]+/, "");
  const safe = /^[=+\-@]/.test(formulaProbe) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function submissionReportCsv(rows: SubmissionReportRow[]): string {
  const header = ["Form", "Reviewer", "Submissions", "People completed", "Reviewed submissions"];
  const body = rows.map((row) => [row.formTitle, row.reviewerName, row.submissionCount, row.completedPeople, row.reviewedSubmissionCount]);
  return [header, ...body].map((record) => record.map(csvCell).join(",")).join("\r\n");
}
