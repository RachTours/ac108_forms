"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { useWorkspaceSession } from "../components/workspace-shell";
import { ApiClientError, requestApi, type RuntimeSchema } from "./api-client";
import { localizeApiError } from "./api-error-locale";
import type { Locale } from "./locale";

export function useApi() {
  const session = useWorkspaceSession();
  const locale = useLocale() as Locale;
  return useCallback(async function api<T>(path: string, init: RequestInit = {}, schema?: RuntimeSchema<T>): Promise<T> {
    try {
      return await requestApi<T>(path, init, { role: session.role, csrfToken: session.csrfToken, sessionId: session.sessionId, ...(schema ? { schema } : {}) });
    } catch (cause) {
      if (!(cause instanceof ApiClientError)) throw cause;
      throw new ApiClientError({ status: cause.status, code: cause.code, message: localizeApiError(cause.code, locale), ...(cause.requestId ? { requestId: cause.requestId } : {}) });
    }
  }, [locale, session.csrfToken, session.role, session.sessionId]);
}
