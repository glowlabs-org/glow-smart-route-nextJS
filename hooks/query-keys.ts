export const QUERY_KEYS = {
  // --- HUB API ---
  fractions: {
    summary: () => ["fractions", "summary"] as const,
    availability: (type: "launchpad" | "mining-center" | "all") =>
      ["fractions", "available", type] as const,
    yieldPer100: () => ["yield-per-100"] as const,
    totalActivelyDelegated: (includeApy?: boolean) =>
      ["fractions", "total-actively-delegated", includeApy ?? false] as const,
    activelyDelegatedByWeek: (startWeek?: number, endWeek?: number) =>
      ["fractions", "actively-delegated-by-week", startWeek, endWeek] as const,
    rewardsBreakdown: (params: {
      walletAddress?: string | null;
      farmId?: string | null;
      startWeek?: number;
      endWeek?: number;
    }) =>
      [
        "rewards-breakdown",
        params.walletAddress,
        params.farmId,
        params.startWeek,
        params.endWeek,
      ] as const,
    refundable: (walletAddress?: string | null) =>
      ["refundable-fractions", walletAddress] as const,
    splits: (walletAddress?: string | null, fractionId?: string | null) =>
      ["fraction-splits", walletAddress, fractionId] as const,
  },
  impact: {
    leaderboard: () => ["impact-leaderboard"] as const,
    walletStats: () => ["impact", "wallet-stats"] as const,
    newWalletsByWeek: (startWeek?: number, endWeek?: number) =>
      ["impact", "new-wallets-by-week", startWeek, endWeek] as const,
    score: (walletAddress?: string | null) =>
      ["impact-glow-score", walletAddress] as const,
    glowWorth: (walletAddress?: string | null) =>
      ["impact-glow-worth", walletAddress?.toLowerCase() ?? null] as const,
    scoreBreakdown: (walletAddress?: string | null) =>
      ["impact-score-breakdown", walletAddress?.toLowerCase() ?? null] as const,
  },
  solarCollector: {
    stats: (walletAddress?: string | null, includeCurrentWeekPower?: boolean) =>
      [
        "solar-collector-stats",
        walletAddress?.toLowerCase() ?? null,
        includeCurrentWeekPower ?? false,
      ] as const,
  },
  listings: {
    allSponsors: ["sponsor-listings"] as const,
    sponsor: (filters: Record<string, any>) =>
      ["sponsor-listings", filters] as const,
    liveSoon: () => ["sponsor-listings-live-soon"] as const,
    rewardScores: (
      applicationIds: string[],
      currency?: string,
      wallet?: string | null,
    ) => ["reward-scores", applicationIds, currency, wallet] as const,
    miningScores: (applicationIds: string[], extraLiveKey?: string) =>
      ["mining-scores", applicationIds, extraLiveKey ?? null] as const,
    kickstarters: () => ["kickstarters"] as const,
  },
  activity: {
    allSplits: ["splits-activity"] as const,
    splits: (limit?: number, walletAddress?: string, fractionType?: string) =>
      ["splits-activity", limit, walletAddress, fractionType] as const,
  },

  // --- CONTROL API ---
  wallets: {
    details: (wallet?: string) => ["wallet-details", wallet] as const,
    availableStake: (wallet?: string, regionId?: number | null) =>
      ["wallet-available-stake", wallet, regionId ?? null] as const,
    availableStakeBatch: (wallet?: string, regionIds?: number[]) =>
      [
        "wallet-available-stake",
        wallet,
        "batch",
        (regionIds ?? []).join(","),
      ] as const,
    mintedEvents: (wallet?: string, page?: number, limit?: number) =>
      ["wallet-minted-events", wallet, page, limit] as const,
    stakeEvents: (
      wallet?: string,
      page?: number,
      limit?: number,
      regionId?: number,
    ) => ["wallet-stake-events", wallet, page, limit, regionId] as const,
    migrationAmount: (wallet?: string) => ["migration-amount", wallet] as const,
    all: () => ["all-wallets"] as const,
    farms: (wallet?: string) => ["wallet-farms", wallet] as const,
    rewardSplitOwnership: (wallet?: string) =>
      ["wallet-reward-split-ownership", wallet?.toLowerCase() ?? null] as const,
    allV2Claims: ["wallet-v2-claims"] as const,
    v2Claims: (wallet?: string, refreshKey?: string | number) =>
      refreshKey
        ? (["wallet-v2-claims", wallet, refreshKey] as const)
        : (["wallet-v2-claims", wallet] as const),
    allRewards: ["wallet-rewards"] as const,
    rewards: (wallet?: string, refreshKey?: string | number) =>
      refreshKey
        ? (["wallet-rewards", wallet, refreshKey] as const)
        : (["wallet-rewards", wallet] as const),
    claimableTotals: (
      wallet?: string,
      finalizedWeeksKey?: string,
      refreshKey?: string | number,
    ) =>
      [
        "wallet-claimable-totals",
        wallet,
        finalizedWeeksKey,
        refreshKey,
      ] as const,
  },
  farms: {
    activity: (type?: string, sortBy?: string, limit?: number) =>
      ["farms-activity", type, sortBy, limit] as const,
    rewards: (farmId: string, params?: any) =>
      ["farm-weekly-rewards", farmId, params] as const,
    efficiencyScores: (farmId?: string) =>
      ["farms-efficiency-scores", farmId] as const,
    rewardsBatch: (farmIds: string[], startWeek?: number, endWeek?: number) =>
      ["farm-weekly-rewards-batch", farmIds, startWeek, endWeek] as const,
  },

  // --- DERIVED / CLIENT ---
  balances: {
    tokens: (chainId?: number, wallet?: string) =>
      ["wallet-token-balances", chainId, wallet] as const,
    gctl: (wallet?: string) => ["gctl-balance", wallet] as const,
  },
  swaps: {
    history: (chainId?: number, wallet?: string, limit?: number) =>
      limit !== undefined
        ? (["wallet-swaps", chainId, wallet, limit] as const)
        : (["wallet-swaps", chainId, wallet] as const),
  },
  prices: {
    glowSpot: (refreshKey?: string | number) =>
      refreshKey
        ? (["glow-spot-price", refreshKey] as const)
        : (["glow-spot-price"] as const),
    headline: (chainId?: number) => ["headline-stats", chainId] as const,
    marketCap: () => ["glow-market-cap"] as const,
  },
  glow: {
    circulating: (range?: string | null, includePartialWeek?: boolean | null) =>
      ["glow-circulating", range ?? null, includePartialWeek ?? null] as const,
  },
  fmi: {
    pressure: (range?: string | null, address?: string | null) =>
      ["fmi-pressure", range ?? null, address ?? null] as const,
  },
  pol: {
    summary: () => ["pol-summary"] as const,
    liquiditySnapshot: (range?: string | null, wallets?: string[] | null) =>
      ["pol-liquidity-snapshot", range ?? null, wallets ?? null] as const,
    liquidity: (range?: string | null) =>
      ["pol-liquidity", range ?? null] as const,
  },
  unclaimed: {
    all: ["unclaimed-glw-rewards"] as const,
    glw: (wallet?: string, eligibleWeeksKey?: string) =>
      eligibleWeeksKey
        ? (["unclaimed-glw-rewards", wallet, eligibleWeeksKey] as const)
        : (["unclaimed-glw-rewards", wallet] as const),
  },
  // --- V2 Points & Impact Overhaul ---
  v2: {
    pointsBalance: (wallet?: string | null) =>
      ["v2", "points-balance", wallet?.toLowerCase() ?? null] as const,
    pointsLedger: (wallet?: string | null, limit?: number) =>
      [
        "v2",
        "points-ledger",
        wallet?.toLowerCase() ?? null,
        limit ?? null,
      ] as const,
    // 3-element PREFIX (no limit) for invalidation. invalidateQueries matches
    // by prefix, so this hits every ledger page (limit 50, 500, ...); the
    // 4-element pointsLedger key ends in `null` and would NOT prefix-match a
    // subscription keyed with an explicit limit.
    pointsLedgerAll: (wallet?: string | null) =>
      ["v2", "points-ledger", wallet?.toLowerCase() ?? null] as const,
    wattsActivity: (wallet?: string | null, limit?: number) =>
      [
        "v2",
        "watts-activity",
        wallet?.toLowerCase() ?? null,
        limit ?? null,
      ] as const,
    pointsRates: () => ["v2", "points-rates"] as const,
    estimateAllocation: (
      fractionId: string | null | undefined,
      quantity: number,
    ) => ["v2", "estimate-allocation", fractionId ?? null, quantity] as const,
    shopCurrent: () => ["v2", "shop-current"] as const,
    shopPurchases: (wallet?: string | null) =>
      ["v2", "shop-purchases", wallet?.toLowerCase() ?? null] as const,
    earlyAccess: (wallet?: string | null) =>
      ["v2", "early-access", wallet?.toLowerCase() ?? null] as const,
    impactLeaderboard: (
      sort?: string | null,
      dir?: string | null,
      limit?: number | null,
      regionId?: number | null,
      offset?: number | null,
    ) =>
      [
        "v2",
        "impact-leaderboard",
        sort ?? null,
        dir ?? null,
        limit ?? null,
        regionId ?? null,
        offset ?? null,
      ] as const,
    impactWallet: (wallet?: string | null) =>
      ["v2", "impact-wallet", wallet?.toLowerCase() ?? null] as const,
  },
} as const;
