# Mining Stats Dialog - Data Sources

## Overview

The Mining Stats Dialog (`mining-stats-dialog.tsx`) displays detailed analytics for Mining Center opportunities. Each mining position represents fractional claims to GLW token emissions from active solar farms.

## Props/Inputs

### `application` (AuctionApplication from `useMiningCenter`)

- Type: `AuctionApplication`
- Source: Mining Center API
- Contains: Zone info, fraction details, pricing

### `miningScoreData`

- Type: `{ miningScore: number; weeklyGlwRewards?: string; weeklyGlwRewardsUsd?: string }`
- Source: `useMiningScore` hook
- Backend: Farms router `calculateMiningScoresBatch` endpoint

## Hooks Used

### `useActiveRegionsSummary()`

- Returns: Regional GCTL staking and GLW allocation data
- Used for: Regional GLW/Week metric

### `useRegions()`

- Returns: `RegionWithMetadata[]`
- Used for: Solar farm count

### `useGlowSpotPrice()`

- Returns: Current GLW market price in USD
- Used for: USD conversions, APR calculation

---

## Metrics Breakdown

### Opportunity Snapshot Section

#### 1. **Estimated APR**

- **Calculation:**
  ```typescript
  totalRewardsUsd = weeklyGlwRewards × weeksRemaining × glwSpotPrice
  roi = (totalRewardsUsd / costPerMiner - 1) × 100
  apr = roi × (52 / 99)  // Annualize to yearly rate
  ```
- **Data Sources:**
  - `weeklyGlwRewards` from `miningScoreData.weeklyGlwRewards`
  - `costPerMiner` from `application.activeFraction.stepPrice`
  - `glwSpotPrice` from `useGlowSpotPrice()`
  - `weeksRemaining` = hardcoded 99

#### 2. **GLW per Week (per miner)**

- **Source:** `miningScoreData.weeklyGlwRewards`
- **Conversion:** `formatUnits(BigInt(weeklyGlwRewards), DECIMALS_BY_TOKEN["GLW"])`
- **Format:** 18 decimals → human-readable GLW
- **Secondary Value:** `weeklyGlwRewards × glwSpotPrice` for USD equivalent

#### 3. **Cost per Miner**

- **Source:** `application.activeFraction.stepPrice`
- **Conversion:** `formatUnits(BigInt(stepPrice), DECIMALS_BY_TOKEN["USDC"])`
- **Format:** 6 decimals → human-readable USDC
- **Note:** This is the upfront USDC payment for the fractional mining position

#### 4. **Reward Duration**

- **Source:** Hardcoded constant
- **Value:** `99 weeks`
- **Note:** Fixed emission schedule for mining positions

---

### Region Context Section

#### 5. **Active Farms**

- **Source:** `region.solarFarmCount`
- **Hook:** `useRegions()`
- **Type:** `RegionWithMetadata.solarFarmCount`
- **Matching:** Finds region by `application.zone.id` or `application.zone.name`

#### 6. **Regional GLW/Week**

- **Source:** `regionSummary.glwPerWeek`
- **Hook:** `useActiveRegionsSummary()`
- **Type:** `ActiveRegionSummaryDerived.glwPerWeek`
- **Matching:** Finds region summary by zone ID or name
- **Note:** Total weekly GLW allocated to entire region (all farms)

---

### Returns Horizon Section

#### 7. **Total GLW Rewards**

- **Calculation:** `weeklyGlwRewards × weeksRemaining`
- **Formula:** `weeklyGlwRewards × 99`
- **Note:** Assumes current emission rate continues

#### 8. **Est. Value (USD)**

- **Calculation:** `totalRewardsOverPeriod × glwSpotPrice`
- **Note:** Based on current GLW price

#### 9. **Total ROI**

- **Calculation:** `(totalRewardsUsd / costPerMiner - 1) × 100`
- **Format:** Percentage with + prefix
- **Note:** Total return over 99-week period

---

## Data Flow Diagram

```
Mining Center View
    │
    ├── application (AuctionApplication)
    │   ├── activeFraction.stepPrice → Cost per Miner (USDC, 6 decimals)
    │   └── zone.id/zone.name → Region matching
    │
    ├── miningScoreData (from useMiningScore)
    │   └── weeklyGlwRewards → GLW/Week → Total Rewards → APR
    │
    ├── useRegions()
    │   └── RegionWithMetadata[]
    │       └── region.solarFarmCount → Active Farms
    │
    ├── useActiveRegionsSummary()
    │   └── ActiveRegionsSummaryData
    │       └── regionSummary.glwPerWeek → Regional GLW/Week
    │
    └── useGlowSpotPrice()
        └── spotPrice → USD conversions, APR calculation
```

---

## Important Notes

### Mining Score Calculation

The `miningScoreData` is calculated server-side using:

- Farm ID
- Dollar cost of miner (from `stepPrice`)
- Number of miners (from `totalSteps`)
- Miner reward split (from `sponsorSplitPercent`)

Backend endpoint: `farmsRouter.calculateMiningScoresBatch()`

### APR Assumptions

- **Current emissions:** Assumes current weekly GLW rate continues
- **No dilution:** Does not account for new farms joining region
- **Price constant:** Uses current GLW spot price
- **Annualization:** Converts 99-week ROI to annual rate via `× (52/99)`

### Regional Metrics

- **Active Farms:** From `RegionWithMetadata` (updated via Control API)
- **Regional GLW/Week:** From active regions summary (staking-based allocation)
- **Matching Logic:** Tries both zone ID and zone name for robustness

---

## Disclaimer Text

> "Pre-packaged mining positions: Each mining position represents fractional claims to GLW token emissions from active solar farms. Returns are based on current network conditions including regional GLW allocations, farm deposit size, and predetermined reward splits. Actual returns may vary as new farms join the region and dilute per-farm token allocations. GLW price appreciation is not guaranteed. Mining positions earn token streams over 99 weeks from live solar infrastructure."

This emphasizes:

- Positions are pre-structured
- Returns depend on network conditions
- Dilution risk from new regional farms
- Price risk
- Fixed 99-week schedule
