# PoL Dashboard - Metric Computation Specs (Tightened Draft)

This spec is a **working draft**. It codifies what we can say today, flags gaps,
and separates **decisions** from **implementation**. Treat any **Open** item as
blocking for final correctness.

**Frontend implementation rule:** keep the **existing UI/layout** in
`app/internal/pol/view.tsx`. The task is **data wiring only** (replace mock data
and TODOs with live sources). Do **not** redesign or remove sections.

Primary narrative: **Protocol-Owned Liquidity (PoL)**. All PoL metrics are
**liquidity-denominated (lq)** with a small USD/GLW breakdown in parentheses.

Example display:

```
1,000 lq  ($500 / 2,000 GLW)
```

---

## Definitions & Conventions

### 1) lq (liquidity units)

`lq = sqrt(usdg * glw)` using the **GLW/USDG pool reserves** or a synthetic
50/50 split derived from USD value.

Notes:

- lq is **not additive** across different pools. If we sum positions, we must
  **sum USDG + GLW reserves first**, then compute lq, **or** show per-position
  lq and sum as a **display-only approximation**.
- If we do synthetic lq from USD value, it is **display-only** and should be
  labeled as such.

### 2) PoL (Protocol-Owned Liquidity)

PoL includes **protocol-owned** GLW/USDG liquidity positions only. **External
LPs are not PoL.** For this dashboard, PoL = **endowment + bot active**.

### 3) CCs / ICs

CCs = carbon credits; ICs = impact credits (audit-reported).

### 4) Time windows / weeks

We need one canonical "week" for charts and rollups.

Week boundary: **Protocol week derived from genesis timestamp**.

- `GENESIS_TIMESTAMP = 1700352000`
- `week = floor((timestamp - GENESIS_TIMESTAMP) / 604800)`
- Current implementations in this repo and CRM use this formula directly.
- In UTC this genesis is Saturday 16:00:00, so boundaries are every 7 days from that anchor.

All "Quarterly" metrics are **13 weeks**.

---

## Decision Log

### Resolved

1) **Smoothing window** for miner-sale PoL & GCTL mint attribution:
   **13 weeks** (closest to 90 days).

2) **GCTL mint/yield attribution model**:
   - **Region**: by GCTL staked.
   - **Farm**: by CCs/ICs (not PD).

3) **PoL revenue scope**:
   - **Yield** is *only* bot trading gains (rebalance) + Uniswap fees.
   - **DCA/deposits/capital flows** are not yield.
   - **Miner sales** count toward PoL **immediately at sale time**.
   - **Bounties** are deducted from miner sales before PoL attribution.

4) **Circulating supply** canonicalization:
   - Base from Ponder `/glow/circulating` (`row.circulating_wei`).
   - Replace Ponder vaulted term with CRM delegated-by-week for the same week.
   - Formula:
     `canonicalCirculatingWei = row.circulating_wei + row.breakdown.vaulted_delegated_wei - delegatedByWeekWei`.
   - Clamp at zero if needed.

5) **Displayed circulating/market-cap week**:
   - Current UI path uses latest row from `range=1w&includePartialWeek=true`.
   - If partial week exists, current circulating/market cap can be partial-week anchored.
   - Annualized growth remains completed-week anchored.

6) **Supply slider model**:
   - Use **xy = k**
   - Slider floor at **circulating = 0**
   - Slider ceiling at an **equal number of orders of magnitude larger**

7) **Homes powered + trees**:
   - Use the **same constants** as the user wallet stats.

8) **FDV**:
   - Use the full token supply (see Section 12).

9) **FMI status**:
   - Widget implementation exists, but is currently hidden in the main PoL page.
   - Data path currently uses a transitional CRM+Ponder hybrid adapter.

### Open / Needs Review

A) **Week anchor alignment**:
   - Current circulating display can be partial-week anchored.
   - Annualized growth is completed-week anchored.

B) **FMI integration**:
   - Widget is currently hidden in the main PoL page.
   - API path is currently hybrid CRM+Ponder.

