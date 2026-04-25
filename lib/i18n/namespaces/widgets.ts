import type { Lang } from "../config";

// Strings for dashboard widgets on the home page.
// Widget-specific sub-objects keep this file scannable as more widgets land.

export interface FaqBullet {
  label: string;
  text: string;
}

export interface FaqItem {
  id: string;
  q: string;
  paragraphs: string[];
  bullets?: FaqBullet[];
  callout?: string;
}

export interface WidgetStrings {
  onboardingHero: {
    kicker: string;
    // The hero headline is rendered as 3 JSX spans (italic pre, highlighted
    // middle, italic post). Each part is stored separately so the highlight
    // can sit in the correct grammatical position per language.
    quotePre: string;
    quoteHighlight: string;
    quotePost: string;
    attribution: string;
    buyGlw: string;
  };

  launchpadStatus: {
    // Card header titles
    launchpadTitle: string;
    newMinersIn: string;
    getReady: string;
    newMiningCenterListingIn: string;
    newSolarFarmListingIn: string;
    newListingsIn: string;
    // Top-right / header buttons
    viewMarketplace: string;
    buyGlw: string;
    // Tabs
    tabAll: string;
    tabDelegations: string;
    tabDelegationsShort: string;
    tabMiners: string;
    // Split batch notice (miners live, delegations later).
    // Rendered as: `${minersLiveDelegationsPre}<span>{time}</span>${minersLiveDelegationsPost}`.
    minersLiveDelegationsPre: string;
    minersLiveDelegationsPost: string;
    // Loading / empty / error
    noListings: string;
    statusUnavailable: string;
    // Listing card chips
    miner: string;
    delegation: string;
    soldOut: string;
    advancedStats: string;
    statsShort: string;
    unnamedFarm: string;
    unknownRegion: string;
    // Column labels
    total: string;
    delegated: string;
    price: string;
    amount: string;
    free: string;
    filled: string;
    leftCount: (remaining: number, total: number) => string;
    soldIn: string;
    toFill: string;
    estWeekly: string;
    unavailable: string;
    score: string;
    rewardScore: string;
    for100Weeks: string;
    forMinerWeeks: (label: string) => string;
    tooltipMinerWeekly: (weeksLabel: string) => string;
    tooltipDelegationWeekly: string;
    pdRecovery: string;
    emissions: string;
    rewardScoreTooltip: string;
    // Action buttons
    viewAudit: string;
    purchaseMiner: string;
    delegate: (currency: string) => string;
    // Activity tab
    seeAllActivity: string;
    // Aria
    previousListings: string;
    nextListings: string;
    // Education cards (shown in minimal variant while waiting for launchpad)
    guideToDelegationTitle: string;
    guideToDelegationBody: string;
    howMinersWorkTitle: string;
    howMinersWorkBody: string;
    learnMore: string;
    // Prep section shown next to the pre-launch countdown
    beReadyTitle: string;
    beReadyBody: string;
  };

  blogFeatured: {
    category: string;
    readTime: string;
    authorRole: string;
    publishedAtLabel: string;
    title: string;
    description: string;
  };

  newsletter: {
    kicker: string;
    title: string;
    description: string;
    successMessage: string;
    subscribeAria: string;
    placeholder: string;
    toastSuccess: string;
    toastGenericError: string;
    fallbackError: string;
  };

  discord: {
    kicker: string;
    online: string;
    title: string;
    description: string;
    membersCount: string;
    membersSubtitle: string;
    alwaysOn: string;
    alwaysOnSubtitle: string;
    joinAria: string;
  };

  globalLeaderboard: {
    title: string;
    topBadge: string;
    unableToLoad: string;
    noData: string;
    firstPlace: string;
    totalPoints: string;
    glowWorth: string;
    seeFullLeaderboard: string;
  };

  communityActivity: {
    title: string;
    seeAllActivity: string;
    noRecentFarms: string;
    score: string;
    dialogTitle: string;
    // Duration formatter pieces
    duration: {
      oneDay: string;
      days: (n: number) => string;
      oneHour: string;
      hours: (n: number) => string;
      oneMin: string;
      mins: (n: number) => string;
      underOneMin: string;
    };
  };

  faq: {
    widgetTitle: string;
    widgetTag: string;
    selectQuestion: string;
    items: FaqItem[];
  };

  protocolMetrics: {
    glwPrice: string;
    currentSpotPrice: string;
    marketCap: string;
    circulatingSupply: string;
    glwDelegated: string;
    ofCirculatingSupply: string;
    viewAllStats: string;
    deepDiveSubtitle: string;
    chartTitle: string;
    chartSubtitle: string;
    lastThreeMonths: string;
    chartYAxisFarmsLabel: string;
    chartYAxisPdLabel: string;
    chartConfigFarmsLabel: string;
    chartConfigPdLabel: string;
    tooltipProtocolDeposit: string;
    tooltipFarmsOnboarded: string;
    emptyChart: string;
  };

  walletWidget: {
    title: string;
    swap: string;
    send: string;
  };

  rankWidget: {
    title: string;
    totalPoints: string;
    emptyPoints: string;
    rank: string;
    percentile: string;
    topPercentile: (value: string) => string;
    belowTopPercentile: (value: string) => string;
    connectWalletKicker: string;
    connectWalletBody: string;
    loadFailedToast: string;
    rankUp: string;
    mintAndStakeGctl: string;
    breakdown: string;
    leaderboard: string;
    inviteFriends: string;
    invitesWithPoints: (points: string) => string;
  };

  netWorthWidget: {
    title: string;
    breakdown: string;
    priceChart: string;
    thisWeek: string;
    connectWalletPrompt: string;
    // Tooltip
    tooltipCurrentPrefix: (date: string) => string;
    tooltipWeekWithDate: (week: number, date: string) => string;
    tooltipWeek: (week: number) => string;
    tooltipFallback: string;
    tooltipLiquid: string;
    tooltipDelegatedRecovery: string;
    tooltipUnclaimed: string;
  };

  recentActivity: {
    viewAll: string;
    dialogTitle: string;
    title: string;
    live: string;
    kpiTotal: string;
    kpiTransactions: string;
    kpiDelegations: string;
    kpiDelegationsSub: string;
    kpiMiners: string;
    kpiMinersSub: string;
    kpiClaimed: string;
    kpiClaimedSub: string;
    emptyTitle: string;
    emptyBody: string;
    toastTxUnavailable: string;
    ariaViewTx: string;
    epochBadge: (n: number) => string;
    regionFallback: (id: number | string) => string;
    regionGeneric: string;
    launchpadLabel: string;
    minerLabel: string;
    swap: string;
    pillFilled: string;
    pillPctFilled: (n: number) => string;
    pillPd: string;
    pillEmissions: string;
    pillBuy: string;
    pillSell: string;
    claimedTitleSingle: (amount: string, token: string) => string;
    claimedTitleMulti: string;
    weekN: (n: number) => string;
    mintedTitle: (gctl: string) => string;
    mintedSubtitle: (original: string, currency: string) => string;
    stakedTitle: (gctl: string) => string;
    unstakingTitle: (gctl: string) => string;
    stakedSubtitle: (region: string) => string;
    unstakingSubtitle: (region: string) => string;
    delegatedTitle: (amount: string, currency: string) => string;
    purchasedMinersTitle: (n: number) => string;
    purchasedMinersSubtitle: (amount: string, currency: string) => string;
    swappedGlwToUsdg: (glw: string, usdg: string) => string;
    swappedUsdgToGlw: (usdg: string, glw: string) => string;
    glwUsdgPool: string;
  };

  impactAccumulator: {
    titleSkeleton: string;
    title: string;
    viewAssets: string;
    liveCapacity: string;
    infrastructureEquivalent: string;
    panelsUnit: string;
    progressToPanel: (n: number) => string;
    getMorePanels: string;
    boostYourPoints: string;
    connectPrompt: string;
    connectBody: string;
  };

  portfolioSummary: {
    title: string;
    delegatedAssets: string;
    delegatedGlw: string;
    delegatedTooltip: string;
    activeMiners: string;
    activeDelegations: string;
  };

  rewardsWidget: {
    title: string;
    nextClaim: string;
    connectToView: string;
    unableToLoad: string;
    availableNow: string;
    nextClaimChip: string;
    seeRewards: string;
    noRewards: string;
    dialogSrOnlyTitle: string;
  };

  gctlHeatmap: {
    title: string;
    titleShort: string;
    titleTooltip: string;
    disconnectedHeading: string;
    disconnectedBody: string;
    zeroHoldingsTitleReadOnly: string;
    zeroHoldingsTitle: string;
    zeroHoldingsBodyReadOnly: string;
    zeroHoldingsBody: string;
    gamificationHook: string;
    gamificationPoints: string;
    mintAndStake: string;
    boost: string;
    myHoldings: string;
    liquidSuffix: string;
    activeSuffix: string;
    steeringScore: string;
    pts: string;
    perGlwRate: string;
    activeStakes: string;
    impactColumn: string;
    noActiveSteering: string;
    stakeToDirect: string;
    unusedInfluence: string;
    stakeFooter: (amount: string) => string;
    showLess: string;
    showMore: (n: number) => string;
    rowGctlStakedSuffix: (amount: string) => string;
    rowGlwPerWeek: string;
    rowDirectingPct: (pct: string) => string;
    rowDirectingEmissions: string;
  };

