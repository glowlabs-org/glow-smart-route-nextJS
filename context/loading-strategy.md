# Loading Strategy (App Router + Wagmi + React Query)

## Goals

- Show **real UI as early as possible** (SSR first paint), then progressively fill data.
- Avoid **double full-screen loaders** and avoid **wallet disconnected flash** during auto-reconnect.
- Deduplicate expensive requests and keep RPC/network usage sane.

## Where loading UI should live

### Route-level loading (full screen)

- Use Next.js App Router `app/loading.tsx` for **route segment** loading only.
- This is the only place that should render the global `<Loading />` screen.

File:

- `app/loading.tsx` → returns `<Loading />` from `components/loading.tsx`.

### Component-level loading (in-place)

- Use widget skeletons/placeholders inside components for **data fetching** and **wallet settling**.
- Prefer keeping layout stable (same heights) to avoid jumpy transitions.

Example:

- `app/test/bento.tsx` uses a dashboard-shaped skeleton grid when the wallet is reconnecting.

### Avoid duplicate full-screen loaders

We previously rendered `<Loading />` twice:

- `app/loading.tsx`
- `app/components/page-wrapper.tsx` via `<Suspense fallback={<Loading />}>…</Suspense>`

Fix:

- `app/components/page-wrapper.tsx` now renders children directly so only `app/loading.tsx` can full-screen.

## Wallet connection UX (Wagmi auto-reconnect)

Wagmi may reconnect on page load. If we render the disconnected UI while `isReconnecting` is true, users see a brief “not connected” onboarding flash.

Strategy: **3-state wallet UI**

- **Connected**: we have an address → render connected dashboard
- **Settling**: `isConnecting || isReconnecting` and no address yet → render a skeleton dashboard (not onboarding)
- **Disconnected**: no address and not settling → render onboarding

Implementation:

- `app/test/bento.tsx` uses `isConnecting`/`isReconnecting` to show a `DashboardConnectingSkeleton` instead of the disconnected experience while settling.
- The transitions are faded using `AnimatePresence` to avoid hard swaps.

Notes:

- If `walletAddressOverride` is provided (e.g. test route), we do not consider wagmi reconnect state.

## React Query hydration + SSR prefetch

### Query client

- Created in `app/providers/wagmiWrapper.tsx` (single `QueryClientProvider` for the app).

### Hydration boundary

- `app/components/hydration-wrapper.tsx` uses `HydrationBoundary` to hydrate server-prefetched queries.

### Query keys (single source of truth)

- **Always use** `hooks/query-keys.ts` (`QUERY_KEYS`) for React Query keys.
- Avoid string literals like `["wallet-details", wallet]` in components/hooks — that causes silent cache misses when we try to invalidate/refetch after transactions.

### Home route prefetch

- `app/page.tsx` prefetches:
  - `["headline-stats", chainId]`
  - `["eth-price"]`

This is intentionally small: prefetch only what helps first paint and avoids redundant requests.

## Headline stats: dedupe + cache pipeline

`headline-stats` is expensive (remote API + on-chain reads). We avoid doing on-chain reads in the browser and dedupe the data source across the app.

### Single cache key

All consumers should use:

- `["headline-stats", chainId]`

Derived values (circulating supply, market cap, price) should come from this shared source (not a separate fetch).

### Server caching (30s)

- `lib/server/headline-stats.ts` exports `getCachedHeadlineStats` which wraps the fetcher with `unstable_cache({ revalidate: 30 })`.

### Internal API (browser-safe)

- `app/api/headline-stats/route.ts` serves cached stats.
- Client fetches go through this route so the browser does not hit RPC endpoints for headline stats.

### Client fetcher

- `web3/web3/queries/getHeadlineStats.ts` fetches from `/api/headline-stats`.

### Server usage

Server pages should prefer calling `getCachedHeadlineStats()` directly (instead of using the client fetcher with a relative URL):

- `app/page.tsx`
- `/glow-swap/*` now redirects to `/` (see `next.config.js` and `app/glow-swap/page.tsx`), so there is no longer a dedicated swap page doing server fetches.

## Toasts

Mount Sonner once to avoid duplicate containers and duplicate toasts.

- Kept the themed toaster in `app/providers/wagmiWrapper.tsx` (`components/ui/sonner`).
- Removed the extra `Toaster` from `app/layout.tsx`.

## Post-transaction refresh (GCTL mint/stake)

After minting/staking, multiple widgets depend on different cached queries:

- **GCTL balance (liquid)**: `QUERY_KEYS.balances.gctl(wallet)` (used by e.g. `app/test/widgets/net-worth.tsx`)
- **Wallet stake breakdown**: `QUERY_KEYS.wallets.details(wallet)` (used by e.g. `app/test/widgets/gctl-heatmap-widget.tsx`)

Strategy:

- Invalidate/refetch **on confirmation**, not on modal close.
- `components/buy-gctl/processing-modal.tsx` supports an `onConfirmed` callback; dialogs that mint/stake should call `invalidateAllQueries()` there so UI updates immediately when the tx is confirmed.