---

## Core Formulas (Display)

### A) lq from USD value (synthetic)

```
usdgSide = totalUsd / 2
glwSide  = usdgSide / glwSpotPrice
lq       = sqrt(usdgSide * glwSide)
```

### B) lq from pool reserves (actual)

```
lq = sqrt(usdgReserve * glwReserve)
```

### C) USD/GLW breakdown (display only)

```
usdgSide = totalUsd / 2
glwSide  = usdgSide / glwSpotPrice
display  = "$${usdgSide} / ${glwSide} GLW"
```

Use **spot price** for display breakdowns (not EDGAP).

---

## Section 1: Banner (Row 1)

### 1.1 Market Cap

- **Definition**: `marketCap = glwSpotPrice * circulatingSupply`
- **Data sources**:
  - `glwSpotPrice`: `useGlowSpotPrice` (on-chain GLW/USDG pool spot).
  - `circulatingSupply`: `useGlowCirculatingSupply` (Ponder `/glow/circulating`
    plus CRM delegated-by-week override).
- **Current as-of behavior**:
  - Uses latest row from `range=1w&includePartialWeek=true`.
  - If a partial current-week row exists, that row is used for display.
  - This differs from annualized growth, which intentionally uses completed weeks.

### 1.2 GLW Price

- **Definition**: Spot price from main GLW/USDG pool.
- **Data source**: On-chain pool (Uniswap).
- **Status**: Live (`useGlowSpotPrice`).

### 1.3 Total PoL (lq)

- **Definition**: Protocol-owned GLW/USDG liquidity across all protocol
  positions, expressed in lq.
- **Data sources**: Ponder `/pol/summary` (endowment + bot active).

---

## Section 2: Aggregate Farm Revenue (Row 2, Left)

Narrative: "Each farm contributes to protocol-owned liquidity."
All values are **lq** with USD/GLW breakdown.

### Revenue Components (per farm)

#### A) Miner Sales PoL

```
polFromMinerSales = minerSalesRevenue - bountyPaidToFarm
recognizedWeekly = polFromMinerSales / smoothingWindowWeeks
```

Notes:

- Smoothing window is **13 weeks**.
- Miner sales are **counted immediately** (no deposit gating).

**Data source**: CRM pipeline (fractions ledger + bounties table).

#### B) GCTL Mint Attribution (PoL)

Minting introduces protocol capital (USDG) and should be recognized as PoL.
We **spread** the mint value over the smoothing window.

```
recognizedWeekly = mintUsd / smoothingWindowWeeks
```

**Attribution**:
- Allocate to **region** by GCTL staked.
- Allocate to **farm** within region by CCs/ICs (not PD).

**Data sources**: Control API mint events + staking totals (via CRM).

#### C) GCTL Yield Attribution (PoL)

Yield sources (all yield):

1. Bot trading gains (off-chain logs)
2. Uniswap fees (on-chain)

**Data sources**: Ponder PoL yield (rebalance + Uni fees) via CRM.

#### Farm Attribution Formula (placeholder)

```
farmRevenue = minerSalesComponent(farm)
           + gctlMintComponent * farmShare
           + gctlYieldComponent * farmShare
```

`farmShare` is defined by the region-stake + CC/IC attribution rule above.

### 2.1 Lifetime Revenue

- **Definition**: Sum of all recognized weekly PoL contributions for the farm
  across lifetime.
-- **Status**: Available via CRM `/pol/revenue/*`.

### 2.2 Active Farms

- **Definition**: Farms with active protocol deposits (PD > 0) and not fully
  unwound.
- **Data sources**: Control API farm registry or CRM farms endpoint.
- **Status**: Available via CRM `/pol/revenue/aggregate` (PD > 0).

### 2.3 Quarterly Trailing PoL Growth

