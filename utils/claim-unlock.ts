import { GENESIS_TIMESTAMP } from "@/utils/getCurrentEpoch";
import { getNextWednesdayAt1pmET } from "@/utils/nextTuesdayET";
import { getLaunchpadNowMs } from "@/utils/launchpad-now";

const WEEK_SECONDS = 7 * 86_400;

// Epoch 121 protocol deposits were administratively delayed one week; they
// unlock April 18 2026 at 9 AM ET (13:00 UTC) rather than the normal Wednesday.
// Folding it into the unlock timestamp keeps the single claimability predicate
// correct without a separate boolean special-case.
const EPOCH_121_PD_UNLOCK_MS = Date.UTC(2026, 3, 18, 13, 0, 0);

// Number of epochs after a week before its rewards finalize (and the unlock
// clock starts). Protocol-deposit weeks finalize one epoch later than
// inflation-only weeks, so a week carrying protocol deposits waits one more.
export function getWeeksToWait(hasProtocolRewards: boolean): number {
  return hasProtocolRewards ? 4 : 3;
}

// Deterministic timestamp (ms) at which a given week's rewards become
// claimable: the Wednesday 1pm ET that follows the week's finalization. Per the
// early-claim-delegation mechanic, raw claims unlock the Wednesday at 1pm ET
// that follows the protocol's Saturday-night-ET finalization. Pure function of
// (week, weeksToWait) — independent of "now".
export function computeClaimUnlockTimestampMs(
  week: number,
  weeksToWait: number,
): number {
  const finalizationMs =
    (GENESIS_TIMESTAMP + (week + weeksToWait) * WEEK_SECONDS) * 1000;
  const wednesdayUnlockMs = getNextWednesdayAt1pmET(
    new Date(finalizationMs),
  ).getTime();
  // Week 121 PD is delayed; never unlock earlier than its administrative date.
  if (week === 121) {
    return Math.max(wednesdayUnlockMs, EPOCH_121_PD_UNLOCK_MS);
  }
  return wednesdayUnlockMs;
}

// Single source of truth for "can this week be claimed right now": both present
// reward streams finalized, past the Wednesday unlock, and not already claimed.
export function isWeekClaimableNow(
  params: { isFinalized: boolean; unlockMs: number; isClaimed: boolean },
  nowMs: number = getLaunchpadNowMs(),
): boolean {
  return params.isFinalized && nowMs >= params.unlockMs && !params.isClaimed;
}
