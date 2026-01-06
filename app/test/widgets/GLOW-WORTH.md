## Glow Worth (definition)

Glow Worth is the wallet’s GLW-denominated “position” in the Glow system:

\[
\text{GlowWorth} = \text{LiquidGLW} + \text{DelegatedActiveGLW} + \text{UnclaimedGLWRewards}
\]

Where:

- **LiquidGLW**: ERC20 GLW `balanceOf(wallet)` (onchain).
- **DelegatedActiveGLW**: the wallet’s **vault ownership** share of remaining **GLW protocol-deposit principal** for completed farms (see below).
- **UnclaimedGLWRewards**: finalized GLW rewards that exist for the wallet but have not been claimed on-chain yet.

---

## DelegatedActiveGLW (vault ownership model)

This widget sources Glow Worth from the backend `GET /impact/glow-worth` endpoint, which models delegated value as the wallet’s share of remaining GLW protocol-deposit principal:

- For each farm \(f\):
  - `principalPaidGlwWei(f)`: sum of GLW-paid completed applications for that farm (DB `applications.paymentAmount` where `paymentCurrency=GLW` and `status=completed`)
  - `distributedGlwWeiToWeek(f, week)`: cumulative farm distributions from Control API weekly rewards where `paymentCurrency=GLW`
  - `remainingGlwWei(f, week) = max(0, principalPaidGlwWei(f) - distributedGlwWeiToWeek(f, week))`
  - `walletSplit6(f, week)`: wallet ownership (`depositSplitPercent6Decimals`) from Control API deposit split history
  - `walletShareRemainingGlwWei(f, week) = remainingGlwWei(f, week) * walletSplit6(f, week) / 1_000_000`
- Then: `DelegatedActiveGLW(week) = sum_farms walletShareRemainingGlwWei(f, week)`

Important nuances:

- Buying a **miner** does **not** increase `DelegatedActiveGLW` (miners do not participate in protocol-deposit vaults).
- Buying a **delegation** can take time to reflect in `DelegatedActiveGLW`:
  - If the farm isn’t completed yet (auction not filled / not finalized), `principalPaidGlwWei(f)` is still 0 → your vault share is 0.
  - Once the application is completed and the Control API reflects your split history, `DelegatedActiveGLW` will reflect your ownership for the relevant week.

---

## UnclaimedGLWRewards

Unclaimed rewards are **week-based** and only become claimable after finalization windows (inflation ~3 weeks, protocol deposit ~4 weeks). This means new rewards from a miner purchase or delegation will not show up in `UnclaimedGLWRewards` immediately.

## “If I just bought X, does Glow Worth update now?”

- **Bought / received GLW**: yes, `LiquidGLW` updates immediately (onchain).
- **Bought a miner (USDC)**: typically **no immediate Glow Worth change** (doesn’t move GLW); miner rewards show up later as week-based rewards and then only after finalization.
- **Bought a delegation (paid in GLW)**:
  - `LiquidGLW` will change immediately (you spent GLW).
  - `DelegatedActiveGLW` increases only once the farm is completed and your split history is reflected for the queried week range (can be delayed relative to the purchase).

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
