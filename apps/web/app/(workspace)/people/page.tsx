import type { Metadata } from "next";
import Link from "next/link";
import { paginatedResponseSchema, targetSummarySchema } from "@reviewroom/contracts";
import { serverApi } from "../../../src/lib/api";
import { PeopleManager } from "../../../src/features/people/people-manager";
import { requireWorkspaceRole } from "../../../src/lib/page-access";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> { const t = await getTranslations("metadata"); return { title: t("people") }; }

const peopleResponseSchema = paginatedResponseSchema(targetSummarySchema);
type Person = { id: string; displayName: string; email: string | null; submissionCount: number; createdAt?: string; updatedAt?: string; assignedReviewer?: { membershipId: string; displayName: string; email: string } | null | undefined };
type LoadFailure = { status?: number; requestId?: string; unreachable?: boolean };
export default async function PeoplePage() {
  const [t, ui] = await Promise.all([getTranslations("people"), getTranslations("workspaceUi")]);
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  let people: Person[] = [];
  let nextCursor: string | null = null;
  let failure: LoadFailure | null = null;
  try {
    const response = await serverApi("/review-targets?limit=100");
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { requestId?: unknown } } | null;
      failure = { status: response.status, ...(typeof body?.error?.requestId === "string" ? { requestId: body.error.requestId } : {}) };
    } else {
      const body = peopleResponseSchema.safeParse(await response.json());
      if (!body.success) failure = { status: 502 };
      else {
        people = body.data.data;
        nextCursor = body.data.nextCursor;
      }
    }
  } catch { failure = { unreachable: true }; }
  return <div className="page-content people-page"><div className="page-heading"><div><p className="eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p>{t("description")}</p></div><div className="count-chip">{nextCursor ? ui("loadedMorePeople", { count: people.length }) : ui("loadedPeople", { count: people.length })}</div></div>{failure ? <div className="panel empty-state"><h2>{t("loadFailed")}</h2><p>{failure.unreachable ? ui("serverApiFailure") : ui("httpFailure", { status: failure.status ?? 502 })}{failure.requestId ? ` Reference: ${failure.requestId}` : ""}</p><p>{ui("apiRetry")}</p><Link className="button button-small" href="/admin/people">{t("retry")}</Link></div> : <PeopleManager initialTargets={people} initialCursor={nextCursor} canManage />}</div>;
}
