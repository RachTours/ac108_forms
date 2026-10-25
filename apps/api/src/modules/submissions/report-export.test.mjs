import assert from "node:assert/strict";
import test from "node:test";
import { submissionReportCsv } from "../../../dist/modules/submissions/report-export.js";

test("exports only summary columns, quotes CSV cells, and neutralizes formulas", () => {
  const csv = submissionReportCsv([{ formId: "id", formTitle: "=1+1, \"Q\"", reviewerId: "id2", reviewerName: "@HYPERLINK(\"x\")", submissionCount: 3, completedPeople: 2, reviewedSubmissionCount: 1 }]);
  assert.equal(csv, '"Form","Reviewer","Submissions","People completed","Reviewed submissions"\r\n"\'=1+1, ""Q""","\'@HYPERLINK(""x"")","3","2","1"');
  assert.doesNotMatch(csv, /answers|payload|definition/i);
});
