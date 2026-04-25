import type { Lang } from "../config";

export interface RoutesStrings {
  gctlLanding: {
    buyGlw: string;
    goToDashboard: string;
    mintAndStake: string;
    connectPrompt: string;
    youHoldGctl: (amount: string) => string;
    mintPriceNote: string;
    eyebrow: string;
    headlinePrefix: string;
    headlineHighlight: string;
    description: string;
    benefitSteeredHeader: string;
    benefitSteeredDesc: string;
    benefitFundHeader: string;
    benefitFundDesc: string;
    learnHowItWorks: string;
    statSteeredAmount: string;
    statSteeredUnit: string;
    statSteeredDescDesktop1: string;
    statSteeredDescDesktop2: string;
    statSteeredDescMobile: string;
    statBoostAmount: string;
    statBoostLabel: string;
    statBoostDescDesktop1: string;
    statBoostDescDesktop2: string;
    statBoostDescMobile: string;
    heroAlt: string;
  };

  miningCenter: {
    title: string;
    subtitle: string;
    yourMiners: string;
    order: string;
    descending: string;
    ascending: string;
    allZones: string;
    filter: string;
    refineSearch: string;
    pleaseTryAgain: string;
    noImagesAvailable: string;
    minersAvailable: string;
    weeklyRewardsPerMiner: string;
    currentWeeklyRate: string;
    rewardsMayDecrease: string;
    pricePerMiner: string;
    advancedStats: string;
    fullyFunded: string;
    noMinersAvailable: string;
    buyMiners: string;
  };

  launchpad: {
    title: string;
    subtitle: string;
    active: string;
    filled: string;
    allRegions: string;
    sortBy: string;
    payDeposit: string;
    viewDetails: string;
    target: string;
    raised: string;
    delegators: string;
    filters: string;
    refineSearch: string;
    all: string;
    delegation: string;
    miners: string;
    allZones: string;
    yourBalance: string;
    yourGlw: string;
    pleaseTryAgain: string;
    noImagesAvailable: string;
    availableLabel: string;
    rewardScore: string;
    rewardScoreTooltip: string;
    perMiner: string;
    perFraction: string;
    fullSponsorship: string;
    priceNotAvailable: string;
    estimatesUpdateWeekly: string;
    emissions: string;
    advancedStats: string;
    rewardScoreCombines: string;
    estimatedEarningsNote: string;
    estimatedRewards: string;
    estimatedRewardsLower: string;
    canDecreaseNote: string;
    units: string;
    weeklyEarningsNote: string;
    activity: string;
    region: string;
    glowLaunchpad: string;
    type: string;
    zone: string;
    unnamedFarm: string;
    badgeMiner: string;
    badgeDelegation: string;
    scorePrefix: (n: string) => string;
    totalMined: string;
    totalDelegated: string;
    priceLabel: string;
    amountLabel: string;
    pricePerMiner: string;
    pricePerMinerShort: string;
    delegationAmount: string;
    free: string;
    leftFraction: (remaining: string, total: string) => string;
    toSellOutSuffix: (time: string) => string;
    weeklyHundred: string;
    weeklyMiner: (weeks: string) => string;
    weeklyEarningsLine: (val: string) => string;
    weeklyEarningsSubject: string;
    estWeeklyRewardsHeader: string;
    estWeeklyRewardsHundred: string;
    estWeeklyTooltipBody: string;
    paidWeeklyDelegationNote: string;
    paidWeeklyMinerNote: (weeks: string) => string;
    calculatingRewards: string;
    soldOut: string;
    buyMiners: string;
    delegateSgctl: string;
    delegateGlw: string;
    activeListing: string;
    activeListings: string;
    stablePriceLower: string;
    stablePriceUpper: string;
    waitlist: string;
    instant: string;
    unavailable: string;
    nextBatchSoon: string;
    sellOutTime: string;
    available: string;
    scoreLoading: string;
    sortFeatured: string;
    sortNewest: string;
    sortRewardScore: string;
    sortYieldPer1000: string;
    sortPlaceholder: string;
    learnAboutRewardScore: string;
    paginationPrevious: string;
    paginationNext: string;
    pdFromPdsLabel: (currency: string) => string;
    glwFromInflation: string;
    soldOutInPrefix: (time: string) => string;
    leftFractionUpper: (remaining: string, total: string) => string;
    weeklyGlwPerWeek: (val: string) => string;
    weeklyUsdPerWeek: (val: string) => string;
    estRewards100Weeks: string;
    weeklyEstDelegationDesc: string;
    calculatingBreakdown: string;
    weeklyMinerHeader: (weeks: string) => string;
    weeklyMinerDesc: (weeks: string) => string;
    scoreLabelInline: string;
    rewardScoreLongDescription: string;
    helperPrompt: string;
    helperDelegating: string;
    helperOr: string;
    helperBuyingMiners: string;
    tabAllN: (n: string) => string;
    tabDelegationsN: (n: string) => string;
    tabMinersUsdcN: (n: string) => string;
  };

  liquidity: {
    title: string;
    subtitle: string;
    pool: string;
    yourPosition: string;
    addLiquidity: string;
    removeLiquidity: string;
    incentives: string;
    tvl: string;
    apr: string;
    volume24h: string;
    needMoreUsdg: string;
    goToSwap: string;
    rewardsSummary: string;
    exchangeFeeRewards: string;
    liquidity: string;
    yourPositions: string;
    remove: string;
    noActivePositions: string;
    addLiquidityToStart: string;
    estApy: string;
    feesApy: string;
    glwRewards: string;
    exchangeFeeRewardsLower: string;
    currentPoolValue: string;
    addLiquiditySubtitle: string;
    input: string;
    balanceLabel: string;
    insufficientFunds: string;
    insufficientTokenBalance: (token: string) => string;
    enterAmounts: string;
    review: string;
    enterValidAmounts: string;
    poolReservesChanged: string;
    glwIncentiveProgramEnded: string;
    glwIncentiveEndedNotice: string;
    glwIncentives: string;
    programEndedSuffix: string;
    incentiveApyEnded: string;
    incentiveApyActive: string;
    incentiveApyComing: string;
    combinedApy: string;
    currentApy: string;
    feesOnlyUntilStart: string;
  };

  stats: {
    economyOverview: string;
    protocolActivity: string;
    lifetimeFarms: string;
    marketTickers: string;
    regionsStaking: string;
    impactLeaderboard: string;
    leaderboardDesc: string;
    supplyAndLiquidity: string;
    marketCap: string;
    circulatingPrefix: string;
    pctDelegated: string;
    activelyDelegatedOf: (delegated: string, circulating: string) => string;
    usdcLiquidityUniswap: string;
    poolGlw: (glw: string) => string;
    endowmentLiquidity: string;
    noLpTokens: string;
    andGlw: (amount: string) => string;
    gctlOverview: string;
    numberOfGctl: string;
    mintedToDate: string;
    basedOnMint: string;
    participants: string;
    activeParticipants: string;
    yieldAndFlows: string;
    avgDelegatorApr: string;
    timeWeightedNote: string;
    avgMinerApr: string;
    allActiveMiners: string;
    marketTickers2: string;
    protocolActivity2: string;
    gctlStakingByRegion: string;
    protocolEvents: string;
    gctlMinting: string;
    tokenCreationEvents: string;
    gctlStaking: string;
    stakeUnstakeEvents: string;
    recentActivity: string;
    live: string;
    seeAll: string;
    delegationHistory: string;
    delegationHistoryDesc: string;
    minersHistory: string;
    minersHistoryDesc: string;
    mintedHistory: string;
    mintedHistoryDesc: string;
    stakedHistory: string;
    stakedHistoryDesc: string;
    unableToLoadRegional: string;
    noRegionsAvailable: string;
    stakedGctl: string;
    shareOfTotal: string;
    totalPds: string;
    launchpadDelegation: string;
    communityBackedFarms: string;
    glowMiners: string;
    miningInfrastructure: string;
    remaining: string;
    noDelegationsYet: string;
    delegationsAppear: string;
    noPurchasesYet: string;
    minerPurchasesAppear: string;
    seeAudit: string;
    auditPending: string;
    lifetimeFarmsOnboarded: string;
    solarFarmsBroughtOnline: string;
    totalOnboarded: string;
    lifetimeFarmsCompleted: string;
    totalGlwDelegated: string;
    delegatedToSolar: string;
    noCompletedFarms: string;
    completedFarmsList: string;
    currentPrice: string;
    glwSpotPrice: string;
    glwEdgapPrice: string;
    gctlMintPrice: string;
    glwSpotTooltip: string;
    glwEdgapTooltip: string;
    gctlMintTooltip: string;
    viewPairOnDefined: string;
    rewardsLeaderboard: string;
    tabImpact: string;
    tabImpactDesc: string;
    tabDelegators: string;
    tabDelegatorsDesc: string;
    tabMiners: string;
    tabMinersDesc: string;
    tabFarms: string;
    tabFarmsDesc: string;
  };

  liquidityDialogs: {
    cancel: string;
    confirm: string;
    processing: string;
    transactionFailed: string;
    processingTransaction: string;
    addReviewTitle: string;
    addSuccessTitle: string;
    actionWouldLikelyFail: string;
    addReviewDescription: string;
    addProcessingDescription: string;
    addPoolChangedError: string;
    addGenericError: string;
    addToastFailed: string;
    addIncentiveEndedAck: string;
    addIncentivePendingAck: string;
    detailUsdgAmount: string;
    detailGlwAmount: string;
    detailShareOfPool: string;
    detailUsdgAdded: string;
    detailGlwAdded: string;
    removeTitle: string;
    removeSuccessTitle: string;
    processingWithdrawal: string;
    removeDescription: string;
    removeProcessingDescription: string;
    removeGenericError: string;
    removeToastFailed: string;
    detailWithdrawalPercentage: string;
    detailUsdgToReceive: string;
    detailGlwToReceive: string;
    detailUsdgRemoved: string;
    detailGlwRemoved: string;
    selectWithdrawalAmount: string;
    youWillReceive: string;
    closeButton: string;
    incentiveTitle: string;
    incentiveBody: string;
    incentiveTitleEnded: string;
    incentiveEnded1: string;
    incentiveEnded2: string;
    incentiveEnded3: string;
    incentiveActive1: string;
    incentiveActive2: string;
    incentiveBullet1: string;
    incentiveBullet2: string;
    incentiveBullet3: string;
    incentiveActive3: string;
    incentiveActive4: string;
    iUnderstand: string;
  };

  processingModal: {
    transactionFailed: string;
    transactionId: string;
    close: string;
    processingPurchase: string;
    ethereumMainnet: string;
    explorer: string;
    continueInBackground: string;
    checkingStatus: string;
    sentSubtitle: string;
    etaPrefix: string;
    completeSoon: string;
    progressPercentLine: (pct: string) => string;
    statusLabel: string;
    networkLabel: string;
    statusChecking: string;
    statusProcessing: string;
    safeCloseHint: string;
    transactionIdCopied: string;
  };

  farmsLeaderboard: {
    totalRewardsUsd: string;
    noDataAvailable: string;
    selectRegion: string;
    allRegions: string;
    perWeek: string;
    region: string;
    unableToLoad: string;
    v2WeeklyBreakdown: string;
    weeksActive: string;
    totalGlwEmissions: string;
    totalPdRewards: string;
    protocolDeposit: string;
    weekHeader: string;
    currencyHeader: string;
    glwEmissions: string;
    pdRewardsDistributed: string;
    weekN: (n: string) => string;
    total: string;
    noRewardsForFarm: string;
    totalFarms: string;
    farmsIn: (region: string) => string;
    allFarmsTracked: (n: string) => string;
    farmsInRegionWithRewards: (n: string) => string;
    lastWeekRewards: string;
    distributedToFarms: (n: string) => string;
    networkEfficiency: string;
    avgRegionEfficiency: string;
    weightedByDeposits: string;
    creditsPer100k: string;
    topFarmEfficiency: string;
    highestPerforming: string;
    lastWeekRewardsByAsset: string;
    rewardsCardTitle: (currency: string) => string;
    usdValue: (val: string) => string;
    weeklyRewardsOverview: string;
    overviewDescAll: string;
    overviewDescRegion: (region: string) => string;
    sortByPlaceholder: string;
    efficiencyScore: string;
    farmLeaderboard: string;
    farmLeaderboardDescAll: string;
    farmLeaderboardDescRegion: (region: string) => string;
    rank: string;
    rankTooltip: string;
    farmName: string;
    efficiency: string;
    glwPerWeek: string;
    pdRewards: string;
    carbonCredits: string;
    actions: string;
    viewDetails: string;
    topPercent: (n: string) => string;
    farmFallback: (id: string) => string;
    regionFallback: (id: string) => string;
  };

  launchpadStats: {
    title: string;
    subtitle: (zoneName: string) => string;
    snapshotHeading: string;
    snapshotDesc: string;
    regionHeading: string;
    regionDesc: string;
    delegatedToken: (currency: string) => string;
    delegatedTooltip: (currency: string) => string;
    estimatedRewardsPerWeek: string;
    estimatedGlwPerWeek: string;
    rewardsTooltipSgctl: string;
    rewardsTooltipDefault: string;
    efficiencyScore: string;
    efficiencyTooltip: string;
    regionLabel: (val: string) => string;
    estimatedApy: string;
    apyTooltip: string;
    apyFootnote: string;
    ccsPerWeek: string;
    ccsPerWeekTooltip: string;
    perFraction: string;
    sgctlFromCCs: string;
    glwFromCCs: string;
    fromCCsTooltipSgctl: string;
    fromCCsTooltipDefault: string;
    pctOfTotalUsd: (val: string) => string;
    pctOfTotal: (val: string) => string;
    glwFromEmissions: string;
    glwFromEmissionsTooltip: string;
    solarPanels: string;
    solarPanelsTooltip: string;
    totalPanels: string;
    region: string;
    activeFarms: string;
    farmsUnderConstruction: string;
    regionalGlwPerWeek: string;
    naValue: string;
    usdApprox: (val: string) => string;
    expectationHeader: string;
    expectationDesc: string;
    detailsAriaLabel: (label: string) => string;
    sgctlPlusGlw: (sgctl: string, glw: string) => string;
  };

  miningStats: {
    title: string;
    subtitle: (zoneName: string) => string;
    snapshotHeading: string;
    snapshotDesc: string;
    regionHeading: string;
    regionDesc: string;
    cost: string;
    costTooltip: string;
    perMiner: string;
    estimatedGlwPerWeek: string;
    weeklyGlwTooltip: string;
    duration: string;
    durationTooltip: string;
    weeks: string;
    estimatedApr: string;
    aprTooltip: string;
    aprFootnote: string;
    region: string;
    weeklyGlw: string;
    regionalGlwTooltip: string;
    activeFarms: string;
    activeFarmsTooltip: string;
    farmsPipeline: string;
    farmsPipelineTooltip: string;
    naValue: string;
    usdApprox: (val: string) => string;
    detailsAriaLabel: (label: string) => string;
    prePackagedHeader: string;
    prePackagedDesc: (weeks: string) => string;
  };

  eventTabs: {
    noMintedEventsTitle: string;
    noMintedEventsDesc: string;
    noStakingEventsTitle: string;
    noStakingEventsDesc: string;
    fromAmount: (amount: string, currency: string) => string;
    staked: string;
    unstaked: string;
    event: string;
    regionFallback: (id: string) => string;
    daysHoursAgo: (d: string, h: string) => string;
    hoursMinutesAgo: (h: string, m: string) => string;
    minutesAgo: (m: string) => string;
    justNow: string;
  };

  impactLeaderboard: {
    pointsLabel: string;
    rankLabel: string;
    percentileLabel: string;
    connectToSeeRanking: string;
    connectDesc: string;
    nextUpdate: string;
    currentRanking: string;
    progress: string;
    activeMultipliers: string;
    glowImpactLeaderboard: string;
    weeksRange: (start: string, end: string) => string;
    updating: string;
    unableToLoadYourScore: string;
    points: string;
    ranking: string;
    belowTopPercentile: (val: string) => string;
    topPercentile: (val: string) => string;
    rankUnavailable: string;
    fastestBoost: string;
    buyGlwHeadline: string;
    buyGlwDesc: string;
    buyGlw: string;
    pointsToReachRank: (pts: string, rank: string) => string;
    onTrackRank1: string;
    onTrackHigher: string;
    seeDetails: string;
    projectedRank: (rank: string) => string;
    officialRankUpdates: string;
    cashMinerMultiplier: string;
    active: string;
    inactive: string;
    cashMinerDesc: string;
    buyMiner: string;
    steeringPower: string;
    steeringDesc: string;
    stakeGctl: string;
    delegateGlwHeadline: string;
    delegateGlwDesc: string;
    delegateGlw: string;
    leaderboardLower: string;
    showingPagination: (
      from: string,
      to: string,
      total: string,
    ) => string;
    filteredFrom: (n: string) => string;
    nWallets: (n: string) => string;
    searchPlaceholder: string;
    clearSearch: string;
    unableToLoadLeaderboard: string;
    rankN: (n: string) => string;
    you: string;
    copied: string;
    copyWalletAddress: string;
    pts: string;
    lastWeekColon: string;
    glowColon: string;
    multipliers: string;
    pointSources: string;
    rankCol: string;
    walletCol: string;
    totalPoints: string;
    lastWeekHeader: string;
    glowWorth: string;
    pageOf: (page: string, total: string) => string;
    failedLoadScoreToast: string;
  };

