export const DEADLINE_STORAGE_KEY = "offer-deadline";

/**
 * Evergreen deadline. The first visit fixes an end time; later visits reuse it,
 * including after it has passed — an expired offer shows an expired state
 * rather than silently restarting. A timer that visibly resets on refresh
 * teaches visitors the urgency is fake.
 */
export function resolveDeadline(
  now: number,
  stored: string | null,
  windowHours: number,
): number {
  if (stored) {
    const parsed = Number(stored);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return now + windowHours * 3_600_000;
}

const pad = (value: number): string => String(value).padStart(2, "0");

export function splitRemaining(ms: number): {
  hours: string;
  minutes: string;
  seconds: string;
} {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);

  return {
    hours: pad(Math.floor(totalSeconds / 3600)),
    minutes: pad(Math.floor((totalSeconds % 3600) / 60)),
    seconds: pad(totalSeconds % 60),
  };
}
