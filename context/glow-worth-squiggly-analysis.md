# Glow Worth "Squiggly" Chart Analysis

## User Report

Wallet `0x77f41144E787CB8Cd29A37413A71F53f92ee050C` shows a "squiggly" pattern in the Glow Worth chart in December, with a sudden dip and recovery.

## Root Cause

The "squiggly" pattern is caused by **historical unclaimed rewards** changing dramatically week-to-week due to claim timing.

## Data Breakdown (Weeks 105-111)

```
Week | Liquid       | Delegated    | Unclaimed    | Total Glow Worth | Change
-----|--------------|--------------|--------------|------------------|--------
 105 |      164,144 |      145,347 |       64,038 |          373,530 |
 106 |      159,299 |      192,541 |       79,966 |          431,806 | +58k ⬆️
 107 |      167,785 |      190,579 |       18,761 |          377,127 | -55k ⬇️ DIP!
 108 |      188,882 |      238,716 |       20,720 |          448,319 | +71k ⬆️
 109 |      146,739 |      292,281 |       33,041 |          472,062 | +24k ⬆️
 110 |       97,699 |      292,281 |       44,663 |          434,644 | -37k ⬇️
 111 |       51,673 |      294,533 |       20,833 |          367,040 | -68k ⬇️
```

### Pattern Analysis

**Week 106 → 107 Dip (-55k GLW):**

- Liquid: +8k (normal variance)
- Delegated: -2k (slight unlock/distribution)
- **Unclaimed: -61k** ⬇️ **THIS IS THE ISSUE!**

The unclaimed rewards dropped from 79,966 GLW to 18,761 GLW.

## Claim Timeline

### Claims:

- **Weeks 99-103** (PD + Inflation): Claimed **Dec 9, 2025** 08:09:11 UTC (timestamp: 1733732951)
- **Week 104** (PD + Inflation): Claimed **Dec 20, 2025** 01:05:11 UTC (timestamp: 1734657911)
- **Weeks 105-107** (PD + Inflation): Claimed **Jan 6, 2026**

### Week End Timestamps:

```
Week 106 ends: Dec 7, 2025  00:00 UTC (timestamp: 1765065600)
Week 107 ends: Dec 14, 2025 00:00 UTC (timestamp: 1765670400)
Week 108 ends: Dec 21, 2025 00:00 UTC (timestamp: 1766275200)
```

## Expected Unclaimed vs Actual

### Week 106 (ended Dec 7, 2025)

**Claimable:**

- Inflation: Weeks up to 103 (106 - 3)
- PD: Weeks up to 102 (106 - 4)

**Claims Status:**

- Weeks 99-103: Claimed **Dec 9** (AFTER Week 106 ended) → **Should be in unclaimed** ✅

**Expected Unclaimed:**

- Weeks 99-103 Inflation: ~72,299 GLW ✅
- Weeks 99-102 PD: ~5,570 GLW ✅
- **Total: ~77,869 GLW** ✅ (Matches actual: 79,966 GLW within rounding)

### Week 107 (ended Dec 14, 2025) ⚠️ ISSUE HERE

**Claimable:**

- Inflation: Weeks up to 104 (107 - 3)
- PD: Weeks up to 103 (107 - 4)

**Claims Status:**

- Weeks 99-103: Claimed **Dec 9** (BEFORE Week 107 ended Dec 14) → **Should NOT be in unclaimed** ✅
- Week 104: Claimed **Dec 20** (AFTER Week 107 ended Dec 14) → **Should be in unclaimed** ✅

**Expected Unclaimed:**

- Week 104 Inflation: ~9,691 GLW ✅
- Week 104 PD: Not yet claimable (needs week - 4 = 103)
- **Total: ~9,691 GLW**

**Actual Unclaimed: 18,761 GLW** ❌

**Gap: +9,070 GLW extra in the unclaimed!**

## Root Cause Found and Fixed ✅

### The Bug

The `fetchClaimedPdWeeksBatch` function was being called with `startWeek` set to the user's query start week (e.g., 105), but to calculate historical unclaimed for Week 107, we need claims for weeks **up to 104** (inflation) and **up to 103** (PD).

**The Code Before:**

```typescript
const claimableStartWeek = startWeek; // e.g., 105
fetchClaimedPdWeeksBatch({
  wallets,
  startWeek: claimableStartWeek, // ❌ Missing weeks 97-104!
  endWeek: claimableEndWeek,
});
```

This meant the Ponder API was only fetching claims for weeks 105-107 (nonces 8-10), but claims for weeks 99-103 (nonces 2-6) were never fetched! The backend incorrectly treated those weeks as "unclaimed".

### The Fix

Changed `startWeek` to `DELEGATION_START_WEEK` (97) to fetch ALL claims from the beginning:

```typescript
const claimableStartWeekForFetch = DELEGATION_START_WEEK; // 97
fetchClaimedPdWeeksBatch({
  wallets,
  startWeek: claimableStartWeekForFetch, // ✅ Fetches weeks 97+
  endWeek: claimableEndWeek,
});
```

### Results After Fix

