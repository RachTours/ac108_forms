import { cookies } from "next/headers";
import { resolveServerApiOrigin } from "./server-api-origin";

const apiOrigin = resolveServerApiOrigin(process.env.API_INTERNAL_URL, process.env.NODE_ENV);

export async function serverApi(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieStore = await cookies();
  const headers = new Headers(init.headers);
  headers.set("cookie", cookieStore.toString());
  return fetch(`${apiOrigin}/api/v1${path}`, { ...init, headers, cache: "no-store" });
}

export async function publicApi(path: string): Promise<Response> {
  return fetch(`${apiOrigin}/api/v1${path}`, { cache: "no-store" });
}

export async function readData<T>(response: Response, parse: (value: unknown) => T): Promise<T> {
  if (!response.ok) throw new Error(`The service returned ${response.status}.`);
  const body: unknown = await response.json();
  return parse(body);
}
