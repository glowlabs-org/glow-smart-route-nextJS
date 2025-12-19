# Glow Impact Leaderboard (Impact tab) — Implementation Notes

This doc captures the **current behavior, constraints, and design decisions** for the **Glow Impact Leaderboard** implemented in `app/stats/rewards/impact-view.tsx`, with Impact Router data fetching centralized in `hooks/useImpactGlowScore.ts`, and the shared breakdown dialog in `components/dialogs/impact-score-breakdown-dialog.tsx`.

## What this feature is

- **A status-only leaderboard**: it explains _why_ a wallet ranks where it does, and what it could do _now_ to improve.
- **Data source**: Impact Router public endpoints:
  - `GET /impact/glow-score` (leaderboard list or single-wallet breakdown)
  - `GET /impact/glow-worth` (not directly used by the Impact tab UI today, but part of the conceptual model)
- **UI entry point**: `app/stats/rewards/view.tsx` has `Impact` as the default tab.

## Core UX rules (must preserve)

- **No shadows**: do not use `shadow-*` utilities anywhere in the feature.
- **Theme-aware**: use tokens (`bg-background`, `bg-muted`, `border-border`, etc.) and avoid hard-coded “dark-only” palettes unless behind `dark:` and intentionally scoped.
- **Border radii**: keep existing rounded sizes as-is (don’t change the overall rounding language).
- **Rank display rule**:
  - Only **Top 3** show numeric rank (`#1`, `#2`, `#3`).
  - Everyone else shows **percentile only** (e.g. `Top 5%`).
- **Percentiles must be based on global data**, not filtered results.
  - Filtering/search should not change the percentile computation.
- **Leaderboard is paginated client-side** (currently 50 per page) and search uses URL state via `nuqs`.
- **ENS support**: wallet search and rendering should support ENS names.

## Impact Router contract (frontend usage)

### Concepts

#### Glow Worth

\[
\\text{GlowWorth} = \\text{LiquidGLW} + \\text{DelegatedActiveGLW} + \\text{UnclaimedGLWRewards}
\]

#### Glow Impact Score

For each week in the requested range:

- Rollover points:
  - **Inflation earned**: +1.0 per GLW
  - **Steering (GCTL)**: +3.0 per GLW “steered”
  - **Vault bonus**: +0.005 per week per GLW in delegated active GLW
- Weekly multiplier:
  - **Cash miner bonus**: 3× multiplier if miner purchase that week
- Continuous points:
  - +0.001 per week per GLW of GlowWorth

### Endpoints

#### `GET /impact/glow-score`

Two shapes based on whether `walletAddress` is supplied.

**1) Leaderboard/list** (omit `walletAddress`)  
The list response is used by `ImpactView` for the table and for computing global percentile for listed wallets.

Fields used by the UI:

- `walletAddress`
- `totalPoints`
- `glowWorthWei`
- `composition` (for “strategy” pill)
  - `steeringPoints`, `inflationPoints`, `worthPoints`, `vaultPoints`
- `lastWeekPoints` (table column “Last week”)
- `activeMultiplier` (used for strategy/bonus logic; the explicit “3×” table column was removed)
- `weekRange`
- `totalWalletCount` (shown in header + used for percentile math)

**2) Single wallet** (`walletAddress=0x...`)  
Used for the “See details” modal and for the scorecard/projection.

Fields used by the UI:

- `totals.totalPoints`
- `composition` (active vs passive split)
- `currentWeekProjection`
  - `hasMinerMultiplier`, `hasSteeringStake`
  - `projectedPoints.totalProjectedScore`
- `weekly[]` is shown in the breakdown dialog (shared component)

**Important notes**

- Most numeric fields are **stringified decimals** (points) or **wei strings**. Avoid `Number()` on wei; use `BigInt` + `formatUnits`.
- This UI assumes list results are **already sorted by `totalPoints` descending** (global rank = index + 1).

## Current UI structure (Impact tab)

### File: `app/stats/rewards/impact-view.tsx`

#### 1) Hero / Scorecard

Component: `ImpactHero`

- Header shows:
  - “Weekly scorecard”
  - Week range (if present)
  - “status-only” badge
  - **Next rollover** countdown pill (moved here from KPI cards)
- Left card: **Current ranking**
  - Shows the user’s current score + wallet short address
  - Shows a prominent **Top X%** badge (or “Below Top Y%” if the wallet is outside the returned leaderboard slice)
  - Shows a single progress module:
    - Big progress bar with emerald fill + striped remainder + percent badge
    - Text: “X pts to reach Rank #Y”
    - “See details” button placed in the bottom row next to the progress text
