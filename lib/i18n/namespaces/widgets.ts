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
    assetFilterAll: string;
    assetFilterGlw: string;
    assetFilterSgctl: string;
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
    leftSingleCount: (remaining: number) => string;
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
    // V2 miner early access
    earlyAccessBadge: string;
    earlyAccessActive: (minutes: number) => string;
    earlyAccessAvailable: (minutes: number) => string;
    earlyAccessUnlock: string;
    earlyAccessUnlocking: string;
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
    activity: string;
  };

  rankWidget: {
    title: string;
    totalPoints: string;
    availablePoints: string;
    wattsLabel: string;
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
    invitesWithPoints: () => string;
    // Weekly streak panel
    streakWeeks: (weeks: number) => string;
    streakNone: string;
    streakStart: string;
    streakLockedIn: string;
    streakKeepGoing: string;
    streakMaxed: (points: string) => string;
    streakMaxedAtRisk: (points: string) => string;
    streakPts: string;
    streakWouldEarn: string;
    streakProjectedThisWeek: string;
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
    tooltipDelegated: string;
    tooltipPendingDelegation: string;
    tooltipPendingRecovery: string;
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
    wattsAwarded: string;
    today: string;
    yesterday: string;
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
    mintGctl: string;
    myHoldings: string;
    freeToStake: string;
    liquidSuffix: string;
    activeSuffix: string;
    availableSuffix: string;
    lockedSuffix: string;
    availableTooltip: string;
    lockedTooltip: string;
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
    typeShopMiner: string;
    shopMinerSource: string;
    miningCenterLabel: string;
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
    pointsCost: (amount: string) => string;
    delegatedText: (amount: string) => string;
    /** Note shown on an already-owned farm's card when a recent purchase merged
     * into it (so no separate pending card appears). `amount` is a preformatted
     * figure like "$1,596" or "144 GLW", or null when it can't be isolated. */
    recentlyAddedNote: (amount: string | null) => string;
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
    activelyDelegated: string;
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
    tonsCo2: string;
    tonsCo2Tooltip: string;
    tonsUnit: string;
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
    streakCounter: (n: number, cap: number) => string;
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
  educationCarousel: {
    glwPriceLabel: string;
    glwPriceSubtext: string;
    priceChart: string;
    launchpadCta: string;
    minersCta: string;
    pointsShopTitle: string;
    pointsShopDesc: string;
    pointsShopCta: string;
    leaderboardTitle: string;
    leaderboardDesc: string;
    leaderboardCta: string;
    previousSlide: string;
    nextSlide: string;
    goToSlide: (index: number) => string;
    slides: {
      token: { kicker: string; title: string; body: string };
      delegation: { kicker: string; title: string; body: string };
      rewards: { kicker: string; title: string; body: string };
      mining: { kicker: string; title: string; body: string };
      resources: { kicker: string; title: string; body: string };
    };
  };
}

