import type { Metadata } from "next";
import { publicApi } from "../../../src/lib/api";
import { ReviewPortal } from "../../../src/features/review/review-portal";
import { loadPublicReview } from "../../../src/features/review/public-review-load";
import type { FormDefinition } from "@reviewroom/contracts/forms";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "../../../src/components/language-switcher";
type PortalData = { reviewerName: string; targets: { id: string; displayName: string }[]; forms: { id: string; title: string; description: string; versionId: string; definition: FormDefinition }[] };
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: { absolute: t("publicReview") }, robots: { index: false, follow: false } };
}
export default async function PublicReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("publicReview");
  const tNavigation = await getTranslations("navigation");
  const result = await loadPublicReview<PortalData>(() => publicApi(`/public/review/${encodeURIComponent(token)}`));
  if (result.kind === "unavailable") return <main className="public-page"><div className="public-top"><a href="/reviewer/login" className="brand"><span className="brand-mark">R</span><span>{tNavigation("reviewerPanel")}</span></a><span className="secure-label">{t("privateLink")}</span><LanguageSwitcher /></div><div className="public-wrap"><section className="public-card unavailable-card"><p className="eyebrow">{t("unavailable")}</p><h1>{t("unavailable")}</h1><p>{t("unavailableHelp")}</p></section></div></main>;
  if (result.kind === "error") return <main className="public-page"><div className="public-top"><a href="/reviewer/login" className="brand"><span className="brand-mark">R</span><span>{tNavigation("reviewerPanel")}</span></a><span className="secure-label">{t("privateLink")}</span><LanguageSwitcher /></div><div className="public-wrap"><section className="public-card unavailable-card"><p className="eyebrow">{t("temporaryIssue")}</p><h1>{t("loadFailed")}</h1><p>{t("unavailableHelp")}</p>{result.requestId ? <p className="form-hint">{t("requestReference")}: {result.requestId}</p> : null}<a className="button button-primary" href={`/r/${encodeURIComponent(token)}`}>{t("tryAgain")}</a></section></div></main>;
  return <ReviewPortal token={token} data={result.data} />;
}