- Right card: **Active multipliers & bonuses**
  - Shows “3× Cash Miner Multiplier” status from `currentWeekProjection.hasMinerMultiplier`
  - Shows “Steering Power (sGCTL)” status from `currentWeekProjection.hasSteeringStake`
  - Shows a **Delegate GLW** CTA row (same UI pattern as the miner multiplier row)
    - Opens `LaunchpadDialog` (same dialog used in `QuickActionsWidget`)
    - Status is derived from `currentWeekProjection.projectedPoints.delegatedGlwWei` (non-zero = ACTIVE)
  - CTAs live here (Stake GCTL / Buy Miner / Delegate GLW). We intentionally removed them from the “Current ranking” card.
    - **Buy Miner** opens `LaunchpadDialog`
    - **Stake GCTL** opens `MintAndStakeGctlDialog`

#### 2) Leaderboard table

- Table columns (responsive):
  - Rank (Top 3 show `#`, rest show percentile)
  - Wallet (ENS name if present, address below)
  - Strategy (hidden on small screens)
  - Last week (hidden on smaller screens)
  - Total Points
  - Glow Worth
- Strategy pill is computed from `composition`:
  - Pick the largest points bucket among steering/worth/inflation/vault.
  - Uses semantically-colored pill backgrounds/borders.
- Rank 1 row is highlighted:
  - subtle yellow-tinted background + crown icon in the rank cell.

#### Pagination + Search

- URL query params via `nuqs`:
  - `page` (1-based)
  - `search`
- Page size: `50`
- Filtering:
  - Filters **by wallet address OR ENS name**
  - Percentile math remains global (uses precomputed `globalRankByWallet` + `totalWalletCount`)

### ENS integration

- Hook: `hooks/useEnsNames.ts`
- We fetch ENS for all wallets returned by the leaderboard list so:
  - Search can match ENS
  - Table render doesn’t shift by page

### Breakdown modal (shared)

File: `components/dialogs/impact-score-breakdown-dialog.tsx`

Exports:

- `ImpactScoreBreakdownDialogContent`: pure UI for the breakdown (used by the Rank widget)
- `ImpactScoreBreakdownDialog`: dialog wrapper that fetches data when opened (used by ImpactView)

Caching / prefetch:

- The breakdown dialog query key is normalized and shared via `hooks/useImpactGlowScore.ts`:
  - `["impact-score-breakdown", walletAddressLower, startWeek, endWeek]`
- The hero’s “self” query uses the **same key** (via `useImpactScoreQuery`), so clicking **See details** is effectively instant (data is already in react-query cache).

## Loading UX / skeletons

Goals:

- Keep layout stable while loading.
- Avoid flashing incorrect “INACTIVE” states while the wallet breakdown is still fetching.

Current approach:

- `ImpactHeroSkeleton` renders a full skeleton matching the final hero layout while the leaderboard is initially loading.
- When the self breakdown is loading/fetching:
  - rank badge / progress module / projection area use skeleton placeholders.
- Leaderboard table uses a table-shaped skeleton (header + rows) rather than generic bars.
- During background refresh (`isFetching` but not initial `isLoading`), the table is dimmed slightly for feedback.

## Known limitations / assumptions

- **Global rank for wallets outside the returned list**:
  - We only know exact global rank for wallets included in the list response.
  - For a connected wallet outside the list window, we show “Below Top X%” where \(X = \\frac{listLength}{totalWalletCount} \\times 100\).
  - If we need exact rank for arbitrary wallets, the router would need to expose it (or accept a wallet and return its global rank).
- **Leaderboard list limit**:
  - The UI currently calls `/impact/glow-score` list without explicitly setting `limit`.
  - Behavior depends on backend defaults; ensure `totalWalletCount` is present (backend behavior documented) and list is sorted.

## Files touched / where to look

- `app/stats/rewards/impact-view.tsx` — main UI
- `components/dialogs/impact-score-breakdown-dialog.tsx` — shared breakdown modal UI + fetch wrapper
- `hooks/useImpactGlowScore.ts` — Impact Router queries + shared react-query keys
- `hooks/useEnsNames.ts` — ENS resolution for leaderboard and search
- `utils/impact.ts` — formatting + “strategy pill” helpers used by the Impact tab
- `utils/clipboard.ts` — clipboard helper (toasts on success/failure)
- `app/components/animated-countdown.tsx` and `utils/getCurrentEpoch.ts` — rollover countdown
