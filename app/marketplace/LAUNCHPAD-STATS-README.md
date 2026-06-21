# Launchpad Stats Dialog - Data Sources

## Overview

The Launchpad Stats Dialog (`launchpad-stats-dialog.tsx`) displays detailed analytics for GLW delegation opportunities. Shows expected returns based on audited farm performance and regional competitiveness.

## Critical Note: Do Not Ignore `liveSoon` / `extraLiveFarms`

- When validating marketplace stats from the dashboard widget, do not inspect miner rewards from a raw `POST /farms/mining-scores-batch` call by itself.
- The dashboard widget passes launchpad delegations into `useMiningScore(..., extraLiveApplications)` and `useMiningScore` also merges `/applications/live-soon` into `extraLiveFarms`.
- This means upcoming launchpad farms can dilute miners before the `9:00 AM ET` release window, even while the listing is still hidden from public sponsor-listing routes.
- If you skip that merge, miner dialogs can be materially overstated.

### Concrete failure mode

- On `2026-03-31`, `ClearSky Vale` looked like `75.85 GLW/week` from a raw mining-score batch call with no extra live farms.
- The real widget path included launchpad app `475b8977-ece0-4f8e-b6c6-a99bb6113411` from `/applications/live-soon`, which diluted `ClearSky Vale` to about `46.32 GLW/week`.
- Future stats checks should treat the widget path as authoritative:
  - miners: `useMiningScore()` with merged `liveSoon` and `extraLiveApplications`
  - delegations: `useRewardScore()`

### Files to verify before trusting a manual stats check

- [launchpad-status-widget.tsx](/Users/julientremblay/Projects/glow/main-repos/glow-smart-route-nextJS/app/test/widgets/launchpad-status-widget.tsx)
- [control-farms.ts](/Users/julientremblay/Projects/glow/main-repos/glow-smart-route-nextJS/hooks/control-farms.ts)
- [mining-score.ts](/Users/julientremblay/Projects/glow/main-repos/glow-smart-route-nextJS/lib/mining-score.ts)
- [liveSoon.ts](/Users/julientremblay/Projects/glow/main-repos/gca-crm-backend/src/routers/applications-router/liveSoon.ts)

## Props/Inputs

### `application` (AuctionApplication from `useGlowLaunchpad`)

- Type: `AuctionApplication`
- Source: Glow Launchpad API
- Contains: Zone info, fraction details, audit fields (expected carbon credits, etc.)

### `rewardScore`

- Type: `{ userWeeklyGlwRewards: string; userWeeklyPdRewards: string }`
- Source: `useRewardScore` hook
- Backend: Farms router `estimateRewardScoresBatch` endpoint

## Hooks Used

### `useActiveRegionsSummary()`

- Returns: Regional GCTL staking and GLW allocation data
- Used for: Regional GLW/Week metric

### `useRegions()`

- Returns: `RegionWithMetadata[]`
- Used for: Solar farm count, regional efficiency score

### `useGlowSpotPrice()`

- Returns: Current GLW market price in USD
- Used for: USD conversions (APY uses GLW-only values)

### `useQuery` - Region Details

- Endpoint: `regionRouter.fetchRegionByIdOrSlug(zoneId)`
- Returns: `RegionDetails` (extends `RegionWithMetadata`)
- Contains: `sponsoredFarms[]`, `solarFarmApplications[]`
- Used for: Farms on deck count, Total PDs calculation

---

## Metrics Breakdown

### Opportunity Snapshot Section

#### 1. **Estimated APY**

- **Calculation:**
  ```typescript
  totalWeeklyGlw = (weeklyGlwFromDeposit + weeklyGlwFromInflation) / totalSteps
  apy = (totalWeeklyGlw × 52 / totalGlwPerFraction) × 100
  ```
