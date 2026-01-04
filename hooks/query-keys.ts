export const QUERY_KEYS = {
  // --- HUB API ---
  fractions: {
    summary: () => ["fractions", "summary"] as const,
    availability: (type: "launchpad" | "mining-center" | "all") =>
      ["fractions", "available", type] as const,
    yieldPer100: () => ["yield-per-100"] as const,
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
    score: (walletAddress?: string | null) =>
      ["impact-glow-score", walletAddress] as const,
  },
  listings: {
    allSponsors: ["sponsor-listings"] as const,
    sponsor: (filters: Record<string, any>) =>
      ["sponsor-listings", filters] as const,
    rewardScores: (
      applicationIds: string[],
      currency?: string,
      wallet?: string | null
    ) => ["reward-scores", applicationIds, currency, wallet] as const,
    miningScores: (applicationIds: string[]) =>
      ["mining-scores", applicationIds] as const,
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
    mintedEvents: (wallet?: string, page?: number, limit?: number) =>
      ["wallet-minted-events", wallet, page, limit] as const,
    stakeEvents: (
      wallet?: string,
      page?: number,
      limit?: number,
      regionId?: number
    ) => ["wallet-stake-events", wallet, page, limit, regionId] as const,
    migrationAmount: (wallet?: string) => ["migration-amount", wallet] as const,
    all: () => ["all-wallets"] as const,
    farms: (wallet?: string) => ["wallet-farms", wallet] as const,
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
      refreshKey?: string | number
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
  },
  unclaimed: {
    all: ["unclaimed-glw-rewards"] as const,
    glw: (wallet?: string, eligibleWeeksKey?: string) =>
      eligibleWeeksKey
        ? (["unclaimed-glw-rewards", wallet, eligibleWeeksKey] as const)
        : (["unclaimed-glw-rewards", wallet] as const),
  },
} as const;
