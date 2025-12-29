# Glow Smart Route - React Hooks

This document describes the **main hook entry points** in `hooks/`, with an emphasis on the hooks that talk to:

- **Hub API** (via `NEXT_PUBLIC_HUB_URL`)
- **Glow Control API / glow-utils routers** (via `NEXT_PUBLIC_CONTROL_API_URL`)

## Import guide

- **Domain hooks (Hub + Control)**: import from the barrel `@/hooks` (see `hooks/index.ts`).
- **Everything else**: import from the specific file (for example `@/hooks/useEthersSigner`).

### Environment notes (Next.js)

- **`NEXT_PUBLIC_*` values are baked into the client bundle** at dev-server startup / build time.
  - If you change `.env*`, you must **restart** `pnpm dev` (and redeploy for production).
- **Hub API hooks** require `NEXT_PUBLIC_HUB_URL`.
- **Control API hooks** require `NEXT_PUBLIC_CONTROL_API_URL`.

---

## Hub API hooks (server data from `NEXT_PUBLIC_HUB_URL`)

*Primary files:* `hooks/hub-fractions.ts`, `hooks/hub-listings.ts`, `hooks/hub-impact.ts`

### `useFractionsSummary`
*File: `hooks/hub-fractions.ts`*
- **Purpose**: High-level fractions metrics (delegated GLW, contributors, volumes).

### `useFractionsAvailability`
*File: `hooks/hub-fractions.ts`*
- **Purpose**: Available fractions inventory/steps for purchase.

### `useFractionSplits`
*File: `hooks/hub-fractions.ts`*
- **Purpose**: Purchase history (splits) for a fraction.

### `useSplitsActivity`
*File: `hooks/hub-listings.ts`*
- **Purpose**: Recent split activity feed (used across wallet/activity UIs).

### `useRewardsBreakdown`
*File: `hooks/hub-fractions.ts`*
- **Purpose**: Rewards breakdown time series used by wallet/stats screens.

### `useWalletsActivity` / `useFarmsActivity`
*File: `hooks/hub-fractions.ts`*
- **Purpose**: Aggregated activity metrics for wallets and farms.

### `useYieldPer100`
*File: `hooks/hub-fractions.ts`*
- **Purpose**: Normalized yield metrics (“per $100”).

### `useRefundableFractions`
*File: `hooks/hub-fractions.ts`*
- **Purpose**: Refundable fraction positions for a wallet.

### `useSponsorListings` (core) + wrappers `useGlowLaunchpad` / `useMiningCenter`
*File: `hooks/hub-listings.ts`*
- **Purpose**: Fetch sponsor applications/listings from Hub.
- **Notes**:
  - `useGlowLaunchpad` and `useMiningCenter` are thin wrappers for legacy call-sites.
  - Prefer `useSponsorListings` for new code.

### `useSponsorApplication`
*File: `hooks/hub-listings.ts`*
- **Purpose**: Mutation hook for creating sponsor applications.

### `useImpactLeaderboardQuery` / `useImpactScoreQuery`
*File: `hooks/hub-impact.ts`*
- **Purpose**: Impact leaderboard + per-wallet score breakdown.

---

## Control API hooks (glow-utils routers via `NEXT_PUBLIC_CONTROL_API_URL`)

*Primary files:* `hooks/control-gctl.ts`, `hooks/control-wallets.ts`, `hooks/control-farms.ts`, `hooks/control-regions.ts`

### `useGctlApi`
*File: `hooks/control-gctl.ts`*
- **Purpose**: GCTL Control API façade (balances, prices, staking flows, ops/events, transfer lookup).
- **Notable helpers**:
  - Hook-style helpers: `useMintedEvents`, `useStakeEvents`, `usePendingTransfers`, `useFailedOperations`, `useTransferDetails`
  - Legacy helpers used by some screens: `fetchMintedEvents`, `fetchStakedEvents`, `fetchTransferDetails`
    - `fetchStakedEvents` is a legacy name; it calls the Control API router’s `fetchStakeEvents(...)`.

### `useGctlHoldersCount`
*File: `hooks/control-gctl.ts`*
- **Purpose**: Total number of GCTL holders.

### `useMigrationClaim`
*File: `hooks/control-gctl.ts`*
- **Purpose**: EIP-712 signing + mutation for the migration claim flow.

### `useRegions` / `useActiveRegionsSummary`
*File: `hooks/control-regions.ts`*
- **Purpose**: Regions list + derived active summary metrics (staking/rewards/history).

### `useWallets`
*File: `hooks/control-wallets.ts`*
- **Purpose**: Wallet details + minted/stake events + migration amount + (optionally) all wallets.

### `useWalletV2Claims`
*File: `hooks/control-wallets.ts`*
- **Purpose**: Historical weekly rewards/claims processing (protocol deposits + emissions).

### `useClaimableRewards`
*File: `hooks/control-wallets.ts`*
- **Purpose**: Claimable rewards aggregation (used by claim UIs).

### `useWalletFarms` / `useFarmWeeklyRewards` / `useFarmWeeklyRewardsBatch`
*File: `hooks/control-farms.ts`*
- **Purpose**: Farm data and rewards histories from the Control API.

### `useFarmsEfficiencyScores`
*File: `hooks/control-farms.ts`*
- **Purpose**: Efficiency scores.

### `useRewardScore` / `useMiningScore`
*File: `hooks/control-farms.ts`*
- **Purpose**: Estimate scores for launchpad/mining center listings.

### `useKickstarters`
*File: `hooks/control-farms.ts`*
- **Purpose**: Kickstarter projects list from Control API.

---

## Other notable hooks (import directly from the file)

### Core / UI
- `useToast` (`hooks/use-toast.ts`)
- `useIsMobile` (`hooks/use-ismobile.ts`, `hooks/use-mobile.ts`)
- `useDebouncedAsync` (`hooks/useDebouncedAsync.ts`)
- `useGlowSpotPriceSummary` (`hooks/useGlowSpotPriceSummary.ts`)

### Web3 / contracts
- `useEthersSigner` (`hooks/useEthersSigner.ts`)
- `useContracts` (`hooks/useContracts.ts`)
- `useERC20` (`hooks/useERC20.ts`)
- `useERC20Balances` (`hooks/useERC20Balances.ts`)
- `useWalletTokenBalances` (`hooks/useWalletTokenBalances.ts`)

### Trading / liquidity
- `useSwap` (`hooks/useSwap.ts`)
- `useSwapETHToUSDC` (`hooks/useSwapETHToUSDC.ts`)
- `useSwapUSDCToUSDG` (`hooks/useSwapUSDCToUSDG.ts`)
- `useUSDGRedemption` (`hooks/useUSDGRedemption.ts`)
- `usePurchaseGlow` (`hooks/usePurchaseGlow.ts`)
- `useLiquidityPositions` (`hooks/useLiquidityPositions.ts`)
- `useLiquidityPositionsOptimized` (`hooks/useLiquidityPositionsOptimized.ts`)

### Rewards claiming / proofs
- `useMerkleProofs` (`hooks/useMerkleProofs.ts`)
- `useRewardsKernelWrapper` (`hooks/useRewardsKernelWrapper.ts`)

### Wallet UX
- `useEnsNames` (`hooks/useEnsNames.ts`)
- `useWalletSwaps` (`hooks/useWalletSwaps.ts`)
- `useRecentActivityFeed` (`hooks/useRecentActivityFeed.ts`)
- `useLaunchpadStatus` (`hooks/useLaunchpadStatus.ts`)
