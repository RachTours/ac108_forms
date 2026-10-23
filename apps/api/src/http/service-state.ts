let draining = false;

/** Mark this process unavailable for new work during graceful shutdown. */
export function markDraining(): void {
  draining = true;
}

export function isDraining(): boolean {
  return draining;
}
