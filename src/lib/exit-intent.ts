export const EXIT_STORAGE_KEY = "exit-intent-stage";

export const STAGE_COUNT = 2;

/**
 * The index of the stage to show next, or null once the visitor has seen them
 * all. Stored per session, so someone who has already declined twice is not
 * shown the popup again on every subsequent exit attempt.
 */
export function nextStage(seen: string | null): 0 | 1 | null {
  if (seen === null) return 0;

  const parsed = Number(seen);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  if (parsed >= STAGE_COUNT - 1) return null;

  return (parsed + 1) as 1;
}
