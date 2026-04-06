const LAUNCHPAD_TIME_OVERRIDE_ENV = "NEXT_PUBLIC_LAUNCHPAD_TIME_OVERRIDE_ISO";

const launchpadTimeOverrideMs = (() => {
  const raw = process.env[LAUNCHPAD_TIME_OVERRIDE_ENV]?.trim();
  if (!raw) return null;

  const parsedMs = Date.parse(raw);
  if (!Number.isFinite(parsedMs)) return null;

  return parsedMs;
})();

export function getLaunchpadNowMs(nowMs: number = Date.now()): number {
  return launchpadTimeOverrideMs ?? nowMs;
}

export function isMarketplaceVisibleAt(
  visibleAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!visibleAt) return true;

  const visibleAtMs = Date.parse(visibleAt);
  if (!Number.isFinite(visibleAtMs)) return true;

  return getLaunchpadNowMs(nowMs) >= visibleAtMs;
}
