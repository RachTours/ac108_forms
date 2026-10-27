"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useApi } from "../../lib/client-api";
import { SubmissionDetail } from "../submissions/submission-detail";

type Detail = ComponentProps<typeof SubmissionDetail>["data"];
export function GroupSubmissionDetail({ submissionId, onBack }: { submissionId: string; onBack: () => void }) {
  const api = useApi(), t = useTranslations("groups");
  const back = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<{ id: string; data?: Detail; error?: string } | null>(null);
  const current = result?.id === submissionId ? result : null;
  useEffect(() => {
    let live = true;
    back.current?.closest(".group-dialog")?.scrollTo({ top: 0 });
    back.current?.focus({ preventScroll: true });
    void api<{ data: Detail }>(`/submissions/${encodeURIComponent(submissionId)}`)
      .then((response) => { if (live) setResult({ id: submissionId, data: response.data }); })
      .catch((caught: unknown) => { if (live) setResult({ id: submissionId, error: caught instanceof Error ? caught.message : t("loadFailed") }); });
    return () => { live = false; };
  }, [api, submissionId, t]);
  return <div className="group-review-detail" aria-busy={!current}>
    <button ref={back} className="button group-review-back" type="button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />{t("backToGroupReviews")}</button>
    {!current ? <p role="status">{t("loadingReview")}</p> : current.error ? <p className="form-error" role="alert">{current.error}</p> : current.data ? <SubmissionDetail key={submissionId} data={current.data} /> : null}
  </div>;
}
