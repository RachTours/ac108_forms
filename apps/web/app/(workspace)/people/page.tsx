import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "../../../src/lib/api";
import { PeopleManager } from "../../../src/features/people/people-manager";
import { requireWorkspaceRole } from "../../../src/lib/page-access";

export const metadata: Metadata = { title: "People" };

type Person = { id: string; displayName: string; email: string | null; submissionCount: number };
type LoadFailure = { status?: number; requestId?: string; unreachable?: boolean };
export default async function PeoplePage() {
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
      const body: { data: Person[]; nextCursor: string | null } = await response.json();
      people = body.data;
      nextCursor = body.nextCursor;
    }
  } catch { failure = { unreachable: true }; }
  return <div className="page-content people-page"><div className="page-heading"><div><p className="eyebrow">PEOPLE</p><h1>People</h1><p>Add people, update their details, and review their submission history.</p></div><div className="count-chip">{people.length}{nextCursor ? "+" : ""} people loaded</div></div>{failure ? <div className="panel empty-state"><h2>People could not load</h2><p>{failure.unreachable ? "The server could not reach the API." : `The API returned HTTP ${failure.status}.`}{failure.requestId ? ` Reference: ${failure.requestId}` : ""}</p><p>Check the API connection and try again.</p><Link className="button button-small" href="/admin/people">Retry</Link></div> : <PeopleManager initialTargets={people} initialCursor={nextCursor} canManage />}</div>;
}
