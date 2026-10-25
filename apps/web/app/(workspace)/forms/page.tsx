import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { serverApi } from "../../../src/lib/api";
import { requireWorkspaceRole } from "../../../src/lib/page-access";
import { FormListManager, type FormListRow } from "../../../src/features/forms/form-list-manager";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations("metadata"); return { title: t("forms") }; }

export default async function FormsPage() {
  const t = await getTranslations("forms");
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
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">{t("studio")}</p><h1>{t("yourForms")}</h1><p>{t("listDescription")}</p></div><Link className="button button-primary" href="/admin/forms/new"><Plus size={14} /> {t("newForm")}</Link></div>
    {unavailable ? <div className="panel empty-state"><h2>{t("loadFailed")}</h2><p>{t("loadFailedHelp")}</p></div> : <FormListManager initialActive={active} initialArchived={archived} />}
  </div>;
}
