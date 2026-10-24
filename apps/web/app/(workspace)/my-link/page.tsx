import type { Metadata } from "next";
import { MyReviewLink } from "../../../src/features/team/my-review-link";
import { requireWorkspaceRole } from "../../../src/lib/page-access";

export const metadata: Metadata = { title: "My form links" };
export default async function MyLinkPage() { await requireWorkspaceRole(["REVIEWER"]); return <div className="page-content narrow-content"><div className="page-heading"><div><p className="eyebrow">YOUR REVIEW ACCESS</p><h1>My form links</h1><p>Create a separate share link for each form published by your admin.</p></div></div><MyReviewLink /></div>; }
