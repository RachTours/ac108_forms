import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { serverApi } from "../../../src/lib/api";
import { requireWorkspaceRole } from "../../../src/lib/page-access";
import { FormListManager, type FormListRow } from "../../../src/features/forms/form-list-manager";

export const metadata: Metadata = { title: "Forms" };

export default async function FormsPage() {
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  let active: FormListRow[] = [];
  let archived: FormListRow[] = [];
  let unavailable = false;
  try {
    const [activeResponse, archivedResponse] = await Promise.all([serverApi("/forms?state=active"), serverApi("/forms?state=archived")]);
    if (!activeResponse.ok || !archivedResponse.ok) throw new Error();
    const activeResult: { data: FormListRow[] } = await activeResponse.json();
    const archivedResult: { data: FormListRow[] } = await archivedResponse.json();
    active = activeResult.data; archived = archivedResult.data;
  } catch { unavailable = true; }
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">FORM STUDIO</p><h1>Your forms</h1><p>Build, version, and publish the questions your reviewers use.</p></div><Link className="button button-primary" href="/admin/forms/new"><Plus size={14} /> New form</Link></div>
    {unavailable ? <div className="panel empty-state"><h2>Forms could not load</h2><p>Check your connection and try again.</p></div> : <FormListManager initialActive={active} initialArchived={archived} />}
  </div>;
}
