# PoL Dashboard - Metric Computation Specs (Tightened Draft)

This spec is a **working draft**. It codifies what we can say today, flags gaps,
and separates **decisions** from **implementation**. Treat any **Open** item as
blocking for final correctness.

Primary narrative: **Protocol-Owned Liquidity (PoL)**. All PoL metrics are
**liquidity-denominated (lq)** with a small USD/GLW breakdown in parentheses.

Example display:

```
1,000 lq  ($500 / 2,000 GLW)
```

---

## Definitions & Conventions

### 1) lq (liquidity units)

`lq = sqrt(usdc * glw)` using the **GLW/USDC pool reserves** or a synthetic
50/50 split derived from USD value.

Notes:

- lq is **not additive** across different pools. If we sum positions, we must
  **sum USDC + GLW reserves first**, then compute lq, **or** show per-position
  lq and sum as a **display-only approximation**.
- If we do synthetic lq from USD value, it is **display-only** and should be
  labeled as such.

### 2) PoL (Protocol-Owned Liquidity)

PoL includes **protocol-owned** GLW/USDC liquidity positions only. **External
LPs are not PoL.**

### 3) CCs / ICs

CCs = carbon credits; ICs = impact credits (audit-reported).

### 4) Time windows / weeks

We need one canonical "week" for charts and rollups.

Week boundary: **Protocol week (Sunday 00:00 UTC).** (Confirmed)

All "90d" metrics are **13 weeks**.

---

## Decision Log

### Resolved

1) **Smoothing window** for miner-sale PoL & GCTL mint attribution:
   **13 weeks** (closest to 90 days).

2) **GCTL mint/yield attribution model**:
   - **Region**: by GCTL staked.
   - **Farm**: by CCs/ICs (not PD).

3) **PoL revenue scope**:
   - **Yield** is *only* bot trading gains + Uniswap fees.
   - Miner sales are **not yield** until funds are added to the bot.

4) **Circulating supply** excludes:
   - Vaulted GLW
   - Grant tokens
   - Locked/vesting tokens
   - Tokens held by **bot** or **endowment** wallets

5) **Supply slider model**:
   - Use **xy = k**
   - Slider floor at **circulating = 0**
   - Slider ceiling at an **equal number of orders of magnitude larger**

6) **Homes powered + trees**:
   - Use the **same constants** as the user wallet stats.

7) **FDV**:
   - Exclude tokens in **PoL wallets**.

8) **FMI section**: **Keep** (requires heavy data pipeline).

### Open / Needs Review

A) **PoL APY display**: CEO needs to see the card before deciding.

B) **Delegator APY display**: show **on another card** (not PoL card).

C) **Vesting schedule breakdown**: awaiting updated source.

---

## Core Formulas (Display)

### A) lq from USD value (synthetic)

```
usdcSide = totalUsd / 2
glwSide  = usdcSide / glwSpotPrice
lq       = sqrt(usdcSide * glwSide)
```

### B) lq from pool reserves (actual)

```
lq = sqrt(usdcReserve * glwReserve)
```

### C) USD/GLW breakdown (display only)

```
usdcSide = totalUsd / 2
glwSide  = usdcSide / glwSpotPrice
display  = "$${usdcSide} / ${glwSide} GLW"
```

Use **spot price** for display breakdowns (not EDGAP).

---

## Section 1: Banner (Row 1)

### 1.1 Market Cap

- **Definition**: `marketCap = glwSpotPrice * circulatingSupply`
- **Data sources**: GLW pool price (spot), circulating supply (Section 3).
- **Status**: Blocked by circulating supply pipeline.

### 1.2 GLW Price

- **Definition**: Spot price from main GLW/USDC pool.
- **Data source**: On-chain pool (Uniswap).
- **Status**: Live if pool read wired.

### 1.3 Total PoL (lq)

- **Definition**: Protocol-owned GLW/USDC liquidity across all protocol
  positions, expressed in lq.
- **Data sources**: Protocol-owned LP positions (Uniswap NFT positions / vaults).
- **Status**: Needs explicit PoL position registry (and excludes external LPs).

---

## Section 2: Aggregate Farm Revenue (Row 2, Left)

Narrative: "Each farm contributes to protocol-owned liquidity."
All values are **lq** with USD/GLW breakdown.