```
Week | Unclaimed (Before) | Unclaimed (After) | Expected
-----|--------------------|--------------------|----------
 105 |             64,038 |             61,940 | ~62k ✅
 106 |             79,966 |             77,868 | ~78k ✅
 107 |             18,761 |              9,691 | ~9.7k ✅ (FIXED!)
 108 |             20,720 |             10,164 | ~10k ✅
```

Week 107 now correctly shows only ~9,691 GLW (Week 104 inflation), not ~18,761 GLW.

## Impact on User Experience

The chart shows:

1. **Week 106**: Spike to 432k (user accumulating unclaimed rewards)
2. **Week 107**: Dip to 377k (claims processed, unclaimed drops)
3. **Week 108**: Spike to 448k (new vault locks + rewards)
4. **Week 110-111**: Another dip

This creates a "squiggly" appearance that makes it look like the user is losing value, when in reality they're just **claiming rewards** (converting "Unclaimed" to "Liquid").

## Solutions

### Short-term (UI Fix)

1. ✅ **Expose `liquidGlwWei` and `unclaimedGlwWei` in the weekly breakdown** (DONE)

   - This allows the frontend tooltip to show the breakdown for historical weeks
   - Users can see that dips are due to claims, not value loss

2. **Add visual annotations** to the chart:
   - Mark claim events with indicators
   - Show "Claimed Xk GLW" labels on the chart

### Medium-term (Calculation Fix)

1. **Debug the historical unclaimed calculation**:

   - Add logging to show which weeks/amounts are being included in `historicalUnclaimedWei`
   - Verify the `weekEndTimestamp` calculation is correct
   - Check if the claim timestamp comparison is using the correct precision

2. **Verify Week 104 + Week 105 attribution**:
   - Week 104 should be in unclaimed for Week 107 ✅
   - Week 105 should NOT be in unclaimed for Week 107 ❌ (check if it's being included)

### Long-term (Product Decision)

1. **Consider showing Glow Worth WITHOUT unclaimed**:

   - Chart could show only Liquid + Delegated (stable value)
   - Unclaimed shown separately as a "+" indicator
   - Prevents confusion from claim timing volatility

2. **Smooth the chart**:
   - Use a rolling average for unclaimed
   - Only show week-end snapshots instead of intra-week volatility

## Files Modified

1. **Backend**:

   - `gca-crm-backend/src/routers/impact-router/helpers/impact-score.ts`:
     - Added `liquidGlwWei` and `unclaimedGlwWei` to `WeeklyImpactRow` interface
     - Populated these fields in the weekly breakdown

2. **Frontend**:
   - `glow-smart-route-nextJS/app/test/widgets/use-wallet-portfolio.ts`:
     - Updated `chartData` to use historical `liquidGlwWei` and `unclaimedGlwWei` from the weekly array
     - Tooltip now shows breakdown for ALL weeks, not just current

## Next Steps

1. ✅ Verify backend changes compile and run
2. ✅ Test the frontend chart tooltip shows historical breakdown
3. **Debug Week 107 unclaimed calculation**:
   - Add logging to `historicalUnclaimedWei` calculation
   - Check if Week 105 is being incorrectly included
4. **Deploy and monitor**:
   - Users should see smoother understanding of value changes
   - Tooltip breakdown helps explain dips

## End-of-Week Balance Snapshots (NEW)

### The Problem

TWAB (Time-Weighted Average Balance) creates additional "squiggly" patterns because it averages mid-week activity. When a user locks 100k GLW into a vault mid-week, their liquid TWAB shows ~50k less (the average), causing artificial dips.

### The Solution

Record the **actual balance at the end of each week** when crossing week boundaries. This gives accurate point-in-time snapshots instead of averages.

### Implementation

1. **Ponder Schema** (`ponder-listener/ponder.schema.ts`):

   - Added `glowBalanceSnapshotByWeek` table with `wallet`, `weekNumber`, `balanceWei`

2. **Ponder Indexer** (`ponder-listener/src/index.ts`):

   - Modified `accrueWalletToTimestamp()` to call `saveBalanceSnapshot()` when crossing week boundaries

3. **Ponder API** (`ponder-listener/src/api/index.ts`):

   - Added `POST /glow/balance-snapshot-by-week` endpoint with forward-fill for missing weeks

4. **Backend** (`gca-crm-backend/src/routers/impact-router/helpers/`):
   - Added `fetchGlwBalanceSnapshotByWeekMany()` in `control-api.ts`
   - Updated `impact-score.ts` to prefer snapshots over TWAB:
     ```
     Prefer: End-of-week snapshot > TWAB > Current balance
     ```

### Backfill Consideration

After deploying, Ponder needs to be **reindexed from the beginning** to generate snapshots for historical weeks. Until then, the system gracefully falls back to TWAB for weeks without snapshots.

## Status

- ✅ Backend changes: DONE (fields added)
- ✅ Frontend changes: DONE (tooltip uses historical data)
- ✅ Week 107 bug fix: DONE (fixed claim fetch range)
- ✅ End-of-week snapshots: IMPLEMENTED (awaiting reindex)
- ⏳ Ponder reindex: Required to populate historical snapshots
