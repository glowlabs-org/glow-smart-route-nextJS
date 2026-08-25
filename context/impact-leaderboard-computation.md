# Impact Leaderboard Computation

> **Historical reference only.** This document describes the V1 scoring pipeline (point-in-time accuracy fixes, per-week loops, claim-timestamp inference) which is superseded by Points V2. See the consolidated spec at [POINTS-V2-SPEC.md](../../gca-crm-backend-merged/src/routers/impact-router/POINTS-V2-SPEC.md). V2 is event-driven rather than week-indexed and does not require the historical-unclaimed infrastructure documented below. Kept because the infrastructure and Ponder integration described here remain useful for auditing V1-era leaderboards and informing any V2 analogues.

This document explains the optimization and historical accuracy fixes implemented for the Glow Impact Leaderboard.

## Initial Problem

1.  **Performance**: Computing the impact leaderboard for ~1000 wallets on-the-fly was taking >10 seconds. This involved thousands of downstream API calls to Control API (rewards history, split segments), Ponder Listener (TWAB, claims), and on-chain balance checks.
2.  **Historical Inaccuracy (Point-in-Time Error)**:
    - The scoring logic iterates through each week in a range (e.g., Week 97 to Current).
    - "Unclaimed Rewards" were being calculated based on a **current snapshot** (is it claimed _now_?).
    - If a user claimed Week 99 rewards "today", the logic would see them as "claimed" for all past weeks (e.g., Week 100 calculation loop).
    - This caused historical scores to dip retroactively once a user claimed rewards, because the balance hadn't yet reached the "Liquid GLW" bucket in those past weeks, but was already removed from the "Unclaimed" bucket.

## Context Provided

- **Wallet Universe**: ~922 wallets and growing.
- **TWAP Balance**: Liquid GLW uses a per-week Time-Weighted Average Balance (TWAB) to prevent gaming (flash transfers).
- **MinerPool Nuance**: The MinerPool contract (inflation) does not emit `Claim` events. We index these via `Transfer` events from the MinerPool contract address.
- **Core Requirement**: Actions taken _today_ (claiming rewards, unlocking vaults, buying GLW) must **not** affect the score of past weeks.

## Implementation Fixes

### 1. Ponder Listener API Update

