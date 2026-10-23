import type { Metadata } from "next";
import { serverApi } from "../../../src/lib/api";
import { PeopleManager } from "../../../src/features/people/people-manager";
import { requireWorkspaceRole } from "../../../src/lib/page-access";

export const metadata: Metadata = { title: "People" };

type Person = { id: string; displayName: string; email: string | null; submissionCount: number };
export default async function PeoplePage() {
  await requireWorkspaceRole(["OWNER", "ADMIN"]);
  let people: Person[] = [];
  let nextCursor: string | null = null;
  let failed = false;
  try {
    const response = await serverApi("/review-targets?limit=100");
    if (!response.ok) throw new Error("People could not load.");
    const body: { data: Person[]; nextCursor: string | null } = await response.json();
    people = body.data;
    nextCursor = body.nextCursor;
  } catch { failed = true; }
  return <div className="page-content people-page"><div className="page-heading"><div><p className="eyebrow">PEOPLE</p><h1>People</h1><p>Add people, update their details, and review their submission history.</p></div><div className="count-chip">{people.length}{nextCursor ? "+" : ""} people loaded</div></div>{failed ? <div className="panel empty-state"><h2>People could not load</h2><p>Check the API and try again.</p></div> : <PeopleManager initialTargets={people} initialCursor={nextCursor} canManage />}</div>;
}
