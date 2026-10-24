import type { Metadata } from "next";
import { routeWorkspaceEntry } from "../../src/lib/workspace-entry";

export const metadata: Metadata = { title: "Workspace" };
export default async function ReviewerEntryPage() { await routeWorkspaceEntry("reviewer"); }