- **Data Sources:**
  - `rewardScore.userWeeklyPdRewards` (deposit recovery, 18 decimals)
  - `rewardScore.userWeeklyGlwRewards` (emission rewards, 18 decimals)
  - `application.activeFraction.step` (GLW to delegate, 18 decimals)
  - `application.activeFraction.totalSteps`

#### 2. **Weekly GLW (per fraction)**

- **Source:** Combined from reward score
- **Components:**
  - PD Recovery: `formatUnits(rewardScore.userWeeklyPdRewards, 18)`
  - Emissions: `formatUnits(rewardScore.userWeeklyGlwRewards, 18)`
- **Calculation:** `(pdRecovery + emissions) / totalSteps`
- **Secondary:** USD value at current GLW price

#### 3. **GLW to Delegate (per fraction)**

- **Source:** `application.activeFraction.step`
- **Conversion:** `formatUnits(BigInt(step), DECIMALS_BY_TOKEN["GLW"])`
- **Format:** 18 decimals → human-readable GLW
- **Note:** Amount required to post as protocol deposit

#### 4. **Farm Efficiency**

- **Calculation:** Uses SDK `calculateFarmEfficiency()`
- **Inputs:**
  - `protocolDepositUsd6` = `BigInt(application.finalProtocolFee)` (6 decimals)
  - `weeklyImpactAssetsWad` = `BigInt(weeklyCC × 10^18)` (18 decimals)
  - `weeklyCC` from `application.auditFields.netCarbonCreditEarningWeekly`
- **Formula:** `(CC / PD) / 100,000`
- **Returns:** Expected carbon credits per $100k deposit per week
- **SDK Reference:** `@glowlabs-org/utils/browser` - `calculateFarmEfficiency()`

---

### Reward Breakdown Section

#### 5. **Weekly PD Recovery (per fraction)**

- **Source:** `rewardScore.userWeeklyPdRewards`
- **Conversion:** `formatUnits(BigInt(userWeeklyPdRewards), 18)`
- **Division:** By `totalSteps`
- **Note:** Weekly deposit recovery from competitive redistribution

#### 6. **Weekly Emissions (per fraction)**

- **Source:** `rewardScore.userWeeklyGlwRewards`
- **Conversion:** `formatUnits(BigInt(userWeeklyGlwRewards), 18)`
- **Division:** By `totalSteps`
- **Note:** Weekly GLW from protocol emissions

#### 7. **Carbon Credits (30 years)**

- **Calculation:**
  ```typescript
  weeklyCC = application.auditFields.netCarbonCreditEarningWeekly
  totalWeeksForCCs = 30 × 52  // 30 years
  totalCCsOver30Years = weeklyCC × totalWeeksForCCs
  carbonCreditsPerFraction = totalCCsOver30Years / totalSteps
  ```
- **Source:** `application.auditFields.netCarbonCreditEarningWeekly`
- **Note:** Expected lifetime carbon displacement per fraction share

---

### Region Context Section

#### 8. **Active Farms**

- **Source:** `region.solarFarmCount`
- **Hook:** `useRegions()`
- **Type:** `RegionWithMetadata.solarFarmCount`
- **Note:** Currently operational farms in region

#### 9. **Farms on Deck**

- **Source:** `regionDetails.solarFarmApplications.length`
- **Query:** `regionRouter.fetchRegionByIdOrSlug(zoneId)`
- **Type:** `RegionDetails.solarFarmApplications[]`
- **Filter:** Applications with status "audit_fees_paid" (not yet completed)
- **Note:** Farms in pipeline awaiting completion

#### 10. **Regional GLW/Week**

- **Source:** `regionSummary.glwPerWeek`
- **Hook:** `useActiveRegionsSummary()`
- **Type:** `ActiveRegionSummaryDerived.glwPerWeek`
- **Calculation:** Based on regional GCTL staking share
- **Note:** Total weekly GLW allocated to entire region

#### 11. **Total PDs**

