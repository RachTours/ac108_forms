export type SignatureRect = { left: number; top: number; width: number; height: number };
export type SignaturePoint = { x: number; y: number };

export function normalizeSignaturePoint(clientX: number, clientY: number, rect: SignatureRect): SignaturePoint {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  };
}