  walletsLeaderboard: {
    delegatorRewards: string;
    minerRewards: string;
    noDataAvailable: string;
    delegatorsLower: string;
    minersLower: string;
    pctOfCirculatingSupply: string;
    glwActivelyDelegatedTooltip: string;
    activeDelegation: string;
    pctOfSupply: (val: string) => string;
    unableToLoadRewards: string;
    noWalletsFound: string;
    adjustFiltersDelegators: string;
    adjustFiltersMiners: string;
    netDelegatorRewardsTotal: string;
    rewardsTotal: (label: string) => string;
    avgPerWallet: (val: string) => string;
    glwActivelyDelegatedLabel: string;
    usdcSpent: string;
    currentVaultOwnership: string;
    newCapital: (val: string) => string;
    glwPerWeekPer100Glw: string;
    glwPerWeekPer100Miner: string;
    averageWeeklyRewardsOnDelegations: string;
    averageWeeklyRewardsOnMiners: string;
    miners: string;
    ofTotalGlwHolders: string;
    newWalletsLastWeek: (n: string) => string;
    newThisRange: (n: string) => string;
    showingTop: (n: string) => string;
    chartCurrent: string;
    delegationChartTitle: string;
    delegationChartDesc: string;
    walletLeaderboard: string;
    rankedByCumulativeDelegators: (n: string) => string;
    rankedByCumulativeMiners: (n: string) => string;
    searchPlaceholder: string;
    rank: string;
    rankTooltipDelegator: string;
    rankTooltipMiner: string;
    wallet: string;
    glwPerWeek: string;
    netRewards: string;
    rewardsCol: string;
    netRewardsTooltip: string;
    share: string;
    shareTooltipDelegators: string;
    shareTooltipMiners: string;
    actions: string;
    badgeNew: string;
    topPercent: (n: string) => string;
    showingPagination: (
      from: string,
      to: string,
      total: string,
      plural: string,
    ) => string;
    filteredFrom: (n: string) => string;
    noWalletsMatching: (q: string) => string;
    previous: string;
    pageOf: (page: string, total: string) => string;
    next: string;
    toastAddressCopied: string;
    toastFailedCopy: string;
  };

  impactBuyback: {
    title: string;
    subtitle: string;
    howItWorks: string;
    learnMore: string;
    tabBuyback: string;
    tabActivity: string;
    buybackCardTitle: string;
    buybackCardDesc: string;
    selectRegion: string;
    loading: string;
    chooseRegion: string;
    regionPot: string;
    unboundedSupply: string;
    certificatesBalance: string;
    creditsUnit: string;
    creditsToBurn: string;
    newBalanceAfterBurn: string;
    madeUsdg: string;
    redeemNow: string;
    latestBuybacks: string;
    latestBuybacksDesc: string;
    colWhen: string;
    colRegion: string;
    colCreditsBurned: string;
    colUsdgPaid: string;
    toastSelectRegionFirst: string;
    toastEnterValidAmount: string;
    toastSubmittedIn: (region: string) => string;
    toastFailedSubmit: string;
  };

  tos: {
    title: string;
    lastUpdated: (date: string) => string;
    backToApp: string;
    sec1Title: string;
    sec1Body1Part1: string;
    sec1Body1Part2: string;
    sec1EligibilityLabel: string;
    sec1EligibilityBody: string;
    sec2Title: string;
    sec2Bullet1: string;
    sec2Bullet2: string;
    sec2PrivacyLabel: string;
    sec2PrivacyBody: string;
    sec2ProhibitedLabel: string;
    sec2ProhibitedBody: string;
    sec3Title: string;
    sec3Bullet1: string;
    sec3Bullet2: string;
    sec3Bullet3: string;
    sec4Title: string;
    sec4Bullet1: string;
    sec4Bullet2: string;
    sec5Title: string;
    sec5Body: string;
    sec6Title: string;
    sec6Bullet1: string;
    sec6Bullet2: string;
    sec7Title: string;
    sec7BodyPart1: string;
    sec7BodyPart2: string;
    sec8Title: string;
    sec8Body1: string;
    sec8SubmissionsLabel: string;
    sec8SubmissionsBody: string;
    sec9Title: string;
    sec9Body: string;
    sec10Title: string;
    sec10Body: string;
    sec11Title: string;
    sec11Bullet1: string;
    sec11Bullet2: string;
    closingAcknowledgment: string;
    closingContact: string;
  };

  depositDialog: {
    ctaPreparingWallet: string;
    ctaCheckingEligibility: string;
    ctaStakedSgctlOnly: string;
    ctaMinimumToStart: (usd: string) => string;
    ctaConfirmDelegation: string;
    ctaStakeAndDelegate: string;
    ctaMintStakeDelegate: string;
    ctaSwapAndDelegate: string;
    ctaConfirmPurchase: string;
    shortfallNeed: (amount: string, symbol: string) => string;
    shortfallNeedSwapBuffer: (amount: string, symbol: string) => string;

    toastCheckingEligibility: string;
    toastPreparingSigner: string;
    toastPreparingConnection: string;
    toastListingNoLongerAvailable: string;
    toastStepsRemaining: (n: string) => string;
    toastDelegationSuccess: string;
    toastMinersPurchased: string;
    toastTransactionRejected: string;
    toastUnableToShare: string;

    initialPositionMinimumFallback: (usd: string) => string;

    sgctlFundingFromUsdc: (existing: string, shortfall: string) => string;
    sgctlFundingFromEth: (existing: string, shortfall: string) => string;
    sgctlFundingFromGctl: (existing: string, shortfall: string) => string;

    weeklyForWeeks: (n: string) => string;
    weeklyFor99Weeks: string;
    weeklyFor100Weeks: string;

    shareTitlePrefix: (farmLabel: string) => string;
    shareTitleFallback: string;
    shareTextMiners: (
      quantity: string,
      farmLabel: string,
      domain: string,
    ) => string;
    shareTextDelegation: (
      farmLabel: string,
      asset: string,
      domain: string,
    ) => string;
    shareFarmFallback: string;

    successDetailQuantity: string;
    successDetailTotalUsdc: string;
    successDetailTotalSgctlDelegated: string;
    successDetailTotalGlwDelegated: string;

    successPurchaseComplete: string;
    successDelegationComplete: string;
    successPurchaseSubtitle: string;
    successDelegationSubtitle: string;
    successLeft: (n: string) => string;
    successAlreadyFilled: string;
    successYourContribution: string;
    successProjectedWeeklyRewards: string;
    successEstWeeklyImpactPoints: string;
    successPtsUnit: string;
    successEmissions: string;
    successVaultBonus: string;
    successMinerBonusPrefix: string;
    successMinerBonusSuffix: string;
    successShare: string;
    successClose: string;

    processingTransactionFailed: string;
    processingTransactionPending: string;
    processingTransactionInFlight: string;
    processingErrorBody: string;
    processingPendingBody: string;
    processingActiveBody: string;
    processingPendingExplainer: string;
    processingClose: string;
    processingTryAgain: string;
    processingRefreshAndRetry: string;
    processingTransactionFailedFallback: string;
    stakeSyncUnableToVerify: string;
    stakeSyncBalanceUpdating: string;

    reviewTitleMiners: string;
    reviewTitleSgctl: string;
    reviewTitleGlw: string;
    reviewQuantityLabel: string;
    reviewQuantityAvailable: (n: string) => string;
    reviewMaxButton: string;
    reviewEstWeeklyRewards: string;
    reviewValueLabel: string;
    reviewSelectCurrency: string;
    reviewDelegationSource: string;
    reviewYouDelegate: string;
    reviewDelegationAmount: string;
    reviewSourceCost: string;
    reviewSwapCost: string;
    reviewTotal: string;
    reviewStable: string;
    reviewApprox: (val: string) => string;

    paymentLabelGlw: string;
    paymentLabelSgctl: string;
    paymentLabelGctl: string;
    paymentLabelUsdc: string;
    paymentLabelEth: string;
    paymentBalancePrefix: (balance: string) => string;
    paymentSgctlInRegion: (amount: string) => string;
    paymentGctlWallet: (amount: string) => string;

    previewDelegationAmount: string;
    previewSourceAmount: string;
    previewSourceCost: string;
    previewSwapCost: string;
  };

  sponsoredFarmsActivity: {
    timeNow: string;
    timeSecondsAgo: (n: string) => string;
    timeMinutesAgo: (n: string) => string;
    timeHoursAgo: (n: string) => string;
    timeDaysAgo: (n: string) => string;
    timeWeeksAgo: (n: string) => string;
    timeMonthsAgo: (n: string) => string;
    timeYearsAgo: (n: string) => string;

    avgScore: string;
    avgRewardScore: string;
    rewardScoreSuffix: string;
    buyers: string;
    delegators: string;
    contributors: string;
    usdcSpent: string;
    totalUsdcSpent: string;
    glwDelegated: string;
    totalGlwDelegated: string;
    totalVolumeSuffix: string;
    miners: string;
    purchasedSuffix: string;
    farms: string;
    fundedSuffix: string;
    minersUsdc: string;
    usdcSpentByMiners: string;
    minerVolumeSuffix: string;

    errorLoading: (msg: string) => string;
    pleaseTryAgain: string;
    noPurchaseActivity: string;
    recentPurchasesAppear: string;

    badgeMiner: string;
    badgeDelegation: string;
    badgeDelegator: string;

    headerTotal: string;
    headerAmount: string;
    headerDate: string;
    headerRewardScore: string;
    headerFarm: string;
    headerType: string;
    headerWallet: string;

    seeAllActivity: string;
  };

  streak: {
    title: string;
    weeks: (n: number) => string;
    joinGlow: string;
    trackOwnStreakAt: string;
  };
}