- **Location**: `[ponder-listener/src/api/index.ts](../ponder-listener/src/api/index.ts)`
- **Fix 1**: Modified the `/rewards/claimed-pd-weeks/batch` endpoint. Instead of returning a simple list of claimed weeks, it now returns a map: `Record<wallet, Record<week, claimTimestamp>>`.
- **Fix 2**: Added a new `POST /rewards/claims/batch` endpoint to fetch raw claim events for multiple wallets in one request. This enables the backend to infer MinerPool inflation claim weeks by matching transfer amounts.
- **Why**: The backend needs the `claimTimestamp` to know if a reward was unclaimed _at the end of the week being calculated_. For MinerPool claims (which don't have nonces), we infer the week by matching amounts and need the timestamp for historical accuracy.

### 2. Backend Database Caching

- **Location**: `[gca-crm-backend/src/db/schema.ts](../gca-crm-backend/src/db/schema.ts)`
- **Fix**: Added `impact_leaderboard_cache` table with `startWeek` and `endWeek` columns to prevent stale cache mismatches.
- **Cron Job**: `[gca-crm-backend/src/crons/update-impact-leaderboard/update-impact-leaderboard.ts](../gca-crm-backend/src/crons/update-impact-leaderboard/update-impact-leaderboard.ts)` runs **Weekly on Sunday at 01:00 UTC** (1 hour after protocol week rollover).
- **Rationale**: Protocol weeks end Sunday 00:00 UTC. The cache updates 1 hour later to give the week boundary time to stabilize, and to capture any new wallets that joined the universe during the just-completed week.
- **Cache Safety**: The router validates that the requested week range matches the cached week range. If they don't match (e.g., during the 1-hour window after Thursday rollover but before the cron runs), it falls back to on-the-fly computation.
- **Result**: API response time for default requests dropped from ~15s to <100ms.

### 3. Historical Scoring Logic Refactor

- **Location**: `[gca-crm-backend/src/routers/impact-router/helpers/impact-score.ts](../gca-crm-backend/src/routers/impact-router/helpers/impact-score.ts)`
- **Fix**: Replaced the static `unclaimed` rewards snapshot with `historicalUnclaimedWei` inside the computation loop.
- **Removed "Lite Mode"**: Previously, the leaderboard used a "lite mode" that assumed MinerPool inflation was never claimed (to save computation). Since the leaderboard is now cached daily, we can afford to run the full "accurate mode" for all ~1000 wallets, which correctly infers MinerPool claim weeks by matching transfer amounts.
- **Logic**:
  ```typescript
  const weekEndTimestamp = GENESIS_TIMESTAMP + (week + 1) * WEEK_SECONDS;
  // Reward is "Unclaimed" for week W if:
  // (ClaimTimestamp == null) OR (ClaimTimestamp > weekEndTimestamp)
  ```
- **Result**: Scores for past weeks remain stable even after rewards are claimed.

### 4. Verification Script

- **Location**: `[gca-crm-backend/scripts/debug-glow-worth-unclaimed.ts](../gca-crm-backend/scripts/debug-glow-worth-unclaimed.ts)`
- **Update**: Modified to output a "Historical Unclaimed Ledger". It reconstructs the unclaimed balance for each week using the same timestamp logic as the backend.

## Outstanding Items / Known Limitations

1.  **V1/V2 Boundary Handling**:
    - The impact scoring system only considers weeks 97+ (v2 system start: Sept 28, 2025).
    - Claims that occurred **before Week 97 started** (timestamp < 1759104000) are filtered out in both the backend (`impact-score.ts`) and debug script, even if they have a v2-compatible nonce.
    - This prevents spurious "claimed" attribution for test/staging claims that happened before the v2 system launched.
2.  **MinerPool Inflation Claim Inference**:
    - MinerPool transfers don't include nonces, so we infer the reward week by matching the claim amount to the Control API's `glowInflationTotal` for each week (within a 10M wei epsilon).
    - Ambiguous matches (where two weeks are within epsilon) are rejected to prevent false positives.
    - This "accurate mode" is now used for **all wallets** in the leaderboard cache (previously only single-wallet queries).
3.  **Vault Unlock Timing**:
    - Unlocking a vault today increases `activelyDelegatedGlwWei`. The current logic ensures this doesn't backfill past weeks because it uses the `depositSplitPercent6Decimals` history segments for each week loop.
4.  **TWAB Boundary alignment**:
    - Ensure Ponder's `lastUpdatedTimestamp` logic perfectly aligns with the `GENESIS_TIMESTAMP` week boundaries to avoid 1-block drift at the start/end of weeks.

## Important Behavioral Notes

### Leaderboard Eligibility (0-Point Wallets Excluded)

To avoid confusion, wallets with **0 total points** are excluded from the leaderboard. This typically includes:

- Wallets that acquired GLW **very recently** (during the current ongoing week)
- Wallets that only hold GLW without any historical emissions, steering, or delegation

**Example**: A wallet with 29,000 GLW acquired on Jan 7 (Week 111) will show:

- **Glow Worth**: 29,000 GLW ✅
- **Total Points**: 0 (no TWAB for weeks 97-110)
- **Leaderboard**: Not visible yet

**When they'll appear**: After Week 111 ends (Jan 11) and the cache updates (Jan 12 01:00 UTC), they'll start earning continuous points and appear on the leaderboard.

**Count**: Approximately 20 wallets out of 922 are excluded for this reason.

### Historical Unclaimed Balance

The historical unclaimed calculation is **point-in-time accurate**, which means:

- If Week 100 ended on **Oct 26, 2025** and rewards were claimed on **Dec 9, 2025**, the unclaimed balance for Week 100 **will show the full amount** because at the time Week 100 ended, those rewards were indeed unclaimed.
- This is **correct behavior** — scores should reflect the state of the wallet at each week's end, not retroactive knowledge of future claims.
- The "Current Snapshot" shows 0 unclaimed if all claimable rewards have been claimed by now.

### V1 vs V2 System Boundary

- Week 97 (Sept 28, 2025) marks the start of the v2 rewards system.
- Any claims that occurred **before Week 97 started** (timestamp < 1759104000) are filtered out, even if they have v2-compatible nonces.
- This prevents test/staging claims from being incorrectly attributed to v2 weeks.

## Verification Results ✅

All verification items have been tested and confirmed working:

- ✅ **Historical Stability**: Wallet `0x77f41144...` claimed weeks 105-107 on Jan 6, 2026. Week 100-104 correctly show unclaimed amounts that existed at the time those weeks ended.
- ✅ **V1 Claim Filtering**: Claims with timestamps before Week 97 (1759104000) are filtered in both `control-api.ts` and `impact-score.ts`.
- ✅ **Cache Hit**: Leaderboard with default range (97-110) serves from database cache in <500ms.
- ✅ **Cache Miss**: Custom week range (97-108) bypasses cache and computes on-the-fly in ~15s.
- ✅ **Accurate Mode Performance**: Cron completed in 22 seconds for 922 wallets (well within acceptable limits).
- ✅ **Inflation Claim Accuracy**: Debug script correctly infers MinerPool claims by matching amounts (11 weeks detected for wallet `0x77f41144...`).
- ✅ **UI Context Separation**:
  - Leaderboard shows Week 110 finalized (no miner, no streak)
  - Rank widget shows Week 111 current (has miner, streak 1/4)
  - Breakdown dialog respects `showCurrentWeekProjection` prop
- ✅ **Fractions Endpoint**: Not affected by impact changes, correctly uses GCA report timing (Week 109).

## UI Indicator Behavior (Current vs Finalized)

The frontend has two different contexts that display multipliers/bonuses differently:

### 1. Rank Widget (`app/test/widgets/rank-widget.tsx`)

**Purpose**: Show the user what's ACTIVE NOW for the current ongoing week.

**Data Source**: `currentWeekProjection` from single-wallet API response

- `hasMinerMultiplier` - Did you buy a miner THIS week?
- `hasSteeringStake` - Do you have GCTL staked NOW?
- `streakBonusMultiplier` - What's your current streak bonus?

**Why**: Users want to see "what bonuses am I getting RIGHT NOW" so they can decide whether to take action today.

### 2. Leaderboard (`app/stats/rewards/impact-view.tsx`)

**Purpose**: Show FINALIZED multipliers/bonuses that were used to calculate the displayed score.

**Data Source**: Fields from the last completed week (Week 109 in `endWeek`)

- `hasMinerMultiplier` - Did they have a miner at Week 109?
- `endWeekMultiplier` - What was their total multiplier at Week 109?
- `hasSteeringStake` - Did they steer GLW during Weeks 97-109? (derived from `totals.totalSteeringGlwWei > 0`)
- `hasVaultBonus` - Do they have delegations? (derived from `glowWorth.delegatedActiveGlwWei > 0`)

**Why**: The leaderboard shows historical scores, so indicators should reflect the state that produced those points, not current state. If someone stakes GCTL today, it shouldn't light up the "steering" indicator on the leaderboard until next week's rollover.

### 3. Breakdown Dialog (`components/dialogs/impact-score-breakdown-dialog.tsx`)

**Context-Aware**: The dialog accepts a `showCurrentWeekProjection` prop to control whether it displays current or finalized data.

**When opened from Leaderboard** (`showCurrentWeekProjection={false}`):

- Shows **FINALIZED Week 109** data only (no current week projection)
- Miner/Streak/Steering indicators reflect the last completed week
- **Why**: Keeps the breakdown aligned with the leaderboard's historical score

**When opened from Rank Widget** (default `showCurrentWeekProjection={true}`):

- Shows **CURRENT Week 111** data (if available, otherwise falls back to Week 109)
- Miner/Streak/Steering indicators reflect what's active NOW
- **Why**: Users want to see "what bonuses will I get this week"

### Implementation Details

- **Rank Widget**: Uses `impactScore.currentWeekProjection.hasMinerMultiplier` (CURRENT Week 111)
- **Leaderboard Row**: Uses `row.hasMinerMultiplier` from backend, which is `cashMinerWeeks.has(endWeek)` (FINALIZED at Week 109)
- **Breakdown Dialog**: Respects `showCurrentWeekProjection` prop to control whether to show current week projection or finalized data only

## Testing Commands

### Debug Script (Historical Unclaimed Verification)

```bash
# Local
CONTROL_API_URL=https://api-prod-34ce.up.railway.app \
bun run scripts/debug-glow-worth-unclaimed.ts --wallet 0x77f41144E787CB8Cd29A37413A71F53f92ee050C --startWeek 97

# Check that claims made today don't affect historical unclaimed balances
```

### Manual Cache Refresh

```bash
# Trigger the impact leaderboard cron manually
curl http://localhost:3005/trigger-impact-leaderboard-cron
# Takes ~20-30 seconds for ~1000 wallets
```

### Performance Tests

```bash
# Cached leaderboard (should be <500ms)
time curl -sS "http://localhost:3005/impact/glow-score?limit=200" > /dev/null

# Live single wallet (should be ~3s)
time curl -sS "http://localhost:3005/impact/glow-score?walletAddress=0x77f41144..." > /dev/null

# Custom week range bypasses cache (should be ~15s)
time curl -sS "http://localhost:3005/impact/glow-score?limit=200&startWeek=97&endWeek=108" > /dev/null
```
