import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "../../../../src/lib/api";
import { FormEditor } from "../../../../src/features/forms/form-editor";
import { requireWorkspaceRole } from "../../../../src/lib/page-access";

type FormRecord = { id: string; title: string; description: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; draftDefinition: unknown; currentPublishedId: string | null };
export const metadata: Metadata = { title: "Form editor" };
export default async function FormEditorPage({ params }: { params: Promise<{ formId: string }> }) {
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  const { formId } = await params;
  if (formId === "new") redirect("/admin/forms/new");
  let result: { data: FormRecord };
  try { const response = await serverApi(`/forms/${formId}`); if (response.status === 404) notFound(); if (!response.ok) throw new Error(); result = await response.json(); } catch { notFound(); }
  return <FormEditor initial={result.data} />;
}