  myFarms: {
    // Position labels used inside pending-timeline strings
    positionMiner: string;
    positionDelegation: string;
    positionGeneric: string;
    // Tooltips and info buttons
    firstFundsTooltip: string;
    firstFundsAria: string;
    // Pending-timeline status labels (phase-dependent)
    statusOwnership: (positionLabel: string) => string;
    statusStartsEarning: (positionLabel: string) => string;
    statusEarning: (positionLabel: string) => string;
    statusClaimable: (positionLabel: string) => string;
    helperEpoch: string;
    helperAudit: string;
    helperFinalization: string;
    helperClaimable: string;
    // Timeline labels
    badgeOwned: string;
    badgeClaimReady: string;
    badgeEarningSoon: string;
    badgePending: string;
    timelineLabelFirstFunds: string;
    timelineLabelFundsAvailable: string;
    timelineValueNow: string;
    nextMilestoneStartsEarning: string;
    nextMilestoneFundsAvailable: string;
    nextMilestoneStartedEarning: string;
    // Timeline step labels
    stepWeekCloses: string;
    stepAudited: string;
    stepFirstFunds: string;
    // Pending timeline panels
    whatHappensNext: string;
    nextStep: string;
    openRewards: string;
    modalStatusLabel: string;
    modalStartsEarning: string;
    modalAuditedPosted: string;
    // Type badges
    typeMiner: string;
    typeDelegation: string;
    typeRewards: string;
    typeInProgress: string;
    // Farm card labels
    fundingProgress: string;
    costLabel: string;
    delegatedLabel: string;
    estWeekly: string;
    viewDetails: string;
    active: string;
    statusLabel: string;
    processing: string;
    wksFormat: (active: number, total: number) => string;
    readyToClaim: string;
    calculating: string;
    earned: string;
    lastWeek: string;
    lastWeekPrefix: string;
    timelineText: (active: number, total: number) => string;
    costText: (amount: string) => string;
    delegatedText: (amount: string) => string;
    progressText: (pct: number) => string;
    // Farm detail dialog
    farmOverview: string;
    closeAria: string;
    initialCost: string;
    totalDelegated: string;
    lifetimeEarnings: string;
    estWeeklyRewards: string;
    timelineCard: string;
    timelineTotal: (total: number) => string;
    wksUnit: string;
    rewardsBreakdown: string;
    protocolDeposit: string;
    protocolDepositRecoveredIn: (asset: string) => string;
    protocolDepositRecoveredCapital: string;
    emissions: string;
    emissionsProduction: string;
    totalValue: string;
    weeklyHistory: string;
    tableWeek: string;
    tablePd: string;
    tableEmission: string;
    tableTotal: string;
    // List view
    listItem: string;
    listStatus: string;
    listActive: string;
    listCost: string;
    listEarned: string;
    listLastWeek: string;
    listProgress: string;
    listInProgressStatus: string;
    listProcessing: string;
    listPending: string;
    // Sort / view controls
    sortBy: string;
    sortDefault: string;
    sortNewest: string;
    sortAlphabetical: string;
    sortSize: string;
    sortPlaceholder: string;
    viewDefault: string;
    viewCompact: string;
    viewMosaic: string;
    viewList: string;
    // Error / empty / loading
    unableToLoad: string;
    noFarmsFound: string;
    // Image alts
    imgMain: (name: string) => string;
    imgNumber: (name: string, n: number) => string;
    // See audit
    seeAudit: string;
    // Fallback region / farm name
    fallbackRegion: (id: number) => string;
    fallbackFarmName: (idShort: string) => string;
    fallbackZone: string;
  };

  solarFarm: {
    title: string;
    viewDetails: string;
    currentWeeklyPayout: string;
    latestWeeklyEarnings: string;
    estWeeklyRewards: string;
    assetLabel: string;
    miners: string;
    delegations: string;
    other: string;
    connectWalletKicker: string;
    connectWalletBody: string;
    errorUnableToLoad: string;
    retry: string;
    noActiveStreamsTitle: string;
    noActiveStreamsBody: string;
    buyMiners: string;
    delegateGlw: string;
    browseLaunchpad: string;
    nextBatchIn: string;
    howMiningWorks: string;
    howMiningWorksBody: string;
    guideDelegation: string;
    guideDelegationBody: string;
    farmDetailsAria: string;
    // Asset history tooltip
    earned: string;
    // Pending row
    pendingBadge: string;
    inProgressBadge: string;
    pendingLabel: string;
    inProgressLabel: string;
    percentFilled: (pct: number) => string;
    costLabel: string;
    delegatedLabel: string;
    estWeeklyCol: string;
    fundingLabel: string;
    glwPerWeekEst: string;
    estInProgressRewardsTooltip: string;
    estAbbrev: string;
  };

  solarCollector: {
    dialogTitle: string;
    cardHeading: string;
    cardSubheading: string;
    mainDescription: string;
    impactPowerLabel: string;
    impactPowerDescription: string;
    whatToExpect: string;
    expectItem1Title: string;
    expectItem1Body: string;
    expectItem2Title: string;
    expectItem2Body: string;
    expectItem3Title: string;
    expectItem3Body: string;
    gotIt: string;
    // Main widget
    sectionTitle: string;
    sectionTitleTooltip: string;
    learnMore: string;
    homesPowered: string;
    lightbulbs: string;
    homesTooltip: string;
    lightbulbsTooltip: string;
    homesUnit: string;
    bulbsUnit: string;
    energyPerYear: string;
    energyPerYearTooltip: string;
    treesEquivalent: string;
    treesEquivalentTooltip: string;
    treesUnit: string;
    panelLabel: (n: number) => string;
    panelsCompleted: (n: number) => string;
    emptyFootprintTitle: string;
    emptyFootprintBody: string;
    latestAddition: string;
    latestVerifiedAddition: string;
    noRecentAdditions: string;
    farmSize: string;
    yourShare: string;
    captureLabel: string;
    share: string;
    // Chart titles
    regionalDistribution: string;
    footprintGrowth: string;
    cumulativeRegionalImpact: string;
    wattsUnit: string;
    weekFallback: (n: string | number) => string;
    // Chart config labels
    chartCleanGridProject: string;
    chartUtah: string;
    chartMissouri: string;
    chartColorado: string;
    chartTotalWatts: string;
    chartNetworkShare: string;
    // Region name mapping
    cleanGridRegion: string;
    cleanGridRegionCode: string;
    // Tooltip extras
    multiplierLabel: string;
    minerBadge: string;
    streakBadge: (streakBonus: string, weeks: number) => string;
    // Relative "when" labels for latest addition
    whenToday: string;
    whenYesterday: string;
    whenDaysAgo: (n: number) => string;
    whenLastWeek: string;
    whenWeeksAgo: (n: number) => string;
  };

  weeklyActivity: {
    title: string;
    wks: string;
    currentStreak: string;
    legendMiner: string;
    legendDelegator: string;
    legendBoth: string;
    connectWallet: string;
    unableToLoad: string;
    startYourStreak: string;
    streakAtRiskBold: string;
    streakAtRiskBody: string;
    streakCounter: (n: number) => string;
    // Multiplier tooltip
    currentMultiplier: string;
    multiplierBase: string;
    multiplierMinerSuffix: string;
    multiplierStreak: string;
    multiplierTotal: string;
    // Week-cell status labels (rendered inside tooltip)
    weekStatus: {
      current: string;
      delegator: string;
      miner: string;
      both: string;
      missed: string;
    };
    // Week-cell breakdown labels
    weekDelegated: string;
    weekMiner: string;
  };
}

