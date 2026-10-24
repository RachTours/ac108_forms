import type { Metadata } from "next";
import { requireWorkspaceRole } from "../../../../src/lib/page-access";

export const metadata: Metadata = { title: "Create a form" };

export default async function NewFormLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  return children;
}
