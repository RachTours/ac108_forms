import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { serverApi } from "../../../../src/lib/api";
import { SubmissionDetail } from "../../../../src/features/submissions/submission-detail";
import { requireWorkspaceRole } from "../../../../src/lib/page-access";
import { workspacePathForRole } from "../../../../src/lib/workspace-access";
type Detail = { id: string; submittedAt: string; archivedAt: string | null; reviewedAt: string | null; answers: unknown; target: { displayName: string }; form: { title: string }; reviewer: { user: { displayName: string } }; formVersion: { version: number; definition: unknown } };
export const metadata: Metadata = { title: "Submission details" };
export default async function SubmissionPage({ params, searchParams }: { params: Promise<{ submissionId: string }>; searchParams: Promise<{ archived?: string }> }) {
  const session = await requireWorkspaceRole(["OWNER", "ADMIN", "REVIEWER"]);
  const [{ submissionId }, query] = await Promise.all([params, searchParams]);
  const archivedView = query.archived === "true";
  const response = await serverApi(`/submissions/${submissionId}${archivedView ? "?archived=true" : ""}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Submission details could not be loaded.");
  const body: { data: Detail } = await response.json();
  return <div className="page-content narrow-content"><Link className="back-link" href={workspacePathForRole("/submissions", session.role)}><ArrowLeft size={14} /> Back to submissions</Link><SubmissionDetail data={body.data} /></div>;
}
