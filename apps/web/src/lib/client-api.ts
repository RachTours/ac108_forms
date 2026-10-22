"use client";

import { apiErrorSchema } from "@reviewroom/contracts";
import { useCallback } from "react";
import { useWorkspaceSession } from "../components/workspace-shell";

export function useApi() {
  const session = useWorkspaceSession();
  return useCallback(async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("X-Reviewroom-Audience", session.role === "REVIEWER" ? "reviewer" : "admin");
    if (init.body) headers.set("Content-Type", "application/json");
    if (init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase())) headers.set("X-CSRF-Token", session.csrfToken);
    const response = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "same-origin" });
    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(body);
      throw new Error(parsed.success ? parsed.data.error.message : "The request could not be completed.");
    }
    return body as T;
  }, [session.csrfToken, session.role]);
}