const en: WidgetStrings = {
  onboardingHero: {
    kicker: "New to Glow? Start Here",
    quotePre: '"If everyone in the world owned',
    quoteHighlight: "$20 of GLW",
    quotePost: ', we could eliminate fossil fuels by 2030."',
    attribution: "David Vorick, CEO",
    buyGlw: "Buy GLW",
  },

  launchpadStatus: {
    launchpadTitle: "Glow Launchpad",
    newMinersIn: "New miners in...",
    getReady: "Get ready",
    newMiningCenterListingIn: "New Mining Center Listing In...",
    newSolarFarmListingIn: "New Solar Farm Listing In...",
    newListingsIn: "New listings in",
    viewMarketplace: "View Marketplace",
    buyGlw: "Buy GLW",
    tabAll: "All",
    tabDelegations: "Delegations",
    tabDelegationsShort: "Deleg.",
    tabMiners: "Miners",
    minersLiveDelegationsPre: "Miners are live now. Delegations open at ",
    minersLiveDelegationsPost: ".",
    noListings: "No listings available at this time.",
    statusUnavailable: "Status currently unavailable.",
    miner: "Miner",
    delegation: "Delegation",
    soldOut: "Sold Out",
    advancedStats: "Advanced Stats",
    statsShort: "Stats",
    unnamedFarm: "Unnamed Farm",
    unknownRegion: "Unknown Region",
    total: "Total",
    delegated: "Delegated",
    price: "Price",
    amount: "Amount",
    free: "Free",
    filled: "filled",
    leftCount: (remaining, total) => `${remaining}/${total} left`,
    soldIn: "Sold In",
    toFill: "to fill",
    estWeekly: "Est. Weekly",
    unavailable: "unavailable",
    score: "Score",
    rewardScore: "Reward Score",
    for100Weeks: "for 100 weeks",
    forMinerWeeks: (label) => `for ${label}`,
    tooltipMinerWeekly: (weeksLabel) =>
      `Estimated weekly rewards per miner, paid for ${weeksLabel}. May decrease as new farms join.`,
    tooltipDelegationWeekly:
      "Weekly reward breakdown (per delegation). Estimates update weekly as new farms and regions join the protocol.",
    pdRecovery: "PD Recovery",
    emissions: "Emissions",
    rewardScoreTooltip:
      "Combines deposit recovery and GLW emissions into expected rewards per dollar. Higher is better.",
    viewAudit: "View Audit",
    purchaseMiner: "Purchase Miner",
    delegate: (currency) => `Delegate ${currency}`,
    seeAllActivity: "See All Activity",
    previousListings: "Previous listings",
    nextListings: "Next listings",
    guideToDelegationTitle: "Guide to Delegation",
    guideToDelegationBody:
      "Delegate your GLW to fund solar farms. Earn GLW emissions and gradually recover your delegated tokens over 100 weeks based on farm efficiency.",
    howMinersWorkTitle: "How Miners Work",
    howMinersWorkBody:
      `Buy "Solar Miners" with USDC. They earn GLW emissions tokens over the farm's remaining reward schedule based on real-world electricity generation.`,
    learnMore: "Learn more",
    beReadyTitle: "Be ready for Tuesday launchpad windows.",
    beReadyBody:
      "Launchpad listings open in sGCTL at Tuesday 1:00 AM ET, then shift to GLW at Tuesday 1:00 PM ET. Listings created after 1:00 AM ET join at the 1:00 PM ET GLW release.",
  },

  blogFeatured: {
    category: "Protocol",
    readTime: "7 min read",
    authorRole: "Chief Scientist",
    publishedAtLabel: "Jan 29, 2026",
    title: "Delegate or Mine? Capital Efficiency in the Glow Economy",
    description:
      "Optimizing your participation and rewards in the on-chain solar economy",
  },

  newsletter: {
    kicker: "Newsletter",
    title: "Stay in the loop.",
    description:
      "Join our monthly newsletter for Glow's latest updates on solar innovation, protocol developments, and impact stories.",
    successMessage: "You're on the list!",
    subscribeAria: "Subscribe",
    placeholder: "name@example.com",
    toastSuccess: "Welcome to the inner circle!",
    toastGenericError: "Something went wrong",
    fallbackError: "Failed to subscribe",
  },

  discord: {
    kicker: "Community",
    online: "ONLINE",
    title: "Join the conversation in Discord.",
    description:
      "Engage in founder-led discussions, meet like-minded users, and have your questions answered by the team.",
    membersCount: "7k+ Members",
    membersSubtitle: "Global community",
    alwaysOn: "24/7 Community",
    alwaysOnSubtitle: "Ask questions and get help",
    joinAria: "Join the Glow Discord (opens in a new tab)",
  },

  globalLeaderboard: {
    title: "Impact Leaderboard",
    topBadge: "Top 3",
    unableToLoad: "Unable to load leaderboard.",
    noData: "No leaderboard data yet.",
    firstPlace: "1st Place",
    totalPoints: "Total Points",
    glowWorth: "Glow Worth",
    seeFullLeaderboard: "See Full Leaderboard",
  },

  communityActivity: {
    title: "Recently Funded Farms",
    seeAllActivity: "See All Activity",
    noRecentFarms: "No recently funded farms",
    score: "Score",
    dialogTitle: "Recent Activity",
    duration: {
      oneDay: "1 day",
      days: (n) => `${n} days`,
      oneHour: "1 hour",
      hours: (n) => `${n} hours`,
      oneMin: "1 min",
      mins: (n) => `${n} mins`,
      underOneMin: "<1 min",
    },
  },

  faq: {
    widgetTitle: "Glow FAQ",
    widgetTag: "Documentation",
    selectQuestion: "Select a question",
    items: [
      {
        id: "item-1",
        q: "What is Glow?",
        paragraphs: [
          "Glow is a solar mining crypto protocol that helps fund the construction of real-world solar farms.",
          "Solar farms compete to displace the most carbon per dollar of electricity revenue.",
          "Unlike traditional carbon credits, Glow specifically identifies solar opportunities that deliver the greatest impact (CO2 offset) per dollar of funding.",
        ],
      },
      {
        id: "item-2",
        q: "What is GLW and why does it matter?",
        paragraphs: [
          "GLW is the utility token of the ecosystem. It serves two main purposes:",
        ],
        bullets: [
          {
            label: "Incentive:",
            text: "Solar farms earn GLW as they produce clean energy.",
          },
          {
            label: "Governance:",
            text: "It is used to vote on which farms receive funding.",
          },
        ],
      },
      {
        id: "item-3",
        q: 'What does "delegating GLW" mean?',
        paragraphs: [
          "Delegating is a vetting mechanism. Solar farms need to prove efficiency to get funding.",
        ],
        callout:
          `GLW holders "vouch" for specific farms by delegating tokens. If the farm is efficient, you earn yield. If it is inefficient, you may forfeit tokens.`,
      },
      {
        id: "item-4",
        q: 'What is a "Glow miner"?',
        paragraphs: [
          "A Glow miner is a digital representation of a real-world solar installation.",
          "Purchasable with USDC, it earns GLW emissions tokens for 99 weeks based on the electricity the physical farm generates. It bridges DeFi liquidity with physical infrastructure.",
        ],
      },
      {
        id: "item-5",
        q: "Should I delegate or mine?",
        paragraphs: [
          "It depends on what you hold. If you already have GLW, delegation is the most capital-efficient path: you earn two reward streams (deposit recovery + protocol emissions) while keeping your tokens.",
          "If you hold USDC or ETH and want to accumulate GLW over time, mining positions may offer a discounted entry. Selling GLW to buy miners forfeits the deposit recovery stream entirely, making it harder to rebuild your position, especially if the protocol grows.",
        ],
      },
      {
        id: "item-6",
        q: "What is the Impact Leaderboard?",
        paragraphs: [
          "The Impact Leaderboard ranks wallets by Glow Impact Score — a points system designed to reward the actions that most directly grow onchain climate impact (especially steering via staked GCTL).",
        ],
      },
    ],
  },

  protocolMetrics: {
    glwPrice: "GLW Price",
    currentSpotPrice: "Current spot price",
    marketCap: "Market Cap",
    circulatingSupply: "Circulating supply",
    glwDelegated: "GLW Delegated",
    ofCirculatingSupply: "of circulating supply",
    viewAllStats: "View All Stats",
    deepDiveSubtitle: "Deep dive into protocol metrics",
    chartTitle: "New Solar Farms & Protocol Deposit",
    chartSubtitle: "Onboarded in the last 3 months",
    lastThreeMonths: "Last 3 Months",
    chartYAxisFarmsLabel: "Farms",
    chartYAxisPdLabel: "PD ($)",
    chartConfigFarmsLabel: "Farms",
    chartConfigPdLabel: "Protocol Deposit ($)",
    tooltipProtocolDeposit: "Protocol Deposit",
    tooltipFarmsOnboarded: "Farms Onboarded",
    emptyChart: "No new farms in this period",
  },

  walletWidget: {
    title: "Your Wallet",
    swap: "Swap",
    send: "Send",
  },

  rankWidget: {
    title: "Impact Score",
    totalPoints: "Total points",
    emptyPoints: "— pts",
    rank: "Rank",
    percentile: "Percentile",
    topPercentile: (value) => `Top ${value}`,
    belowTopPercentile: (value) => `Below Top ${value}`,
    connectWalletKicker: "Connect your wallet",
    connectWalletBody: "Connect your wallet to see your points and rank.",
    loadFailedToast: "Failed to load Impact Score",
    rankUp: "Rank Up",
    mintAndStakeGctl: "Mint & stake GCTL",
    breakdown: "Breakdown",
    leaderboard: "Leaderboard",
    inviteFriends: "Invite Friends",
    invitesWithPoints: (points) => `Invites (+${points})`,
  },

  netWorthWidget: {
    title: "Glow Worth",
    breakdown: "Breakdown",
    priceChart: "Price Chart",
    thisWeek: "this week",
    connectWalletPrompt: "Connect your wallet to Begin.",
    tooltipCurrentPrefix: (date) => `Current · ${date}`,
    tooltipWeekWithDate: (week, date) => `Week ${week} · ${date}`,
    tooltipWeek: (week) => `Week ${week}`,
    tooltipFallback: "GLW worth",
    tooltipLiquid: "Liquid",
    tooltipDelegatedRecovery: "Delegated + recovery",
    tooltipUnclaimed: "Unclaimed",
  },

  recentActivity: {
    viewAll: "View All",
    dialogTitle: "Recent Activity",
    title: "Recent Activity",
    live: "Live",
    kpiTotal: "Total",
    kpiTransactions: "transactions",
    kpiDelegations: "Delegations",
    kpiDelegationsSub: "made",
    kpiMiners: "Miners",
    kpiMinersSub: "purchased",
    kpiClaimed: "Claimed",
    kpiClaimedSub: "GLW",
    emptyTitle: "No recent activity",
    emptyBody: "Your transactions will appear here.",
    toastTxUnavailable: "Transaction hash not available for this activity.",
    ariaViewTx: "View transaction",
    epochBadge: (n) => `Epoch ${n}`,
    regionFallback: (id) => `Region ${id}`,
    regionGeneric: "Region",
    launchpadLabel: "Launchpad",
    minerLabel: "Miner",
    swap: "Swap",
    pillFilled: "Filled",
    pillPctFilled: (n) => `${n}% filled`,
    pillPd: "PD",
    pillEmissions: "Emissions",
    pillBuy: "Buy",
    pillSell: "Sell",
    claimedTitleSingle: (amount, token) => `Claimed ${amount} ${token}`,
    claimedTitleMulti: "Claimed rewards",
    weekN: (n) => `Week ${n}`,
    mintedTitle: (gctl) => `Minted ${gctl} GCTL`,
    mintedSubtitle: (original, currency) => `From ${original} ${currency}`,
    stakedTitle: (gctl) => `Staked ${gctl} GCTL`,
    unstakingTitle: (gctl) => `Unstaking ${gctl} GCTL`,
    stakedSubtitle: (region) => `In ${region}`,
    unstakingSubtitle: (region) => `From ${region}`,
    delegatedTitle: (amount, currency) => `Delegated ${amount} ${currency}`,
    purchasedMinersTitle: (n) => `Purchased ${n} miners`,
    purchasedMinersSubtitle: (amount, currency) => `${amount} ${currency}`,
    swappedGlwToUsdg: (glw, usdg) => `Swapped ${glw} GLW → ${usdg} USDG`,
    swappedUsdgToGlw: (usdg, glw) => `Swapped ${usdg} USDG → ${glw} GLW`,
    glwUsdgPool: "GLW/USDG pool",
  },

  impactAccumulator: {
    titleSkeleton: "My Power Plant",
    title: "IMPACT ACCUMULATOR",
    viewAssets: "View Assets",
    liveCapacity: "Live Capacity",
    infrastructureEquivalent: "Infrastructure Equivalent",
    panelsUnit: "Panels",
    progressToPanel: (n) => `Progress to Panel #${n}`,
    getMorePanels: "Get more panels",
    boostYourPoints: "Boost your points",
    connectPrompt: "Connect your wallet to see your impact.",
    connectBody: "Start accumulating real solar infrastructure.",
  },

  portfolioSummary: {
    title: "Mining Summary",
    delegatedAssets: "Delegated Assets",
    delegatedGlw: "Delegated GLW",
    delegatedTooltip:
      "Active launchpad principal across GLW and SGCTL, net of recovered rewards when available.",
    activeMiners: "Active Miners",
    activeDelegations: "Active Delegations",
  },

  rewardsWidget: {
    title: "Rewards",
    nextClaim: "Next Claim",
    connectToView: "Connect to view",
    unableToLoad: "Unable to load",
    availableNow: "Available Now",
    nextClaimChip: "next claim:",
    seeRewards: "See Rewards",
    noRewards: "No Rewards",
    dialogSrOnlyTitle: "Claim Rewards",
  },

  gctlHeatmap: {
    title: "Glow Control (GCTL)",
    titleShort: "Glow Control",
    titleTooltip: "Your governance influence over the solar grid.",
    disconnectedHeading: "Steer Solar Rewards",
    disconnectedBody:
      "Direct GLW emissions to regions and earn 3 points per GLW.",
    zeroHoldingsTitleReadOnly: "No GCTL Holdings",
    zeroHoldingsTitle: "Direct Global Emissions",
    zeroHoldingsBodyReadOnly: "This wallet has no GCTL staked.",
    zeroHoldingsBody: "Decide where solar gets built.",
    gamificationHook: "Earn",
    gamificationPoints: "3 Points per GLW Steered",
    mintAndStake: "Mint & Stake GCTL",
    boost: "Boost",
    myHoldings: "My Holdings",
    liquidSuffix: "Liquid",
    activeSuffix: "Active",
    steeringScore: "Steering Score",
    pts: "Pts",
    perGlwRate: "+3 pts / GLW rate",
    activeStakes: "Active Stakes",
    impactColumn: "Impact",
    noActiveSteering: "No Active Steering",
    stakeToDirect: "Stake GCTL to Direct Emissions",
    unusedInfluence: "Unused Influence",
    stakeFooter: (amount) => (amount ? `Stake ${amount} GCTL` : "Stake GCTL"),
    showLess: "Show Less",
    showMore: (n) => `Show ${n} More`,
    rowGctlStakedSuffix: (amount) => `${amount} GCTL Staked`,
    rowGlwPerWeek: "GLW/wk",
    rowDirectingPct: (pct) => `Directing ${pct}% of Region`,
    rowDirectingEmissions: "Directing Emissions",
  },

  myFarms: {
    positionMiner: "miner",
    positionDelegation: "delegation",
    positionGeneric: "position",
    firstFundsTooltip:
      "Rewards are posted after the protocol week closes on Sunday and auditors review the batch. Funds then stay locked for a 3-week on-chain finalization window before the first claim opens.",
    firstFundsAria: "Why first funds are delayed",
    statusOwnership: (position) => `Your ${position} is confirmed`,
    statusStartsEarning: (position) => `Your ${position} starts earning now`,
    statusEarning: (position) => `Your ${position} is earning`,
    statusClaimable: (position) => `Your ${position} is claimable`,
    helperEpoch:
      "Rewards start after Sunday close. Claiming opens after posting and finalization.",
    helperAudit:
      "Rewards are being prepared and audited before they are posted on-chain.",
    helperFinalization:
      "Rewards are posted on-chain. The 3-week protection window is still running.",
    helperClaimable: "Your first batch is available now in Rewards.",
    badgeOwned: "Owned",
    badgeClaimReady: "Claim Ready",
    badgeEarningSoon: "Earning Soon",
    badgePending: "Pending",
    timelineLabelFirstFunds: "First funds available",
    timelineLabelFundsAvailable: "Funds available",
    timelineValueNow: "Now",
    nextMilestoneStartsEarning: "Starts earning",
    nextMilestoneFundsAvailable: "Funds available",
    nextMilestoneStartedEarning: "Started earning",
    stepWeekCloses: "Week closes",
    stepAudited: "Audited & posted",
    stepFirstFunds: "First funds available",
    whatHappensNext: "What Happens Next",
    nextStep: "Next step",
    openRewards: "Open Rewards",
    modalStatusLabel: "Status",
    modalStartsEarning: "Starts Earning",
    modalAuditedPosted: "Audited & Posted",
    typeMiner: "Miner",
    typeDelegation: "Delegation",
    typeRewards: "Rewards",
    typeInProgress: "In Progress",
    fundingProgress: "Funding Progress",
    costLabel: "Cost",
    delegatedLabel: "Delegated",
    estWeekly: "Est. Weekly",
    viewDetails: "View Details",
    active: "Active",
    statusLabel: "Status",
    processing: "Processing purchase",
    wksFormat: (active, total) => `${active} / ${total} wks`,
    readyToClaim: "Ready to claim",
    calculating: "Calculating",
    earned: "Earned",
    lastWeek: "Last Week",
    lastWeekPrefix: "Last week:",
    timelineText: (active, total) => `Timeline: ${active} / ${total} wks`,
    costText: (amount) => `Cost: ${amount}`,
    delegatedText: (amount) => `Delegated: ${amount}`,
    progressText: (pct) => `${pct}% Progress`,
    farmOverview: "Farm Overview",
    closeAria: "Close",
    initialCost: "Initial Cost",
    totalDelegated: "Total Delegated",
    lifetimeEarnings: "Lifetime Earnings",
    estWeeklyRewards: "Est. Weekly Rewards",
    timelineCard: "Timeline",
    timelineTotal: (total) => `${total} wks total`,
    wksUnit: "wks",
    rewardsBreakdown: "Rewards Breakdown",
    protocolDeposit: "Protocol Deposit",
    protocolDepositRecoveredIn: (asset) => `Recovered in ${asset}`,
    protocolDepositRecoveredCapital: "Recovered capital",
    emissions: "Emissions",
    emissionsProduction: "Production rewards",
    totalValue: "Total Value",
    weeklyHistory: "Weekly History",
    tableWeek: "Week",
    tablePd: "PD",
    tableEmission: "Emission",
    tableTotal: "Total",
    listItem: "Item",
    listStatus: "Status",
    listActive: "Active",
    listCost: "Cost",
    listEarned: "Earned",
    listLastWeek: "Last Week",
    listProgress: "Progress",
    listInProgressStatus: "In Progress",
    listProcessing: "Processing",
    listPending: "Pending",
    sortBy: "Sort by",
    sortDefault: "Default",
    sortNewest: "Newest",
    sortAlphabetical: "Name (A-Z)",
    sortSize: "Size (Highest)",
    sortPlaceholder: "Sort by...",
    viewDefault: "Default",
    viewCompact: "Compact",
    viewMosaic: "Mosaic",
    viewList: "List",
    unableToLoad: "Unable to load farms",
    noFarmsFound: "No farms found for this wallet",
    imgMain: (name) => `${name} main`,
    imgNumber: (name, n) => `${name} ${n}`,
    seeAudit: "See audit",
    fallbackRegion: (id) => `Region ${id}`,
    fallbackFarmName: (idShort) => `Farm ${idShort}`,
    fallbackZone: "Launchpad",
  },

  solarFarm: {
    title: "Glow Mining",
    viewDetails: "View Details",
    currentWeeklyPayout: "Current Weekly Payout",
    latestWeeklyEarnings: "Latest Weekly Earnings",
    estWeeklyRewards: "Est. Weekly Rewards",
    assetLabel: "Asset",
    miners: "Miners",
    delegations: "Delegations",
    other: "Other",
    connectWalletKicker: "Connect your wallet",
    connectWalletBody: "Connect your wallet to view mining performance.",
    errorUnableToLoad: "Unable to load rewards breakdown",
    retry: "Retry",
    noActiveStreamsTitle: "No Active Solar Streams",
    noActiveStreamsBody:
      "Your portfolio is currently dormant. Delegate GLW to generate weekly GLW rewards.",
    buyMiners: "Buy Miners",
    delegateGlw: "Delegate GLW",
    browseLaunchpad: "Browse Launchpad",
    nextBatchIn: "Next batch in",
    howMiningWorks: "How Mining Works",
    howMiningWorksBody: "Learn about cash incentives & yield.",
    guideDelegation: "Guide to Delegation",
    guideDelegationBody: "Learn about deposit recovery & surplus.",
    farmDetailsAria: "Open farm performance details",
    earned: "Earned",
    pendingBadge: "STARTS SOON",
    inProgressBadge: "IN PROGRESS",
    pendingLabel: "Pending",
    inProgressLabel: "In Progress",
    percentFilled: (pct) => `${pct}% filled`,
    costLabel: "Cost",
    delegatedLabel: "Delegated",
    estWeeklyCol: "Est. Weekly",
    fundingLabel: "Funding",
    glwPerWeekEst: "GLW/wk est.",
    estInProgressRewardsTooltip: "Estimated in-progress rewards",
    estAbbrev: "Est.",
  },

  solarCollector: {
    dialogTitle: "How Solar Footprint Works",
    cardHeading: "Verified Solar Footprint",
    cardSubheading: "Real farms • real capacity",
    mainDescription:
      "Each time a farm is funded, its physical capacity is distributed across the network. Your share is based on your Impact Power in that farm’s region for the given week.",
    impactPowerLabel: "Impact Power",
    impactPowerDescription:
      "Direct Points + Glow Worth Points. Direct points come from emissions rewards, steering, and vault participation. Glow Worth is distributed by each region’s emission share.",
    whatToExpect: "What to Expect",
    expectItem1Title: "Panels grow with new farms",
    expectItem1Body: "Every 400W captured becomes one completed panel.",
    expectItem2Title: "Regional share matters",
    expectItem2Body:
      "Your influence is measured per region based on the week the farm is funded.",
    expectItem3Title: "Completed weeks only",
    expectItem3Body: "New farms appear once the protocol week is completed.",
    gotIt: "Got it",
    sectionTitle: "Verified Solar Footprint",
    sectionTitleTooltip:
      "Your verified connection to physical solar infrastructure. Based on your participation in completed V2 farms across the network.",
    learnMore: "Learn more",
    homesPowered: "Homes Powered",
    lightbulbs: "Lightbulbs",
    homesTooltip:
      "Estimated number of U.S. homes that could be continuously powered by your solar capacity, assuming an 18% capacity factor and 1.17 kW average load per home.",
    lightbulbsTooltip:
      "Estimated number of LED lightbulbs (9W) that could be continuously powered by your solar capacity.",
    homesUnit: "homes",
    bulbsUnit: "bulbs",
    energyPerYear: "Energy / Year",
    energyPerYearTooltip:
      "Estimated annual clean energy production based on the physical capacity of your captured panels and an estimated 18% average capacity factor.",
    treesEquivalent: "Trees Equivalent",
    treesEquivalentTooltip:
      "The number of mature trees required to sequester the same amount of CO₂ offset by your clean energy production (based on 1,000 lb CO₂/MWh and 0.022 tonnes/year per tree).",
    treesUnit: "trees",
    panelLabel: (n) => `Panel #${n}`,
    panelsCompleted: (n) => `${n} panel${n !== 1 ? "s" : ""} completed`,
    emptyFootprintTitle: "Your solar footprint will appear here",
    emptyFootprintBody:
      "When new farms onboard, your share of clean energy production will be tracked.",
    latestAddition: "Latest Addition",
    latestVerifiedAddition: "Latest Verified Addition",
    noRecentAdditions: "No recent farm additions yet",
    farmSize: "Farm Size",
    yourShare: "Your Share",
    captureLabel: "Capture",
    share: "Share",
    regionalDistribution: "Regional Energy Distribution",
    footprintGrowth: "Footprint Growth",
    cumulativeRegionalImpact: "Cumulative Regional Impact",
    wattsUnit: "Watts",
    weekFallback: (n) => `Week ${n}`,
    chartCleanGridProject: "Clean Grid Project (CGP)",
    chartUtah: "Utah (UT)",
    chartMissouri: "Missouri (MO)",
    chartColorado: "Colorado (CO)",
    chartTotalWatts: "Total Watts",
    chartNetworkShare: "Network Share",
    cleanGridRegion: "Clean Grid",
    cleanGridRegionCode: "CGP",
    multiplierLabel: "Multiplier",
    minerBadge: "Miner 3×",
    streakBadge: (streakBonus, weeks) =>
      `Streak +${streakBonus}× (${weeks}w)`,
    whenToday: "Today",
    whenYesterday: "Yesterday",
    whenDaysAgo: (n) => `${n} Days Ago`,
    whenLastWeek: "Last Week",
    whenWeeksAgo: (n) => `${n} Weeks Ago`,
  },

  weeklyActivity: {
    title: "Weekly Streak",
    wks: "Wks",
    currentStreak: "Current Streak",
    legendMiner: "Miner",
    legendDelegator: "Delegator",
    legendBoth: "Both",
    connectWallet: "Connect wallet",
    unableToLoad: "Unable to load weekly activity.",
    startYourStreak: "Delegate GLW or buy a miner to start your streak!",
    streakAtRiskBold: "Streak at risk!",
    streakAtRiskBody: "Delegate GLW or buy a miner this week.",
    streakCounter: (n) => `Streak ${n}/4`,
    currentMultiplier: "Current Multiplier",
    multiplierBase: "Base",
    multiplierMinerSuffix: "(Miner)",
    multiplierStreak: "Streak",
    multiplierTotal: "Total",
    weekStatus: {
      current: "Current",
      delegator: "Delegator",
      miner: "Miner",
      both: "Both",
      missed: "Missed",
    },
    weekDelegated: "Delegated",
    weekMiner: "Miner",
  },
};

