import type { Metadata } from "next";
import { publicApi } from "../../../src/lib/api";
import { ReviewPortal } from "../../../src/features/review/review-portal";
import { loadPublicReview } from "../../../src/features/review/public-review-load";
import type { FormDefinition } from "@reviewroom/contracts/forms";
type PortalData = { reviewerName: string; targets: { id: string; displayName: string }[]; forms: { id: string; title: string; description: string; versionId: string; definition: FormDefinition }[] };
export const metadata: Metadata = { title: { absolute: "Review form | Reviewer Panel" }, robots: { index: false, follow: false } };
export default async function PublicReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadPublicReview<PortalData>(() => publicApi(`/public/review/${encodeURIComponent(token)}`));
  if (result.kind === "unavailable") return <main className="public-page"><div className="public-top"><a href="/reviewer/login" className="brand"><span className="brand-mark">R</span><span>Reviewer Panel</span></a><span className="secure-label">Private review link</span></div><div className="public-wrap"><section className="public-card unavailable-card"><p className="eyebrow">REVIEW LINK</p><h1>This link is no longer available.</h1><p>It may have expired or been revoked. Ask your reviewer to share a current link.</p></section></div></main>;
  if (result.kind === "error") return <main className="public-page"><div className="public-top"><a href="/reviewer/login" className="brand"><span className="brand-mark">R</span><span>Reviewer Panel</span></a><span className="secure-label">Private review link</span></div><div className="public-wrap"><section className="public-card unavailable-card"><p className="eyebrow">TEMPORARY ISSUE</p><h1>We couldn’t load this review.</h1><p>Please try again. If it keeps happening, contact your workspace administrator.</p>{result.requestId ? <p className="form-hint">Reference: {result.requestId}</p> : null}<a className="button button-primary" href={`/r/${encodeURIComponent(token)}`}>Try again</a></section></div></main>;
  return <ReviewPortal token={token} data={result.data} />;
}