### Revenue Components (per farm)

#### A) Miner Sales PoL

```
polFromMinerSales = minerSalesRevenue - bountyPaidToFarm
recognizedWeekly = polFromMinerSalesAddedToBot / smoothingWindowWeeks
```

Notes:

- Smoothing window is **13 weeks**.
- Miner sales are **not yield** until funds are added to the bot.

**Data source**: Off-chain foundation ledger (miner sales & bounties).

#### B) GCTL Mint Attribution (PoL)

Minting introduces protocol capital (USDC) and should be recognized as PoL.
We **spread** the mint value over the smoothing window.

```
recognizedWeekly = mintUsd / smoothingWindowWeeks
```

**Attribution**:
- Allocate to **region** by GCTL staked.
- Allocate to **farm** within region by CCs/ICs (not PD).

**Data sources**: On-chain mint events + staking targets.

#### C) GCTL Yield Attribution (PoL)

Yield sources (all yield):

1. Bot trading gains (off-chain logs)
2. Uniswap fees (on-chain)

**Data sources**: Bot PnL ledger + Uniswap fee accruals.

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
-- **Status**: Blocked by PoL revenue pipeline.

### 2.2 Active Farms

- **Definition**: Farms with active protocol deposits (PD > 0) and not fully
  unwound.
- **Data sources**: Control API farm registry or CRM farms endpoint.
- **Status**: Likely available; needs endpoint selection.

### 2.3 90d Revenue

- **Definition**: Sum of recognized weekly PoL contributions over last 13 weeks.
-- **Status**: Blocked by PoL revenue pipeline.

### 2.4 90d PoL Yield

- **Definition**: Sum of **yield only** (bot trading gains + Uniswap fees)
  over the last **13 weeks**.

---

## Section 3: Supply & Circulation (Row 2, Right)

### 3.1 Circulating Supply

Exclude:
- Vaulted GLW
- Grant tokens
- Locked/vesting tokens
- Tokens held by bot or endowment wallets
- Tokens in PoL wallets (by definition of bot/endowment/PoL custody)

```
circulating =
  totalSupply
  - vaultedGlw
  - grantTokens
  - lockedOrVestingGlw
  - botWalletGlw
  - endowmentWalletGlw
```

### 3.2 Supply Breakdown Bar

Segments should match the circulating definition. CEO specifically asked for:

- **Circulating**
- **Vaulted**
- **Liquidity** (protocol LP)

Avoid including "locked" in the slider (see Section 13), but it can appear in
this bar per the circulating definition.

### 3.3 Vaulted (MiniStat)

- **Definition**: GLW in protocol vaults (progressive vaults / protocol deposits).
- **Data source**: Vault contracts.

### 3.4 Liquidity (MiniStat)

- **Definition**: lq from main GLW/USDC pool reserves.
- **Data source**: On-chain pool reserves.

### 3.5 Weekly Net Change (Line Chart)

- **Definition**: `circulating[week] - circulating[week-1]`
- **Status**: Requires weekly snapshots using protocol-week boundary.

---

## Section 4: Per-Farm Revenue Cards (Row 3)

Purpose: Make each farm feel like it **adds real PoL** to the protocol.
No stacked charts; use clean cards and optional detail view.

Fields:

- Name, Region, Panels, Image (from farm registry / audit data).
- Lifetime revenue (lq).
- 90d revenue (lq).
- 90d delta (% change over trailing 13-week vs previous 13-week window).
- Carbon credits (cc/week and lifetime).

Status: **Blocked** until PoL revenue pipeline exists.

---

## Section 5: Network Impact (Row 4)

Aggregate impact across all farms.

### 5.1 Total Panels

`sum(panelCount)`
Source: GCA audit reports.

### 5.2 Energy / Year

`sum(expectedAnnualProductionPerFarm)`
Source: GCA audits (expected kWh/year).

### 5.3 Homes Powered

`annualMWh * 1000 / avgHomeConsumptionKwh`
Use the **same constants** as the user wallet stats.

### 5.4 Trees Equivalent

`annualMWh * co2PerMwh / co2PerTree`
Use the **same constants** as the user wallet stats.

---

## Section 6: Protocol Liquidity Card

### 6.1 Total PoL (lq)

Same as 1.3, but can show USD breakdown.

