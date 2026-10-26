export const workspaceUpdateKey = "reviewroom-workspace-update";
export function notifyWorkspaceUpdate(organizationId: string) {
  const detail = { organizationId, revision: `${Date.now()}-${Math.random()}` };
  window.dispatchEvent(new CustomEvent(workspaceUpdateKey, { detail }));
  try { window.localStorage.setItem(workspaceUpdateKey, JSON.stringify(detail)); } catch { /* Focus refresh also works when storage is disabled. */ }
}