- **Definition (headline KPI: "Quarterly Trailing PoL Growth")**: Delta in total PoL
  liquidity between **now** and **13 weeks ago**.

  ```
  trailingRevenueLq = totalPolLq(now) - totalPolLq(13w_ago)
  ```

  Notes:
  - This is a **stock delta** computed from PoL snapshots (Ponder), not the
    CRM-recognized attribution flow.
  - CRM quarterly revenue is still used for **per-farm** / **per-region** attribution,
    but should not be expected to match `Δ total PoL` due to smoothing and lq
    non-linearity.

-- **Status**: Available via Ponder PoL snapshots.

### 2.4 Quarterly PoL Yield

- **Definition**: Sum of **yield only** (bot trading gains + Uniswap fees)
  over the last **13 weeks**.

---

## Section 3: Supply & Circulation (Row 2, Right)

### 3.1 Current Circulating Supply Path

Current UI path (`useGlowCirculatingSupply`) does:
- Spot price from `useGlowSpotPrice` (on-chain GLW/USDG pool).
- Snapshot from `useGlowCirculatingSnapshot({ range: "1w", includePartialWeek: true })`.
- Picks the latest row in that 1-week series.
- Fetches CRM delegated-by-week for that same row week.
- Derives circulating with delegated override:

```
adjustedCirculatingWei =
  row.circulating_wei
  + row.breakdown.vaulted_delegated_wei
  - delegatedByWeekWei
```

This replacement avoids double-subtraction when `vaulted_delegated_wei` is
present in Ponder rows.

### 3.2 Displayed Week Policy (Current)

Current display behavior for banner + Supply & Circulation card:
- Uses latest row from `range=1w&includePartialWeek=true`.
- If partial current-week data exists, UI shows partial-week circulating.

Annualized Circulating Supply Growth uses a different policy:
- End week is `currentEpoch - 1` (latest completed week).
- Start week is `endWeek - 13`.

So "current circulating" and "annualized growth window end" are intentionally on
different week anchors today.

### 3.3 Annualized Growth Normalization (Current Code)

Current annualized growth in `app/internal/pol/view.tsx`:

1) Pulls on-chain circulating rows from Ponder for `startWeek` and `endWeek`
   and delegated-by-week from CRM for those weeks.

2) Builds raw canonical points:

```
canonicalStartRaw = onchainStart - delegatedStart
canonicalEndRaw   = onchainEnd - delegatedEnd
```

3) Applies synthetic veto accrual only when veto balance is unchanged:

```
syntheticVetoAccrual = vetoUnchanged ? 5_000 * elapsedWeeks : 0
canonicalEnd = canonicalEndRaw - syntheticVetoAccrual
```

4) Normalizes miner inflation to exactly 175k/week:

```
observedTotalSupplyDelta = totalSupplyEnd - totalSupplyStart
expectedMinerDelta       = 175_000 * elapsedWeeks
mintResidualCarryover    = observedTotalSupplyDelta - expectedMinerDelta
canonicalStart           = canonicalStartRaw + mintResidualCarryover
```

5) Computes growth:

```
trailing13w = canonicalEnd / canonicalStart - 1
annualized  = (1 + trailing13w)^(52/13) - 1
```

Important implementation caveat:
- The annualized path currently subtracts CRM delegated directly from
  `circulating_wei` and does not add back `row.breakdown.vaulted_delegated_wei`
  first. This is safe with current data (`vaulted_delegated_wei = 0`) but should
  be kept in mind if Ponder starts populating non-zero vaulted values.

### 3.4 Real Worked Example (As of February 13, 2026)

Protocol week context on February 13, 2026:
- `currentWeek = 116` (partial row exists)
- `completedWeek = 115`

Displayed circulating today (current UI path; partial week):

```
onchainCirculating(116) = 23,796,774.472425107
snapshotVaulted(116)    = 0
delegatedByWeek(116)    = 2,484,459.260955068

displayCirculating(116) =
  23,796,774.472425107 + 0 - 2,484,459.260955068
  = 21,312,315.21147004 GLW
```

Latest completed-week canonical point (used by annualized end row):