- **Source:** Sum of sponsored farm deposits
- **Calculation:**
  ```typescript
  totalRegionPDs = regionDetails.sponsoredFarms.reduce((sum, farm) => {
    const pd = parseFloat(
      formatUnits(BigInt(farm.protocolDepositUSDC6Decimals), 6)
    );
    return sum + pd;
  }, 0);
  ```
- **Type:** `SponsoredFarm[].protocolDepositUSDC6Decimals`
- **Note:** Aggregate protocol deposits across all regional farms

#### 12. **Regional Efficiency**

- **Source:** `region.efficiencyScore`
- **Hook:** `useRegions()`
- **Type:** `RegionWithMetadata.efficiencyScore`
- **Backend Calculation:** Server aggregates all farm efficiencies in region
- **Note:** Average carbon credits per dollar of PD across region

---

### Returns Horizon Section

#### 13. **Total GLW Rewards (100 weeks)**

- **Calculation:** `totalWeeklyGlw × 100`
- **Note:** Expected total over delegation period

#### 14. **Est. Value (USD)**

- **Calculation:** `totalRewardsOverPeriod × glwSpotPrice`
- **Note:** Current market value of expected GLW rewards

#### 15. **Total ROI**

- **Calculation:** `(totalRewardsUsd / costPerFraction - 1) × 100`
- **Format:** Percentage with + prefix
- **Note:** Expected return accounting for both PD recovery and emissions

---

## Data Flow

```
Launchpad View (launchpad-view.tsx)
    │
    ├── useGlowLaunchpad()
    │   └── AuctionApplication[]
    │       ├── activeFraction.step (GLW to delegate, 18 decimals)
    │       ├── finalProtocolFee (USD, 6 decimals)
    │       ├── auditFields.netCarbonCreditEarningWeekly (number)
    │       └── zone.id/name
    │
    ├── useRewardScore()
    │   └── ApplicationRewardScore[]
    │       ├── userWeeklyPdRewards (GLW wei, 18 decimals)
    │       ├── userWeeklyGlwRewards (GLW wei, 18 decimals)
    │       └── Backend: farmsRouter.estimateRewardScoresBatch()
    │           Params:
    │           - userId (wallet or random for estimation)
    │           - sponsorSplitPercent
    │           - protocolDepositAmount
    │           - expectedWeeklyCarbonCredits
    │           - regionId
    │
    ├── useRegions()
    │   └── RegionWithMetadata[]
    │       ├── solarFarmCount
    │       └── efficiencyScore
    │
    ├── useActiveRegionsSummary()
    │   └── ActiveRegionsSummaryData
    │       └── regions[].glwPerWeek
    │
    ├── useQuery - Region Details
    │   └── RegionDetails
    │       ├── sponsoredFarms[] → Total PDs calculation
    │       └── solarFarmApplications[] → Farms on deck
    │
    └── useGlowSpotPrice()
        └── spotPrice → USD conversions
```

---

## Backend API Endpoints

### Reward Score Calculation

**Endpoint:** `POST /farms/estimate-reward-scores-batch`

**Request:**

```typescript
{
  farms: [
    {
      userId: string,
      sponsorSplitPercent: number, // From application
      protocolDepositAmount: string, // finalProtocolFee
      paymentCurrency: "GLW",
      expectedWeeklyCarbonCredits: number, // From auditFields
      regionId: number,
    },
  ];
}
```

**Response:**

```typescript
{
  results: [
    {
      success: true,
      data: {
        rewardScore: number,
        userWeeklyPdRewards: string, // 18 decimals
        userWeeklyPdRewardsUsd: string,
        userWeeklyGlwRewards: string, // 18 decimals
        userWeeklyGlwValueUsd: string,
        userEstimatedWeeklyCash: string,
        userProtocolDeposit: string,
        userGlowSplitPercent: string,
        userDepositSplitPercent: string,
        glwPriceUsd6: string,
        regionInfo: {
          regionId: number,
          regionGctlStaked: string,
          totalGctlStakedAllRegions: string,
        },
      },
    },
  ];
}
```