const en: RoutesStrings = {
  gctlLanding: {
    buyGlw: "Buy GLW",
    goToDashboard: "Go to Dashboard",
    mintAndStake: "Mint & Stake GCTL",
    connectPrompt: "Connect wallet to get started",
    youHoldGctl: (amount) => `You hold ${amount} GCTL. `,
    mintPriceNote:
      "Mint price = √GLW price. Funds flow to the Glow Endowment.",
    eyebrow: "Glow Control (GCTL)",
    headlinePrefix: "Decide Where Solar",
    headlineHighlight: "Gets Built",
    description:
      "GCTL lets you decide where Glow builds solar farms. Stake GCTL and support the regions you care about.",
    benefitSteeredHeader: "+3 pts per GLW steered",
    benefitSteeredDesc: "Boost your weekly Impact Score",
    benefitFundHeader: "Fund solar globally",
    benefitFundDesc: "Choose regions: Utah, Colorado, Missouri, and more",
    learnHowItWorks: "Learn how GCTL works",
    statSteeredAmount: "175K",
    statSteeredUnit: "GLW / Week",
    statSteeredDescDesktop1: "Steered by GCTL",
    statSteeredDescDesktop2: "stakers each week",
    statSteeredDescMobile: "Steered weekly",
    statBoostAmount: "3x",
    statBoostLabel: "Impact Points",
    statBoostDescDesktop1: "Per GLW steered",
    statBoostDescDesktop2: "to your regions",
    statBoostDescMobile: "Per GLW steered",
    heroAlt: "Solar panels with worker",
  },
  miningCenter: {
    title: "Mining Center",
    subtitle: "The next batch of miners will be available soon",
    yourMiners: "Your miners",
    order: "Order",
    descending: "Descending",
    ascending: "Ascending",
    allZones: "All zones",
    filter: "Filter",
    refineSearch: "Refine your search",
    pleaseTryAgain: "Please try again later",
    noImagesAvailable: "No images available",
    minersAvailable: "Miners Available",
    weeklyRewardsPerMiner: "Weekly Rewards per miner",
    currentWeeklyRate:
      "Current weekly rate based on regional emissions and active miners",
    rewardsMayDecrease:
      "Rewards may decrease as new regional farms come online",
    pricePerMiner: "Price per miner",
    advancedStats: "Advanced Stats",
    fullyFunded: "Fully Funded",
    noMinersAvailable: "No Miners Available",
    buyMiners: "Buy Miners",
  },
  launchpad: {
    title: "Launchpad",
    subtitle: "Delegate GLW to help launch new solar farms",
    active: "Active",
    filled: "Filled",
    allRegions: "All regions",
    sortBy: "Sort by",
    payDeposit: "Pay Deposit",
    viewDetails: "View Details",
    target: "Target",
    raised: "Raised",
    delegators: "Delegators",
    filters: "Filters",
    refineSearch: "Refine your search",
    all: "All",
    delegation: "Delegation",
    miners: "Miners",
    allZones: "All zones",
    yourBalance: "Your balance",
    yourGlw: "Your GLW",
    pleaseTryAgain: "Please try again later",
    noImagesAvailable: "No images available",
    availableLabel: "Available",
    rewardScore: "Reward Score",
    rewardScoreTooltip:
      "The Reward Score is a tool that combines emissions and protocol deposit rewards into a single estimate per dollar delegated.",
    perMiner: "Per Miner.",
    perFraction: "Per Fraction.",
    fullSponsorship: "Full sponsorship",
    priceNotAvailable: "Price not available",
    estimatesUpdateWeekly:
      "Estimates update weekly as new farms and delegations change region emission shares.",
    emissions: "Emissions",
    advancedStats: "Advanced Stats",
    rewardScoreCombines:
      "The Reward Score combines both revenue streams (emissions and protocol-deposit recovery) into a single estimate.",
    estimatedEarningsNote: "Estimated earnings are subject to change.",
    estimatedRewards: "Estimated Rewards",
    estimatedRewardsLower: "Estimated rewards",
    canDecreaseNote:
      "Can decrease as regions fill. See Advanced Stats for details.",
    units: "Units",
    weeklyEarningsNote: "Weekly earnings are subject to change.",
    activity: "Activity",
    region: "Region",
    glowLaunchpad: "Glow Launchpad",
    type: "Type",
    zone: "Zone",
    unnamedFarm: "Unnamed Farm",
    badgeMiner: "Miner",
    badgeDelegation: "Delegation",
    scorePrefix: (n) => `Score: ${n}`,
    totalMined: "Total Mined",
    totalDelegated: "Total Delegated",
    priceLabel: "Price",
    amountLabel: "Amount",
    pricePerMiner: "Price per Miner",
    pricePerMinerShort: "Price / Miner",
    delegationAmount: "Delegation Amount",
    free: "Free",
    leftFraction: (remaining, total) => `${remaining}/${total} left`,
    toSellOutSuffix: (time) => `${time} to sell out`,
    weeklyHundred: "Weekly (100 wks)",
    weeklyMiner: (weeks) => `Weekly (${weeks})`,
    weeklyEarningsLine: (val) => `+${val} GLW / wk`,
    weeklyEarningsSubject: "Estimated earnings are subject to change.",
    estWeeklyRewardsHeader: "Est. Weekly Rewards",
    estWeeklyRewardsHundred: "Est. Weekly Rewards (100 weeks)",
    estWeeklyTooltipBody:
      "Expected weekly rewards per delegation, paid weekly for 100 weeks. May vary with network changes.",
    paidWeeklyDelegationNote: "Paid weekly for 100 weeks. See Advanced Stats.",
    paidWeeklyMinerNote: (weeks) =>
      `Paid weekly for ${weeks}. See Advanced Stats.`,
    calculatingRewards: "Calculating rewards...",
    soldOut: "Sold Out",
    buyMiners: "Buy Miners",
    delegateSgctl: "Delegate SGCTL",
    delegateGlw: "Delegate GLW",
    activeListing: "Active Listing",
    activeListings: "Active Listings",
    stablePriceLower: "Stable price",
    stablePriceUpper: "Stable Price",
    waitlist: "Waitlist",
    instant: "Instant",
    unavailable: "Unavailable",
    nextBatchSoon: "The next batch of farms will be available soon",
    sellOutTime: "Sell out time",
    available: "Available",
    scoreLoading: "Score: …",
    sortFeatured: "Featured",
    sortNewest: "Newest",
    sortRewardScore: "Reward Score",
    sortYieldPer1000: "Yield / $1000",
    sortPlaceholder: "Sort",
    learnAboutRewardScore: "Learn about Reward Score",
    paginationPrevious: "Previous",
    paginationNext: "Next",
    pdFromPdsLabel: (currency) => `${currency} from PDs`,
    glwFromInflation: "GLW from Inflation",
    soldOutInPrefix: (time) => `SOLD OUT IN ${time}`,
    leftFractionUpper: (remaining, total) => `${remaining} / ${total} Left`,
    weeklyGlwPerWeek: (val) => `+${val} GLW/wk`,
    weeklyUsdPerWeek: (val) => `≈ $${val} USD/wk`,
    estRewards100Weeks: "Est. Rewards (100 weeks)",
    weeklyEstDelegationDesc:
      "Weekly estimate per delegation, paid weekly for 100 weeks. Can decrease as regions fill. See Advanced Stats for details.",
    calculatingBreakdown: "Calculating breakdown…",
    weeklyMinerHeader: (weeks) => `Weekly Rewards (${weeks})`,
    weeklyMinerDesc: (weeks) =>
      `Estimated weekly rewards per miner for ${weeks}. These estimates may decrease as new farms join the region and dilute the regional GLW allocation. See Advanced Stats for detailed information.`,
    scoreLabelInline: "Score:",
    rewardScoreLongDescription:
      "The Reward Score is a tool that combines both revenue streams (deposit recovery and GLW inflation) into a single metric representing expected rewards per dollar delegated. Higher Reward Scores generally indicate better delegation opportunities, but do not guarantee realized performance, since a farm's actual competitiveness and rewards may shift as new farms join its region.",
    helperPrompt: "Unsure where to start? Learn about",
    helperDelegating: "Delegating GLW",
    helperOr: "or",
    helperBuyingMiners: "Buying Miners",
    tabAllN: (n) => `All (${n})`,
    tabDelegationsN: (n) => `Delegations (${n})`,
    tabMinersUsdcN: (n) => `Miners (USDC) (${n})`,
  },
  liquidity: {
    title: "Liquidity",
    subtitle: "Provide liquidity to the GLW/USDG pool",
    pool: "Pool",
    yourPosition: "Your Position",
    addLiquidity: "Add Liquidity",
    removeLiquidity: "Remove Liquidity",
    incentives: "Incentives",
    tvl: "TVL",
    apr: "APR",
    volume24h: "Volume (24h)",
    needMoreUsdg: "Need more USDG?",
    goToSwap: "Go to Swap",
    rewardsSummary: "Rewards Summary",
    exchangeFeeRewards: "Exchange Fee Rewards",
    liquidity: "Liquidity",
    yourPositions: "Your Positions",
    remove: "Remove",
    noActivePositions: "No active positions yet",
    addLiquidityToStart: "Add liquidity to start earning rewards",
    estApy: "Est. APY",
    feesApy: "Fees APY",
    glwRewards: "GLW rewards",
    exchangeFeeRewardsLower: "Exchange fee rewards",
    currentPoolValue: "Current pool value",
    addLiquiditySubtitle:
      "Add liquidity to the GLW/USDG pool and start earning rewards",
    input: "Input",
    balanceLabel: "Balance:",
    insufficientFunds: "Insufficient funds",
    insufficientTokenBalance: (token) => `Insufficient ${token} balance`,
    enterAmounts: "Enter amounts",
    review: "Review",
    enterValidAmounts: "Enter valid GLW and USDG amounts",
    poolReservesChanged:
      "Pool reserves changed. Your amounts likely fail slippage. Adjust amounts to match pool ratio.",
    glwIncentiveProgramEnded: "GLW Incentive Program Ended",
    glwIncentiveEndedNotice:
      "The GLW incentive program ended on November 25, 2025. You can still add liquidity to earn exchange fees.",
    glwIncentives: "GLW Incentives",
    programEndedSuffix: " (Program Ended)",
    incentiveApyEnded: "Incentive APY (ended)",
    incentiveApyActive: "Incentive APY",
    incentiveApyComing: "Incentive APY (coming)",
    combinedApy: "Combined APY",
    currentApy: "Current APY",
    feesOnlyUntilStart: "Fees only until incentives start",
  },
  stats: {
    economyOverview: "Economy Overview",
    protocolActivity: "Protocol Activity",
    lifetimeFarms: "Lifetime Farms",
    marketTickers: "Market Tickers",
    regionsStaking: "Regions Staking",
    impactLeaderboard: "Impact Leaderboard",
    leaderboardDesc:
      "Explore Glow's impact leaderboard and see top wallets by impact score.",
    supplyAndLiquidity: "GLW Supply & Liquidity",
    marketCap: "GLW Circulating Market Cap",
    circulatingPrefix: "Circulating:",
    pctDelegated: "% of GLW Actively Delegated",
    activelyDelegatedOf: (delegated, circulating) =>
      `${delegated} actively delegated / ${circulating} circulating`,
    usdcLiquidityUniswap: "USDC Liquidity (Uniswap)",
    poolGlw: (glw) => `Pool GLW: ${glw}`,
    endowmentLiquidity: "Liquidity Provided by Glow Endowment",
    noLpTokens: "No LP tokens",
    andGlw: (amount) => `and ${amount} GLW`,
    gctlOverview: "GCTL Overview",
    numberOfGctl: "Number of GCTL Tokens",
    mintedToDate: "Minted to date",
    basedOnMint: "Based on mint price",
    participants: "Participants",
    activeParticipants: "Active participants",
    yieldAndFlows: "Yield & Flows",
    avgDelegatorApr: "Average Delegator APY",
    timeWeightedNote: "Time-weighted, region-weighted",
    avgMinerApr: "Average Miner APY",
    allActiveMiners: "All active miners",
    marketTickers2: "Market Tickers",
    protocolActivity2: "Protocol Activity",
    gctlStakingByRegion: "GCTL Staking by Region",
    protocolEvents: "Protocol Events",
    gctlMinting: "GCTL Minting",
    tokenCreationEvents: "Token creation events",
    gctlStaking: "GCTL Staking",
    stakeUnstakeEvents: "Stake & unstake events",
    recentActivity: "Recent Activity",
    live: "Live",
    seeAll: "See All",
    delegationHistory: "Delegation History",
    delegationHistoryDesc:
      "All delegation and undelegation events across all farms",
    minersHistory: "Miners History",
    minersHistoryDesc: "All miner purchase events across all farms",
    mintedHistory: "Minted History",
    mintedHistoryDesc: "All GCTL minting events",
    stakedHistory: "Staked History",
    stakedHistoryDesc: "All GCTL stake and unstake events",
    unableToLoadRegional: "Unable to load regional staking data right now.",
    noRegionsAvailable: "No regions available at this time.",
    stakedGctl: "Staked GCTL",
    shareOfTotal: "Share of total",
    totalPds: "Total PDs",
    launchpadDelegation: "Launchpad Delegation",
    communityBackedFarms: "Community-backed solar farms",
    glowMiners: "Glow Miners",
    miningInfrastructure: "Mining infrastructure",
    remaining: "Remaining",
    noDelegationsYet: "No delegations yet",
    delegationsAppear:
      "When delegations happen, they'll appear here. Start with an available farm above.",
    noPurchasesYet: "No purchases yet",
    minerPurchasesAppear: "Miner purchases will appear here.",
    seeAudit: "See audit",
    auditPending: "Audit pending",
    lifetimeFarmsOnboarded: "Lifetime Farms Onboarded",
    solarFarmsBroughtOnline: "Solar farms brought online",
    totalOnboarded: "Total Onboarded",
    lifetimeFarmsCompleted: "Lifetime farms with completed audits",
    totalGlwDelegated: "Total GLW Delegated",
    delegatedToSolar: "Delegated to solar farms",
    noCompletedFarms: "No completed farms yet",
    completedFarmsList: "Completed Farms",
    currentPrice: "Current price",
    glwSpotPrice: "GLW Spot Price",
    glwEdgapPrice: "GLW Edgap Price",
    gctlMintPrice: "GCTL Mint Price",
    glwSpotTooltip:
      "Real-time market price from Uniswap pool. This is the current trading price where you can buy or sell GLW tokens on the open market.",
    glwEdgapTooltip:
      "Exponentially-Decayed, liquidity-aware price. A smoothed, stable price signal used by the protocol for GCTL pricing. Reacts to market changes but filters out short-term noise.",
    gctlMintTooltip:
      "Dynamic price to mint new GCTL tokens = ceil(√GLW Price / $0.05) × $0.05. The price is the square root of GLW price, rounded up to the nearest 5 cents.",
    viewPairOnDefined: "View pair on Defined.fi",
    rewardsLeaderboard: "Leaderboard",
    tabImpact: "Impact",
    tabImpactDesc: "Weekly impact score + leaderboard",
    tabDelegators: "Delegators",
    tabDelegatorsDesc: "Delegation activity & rankings",
    tabMiners: "Miners",
    tabMinersDesc: "Miner multiplier status & rankings",
    tabFarms: "Farms",
    tabFarmsDesc: "Solar farms & sponsorship performance",
  },

  liquidityDialogs: {
    cancel: "Cancel",
    confirm: "Confirm",
    processing: "Processing...",
    transactionFailed: "Transaction Failed",
    processingTransaction: "Processing Transaction",
    addReviewTitle: "Review & Confirm",
    addSuccessTitle: "+ Liquidity Added",
    actionWouldLikelyFail: "Action Would Likely Fail",
    addReviewDescription: "Please review the details before confirming",
    addProcessingDescription:
      "Please wait while we add your liquidity to the pool",
    addPoolChangedError:
      "Pool reserves changed. Your amounts likely fail slippage. Close and adjust inputs to match the pool ratio.",
    addGenericError:
      "We were unable to process your transaction. Please try again or contact support.",
    addToastFailed: "Failed to add liquidity",
    addIncentiveEndedAck:
      "I understand the GLW incentive program has ended. New liquidity will not earn GLW rewards.",
    addIncentivePendingAck:
      "I understand GLW rewards will be claimable after the v2 Smart Contract relaunch. The relaunch date is not yet defined.",
    detailUsdgAmount: "USDG Amount",
    detailGlwAmount: "GLW Amount",
    detailShareOfPool: "Share of Pool",
    detailUsdgAdded: "USDG Added",
    detailGlwAdded: "GLW Added",
    removeTitle: "Remove Liquidity",
    removeSuccessTitle: "Liquidity Removed",
    processingWithdrawal: "Processing Withdrawal",
    removeDescription: "Select the percentage of liquidity to remove",
    removeProcessingDescription:
      "Please wait while we remove your liquidity from the pool",
    removeGenericError:
      "We were unable to process your withdrawal. Please try again.",
    removeToastFailed: "Failed to remove liquidity",
    detailWithdrawalPercentage: "Withdrawal Percentage",
    detailUsdgToReceive: "USDG to Receive",
    detailGlwToReceive: "GLW to Receive",
    detailUsdgRemoved: "USDG Removed",
    detailGlwRemoved: "GLW Removed",
    selectWithdrawalAmount: "Select withdrawal amount",
    youWillReceive: "You will receive",
    closeButton: "Close",
    incentiveTitle: "Liquidity Incentive Grant",
    incentiveBody:
      "Provide liquidity to the GLW/USDG pool to earn rewards from trading fees and protocol incentives.",
    incentiveTitleEnded: "Liquidity Incentive Grant (Ended)",
    incentiveEnded1:
      "The GLW liquidity incentive program ran from September 2nd, 2025 to November 25th, 2025 and has now ended.",
    incentiveEnded2:
      "Existing liquidity providers will receive their earned GLW rewards when the GLW V2 smart contracts go live. The UI continues to track your liquidity positions and earned rewards.",
    incentiveEnded3:
      "You can still add liquidity to earn exchange fees, but no additional GLW incentives will be distributed.",
    incentiveActive1:
      "Glow is running a promotion from September 2nd, 2025 to November 25th, 2025 where it is distributing 5,000 GLW per week to liquidity providers.",
    incentiveActive2:
      "Liquidity providers will earn GLW tokens based on how much liquidity they provide, and based on how long they have been providing liquidity. The rewards are structured to be exponential:",
    incentiveBullet1: "After 1 day, liquidity providers earn 1x rewards",
    incentiveBullet2: "After 10 days, liquidity providers earn 1.5x rewards",
    incentiveBullet3: "After 100 days, liquidity providers earn 2.25x rewards",
    incentiveActive3:
      "...and so on, with rewards steadily increasing every few minutes",
    incentiveActive4:
      "The GLW rewards will be distributed to liquidity providers when the GLW V2 smart contracts go live. The UI will track your liquidity positions, as well as how many rewards they have earned.",
    iUnderstand: "I understand",
  },

  processingModal: {
    transactionFailed: "Transaction Failed",
    transactionId: "Transaction ID",
    close: "Close",
    processingPurchase: "Processing Purchase",
    ethereumMainnet: "Ethereum Mainnet",
    explorer: "Explorer",
    continueInBackground: "Continue in Background",
    checkingStatus: "Checking transaction status...",
    sentSubtitle: "Your USDC has been sent. GCTL will be credited shortly.",
    etaPrefix: "ETA:",
    completeSoon: "Processing should complete soon",
    progressPercentLine: (pct) =>
      `${pct}% complete • Checking status every 10s`,
    statusLabel: "Status",
    networkLabel: "Network",
    statusChecking: "Checking...",
    statusProcessing: "Processing",
    safeCloseHint:
      "You can safely close this window. We'll continue processing and update your balance automatically.",
    transactionIdCopied: "Transaction ID copied to clipboard",
  },
  farmsLeaderboard: {
    totalRewardsUsd: "Total Rewards (USD)",
    noDataAvailable: "No data available for chart",
    selectRegion: "Select region",
    allRegions: "All Regions",
    perWeek: "/week",
    region: "Region",
    unableToLoad: "Unable to load farms data right now.",
    v2WeeklyBreakdown: "V2 weekly rewards breakdown and farm statistics",
    weeksActive: "Weeks Active",
    totalGlwEmissions: "Total GLW Emissions",
    totalPdRewards: "Total PD Rewards",
    protocolDeposit: "Protocol Deposit",
    weekHeader: "Week",
    currencyHeader: "Currency",
    glwEmissions: "GLW Emissions",
    pdRewardsDistributed: "PD Rewards Distributed",
    weekN: (n) => `Week ${n}`,
    total: "Total",
    noRewardsForFarm: "No weekly rewards data available for this farm",
    totalFarms: "Total Farms",
    farmsIn: (region) => `Farms in ${region}`,
    allFarmsTracked: (n) => `All farms tracked (${n} with recent rewards)`,
    farmsInRegionWithRewards: (n) =>
      `Farms in region (${n} with recent rewards)`,
    lastWeekRewards: "Last Week Rewards",
    distributedToFarms: (n) => `Distributed to ${n} farms with recent data`,
    networkEfficiency: "Network Efficiency",
    avgRegionEfficiency: "Avg. Region Efficiency",
    weightedByDeposits:
      "Weighted by total protocol deposits across all farms",
    creditsPer100k: "Carbon credits per $100k deposit/week",
    topFarmEfficiency: "Top Farm Efficiency",
    highestPerforming: "Highest performing farm",
    lastWeekRewardsByAsset: "Last Week Rewards by Asset",
    rewardsCardTitle: (currency) => `${currency} Rewards`,
    usdValue: (val) => `$${val} USD value`,
    weeklyRewardsOverview: "Weekly Rewards Overview",
    overviewDescAll:
      "Top 20 farms with recent rewards activity, ranked by total rewards distributed (USD).",
    overviewDescRegion: (region) =>
      `Top 20 farms with recent rewards in ${region}, ranked by total rewards (USD).`,
    sortByPlaceholder: "Sort by",
    efficiencyScore: "Efficiency Score",
    farmLeaderboard: "Farm Leaderboard",
    farmLeaderboardDescAll:
      "Ranked by efficiency score. All farms shown with rewards and carbon credit metrics.",
    farmLeaderboardDescRegion: (region) =>
      `${region} farms ranked by efficiency score.`,
    rank: "Rank",
    rankTooltip:
      'Based on efficiency score. Top 3 show exact rank, others show percentile (e.g., "Top 5%").',
    farmName: "Farm Name",
    efficiency: "Efficiency",
    glwPerWeek: "GLW/Week",
    pdRewards: "PD Rewards",
    carbonCredits: "Carbon Credits",
    actions: "Actions",
    viewDetails: "View Details",
    topPercent: (n) => `Top ${n}%`,
    farmFallback: (id) => `Farm ${id}`,
    regionFallback: (id) => `Region ${id}`,
  },
  launchpadStats: {
    title: "Delegation Advanced Stats",
    subtitle: (zoneName) => `Evaluate expected performance for ${zoneName}`,
    snapshotHeading: "Opportunity snapshot",
    snapshotDesc:
      "Expected returns per fraction based on audited farm performance and current market conditions.",
    regionHeading: "Region context",
    regionDesc:
      "Regional competitive landscape and network activity. Farms compete only within their region.",
    delegatedToken: (currency) => `Delegated ${currency}`,
    delegatedTooltip: (currency) =>
      `Amount of ${currency} required to post as protocol deposit per fraction.`,
    estimatedRewardsPerWeek: "Estimated Rewards / Week",
    estimatedGlwPerWeek: "Estimated GLW / Week",
    rewardsTooltipSgctl:
      "Expected weekly rewards from SGCTL protocol-deposit recovery plus GLW emissions share.",
    rewardsTooltipDefault:
      "Expected weekly rewards from deposit recovery and GLW emission rewards share.",
    efficiencyScore: "Efficiency Score",
    efficiencyTooltip:
      "Expected carbon credits per $100k deposit weekly, based on audited farm projections.",
    regionLabel: (val) => `Region: ${val}`,
    estimatedApy: "Estimated APY",
    apyTooltip:
      "Annualized return including deposit recovery and emissions, based on expected farm performance and regional competitiveness.",
    apyFootnote: "Estimate only, changes weekly",
    ccsPerWeek: "CCs Per Week",
    ccsPerWeekTooltip: "Expected carbon credits generated weekly per fraction.",
    perFraction: "Per fraction",
    sgctlFromCCs: "SGCTL From CCs",
    glwFromCCs: "GLW From CCs",
    fromCCsTooltipSgctl:
      "Weekly SGCTL rewards from protocol-deposit recovery based on carbon credit generation.",
    fromCCsTooltipDefault:
      "Weekly GLW rewards from deposit recovery based on carbon credit generation.",
    pctOfTotalUsd: (val) => `${val}% of total weekly USD rewards`,
    pctOfTotal: (val) => `${val}% of total rewards`,
    glwFromEmissions: "GLW from Emissions",
    glwFromEmissionsTooltip: "Weekly GLW rewards from protocol emissions share.",
    solarPanels: "Solar Panels",
    solarPanelsTooltip: "Total number of solar panels installed at this farm.",
    totalPanels: "Total panels",
    region: "Region",
    activeFarms: "Active Farms",
    farmsUnderConstruction: "Farms Under Construction",
    regionalGlwPerWeek: "Regional GLW Per Week",
    naValue: "N/A",
    usdApprox: (val) => `≈ $${val} USD`,
    expectationHeader: "Expectation-based rewards:",
    expectationDesc:
      " Returns are calculated based on expected lifetime carbon displacement audited at farm construction, not actual weekly performance. This protects delegators from weather volatility and operational risk while focusing competition on maximum climate impact. Actual returns depend on regional competitiveness, market conditions, and network growth. Deposit recovery and GLW emissions continue based on original projections regardless of realized farm output.",
    detailsAriaLabel: (label) => `${label} details`,
    sgctlPlusGlw: (sgctl, glw) => `${sgctl} SGCTL + ${glw} GLW`,
  },
  miningStats: {
    title: "Mining Advanced Stats",
    subtitle: (zoneName) =>
      `Fractional mining position for ${zoneName} solar farm`,
    snapshotHeading: "Opportunity snapshot",
    snapshotDesc:
      "Key metrics for this pre-packaged mining position earning GLW from an active solar farm.",
    regionHeading: "Region context",
    regionDesc:
      "Regional GLW allocation and network activity supporting this farm's token emissions.",
    cost: "Cost",
    costTooltip: "Upfront USDC payment for this miner.",
    perMiner: "per miner",
    estimatedGlwPerWeek: "Estimated GLW per Week",
    weeklyGlwTooltip:
      "Current weekly GLW tokens earned per miner based on farm's allocation and reward split.",
    duration: "Duration",
    durationTooltip:
      "Remaining weeks in the farm's GLW emission schedule.",
    weeks: "weeks",
    estimatedApr: "Estimated APR",
    aprTooltip:
      "Annualized return based on current GLW emissions and price. Assumes no dilution from new regional farms.",
    aprFootnote: "Estimate only, changes weekly",
    region: "Region",
    weeklyGlw: "Weekly GLW",
    regionalGlwTooltip:
      "Total weekly GLW allocated to this region based on GCTL staking.",
    activeFarms: "Active Farms",
    activeFarmsTooltip: "Currently operational farms in this region.",
    farmsPipeline: "Farms Pipeline",
    farmsPipelineTooltip: "Farms in pipeline awaiting completion.",
    naValue: "N/A",
    usdApprox: (val) => `≈ $${val} USD`,
    detailsAriaLabel: (label) => `${label} details`,
    prePackagedHeader: "Pre-packaged mining positions:",
    prePackagedDesc: (weeks) =>
      ` Each mining position represents fractional claims to GLW token emissions from active solar farms. Returns are based on current network conditions including regional GLW allocations, farm deposit size, and predetermined reward splits. Actual returns may vary as new farms join the region and dilute per-farm token allocations. GLW price appreciation is not guaranteed. Mining positions earn token streams over ${weeks} weeks from live solar infrastructure.`,
  },
  eventTabs: {
    noMintedEventsTitle: "No minted events yet",
    noMintedEventsDesc: "GCTL minting transactions will appear here",
    noStakingEventsTitle: "No staking events",
    noStakingEventsDesc:
      "Staking and unstaking transactions will appear here",
    fromAmount: (amount, currency) => `from ${amount} ${currency}`,
    staked: "Staked",
    unstaked: "Unstaked",
    event: "Event",
    regionFallback: (id) => `Region #${id}`,
    daysHoursAgo: (d, h) => `${d}d ${h}h ago`,
    hoursMinutesAgo: (h, m) => `${h}h ${m}m ago`,
    minutesAgo: (m) => `${m}m ago`,
    justNow: "Just now",
  },
  impactLeaderboard: {
    pointsLabel: "Points",
    rankLabel: "Rank",
    percentileLabel: "Percentile",
    connectToSeeRanking: "Connect to see your ranking",
    connectDesc:
      "View your impact score, track your progress, and compete on the leaderboard.",
    nextUpdate: "Next update",
    currentRanking: "Current ranking",
    progress: "Progress",
    activeMultipliers: "Active multipliers & bonuses",
    glowImpactLeaderboard: "Glow Impact Leaderboard",
    weeksRange: (start, end) => `Weeks ${start}–${end}`,
    updating: "Updating…",
    unableToLoadYourScore: "Unable to load your score.",
    points: "Points",
    ranking: "Ranking",
    belowTopPercentile: (val) => `Below Top ${val}`,
    topPercentile: (val) => `Top ${val}`,
    rankUnavailable: "Rank not available outside current list",
    fastestBoost: "Fastest boost",
    buyGlwHeadline: "Buy GLW to immediately start earning points",
    buyGlwDesc:
      "Buying GLW increases GlowWorth, which adds continuous worth points to your score.",
    buyGlw: "Buy GLW",
    pointsToReachRank: (pts, rank) => `${pts} pts to reach Rank #${rank}`,
    onTrackRank1: "You're on track for Rank #1! 🏆",
    onTrackHigher: "On track for higher rank",
    seeDetails: "See details",
    projectedRank: (rank) => `↑ Projected rank: #${rank}`,
    officialRankUpdates:
      "Official rank updates weekly on Sunday at 01:00 UTC",
    cashMinerMultiplier: "3× Cash Miner Multiplier",
    active: "ACTIVE",
    inactive: "INACTIVE",
    cashMinerDesc: "If active, rollover points are tripled for this week.",
    buyMiner: "Buy Miner",
    steeringPower: "Steering Power (sGCTL)",
    steeringDesc: "Earn 3× points per GLW steered with staked GCTL.",
    stakeGctl: "Stake GCTL",
    delegateGlwHeadline: "Delegate GLW (Emissions + vault bonus)",
    delegateGlwDesc:
      "Delegate GLW to start earning Emissions and vault bonus points.",
    delegateGlw: "Delegate GLW",
    leaderboardLower: "Leaderboard",
    showingPagination: (from, to, total) =>
      `Showing ${from}–${to} of ${total}`,
    filteredFrom: (n) => ` (filtered from ${n})`,
    nWallets: (n) => `${n} wallets`,
    searchPlaceholder: "Search ENS or 0x…",
    clearSearch: "Clear search",
    unableToLoadLeaderboard: "Unable to load leaderboard.",
    rankN: (n) => `Rank ${n}`,
    you: "You",
    copied: "Copied",
    copyWalletAddress: "Copy wallet address",
    pts: "pts",
    lastWeekColon: "Last week:",
    glowColon: "Glow:",
    multipliers: "Multipliers",
    pointSources: "Point sources",
    rankCol: "Rank",
    walletCol: "Wallet",
    totalPoints: "Total Points",
    lastWeekHeader: "Last week",
    glowWorth: "Glow Worth",
    pageOf: (page, total) => `Page ${page} of ${total}`,
    failedLoadScoreToast: "Failed to load your Impact Score",
  },
  walletsLeaderboard: {
    delegatorRewards: "Delegator Rewards",
    minerRewards: "Miner Rewards",
    noDataAvailable: "No data available for chart",
    delegatorsLower: "delegators",
    minersLower: "miners",
    pctOfCirculatingSupply: "% of Circulating Supply",
    glwActivelyDelegatedTooltip: "GLW actively delegated",
    activeDelegation: "Active Delegation",
    pctOfSupply: (val) => `${val}% of supply`,
    unableToLoadRewards: "Unable to load rewards data right now.",
    noWalletsFound: "No wallets found",
    adjustFiltersDelegators:
      "Adjust the filters to explore different segments of Glow delegators.",
    adjustFiltersMiners:
      "Adjust the filters to explore different segments of Glow miners.",
    netDelegatorRewardsTotal: "Net Delegator Rewards (total)",
    rewardsTotal: (label) => `${label} (total)`,
    avgPerWallet: (val) => `Avg per wallet: ${val} GLW`,
    glwActivelyDelegatedLabel: "GLW Actively Delegated",
    usdcSpent: "USDC Spent",
    currentVaultOwnership: "Current vault ownership across all wallets",
    newCapital: (val) => `New capital: $${val}`,
    glwPerWeekPer100Glw: "GLW per Week per 100 GLW Delegated",
    glwPerWeekPer100Miner: "GLW per Week per $100 Miner",
    averageWeeklyRewardsOnDelegations:
      "Average weekly rewards on active delegations",
    averageWeeklyRewardsOnMiners: "Average weekly rewards on miners",
    miners: "Miners",
    ofTotalGlwHolders: "of total GLW holders",
    newWalletsLastWeek: (n) => `+${n} new wallets last week`,
    newThisRange: (n) => `${n} new this range`,
    showingTop: (n) => `Showing top ${n}`,
    chartCurrent: "Current",
    delegationChartTitle: "GLW Delegation as % of Circulating Supply",
    delegationChartDesc:
      "Track how much of the circulating GLW supply is delegated over time",
    walletLeaderboard: "Wallet Leaderboard",
    rankedByCumulativeDelegators: (n) =>
      `Ranked by cumulative GLW earned. Top ${n} delegators shown. Click column headers to sort.`,
    rankedByCumulativeMiners: (n) =>
      `Ranked by cumulative GLW earned. Top ${n} miners shown. Click column headers to sort.`,
    searchPlaceholder: "Search by wallet address or ENS name...",
    rank: "Rank",
    rankTooltipDelegator:
      'Based on total net rewards in the current period. Top 3 show exact rank, others show percentile (e.g., "Top 5%").',
    rankTooltipMiner:
      'Based on cumulative GLW earned. Top 3 show exact rank, others show percentile (e.g., "Top 5%").',
    wallet: "Wallet",
    glwPerWeek: "GLW/Week",
    netRewards: "Net Rewards",
    rewardsCol: "Rewards",
    netRewardsTooltip:
      "Total rewards earned (PD recovery + emissions) minus the Protocol Deposit allocated to weeks that have passed. Shows your true profit.",
    share: "Share",
    shareTooltipDelegators:
      "This wallet's percentage of total gross rewards distributed to all delegators in the current period.",
    shareTooltipMiners:
      "This wallet's percentage of total gross rewards distributed to all miners in the current period.",
    actions: "Actions",
    badgeNew: "New",
    topPercent: (n) => `Top ${n}%`,
    showingPagination: (from, to, total, plural) =>
      `Showing ${from} to ${to} of ${total} wallet${plural}`,
    filteredFrom: (n) => ` (filtered from ${n})`,
    noWalletsMatching: (q) => `No wallets found matching "${q}"`,
    previous: "Previous",
    pageOf: (page, total) => `Page ${page} of ${total}`,
    next: "Next",
    toastAddressCopied: "Address copied",
    toastFailedCopy: "Failed to copy",
  },
  impactBuyback: {
    title: "Impact Buyback",
    subtitle: "Pilot for Phase I – mock flows wired to live regions list.",
    howItWorks: "How it works",
    learnMore: "Learn more",
    tabBuyback: "Buyback",
    tabActivity: "Activity",
    buybackCardTitle: "Buyback",
    buybackCardDesc: "Burn impact credits for USDG. All values are mocked.",
    selectRegion: "Select a region",
    loading: "Loading…",
    chooseRegion: "Choose a region",
    regionPot: "Region Pot",
    unboundedSupply: "Unbounded Supply",
    certificatesBalance: "Certificates Balance",
    creditsUnit: "credits",
    creditsToBurn: "Credits to Burn",
    newBalanceAfterBurn: "New balance after burn",
    madeUsdg: "$made",
    redeemNow: "Redeem now",
    latestBuybacks: "Latest buybacks",
    latestBuybacksDesc: "Mocked recent activity across regions",
    colWhen: "When",
    colRegion: "Region",
    colCreditsBurned: "Credits burned",
    colUsdgPaid: "USDG paid",
    toastSelectRegionFirst: "Select a region first",
    toastEnterValidAmount: "Enter a valid credits amount to burn",
    toastSubmittedIn: (region) => `Submitted buyback in ${region}`,
    toastFailedSubmit: "Failed to submit buyback",
  },
  tos: {
    title: "Terms of Service",
    lastUpdated: (date) => `Last updated: ${date}`,
    backToApp: "Back to app",
    sec1Title: "1. Acceptance of Terms",
    sec1Body1Part1: "By connecting your digital wallet to this Application (",
    sec1Body1Part2:
      "), you explicitly agree to these Terms of Service. If you do not agree, do not use the Application.",
    sec1EligibilityLabel: "Eligibility:",
    sec1EligibilityBody:
      "By using the Application, you represent and warrant that you are at least 18 years of age, or the age of legal majority in your jurisdiction (if higher), and possess the legal authority to agree to these Terms and use the Application lawfully.",
    sec2Title: "2. User Responsibility",
    sec2Bullet1:
      "The User is solely responsible for their interactions with the Application, including all associated smart contracts and blockchain transactions.",
    sec2Bullet2:
      "Users acknowledge the inherent risks in blockchain technology, including but not limited to financial loss, smart contract vulnerabilities, network disruptions, and regulatory risks.",
    sec2PrivacyLabel: "Privacy Acknowledgment:",
    sec2PrivacyBody:
      "The Application does not intentionally collect personal data. However, blockchain transactions inherently expose certain transaction-related information publicly, including blockchain addresses and associated metadata. By using the Application, Users acknowledge and accept this inherent blockchain transparency.",
    sec2ProhibitedLabel: "Prohibited Activities:",
    sec2ProhibitedBody:
      "Users expressly agree not to engage in any unlawful or prohibited activities, including fraud, money laundering, market manipulation, sanction evasion, or any activity otherwise prohibited by applicable law or regulations when using the Application.",
    sec3Title: "3. No Liability & Warranty Disclaimer",
    sec3Bullet1:
      'The Application and associated smart contracts are provided on an "as-is" basis.',
    sec3Bullet2:
      "The Company explicitly disclaims any responsibility for direct, indirect, incidental, special, consequential, or exemplary damages, including financial loss, arising from or relating to the use of the Application.",
    sec3Bullet3:
      "The Company makes no warranties, express or implied, regarding the reliability, accuracy, completeness, or functionality of the Application or associated smart contracts.",
    sec4Title: "4. Regulatory Compliance",
    sec4Bullet1:
      "Users confirm they are not using the Application from any jurisdiction where its use is prohibited or restricted.",
    sec4Bullet2:
      "It is the User's responsibility to comply with applicable local laws and regulations.",
    sec5Title: "5. Indemnification",
    sec5Body:
      "Users agree to indemnify and hold harmless the Company and its affiliates, officers, employees, and representatives from and against all claims, liabilities, damages, losses, or expenses arising from their use of the Application.",
    sec6Title: "6. No Custody of Blockchain Assets",
    sec6Bullet1:
      "The Application does not have custody, possession, or control over the User's blockchain assets at any time.",
    sec6Bullet2:
      "Users interact directly with smart contracts and retain full control over their private keys and blockchain assets.",
    sec7Title: "7. Modification of Terms",
    sec7BodyPart1:
      "The Company reserves the right to modify these Terms at any time. Updates will be posted publicly on the Application at ",
    sec7BodyPart2:
      ", and Users bear the responsibility to periodically review these Terms. Continued use after changes constitutes acceptance.",
    sec8Title: "8. Intellectual Property",
    sec8Body1:
      "All intellectual property associated with the Application, including trademarks and copyrights, remains the property of the Company.",
    sec8SubmissionsLabel: "User Submissions:",
    sec8SubmissionsBody:
      "Any feedback, suggestions, or submissions provided by Users related to the Application shall be deemed non-confidential. Users hereby grant the Company a perpetual, irrevocable, worldwide, royalty-free, and unrestricted right to use, incorporate, or otherwise exploit such submissions without restriction or compensation.",
    sec9Title: "9. Arbitration and Dispute Resolution",
    sec9Body:
      "Any dispute arising out of or in connection with these Terms or your use of the Application shall be referred to and finally resolved by arbitration administered by the Cayman International Arbitration Centre (CIAC) in accordance with the CIAC Arbitration Rules in force at the time of arbitration. The seat of arbitration shall be George Town, Cayman Islands. The arbitration proceedings shall be conducted in English. The arbitration tribunal's decision shall be final and binding upon all parties.",
    sec10Title: "10. Governing Law and Jurisdiction",
    sec10Body:
      "These Terms shall be governed by and construed in accordance with the laws of the Cayman Islands, without regard to conflicts of law principles. Users agree to submit to the exclusive jurisdiction of the courts located in George Town, Cayman Islands, for purposes of enforcing arbitration decisions or addressing claims not subject to arbitration.",
    sec11Title: "11. Risk Acknowledgment",
    sec11Bullet1:
      "Users acknowledge and agree they fully understand the risks associated with blockchain technology and related activities.",
    sec11Bullet2:
      "Users are encouraged to perform independent research before engaging in any transactions on the Application.",
    closingAcknowledgment:
      "By using the Application, Users acknowledge they have read, understood, and accepted these Terms of Service.",
    closingContact:
      "For questions or concerns about these Terms, please contact us through the official channels provided on the Application.",
  },
  depositDialog: {
    ctaPreparingWallet: "Preparing Wallet...",
    ctaCheckingEligibility: "Checking Eligibility...",
    ctaStakedSgctlOnly: "Staked SGCTL Only",
    ctaMinimumToStart: (usd) => `Minimum $${usd} To Start`,
    ctaConfirmDelegation: "Confirm Delegation",
    ctaStakeAndDelegate: "Stake & Delegate",
    ctaMintStakeDelegate: "Mint, Stake & Delegate",
    ctaSwapAndDelegate: "Swap & Delegate",
    ctaConfirmPurchase: "Confirm Purchase",
    shortfallNeed: (amount, symbol) => `Need +${amount} ${symbol}`,
    shortfallNeedSwapBuffer: (amount, symbol) =>
      `Need +${amount} ${symbol} (swap buffer)`,

    toastCheckingEligibility: "Checking wallet eligibility...",
    toastPreparingSigner: "Preparing wallet signer...",
    toastPreparingConnection: "Preparing wallet connection...",
    toastListingNoLongerAvailable: "This listing is no longer available.",
    toastStepsRemaining: (n) =>
      `Only ${n} step${n === "1" ? "" : "s"} remaining for this listing.`,
    toastDelegationSuccess: "Delegation successful!",
    toastMinersPurchased: "Miners purchased!",
    toastTransactionRejected: "Transaction rejected",
    toastUnableToShare: "Unable to share right now",

    initialPositionMinimumFallback: (usd) =>
      `Your first miner or delegation should total at least $${usd} so weekly reward claims stay worth the gas.`,

    sgctlFundingFromUsdc: (existing, shortfall) =>
      `This uses your available regional stake of ${existing} SGCTL, then mints and stakes ${shortfall} more from USDC.`,
    sgctlFundingFromEth: (existing, shortfall) =>
      `This uses your available regional stake of ${existing} SGCTL, then mints and stakes ${shortfall} more from ETH.`,
    sgctlFundingFromGctl: (existing, shortfall) =>
      `This uses your available regional stake of ${existing} SGCTL, then stakes ${shortfall} more from your wallet GCTL balance.`,

    weeklyForWeeks: (n) => `weekly for ${n} week${n === "1" ? "" : "s"}.`,
    weeklyFor99Weeks: "weekly for 99 weeks.",
    weeklyFor100Weeks: "weekly for 100 weeks.",

    shareTitlePrefix: (farmLabel) => `Glow • ${farmLabel}`,
    shareTitleFallback: "Glow",
    shareTextMiners: (quantity, farmLabel, domain) =>
      `I just bought ${quantity} miner${quantity === "1" ? "" : "s"} from ${farmLabel} on @glowFND\n\n${domain}`,
    shareTextDelegation: (farmLabel, asset, domain) =>
      `I just helped fund ${farmLabel} by delegating ${asset} tokens.\n\nYou can do the same on ${domain}`,
    shareFarmFallback: "a solar farm",

    successDetailQuantity: "Quantity",
    successDetailTotalUsdc: "Total USDC",
    successDetailTotalSgctlDelegated: "Total SGCTL Delegated",
    successDetailTotalGlwDelegated: "Total GLW Delegated",

    successPurchaseComplete: "Purchase Complete!",
    successDelegationComplete: "Delegation Complete!",
    successPurchaseSubtitle: "You helped accelerate real-world solar deployment.",
    successDelegationSubtitle: "You just activated real-world solar rewards.",
    successLeft: (n) => `${n} left`,
    successAlreadyFilled: "Already filled",
    successYourContribution: "Your contribution",
    successProjectedWeeklyRewards: "Projected Weekly Rewards",
    successEstWeeklyImpactPoints: "Est. Weekly Impact Points",
    successPtsUnit: "pts",
    successEmissions: "Emissions",
    successVaultBonus: "Vault Bonus",
    successMinerBonusPrefix: "3x miner bonus",
    successMinerBonusSuffix: "applies at weekly rollover",
    successShare: "Share",
    successClose: "Close",

    processingTransactionFailed: "Transaction Failed",
    processingTransactionPending: "Transaction Pending",
    processingTransactionInFlight: "Processing Transaction",
    processingErrorBody: "There was an error processing your transaction.",
    processingPendingBody:
      "Your transaction was submitted, but Glow has not indexed it yet. Please wait for indexing to catch up before trying again.",
    processingActiveBody: "Please wait while we process your transaction.",
    processingPendingExplainer:
      "The network transaction may already be mined. Glow will reflect it after the split indexer catches up. Do not submit the purchase again unless you have refreshed and confirmed nothing changed.",
    processingClose: "Close",
    processingTryAgain: "Try Again",
    processingRefreshAndRetry: "Refresh & Retry",
    processingTransactionFailedFallback: "Transaction failed",
    stakeSyncUnableToVerify:
      "Unable to verify your recent stake right now. Please wait a few seconds and retry.",
    stakeSyncBalanceUpdating:
      "Your new balance is still updating. Please wait a moment and try again.",

    reviewTitleMiners: "Buy Miners",
    reviewTitleSgctl: "Delegate SGCTL",
    reviewTitleGlw: "Delegate GLW",
    reviewQuantityLabel: "Quantity",
    reviewQuantityAvailable: (n) => `${n} available`,
    reviewMaxButton: "Max",
    reviewEstWeeklyRewards: "Est. Weekly Rewards",
    reviewValueLabel: "Value",
    reviewSelectCurrency: "Select Currency",
    reviewDelegationSource: "Delegation Source",
    reviewYouDelegate: "You Delegate",
    reviewDelegationAmount: "Delegation Amount",
    reviewSourceCost: "Source Cost",
    reviewSwapCost: "Swap Cost",
    reviewTotal: "Total",
    reviewStable: "Stable",
    reviewApprox: (val) => `≈ $${val}`,

    paymentLabelGlw: "Glow (GLW)",
    paymentLabelSgctl: "Staked (SGCTL)",
    paymentLabelGctl: "Control (GCTL)",
    paymentLabelUsdc: "USD Coin (USDC)",
    paymentLabelEth: "Ethereum (ETH)",
    paymentBalancePrefix: (balance) => `Balance: ${balance}`,
    paymentSgctlInRegion: (amount) => `${amount} SGCTL in region`,
    paymentGctlWallet: (amount) => `${amount} wallet`,

    previewDelegationAmount: "Delegation amount",
    previewSourceAmount: "Source amount",
    previewSourceCost: "Source cost",
    previewSwapCost: "Swap cost",
  },
  sponsoredFarmsActivity: {
    timeNow: "now",
    timeSecondsAgo: (n) => `${n}s ago`,
    timeMinutesAgo: (n) => `${n}m ago`,
    timeHoursAgo: (n) => `${n}h ago`,
    timeDaysAgo: (n) => `${n}d ago`,
    timeWeeksAgo: (n) => `${n}w ago`,
    timeMonthsAgo: (n) => `${n}mo ago`,
    timeYearsAgo: (n) => `${n}y ago`,

    avgScore: "Avg Score",
    avgRewardScore: "Avg Reward Score",
    rewardScoreSuffix: "reward score",
    buyers: "Buyers",
    delegators: "Delegators",
    contributors: "Contributors",
    usdcSpent: "USDC Spent",
    totalUsdcSpent: "Total USDC Spent",
    glwDelegated: "GLW Delegated",
    totalGlwDelegated: "Total GLW Delegated",
    totalVolumeSuffix: "total volume",
    miners: "Miners",
    purchasedSuffix: "purchased",
    farms: "Farms",
    fundedSuffix: "funded",
    minersUsdc: "Miners USDC",
    usdcSpentByMiners: "USDC Spent by Miners",
    minerVolumeSuffix: "miner volume",

    errorLoading: (msg) => `Error loading purchase activity: ${msg}`,
    pleaseTryAgain: "Please try again later",
    noPurchaseActivity: "No purchase activity found.",
    recentPurchasesAppear: "Recent share purchases will appear here",

    badgeMiner: "Miner",
    badgeDelegation: "Delegation",
    badgeDelegator: "Delegator",

    headerTotal: "Total",
    headerAmount: "Amount",
    headerDate: "Date",
    headerRewardScore: "Reward Score",
    headerFarm: "Farm",
    headerType: "Type",
    headerWallet: "Wallet",

    seeAllActivity: "See All Activity",
  },
  streak: {
    title: "Weekly Streak",
    weeks: (n) => `${n} weeks`,
    joinGlow: "Join Glow",
    trackOwnStreakAt: "Track your own mining streak at",
  },
};

