import { getLaunchpadNowMs } from "@/utils/launchpad-now";

const ET_TIME_ZONE = "America/New_York";
const TUESDAY = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOCAL_MINER_OVERRIDE_ENABLED_ENV =
  "NEXT_PUBLIC_LOCAL_MINER_LAUNCH_OVERRIDE";

export const LOCAL_MINER_OVERRIDE_APPLICATION_ID =
  "54c1ce52-15d3-4dbd-85d0-eb06f6feed8a";
export const LOCAL_MINER_OVERRIDE_VISIBLE_AT_ISO =
  "2026-04-07T05:00:00.000Z";

const etFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type EtParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function getETParts(date: Date): EtParts {
  const parts = etFormatter.formatToParts(date);
  const lookup: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};

  for (const part of parts) {
    if (part.type === "literal") continue;
    lookup[part.type] = Number(part.value);
  }

  return {
    year: lookup.year ?? 0,
    month: lookup.month ?? 0,
    day: lookup.day ?? 0,
    hour: lookup.hour ?? 0,
    minute: lookup.minute ?? 0,
    second: lookup.second ?? 0,
    weekday: new Date(
      Date.UTC(
        lookup.year ?? 0,
        (lookup.month ?? 1) - 1,
        lookup.day ?? 1,
        12,
      ),
    ).getUTCDay(),
  };
}

function buildDateForETWallTime(params: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  second?: number;
}): Date {
  const {
    year,
    month,
    day,
    hour,
    minute = 0,
    second = 0,
  } = params;

  const approxUtc = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  const approxEtParts = getETParts(approxUtc);
  const offsetMinutes = Math.round(
    (Date.UTC(
      approxEtParts.year,
      approxEtParts.month - 1,
      approxEtParts.day,
      approxEtParts.hour,
      approxEtParts.minute,
      approxEtParts.second,
    ) -
      approxUtc.getTime()) /
      60000,
  );

  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second) -
      offsetMinutes * 60000,
  );
}

export function getNextTuesdayAtETHour(
  hour: number,
  fromDate?: Date,
): Date {
  const baseDate =
    fromDate ?? new Date(getLaunchpadNowMs());
  const now = new Date(baseDate.getTime());
  const etNow = getETParts(now);
  let addDays = (TUESDAY - etNow.weekday + 7) % 7;

  if (addDays === 0) {
    const isPastTargetHour =
      etNow.hour > hour ||
      (etNow.hour === hour && (etNow.minute > 0 || etNow.second > 0));
    if (isPastTargetHour) addDays = 7;
  }

  const candidate = new Date(now.getTime() + addDays * MS_PER_DAY);
  const etCandidate = getETParts(candidate);

  return buildDateForETWallTime({
    year: etCandidate.year,
    month: etCandidate.month,
    day: etCandidate.day,
    hour,
  });
}

export function getNextTuesdayAt1amET(fromDate: Date = new Date()): Date {
  return getNextTuesdayAtETHour(1, fromDate);
}

// Computes the next Tuesday at 1:00 PM America/New_York (ET), from the current moment.
// If today is Tuesday but past 1:00 PM ET, it returns next week's Tuesday.
export function getNextTuesdayAt1pmET(fromDate: Date = new Date()): Date {
  return getNextTuesdayAtETHour(13, fromDate);
}

export function isLocalMinerLaunchOverrideEnabled(): boolean {
  return process.env[LOCAL_MINER_OVERRIDE_ENABLED_ENV] === "1";
}

export function getLocalMinerLaunchOverrideVisibleAtIso(): string | null {
  if (!isLocalMinerLaunchOverrideEnabled()) return null;
  return LOCAL_MINER_OVERRIDE_VISIBLE_AT_ISO;
}

export function getNextMiningCenterBatchAtET(
  fromDate?: Date,
): Date {
  const baseDate = fromDate ?? new Date(getLaunchpadNowMs());
  const localOverrideVisibleAtIso = getLocalMinerLaunchOverrideVisibleAtIso();
  if (localOverrideVisibleAtIso) {
    const localOverrideVisibleAtMs = Date.parse(localOverrideVisibleAtIso);
    if (
      Number.isFinite(localOverrideVisibleAtMs) &&
      baseDate.getTime() < localOverrideVisibleAtMs
    ) {
      return new Date(localOverrideVisibleAtMs);
    }
  }

  return getNextTuesdayAt1amET(baseDate);
}

export function getNextLaunchpadDelegationBatchAtET(
  fromDate?: Date,
): Date {
  const baseDate = fromDate ?? new Date(getLaunchpadNowMs());
  const etNow = getETParts(baseDate);

  if (etNow.weekday === TUESDAY && etNow.hour >= 1 && etNow.hour < 13) {
    return getNextTuesdayAt1pmET(baseDate);
  }

  return getNextTuesdayAt1amET(baseDate);
}

export function getNextSponsorListingsBatchAtET(
  fromDate?: Date,
): Date {
  const baseDate = fromDate ?? new Date(getLaunchpadNowMs());
  const nextMiningCenterBatchAt = getNextMiningCenterBatchAtET(baseDate);
  const nextLaunchpadDelegationBatchAt =
    getNextLaunchpadDelegationBatchAtET(baseDate);

  return nextMiningCenterBatchAt.getTime() <=
    nextLaunchpadDelegationBatchAt.getTime()
    ? nextMiningCenterBatchAt
    : nextLaunchpadDelegationBatchAt;
}