```
onchainCirculating(115) = 23,840,309.54388904
delegatedByWeek(115)    = 2,390,110.013710367
canonicalRaw(115)       = 21,450,199.53017867 GLW
```

Annualized normalization example (weeks 102 -> 115):
- `elapsedWeeks = 13`
- `canonicalStartRaw = 20,887,855.023693264`
- `canonicalEndRaw = 21,450,199.53017867`
- veto unchanged => `syntheticVetoAccrual = 65,000`
- `canonicalEnd = 21,385,199.53017867`
- `observedTotalSupplyDelta = 2,368,066.071428575`
- `expectedMinerDelta = 2,275,000`
- `mintResidualCarryover = 93,066.071428575`
- `canonicalStart = 20,980,921.09512184`
- `trailing13w = 1.9268860181302028%`
- `annualized = 7.933192967803504%`

### 3.5 Supply Breakdown Bar (Current)

Current donut/bar composition in the card:
- **Circulating**: `currentCirculating` from `useGlowCirculatingSupply`.
- **Vaulted**: `useTotalActivelyDelegated().totalGlwDelegatedWei` (current total).
- **PoL GLW**: `polSummary.endowment.glw + polSummary.botActive.glw`.
- **Structurally Locked**: `totalSupply - circulating - vaulted - polGlwInPol`.

This is a live mixed-source composition, not a strict single-row weekly snapshot.

### 3.6 Vaulted (MiniStat, Current)

- **Definition**: current total actively delegated GLW.
- **Data source**: CRM `/fractions/total-actively-delegated` (via `/api/fractions/total-actively-delegated`).

### 3.7 PoL GLW (MiniStat, Current)

- **Definition**: GLW held in protocol-owned PoL positions.
- **Data source**: Ponder `/pol/summary` (`endowment.glw + botActive.glw`).

### 3.8 Weekly Net Change

- Not currently rendered as a dedicated circulating-supply line chart.
- Related trend shown today is annualized growth over a completed 13-week window.

---

## Section 4: Per-Farm Revenue Cards (Row 3)

Purpose: Make each farm feel like it **adds real PoL** to the protocol.
No stacked charts; use clean cards and optional detail view.

Fields:

- Name, Region, Panels, Image (from farm registry / audit data).
- Lifetime revenue (lq).
- Quarterly revenue (lq).
- Quarterly delta (% change over trailing 13-week vs previous 13-week window).
- Carbon credits (cc/week and lifetime).

Status: **Available** via CRM `/pol/revenue/farms`.

---

## Section 5: Network Impact (Row 4)

Aggregate impact across all farms.

Current implementation source:
- `useImpactMetrics` -> `/api/impact-metrics` -> `https://glow.org/api/impact-metrics`.
- Values are consumed as precomputed aggregates (not recomputed in this page).

### 5.1 Total Panels

Current value comes from `impactMetrics.solarPanelsInstalled`.

### 5.2 Energy / Year

Current value comes from `impactMetrics.totalWatts` and is displayed as MW.

### 5.3 Homes Powered

Current value comes from `impactMetrics.homesPowered`.

### 5.4 Trees Equivalent

Current value comes from `impactMetrics.adultTreesEquivalent`.

---

## Section 6: Protocol Liquidity Card

### 6.1 Total PoL (lq)

Displayed as **Embedded Liquidity**.

- Source: `usePolSummary().total.lq`
- Breakdown shown as `$USDG / GLW` from `polSummary.total.breakdown`.

### 6.2 PoL APY

Source: CRM `/pol/revenue/aggregate` → `ninety_day_apy`.

Frontend handling:
- If APY is fractional (`0 < apy < 2`), multiply by 100.
- Otherwise treat as an already-percent value.

### 6.3 Yield / Week

Current UI label is **3 Month Yield** (not per-week).

- Source: CRM `/pol/revenue/aggregate` → `ninety_day_yield_lq`.
- Displayed with USD/GLW breakdown using current spot price.

### 6.4 Pool Depth (USD)

Used in helper paths, not shown as a primary card metric:

`poolDepth = usdgReserve + glwReserve * spotPrice`

### 6.5 Market Cap Exitable

Displayed as `% of market cap exitable through current PoL`.

Model in code:

```
x = polUSDG
y = polGLW
k = x * y
yAfter = y + circulatingSupply
xAfter = k / yAfter
usdOut = max(0, min(x, x - xAfter))
exitablePct = usdOut / marketCap
```

### 6.6 PoL Trend Chart

- Source: CRM `/pol/liquidity` weekly series.
- Frontend currently drops the last returned point before plotting (`slice(0, -1)`).

---

## Section 7: GCTL Card

Live via existing hooks:

- Total GCTL supply: `useGctlApi()`
- GCTL mint price: `useGctlApi()`
- Staked vs unstaked: `useActiveRegionsSummary()`
- Staking by region (pie): `useActiveRegionsSummary()`
- Holders count: `useGctlHolders()`

---

## Section 8: Wallet Stats Card

### 8.1 Total Wallets

Use `GET /impact/wallet-stats` → `totalWallets` (leaderboard-eligible wallet
count, excludes internal/team wallets).

Implementation note:
- Frontend applies defensive fallbacks for key names and computes
  `protocolParticipants` with fallback to `max(delegators, miners, gctlHolders)`
  if explicit participant count is missing.

### 8.2 Delegator Count

Use `GET /impact/wallet-stats` → `delegators` (active vault ownership shares).

### 8.3 New Wallets / Week

Use `GET /impact/new-wallets-by-week` (protocol week). New wallet = first week
with **any protocol activity**, including:

- fraction purchase (fraction splits)
- reward split inclusion (rewardsSplitsHistory)
- GCTL stake (Control API stake-by-epoch)
- GLW balance snapshot **> 0.01 GLW** (end-of-week snapshot)

Exclude internal/team wallets.

### 8.4 Wallet Breakdown

Definitions required to avoid overlap:

- Delegator: has active vault ownership shares.
- Miner: any **mining-center** fraction purchase (filled or expired) up to the
  current week (not “active multiplier” only).
- GCTL holder: non-zero stake (or holder count from Control API).

Decision: if a wallet qualifies for multiple categories, do we:

- count in multiple categories, or
- choose a precedence order?

---

## Section 9: Delegation Metrics

### 9.1 GLW Delegated

Use CRM `GET /fractions/total-actively-delegated` (via
`/api/fractions/total-actively-delegated`).

### 9.2 Delegators Count

Use CRM data (wallets with active vault bonus).
Avoid reusing capped leaderboard counts.

### 9.3 Est. APY

Current source is `averageDelegatorApy` from
`GET /fractions/total-actively-delegated?includeApy=true` (same endpoint family).

Frontend handling:
- If `0 < apy < 2`, convert to percent (`apy * 100`).
- Else treat as already-percent.

### 9.4 Delegation Growth vs APY

Current chart is delegated GLW by week only (from
`/fractions/actively-delegated-by-week`), with current-week live point appended.
APY is displayed as a separate scalar metric.

### 9.5 Delegation Ratio

Current UI computation:

`delegationRatio = totalDelegatedNow / currentCirculatingNow * 100`

Where:
- `totalDelegatedNow` = current total from `/fractions/total-actively-delegated`
- `currentCirculatingNow` = current displayed circulating from
  `useGlowCirculatingSupply` (latest row from `includePartialWeek=true`)

---

## Section 10: Per-Region Revenue Table

Same attribution rules as Section 2 & 4. Available via CRM `/pol/revenue/regions`.

Fields:

- Region name (active regions summary)
- Lifetime revenue (lq)
- Quarterly revenue (lq)
- CC/week
- Farm count
- GCTL staked

---

## Section 11: FMI (Flywheel Market Index)

Current UI status:
- FMI is **temporarily hidden** in `app/internal/pol/view.tsx`.
- Widget exists in `app/internal/pol/fmi-widget.tsx` and can be re-mounted.

