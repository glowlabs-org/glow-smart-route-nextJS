# Dashboard UI Documentation

## Overview

`GlowSoftDashboard` (`app/test/bento.tsx`) is the primary dashboard layout. It is a **section-based vertical layout** that adapts to wallet state (connected vs guest) and uses single-card sections with internal grid divisions.

### Important: Not a Bento Grid

Despite the file name, this is **not** a bento grid. The layout is organized as vertical sections, each wrapped in a single card with internal grids and dividers. The name is historical.

## Core State & Routing Inputs

- **`walletAddress`**: `walletAddressOverride ?? connectedAddress ?? null`
- **`hasWallet`**: `Boolean(walletAddress)`
- **`isWalletSettling`**:

```ts
const isWalletSettling =
  isClient &&
  !walletAddressOverride &&
  !hasWallet &&
  (isConnecting || isReconnecting) &&
  !hasAnyDialogOpen;
```

If `isWalletSettling` is true, we show `DashboardConnectingSkeleton`.

## Layout Summary

### Connected State

Sections are rendered in this order:

1. **Launchpad Live/Opening Soon** *(optional)*
   - `LaunchpadStatusWidget` with `variant="full-row"`
   - Shown when the launchpad is live with availability or within 1 hour of the next batch.
2. **Overview**
   - `RankWidget` (hero)
   - `NetWorthWidget` (minimal)
   - `WalletWidget` (minimal)
3. **Mining & Rewards**
   - `SolarFarmWidget` (minimal)
   - `RewardsWidget` (minimal)
4. **Grow Your Impact**
   - `LaunchpadStatusWidget` (minimal)
   - `GctlHeatmapWidget` (minimal)
5. **My Impact**
   - `SolarCollectorWidget`
6. **Your Journey**
   - `WeeklyActivityWidget` (minimal)
   - `RecentActivityWidget` (minimal)
   - `PortfolioSummaryWidget` (minimal)
7. **My Farms**
   - `MyFarmsGridSection`

### Guest State

Sections are rendered in this order:

1. **Launchpad Live/Opening Soon** *(optional)*
   - `LaunchpadStatusWidget` with `variant="full-row"`
2. **Get Started**
   - `OnboardingHeroWidget` (minimal)
   - `LaunchpadStatusWidget` (minimal)
3. **Community & Leaderboard**
   - `CommunityActivityWidget` (minimal)
   - `GlobalLeaderboardWidget` (minimal)
4. **Protocol Metrics**
   - `ProtocolMetricsWidget`
5. **Education**
   - `GlowFaqWidget` (minimal)
   - `BlogFeaturedWidget`
6. **Stay Connected**
   - `NewsletterWidget` (minimal)
   - `DiscordWidget` (minimal)

## Section Layout Pattern

All sections use the same core pattern: section header + single card + internal grid.

```tsx
<section className="flex flex-col gap-8">
  <SectionHeader title="Section Name" />

  <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-8 lg:p-12">
    <div className="grid grid-cols-1 lg:grid-cols-N gap-8 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/20 items-stretch">
      <div className="pb-8 lg:pb-0 lg:pr-10">
        <WidgetComponent variant="minimal" />
      </div>
      <div className="pt-8 lg:pt-0 lg:pl-10">
        <WidgetComponent variant="minimal" />
      </div>
    </div>
  </div>
</section>
```

## Launchpad Hero Row Logic

- `LaunchpadStatusWidget(variant="full-row")` appears when:
  - The launchpad is live **and** has available listings, or
  - The next batch starts within **1 hour**.
- The header switches between **"Launchpad Live"** and **"Launchpad Opening Soon"**.
- Countdown completion triggers a refetch of sponsor listings.

## Shared Dialogs & Cross-Widget Actions

The dashboard owns shared dialogs and toasts used by multiple widgets:

- **`MintAndStakeGctlDialog`**
  - Opened by `RankWidget` and `GctlHeatmapWidget`.
- **`DepositDialog`**
  - Opened by `LaunchpadStatusWidget` (both connected and guest states).
  - Uses `selectedCurrency="USDC"` for miners and `"GLW"` for delegations.
- **`BuyGlowDialog`**
  - Opened by `NetWorthWidget` and `OnboardingHeroWidget`.
  - Defaults to `$20` USDC in this dashboard context.
- **`RefundClaimsPanel`**
  - Triggered via persistent toast when refundable fractions exist.
- **`MigrationClaimPanel`**
  - Triggered via persistent toast when an unclaimed GCTL migration is detected.
- **Referral Modals**
  - `FeatureLaunchModal` and `ActivationCelebrationModal` render when referrals are live.

## Widget Map (Source of Truth)

If the UI drifts, use the widget files below as the source of truth:

| Widget | File |
| --- | --- |
| GlowSoftDashboard | `app/test/bento.tsx` |
| RankWidget | `app/test/widgets/rank-widget.tsx` |
| NetWorthWidget | `app/test/widgets/net-worth.tsx` |
| WalletWidget | `app/test/widgets/wallet-widget.tsx` |
| SolarFarmWidget | `app/test/widgets/solar-farm-widget.tsx` |
| RewardsWidget | `app/test/widgets/rewards-widget.tsx` |
| LaunchpadStatusWidget | `app/test/widgets/launchpad-status-widget.tsx` |
| GctlHeatmapWidget | `app/test/widgets/gctl-heatmap-widget.tsx` |
| SolarCollectorWidget | `app/test/widgets/solar-collector.tsx` |
| WeeklyActivityWidget | `app/test/widgets/weekly-activity-widget.tsx` |
| RecentActivityWidget | `app/test/widgets/recent-activity-widget.tsx` |
| PortfolioSummaryWidget | `app/test/widgets/portfolio-summary-widget.tsx` |
| MyFarmsGridSection | `app/test/widgets/my-farms-grid-section.tsx` |
| OnboardingHeroWidget | `app/test/widgets/onboarding-hero-widget.tsx` |
| CommunityActivityWidget | `app/test/widgets/community-activity-widget.tsx` |
| GlobalLeaderboardWidget | `app/test/widgets/global-leaderboard-widget.tsx` |
| ProtocolMetricsWidget | `app/test/widgets/protocol-metrics-widget.tsx` |
| GlowFaqWidget | `app/test/widgets/glow-faq-widget.tsx` |
| BlogFeaturedWidget | `app/test/widgets/blog-featured-widget.tsx` |
| NewsletterWidget | `app/test/widgets/newsletter-widget.tsx` |
| DiscordWidget | `app/test/widgets/discord-widget.tsx` |
