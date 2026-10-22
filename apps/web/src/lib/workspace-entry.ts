import { redirect } from "next/navigation";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { serverApi } from "./api";
import { homePathForRole, signInPathForRole, type Audience } from "./workspace-access";

export async function routeWorkspaceEntry(audience: Audience): Promise<never> {
  let response: Response;
  try { response = await serverApi("/auth/session"); }
  catch { redirect(`${signInPathForRole(audience)}?reason=service-unavailable`); }
  if (!response.ok) redirect(signInPathForRole(audience));
  const session = sessionResponseSchema.safeParse(await response.json());
  if (!session.success) redirect(`${signInPathForRole(audience)}?reason=session-invalid`);
  redirect(homePathForRole(session.data.role));
}
