export type PublicReviewLoad<T> =
  | { kind: "ready"; data: T }
  | { kind: "unavailable" }
  | { kind: "error"; requestId?: string };

export async function loadPublicReview<T>(request: () => Promise<Response>): Promise<PublicReviewLoad<T>> {
  let response: Response;
  try {
    response = await request();
  } catch {
    return { kind: "error" };
  }
  if (response.status === 404 || response.status === 410) return { kind: "unavailable" };
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    return requestId && /^[A-Za-z0-9_.-]{1,200}$/.test(requestId)
      ? { kind: "error", requestId }
      : { kind: "error" };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "error" };
  }
  if (typeof body !== "object" || body === null || !("data" in body)) return { kind: "error" };
  return { kind: "ready", data: (body as { data: T }).data };
}