### Region Details

**Endpoint:** `GET /regions/:idOrSlug`

**Response:**

```typescript
RegionDetails {
  ...RegionWithMetadata,
  sponsoredFarms: SponsoredFarm[],
  solarFarmApplications: SolarFarmApplication[],
  carbonCreditsIssued: number,
  carbonCreditsPerWeek: number
}
```

---

## Key Concepts

### Expectation-Based Rewards

- Returns calculated on **expected** lifetime carbon displacement
- Audited at farm construction (not actual weekly performance)
- Protects delegators from weather volatility and operational risk
- Competition focuses on maximum climate impact through:
  - Strategic location selection
  - Equipment choices
  - Installation quality

### Competitive Deposit Recovery

- Farms compete within their region
- Above-average farms: Faster deposit recovery + surplus capture
- Below-average farms: Slower recovery + partial forfeitures
- GLW emission rewards help offset forfeitures for moderately underperforming farms

### Regional Competition

- Farms only compete with same-region farms
- Different regions have different grid carbon intensities
- Utah farms compete vs Utah, Colorado vs Colorado
- Exception: Clean Grid Project (global competition)

---

## Important Calculations

### Farm Efficiency Formula

```
efficiencyScore = (CC / PD) / 100,000

Where:
- CC = weekly carbon credits (18 decimals)
- PD = protocol deposit in USD (6 decimals)
- Result = CCs per $100,000 of deposit per week
```

### APY Annualization

```
APY = (totalWeeklyGlw × 52 / totalGlwPerFraction) × 100

This annualizes weekly GLW rewards relative to the GLW deposit.
```

### Per-Fraction Division

All "per fraction" metrics divide by `totalSteps`:

```typescript
const perFraction = totalValue / (application.activeFraction.totalSteps || 1);
```

---

## Disclaimer Context

The disclaimer emphasizes:

1. **Expectation-Based System**

   - Rewards based on audited projections, not actual output
   - Protects from weather/operational risk
   - Maintains competitive pressure on farm construction quality

2. **Risk Factors**

   - Regional competitiveness (relative to other farms)
   - GLW price appreciation (not guaranteed)
   - Network growth (dilution of emissions)

3. **Protection**

   - Deposit recovery continues per projections regardless of actual farm output
   - Eliminates tail risk from equipment failure
   - Focuses competition on lifetime impact, not short-term performance

4. **Competitive Context**
   - Farms compete only within their region
   - Performance measured vs regional average
   - Above-average: Surplus capture
  - Below-average: Partial forfeitures offset by GLW emission rewards

---

## Audit Fields Explained

### `netCarbonCreditEarningWeekly`

- **Source:** Farm audit process
- **Basis:**
  - Satellite baselines
  - Historical weather patterns
  - Local grid carbon intensity
  - Pre-construction engineering studies
- **Usage:** Expected weekly carbon displacement over farm lifetime
- **Note:** This is a **projection**, not measured output

### Why Expectations vs Measurements?

From "Rewards with Great Expectations" article:

**Problem with performance-based:**

- Weather volatility creates income instability
- Regional clustering amplifies luck-based rewards
- Shifts focus to sunny regions vs carbon-intensive grids

**Solution with expectation-based:**

- Fixed projections eliminate weather risk
- Competition focuses on construction decisions (location, equipment)
- Protects from tail risk (equipment failure)
- Aligns builders, capital, and climate buyers on predictable long-term projections

---

## Regional Metrics Deep Dive

### Sponsored Farms vs Applications

**Sponsored Farms (`sponsoredFarms`):**

- Status: "completed" - Live and operational
- Earning: GLW tokens actively
- Contributing: To regional carbon credits
- Counted in: Active Farms, Total PDs, Regional Efficiency