const en: WidgetStrings = {
  onboardingHero: {
    kicker: "Join Glow",
    quotePre: "To participate on the launchpad, we recommend having",
    quoteHighlight: "$500 of GLW",
    quotePost: ".",
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
    assetFilterAll: "All assets",
    assetFilterGlw: "GLW",
    assetFilterSgctl: "sGCTL",
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
    leftSingleCount: (remaining) => `${remaining} left`,
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
    howMinersWorkBody: `Buy "Solar Miners" with USDC. They earn GLW emissions tokens over the farm's remaining reward schedule based on real-world electricity generation.`,
    learnMore: "Learn more",
    beReadyTitle: "Launchpad listings all open on Tuesday at 9:00 AM ET",
    beReadyBody:
      "Launchpad listings and miners all open at Tuesday 9:00 AM ET. GLW and sGCTL delegations go live together in the same window.",
    earlyAccessBadge: "Early access",
    earlyAccessActive: (minutes) =>
      `Early access active. Listings open ${minutes} minutes early.`,
    earlyAccessAvailable: (minutes) =>
      `You have early access. Unlock to see listings ${minutes} minutes early.`,
    earlyAccessUnlock: "Unlock early access",
    earlyAccessUnlocking: "Unlocking",
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
        callout: `GLW holders "vouch" for specific farms by delegating tokens. If the farm is efficient, you earn yield. If it is inefficient, you may forfeit tokens.`,
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
          "The Impact Leaderboard ranks wallets by measured solar impact and spendable points earned from eligible protocol activity.",
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
    activity: "Activity",
  },

  rankWidget: {
    title: "Watts",
    totalPoints: "Total points",
    availablePoints: "Available points",
    wattsLabel: "Watts",
    emptyPoints: "— pts",
    rank: "Rank",
    percentile: "Percentile",
    topPercentile: (value) => `Top ${value}`,
    belowTopPercentile: (value) => `Below Top ${value}`,
    connectWalletKicker: "Connect your wallet",
    connectWalletBody: "Connect your wallet to see your watts and rank.",
    loadFailedToast: "Failed to load watts",
    rankUp: "Rank Up",
    mintAndStakeGctl: "Mint & stake GCTL",
    breakdown: "Breakdown",
    leaderboard: "Leaderboard",
    inviteFriends: "Invite Friends",
    invitesWithPoints: () => `Invite Friends`,
    streakWeeks: (weeks) => `${weeks}-week streak`,
    streakNone: "No active streak",
    streakStart: "Take any action this week to start",
    streakLockedIn: "You're covered this week",
    streakKeepGoing: "Act this week to keep it going",
    streakMaxed: (points) => `Maxed out · ${points} pts/week`,
    streakMaxedAtRisk: (points) =>
      `Maxed (${points} pts/wk) · act this week to keep it`,
    streakPts: "pts",
    streakWouldEarn: "if you act",
    streakProjectedThisWeek: "Projected this week",
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
    tooltipDelegated: "Actively delegated",
    tooltipPendingDelegation: "Pending delegation",
    tooltipPendingRecovery: "Pending recovery",
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
    wattsAwarded: "Watts awarded",
    today: "Today",
    yesterday: "Yesterday",
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
    delegatedAssets: "Actively Delegated",
    delegatedGlw: "Delegated GLW",
    delegatedTooltip:
      "Active launchpad principal across GLW and SGCTL, net of recovered rewards. Includes recent on-chain delegations that have not yet been folded into the protocol's split history, so this can be slightly higher than (initial − recovered) for the first few days after a new delegation.",
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
      "Stake GCTL to direct regional rewards, then delegate sGCTL to earn points.",
    zeroHoldingsTitleReadOnly: "No GCTL Holdings",
    zeroHoldingsTitle: "Direct Global Emissions",
    zeroHoldingsBodyReadOnly: "This wallet has no GCTL staked.",
    zeroHoldingsBody: "Decide where solar gets built.",
    gamificationHook: "Earn",
    gamificationPoints: "Points from sGCTL delegation",
    mintAndStake: "Mint & Stake GCTL",
    mintGctl: "Mint GCTL",
    myHoldings: "My Holdings",
    freeToStake: "Free to stake",
    liquidSuffix: "Liquid",
    activeSuffix: "Active",
    availableSuffix: "Available",
    lockedSuffix: "Locked",
    availableTooltip:
      "Active sGCTL that can be moved to another region at any time.",
    lockedTooltip:
      "sGCTL locked in vault deposits — still earns steering rewards but can't be redelegated until released.",
    steeringScore: "Steering Status",
    pts: "Pts",
    perGlwRate: "Delegate sGCTL to earn points",
    activeStakes: "Active Stakes",
    impactColumn: "Status",
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
    typeShopMiner: "Shop miner",
    shopMinerSource: "Points shop",
    miningCenterLabel: "Mining center",
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
    pointsCost: (amount) => `${amount} pts`,
    delegatedText: (amount) => `Delegated: ${amount}`,
    recentlyAddedNote: (amount) =>
      amount ? `+${amount} added recently` : "Recently added",
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
    activelyDelegated: "Actively Delegated",
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
    cardHeading: "Your Verified Solar Footprint",
    cardSubheading: "Farm-backed watts, attributed to you",
    mainDescription:
      "Your Solar Footprint is the clean solar capacity attributed to your wallet, measured in watts. It comes from real funded farms and farm-backed impact assets, so it tells the story of the solar capacity your activity helped support.",
    impactPowerLabel: "Attributed impact",
    impactPowerDescription:
      "Watts are attributed through eligible network participation: delegated GLW, delegated sGCTL, miner activity, referrals, and points-shop watt redemptions. The watt is the primary unit; the associated impact comes with it, including Tons of CO₂ today and derived equivalents like energy, homes powered, and trees.",
    whatToExpect: "How it works",
    expectItem1Title: "Watts come from real farms",
    expectItem1Body:
      "Each watt is backed by funded solar capacity and tied to farm and region data where available.",
    expectItem2Title: "The impact comes with the watts",
    expectItem2Body:
      "When watts are attributed to you, Glow also carries the connected impact story: Tons of CO₂ today, plus estimates like energy produced, homes powered, and adult trees equivalent.",
    expectItem3Title: "Your footprint updates over time",
    expectItem3Body:
      "As farms fund, rewards settle, and shop redemptions complete, your attributed watts and impact totals update.",
    gotIt: "Got it",
    sectionTitle: "Verified Solar Footprint",
    sectionTitleTooltip:
      "Your verified connection to physical solar infrastructure, based on farm-backed watts and impact assets attributed to your wallet.",
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
      "Estimated annual clean energy production based on your attributed solar capacity and an estimated 18% average capacity factor.",
    treesEquivalent: "Trees Equivalent",
    treesEquivalentTooltip:
      "The number of mature trees required to sequester the same amount of CO₂ offset by your clean energy production (based on 1,000 lb CO₂/MWh and 0.022 tonnes/year per tree).",
    treesUnit: "trees",
    tonsCo2: "Tons of CO₂",
    tonsCo2Tooltip:
      "Verified lifetime CO₂ displacement attributed to your wallet, based on the carbon credits earned by the solar farms your watts are connected to.",
    tonsUnit: "t",
    panelLabel: (n) => `Capacity block #${n}`,
    panelsCompleted: (n) =>
      `${n} capacity block${n !== 1 ? "s" : ""} attributed`,
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
    streakBadge: (streakBonus, weeks) => `Streak +${streakBonus}× (${weeks}w)`,
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
    streakCounter: (n, cap) => `Streak ${n}/${cap}`,
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
  educationCarousel: {
    glwPriceLabel: "GLW price",
    glwPriceSubtext: "Live spot price, sourced on-chain.",
    priceChart: "Price chart",
    launchpadCta: "Explore the launchpad",
    minersCta: "Browse miners",
    pointsShopTitle: "Points Shop",
    pointsShopDesc: "Redeem the points you earn for real rewards.",
    pointsShopCta: "Open shop",
    leaderboardTitle: "Impact Leaderboard",
    leaderboardDesc: "See top wallets ranked by watts & tons of CO₂.",
    leaderboardCta: "View leaderboard",
    previousSlide: "Previous slide",
    nextSlide: "Next slide",
    goToSlide: (index) => `Go to slide ${index}`,
    slides: {
      token: {
        kicker: "The token",
        title: "Buy GLW, the fuel of the Glow economy.",
        body: "Glow runs on the GLW token, which is used to advocate for solar farms using a process called delegation.",
      },
      delegation: {
        kicker: "Delegation",
        title: "Delegate GLW to Solar Farms",
        body: "Each solar farm produces a variable amount of rewards based on how competitive it is. By delegating GLW to a farm you endorse its participation in Glow, and you earn rewards (or penalties) based on how competitive that farm is.",
      },
      rewards: {
        kicker: "Rewards",
        title: "Earn Points, and Impact",
        body: "Delegating GLW earns you points that can be redeemed in the points shop. You also receive impact: the ‘watts’ you earn represent real-world energy production, and ‘tons of CO₂’ represent real emissions eliminated by the farm you powered up.",
      },
      mining: {
        kicker: "Mining",
        title: "Become a GLW Miner",
        body: "The fastest way to earn GLW is to buy it on the market, but you can also earn it weekly by purchasing a miner. Each miner is tied to a single real-world solar farm and collects some of the GLW rewards that farm produces.",
      },
      resources: {
        kicker: "Resources",
        title: "Learn More",
        body: "Dig into live protocol stats and long-form guides on how the Glow economy works.",
      },
    },
  },
};

const ko: WidgetStrings = {
  onboardingHero: {
    kicker: "Glow에 참여하기",
    quotePre: "런치패드에 참여하려면",
    quoteHighlight: "$500의 GLW",
    quotePost: "를 보유하는 것을 권장합니다.",
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
    assetFilterAll: "모든 자산",
    assetFilterGlw: "GLW",
    assetFilterSgctl: "sGCTL",
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
    leftSingleCount: (remaining) => `${remaining} 남음`,
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
      'USDC로 "솔라 마이너"를 구매하세요. 실제 전력 생산량을 기반으로 발전소의 남은 리워드 일정 동안 GLW 발행분 토큰을 획득합니다.',
    learnMore: "자세히 보기",
    beReadyTitle: "모든 런치패드 리스팅은 화요일 오전 9시(ET)에 오픈됩니다",
    beReadyBody:
      "런치패드 등록과 마이너는 모두 화요일 오전 9시(동부시간)에 오픈됩니다. GLW와 sGCTL 위임이 동일한 창에서 함께 시작됩니다.",
    earlyAccessBadge: "얼리 액세스",
    earlyAccessActive: (minutes) =>
      `얼리 액세스가 활성화되었습니다. 리스팅이 ${minutes}분 일찍 열립니다.`,
    earlyAccessAvailable: (minutes) =>
      `얼리 액세스 권한이 있습니다. 잠금을 해제하면 리스팅을 ${minutes}분 일찍 볼 수 있습니다.`,
    earlyAccessUnlock: "얼리 액세스 잠금 해제",
    earlyAccessUnlocking: "잠금 해제 중",
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
    activity: "활동",
  },

  rankWidget: {
    title: "와트",
    totalPoints: "총 포인트",
    availablePoints: "사용 가능한 포인트",
    wattsLabel: "와트",
    emptyPoints: "— pts",
    rank: "순위",
    percentile: "퍼센타일",
    topPercentile: (value) => `상위 ${value}`,
    belowTopPercentile: (value) => `상위 ${value} 아래`,
    connectWalletKicker: "지갑 연결",
    connectWalletBody: "와트와 순위를 확인하려면 지갑을 연결하세요.",
    loadFailedToast: "와트를 불러오지 못했습니다",
    rankUp: "순위 올리기",
    mintAndStakeGctl: "GCTL 발행 및 스테이킹",
    breakdown: "상세 내역",
    leaderboard: "리더보드",
    inviteFriends: "친구 초대",
    invitesWithPoints: () => `친구 초대`,
    streakWeeks: (weeks) => `${weeks}주 연속`,
    streakNone: "진행 중인 연속 기록 없음",
    streakStart: "이번 주에 활동하여 시작하세요",
    streakLockedIn: "이번 주는 적립 완료",
    streakKeepGoing: "이번 주에 활동하여 연속 유지",
    streakMaxed: (points) => `최대치 · 주당 ${points} pts`,
    streakMaxedAtRisk: (points) =>
      `최대치 (주당 ${points} pts) · 이번 주에 활동하여 유지`,
    streakPts: "pts",
    streakWouldEarn: "활동 시",
    streakProjectedThisWeek: "이번 주 예상",
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
    tooltipDelegated: "활성 위임",
    tooltipPendingDelegation: "위임 대기분",
    tooltipPendingRecovery: "회수 대기분",
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
    wattsAwarded: "와트 적립",
    today: "오늘",
    yesterday: "어제",
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
    delegatedAssets: "활성 위임",
    delegatedGlw: "위임된 GLW",
    delegatedTooltip:
      "GLW와 SGCTL의 활성 런치패드 원금(회수된 리워드는 제외). 아직 프로토콜 스플릿 히스토리에 반영되지 않은 최근 온체인 위임이 포함되므로, 새 위임 후 며칠 동안은 (초기 − 회수)보다 약간 높을 수 있습니다.",
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
      "GCTL을 스테이킹해 지역 리워드 방향을 정하고 sGCTL을 위임해 포인트를 얻으세요.",
    zeroHoldingsTitleReadOnly: "GCTL 보유 없음",
    zeroHoldingsTitle: "글로벌 발행분 방향 조정",
    zeroHoldingsBodyReadOnly: "이 지갑에는 스테이킹된 GCTL이 없습니다.",
    zeroHoldingsBody: "태양광이 어디에 건설될지 결정하세요.",
    gamificationHook: "획득:",
    gamificationPoints: "sGCTL 위임 포인트",
    mintAndStake: "GCTL 발행 및 스테이킹",
    mintGctl: "GCTL 발행",
    myHoldings: "내 보유량",
    freeToStake: "스테이킹 가능",
    liquidSuffix: "유동",
    activeSuffix: "활성",
    availableSuffix: "사용 가능",
    lockedSuffix: "잠김",
    availableTooltip: "언제든지 다른 지역으로 이동할 수 있는 활성 sGCTL입니다.",
    lockedTooltip:
      "볼트 예치에 잠긴 sGCTL — 스티어링 보상은 계속 받지만 해제되기 전까지 재위임할 수 없습니다.",
    steeringScore: "스티어링 상태",
    pts: "포인트",
    perGlwRate: "sGCTL을 위임해 포인트 적립",
    activeStakes: "활성 스테이크",
    impactColumn: "상태",
    noActiveSteering: "활성 스티어링 없음",
    stakeToDirect: "GCTL을 스테이킹하여 발행분을 유도하세요",
    unusedInfluence: "미사용 영향력",
    stakeFooter: (amount) =>
      amount ? `${amount} GCTL 스테이킹` : "GCTL 스테이킹",
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
    statusStartsEarning: (position) =>
      `${position}이(가) 지금 수익을 시작합니다`,
    statusEarning: (position) => `${position}이(가) 수익을 내고 있습니다`,
    statusClaimable: (position) => `${position}을(를) 클레임할 수 있습니다`,
    helperEpoch:
      "리워드는 일요일 마감 후 시작됩니다. 게시와 최종 확정 이후에 클레임이 열립니다.",
    helperAudit: "리워드가 온체인에 게시되기 전에 준비 및 감사 중입니다.",
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
    typeShopMiner: "샵 마이너",
    shopMinerSource: "포인트 샵",
    miningCenterLabel: "마이닝 센터",
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
    pointsCost: (amount) => `${amount} 포인트`,
    delegatedText: (amount) => `위임: ${amount}`,
    recentlyAddedNote: (amount) =>
      amount ? `+${amount} 최근 추가됨` : "최근 추가됨",
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
    activelyDelegated: "활성 위임",
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
    cardHeading: "내 검증된 솔라 풋프린트",
    cardSubheading: "발전소 기반 와트, 내 지갑에 귀속",
    mainDescription:
      "솔라 풋프린트는 지갑에 귀속된 청정 태양광 용량이며 와트로 측정됩니다. 실제 펀딩된 발전소와 발전소 기반 임팩트 자산에서 오기 때문에, 내가 지원한 태양광 용량의 이야기를 보여줍니다.",
    impactPowerLabel: "귀속된 임팩트",
    impactPowerDescription:
      "와트는 자격 있는 네트워크 참여를 통해 귀속됩니다. GLW 위임, 위임된 sGCTL, 마이너 활동, 추천, 포인트 샵 와트 교환이 포함됩니다. 와트가 기본 단위이며, 연결된 임팩트가 함께 따라옵니다. 현재는 CO₂ 톤과 에너지, 전력 공급 가구, 나무 환산 같은 추정치가 포함됩니다.",
    whatToExpect: "작동 방식",
    expectItem1Title: "와트는 실제 발전소에서 옵니다",
    expectItem1Body:
      "각 와트는 펀딩된 태양광 용량을 기반으로 하며 가능한 경우 발전소와 지역 데이터에 연결됩니다.",
    expectItem2Title: "임팩트는 와트와 함께 옵니다",
    expectItem2Body:
      "와트가 귀속될 때 Glow는 연결된 임팩트 이야기도 함께 보여줍니다. 현재는 CO₂ 톤과 생산 에너지, 전력 공급 가구, 성목 환산 추정치가 포함됩니다.",
    expectItem3Title: "풋프린트는 계속 업데이트됩니다",
    expectItem3Body:
      "발전소가 펀딩되고 리워드가 정산되며 샵 교환이 완료되면 귀속된 와트와 임팩트 합계가 업데이트됩니다.",
    gotIt: "확인",
    sectionTitle: "검증된 솔라 풋프린트",
    sectionTitleTooltip:
      "지갑에 귀속된 발전소 기반 와트와 임팩트 자산을 바탕으로 한 실제 태양광 인프라와의 검증된 연결입니다.",
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
      "귀속된 태양광 용량과 평균 설비 이용률 18%를 기반으로 추정한 연간 청정 에너지 생산량입니다.",
    tonsCo2: "CO₂ 톤",
    tonsCo2Tooltip:
      "지갑에 귀속된 검증된 누적 CO₂ 감축량으로, 보유 와트가 연결된 태양광 발전소가 획득한 탄소 크레딧을 기반으로 합니다.",
    tonsUnit: "t",
    treesEquivalent: "나무 환산",
    treesEquivalentTooltip:
      "본인의 청정 에너지 생산으로 상쇄된 CO₂ 양만큼을 흡수하는 데 필요한 다 자란 나무 수입니다 (MWh당 1,000파운드 CO₂, 나무 1그루당 연간 0.022톤 기준).",
    treesUnit: "그루",
    panelLabel: (n) => `용량 블록 #${n}`,
    panelsCompleted: (n) => `용량 블록 ${n}개 귀속`,
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
    streakBadge: (streakBonus, weeks) => `연속 +${streakBonus}× (${weeks}주)`,
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
    streakCounter: (n, cap) => `연속 기록 ${n}/${cap}`,
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
  educationCarousel: {
    glwPriceLabel: "GLW 가격",
    glwPriceSubtext: "실시간 현물 가격, 온체인 기준.",
    priceChart: "가격 차트",
    launchpadCta: "런치패드 둘러보기",
    minersCta: "마이너 둘러보기",
    pointsShopTitle: "포인트 샵",
    pointsShopDesc: "획득한 포인트를 실제 보상으로 교환하세요.",
    pointsShopCta: "샵 열기",
    leaderboardTitle: "임팩트 리더보드",
    leaderboardDesc: "와트와 이산화탄소 톤 기준 상위 지갑을 확인하세요.",
    leaderboardCta: "리더보드 보기",
    previousSlide: "이전 슬라이드",
    nextSlide: "다음 슬라이드",
    goToSlide: (index) => `슬라이드 ${index}(으)로 이동`,
    slides: {
      token: {
        kicker: "토큰",
        title: "GLW 구매 — 글로우 경제의 연료",
        body: "글로우는 GLW 토큰으로 작동하며, GLW는 위임이라는 과정을 통해 태양광 발전소를 지지하는 데 사용됩니다.",
      },
      delegation: {
        kicker: "위임",
        title: "태양광 발전소에 GLW 위임",
        body: "각 태양광 발전소는 경쟁력에 따라 가변적인 리워드를 생산합니다. 발전소에 GLW를 위임하면 해당 발전소의 글로우 참여를 지지하게 되며, 그 발전소의 경쟁력에 따라 리워드를 얻거나 페널티를 받습니다.",
      },
      rewards: {
        kicker: "리워드",
        title: "포인트와 임팩트 획득",
        body: "GLW를 위임하면 포인트 샵에서 사용할 수 있는 포인트를 획득합니다. 또한 임팩트를 받습니다. 획득한 ‘와트’는 실제 에너지 생산을, ‘이산화탄소 톤’은 지원한 발전소가 제거한 실제 탄소 배출량을 나타냅니다.",
      },
      mining: {
        kicker: "마이닝",
        title: "GLW 마이너 되기",
        body: "GLW를 가장 빠르게 얻는 방법은 시장에서 구매하는 것이지만, 마이너를 구매해 매주 GLW를 얻을 수도 있습니다. 각 마이너는 하나의 실제 태양광 발전소와 연결되어 해당 발전소가 생산하는 GLW 리워드의 일부를 수집합니다.",
      },
      resources: {
        kicker: "리소스",
        title: "더 알아보기",
        body: "실시간 프로토콜 통계와 글로우 경제의 작동 방식에 대한 심층 가이드를 확인하세요.",
      },
    },
  },
};

const zh: WidgetStrings = {
  onboardingHero: {
    kicker: "加入 Glow",
    quotePre: "若要参与启动板，我们建议持有",
    quoteHighlight: "$500 的 GLW",
    quotePost: "。",
    buyGlw: "购买 GLW",
  },

  launchpadStatus: {
    launchpadTitle: "Glow 启动板",
    newMinersIn: "新矿机倒计时...",
    getReady: "请做好准备",
    newMiningCenterListingIn: "新矿机中心上线倒计时...",
    newSolarFarmListingIn: "新太阳能农场上线倒计时...",
    newListingsIn: "新上线倒计时",
    viewMarketplace: "查看市场",
    buyGlw: "购买 GLW",
    tabAll: "全部",
    tabDelegations: "委托",
    tabDelegationsShort: "委托",
    tabMiners: "矿机",
    assetFilterAll: "全部资产",
    assetFilterGlw: "GLW",
    assetFilterSgctl: "sGCTL",
    minersLiveDelegationsPre: "矿机现已上线。委托将于 ",
    minersLiveDelegationsPost: " 开放。",
    noListings: "目前暂无可用项目。",
    statusUnavailable: "当前状态不可用。",
    miner: "矿机",
    delegation: "委托",
    soldOut: "已售罄",
    advancedStats: "高级数据",
    statsShort: "数据",
    unnamedFarm: "未命名农场",
    unknownRegion: "未知地区",
    total: "总额",
    delegated: "已委托",
    price: "价格",
    amount: "金额",
    free: "剩余",
    filled: "已认购",
    leftCount: (remaining, total) => `剩余 ${remaining}/${total}`,
    leftSingleCount: (remaining) => `剩余 ${remaining}`,
    soldIn: "售罄用时",
    toFill: "待认购",
    estWeekly: "预计每周",
    unavailable: "不可用",
    score: "评分",
    rewardScore: "奖励评分",
    for100Weeks: "持续 100 周",
    forMinerWeeks: (label) => `持续 ${label}`,
    tooltipMinerWeekly: (weeksLabel) =>
      `每台矿机的预计每周奖励，将在 ${weeksLabel} 内发放。随着新农场加入,数值可能会下降。`,
    tooltipDelegationWeekly:
      "每笔委托的每周奖励构成。随着新农场和地区加入协议,估算值每周更新。",
    pdRecovery: "PD 回收",
    emissions: "增发",
    rewardScoreTooltip:
      "将存款回收与 GLW 增发结合,衡量每美元的预期奖励。数值越高越好。",
    viewAudit: "查看审计",
    purchaseMiner: "购买矿机",
    delegate: (currency) => `委托 ${currency}`,
    seeAllActivity: "查看所有活动",
    previousListings: "上一批列表",
    nextListings: "下一批列表",
    guideToDelegationTitle: "委托指南",
    guideToDelegationBody:
      "委托您的 GLW 以资助太阳能农场。赚取 GLW 增发,并根据农场效率在 100 周内逐步收回您委托的代币。",
    howMinersWorkTitle: "矿机如何运作",
    howMinersWorkBody: `使用 USDC 购买"太阳能矿机"。它们将根据真实电力产出,在农场剩余的奖励周期内赚取 GLW 增发代币。`,
    learnMore: "了解更多",
    beReadyTitle: "所有启动板项目均于周二上午9:00（美东时间）开放",
    beReadyBody:
      "启动板列表和矿机均于美东时间周二上午 9:00 开放。GLW 与 sGCTL 委托在同一窗口同时上线。",
    earlyAccessBadge: "抢先体验",
    earlyAccessActive: (minutes) =>
      `抢先体验已激活。列表将提前 ${minutes} 分钟开放。`,
    earlyAccessAvailable: (minutes) =>
      `您拥有抢先体验权限。解锁后可提前 ${minutes} 分钟查看列表。`,
    earlyAccessUnlock: "解锁抢先体验",
    earlyAccessUnlocking: "解锁中",
  },

  blogFeatured: {
    category: "协议",
    readTime: "7 分钟阅读",
    authorRole: "首席科学家",
    publishedAtLabel: "2026 年 1 月 29 日",
    title: "委托还是挖矿?Glow 经济中的资本效率",
    description: "在链上太阳能经济中优化您的参与方式与奖励",
  },

  newsletter: {
    kicker: "通讯",
    title: "随时掌握最新动态。",
    description:
      "订阅我们的月度通讯,获取 Glow 在太阳能创新、协议进展和影响力故事方面的最新资讯。",
    successMessage: "您已成功订阅!",
    subscribeAria: "订阅",
    placeholder: "name@example.com",
    toastSuccess: "欢迎加入核心圈!",
    toastGenericError: "出现问题",
    fallbackError: "订阅失败",
  },

  discord: {
    kicker: "社区",
    online: "在线",
    title: "加入 Discord 上的对话。",
    description:
      "参与创始人主导的讨论,结识志同道合的用户,并由团队为您解答疑问。",
    membersCount: "7000+ 成员",
    membersSubtitle: "全球社区",
    alwaysOn: "24/7 社区",
    alwaysOnSubtitle: "提问并获得帮助",
    joinAria: "加入 Glow Discord(在新标签页中打开)",
  },

  globalLeaderboard: {
    title: "影响力榜",
    topBadge: "前三名",
    unableToLoad: "无法加载榜单。",
    noData: "暂无榜单数据。",
    firstPlace: "第一名",
    totalPoints: "总积分",
    glowWorth: "Glow 净值",
    seeFullLeaderboard: "查看完整榜单",
  },

  communityActivity: {
    title: "近期获资助的农场",
    seeAllActivity: "查看所有活动",
    noRecentFarms: "近期没有获资助的农场",
    score: "评分",
    dialogTitle: "近期活动",
    duration: {
      oneDay: "1 天",
      days: (n) => `${n} 天`,
      oneHour: "1 小时",
      hours: (n) => `${n} 小时`,
      oneMin: "1 分钟",
      mins: (n) => `${n} 分钟`,
      underOneMin: "<1 分钟",
    },
  },

  faq: {
    widgetTitle: "Glow 常见问题",
    widgetTag: "文档",
    selectQuestion: "请选择一个问题",
    items: [
      {
        id: "item-1",
        q: "什么是 Glow?",
        paragraphs: [
          "Glow 是一个太阳能挖矿加密协议,旨在为现实世界中太阳能农场的建设提供资金支持。",
          "太阳能农场之间相互竞争,以期在每美元电力收入下抵消最多的碳排放。",
          "与传统的碳信用不同,Glow 专门挖掘那些能在每一美元资金下带来最大影响力(CO2 抵消)的太阳能机会。",
        ],
      },
      {
        id: "item-2",
        q: "什么是 GLW,它为何重要?",
        paragraphs: ["GLW 是生态系统的实用代币,主要承担两项核心职能:"],
        bullets: [
          {
            label: "激励:",
            text: "太阳能农场在生产清洁能源的同时获得 GLW 奖励。",
          },
          {
            label: "治理:",
            text: "用于投票决定哪些农场可以获得资金支持。",
          },
        ],
      },
      {
        id: "item-3",
        q: '"委托 GLW"是什么意思?',
        paragraphs: [
          "委托是一种审核机制。太阳能农场需要证明自身效率才能获得资金。",
        ],
        callout: `GLW 持有者通过委托代币为特定农场"背书"。如果农场表现高效,您将获得收益;如果效率低下,您可能会损失代币。`,
      },
      {
        id: "item-4",
        q: '什么是"Glow 矿机"?',
        paragraphs: [
          "Glow 矿机是真实太阳能装置的数字化呈现。",
          "可使用 USDC 购买,根据实体农场的发电量,在 99 周内赚取 GLW 增发代币。它将 DeFi 流动性与实体基础设施连接起来。",
        ],
      },
      {
        id: "item-5",
        q: "我应该委托还是挖矿?",
        paragraphs: [
          "这取决于您持有什么。如果您已经持有 GLW,委托是资本效率最高的路径:您可以保留代币的同时获得两条奖励流(存款回收 + 协议增发)。",
          "如果您持有 USDC 或 ETH,并希望逐步积累 GLW,矿机仓位可能提供折扣入场。但卖出 GLW 来购买矿机会完全放弃存款回收流,使得在协议增长后重建仓位变得更加困难。",
        ],
      },
      {
        id: "item-6",
        q: "什么是影响力榜?",
        paragraphs: [
          "影响力榜根据 Glow 影响力评分对钱包进行排名。该积分体系旨在奖励最直接推动链上气候影响力增长的行为(尤其是通过质押 GCTL 进行方向引导)。",
        ],
      },
    ],
  },

  protocolMetrics: {
    glwPrice: "GLW 价格",
    currentSpotPrice: "当前现货价格",
    marketCap: "市值",
    circulatingSupply: "流通供应量",
    glwDelegated: "已委托 GLW",
    ofCirculatingSupply: "流通供应量占比",
    viewAllStats: "查看全部数据",
    deepDiveSubtitle: "深入了解协议指标",
    chartTitle: "新增太阳能农场与协议存款",
    chartSubtitle: "近 3 个月新增",
    lastThreeMonths: "近 3 个月",
    chartYAxisFarmsLabel: "农场",
    chartYAxisPdLabel: "PD ($)",
    chartConfigFarmsLabel: "农场",
    chartConfigPdLabel: "协议存款 ($)",
    tooltipProtocolDeposit: "协议存款",
    tooltipFarmsOnboarded: "已上线农场",
    emptyChart: "此期间内无新增农场",
  },

  walletWidget: {
    title: "我的钱包",
    swap: "兑换",
    activity: "活动",
  },

  rankWidget: {
    title: "瓦特",
    totalPoints: "总积分",
    availablePoints: "可用积分",
    wattsLabel: "瓦特",
    emptyPoints: "— 分",
    rank: "排名",
    percentile: "百分位",
    topPercentile: (value) => `前 ${value}`,
    belowTopPercentile: (value) => `低于前 ${value}`,
    connectWalletKicker: "连接您的钱包",
    connectWalletBody: "连接钱包以查看您的瓦特与排名。",
    loadFailedToast: "瓦特加载失败",
    rankUp: "提升排名",
    mintAndStakeGctl: "铸造并质押 GCTL",
    breakdown: "明细",
    leaderboard: "排行榜",
    inviteFriends: "邀请好友",
    invitesWithPoints: () => `邀请好友`,
    streakWeeks: (weeks) => `连续 ${weeks} 周`,
    streakNone: "暂无连续记录",
    streakStart: "本周采取任意操作即可开始",
    streakLockedIn: "本周已记录",
    streakKeepGoing: "本周采取操作以保持连续",
    streakMaxed: (points) => `已达上限 · 每周 ${points} 分`,
    streakMaxedAtRisk: (points) =>
      `已达上限(每周 ${points} 分)· 本周采取操作以保持`,
    streakPts: "分",
    streakWouldEarn: "若采取操作",
    streakProjectedThisWeek: "本周预计",
  },

  netWorthWidget: {
    title: "Glow 净值",
    breakdown: "明细",
    priceChart: "价格走势",
    thisWeek: "本周",
    connectWalletPrompt: "连接您的钱包开始使用。",
    tooltipCurrentPrefix: (date) => `当前 · ${date}`,
    tooltipWeekWithDate: (week, date) => `第 ${week} 周 · ${date}`,
    tooltipWeek: (week) => `第 ${week} 周`,
    tooltipFallback: "GLW 净值",
    tooltipLiquid: "流动",
    tooltipDelegated: "已委托",
    tooltipPendingDelegation: "待委托",
    tooltipPendingRecovery: "待回收",
    tooltipUnclaimed: "未领取",
  },

  recentActivity: {
    viewAll: "查看全部",
    dialogTitle: "近期活动",
    title: "近期活动",
    live: "实时",
    kpiTotal: "总计",
    kpiTransactions: "笔交易",
    kpiDelegations: "委托",
    kpiDelegationsSub: "笔",
    kpiMiners: "矿机",
    kpiMinersSub: "台已购",
    kpiClaimed: "已领取",
    kpiClaimedSub: "GLW",
    emptyTitle: "暂无近期活动",
    emptyBody: "您的交易将在此处显示。",
    toastTxUnavailable: "此活动的交易哈希不可用。",
    ariaViewTx: "查看交易",
    epochBadge: (n) => `第 ${n} 轮`,
    regionFallback: (id) => `地区 ${id}`,
    regionGeneric: "地区",
    launchpadLabel: "启动板",
    minerLabel: "矿机",
    swap: "兑换",
    pillFilled: "已认购",
    pillPctFilled: (n) => `认购 ${n}%`,
    pillPd: "PD",
    pillEmissions: "增发",
    pillBuy: "买入",
    pillSell: "卖出",
    claimedTitleSingle: (amount, token) => `已领取 ${amount} ${token}`,
    claimedTitleMulti: "已领取奖励",
    weekN: (n) => `第 ${n} 周`,
    mintedTitle: (gctl) => `已铸造 ${gctl} GCTL`,
    mintedSubtitle: (original, currency) => `来自 ${original} ${currency}`,
    stakedTitle: (gctl) => `已质押 ${gctl} GCTL`,
    unstakingTitle: (gctl) => `正在解除质押 ${gctl} GCTL`,
    stakedSubtitle: (region) => `于 ${region}`,
    unstakingSubtitle: (region) => `自 ${region}`,
    delegatedTitle: (amount, currency) => `已委托 ${amount} ${currency}`,
    purchasedMinersTitle: (n) => `已购买 ${n} 台矿机`,
    purchasedMinersSubtitle: (amount, currency) => `${amount} ${currency}`,
    swappedGlwToUsdg: (glw, usdg) => `已兑换 ${glw} GLW → ${usdg} USDG`,
    swappedUsdgToGlw: (usdg, glw) => `已兑换 ${usdg} USDG → ${glw} GLW`,
    glwUsdgPool: "GLW/USDG 池",
    wattsAwarded: "瓦特奖励",
    today: "今天",
    yesterday: "昨天",
  },

  impactAccumulator: {
    titleSkeleton: "我的发电厂",
    title: "影响力累积器",
    viewAssets: "查看资产",
    liveCapacity: "实时容量",
    infrastructureEquivalent: "基础设施等效",
    panelsUnit: "面板",
    progressToPanel: (n) => `第 ${n} 块面板进度`,
    getMorePanels: "获取更多面板",
    boostYourPoints: "提升您的积分",
    connectPrompt: "连接您的钱包以查看影响力。",
    connectBody: "开始累积真实的太阳能基础设施。",
  },

  portfolioSummary: {
    title: "挖矿摘要",
    delegatedAssets: "已委托",
    delegatedGlw: "已委托 GLW",
    delegatedTooltip:
      "GLW 与 SGCTL 在启动板的活跃本金,已扣除已回收奖励。包含尚未纳入协议拆分历史的近期链上委托,因此在新委托后的最初几天可能略高于(初始 − 已回收)。",
    activeMiners: "活跃矿机",
    activeDelegations: "活跃委托",
  },

  rewardsWidget: {
    title: "奖励",
    nextClaim: "下次领取",
    connectToView: "连接以查看",
    unableToLoad: "无法加载",
    availableNow: "现已可领",
    nextClaimChip: "下次领取:",
    seeRewards: "查看奖励",
    noRewards: "暂无奖励",
    dialogSrOnlyTitle: "领取奖励",
  },

  gctlHeatmap: {
    title: "Glow Control (GCTL)",
    titleShort: "Glow Control",
    titleTooltip: "您对太阳能电网的治理影响力。",
    disconnectedHeading: "引导太阳能奖励",
    disconnectedBody: "质押 GCTL 来引导地区奖励,再委托 sGCTL 获得积分。",
    zeroHoldingsTitleReadOnly: "无 GCTL 持仓",
    zeroHoldingsTitle: "引导全球增发",
    zeroHoldingsBodyReadOnly: "此钱包未质押任何 GCTL。",
    zeroHoldingsBody: "决定太阳能将在何处建设。",
    gamificationHook: "赚取",
    gamificationPoints: "来自 sGCTL 委托的积分",
    mintAndStake: "铸造并质押 GCTL",
    mintGctl: "铸造 GCTL",
    myHoldings: "我的持仓",
    freeToStake: "可质押",
    liquidSuffix: "流动",
    activeSuffix: "活跃",
    availableSuffix: "可用",
    lockedSuffix: "锁定",
    availableTooltip: "可随时移至其他地区的活跃 sGCTL。",
    lockedTooltip:
      "锁定在金库存款中的 sGCTL,仍可获得引导奖励,但在解除前无法重新委托。",
    steeringScore: "引导状态",
    pts: "分",
    perGlwRate: "委托 sGCTL 以获得积分",
    activeStakes: "活跃质押",
    impactColumn: "状态",
    noActiveSteering: "无活跃引导",
    stakeToDirect: "质押 GCTL 以引导增发",
    unusedInfluence: "未使用的影响力",
    stakeFooter: (amount) => (amount ? `质押 ${amount} GCTL` : "质押 GCTL"),
    showLess: "收起",
    showMore: (n) => `再显示 ${n} 项`,
    rowGctlStakedSuffix: (amount) => `已质押 ${amount} GCTL`,
    rowGlwPerWeek: "GLW/周",
    rowDirectingPct: (pct) => `引导地区 ${pct}%`,
    rowDirectingEmissions: "引导增发",
  },

  myFarms: {
    positionMiner: "矿机",
    positionDelegation: "委托",
    positionGeneric: "仓位",
    firstFundsTooltip:
      "奖励将在协议周于周日结束、审计员审核批次后发布。资金随后会被锁定 3 周的链上最终确认期,首次领取才会开放。",
    firstFundsAria: "为何首次资金会延迟",
    statusOwnership: (position) => `您的${position}已确认`,
    statusStartsEarning: (position) => `您的${position}现在开始产生收益`,
    statusEarning: (position) => `您的${position}正在产生收益`,
    statusClaimable: (position) => `您的${position}可以领取`,
    helperEpoch: "奖励在周日结束后开始。发布与最终确认完成后即可领取。",
    helperAudit: "奖励正在准备并审计中,稍后会发布到链上。",
    helperFinalization: "奖励已发布到链上。3 周保护期仍在进行中。",
    helperClaimable: "您的首批奖励已可在「奖励」中领取。",
    badgeOwned: "已拥有",
    badgeClaimReady: "可领取",
    badgeEarningSoon: "即将开始收益",
    badgePending: "待处理",
    timelineLabelFirstFunds: "首批资金到账",
    timelineLabelFundsAvailable: "资金已到账",
    timelineValueNow: "现在",
    nextMilestoneStartsEarning: "开始收益",
    nextMilestoneFundsAvailable: "资金到账",
    nextMilestoneStartedEarning: "已开始收益",
    stepWeekCloses: "周结束",
    stepAudited: "审计并发布",
    stepFirstFunds: "首批资金到账",
    whatHappensNext: "接下来会发生什么",
    nextStep: "下一步",
    openRewards: "打开奖励",
    modalStatusLabel: "状态",
    modalStartsEarning: "开始收益",
    modalAuditedPosted: "审计并发布",
    typeMiner: "矿机",
    typeDelegation: "委托",
    typeRewards: "奖励",
    typeShopMiner: "商店矿机",
    shopMinerSource: "积分商店",
    miningCenterLabel: "矿机中心",
    typeInProgress: "进行中",
    fundingProgress: "募资进度",
    costLabel: "成本",
    delegatedLabel: "已委托",
    estWeekly: "预计每周",
    viewDetails: "查看详情",
    active: "活跃",
    statusLabel: "状态",
    processing: "购买处理中",
    wksFormat: (active, total) => `${active} / ${total} 周`,
    readyToClaim: "可领取",
    calculating: "计算中",
    earned: "已赚取",
    lastWeek: "上周",
    lastWeekPrefix: "上周:",
    timelineText: (active, total) => `进度:${active} / ${total} 周`,
    costText: (amount) => `成本:${amount}`,
    pointsCost: (amount) => `${amount} 积分`,
    delegatedText: (amount) => `已委托:${amount}`,
    recentlyAddedNote: (amount) =>
      amount ? `+${amount} 最近添加` : "最近添加",
    progressText: (pct) => `进度 ${pct}%`,
    farmOverview: "农场概览",
    closeAria: "关闭",
    initialCost: "初始成本",
    totalDelegated: "委托总额",
    lifetimeEarnings: "累计收益",
    estWeeklyRewards: "预计每周奖励",
    timelineCard: "进度",
    timelineTotal: (total) => `总计 ${total} 周`,
    wksUnit: "周",
    rewardsBreakdown: "奖励明细",
    protocolDeposit: "协议存款",
    protocolDepositRecoveredIn: (asset) => `以 ${asset} 回收`,
    protocolDepositRecoveredCapital: "已回收资本",
    emissions: "增发",
    emissionsProduction: "生产奖励",
    totalValue: "总价值",
    weeklyHistory: "每周记录",
    tableWeek: "周",
    tablePd: "PD",
    tableEmission: "增发",
    tableTotal: "合计",
    listItem: "项目",
    listStatus: "状态",
    listActive: "活跃",
    listCost: "成本",
    listEarned: "已赚取",
    listLastWeek: "上周",
    listProgress: "进度",
    listInProgressStatus: "进行中",
    listProcessing: "处理中",
    listPending: "待处理",
    sortBy: "排序方式",
    sortDefault: "默认",
    sortNewest: "最新",
    sortAlphabetical: "名称 (A-Z)",
    sortSize: "规模 (从大到小)",
    sortPlaceholder: "排序方式...",
    viewDefault: "默认",
    viewCompact: "紧凑",
    viewMosaic: "马赛克",
    viewList: "列表",
    unableToLoad: "无法加载农场",
    noFarmsFound: "此钱包未找到农场",
    imgMain: (name) => `${name} 主图`,
    imgNumber: (name, n) => `${name} ${n}`,
    seeAudit: "查看审计",
    fallbackRegion: (id) => `地区 ${id}`,
    fallbackFarmName: (idShort) => `农场 ${idShort}`,
    fallbackZone: "启动板",
  },

  solarFarm: {
    title: "Glow 挖矿",
    viewDetails: "查看详情",
    currentWeeklyPayout: "本周支付",
    latestWeeklyEarnings: "最新周收益",
    estWeeklyRewards: "预计每周奖励",
    assetLabel: "资产",
    activelyDelegated: "活跃委托",
    miners: "矿机",
    delegations: "委托",
    other: "其他",
    connectWalletKicker: "连接您的钱包",
    connectWalletBody: "连接钱包以查看挖矿表现。",
    errorUnableToLoad: "无法加载奖励明细",
    retry: "重试",
    noActiveStreamsTitle: "无活跃太阳能流",
    noActiveStreamsBody:
      "您的投资组合当前处于休眠状态。委托 GLW 即可生成每周 GLW 奖励。",
    buyMiners: "购买矿机",
    delegateGlw: "委托 GLW",
    browseLaunchpad: "浏览启动板",
    nextBatchIn: "下一批倒计时",
    howMiningWorks: "挖矿运作原理",
    howMiningWorksBody: "了解现金激励与收益。",
    guideDelegation: "委托指南",
    guideDelegationBody: "了解存款回收与盈余。",
    farmDetailsAria: "打开农场表现详情",
    earned: "已赚取",
    pendingBadge: "即将开始",
    inProgressBadge: "进行中",
    pendingLabel: "待处理",
    inProgressLabel: "进行中",
    percentFilled: (pct) => `认购 ${pct}%`,
    costLabel: "成本",
    delegatedLabel: "已委托",
    estWeeklyCol: "预计每周",
    fundingLabel: "募资",
    glwPerWeekEst: "预计 GLW/周",
    estInProgressRewardsTooltip: "进行中的预计奖励",
    estAbbrev: "预计",
  },

  solarCollector: {
    dialogTitle: "太阳能足迹如何运作",
    cardHeading: "您的已验证太阳能足迹",
    cardSubheading: "农场支持的瓦特，归属于您",
    mainDescription:
      "您的太阳能足迹是归属于您钱包的清洁太阳能容量，以瓦特衡量。它来自真实获得资助的农场和农场支持的影响资产，用来讲述您的活动支持了哪些太阳能容量。",
    impactPowerLabel: "已归属影响",
    impactPowerDescription:
      "瓦特会通过符合条件的网络参与归属给您：委托 GLW、委托 sGCTL、矿机活动、推荐以及积分商店中的瓦特兑换。瓦特是主要单位；关联影响会随之而来，包括目前的 CO₂ 吨，以及发电量、可供电家庭数和成年树木等效等估算值。",
    whatToExpect: "运作方式",
    expectItem1Title: "瓦特来自真实农场",
    expectItem1Body:
      "每一瓦都由已资助的太阳能容量支持，并在可用时关联到农场和区域数据。",
    expectItem2Title: "影响随瓦特一起归属",
    expectItem2Body:
      "当瓦特归属于您时，Glow 也会呈现与之相连的影响故事：目前包括 CO₂ 吨，以及发电量、可供电家庭数和成年树木等效等估算值。",
    expectItem3Title: "您的足迹会持续更新",
    expectItem3Body:
      "随着农场获得资助、奖励结算和商店兑换完成，您的归属瓦特和影响总量会更新。",
    gotIt: "知道了",
    sectionTitle: "已验证的太阳能足迹",
    sectionTitleTooltip:
      "您与实体太阳能基础设施之间已验证的连接，基于归属于您钱包的农场支持瓦特和影响资产。",
    learnMore: "了解更多",
    homesPowered: "可供电家庭数",
    lightbulbs: "灯泡",
    homesTooltip:
      "在 18% 容量系数和每户平均 1.17 kW 负载假设下,您的太阳能容量可持续供电的美国家庭数估算值。",
    lightbulbsTooltip: "您的太阳能容量可持续点亮的 LED 灯泡(9W)数量估算值。",
    homesUnit: "户",
    bulbsUnit: "个",
    energyPerYear: "每年能源",
    energyPerYearTooltip:
      "基于归属于您的太阳能容量和估算的 18% 平均容量系数得出的年度清洁能源产量估算。",
    tonsCo2: "二氧化碳吨数",
    tonsCo2Tooltip:
      "归属于您钱包的已验证终身二氧化碳减排量，基于您的瓦特所连接的太阳能农场所获得的碳信用额。",
    tonsUnit: "t",
    treesEquivalent: "等效树木",
    treesEquivalentTooltip:
      "为吸收您的清洁能源生产所抵消的同等 CO₂ 量所需的成熟树木数(基于每 MWh 1,000 磅 CO₂ 与每棵树每年 0.022 吨)。",
    treesUnit: "棵",
    panelLabel: (n) => `容量区块 #${n}`,
    panelsCompleted: (n) => `已归属 ${n} 个容量区块`,
    emptyFootprintTitle: "您的太阳能足迹将显示在此",
    emptyFootprintBody: "新农场上线后,您的清洁能源生产份额将被追踪。",
    latestAddition: "最新添加",
    latestVerifiedAddition: "最新已验证添加",
    noRecentAdditions: "暂无近期新增农场",
    farmSize: "农场规模",
    yourShare: "您的份额",
    captureLabel: "捕获",
    share: "份额",
    regionalDistribution: "区域能源分布",
    footprintGrowth: "足迹增长",
    cumulativeRegionalImpact: "累计区域影响力",
    wattsUnit: "瓦",
    weekFallback: (n) => `第 ${n} 周`,
    chartCleanGridProject: "清洁电网项目 (CGP)",
    chartUtah: "犹他州 (UT)",
    chartMissouri: "密苏里州 (MO)",
    chartColorado: "科罗拉多州 (CO)",
    chartTotalWatts: "总瓦数",
    chartNetworkShare: "网络份额",
    cleanGridRegion: "清洁电网",
    cleanGridRegionCode: "CGP",
    multiplierLabel: "倍数",
    minerBadge: "矿机 3×",
    streakBadge: (streakBonus, weeks) => `连续 +${streakBonus}× (${weeks} 周)`,
    whenToday: "今天",
    whenYesterday: "昨天",
    whenDaysAgo: (n) => `${n} 天前`,
    whenLastWeek: "上周",
    whenWeeksAgo: (n) => `${n} 周前`,
  },

  weeklyActivity: {
    title: "每周连续记录",
    wks: "周",
    currentStreak: "当前连续",
    legendMiner: "矿机",
    legendDelegator: "委托人",
    legendBoth: "两者",
    connectWallet: "连接钱包",
    unableToLoad: "无法加载每周活动。",
    startYourStreak: "委托 GLW 或购买矿机以开启您的连续记录!",
    streakAtRiskBold: "连续记录有风险!",
    streakAtRiskBody: "本周委托 GLW 或购买矿机。",
    streakCounter: (n, cap) => `连续 ${n}/${cap}`,
    currentMultiplier: "当前倍数",
    multiplierBase: "基础",
    multiplierMinerSuffix: "(矿机)",
    multiplierStreak: "连续",
    multiplierTotal: "合计",
    weekStatus: {
      current: "本周",
      delegator: "委托人",
      miner: "矿机",
      both: "两者",
      missed: "错过",
    },
    weekDelegated: "已委托",
    weekMiner: "矿机",
  },
  educationCarousel: {
    glwPriceLabel: "GLW 价格",
    glwPriceSubtext: "实时现货价格，来自链上。",
    priceChart: "价格图表",
    launchpadCta: "浏览启动板",
    minersCta: "浏览矿机",
    pointsShopTitle: "积分商店",
    pointsShopDesc: "用你赚取的积分兑换真实奖励。",
    pointsShopCta: "打开商店",
    leaderboardTitle: "影响力排行榜",
    leaderboardDesc: "查看按瓦特与二氧化碳吨数排名的顶尖钱包。",
    leaderboardCta: "查看排行榜",
    previousSlide: "上一张",
    nextSlide: "下一张",
    goToSlide: (index) => `转到第 ${index} 张幻灯片`,
    slides: {
      token: {
        kicker: "代币",
        title: "购买 GLW —— Glow 经济的燃料",
        body: "Glow 由 GLW 代币驱动，GLW 通过一种称为委托的过程用于支持太阳能农场。",
      },
      delegation: {
        kicker: "委托",
        title: "向太阳能农场委托 GLW",
        body: "每个太阳能农场会根据其竞争力产生不等的奖励。通过向农场委托 GLW，你即认可该农场参与 Glow，并会根据该农场的竞争力获得奖励或承担惩罚。",
      },
      rewards: {
        kicker: "奖励",
        title: "赚取积分与影响力",
        body: "委托 GLW 可赚取可在积分商店兑换的积分。你还会获得影响力：你获得的‘瓦特’代表真实的能源产出，‘二氧化碳吨数’代表你所支持的农场消除的真实碳排放。",
      },
      mining: {
        kicker: "挖矿",
        title: "成为 GLW 矿工",
        body: "赚取 GLW 最快的方式是在市场上购买，但你也可以通过购买矿机每周赚取 GLW。每台矿机都与一个真实的太阳能农场绑定，并收取该农场产生的部分 GLW 奖励。",
      },
      resources: {
        kicker: "资源",
        title: "了解更多",
        body: "深入了解实时协议数据，以及关于 Glow 经济运作方式的长篇指南。",
      },
    },
  },
};

export const widgetsTranslations: Record<Lang, WidgetStrings> = {
  en,
  ko,
  zh,
};
