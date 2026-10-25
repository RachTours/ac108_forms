import type { Metadata } from "next";
import { MyReviewLink } from "../../../src/features/team/my-review-link";
import { requireWorkspaceRole } from "../../../src/lib/page-access";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations("navigation"); return { title: t("myLinks") }; }
export default async function MyLinkPage() { await requireWorkspaceRole(["REVIEWER"]); const t = await getTranslations("team"); return <div className="page-content narrow-content"><div className="page-heading"><div><p className="eyebrow">{t("myLinkEyebrow")}</p><h1>{t("myLinks")}</h1><p>{t("myLinkHelp")}</p></div></div><MyReviewLink /></div>; }