### 6.2 PoL APY

Open item (CEO review). If kept:

```
apy = annualYieldUsd / totalPolUsd * 100
```

Yield sources: Uniswap fees + bot trading gains.

### 6.3 Yield / Week

`weeklyYield = annualYield / 52`

### 6.4 Pool Depth (USD)

`poolDepth = usdcReserve + glwReserve * spotPrice`

### 6.5 PoL Sources Breakdown

Only include **protocol-owned** categories. External LP is **not PoL**.
Requires labeled treasury positions.

---

## Section 7: GCTL Card

Live via existing hooks:

- Total GCTL supply: `useGctlApi()`
- GCTL mint price: `useGctlApi()`
- Staked vs unstaked: `useActiveRegionsSummary()`
- Staking by region (pie): `useActiveRegionsSummary()`

---

## Section 8: Wallet Stats Card

### 8.1 Total Wallets

Use `GET /impact/wallet-stats` → `totalWallets` (leaderboard-eligible wallet
count, excludes internal/team wallets).

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

Prefer `GET /fractions/total-actively-delegated` (CRM backend).
Need to confirm if this represents **remaining principal** or **original**.

### 9.2 Delegators Count

Use CRM data (wallets with active vault bonus).
Avoid reusing capped leaderboard counts.

### 9.3 Est. APY

Prefer `GET /fractions/average-apy` from CRM backend.
Delegator APY should live on the **Delegation Metrics** card (not PoL card).

### 9.4 Delegation Growth vs APY

Requires weekly snapshots of total delegated + APY.
Implement as cron snapshot table.

### 9.5 Delegation Ratio

`totalDelegated / circulatingSupply * 100` (blocked by circulating supply pipeline).

---

## Section 10: Per-Region Revenue Table

Same attribution rules as Section 2 & 4 (blocked by PoL revenue pipeline).

Fields:

- Region name (active regions summary)
- Lifetime revenue (lq)
- 90d revenue (lq)
- CC/week
- Farm count
- GCTL staked

---

## Section 11: FMI (Flywheel Market Index)

Confirmed: **Keep** for v1, but requires a full pipeline for miner sales,
minting, LP fees, bot PnL, vesting unlocks, and trade flow analysis.

---

## Section 12: Unlock / FDV

### 12.1 FDV

`fdv = glwSpotPrice * (maxTotalSupply - polWalletGlw)`
Exclude tokens held in PoL wallets.

### 12.2 Vesting Schedule

Should be computed from vesting contracts (on-chain).
Current mock numbers must be verified.

---

## Section 13: Supply Model Explorer (Dialog)

Purpose: **illustrative model** showing how circulating supply and USDC liquidity
move with price. Not a live on-chain simulation.

### 13.1 Price Slider

Log scale from $0.001 to $100 (CEO request).

### 13.2 Modeled Circulating Supply

Model: **xy = k**.

Candidate constraints:

- `circulating(P0) = currentCirculating`
- `circulating(Pfloor) = 0`
- `circulating` increases with price.

### 13.3 Modeled USDC Liquidity

Should increase with price. If using xy=k, USDC side scales with `sqrt(price)`.
Must be derived from the same model as circulating.

### 13.4 What NOT to show (per CEO)

- Market cap
- Locked supply
- Protocol liquidity (PoL)

Only show: **circulating supply** and **USDC liquidity** as price changes.

---

## Data Source Map (Current Reality)

On-chain:

- GLW total supply
- GLW/USDC pool price + reserves
- Protocol LP positions
- GCTL price + supply
- Region staking totals
- Vault balances

CRM backend:

- Impact leaderboard counts
- Fractions summary + APY
- Active delegated GLW

Off-chain:

- Miner sales ledger
- Bounty payments
- Bot PnL ledger
- GCA audit reports (panels, production, carbon credits)

---

## Implementation TODOs

1. Implement PoL revenue pipeline (ledger ingestion + attribution + smoothing).
2. Build circulating supply weekly snapshot cron using the new definition.
3. Wire homes/trees constants to the same values as wallet stats.
4. Finalize supply slider math (xy=k) and ensure floor/ceiling are correct.
5. Build FMI pipeline (miner sales, minting, LP fees, bot PnL, vesting unlocks,
   trade flow analysis).
