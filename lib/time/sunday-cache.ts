const MS_PER_SECOND = 1_000;
const SECONDS_PER_DAY = 86_400;

export function millisecondsUntilNextSundayUtc(from: Date = new Date()): number {
  const dayOfWeek = from.getUTCDay();
  const daysUntilNextSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

  const nextSundayUtcMs = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate() + daysUntilNextSunday,
    0,
    0,
    0,
    0
  );

  const delta = nextSundayUtcMs - from.getTime();
  return Math.max(MS_PER_SECOND, delta);
}

export function secondsUntilNextSundayUtc(from: Date = new Date()): number {
  const seconds = Math.floor(millisecondsUntilNextSundayUtc(from) / MS_PER_SECOND);
  return Math.max(1, seconds);
}

export const STALE_WHILE_REVALIDATE_SECONDS = SECONDS_PER_DAY;