Current API behavior (`/api/fmi-pressure`) is transitional:
- Prefers CRM `/fmi/pressure` for latest completed-week **sell** pressure input.
- Derives **buy** from Ponder `/fmi/sell-pressure` week-matched DEX buy bucket.
- Falls back to Ponder liquidity-positions pressure payload when CRM is unavailable.

So FMI data path is currently a CRM+Ponder hybrid, not pure CRM-only.

---

## Section 12: Unlock / FDV

### 12.1 FDV

FDV should use the full token supply:

`fdv = glwSpotPrice * 180,000,000`

### 12.2 Vesting Schedule

Current API path (`/api/glw-vesting-schedule`) does:
- Prefer CRM `/glw/vesting-breakdown` (JSON, category-level breakdown).
- Fallback to CRM `/glw/vesting-schedule` (date/unlocked rows).
- Frontend accepts JSON or CSV payloads and normalizes to yearly chart points.

---

## Section 13: Supply Model Explorer (Dialog)

Purpose: **illustrative model** showing how circulating supply and USDG liquidity
move with price. Not a live on-chain simulation.

### 13.1 Price Slider

Log scale from $0.001 to $100 (CEO request).

### 13.2 Modeled Circulating Supply

Model: **xy = k**.

Candidate constraints:

- `circulating(P0) = currentCirculating`
- `circulating(Pfloor) = 0`
- `circulating` increases with price.

Implementation note: use current **Uniswap reserves** from `usePoolInfo` and
current **PoL balances** from Ponder `/pol/summary` to compute
`total_usdg`, `total_glw`, and `k`.

### 13.3 Modeled USDG Liquidity

Should increase with price. If using xy=k, USDG side scales with `sqrt(price)`.
Must be derived from the same model as circulating.

### 13.4 What NOT to show (per CEO)

- Market cap
- Locked supply
- Protocol liquidity (PoL)

Only show: **circulating supply** and **USDG liquidity** as price changes.

---

## Data Source Map (Current Reality)

Frontend should **only consume APIs** (no new on-chain math in UI beyond
existing hooks). Current sources:

Ponder (via Next API proxy):
- `/pol/summary` (endowment + bot active balances, total PoL lq)
- `/glow/circulating` (weekly on-chain circulating components)
- `/pol/snapshots` (PoL liquidity snapshot series used in annualized growth)

CRM (via Next API proxy):
- `/pol/revenue/aggregate`, `/pol/revenue/farms`, `/pol/revenue/regions`
- PoL revenue `*_lq` values, including weekly series fields like `total_lq`, `miner_sales_lq`, `gctl_mints_lq`, and `pol_yield_lq`, are raw LQ atomic units with 12 decimals. Divide by `1e12` for display.
- `/pol/liquidity` (12-week PoL liquidity series derived from Ponder `/pol/points`)
- `/fmi/pressure` (latest completed week; currently consumed through hybrid adapter)
- `/glw/vesting-schedule`
- `/glw/vesting-breakdown`
- `/fractions/total-actively-delegated`, `/fractions/actively-delegated-by-week`

CRM (direct hub client from browser, not Next proxy):
- `/impact/wallet-stats`
- `/impact/new-wallets-by-week`

External API:
- `https://glow.org/api/impact-metrics` via `/api/impact-metrics`

On-chain (existing hooks only):
- `usePoolInfo` for current Uniswap reserves (supply model explorer)
- `useGlowSpotPrice` for real-time price

Canonical circulating supply pipeline:
- `Ponder /glow/circulating` + `CRM /fractions/actively-delegated-by-week`
- UI display currently uses latest `includePartialWeek=true` row
- Annualized growth uses completed-week windows and additional normalization

---

## Current Follow-Ups

1. Align displayed circulating/market-cap week policy with annualized growth if
   product wants one shared week anchor.
2. Unhide FMI widget and finalize a single-source FMI contract (remove hybrid
   adapter behavior in `/api/fmi-pressure`).
3. Consider consolidating circulating normalization into one shared utility used
   by both display path and annualized growth path.
