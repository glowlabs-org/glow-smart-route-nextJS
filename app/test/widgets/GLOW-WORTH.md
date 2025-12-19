## Glow Worth (definition)

Glow Worth is the wallet’s GLW-denominated “position” in the Glow system:

\[
\text{GlowWorth} = \text{LiquidGLW} + \text{DelegatedActiveGLW} + \text{UnclaimedGLWRewards}
\]

Where:

- **LiquidGLW**: ERC20 GLW balance of the wallet.
- **DelegatedActiveGLW**: the portion of GLW currently “net locked” into delegations.
- **UnclaimedGLWRewards**: finalized GLW rewards that exist for the wallet but have not been claimed on-chain yet.

---

## DelegatedActiveGLW (netted)

We treat “no longer delegated” as **returned protocol deposit** on launchpad farms.

Definitions (all in GLW):

- **DelegatedGrossGLW** = \(\sum \text{launchpad amountInvested}\) + `delegatedAfterWeekRange.totalGlwDelegatedAfter`
- **ReturnedDepositGLW** = \(\sum \text{launchpad totalProtocolDepositRewards}\)
- **DelegatedActiveGLW** = \(\max(0, \text{DelegatedGrossGLW} - \text{ReturnedDepositGLW})\)

Source: `useRewardsBreakdown()` payload (launchpad farms only).

---

## UnclaimedGLWRewards

We compute unclaimed GLW rewards by:

1. Fetching per-week claimable rewards via `useClaimableRewards(walletAddress)`.
2. For each **finalized** week that contains GLW rewards, checking on-chain claim status:
   - **Inflation claim**: `checkIfGlwClaimed(week + 1, walletAddress)`
   - **Protocol deposit claim (v2)**: `checkIfClaimed(walletAddress, weekToNonce(week))`
3. Summing only the GLW amounts that are not yet claimed for each category.

This mirrors the claim status logic used in `app/wallet/claims-panel.tsx`.

---

## UI / loading states (`net-worth.tsx`)

The widget has 4 user-visible states:

- **Disconnected**: the card is blurred/disabled and shows a connect CTA.
- **Connecting / reconnecting**: show a full-card skeleton while wagmi is
  `isConnecting` or `isReconnecting` (prevents “0 GLW” flashes during connect).
- **Empty state**: connected, finished loading, no errors, and `GlowWorth <= 0`.
- **Loaded**: connected and data resolved.

Data required for Glow Worth is fetched from multiple sources, so the loading
state is derived from a combination of:

- `useWalletTokenBalances(walletAddress)` (liquid GLW + stablecoin balances)
- `useRewardsBreakdown({ walletAddress })` (delegations + farm reward history)
- `useClaimableRewards(walletAddress)` + on-chain claim checks (unclaimed GLW)
- `useWalletSwaps(walletAddress)` (GLW swap history for the chart)

---

## 13-week Glow Worth chart (weekly)

The chart in `net-worth.tsx` shows an estimated Glow Worth history for the last ~13 protocol weeks.

We compute weekly deltas as:

\[
\Delta \text{GlowWorth}_{week} = \text{GLWEarned}_{week} + \text{NetGLWSwaps}\_{week}
\]

- **GLWEarned_week**: sum of `farmDetails[].weeklyBreakdown[].totalRewards` across farms for that week.
- **NetGLWSwaps_week**: \(\sum (\text{glwOut} - \text{glwIn})\) of swaps bucketed into that week.

We then reconstruct the weekly series by starting from the current Glow Worth and “rolling back” by the cumulative deltas.

Note: delegations/claims do not directly change the _total_ GLW-denominated Glow Worth, they move GLW between buckets (liquid vs delegated vs unclaimed). The history chart focuses on sources/sinks that change the total over time (earned rewards + swaps).

---

## Chart scaling

To avoid large wallets appearing “flat” for small weekly changes, the Y-axis domain is derived from the chart data range \((\max - \min)\) with a small padding. This makes the graph scale relative to each wallet’s fluctuation magnitude.

---

## Weekly “accumulated this week” badge

The “accumulated this week” badge is a convenience indicator derived from
`useRewardsBreakdown()`:

- For each farm, look at `farm.weeklyBreakdown`.
- Find the **latest weekNumber** present across all farms and sum the
  `totalRewards` for that week.

This represents the most recent week’s on-record GLW rewards (not necessarily
finalized or claimable yet).

---

## Spot price shown in header

The displayed GLW price uses:

- Primary: `useGlowCirculatingSupply().glowPrice` (if available and > 0)
- Fallback: `usePoolActivity("day", "hour").currentPrice` (24h VWAP)
