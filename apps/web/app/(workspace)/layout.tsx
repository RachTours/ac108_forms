import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { serverApi } from "../../src/lib/api";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { defaultWorkspaceTheme, safeWorkspaceTheme } from "../../src/lib/workspace-theme";
import { roleMatchesAudience, workspaceLoginPath } from "../../src/lib/workspace-access";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const incomingHeaders = await headers();
  const audience = incomingHeaders.get("x-reviewroom-audience") === "reviewer" ? "reviewer" : "admin";
  const requestPath = incomingHeaders.get("x-reviewroom-request-path");
  const signInPath = workspaceLoginPath(audience, requestPath);
  let response: Response;
  try { response = await serverApi("/auth/session"); }
  catch { redirect(workspaceLoginPath(audience, requestPath, "service-unavailable")); }
  if (!response.ok) redirect(signInPath);
  const parsed = sessionResponseSchema.safeParse(await response.json());
  if (!parsed.success) redirect(workspaceLoginPath(audience, requestPath, "session-invalid"));
  if (!roleMatchesAudience(parsed.data.role, audience)) redirect(workspaceLoginPath(audience, requestPath, "wrong-workspace"));
  let theme: ReturnType<typeof safeWorkspaceTheme> = defaultWorkspaceTheme;
  try { const themeResponse = await serverApi("/organization/theme"); if (themeResponse.ok) { const body: { data: unknown } = await themeResponse.json(); theme = safeWorkspaceTheme(body.data); } } catch { /* Theme is optional; use the built-in accessible defaults. */ }
  return <WorkspaceShell session={parsed.data} theme={theme}>{children}</WorkspaceShell>;
}