**Solar Farm Applications (`solarFarmApplications`):**

- Status: "audit_fees_paid" - In construction/onboarding
- Not yet: Earning GLW or producing
- Counted in: Farms on Deck
- Awaiting: Completion and delegation fulfillment

### Regional Efficiency Score

```typescript
// Backend calculates:
const farms = region.sponsoredFarms
const totalCC = farms.reduce(sum of expectedWeeklyCarbonCredits)
const totalPD = farms.reduce(sum of protocolDepositUSDC6Decimals)
const regionalEfficiency = (totalCC / totalPD) × adjustment_factor
```

Stored in: `RegionWithMetadata.efficiencyScore`

---

## Competitive Dynamics

### Deposit Recovery Mechanism

```
Week N Performance Measurement:
─────────────────────────────────
For each farm in region:
  efficiency = carbonCreditsProduced / electricityRevenue

Regional average = mean(all farm efficiencies)

Rewards distribution:
  Above average → Recover deposit + surplus from below-average
  Average → Recover exactly original deposit
  Below average → Partial recovery + forfeit to above-average
```

### GLW Emission Rewards Cushion

- Farms earn GLW regardless of competitive standing
- Less competitive farms offer higher GLW % to delegators
- Offsets deposit forfeitures for moderately underperforming farms
- Creates viable economics even for slightly below-average farms

---

## APY Assumptions & Limitations

### What APY Includes

✅ Current weekly GLW emissions  
✅ Expected deposit recovery rate  
✅ Annualization to yearly rate  
✅ Includes principal recovery (deposit)

### What APY Doesn't Include

❌ Future farm additions (dilution)  
❌ GLW price appreciation/depreciation (affects USD value, not GLW APY)  
❌ Changes in regional competitiveness  
❌ Network growth effects  
❌ GCTL staking changes (affects regional allocation)

### Conservative vs Optimistic

The APY is **neither** - it's a snapshot:

- Uses current conditions
- Assumes stasis (no change)
- Reality: Network will grow (dilution) AND GLW may appreciate
- Net effect depends on whether price appreciation exceeds emission dilution

---

## Disclaimer Context

### Main Message

> "Expectation-based rewards: Returns are calculated based on expected lifetime carbon displacement audited at farm construction, not actual weekly performance."

### Key Points

1. **Protection:** Weather volatility and operational risk absorbed by protocol
2. **Competition:** Focused on maximum climate impact (location, equipment, quality)
3. **Variability:** Actual returns depend on:
   - Regional competitiveness
   - GLW price appreciation
   - Network growth
4. **Guarantee:** Deposit recovery and GLW rewards continue per original projections regardless of farm output

### Why This Matters

- Traditional mining: Weather risk → income instability
- Glow approach: Eliminate operational risk → predictable financing
- Enables: Better capital allocation to high-impact solar
- Protects: Delegators from tail risk while maintaining competitive pressure

---

## Data Freshness

### Real-time

- `glwSpotPrice` - Market price
- `regionSummary.glwPerWeek` - Updated with staking changes

### Cached (30s)

- `regions` - Region metadata
- `activeSummary` - Regional staking summary
- `regionDetails` - Sponsored farms and applications

### Static (per application)

- `auditFields` - Set at farm audit, doesn't change
- `finalProtocolFee` - Fixed at application creation
- `activeFraction.step` - Predetermined delegation amount

---

## Related Documentation

- **Expectation-based rewards:** [Blog: Rewards with Great Expectations](https://glow.org/blog/rewards-with-great-expectations)
- **Delegation guide:** [Blog: A Guide to Delegating GLW](https://glow.org/blog/guide-to-delegating-glow)
- **Regional competition:** [Blog: Infrastructure Projects](https://glow.org/blog/infrastructure-projects)
- **Competitive redistribution:** [Blog: Sacrifice Your Revenue](https://glow.org/blog/sacrifice-your-revenue)