const ko: RoutesStrings = {
  gctlLanding: {
    buyGlw: "GLW 구매",
    goToDashboard: "대시보드로 이동",
    mintAndStake: "GCTL 민트 & 스테이크",
    connectPrompt: "시작하려면 지갑을 연결하세요",
    youHoldGctl: (amount) => `${amount} GCTL 보유 중. `,
    mintPriceNote:
      "민트 가격 = √GLW 가격. 자금은 Glow Endowment로 유입됩니다.",
    eyebrow: "Glow Control (GCTL)",
    headlinePrefix: "태양광 인프라가 구축될 지역을",
    headlineHighlight: "결정하세요",
    description:
      "GCTL은 Glow가 태양광 발전소를 어디에 구축할지 결정할 수 있게 합니다. GCTL을 스테이크하고 관심 있는 지역을 지원하세요.",
    benefitSteeredHeader: "스티어링 GLW당 +3 포인트",
    benefitSteeredDesc: "주간 임팩트 점수를 부스트하세요",
    benefitFundHeader: "전 세계 태양광 지원",
    benefitFundDesc: "Utah, Colorado, Missouri 등 지역 선택",
    learnHowItWorks: "GCTL 작동 방식 알아보기",
    statSteeredAmount: "175K",
    statSteeredUnit: "GLW / 주",
    statSteeredDescDesktop1: "GCTL 스테이커가",
    statSteeredDescDesktop2: "매주 스티어링",
    statSteeredDescMobile: "매주 스티어링",
    statBoostAmount: "3배",
    statBoostLabel: "임팩트 포인트",
    statBoostDescDesktop1: "스티어링한 GLW당",
    statBoostDescDesktop2: "내 지역에 적용",
    statBoostDescMobile: "스티어링한 GLW당",
    heroAlt: "작업자와 태양광 패널",
  },
  miningCenter: {
    title: "마이닝 센터",
    subtitle: "다음 마이너 배치가 곧 제공됩니다",
    yourMiners: "내 마이너",
    order: "정렬",
    descending: "내림차순",
    ascending: "오름차순",
    allZones: "전체 지역",
    filter: "필터",
    refineSearch: "검색 조건 세분화",
    pleaseTryAgain: "잠시 후 다시 시도해주세요",
    noImagesAvailable: "이미지 없음",
    minersAvailable: "사용 가능한 마이너",
    weeklyRewardsPerMiner: "마이너당 주간 리워드",
    currentWeeklyRate: "지역 발행분과 활성 마이너 기준 현재 주간 비율",
    rewardsMayDecrease: "새 지역 발전소가 온라인되면 리워드가 감소할 수 있습니다",
    pricePerMiner: "마이너당 가격",
    advancedStats: "고급 통계",
    fullyFunded: "펀딩 완료",
    noMinersAvailable: "사용 가능한 마이너 없음",
    buyMiners: "마이너 구매",
  },
  launchpad: {
    title: "런치패드",
    subtitle: "GLW를 위임하여 새 태양광 발전소 출범을 지원하세요",
    active: "활성",
    filled: "채움 완료",
    allRegions: "전체 지역",
    sortBy: "정렬 기준",
    payDeposit: "디포짓 납부",
    viewDetails: "상세 보기",
    target: "목표",
    raised: "모금액",
    delegators: "위임자",
    filters: "필터",
    refineSearch: "검색 조건 세분화",
    all: "전체",
    delegation: "위임",
    miners: "마이너",
    allZones: "전체 지역",
    yourBalance: "내 잔액",
    yourGlw: "내 GLW",
    pleaseTryAgain: "잠시 후 다시 시도해주세요",
    noImagesAvailable: "이미지 없음",
    availableLabel: "사용 가능",
    rewardScore: "리워드 점수",
    rewardScoreTooltip:
      "리워드 점수는 발행분과 프로토콜 디포짓 리워드를 위임 달러당 단일 추정치로 결합한 지표입니다.",
    perMiner: "마이너당",
    perFraction: "프랙션당",
    fullSponsorship: "완전 후원",
    priceNotAvailable: "가격 정보 없음",
    estimatesUpdateWeekly:
      "추정치는 새 발전소와 위임이 지역 발행분 비중을 바꿀 때 매주 업데이트됩니다.",
    emissions: "발행분",
    advancedStats: "고급 통계",
    rewardScoreCombines:
      "리워드 점수는 두 가지 수익원(발행분과 프로토콜 디포짓 회수)을 단일 추정치로 결합합니다.",
    estimatedEarningsNote: "예상 수익은 변경될 수 있습니다.",
    estimatedRewards: "예상 리워드",
    estimatedRewardsLower: "예상 리워드",
    canDecreaseNote:
      "지역이 채워질수록 감소할 수 있습니다. 자세한 내용은 고급 통계를 확인하세요.",
    units: "수량",
    weeklyEarningsNote: "주간 수익은 변경될 수 있습니다.",
    activity: "활동",
    region: "지역",
    glowLaunchpad: "Glow 런치패드",
    type: "종류",
    zone: "구역",
    unnamedFarm: "이름 없는 발전소",
    badgeMiner: "마이너",
    badgeDelegation: "위임",
    scorePrefix: (n) => `점수: ${n}`,
    totalMined: "총 채굴",
    totalDelegated: "총 위임",
    priceLabel: "가격",
    amountLabel: "금액",
    pricePerMiner: "마이너당 가격",
    pricePerMinerShort: "마이너당 가격",
    delegationAmount: "위임 금액",
    free: "무료",
    leftFraction: (remaining, total) => `${remaining}/${total} 남음`,
    toSellOutSuffix: (time) => `매진까지 ${time}`,
    weeklyHundred: "주간 (100주)",
    weeklyMiner: (weeks) => `주간 (${weeks})`,
    weeklyEarningsLine: (val) => `+${val} GLW / 주`,
    weeklyEarningsSubject: "예상 수익은 변경될 수 있습니다.",
    estWeeklyRewardsHeader: "예상 주간 리워드",
    estWeeklyRewardsHundred: "예상 주간 리워드 (100주)",
    estWeeklyTooltipBody:
      "위임당 예상 주간 리워드로 100주 동안 매주 지급됩니다. 네트워크 변화에 따라 변동될 수 있습니다.",
    paidWeeklyDelegationNote:
      "100주 동안 매주 지급. 자세한 내용은 고급 통계를 참고하세요.",
    paidWeeklyMinerNote: (weeks) =>
      `${weeks} 동안 매주 지급. 자세한 내용은 고급 통계를 참고하세요.`,
    calculatingRewards: "리워드 계산 중...",
    soldOut: "매진",
    buyMiners: "마이너 구매",
    delegateSgctl: "SGCTL 위임",
    delegateGlw: "GLW 위임",
    activeListing: "활성 매물",
    activeListings: "활성 매물",
    stablePriceLower: "고정 가격",
    stablePriceUpper: "고정 가격",
    waitlist: "대기열",
    instant: "즉시",
    unavailable: "사용 불가",
    nextBatchSoon: "다음 발전소 배치가 곧 제공됩니다",
    sellOutTime: "매진 시간",
    available: "사용 가능",
    scoreLoading: "점수: …",
    sortFeatured: "추천",
    sortNewest: "최신순",
    sortRewardScore: "리워드 점수",
    sortYieldPer1000: "수익률 / $1000",
    sortPlaceholder: "정렬",
    learnAboutRewardScore: "리워드 점수에 대해 알아보기",
    paginationPrevious: "이전",
    paginationNext: "다음",
    pdFromPdsLabel: (currency) => `PD로부터 ${currency}`,
    glwFromInflation: "인플레이션으로부터 GLW",
    soldOutInPrefix: (time) => `${time} 만에 매진`,
    leftFractionUpper: (remaining, total) => `${remaining} / ${total} 남음`,
    weeklyGlwPerWeek: (val) => `+${val} GLW/주`,
    weeklyUsdPerWeek: (val) => `≈ $${val} USD/주`,
    estRewards100Weeks: "예상 리워드 (100주)",
    weeklyEstDelegationDesc:
      "위임당 주간 예상 리워드로 100주 동안 매주 지급됩니다. 지역이 채워질수록 감소할 수 있습니다. 자세한 내용은 고급 통계를 확인하세요.",
    calculatingBreakdown: "내역 계산 중…",
    weeklyMinerHeader: (weeks) => `주간 리워드 (${weeks})`,
    weeklyMinerDesc: (weeks) =>
      `${weeks} 동안 마이너당 예상 주간 리워드입니다. 새 발전소가 지역에 합류하여 지역 GLW 할당이 희석되면 감소할 수 있습니다. 자세한 내용은 고급 통계를 확인하세요.`,
    scoreLabelInline: "점수:",
    rewardScoreLongDescription:
      "리워드 점수는 두 가지 수익원(디포짓 회수와 GLW 인플레이션)을 위임 달러당 예상 리워드를 나타내는 단일 지표로 결합한 도구입니다. 리워드 점수가 높을수록 일반적으로 더 나은 위임 기회를 의미하지만, 발전소의 실제 경쟁력과 리워드는 새 발전소가 지역에 합류할 때 변할 수 있으므로 실현 성과를 보장하지는 않습니다.",
    helperPrompt: "어디서부터 시작할지 모르시나요? 다음 항목을 알아보세요:",
    helperDelegating: "GLW 위임하기",
    helperOr: "또는",
    helperBuyingMiners: "마이너 구매하기",
    tabAllN: (n) => `전체 (${n})`,
    tabDelegationsN: (n) => `위임 (${n})`,
    tabMinersUsdcN: (n) => `마이너 (USDC) (${n})`,
  },
  liquidity: {
    title: "유동성",
    subtitle: "GLW/USDG 풀에 유동성을 공급하세요",
    pool: "풀",
    yourPosition: "내 포지션",
    addLiquidity: "유동성 추가",
    removeLiquidity: "유동성 제거",
    incentives: "인센티브",
    tvl: "TVL",
    apr: "APR",
    volume24h: "거래량 (24시간)",
    needMoreUsdg: "USDG가 더 필요하신가요?",
    goToSwap: "스왑으로 이동",
    rewardsSummary: "리워드 요약",
    exchangeFeeRewards: "거래 수수료 리워드",
    liquidity: "유동성",
    yourPositions: "내 포지션",
    remove: "제거",
    noActivePositions: "활성 포지션이 없습니다",
    addLiquidityToStart: "유동성을 추가하여 리워드를 받기 시작하세요",
    estApy: "예상 APY",
    feesApy: "수수료 APY",
    glwRewards: "GLW 리워드",
    exchangeFeeRewardsLower: "거래 수수료 리워드",
    currentPoolValue: "현재 풀 가치",
    addLiquiditySubtitle:
      "GLW/USDG 풀에 유동성을 추가하고 리워드를 받기 시작하세요",
    input: "입력",
    balanceLabel: "잔액:",
    insufficientFunds: "잔액 부족",
    insufficientTokenBalance: (token) => `${token} 잔액 부족`,
    enterAmounts: "금액 입력",
    review: "검토",
    enterValidAmounts: "유효한 GLW 및 USDG 금액을 입력하세요",
    poolReservesChanged:
      "풀 준비금이 변경되었습니다. 현재 금액은 슬리피지 조건에서 실패할 가능성이 높습니다. 풀 비율에 맞게 금액을 조정하세요.",
    glwIncentiveProgramEnded: "GLW 인센티브 프로그램 종료",
    glwIncentiveEndedNotice:
      "GLW 인센티브 프로그램은 2025년 11월 25일에 종료되었습니다. 유동성을 추가해 거래 수수료를 계속 받을 수 있습니다.",
    glwIncentives: "GLW 인센티브",
    programEndedSuffix: " (프로그램 종료)",
    incentiveApyEnded: "인센티브 APY (종료)",
    incentiveApyActive: "인센티브 APY",
    incentiveApyComing: "인센티브 APY (예정)",
    combinedApy: "합산 APY",
    currentApy: "현재 APY",
    feesOnlyUntilStart: "인센티브 시작 전에는 수수료만 포함됩니다",
  },
  stats: {
    economyOverview: "경제 개요",
    protocolActivity: "프로토콜 활동",
    lifetimeFarms: "누적 발전소",
    marketTickers: "시장 시세",
    regionsStaking: "지역별 스테이킹",
    impactLeaderboard: "임팩트 리더보드",
    leaderboardDesc:
      "Glow의 임팩트 리더보드를 탐색하고 임팩트 점수 기준 상위 지갑을 확인하세요.",
    supplyAndLiquidity: "GLW 공급 & 유동성",
    marketCap: "GLW 유통 시가총액",
    circulatingPrefix: "유통량:",
    pctDelegated: "GLW 활성 위임 비율",
    activelyDelegatedOf: (delegated, circulating) =>
      `활성 위임 ${delegated} / 유통 ${circulating}`,
    usdcLiquidityUniswap: "USDC 유동성 (Uniswap)",
    poolGlw: (glw) => `풀 GLW: ${glw}`,
    endowmentLiquidity: "Glow Endowment 제공 유동성",
    noLpTokens: "LP 토큰 없음",
    andGlw: (amount) => `+ GLW ${amount}`,
    gctlOverview: "GCTL 개요",
    numberOfGctl: "GCTL 토큰 수",
    mintedToDate: "현재까지 민팅됨",
    basedOnMint: "민트 가격 기준",
    participants: "참여자",
    activeParticipants: "활성 참여자",
    yieldAndFlows: "수익률 및 흐름",
    avgDelegatorApr: "평균 위임자 APY",
    timeWeightedNote: "시간 가중, 지역 가중",
    avgMinerApr: "평균 마이너 APY",
    allActiveMiners: "전체 활성 마이너",
    marketTickers2: "시장 시세",
    protocolActivity2: "프로토콜 활동",
    gctlStakingByRegion: "지역별 GCTL 스테이킹",
    protocolEvents: "프로토콜 이벤트",
    gctlMinting: "GCTL 민팅",
    tokenCreationEvents: "토큰 생성 이벤트",
    gctlStaking: "GCTL 스테이킹",
    stakeUnstakeEvents: "스테이크 & 언스테이크 이벤트",
    recentActivity: "최근 활동",
    live: "실시간",
    seeAll: "전체 보기",
    delegationHistory: "위임 내역",
    delegationHistoryDesc: "모든 발전소의 위임 및 위임 해제 이벤트",
    minersHistory: "마이너 내역",
    minersHistoryDesc: "모든 발전소의 마이너 구매 이벤트",
    mintedHistory: "민팅 내역",
    mintedHistoryDesc: "모든 GCTL 민팅 이벤트",
    stakedHistory: "스테이킹 내역",
    stakedHistoryDesc: "모든 GCTL 스테이크 및 언스테이크 이벤트",
    unableToLoadRegional: "현재 지역 스테이킹 데이터를 불러올 수 없습니다.",
    noRegionsAvailable: "현재 사용 가능한 지역이 없습니다.",
    stakedGctl: "스테이킹된 GCTL",
    shareOfTotal: "전체 비중",
    totalPds: "총 PD",
    launchpadDelegation: "런치패드 위임",
    communityBackedFarms: "커뮤니티 후원 태양광 발전소",
    glowMiners: "Glow 마이너",
    miningInfrastructure: "마이닝 인프라",
    remaining: "남음",
    noDelegationsYet: "아직 위임이 없습니다",
    delegationsAppear:
      "위임이 발생하면 여기에 표시됩니다. 위의 사용 가능한 발전소부터 시작하세요.",
    noPurchasesYet: "아직 구매가 없습니다",
    minerPurchasesAppear: "마이너 구매 내역이 여기에 표시됩니다.",
    seeAudit: "감사 보기",
    auditPending: "감사 대기",
    lifetimeFarmsOnboarded: "누적 온보딩 발전소",
    solarFarmsBroughtOnline: "가동된 태양광 발전소",
    totalOnboarded: "총 온보딩",
    lifetimeFarmsCompleted: "감사 완료된 누적 발전소",
    totalGlwDelegated: "총 위임 GLW",
    delegatedToSolar: "태양광 발전소에 위임됨",
    noCompletedFarms: "아직 완료된 발전소가 없습니다",
    completedFarmsList: "완료된 발전소",
    currentPrice: "현재 가격",
    glwSpotPrice: "GLW 현물 가격",
    glwEdgapPrice: "GLW Edgap 가격",
    gctlMintPrice: "GCTL 민트 가격",
    glwSpotTooltip:
      "Uniswap 풀의 실시간 시장 가격입니다. 공개 시장에서 GLW 토큰을 매매할 수 있는 현재 거래 가격입니다.",
    glwEdgapTooltip:
      "지수 감쇄 적용 유동성 인식 가격. 프로토콜이 GCTL 가격 책정에 사용하는 평활화된 안정적 가격 신호입니다. 시장 변화에는 반응하지만 단기 노이즈는 걸러냅니다.",
    gctlMintTooltip:
      "새 GCTL 토큰의 동적 민트 가격 = ceil(√GLW 가격 / $0.05) × $0.05. GLW 가격의 제곱근을 5센트 단위로 올림 처리합니다.",
    viewPairOnDefined: "Defined.fi에서 페어 보기",
    rewardsLeaderboard: "리더보드",
    tabImpact: "임팩트",
    tabImpactDesc: "주간 임팩트 점수 및 리더보드",
    tabDelegators: "위임자",
    tabDelegatorsDesc: "위임 활동 및 순위",
    tabMiners: "마이너",
    tabMinersDesc: "마이너 배수 상태 및 순위",
    tabFarms: "발전소",
    tabFarmsDesc: "태양광 발전소 및 후원 성과",
  },

  liquidityDialogs: {
    cancel: "취소",
    confirm: "확정",
    processing: "처리 중...",
    transactionFailed: "트랜잭션 실패",
    processingTransaction: "트랜잭션 처리 중",
    addReviewTitle: "검토 및 확정",
    addSuccessTitle: "+ 유동성 추가됨",
    actionWouldLikelyFail: "작업이 실패할 가능성이 높습니다",
    addReviewDescription: "확정하기 전에 세부 내용을 검토하세요",
    addProcessingDescription: "풀에 유동성을 추가하는 동안 잠시 기다려주세요",
    addPoolChangedError:
      "풀 준비금이 변경되었습니다. 현재 금액은 슬리피지 조건에서 실패할 가능성이 높습니다. 닫은 후 풀 비율에 맞게 입력값을 조정하세요.",
    addGenericError:
      "트랜잭션을 처리할 수 없었습니다. 다시 시도하거나 지원팀에 문의해 주세요.",
    addToastFailed: "유동성 추가에 실패했습니다",
    addIncentiveEndedAck:
      "GLW 인센티브 프로그램이 종료되었으며, 새로 추가하는 유동성은 GLW 리워드를 받지 않는다는 점을 이해했습니다.",
    addIncentivePendingAck:
      "GLW 리워드는 v2 스마트 컨트랙트 재출시 이후 청구 가능하며, 재출시일은 아직 정해지지 않았다는 점을 이해했습니다.",
    detailUsdgAmount: "USDG 금액",
    detailGlwAmount: "GLW 금액",
    detailShareOfPool: "풀 지분",
    detailUsdgAdded: "추가된 USDG",
    detailGlwAdded: "추가된 GLW",
    removeTitle: "유동성 제거",
    removeSuccessTitle: "유동성 제거 완료",
    processingWithdrawal: "출금 처리 중",
    removeDescription: "제거할 유동성 비율을 선택하세요",
    removeProcessingDescription: "풀에서 유동성을 제거하는 동안 잠시 기다려주세요",
    removeGenericError: "출금을 처리할 수 없었습니다. 다시 시도해주세요.",
    removeToastFailed: "유동성 제거에 실패했습니다",
    detailWithdrawalPercentage: "출금 비율",
    detailUsdgToReceive: "수령할 USDG",
    detailGlwToReceive: "수령할 GLW",
    detailUsdgRemoved: "제거된 USDG",
    detailGlwRemoved: "제거된 GLW",
    selectWithdrawalAmount: "출금 금액 선택",
    youWillReceive: "받게 될 금액",
    closeButton: "닫기",
    incentiveTitle: "유동성 인센티브 지급",
    incentiveBody:
      "GLW/USDG 풀에 유동성을 공급하여 거래 수수료와 프로토콜 인센티브로 보상을 받으세요.",
    incentiveTitleEnded: "유동성 인센티브 지급 (종료)",
    incentiveEnded1:
      "GLW 유동성 인센티브 프로그램은 2025년 9월 2일부터 2025년 11월 25일까지 진행되었으며 현재 종료되었습니다.",
    incentiveEnded2:
      "기존 유동성 공급자는 GLW V2 스마트 컨트랙트가 가동되면 획득한 GLW 리워드를 받게 됩니다. UI는 유동성 포지션과 획득한 리워드를 계속 추적합니다.",
    incentiveEnded3:
      "거래 수수료 수익을 위해 유동성을 추가할 수 있지만, 추가 GLW 인센티브는 배포되지 않습니다.",
    incentiveActive1:
      "Glow는 2025년 9월 2일부터 2025년 11월 25일까지 유동성 공급자에게 매주 5,000 GLW를 배포하는 프로모션을 진행합니다.",
    incentiveActive2:
      "유동성 공급자는 공급한 유동성의 양과 공급 기간에 따라 GLW 토큰을 획득합니다. 리워드는 지수적으로 구성됩니다:",
    incentiveBullet1: "1일 후, 유동성 공급자는 1배 리워드를 획득합니다",
    incentiveBullet2: "10일 후, 유동성 공급자는 1.5배 리워드를 획득합니다",
    incentiveBullet3: "100일 후, 유동성 공급자는 2.25배 리워드를 획득합니다",
    incentiveActive3: "...몇 분마다 리워드가 꾸준히 증가합니다",
    incentiveActive4:
      "GLW 리워드는 GLW V2 스마트 컨트랙트가 가동되면 유동성 공급자에게 배포됩니다. UI는 유동성 포지션과 획득한 리워드 수를 추적합니다.",
    iUnderstand: "확인했습니다",
  },

  processingModal: {
    transactionFailed: "트랜잭션 실패",
    transactionId: "트랜잭션 ID",
    close: "닫기",
    processingPurchase: "구매 처리 중",
    ethereumMainnet: "이더리움 메인넷",
    explorer: "익스플로러",
    continueInBackground: "백그라운드로 계속",
    checkingStatus: "트랜잭션 상태 확인 중...",
    sentSubtitle: "USDC가 전송되었습니다. GCTL이 곧 적립됩니다.",
    etaPrefix: "예상:",
    completeSoon: "처리가 곧 완료됩니다",
    progressPercentLine: (pct) =>
      `${pct}% 완료 • 10초마다 상태 확인`,
    statusLabel: "상태",
    networkLabel: "네트워크",
    statusChecking: "확인 중...",
    statusProcessing: "처리 중",
    safeCloseHint:
      "이 창을 닫아도 안전합니다. 처리는 계속되며 잔액이 자동으로 업데이트됩니다.",
    transactionIdCopied: "트랜잭션 ID가 클립보드에 복사되었습니다",
  },
  farmsLeaderboard: {
    totalRewardsUsd: "총 리워드 (USD)",
    noDataAvailable: "차트에 표시할 데이터가 없습니다",
    selectRegion: "지역 선택",
    allRegions: "전체 지역",
    perWeek: "/주",
    region: "지역",
    unableToLoad: "지금은 발전소 데이터를 불러올 수 없습니다.",
    v2WeeklyBreakdown: "V2 주간 리워드 분석 및 발전소 통계",
    weeksActive: "활성 주차",
    totalGlwEmissions: "총 GLW 발행량",
    totalPdRewards: "총 PD 리워드",
    protocolDeposit: "프로토콜 디포짓",
    weekHeader: "주",
    currencyHeader: "통화",
    glwEmissions: "GLW 발행량",
    pdRewardsDistributed: "분배된 PD 리워드",
    weekN: (n) => `${n}주차`,
    total: "합계",
    noRewardsForFarm: "이 발전소에 대한 주간 리워드 데이터가 없습니다",
    totalFarms: "전체 발전소",
    farmsIn: (region) => `${region} 발전소`,
    allFarmsTracked: (n) => `추적 중인 전체 발전소 (최근 리워드 ${n}개)`,
    farmsInRegionWithRewards: (n) => `지역 내 발전소 (최근 리워드 ${n}개)`,
    lastWeekRewards: "지난주 리워드",
    distributedToFarms: (n) =>
      `최근 데이터가 있는 ${n}개 발전소에 분배됨`,
    networkEfficiency: "네트워크 효율",
    avgRegionEfficiency: "지역 평균 효율",
    weightedByDeposits: "전체 발전소의 프로토콜 디포짓 가중치 적용",
    creditsPer100k: "$10만 디포짓당 주간 카본 크레딧",
    topFarmEfficiency: "최고 발전소 효율",
    highestPerforming: "최고 성과 발전소",
    lastWeekRewardsByAsset: "자산별 지난주 리워드",
    rewardsCardTitle: (currency) => `${currency} 리워드`,
    usdValue: (val) => `$${val} USD 가치`,
    weeklyRewardsOverview: "주간 리워드 개요",
    overviewDescAll:
      "최근 리워드 활동이 있는 상위 20개 발전소를 총 분배 리워드(USD) 기준으로 표시합니다.",
    overviewDescRegion: (region) =>
      `${region}의 최근 리워드 상위 20개 발전소를 총 리워드(USD) 기준으로 표시합니다.`,
    sortByPlaceholder: "정렬 기준",
    efficiencyScore: "효율 점수",
    farmLeaderboard: "발전소 리더보드",
    farmLeaderboardDescAll:
      "효율 점수 기준 순위. 모든 발전소의 리워드와 카본 크레딧 지표를 표시합니다.",
    farmLeaderboardDescRegion: (region) =>
      `${region} 발전소를 효율 점수 기준으로 표시합니다.`,
    rank: "순위",
    rankTooltip:
      '효율 점수 기준. 상위 3개는 정확한 순위, 나머지는 백분위(예: "상위 5%")로 표시됩니다.',
    farmName: "발전소 이름",
    efficiency: "효율",
    glwPerWeek: "GLW/주",
    pdRewards: "PD 리워드",
    carbonCredits: "카본 크레딧",
    actions: "작업",
    viewDetails: "자세히 보기",
    topPercent: (n) => `상위 ${n}%`,
    farmFallback: (id) => `발전소 ${id}`,
    regionFallback: (id) => `지역 ${id}`,
  },
  launchpadStats: {
    title: "위임 상세 통계",
    subtitle: (zoneName) => `${zoneName}의 예상 성과를 평가하세요`,
    snapshotHeading: "기회 스냅샷",
    snapshotDesc:
      "감사된 발전소 성과와 현재 시장 조건을 기반으로 한 분할당 예상 수익입니다.",
    regionHeading: "지역 컨텍스트",
    regionDesc:
      "지역 경쟁 환경과 네트워크 활동입니다. 발전소는 같은 지역 안에서만 경쟁합니다.",
    delegatedToken: (currency) => `위임된 ${currency}`,
    delegatedTooltip: (currency) =>
      `분할당 프로토콜 디포짓으로 예치해야 하는 ${currency} 수량입니다.`,
    estimatedRewardsPerWeek: "주간 예상 리워드",
    estimatedGlwPerWeek: "주간 예상 GLW",
    rewardsTooltipSgctl:
      "SGCTL 프로토콜 디포짓 회수와 GLW 발행량 분배에서 발생하는 주간 예상 리워드입니다.",
    rewardsTooltipDefault:
      "디포짓 회수와 GLW 발행량 분배에서 발생하는 주간 예상 리워드입니다.",
    efficiencyScore: "효율 점수",
    efficiencyTooltip:
      "감사된 발전소 예측치를 기반으로 한 $10만 디포짓당 주간 예상 카본 크레딧입니다.",
    regionLabel: (val) => `지역: ${val}`,
    estimatedApy: "예상 APY",
    apyTooltip:
      "예상 발전소 성과와 지역 경쟁력을 기반으로 한 디포짓 회수 및 발행 포함 연간 환산 수익률입니다.",
    apyFootnote: "예상치이며 매주 변경됩니다",
    ccsPerWeek: "주간 CC",
    ccsPerWeekTooltip: "분할당 주간 예상 카본 크레딧 생성량입니다.",
    perFraction: "분할당",
    sgctlFromCCs: "CC 기반 SGCTL",
    glwFromCCs: "CC 기반 GLW",
    fromCCsTooltipSgctl:
      "카본 크레딧 생성을 기반으로 한 프로토콜 디포짓 회수 주간 SGCTL 리워드입니다.",
    fromCCsTooltipDefault:
      "카본 크레딧 생성을 기반으로 한 디포짓 회수 주간 GLW 리워드입니다.",
    pctOfTotalUsd: (val) => `총 주간 USD 리워드의 ${val}%`,
    pctOfTotal: (val) => `총 리워드의 ${val}%`,
    glwFromEmissions: "발행 기반 GLW",
    glwFromEmissionsTooltip: "프로토콜 발행량 분배 주간 GLW 리워드입니다.",
    solarPanels: "태양광 패널",
    solarPanelsTooltip: "이 발전소에 설치된 태양광 패널 총 수량입니다.",
    totalPanels: "총 패널 수",
    region: "지역",
    activeFarms: "활성 발전소",
    farmsUnderConstruction: "건설 중 발전소",
    regionalGlwPerWeek: "지역 주간 GLW",
    naValue: "해당 없음",
    usdApprox: (val) => `≈ $${val} USD`,
    expectationHeader: "기대치 기반 리워드:",
    expectationDesc:
      " 수익은 실제 주간 성과가 아니라 발전소 건설 시 감사된 평생 탄소 상쇄 기대치를 기반으로 계산됩니다. 이를 통해 위임자는 기상 변동성과 운영 리스크로부터 보호받고, 경쟁은 최대 기후 임팩트에 집중됩니다. 실제 수익은 지역 경쟁력, 시장 조건, 네트워크 성장에 따라 달라집니다. 디포짓 회수와 GLW 발행은 실제 발전소 산출과 관계없이 원래 예측치를 기반으로 진행됩니다.",
    detailsAriaLabel: (label) => `${label} 상세`,
    sgctlPlusGlw: (sgctl, glw) => `${sgctl} SGCTL + ${glw} GLW`,
  },
  miningStats: {
    title: "마이닝 상세 통계",
    subtitle: (zoneName) => `${zoneName} 태양광 발전소의 분할 마이닝 포지션`,
    snapshotHeading: "기회 스냅샷",
    snapshotDesc:
      "활성 태양광 발전소에서 GLW를 획득하는 사전 패키지된 마이닝 포지션의 주요 지표입니다.",
    regionHeading: "지역 컨텍스트",
    regionDesc:
      "이 발전소의 토큰 발행을 지원하는 지역 GLW 할당량과 네트워크 활동입니다.",
    cost: "비용",
    costTooltip: "이 마이너에 대한 USDC 선납금입니다.",
    perMiner: "마이너당",
    estimatedGlwPerWeek: "주간 예상 GLW",
    weeklyGlwTooltip:
      "발전소 할당량과 보상 분배 비율을 기반으로 한 마이너당 현재 주간 GLW 토큰 적립량입니다.",
    duration: "기간",
    durationTooltip: "발전소의 GLW 발행 일정 잔여 주차입니다.",
    weeks: "주",
    estimatedApr: "예상 APR",
    aprTooltip:
      "현재 GLW 발행량과 가격을 기반으로 한 연간 환산 수익률. 신규 지역 발전소에 의한 희석은 가정하지 않습니다.",
    aprFootnote: "예상치이며 매주 변경됩니다",
    region: "지역",
    weeklyGlw: "주간 GLW",
    regionalGlwTooltip:
      "GCTL 스테이킹을 기반으로 이 지역에 할당된 총 주간 GLW입니다.",
    activeFarms: "활성 발전소",
    activeFarmsTooltip: "이 지역에서 현재 운영 중인 발전소입니다.",
    farmsPipeline: "발전소 파이프라인",
    farmsPipelineTooltip: "완공을 기다리는 파이프라인 발전소입니다.",
    naValue: "해당 없음",
    usdApprox: (val) => `≈ $${val} USD`,
    detailsAriaLabel: (label) => `${label} 상세`,
    prePackagedHeader: "사전 패키지된 마이닝 포지션:",
    prePackagedDesc: (weeks) =>
      ` 각 마이닝 포지션은 활성 태양광 발전소의 GLW 토큰 발행에 대한 분할 청구권을 나타냅니다. 수익은 지역 GLW 할당량, 발전소 디포짓 규모, 사전에 정해진 보상 분배 비율을 포함한 현재 네트워크 조건에 따라 계산됩니다. 신규 발전소가 지역에 합류하여 발전소당 토큰 할당량이 희석될 수 있으므로 실제 수익은 다를 수 있습니다. GLW 가격 상승은 보장되지 않습니다. 마이닝 포지션은 라이브 태양광 인프라에서 ${weeks}주 동안 토큰 스트림을 적립합니다.`,
  },
  eventTabs: {
    noMintedEventsTitle: "민팅 이벤트가 없습니다",
    noMintedEventsDesc: "GCTL 민팅 트랜잭션이 여기에 표시됩니다",
    noStakingEventsTitle: "스테이킹 이벤트가 없습니다",
    noStakingEventsDesc:
      "스테이킹 및 언스테이킹 트랜잭션이 여기에 표시됩니다",
    fromAmount: (amount, currency) => `${amount} ${currency}에서`,
    staked: "스테이킹",
    unstaked: "언스테이킹",
    event: "이벤트",
    regionFallback: (id) => `지역 #${id}`,
    daysHoursAgo: (d, h) => `${d}일 ${h}시간 전`,
    hoursMinutesAgo: (h, m) => `${h}시간 ${m}분 전`,
    minutesAgo: (m) => `${m}분 전`,
    justNow: "방금 전",
  },
  impactLeaderboard: {
    pointsLabel: "포인트",
    rankLabel: "순위",
    percentileLabel: "백분위",
    connectToSeeRanking: "지갑을 연결하여 순위를 확인하세요",
    connectDesc:
      "임팩트 점수를 확인하고, 진행 상황을 추적하며, 리더보드에서 경쟁하세요.",
    nextUpdate: "다음 업데이트",
    currentRanking: "현재 순위",
    progress: "진행도",
    activeMultipliers: "활성 배수 및 보너스",
    glowImpactLeaderboard: "Glow 임팩트 리더보드",
    weeksRange: (start, end) => `${start}–${end} 주차`,
    updating: "업데이트 중…",
    unableToLoadYourScore: "내 점수를 불러올 수 없습니다.",
    points: "포인트",
    ranking: "순위",
    belowTopPercentile: (val) => `상위 ${val} 미만`,
    topPercentile: (val) => `상위 ${val}`,
    rankUnavailable: "현재 목록 외에는 순위를 제공하지 않습니다",
    fastestBoost: "가장 빠른 부스트",
    buyGlwHeadline: "GLW를 구매하면 즉시 포인트 적립이 시작됩니다",
    buyGlwDesc:
      "GLW를 구매하면 GlowWorth가 늘어나 점수에 지속적인 가치 포인트가 더해집니다.",
    buyGlw: "GLW 구매",
    pointsToReachRank: (pts, rank) =>
      `${rank}위에 도달하려면 ${pts}pts 필요`,
    onTrackRank1: "1위까지 가는 중! 🏆",
    onTrackHigher: "더 높은 순위로 가는 중",
    seeDetails: "자세히 보기",
    projectedRank: (rank) => `↑ 예상 순위: #${rank}`,
    officialRankUpdates:
      "공식 순위는 매주 일요일 01:00 UTC에 갱신됩니다",
    cashMinerMultiplier: "3× 캐시 마이너 배수",
    active: "활성",
    inactive: "비활성",
    cashMinerDesc:
      "활성 상태일 때 이번 주 롤오버 포인트가 3배가 됩니다.",
    buyMiner: "마이너 구매",
    steeringPower: "스티어링 파워 (sGCTL)",
    steeringDesc: "스테이킹된 GCTL로 스티어링한 GLW당 3배 포인트를 적립합니다.",
    stakeGctl: "GCTL 스테이킹",
    delegateGlwHeadline: "GLW 위임 (발행 + 볼트 보너스)",
    delegateGlwDesc:
      "GLW를 위임하여 발행 포인트와 볼트 보너스 포인트를 적립하세요.",
    delegateGlw: "GLW 위임",
    leaderboardLower: "리더보드",
    showingPagination: (from, to, total) =>
      `${total} 중 ${from}–${to} 표시`,
    filteredFrom: (n) => ` (${n}개에서 필터링됨)`,
    nWallets: (n) => `${n}개 지갑`,
    searchPlaceholder: "ENS 또는 0x… 검색",
    clearSearch: "검색 지우기",
    unableToLoadLeaderboard: "리더보드를 불러올 수 없습니다.",
    rankN: (n) => `${n}위`,
    you: "나",
    copied: "복사됨",
    copyWalletAddress: "지갑 주소 복사",
    pts: "pts",
    lastWeekColon: "지난주:",
    glowColon: "Glow:",
    multipliers: "배수",
    pointSources: "포인트 출처",
    rankCol: "순위",
    walletCol: "지갑",
    totalPoints: "총 포인트",
    lastWeekHeader: "지난주",
    glowWorth: "Glow Worth",
    pageOf: (page, total) => `${total} 페이지 중 ${page} 페이지`,
    failedLoadScoreToast: "임팩트 점수를 불러오지 못했습니다",
  },
  walletsLeaderboard: {
    delegatorRewards: "위임자 리워드",
    minerRewards: "마이너 리워드",
    noDataAvailable: "차트에 표시할 데이터가 없습니다",
    delegatorsLower: "위임자",
    minersLower: "마이너",
    pctOfCirculatingSupply: "유통 공급량 대비 %",
    glwActivelyDelegatedTooltip: "활성 위임 GLW",
    activeDelegation: "활성 위임",
    pctOfSupply: (val) => `공급량의 ${val}%`,
    unableToLoadRewards: "지금은 리워드 데이터를 불러올 수 없습니다.",
    noWalletsFound: "지갑을 찾을 수 없습니다",
    adjustFiltersDelegators:
      "필터를 조정하여 다양한 Glow 위임자 그룹을 살펴보세요.",
    adjustFiltersMiners:
      "필터를 조정하여 다양한 Glow 마이너 그룹을 살펴보세요.",
    netDelegatorRewardsTotal: "순 위임자 리워드 (전체)",
    rewardsTotal: (label) => `${label} (전체)`,
    avgPerWallet: (val) => `지갑당 평균: ${val} GLW`,
    glwActivelyDelegatedLabel: "활성 위임 GLW",
    usdcSpent: "지출한 USDC",
    currentVaultOwnership: "모든 지갑의 현재 볼트 소유권",
    newCapital: (val) => `신규 자본: $${val}`,
    glwPerWeekPer100Glw: "위임 100 GLW당 주간 GLW",
    glwPerWeekPer100Miner: "마이너 $100당 주간 GLW",
    averageWeeklyRewardsOnDelegations: "활성 위임의 평균 주간 리워드",
    averageWeeklyRewardsOnMiners: "마이너의 평균 주간 리워드",
    miners: "마이너",
    ofTotalGlwHolders: "전체 GLW 보유자 중",
    newWalletsLastWeek: (n) => `지난주 신규 지갑 +${n}`,
    newThisRange: (n) => `이번 범위에서 신규 ${n}`,
    showingTop: (n) => `상위 ${n} 표시 중`,
    chartCurrent: "현재",
    delegationChartTitle: "유통 공급량 대비 GLW 위임 비율",
    delegationChartDesc:
      "유통 GLW 공급량 중 얼마나 위임되어 있는지 시간에 따라 추적합니다",
    walletLeaderboard: "지갑 리더보드",
    rankedByCumulativeDelegators: (n) =>
      `누적 GLW 획득량 기준 순위. 상위 ${n}명의 위임자를 표시합니다. 정렬은 열 헤더를 클릭하세요.`,
    rankedByCumulativeMiners: (n) =>
      `누적 GLW 획득량 기준 순위. 상위 ${n}명의 마이너를 표시합니다. 정렬은 열 헤더를 클릭하세요.`,
    searchPlaceholder: "지갑 주소 또는 ENS 이름으로 검색...",
    rank: "순위",
    rankTooltipDelegator:
      '현재 기간 순 리워드 합계 기준. 상위 3명은 정확한 순위, 나머지는 백분위(예: "상위 5%")로 표시됩니다.',
    rankTooltipMiner:
      '누적 GLW 획득량 기준. 상위 3명은 정확한 순위, 나머지는 백분위(예: "상위 5%")로 표시됩니다.',
    wallet: "지갑",
    glwPerWeek: "GLW/주",
    netRewards: "순 리워드",
    rewardsCol: "리워드",
    netRewardsTooltip:
      "획득한 총 리워드(PD 회수 + 발행)에서 경과한 주차에 할당된 프로토콜 디포짓을 차감한 값입니다. 실제 수익을 보여줍니다.",
    share: "비중",
    shareTooltipDelegators:
      "현재 기간 모든 위임자에게 분배된 총 그로스 리워드 중 이 지갑의 비율입니다.",
    shareTooltipMiners:
      "현재 기간 모든 마이너에게 분배된 총 그로스 리워드 중 이 지갑의 비율입니다.",
    actions: "작업",
    badgeNew: "신규",
    topPercent: (n) => `상위 ${n}%`,
    showingPagination: (from, to, total, _plural) =>
      `${total}개 지갑 중 ${from}–${to} 표시 중`,
    filteredFrom: (n) => ` (${n}개에서 필터링됨)`,
    noWalletsMatching: (q) => `"${q}"와 일치하는 지갑이 없습니다`,
    previous: "이전",
    pageOf: (page, total) => `${total} 페이지 중 ${page} 페이지`,
    next: "다음",
    toastAddressCopied: "주소가 복사되었습니다",
    toastFailedCopy: "복사에 실패했습니다",
  },
  impactBuyback: {
    title: "임팩트 바이백",
    subtitle: "1단계 파일럿 – 실제 지역 목록에 연결된 모의 플로우",
    howItWorks: "작동 방식",
    learnMore: "자세히 보기",
    tabBuyback: "바이백",
    tabActivity: "활동",
    buybackCardTitle: "바이백",
    buybackCardDesc: "임팩트 크레딧을 USDG로 소각합니다. 모든 값은 모의입니다.",
    selectRegion: "지역 선택",
    loading: "불러오는 중…",
    chooseRegion: "지역을 선택하세요",
    regionPot: "지역 풀",
    unboundedSupply: "무제한 공급량",
    certificatesBalance: "인증서 잔액",
    creditsUnit: "크레딧",
    creditsToBurn: "소각할 크레딧",
    newBalanceAfterBurn: "소각 후 잔액",
    madeUsdg: "$획득",
    redeemNow: "지금 상환",
    latestBuybacks: "최신 바이백",
    latestBuybacksDesc: "지역별 최근 모의 활동",
    colWhen: "시각",
    colRegion: "지역",
    colCreditsBurned: "소각 크레딧",
    colUsdgPaid: "지급 USDG",
    toastSelectRegionFirst: "먼저 지역을 선택하세요",
    toastEnterValidAmount: "소각할 크레딧 수량을 올바르게 입력하세요",
    toastSubmittedIn: (region) => `${region}에서 바이백을 제출했습니다`,
    toastFailedSubmit: "바이백 제출에 실패했습니다",
  },
  tos: {
    title: "이용 약관",
    lastUpdated: (date) => `최종 업데이트: ${date}`,
    backToApp: "앱으로 돌아가기",
    sec1Title: "1. 약관 동의",
    sec1Body1Part1: "이 애플리케이션(",
    sec1Body1Part2:
      ")에 디지털 지갑을 연결함으로써 귀하는 본 이용 약관에 명시적으로 동의합니다. 동의하지 않는 경우 애플리케이션을 사용하지 마세요.",
    sec1EligibilityLabel: "자격 요건:",
    sec1EligibilityBody:
      "애플리케이션을 사용함으로써 귀하는 18세 이상(또는 거주 관할에서 더 높은 성년 연령)이며, 본 약관에 동의하고 애플리케이션을 합법적으로 사용할 수 있는 법적 권한을 보유함을 진술 및 보증합니다.",
    sec2Title: "2. 사용자 책임",
    sec2Bullet1:
      "사용자는 관련 스마트 컨트랙트 및 블록체인 트랜잭션을 포함하여 애플리케이션과의 상호작용에 대해 전적으로 책임을 집니다.",
    sec2Bullet2:
      "사용자는 재무적 손실, 스마트 컨트랙트 취약점, 네트워크 장애, 규제 리스크 등 블록체인 기술에 내재된 위험을 인식합니다.",
    sec2PrivacyLabel: "개인정보 고지:",
    sec2PrivacyBody:
      "애플리케이션은 의도적으로 개인 정보를 수집하지 않습니다. 다만 블록체인 트랜잭션은 본질적으로 블록체인 주소 및 관련 메타데이터 등 일부 거래 정보를 공개적으로 노출합니다. 애플리케이션을 사용함으로써 사용자는 이러한 블록체인의 투명성을 인지하고 이를 수용합니다.",
    sec2ProhibitedLabel: "금지 행위:",
    sec2ProhibitedBody:
      "사용자는 애플리케이션 사용 시 사기, 자금세탁, 시장 조작, 제재 회피 등 관련 법령·규정으로 금지된 불법 또는 금지 행위를 하지 않을 것을 명시적으로 동의합니다.",
    sec3Title: "3. 책임 제한 및 보증 부인",
    sec3Bullet1:
      "애플리케이션 및 관련 스마트 컨트랙트는 \"있는 그대로(as-is)\" 제공됩니다.",
    sec3Bullet2:
      "회사는 애플리케이션 사용과 관련하여 발생하는 직접, 간접, 부수적, 특별, 결과적 또는 징벌적 손해(재무적 손실 포함)에 대한 일체의 책임을 명시적으로 부인합니다.",
    sec3Bullet3:
      "회사는 애플리케이션 또는 관련 스마트 컨트랙트의 신뢰성, 정확성, 완전성, 기능성에 관하여 명시적이든 묵시적이든 어떠한 보증도 하지 않습니다.",
    sec4Title: "4. 규제 준수",
    sec4Bullet1:
      "사용자는 애플리케이션 사용이 금지 또는 제한된 관할에서 이를 사용하지 않음을 확인합니다.",
    sec4Bullet2:
      "사용자는 해당 지역의 관련 법령 및 규정을 준수할 책임이 있습니다.",
    sec5Title: "5. 면책",
    sec5Body:
      "사용자는 애플리케이션 사용으로 발생하는 모든 청구, 책임, 손해, 손실 또는 비용에 대해 회사 및 계열사, 임원, 직원, 대리인을 면책하고 이들에게 해를 끼치지 않을 것에 동의합니다.",
    sec6Title: "6. 블록체인 자산 비수탁",
    sec6Bullet1:
      "애플리케이션은 어떠한 때에도 사용자의 블록체인 자산을 수탁, 보유 또는 통제하지 않습니다.",
    sec6Bullet2:
      "사용자는 스마트 컨트랙트와 직접 상호작용하며 자신의 개인 키와 블록체인 자산에 대한 완전한 통제권을 유지합니다.",
    sec7Title: "7. 약관 수정",
    sec7BodyPart1:
      "회사는 본 약관을 언제든지 수정할 권리를 보유합니다. 업데이트는 ",
    sec7BodyPart2:
      "에 공개되며, 사용자는 본 약관을 주기적으로 검토할 책임이 있습니다. 변경 후 계속 사용하는 것은 동의로 간주됩니다.",
    sec8Title: "8. 지식재산",
    sec8Body1:
      "상표 및 저작권을 포함하여 애플리케이션과 관련된 모든 지식재산은 회사의 재산으로 유지됩니다.",
    sec8SubmissionsLabel: "사용자 제출물:",
    sec8SubmissionsBody:
      "애플리케이션과 관련하여 사용자가 제공한 피드백, 제안 또는 제출물은 비기밀로 간주됩니다. 사용자는 이에 따라 회사에 해당 제출물을 제한이나 보상 없이 사용, 통합 또는 기타 활용할 영구적이고 취소 불가능하며 전 세계적으로 로열티가 없는 무제한 권리를 부여합니다.",
    sec9Title: "9. 중재 및 분쟁 해결",
    sec9Body:
      "본 약관 또는 애플리케이션 사용과 관련하여 발생하는 분쟁은 중재 당시 시행 중인 CIAC 중재 규칙에 따라 케이맨 국제 중재 센터(CIAC)가 관리하는 중재에 회부되어 최종 해결됩니다. 중재지는 케이맨 제도 조지타운입니다. 중재 절차는 영어로 진행됩니다. 중재 재판부의 결정은 모든 당사자에 대해 최종적이며 구속력이 있습니다.",
    sec10Title: "10. 준거법 및 관할",
    sec10Body:
      "본 약관은 저촉법 원칙에 관계없이 케이맨 제도 법률에 따라 규율되고 해석됩니다. 사용자는 중재 결정의 집행 또는 중재 대상이 아닌 청구의 처리를 위해 케이맨 제도 조지타운 소재 법원의 전속 관할에 복종함에 동의합니다.",
    sec11Title: "11. 위험 고지",
    sec11Bullet1:
      "사용자는 블록체인 기술 및 관련 활동과 관련된 위험을 완전히 이해함을 인정하고 동의합니다.",
    sec11Bullet2:
      "사용자는 애플리케이션에서 거래에 참여하기 전에 독립적으로 조사할 것을 권장합니다.",
    closingAcknowledgment:
      "애플리케이션을 사용함으로써 사용자는 본 이용 약관을 읽고, 이해하고, 수락했음을 인정합니다.",
    closingContact:
      "본 약관에 대한 질문이나 우려 사항은 애플리케이션에 제공된 공식 채널을 통해 문의해주세요.",
  },
  depositDialog: {
    ctaPreparingWallet: "지갑 준비 중...",
    ctaCheckingEligibility: "자격 확인 중...",
    ctaStakedSgctlOnly: "스테이크된 SGCTL 전용",
    ctaMinimumToStart: (usd) => `최소 $${usd}부터 시작`,
    ctaConfirmDelegation: "위임 확정",
    ctaStakeAndDelegate: "스테이크 & 위임",
    ctaMintStakeDelegate: "민트, 스테이크 & 위임",
    ctaSwapAndDelegate: "스왑 & 위임",
    ctaConfirmPurchase: "구매 확정",
    shortfallNeed: (amount, symbol) => `+${amount} ${symbol} 필요`,
    shortfallNeedSwapBuffer: (amount, symbol) =>
      `+${amount} ${symbol} 필요 (스왑 버퍼)`,

    toastCheckingEligibility: "지갑 자격을 확인하고 있습니다...",
    toastPreparingSigner: "지갑 서명자를 준비하고 있습니다...",
    toastPreparingConnection: "지갑 연결을 준비하고 있습니다...",
    toastListingNoLongerAvailable: "이 매물은 더 이상 사용할 수 없습니다.",
    toastStepsRemaining: (n) => `이 매물에 ${n}개의 스텝만 남아 있습니다.`,
    toastDelegationSuccess: "위임이 완료되었습니다!",
    toastMinersPurchased: "마이너 구매 완료!",
    toastTransactionRejected: "트랜잭션이 거부되었습니다",
    toastUnableToShare: "지금은 공유할 수 없습니다",

    initialPositionMinimumFallback: (usd) =>
      `주간 리워드 청구가 가스비를 상회하도록 첫 마이너 또는 위임은 최소 $${usd} 이상이어야 합니다.`,

    sgctlFundingFromUsdc: (existing, shortfall) =>
      `사용 가능한 지역 스테이크 ${existing} SGCTL을 사용하고, USDC에서 추가로 ${shortfall}을 민트하여 스테이크합니다.`,
    sgctlFundingFromEth: (existing, shortfall) =>
      `사용 가능한 지역 스테이크 ${existing} SGCTL을 사용하고, ETH에서 추가로 ${shortfall}을 민트하여 스테이크합니다.`,
    sgctlFundingFromGctl: (existing, shortfall) =>
      `사용 가능한 지역 스테이크 ${existing} SGCTL을 사용하고, 지갑의 GCTL 잔액에서 추가로 ${shortfall}을 스테이크합니다.`,

    weeklyForWeeks: (n) => `${n}주 동안 매주.`,
    weeklyFor99Weeks: "99주 동안 매주.",
    weeklyFor100Weeks: "100주 동안 매주.",

    shareTitlePrefix: (farmLabel) => `Glow • ${farmLabel}`,
    shareTitleFallback: "Glow",
    shareTextMiners: (quantity, farmLabel, domain) =>
      `방금 ${farmLabel}에서 마이너 ${quantity}개를 @glowFND에서 구매했습니다\n\n${domain}`,
    shareTextDelegation: (farmLabel, asset, domain) =>
      `${asset} 토큰을 위임하여 ${farmLabel} 자금 조달을 도왔습니다.\n\n${domain}에서 같은 활동에 참여할 수 있습니다`,
    shareFarmFallback: "솔라 발전소",

    successDetailQuantity: "수량",
    successDetailTotalUsdc: "총 USDC",
    successDetailTotalSgctlDelegated: "총 위임 SGCTL",
    successDetailTotalGlwDelegated: "총 위임 GLW",

    successPurchaseComplete: "구매 완료!",
    successDelegationComplete: "위임 완료!",
    successPurchaseSubtitle: "실제 솔라 배치 가속화에 기여하셨습니다.",
    successDelegationSubtitle: "실제 솔라 리워드를 활성화하셨습니다.",
    successLeft: (n) => `${n}개 남음`,
    successAlreadyFilled: "이미 채워짐",
    successYourContribution: "내 기여",
    successProjectedWeeklyRewards: "예상 주간 리워드",
    successEstWeeklyImpactPoints: "예상 주간 임팩트 포인트",
    successPtsUnit: "pts",
    successEmissions: "발행분",
    successVaultBonus: "볼트 보너스",
    successMinerBonusPrefix: "3배 마이너 보너스",
    successMinerBonusSuffix: "주간 롤오버 시 적용",
    successShare: "공유",
    successClose: "닫기",

    processingTransactionFailed: "트랜잭션 실패",
    processingTransactionPending: "트랜잭션 대기 중",
    processingTransactionInFlight: "트랜잭션 처리 중",
    processingErrorBody: "트랜잭션 처리 중 오류가 발생했습니다.",
    processingPendingBody:
      "트랜잭션이 제출되었지만 Glow가 아직 인덱싱하지 않았습니다. 인덱싱이 따라잡힐 때까지 기다린 후 다시 시도해주세요.",
    processingActiveBody: "트랜잭션을 처리하는 동안 잠시만 기다려주세요.",
    processingPendingExplainer:
      "네트워크 트랜잭션이 이미 마이닝되었을 수 있습니다. Glow는 분할 인덱서가 따라잡힌 후 이를 반영합니다. 새로 고침하여 변동이 없음을 확인하지 않는 한 구매를 다시 제출하지 마세요.",
    processingClose: "닫기",
    processingTryAgain: "다시 시도",
    processingRefreshAndRetry: "새로 고침 후 재시도",
    processingTransactionFailedFallback: "트랜잭션이 실패했습니다",
    stakeSyncUnableToVerify:
      "지금은 최근 스테이크를 확인할 수 없습니다. 몇 초 후 다시 시도해주세요.",
    stakeSyncBalanceUpdating:
      "새 잔액이 아직 업데이트 중입니다. 잠시 후 다시 시도해주세요.",

    reviewTitleMiners: "마이너 구매",
    reviewTitleSgctl: "SGCTL 위임",
    reviewTitleGlw: "GLW 위임",
    reviewQuantityLabel: "수량",
    reviewQuantityAvailable: (n) => `${n}개 사용 가능`,
    reviewMaxButton: "최대",
    reviewEstWeeklyRewards: "예상 주간 리워드",
    reviewValueLabel: "가치",
    reviewSelectCurrency: "통화 선택",
    reviewDelegationSource: "위임 소스",
    reviewYouDelegate: "위임 수량",
    reviewDelegationAmount: "위임 금액",
    reviewSourceCost: "소스 비용",
    reviewSwapCost: "스왑 비용",
    reviewTotal: "합계",
    reviewStable: "스테이블",
    reviewApprox: (val) => `≈ $${val}`,

    paymentLabelGlw: "Glow (GLW)",
    paymentLabelSgctl: "스테이크 (SGCTL)",
    paymentLabelGctl: "컨트롤 (GCTL)",
    paymentLabelUsdc: "USD Coin (USDC)",
    paymentLabelEth: "Ethereum (ETH)",
    paymentBalancePrefix: (balance) => `잔액: ${balance}`,
    paymentSgctlInRegion: (amount) => `지역 내 ${amount} SGCTL`,
    paymentGctlWallet: (amount) => `지갑 ${amount}`,

    previewDelegationAmount: "위임 금액",
    previewSourceAmount: "소스 금액",
    previewSourceCost: "소스 비용",
    previewSwapCost: "스왑 비용",
  },
  sponsoredFarmsActivity: {
    timeNow: "방금",
    timeSecondsAgo: (n) => `${n}초 전`,
    timeMinutesAgo: (n) => `${n}분 전`,
    timeHoursAgo: (n) => `${n}시간 전`,
    timeDaysAgo: (n) => `${n}일 전`,
    timeWeeksAgo: (n) => `${n}주 전`,
    timeMonthsAgo: (n) => `${n}개월 전`,
    timeYearsAgo: (n) => `${n}년 전`,

    avgScore: "평균 점수",
    avgRewardScore: "평균 리워드 점수",
    rewardScoreSuffix: "리워드 점수",
    buyers: "구매자",
    delegators: "위임자",
    contributors: "기여자",
    usdcSpent: "USDC 지출",
    totalUsdcSpent: "총 USDC 지출",
    glwDelegated: "GLW 위임",
    totalGlwDelegated: "총 GLW 위임",
    totalVolumeSuffix: "총 거래량",
    miners: "마이너",
    purchasedSuffix: "구매됨",
    farms: "발전소",
    fundedSuffix: "자금 조달됨",
    minersUsdc: "마이너 USDC",
    usdcSpentByMiners: "마이너의 USDC 지출",
    minerVolumeSuffix: "마이너 거래량",

    errorLoading: (msg) => `구매 활동을 불러오는 중 오류: ${msg}`,
    pleaseTryAgain: "잠시 후 다시 시도해주세요",
    noPurchaseActivity: "구매 활동이 없습니다.",
    recentPurchasesAppear: "최근 지분 구매 내역이 여기에 표시됩니다",

    badgeMiner: "마이너",
    badgeDelegation: "위임",
    badgeDelegator: "위임자",

    headerTotal: "합계",
    headerAmount: "수량",
    headerDate: "날짜",
    headerRewardScore: "리워드 점수",
    headerFarm: "발전소",
    headerType: "유형",
    headerWallet: "지갑",

    seeAllActivity: "전체 활동 보기",
  },
  streak: {
    title: "주간 연속 기록",
    weeks: (n) => `${n}주`,
    joinGlow: "Glow 참여하기",
    trackOwnStreakAt: "내 마이닝 연속 기록 보기:",
  },
};

export const routesTranslations: Record<Lang, RoutesStrings> = {
  en,
  ko,
};