const ko: WidgetStrings = {
  onboardingHero: {
    kicker: "Glow가 처음이신가요? 여기서 시작하세요",
    quotePre: '"세상 모든 사람이',
    quoteHighlight: "$20의 GLW",
    quotePost: '를 소유한다면, 2030년까지 화석연료를 없앨 수 있습니다."',
    attribution: "데이비드 보릭, CEO",
    buyGlw: "GLW 구매",
  },

  launchpadStatus: {
    launchpadTitle: "Glow 런치패드",
    newMinersIn: "새로운 마이너까지...",
    getReady: "준비하세요",
    newMiningCenterListingIn: "새 마이닝 센터 오픈까지...",
    newSolarFarmListingIn: "새 태양광 발전소 등록까지...",
    newListingsIn: "다음 등록까지",
    viewMarketplace: "마켓플레이스 보기",
    buyGlw: "GLW 구매",
    tabAll: "전체",
    tabDelegations: "위임",
    tabDelegationsShort: "위임",
    tabMiners: "마이너",
    minersLiveDelegationsPre: "마이너는 현재 오픈되어 있습니다. 위임은 ",
    minersLiveDelegationsPost: "에 시작됩니다.",
    noListings: "현재 이용 가능한 항목이 없습니다.",
    statusUnavailable: "현재 상태를 불러올 수 없습니다.",
    miner: "마이너",
    delegation: "위임",
    soldOut: "판매 완료",
    advancedStats: "상세 통계",
    statsShort: "통계",
    unnamedFarm: "이름 없는 발전소",
    unknownRegion: "알 수 없는 지역",
    total: "총액",
    delegated: "위임됨",
    price: "가격",
    amount: "금액",
    free: "무료",
    filled: "완료됨",
    leftCount: (remaining, total) => `${remaining}/${total} 남음`,
    soldIn: "판매 소요",
    toFill: "완판까지",
    estWeekly: "주간 예상",
    unavailable: "이용 불가",
    score: "점수",
    rewardScore: "리워드 점수",
    for100Weeks: "100주 동안",
    forMinerWeeks: (label) => `${label} 동안`,
    tooltipMinerWeekly: (weeksLabel) =>
      `마이너당 주간 예상 리워드이며, ${weeksLabel} 동안 지급됩니다. 새 발전소가 합류하면 감소할 수 있습니다.`,
    tooltipDelegationWeekly:
      "위임 1건당 주간 리워드 구성입니다. 새 발전소와 지역이 프로토콜에 합류함에 따라 매주 업데이트됩니다.",
    pdRecovery: "PD 회수",
    emissions: "발행분",
    rewardScoreTooltip:
      "보증금 회수와 GLW 발행분을 결합해 달러당 예상 리워드를 산출합니다. 높을수록 좋습니다.",
    viewAudit: "감사 보기",
    purchaseMiner: "마이너 구매",
    delegate: (currency) => `${currency} 위임`,
    seeAllActivity: "전체 활동 보기",
    previousListings: "이전 목록",
    nextListings: "다음 목록",
    guideToDelegationTitle: "위임 가이드",
    guideToDelegationBody:
      "GLW를 위임해 태양광 발전소에 자금을 공급하세요. GLW 발행분을 획득하고, 발전소 효율에 따라 100주에 걸쳐 위임한 토큰을 점진적으로 회수합니다.",
    howMinersWorkTitle: "마이너 작동 방식",
    howMinersWorkBody:
      "USDC로 \"솔라 마이너\"를 구매하세요. 실제 전력 생산량을 기반으로 발전소의 남은 리워드 일정 동안 GLW 발행분 토큰을 획득합니다.",
    learnMore: "자세히 보기",
    beReadyTitle: "화요일 런치패드 오픈을 준비하세요.",
    beReadyBody:
      "런치패드 등록은 화요일 오전 1시(동부시간)에 sGCTL로 오픈되며, 이후 화요일 오후 1시(동부시간)에 GLW로 전환됩니다. 오전 1시(동부시간) 이후에 생성된 등록은 오후 1시(동부시간) GLW 오픈에 합류합니다.",
  },

  blogFeatured: {
    category: "프로토콜",
    readTime: "7분 읽기",
    authorRole: "최고 과학자",
    publishedAtLabel: "2026년 1월 29일",
    title: "위임할까, 마이닝할까? Glow 경제의 자본 효율성",
    description: "온체인 태양광 경제에서 참여와 리워드를 최적화하는 방법",
  },

  newsletter: {
    kicker: "뉴스레터",
    title: "소식을 놓치지 마세요.",
    description:
      "월간 뉴스레터에 가입하고 태양광 혁신, 프로토콜 업데이트, 임팩트 스토리 등 Glow의 최신 소식을 받아보세요.",
    successMessage: "구독이 완료되었습니다!",
    subscribeAria: "구독하기",
    placeholder: "name@example.com",
    toastSuccess: "이너 서클에 오신 것을 환영합니다!",
    toastGenericError: "문제가 발생했습니다",
    fallbackError: "구독에 실패했습니다",
  },

  discord: {
    kicker: "커뮤니티",
    online: "온라인",
    title: "Discord에서 대화에 참여하세요.",
    description:
      "창업자가 이끄는 토론에 참여하고, 같은 관심사를 가진 사용자들을 만나며, 팀에게 직접 질문하세요.",
    membersCount: "회원 7,000명+",
    membersSubtitle: "글로벌 커뮤니티",
    alwaysOn: "24시간 커뮤니티",
    alwaysOnSubtitle: "언제든 질문하고 도움을 받으세요",
    joinAria: "Glow Discord 참여 (새 탭에서 열림)",
  },

  globalLeaderboard: {
    title: "임팩트 리더보드",
    topBadge: "상위 3위",
    unableToLoad: "리더보드를 불러올 수 없습니다.",
    noData: "아직 리더보드 데이터가 없습니다.",
    firstPlace: "1위",
    totalPoints: "총 포인트",
    glowWorth: "Glow 자산",
    seeFullLeaderboard: "전체 리더보드 보기",
  },

  communityActivity: {
    title: "최근 펀딩된 발전소",
    seeAllActivity: "전체 활동 보기",
    noRecentFarms: "최근 펀딩된 발전소가 없습니다",
    score: "점수",
    dialogTitle: "최근 활동",
    duration: {
      oneDay: "1일",
      days: (n) => `${n}일`,
      oneHour: "1시간",
      hours: (n) => `${n}시간`,
      oneMin: "1분",
      mins: (n) => `${n}분`,
      underOneMin: "1분 미만",
    },
  },

  faq: {
    widgetTitle: "Glow FAQ",
    widgetTag: "문서",
    selectQuestion: "질문을 선택하세요",
    items: [
      {
        id: "item-1",
        q: "Glow란 무엇인가요?",
        paragraphs: [
          "Glow는 실제 태양광 발전소의 건설 자금을 지원하는 태양광 마이닝 크립토 프로토콜입니다.",
          "태양광 발전소는 전력 매출 1달러당 가장 많은 탄소를 상쇄하기 위해 경쟁합니다.",
          "기존 탄소 배출권과 달리, Glow는 투자 1달러당 가장 큰 임팩트(CO2 상쇄)를 제공하는 태양광 기회를 구체적으로 식별합니다.",
        ],
      },
      {
        id: "item-2",
        q: "GLW란 무엇이며, 왜 중요한가요?",
        paragraphs: [
          "GLW는 이 생태계의 유틸리티 토큰입니다. 주로 두 가지 역할을 합니다:",
        ],
        bullets: [
          {
            label: "인센티브:",
            text: "태양광 발전소는 청정 에너지를 생산하며 GLW를 획득합니다.",
          },
          {
            label: "거버넌스:",
            text: "어느 발전소가 자금을 받을지 투표할 때 사용됩니다.",
          },
        ],
      },
      {
        id: "item-3",
        q: 'GLW를 "위임한다"는 것은 무슨 뜻인가요?',
        paragraphs: [
          "위임은 검증 장치입니다. 태양광 발전소는 자금을 받기 위해 효율성을 증명해야 합니다.",
        ],
        callout:
          "GLW 보유자는 특정 발전소에 토큰을 위임해 '보증'합니다. 발전소가 효율적이면 수익을 얻고, 비효율적이면 토큰을 잃을 수 있습니다.",
      },
      {
        id: "item-4",
        q: '"Glow 마이너"란 무엇인가요?',
        paragraphs: [
          "Glow 마이너는 실제 태양광 설비를 디지털로 표현한 것입니다.",
          "USDC로 구매할 수 있으며, 실제 발전소의 전력 생산량을 기반으로 99주 동안 GLW 발행분 토큰을 획득합니다. DeFi 유동성과 실물 인프라를 연결합니다.",
        ],
      },
      {
        id: "item-5",
        q: "위임과 마이닝 중 무엇이 좋은가요?",
        paragraphs: [
          "보유한 자산에 따라 다릅니다. 이미 GLW를 보유하고 있다면 위임이 가장 자본 효율적입니다. 토큰을 유지하면서 두 가지 리워드 스트림(보증금 회수 + 프로토콜 발행분)을 얻을 수 있습니다.",
          "USDC나 ETH를 보유하고 있고 시간을 두고 GLW를 축적하고 싶다면 마이너 포지션이 할인된 진입점이 될 수 있습니다. 다만 GLW를 팔아 마이너를 사면 보증금 회수 스트림을 완전히 포기하게 되므로, 프로토콜이 성장할수록 포지션을 다시 쌓기 어려워질 수 있습니다.",
        ],
      },
      {
        id: "item-6",
        q: "임팩트 리더보드는 무엇인가요?",
        paragraphs: [
          "임팩트 리더보드는 Glow 임팩트 점수를 기준으로 지갑을 순위로 정렬합니다. 온체인 기후 임팩트를 가장 직접적으로 성장시키는 활동(특히 스테이킹된 GCTL을 통한 방향 조정)에 보상하도록 설계된 포인트 시스템입니다.",
        ],
      },
    ],
  },

  protocolMetrics: {
    glwPrice: "GLW 가격",
    currentSpotPrice: "현재 스팟 가격",
    marketCap: "시가총액",
    circulatingSupply: "유통량",
    glwDelegated: "위임된 GLW",
    ofCirculatingSupply: "유통량 대비",
    viewAllStats: "모든 통계 보기",
    deepDiveSubtitle: "프로토콜 지표 자세히 보기",
    chartTitle: "신규 태양광 발전소 및 프로토콜 보증금",
    chartSubtitle: "최근 3개월간 등록",
    lastThreeMonths: "최근 3개월",
    chartYAxisFarmsLabel: "발전소",
    chartYAxisPdLabel: "PD ($)",
    chartConfigFarmsLabel: "발전소",
    chartConfigPdLabel: "프로토콜 보증금 ($)",
    tooltipProtocolDeposit: "프로토콜 보증금",
    tooltipFarmsOnboarded: "등록된 발전소",
    emptyChart: "해당 기간에 신규 발전소가 없습니다",
  },

  walletWidget: {
    title: "내 지갑",
    swap: "스왑",
    send: "보내기",
  },

  rankWidget: {
    title: "임팩트 점수",
    totalPoints: "총 포인트",
    emptyPoints: "— pts",
    rank: "순위",
    percentile: "퍼센타일",
    topPercentile: (value) => `상위 ${value}`,
    belowTopPercentile: (value) => `상위 ${value} 아래`,
    connectWalletKicker: "지갑 연결",
    connectWalletBody: "포인트와 순위를 확인하려면 지갑을 연결하세요.",
    loadFailedToast: "임팩트 점수를 불러오지 못했습니다",
    rankUp: "순위 올리기",
    mintAndStakeGctl: "GCTL 발행 및 스테이킹",
    breakdown: "상세 내역",
    leaderboard: "리더보드",
    inviteFriends: "친구 초대",
    invitesWithPoints: (points) => `초대 (+${points})`,
  },

  netWorthWidget: {
    title: "Glow 자산",
    breakdown: "상세 내역",
    priceChart: "가격 차트",
    thisWeek: "이번 주",
    connectWalletPrompt: "시작하려면 지갑을 연결하세요.",
    tooltipCurrentPrefix: (date) => `현재 · ${date}`,
    tooltipWeekWithDate: (week, date) => `${week}주 · ${date}`,
    tooltipWeek: (week) => `${week}주`,
    tooltipFallback: "GLW 자산",
    tooltipLiquid: "유동",
    tooltipDelegatedRecovery: "위임 + 회수",
    tooltipUnclaimed: "미청구",
  },

  recentActivity: {
    viewAll: "전체 보기",
    dialogTitle: "최근 활동",
    title: "최근 활동",
    live: "실시간",
    kpiTotal: "총",
    kpiTransactions: "건 트랜잭션",
    kpiDelegations: "위임",
    kpiDelegationsSub: "건",
    kpiMiners: "마이너",
    kpiMinersSub: "대 구매",
    kpiClaimed: "클레임",
    kpiClaimedSub: "GLW",
    emptyTitle: "최근 활동이 없습니다",
    emptyBody: "트랜잭션이 여기에 표시됩니다.",
    toastTxUnavailable: "이 활동의 트랜잭션 해시를 확인할 수 없습니다.",
    ariaViewTx: "트랜잭션 보기",
    epochBadge: (n) => `에포크 ${n}`,
    regionFallback: (id) => `지역 ${id}`,
    regionGeneric: "지역",
    launchpadLabel: "런치패드",
    minerLabel: "마이너",
    swap: "스왑",
    pillFilled: "채움 완료",
    pillPctFilled: (n) => `${n}% 채움`,
    pillPd: "PD",
    pillEmissions: "발행분",
    pillBuy: "매수",
    pillSell: "매도",
    claimedTitleSingle: (amount, token) => `${amount} ${token} 클레임`,
    claimedTitleMulti: "리워드 클레임",
    weekN: (n) => `${n}주차`,
    mintedTitle: (gctl) => `${gctl} GCTL 민팅`,
    mintedSubtitle: (original, currency) => `${original} ${currency} 사용`,
    stakedTitle: (gctl) => `${gctl} GCTL 스테이크`,
    unstakingTitle: (gctl) => `${gctl} GCTL 언스테이크 중`,
    stakedSubtitle: (region) => `${region}에`,
    unstakingSubtitle: (region) => `${region}에서`,
    delegatedTitle: (amount, currency) => `${amount} ${currency} 위임`,
    purchasedMinersTitle: (n) => `마이너 ${n}대 구매`,
    purchasedMinersSubtitle: (amount, currency) => `${amount} ${currency}`,
    swappedGlwToUsdg: (glw, usdg) => `${glw} GLW → ${usdg} USDG 스왑`,
    swappedUsdgToGlw: (usdg, glw) => `${usdg} USDG → ${glw} GLW 스왑`,
    glwUsdgPool: "GLW/USDG 풀",
  },

  impactAccumulator: {
    titleSkeleton: "내 발전소",
    title: "임팩트 누적기",
    viewAssets: "자산 보기",
    liveCapacity: "실시간 용량",
    infrastructureEquivalent: "인프라 환산",
    panelsUnit: "패널",
    progressToPanel: (n) => `패널 #${n}까지 진행률`,
    getMorePanels: "패널 더 확보",
    boostYourPoints: "포인트 부스트",
    connectPrompt: "임팩트를 확인하려면 지갑을 연결하세요.",
    connectBody: "실제 태양광 인프라를 누적해 보세요.",
  },

  portfolioSummary: {
    title: "마이닝 요약",
    delegatedAssets: "위임된 자산",
    delegatedGlw: "위임된 GLW",
    delegatedTooltip:
      "GLW와 SGCTL의 활성 런치패드 원금(회수된 리워드는 제외).",
    activeMiners: "활성 마이너",
    activeDelegations: "활성 위임",
  },

  rewardsWidget: {
    title: "리워드",
    nextClaim: "다음 클레임",
    connectToView: "보려면 연결하세요",
    unableToLoad: "불러올 수 없습니다",
    availableNow: "지금 사용 가능",
    nextClaimChip: "다음 클레임:",
    seeRewards: "리워드 보기",
    noRewards: "리워드 없음",
    dialogSrOnlyTitle: "리워드 클레임",
  },

  gctlHeatmap: {
    title: "Glow Control (GCTL)",
    titleShort: "Glow Control",
    titleTooltip: "태양광 그리드에 대한 거버넌스 영향력.",
    disconnectedHeading: "태양광 리워드 방향 조정",
    disconnectedBody:
      "지역으로 GLW 발행분을 유도하고 GLW당 3포인트를 획득하세요.",
    zeroHoldingsTitleReadOnly: "GCTL 보유 없음",
    zeroHoldingsTitle: "글로벌 발행분 방향 조정",
    zeroHoldingsBodyReadOnly: "이 지갑에는 스테이킹된 GCTL이 없습니다.",
    zeroHoldingsBody: "태양광이 어디에 건설될지 결정하세요.",
    gamificationHook: "획득:",
    gamificationPoints: "GLW 방향 조정당 3포인트",
    mintAndStake: "GCTL 발행 및 스테이킹",
    boost: "부스트",
    myHoldings: "내 보유량",
    liquidSuffix: "유동",
    activeSuffix: "활성",
    steeringScore: "스티어링 점수",
    pts: "포인트",
    perGlwRate: "GLW당 +3 포인트",
    activeStakes: "활성 스테이크",
    impactColumn: "임팩트",
    noActiveSteering: "활성 스티어링 없음",
    stakeToDirect: "GCTL을 스테이킹하여 발행분을 유도하세요",
    unusedInfluence: "미사용 영향력",
    stakeFooter: (amount) => (amount ? `${amount} GCTL 스테이킹` : "GCTL 스테이킹"),
    showLess: "간략히 보기",
    showMore: (n) => `${n}개 더 보기`,
    rowGctlStakedSuffix: (amount) => `${amount} GCTL 스테이킹됨`,
    rowGlwPerWeek: "GLW/주",
    rowDirectingPct: (pct) => `지역의 ${pct}% 방향 조정`,
    rowDirectingEmissions: "발행분 방향 조정",
  },

  myFarms: {
    positionMiner: "마이너",
    positionDelegation: "위임",
    positionGeneric: "포지션",
    firstFundsTooltip:
      "리워드는 일요일에 프로토콜 주차가 마감되고 감사자가 배치를 검토한 뒤 게시됩니다. 이후 자금은 3주간 온체인 최종 확정 기간 동안 잠겨 있다가 첫 클레임이 열립니다.",
    firstFundsAria: "첫 자금 지급이 지연되는 이유",
    statusOwnership: (position) => `${position} 소유가 확인되었습니다`,
    statusStartsEarning: (position) => `${position}이(가) 지금 수익을 시작합니다`,
    statusEarning: (position) => `${position}이(가) 수익을 내고 있습니다`,
    statusClaimable: (position) => `${position}을(를) 클레임할 수 있습니다`,
    helperEpoch:
      "리워드는 일요일 마감 후 시작됩니다. 게시와 최종 확정 이후에 클레임이 열립니다.",
    helperAudit:
      "리워드가 온체인에 게시되기 전에 준비 및 감사 중입니다.",
    helperFinalization:
      "리워드가 온체인에 게시되었습니다. 3주 보호 기간이 아직 진행 중입니다.",
    helperClaimable: "첫 배치를 이제 리워드에서 확인할 수 있습니다.",
    badgeOwned: "소유",
    badgeClaimReady: "클레임 가능",
    badgeEarningSoon: "곧 수익 시작",
    badgePending: "대기 중",
    timelineLabelFirstFunds: "첫 자금 지급",
    timelineLabelFundsAvailable: "자금 지급 가능",
    timelineValueNow: "지금",
    nextMilestoneStartsEarning: "수익 시작",
    nextMilestoneFundsAvailable: "자금 지급 가능",
    nextMilestoneStartedEarning: "수익 시작됨",
    stepWeekCloses: "주차 마감",
    stepAudited: "감사 및 게시",
    stepFirstFunds: "첫 자금 지급",
    whatHappensNext: "다음 단계",
    nextStep: "다음 단계",
    openRewards: "리워드 열기",
    modalStatusLabel: "상태",
    modalStartsEarning: "수익 시작",
    modalAuditedPosted: "감사 및 게시",
    typeMiner: "마이너",
    typeDelegation: "위임",
    typeRewards: "리워드",
    typeInProgress: "진행 중",
    fundingProgress: "펀딩 진행률",
    costLabel: "비용",
    delegatedLabel: "위임됨",
    estWeekly: "주간 예상",
    viewDetails: "상세 보기",
    active: "활성",
    statusLabel: "상태",
    processing: "구매 처리 중",
    wksFormat: (active, total) => `${active} / ${total}주`,
    readyToClaim: "클레임 준비됨",
    calculating: "계산 중",
    earned: "획득",
    lastWeek: "지난주",
    lastWeekPrefix: "지난주:",
    timelineText: (active, total) => `일정: ${active} / ${total}주`,
    costText: (amount) => `비용: ${amount}`,
    delegatedText: (amount) => `위임: ${amount}`,
    progressText: (pct) => `${pct}% 진행`,
    farmOverview: "발전소 개요",
    closeAria: "닫기",
    initialCost: "초기 비용",
    totalDelegated: "총 위임액",
    lifetimeEarnings: "누적 수익",
    estWeeklyRewards: "주간 예상 리워드",
    timelineCard: "일정",
    timelineTotal: (total) => `총 ${total}주`,
    wksUnit: "주",
    rewardsBreakdown: "리워드 상세 내역",
    protocolDeposit: "프로토콜 보증금",
    protocolDepositRecoveredIn: (asset) => `${asset}로 회수`,
    protocolDepositRecoveredCapital: "회수된 자본",
    emissions: "발행분",
    emissionsProduction: "생산 리워드",
    totalValue: "총 가치",
    weeklyHistory: "주간 이력",
    tableWeek: "주차",
    tablePd: "PD",
    tableEmission: "발행",
    tableTotal: "합계",
    listItem: "항목",
    listStatus: "상태",
    listActive: "활성",
    listCost: "비용",
    listEarned: "획득",
    listLastWeek: "지난주",
    listProgress: "진행률",
    listInProgressStatus: "진행 중",
    listProcessing: "처리 중",
    listPending: "대기 중",
    sortBy: "정렬 기준",
    sortDefault: "기본",
    sortNewest: "최신순",
    sortAlphabetical: "이름 (가나다)",
    sortSize: "크기 (큰 순)",
    sortPlaceholder: "정렬...",
    viewDefault: "기본",
    viewCompact: "컴팩트",
    viewMosaic: "모자이크",
    viewList: "목록",
    unableToLoad: "발전소를 불러올 수 없습니다",
    noFarmsFound: "이 지갑에 해당하는 발전소가 없습니다",
    imgMain: (name) => `${name} 메인`,
    imgNumber: (name, n) => `${name} ${n}`,
    seeAudit: "감사 보기",
    fallbackRegion: (id) => `지역 ${id}`,
    fallbackFarmName: (idShort) => `발전소 ${idShort}`,
    fallbackZone: "런치패드",
  },

  solarFarm: {
    title: "Glow 마이닝",
    viewDetails: "상세 보기",
    currentWeeklyPayout: "이번 주 지급액",
    latestWeeklyEarnings: "최근 주간 수익",
    estWeeklyRewards: "주간 예상 리워드",
    assetLabel: "자산",
    miners: "마이너",
    delegations: "위임",
    other: "기타",
    connectWalletKicker: "지갑 연결",
    connectWalletBody: "마이닝 성과를 보려면 지갑을 연결하세요.",
    errorUnableToLoad: "리워드 상세 내역을 불러올 수 없습니다",
    retry: "다시 시도",
    noActiveStreamsTitle: "활성 태양광 스트림 없음",
    noActiveStreamsBody:
      "현재 포트폴리오가 활동하지 않습니다. GLW를 위임하여 주간 GLW 리워드를 만들어보세요.",
    buyMiners: "마이너 구매",
    delegateGlw: "GLW 위임",
    browseLaunchpad: "런치패드 둘러보기",
    nextBatchIn: "다음 배치까지",
    howMiningWorks: "마이닝 작동 방식",
    howMiningWorksBody: "캐시 인센티브와 수익에 대해 알아보세요.",
    guideDelegation: "위임 가이드",
    guideDelegationBody: "보증금 회수와 잉여에 대해 알아보세요.",
    farmDetailsAria: "발전소 실적 상세 열기",
    earned: "획득",
    pendingBadge: "곧 시작",
    inProgressBadge: "진행 중",
    pendingLabel: "대기 중",
    inProgressLabel: "진행 중",
    percentFilled: (pct) => `${pct}% 충전됨`,
    costLabel: "비용",
    delegatedLabel: "위임됨",
    estWeeklyCol: "주간 예상",
    fundingLabel: "펀딩",
    glwPerWeekEst: "GLW/주 예상",
    estInProgressRewardsTooltip: "진행 중인 예상 리워드",
    estAbbrev: "예상",
  },

  solarCollector: {
    dialogTitle: "솔라 풋프린트 작동 방식",
    cardHeading: "검증된 솔라 풋프린트",
    cardSubheading: "실제 발전소 · 실제 용량",
    mainDescription:
      "발전소가 펀딩될 때마다 해당 물리적 용량이 네트워크에 분배됩니다. 해당 주차에 그 발전소의 지역에서 본인이 보유한 임팩트 파워에 따라 본인의 지분이 결정됩니다.",
    impactPowerLabel: "임팩트 파워",
    impactPowerDescription:
      "직접 포인트 + Glow 자산 포인트. 직접 포인트는 발행분 리워드, 스티어링, 볼트 참여에서 획득합니다. Glow 자산은 각 지역의 발행분 지분에 따라 분배됩니다.",
    whatToExpect: "확인 포인트",
    expectItem1Title: "새 발전소와 함께 패널이 늘어납니다",
    expectItem1Body: "400W를 획득할 때마다 패널 한 개가 완성됩니다.",
    expectItem2Title: "지역별 지분이 중요합니다",
    expectItem2Body:
      "펀딩된 주차를 기준으로 각 지역별 본인의 영향력이 측정됩니다.",
    expectItem3Title: "완료된 주차만 반영",
    expectItem3Body: "프로토콜 주차가 완료되면 새 발전소가 표시됩니다.",
    gotIt: "확인",
    sectionTitle: "검증된 솔라 풋프린트",
    sectionTitleTooltip:
      "실제 태양광 인프라와의 검증된 연결. 네트워크 전반에서 완료된 V2 발전소에 대한 본인의 참여를 기반으로 합니다.",
    learnMore: "자세히 보기",
    homesPowered: "전력 공급 가구",
    lightbulbs: "전구",
    homesTooltip:
      "설비 이용률 18%와 가구당 평균 부하 1.17kW를 가정했을 때 본인의 태양광 용량으로 지속적으로 전력을 공급할 수 있는 미국 가구 수 추정치입니다.",
    lightbulbsTooltip:
      "본인의 태양광 용량으로 지속적으로 켤 수 있는 LED 전구(9W) 수 추정치입니다.",
    homesUnit: "가구",
    bulbsUnit: "개",
    energyPerYear: "연간 에너지",
    energyPerYearTooltip:
      "획득한 패널의 물리적 용량과 평균 설비 이용률 18%를 기반으로 추정한 연간 청정 에너지 생산량입니다.",
    treesEquivalent: "나무 환산",
    treesEquivalentTooltip:
      "본인의 청정 에너지 생산으로 상쇄된 CO₂ 양만큼을 흡수하는 데 필요한 다 자란 나무 수입니다 (MWh당 1,000파운드 CO₂, 나무 1그루당 연간 0.022톤 기준).",
    treesUnit: "그루",
    panelLabel: (n) => `패널 #${n}`,
    panelsCompleted: (n) => `패널 ${n}개 완성`,
    emptyFootprintTitle: "여기에 본인의 솔라 풋프린트가 표시됩니다",
    emptyFootprintBody:
      "새 발전소가 등록되면 본인의 청정 에너지 생산 지분이 추적됩니다.",
    latestAddition: "최근 추가",
    latestVerifiedAddition: "최근 검증된 추가",
    noRecentAdditions: "아직 최근 추가된 발전소가 없습니다",
    farmSize: "발전소 규모",
    yourShare: "본인 지분",
    captureLabel: "획득",
    share: "공유",
    regionalDistribution: "지역별 에너지 분포",
    footprintGrowth: "풋프린트 성장",
    cumulativeRegionalImpact: "지역별 누적 임팩트",
    wattsUnit: "와트",
    weekFallback: (n) => `${n}주`,
    chartCleanGridProject: "클린 그리드 프로젝트 (CGP)",
    chartUtah: "유타 (UT)",
    chartMissouri: "미주리 (MO)",
    chartColorado: "콜로라도 (CO)",
    chartTotalWatts: "총 와트",
    chartNetworkShare: "네트워크 지분",
    cleanGridRegion: "클린 그리드",
    cleanGridRegionCode: "CGP",
    multiplierLabel: "배수",
    minerBadge: "마이너 3×",
    streakBadge: (streakBonus, weeks) =>
      `연속 +${streakBonus}× (${weeks}주)`,
    whenToday: "오늘",
    whenYesterday: "어제",
    whenDaysAgo: (n) => `${n}일 전`,
    whenLastWeek: "지난주",
    whenWeeksAgo: (n) => `${n}주 전`,
  },

  weeklyActivity: {
    title: "주간 연속 기록",
    wks: "주",
    currentStreak: "현재 연속 기록",
    legendMiner: "마이너",
    legendDelegator: "위임자",
    legendBoth: "둘 다",
    connectWallet: "지갑 연결",
    unableToLoad: "주간 활동을 불러올 수 없습니다.",
    startYourStreak: "GLW를 위임하거나 마이너를 구매해 연속 기록을 시작하세요!",
    streakAtRiskBold: "연속 기록 위험!",
    streakAtRiskBody: "이번 주에 GLW를 위임하거나 마이너를 구매하세요.",
    streakCounter: (n) => `연속 기록 ${n}/4`,
    currentMultiplier: "현재 배수",
    multiplierBase: "기본",
    multiplierMinerSuffix: "(마이너)",
    multiplierStreak: "연속",
    multiplierTotal: "합계",
    weekStatus: {
      current: "이번 주",
      delegator: "위임자",
      miner: "마이너",
      both: "둘 다",
      missed: "누락",
    },
    weekDelegated: "위임됨",
    weekMiner: "마이너",
  },
};

export const widgetsTranslations: Record<Lang, WidgetStrings> = {
  en,
  ko,
};
