import type { Lang } from "../config";

export interface BigDialogsStrings {
  impactBreakdown: {
    loadingTitle: string;
    errorTitle: string;
    errorBody: string;
    toastFailed: string;
    currentImpact: string;
    updatedWeekly: string;
    activeMultipliers: string;
    allTimeBonus: string;
    includedBelow: string;
    minerBonus: string;
    minerBonusDesc: string;
    streak: string;
    streakDesc: string;
    pointSources: string;
    steeringPower: string;
    steeringSubValue: string;
    stake: string;
    boost: string;
    emissions: string;
    emissionsSubValue: (glw: string) => string;
    emissionsFallback: string;
    earn: string;
    add: string;
    delegation: string;
    delegationSubValue: (glw: string) => string;
    delegationFallback: string;
    delegate: string;
    glowWorth: string;
    glowWorthSubValue: (glw: string) => string;
    glowWorthFallback: string;
    buy: string;
    referralNetwork: string;
    manage: string;
    share: string;
    noReferralsYet: string;
    privateReferralData: string;
    activeReferrals: (n: number) => string;
    activePendingReferrals: (active: number, pending: number) => string;
    referralBonuses: string;
    referralBonus10: string;
    weeksRemaining: (n: string) => string;
    change: string;
    totalEarned: string;
    projectedThisWeek: (pts: string) => string;
    activationBonus: string;
    activationAwardedDesc: string;
    activationPendingDesc: string;
    awarded: string;
    pending: string;
    regionalPointsDist: string;
    pointsUnit: string;
    howScoresUpdate: string;
    basePointCalc: string;
    basePointCalcBody1: string;
    basePointCalcBody2: string;
    weeklyRollover: string;
    weeklyRolloverBody1: string;
    totalMultiplier: string;
    weeklyRolloverBody2: string;
    allPointSources: string;
    weeklyRolloverBody3: string;
    passiveIncome: string;
    finalized: string;
    weeklyRate: (rate: string) => string;
    extraPoints: string;
    subRegionCleanGrid: string;
    subRegionUtah: string;
    subRegionMissouri: string;
    subRegionColorado: string;
  };

  referralNetwork: {
    title: string;
    subtitle: string;
    yourCode: string;
    share: string;
    copyLink: string;
    copyForDiscord: string;
    showQrCode: string;
    showReferralQrCode: string;
    shareOnX: string;
    shareOnXTwitter: string;
    joinMeOnGlow: string;
    helpBuildFuture: string;
    shareReferralCode: string;
    toastLinkCopied: string;
    toastDiscordCopied: string;
    discordMessage: string;
    tierSeed: string;
    tierGrow: string;
    tierScale: string;
    tierLegend: string;
    refereesLabel: string;
    activate100pts: string;
    sunday: string;
    eclipse: string;
    eclipsePrime: string;
    aurora: string;
    zenith: string;
    solaris: string;
    lifetimePointsEarned: string;
    failedToLoad: string;
    finalizesOn: (date: string) => string;
    youEarn: string;
    upTo20Pct: string;
    ofFriendsBasePoints: string;
    theyGet: string;
    bonus10Pct: string;
    forTwelveWeeks: string;
    yourReferrer: string;
    gracePeriod: string;
    linkedOn: (date: string) => string;
    weeksLeft: (n: number) => string;
    ptsProjected: (pts: string) => string;
    activationBonus: string;
    activationAwarded: (date: string) => string;
    activationLockHint: string;
    gracePeriodEnds: string;
    gracePeriodNote: string;
    referrerLinkPermanent: string;
    thisWeek: string;
    networkSize: string;
    activeCount: (n: number) => string;
    pendingCount: (n: number) => string;
    pendingActivation: (n: number) => string;
    totalReferrals: string;
    progressTiers: string;
    locked: string;
    levelN: (n: number) => string;
    tierName: (name: string) => string;
    rewardShare: string;
    earnBaseToUnlock: string;
    pendingParen: (n: number) => string;
    upNext: string;
    inviteMore: (n: number) => string;
    activeFriendsToLevelUp: string;
    activatingNotice: (n: number) => string;
    badgesEarned: string;
    sundayLabel: string;
    activeMilestone: (n: number) => string;
    yourNetwork: string;
    totalLabel: (n: number) => string;
    waitingForActivation: string;
    waitingActivationBody: string;
    pointsAfterLinkingBold: string;
    inviteFirstFriend: string;
    inviteFirstFriendBody: string;
    postOnX: string;
    discord: string;
    qrCode: string;
    noActiveYet: string;
    pendingNotShown: (n: number, plural: boolean) => string;
    referralCol: string;
    statusCol: string;
    yourEarningsCol: string;
    activating: string;
    active: string;
    pending: string;
    needs100pts: string;
    perWeekSuffix: string;
    faq: string;
    faqActivationQ: string;
    faqActivationABody1: string;
    faqActivationABold: string;
    faqActivationABody2: string;
    faqRewardsQ: string;
    faqRewardsBody: string;
    faqRewardsBold: string;
    faqTier1: string;
    faqTier2: string;
    faqTier3: string;
    faqTier4: string;
    faqRefereeQ: string;
    faqRefereeBody1: string;
    faqRefereeBoldA: string;
    faqRefereeBody2: string;
    faqRefereeBoldB: string;
    faqRefereeBody3: string;
    faqChangeQ: string;
    faqChangeBody1: string;
    faqChangeBold: string;
    faqChangeBody2: string;
    faqFinalizationQ: string;
    faqFinalizationBody1: string;
    faqFinalizationBold: string;
    faqFinalizationBody2: string;
  };

  mintStake: {
    title: string;
    stakePower: string;
    done: string;
    close: string;
    confirmMintAndStake: string;
    confirmStake: string;
    minting: string;
    approving: string;
    confirming: string;
    finalizing: string;
    approveToken: string;
    introduction: string;
    chooseTarget: string;
    howGctlRedirects: string;
    followSteps: string;
    impactActivated: string;
    convertingUniswap: string;
    convertingUniswapDesc: string;
    failedMintStake: string;
    failedStake: string;
    toastConnectWallet: string;
    toastSelectRegion: string;
    toastEnterAmount: string;
    toastAcknowledgeTerms: string;
    toastConnectWalletContinue: string;
    stepSignMessage: string;
    stepSignDesc: string;
    stepSubmit: string;
    stepSubmitDesc: string;
    stepRefreshBalances: string;
    stepRefreshDesc: string;
    stepCheckAllowance: string;
    stepCheckAllowanceDesc: string;
    stepApproveToken: string;
    stepApproveTokenDesc: string;
    stepSubmitTx: string;
    stepFinalize: string;
    stepFinalizeDesc: string;
    processing: string;
    transactionFailed: string;
    missingTxHash: string;
    pollingFailed: string;
    transactionFailedShort: string;
    toFarmsIn: (region: string) => string;
    regionFallback: string;
    offChainAsset: string;
    yourBenefits: string;
    boostImpactScore: string;
    directProtocolRewards: string;
    youDecideRegions: string;
    startStaking: string;
    whereToDirect: string;
    legacy: string;
    continueButton: string;
    tryAgain: string;
    mintEstimate: string;
    enterToPreview: string;
    estimatingEthQuote: string;
    estimatedOutputNote: string;
    unableToEstimate: string;
    impactPreview: string;
    gctlDoesNotCreateGlw: string;
    scoreBoost: string;
    regionShare: string;
    steeringScore: string;
    regionLabel: string;
    powerActivated: string;
    glwDirected: string;
    back: string;
    stepCount: (current: number, total: number) => string;
    gctlName: string;
    gctlTagline: string;
    gctlIntro: string;
    gctlNonTransferable: string;
    nonTransferable: string;
    boostImpactScoreDesc: string;
    selectRegion: string;
    currentShare: (share: string) => string;
    glwPerWeek: string;
    inputAmount: string;
    availableAmount: (amount: string, currency: string) => string;
    finalizingCountdown: (seconds: number) => string;
    transactionFailedDesc: string;
    rewardsRedirected: string;
    pointsUnit: string;
    understandTitle: string;
    understandRedirectPrefix: string;
    understandRedirectStrong: string;
    understandRedirectSuffix: string;
    understandUnstakingPrefix: string;
    understandUnstakingStrong: string;
    understandUnstakingSuffix: string;
    swappingEth: string;
    signing: string;
    successDesc: string;
    profileUpdateDelay: string;
    pointsGained: (amount: string) => string;
    perWeekShort: string;
  };

  contribute: {
    title: string;
    chooseRegion: string;
    pleaseSelectRegion: string;
    loadingRegions: string;
    stakeGctl: string;
    max: string;
    paymentMethod: string;
    connectWallet: string;
    enterValidAmount: string;
    processing: string;
    contributionSuccess: string;
    stakeFailed: string;
    missingInfo: string;
    failedToFetchBalance: string;
    failedToMintStake: string;
    failedToStakeGctl: string;
    failedToSignMessage: string;
    unknownError: string;
    usd: string;
    enterGctlAmount: string;
    loading: string;
    gctlBalance: string;
    alreadyStaked: (amount: string) => string;
    availableBalance: string;
    campaignNeeds: string;
    toReachThreshold: string;
    infrastructureProjectBalance: string;
    stakedAmountForRegion: string;
    enterAmountIn: (symbol: string) => string;
    yourImpact: string;
    ofGoal: (pct: string) => string;
    currentColon: (amount: string) => string;
    afterColon: (amount: string) => string;
    approxUsd: (amount: string) => string;
    stakeTo: (region: string) => string;
    successHeading: string;
    contributedBody: (amount: string, currency: string, suffix: string) => string;
    amountContributed: string;
    newTotalProgress: string;
    makeAnother: string;
    close: string;
    selectRegion: string;
    selectStakeAmount: string;
    availablePrefix: string;
    cancel: string;
    stakeAction: (amount: string) => string;
    loadingVerb: string;
  };

  farmsPerformance: {
    phaseWeekClosing: string;
    phaseAuditReview: string;
    phaseFinalizing: string;
    phaseClaimReady: string;
    phasePending: string;
    dateLocale: string;
    milestoneWeekCloses: string;
    milestoneAuditedPosted: string;
    milestoneFundsAvailable: string;
    milestoneFirstFundsAvailable: string;
    nowLabel: string;
    firstFundsTooltip: string;
    firstFundsAriaLabel: string;
    cost: string;
    delegated: string;
    rewards: string;
    estWeekly: string;
    estWeeklyLower: string;
    earned: string;
    shopMinerBadge: string;
    shopMinerSource: string;
    pointsSuffix: string;
    readyToClaim: string;
    rewardPipeline: string;
    breakdown: string;
    recovered: string;
    inProgress: string;
    rewardsStatus: string;
    funding: string;
    startsEarning: string;
    nextStep: string;
    pdRecovered: string;
    rewardsStart: string;
    emissions: string;
    total: string;
    weekCloses: string;
    auditedPosted: string;
    firstFundsAvailable: string;
    timeProgress: string;
    valueProgress: string;
    timeline: string;
    currentPhase: string;
    week: string;
    remaining: string;
    lastWeek: string;
    identity: string;
    lifecycle: string;
    keyMetrics: string;
    progress: string;
    farmPerformance: string;
    all: string;
    miners: string;
    delegations: string;
    other: string;
    connectWalletPrompt: string;
    retry: string;
    roiRequiresSpotPrice: string;
    glowMining: string;
    last10Weeks: string;
    viewDetails: string;
    chartViewComponent: string;
    weekAbbrev: string;
    filledLabel: (filled: number, total: number) => string;
    minersFilledLabel: (filled: number, total: number) => string;
    percentFilled: (percent: number) => string;
    weeksProgress: (active: number, total: number) => string;
    weeksProgressShort: (active: number, total: number) => string;
    weeksLeft: (weeks: number) => string;
    weekOf: (active: number, total: number) => string;
    remainingWeeks: (weeks: number) => string;
    startsEarningOn: (date: string | null) => string;
    firstFundsAvailableOn: (date: string | null) => string;
    regionFallback: (id: number | string) => string;
    farmFallback: (id: string) => string;
    launchpadLabel: string;
    minerLabel: string;
    pending: string;
    unableToLoadInProgress: string;
    unableToLoadFarms: string;
    noInProgressFound: string;
    noFarmsFound: string;
  };

  rewardsBreakdown: {
    title: string;
    delegationsAndMinersDesc: string;
    delegationsDesc: string;
    minersDesc: string;
    rewardsDesc: string;
    delegation: string;
    mining: string;
    lastWeek: string;
    weeklyFor: (type: string) => string;
    delegationNoun: string;
    minerNoun: string;
    farmNoun: string;
    week: string;
    emissions: string;
    protocolDeposit: string;
    total: string;
    delegations: string;
    otherRewards: string;
    pendingRewards: string;
    claimRewards: string;
    delegated: string;
    estWeeklyRewards: string;
    weeksRemaining: string;
    totalEarned: string;
    seeDetails: string;
    seeAudit: string;
    pdAsset: string;
    pending: string;
    type: string;
  };
}

const en: BigDialogsStrings = {
  impactBreakdown: {
    loadingTitle: "Loading Points",
    errorTitle: "Error",
    errorBody: "Unable to load score data.",
    toastFailed: "Failed to load Impact breakdown",
    currentImpact: "Current Impact",
    updatedWeekly: "Updated weekly",
    activeMultipliers: "Active Multipliers",
    allTimeBonus: "All Time Bonus from Multipliers",
    includedBelow: "Included in point sources below",
    minerBonus: "Miner Bonus",
    minerBonusDesc: "Buy a miner this week to activate.",
    streak: "Streak",
    streakDesc: "Grow delegation or buy a miner weekly.",
    pointSources: "Point Sources",
    steeringPower: "Steering Power",
    steeringSubValue: "sGCTL delegation",
    stake: "Stake",
    boost: "Boost",
    emissions: "GLW Delegation",
    emissionsSubValue: (glw) => `${glw} GLW delegated`,
    emissionsFallback: "Delegated GLW",
    earn: "Earn",
    add: "Add",
    delegation: "Delegation",
    delegationSubValue: (glw) => `${glw} from eligible activity`,
    delegationFallback: "Eligible activity",
    delegate: "Delegate",
    glowWorth: "Opening Balance",
    glowWorthSubValue: (glw) => `${glw} carried over`,
    glowWorthFallback: "V1 carryover",
    buy: "Buy",
    referralNetwork: "Referral Network",
    manage: "Manage",
    share: "Share",
    noReferralsYet: "No referrals yet",
    privateReferralData: "Private referral data",
    activeReferrals: (n) => `${n} active referrals`,
    activePendingReferrals: (active, pending) =>
      `${active} active · ${pending} pending`,
    referralBonuses: "Referral Bonuses",
    referralBonus10: "+10% Referral Bonus",
    weeksRemaining: (n) => `${n} weeks remaining`,
    change: "Change",
    totalEarned: "Total Earned",
    projectedThisWeek: (pts) => `+${pts} pts projected this week`,
    activationBonus: "Activation Bonus",
    activationAwardedDesc: "One-time award (≥100 pts)",
    activationPendingDesc: "Threshold met — activates at week end",
    awarded: "Awarded",
    pending: "Pending",
    regionalPointsDist: "Regional Points Distribution",
    pointsUnit: "Points",
    howScoresUpdate: "How Points Update",
    basePointCalc: "Point Sources",
    basePointCalcBody1: "All point sources (",
    basePointCalcBody2:
      ") are tracked from eligible activity.",
    weeklyRollover: "Weekly Updates (Sundays 00:00 UTC)",
    weeklyRolloverBody1: "On weekly rollover, your ",
    totalMultiplier: "Total Multiplier",
    weeklyRolloverBody2: " is applied to ",
    allPointSources: "eligible points",
    weeklyRolloverBody3:
      ". The points displayed above already include active bonuses.",
    passiveIncome: "Passive income",
    finalized: "Finalized",
    weeklyRate: (rate) => `+${rate}/wk`,
    extraPoints: "delegations, miner purchases, streaks, and referrals",
    subRegionCleanGrid: "Clean Grid Project (CGP)",
    subRegionUtah: "Utah (UT)",
    subRegionMissouri: "Missouri (MO)",
    subRegionColorado: "Colorado (CO)",
  },

  referralNetwork: {
    title: "Share Referral Code",
    subtitle: "Earn bonus points by inviting friends",
    yourCode: "Your Code",
    share: "Share",
    copyLink: "Copy Link",
    copyForDiscord: "Copy for Discord",
    showQrCode: "Show QR Code",
    showReferralQrCode: "Show referral QR code",
    shareOnX: "Share on X",
    shareOnXTwitter: "Share on X (Twitter)",
    joinMeOnGlow: "Join me on Glow",
    helpBuildFuture:
      "Help build the future of solar energy and earn points.",
    shareReferralCode: "Share Referral Code",
    toastLinkCopied: "Referral link copied!",
    toastDiscordCopied: "Discord message copied! Paste it in your server.",
    discordMessage: "Copy message for Discord",
    tierSeed: "Aurora",
    tierGrow: "Solaris",
    tierScale: "Zenith",
    tierLegend: "Eclipse Prime",
    refereesLabel: "Referees",
    activate100pts: "Earn 100 base points after linking to unlock",
    sunday: "SUNDAY",
    eclipse: "Eclipse",
    eclipsePrime: "Eclipse Prime",
    aurora: "Aurora",
    zenith: "Zenith",
    solaris: "Solaris",
    lifetimePointsEarned: "Lifetime Points Earned",
    failedToLoad: "Failed to load referral network.",
    finalizesOn: (date) => `Finalizes ${date}`,
    youEarn: "You Earn",
    upTo20Pct: "Up to 20%",
    ofFriendsBasePoints: "of friends' base points",
    theyGet: "They Get",
    bonus10Pct: "+10% Bonus",
    forTwelveWeeks: "for 12 weeks",
    yourReferrer: "Your Referrer",
    gracePeriod: "Grace Period",
    linkedOn: (date) => `Linked ${date}`,
    weeksLeft: (n) => `${n} weeks left`,
    ptsProjected: (pts) => `+${pts} pts projected`,
    activationBonus: "Activation Bonus",
    activationAwarded: (date) => `Claimed ${date}`,
    activationLockHint: "Earn 100 base points after linking to unlock",
    gracePeriodEnds: "Grace period ends",
    gracePeriodNote:
      "You can change your referrer while the referral is pending. After activation or grace end, the link is permanent.",
    referrerLinkPermanent: "Referrer link is now permanent",
    thisWeek: "This Week",
    networkSize: "Network Size",
    activeCount: (n) => `${n} active`,
    pendingCount: (n) => `${n} pending`,
    pendingActivation: (n) => `${n} pending activation`,
    totalReferrals: "Total referrals",
    progressTiers: "Progress & Tiers",
    locked: "LOCKED",
    levelN: (n) => `LEVEL ${n}`,
    tierName: (name) => `${name} Tier`,
    rewardShare: "REWARD SHARE",
    earnBaseToUnlock: "Earn base points to unlock",
    pendingParen: (n) => `(${n} pending)`,
    upNext: "Up Next",
    inviteMore: (n) => `${n} more`,
    activeFriendsToLevelUp: "active friends to level up",
    activatingNotice: (n) =>
      `${n} referral${n > 1 ? "s" : ""} activating Sunday`,
    badgesEarned: "Badges Earned",
    sundayLabel: "SUNDAY",
    activeMilestone: (n) => `${n} ACTIVE`,
    yourNetwork: "Your Network",
    totalLabel: (n) => `${n} Total`,
    waitingForActivation: "Waiting for Activation",
    waitingActivationBody:
      "Your referrals need to earn 100 points after linking to become active. Points they earned before joining through your link don't count toward this threshold.",
    pointsAfterLinkingBold: "100 points after linking",
    inviteFirstFriend: "Invite your first friend",
    inviteFirstFriendBody:
      "Share your link to unlock Aurora tier and start earning 5% of their points.",
    postOnX: "Post on X",
    discord: "Discord",
    qrCode: "QR Code",
    noActiveYet: "No active referrals yet",
    pendingNotShown: (n, plural) =>
      `${n} pending referral${plural ? "s are" : " is"} not shown.`,
    referralCol: "Referral",
    statusCol: "Status",
    yourEarningsCol: "Your Earnings",
    activating: "Activating",
    active: "Active",
    pending: "Pending",
    needs100pts: "Needs 100 pts",
    perWeekSuffix: "/wk",
    faq: "FAQ",
    faqActivationQ: "How do referrals become active?",
    faqActivationABody1: "Your referrals need to earn ",
    faqActivationABold: "100 points after linking",
    faqActivationABody2:
      " through your code. Points they earned before joining don't count toward this threshold. Once active, you'll start earning rewards from their activity.",
    faqRewardsQ: "How much do I earn from referrals?",
    faqRewardsBody:
      "You earn a percentage of your referrals' base points (before multipliers). The more referrals you have, the higher your rate:",
    faqRewardsBold: "base points",
    faqTier1: "1 referral",
    faqTier2: "2-3 referrals",
    faqTier3: "4-6 referrals",
    faqTier4: "7+ referrals",
    faqRefereeQ: "What do my referrals get?",
    faqRefereeBody1: "People who join through your link receive a ",
    faqRefereeBoldA: "+100 point bonus",
    faqRefereeBody2: " when they reach 100 total points (activation), plus a ",
    faqRefereeBoldB: "10% boost on their base points for 12 weeks",
    faqRefereeBody3:
      ". This helps them climb the leaderboard faster while getting started.",
    faqChangeQ: "Can referrals change their referrer?",
    faqChangeBody1: "Users have a ",
    faqChangeBold: "7-day grace period",
    faqChangeBody2:
      " after linking to change their referrer. After that, the link becomes permanent.",
    faqFinalizationQ: "When do rewards update?",
    faqFinalizationBody1: "Rewards are calculated weekly and finalize every ",
    faqFinalizationBold: "Sunday at 00:00 UTC",
    faqFinalizationBody2:
      ". You'll see your earnings update at the start of each new week.",
  },

  mintStake: {
    title: "Mint & Stake GCTL",
    stakePower: "Stake Power",
    done: "Done",
    close: "Close",
    confirmMintAndStake: "Confirm Mint & Stake",
    confirmStake: "Confirm Stake",
    minting: "Minting...",
    approving: "Approving...",
    confirming: "Confirming...",
    finalizing: "Finalizing...",
    approveToken: "Approve token",
    introduction: "Introduction",
    chooseTarget: "Choose Target",
    howGctlRedirects: "How GCTL redirects rewards",
    followSteps: "Follow the steps below in your wallet.",
    impactActivated: "Impact Activated",
    convertingUniswap: "Converting via Uniswap",
    convertingUniswapDesc: "Converting via Uniswap",
    failedMintStake: "Failed to mint & stake GCTL",
    failedStake: "Failed to stake GCTL",
    toastConnectWallet: "Please connect your wallet",
    toastSelectRegion: "Please select a region",
    toastEnterAmount: "Please enter a valid amount",
    toastAcknowledgeTerms: "Please acknowledge the terms",
    toastConnectWalletContinue: "Please connect your wallet to continue",
    stepSignMessage: "Sign stake message",
    stepSignDesc: "Wallet signature (no gas)",
    stepSubmit: "Submit stake",
    stepSubmitDesc: "Sending to Glow Control",
    stepRefreshBalances: "Refresh balances",
    stepRefreshDesc: "Updating your dashboard",
    stepCheckAllowance: "Check allowance",
    stepCheckAllowanceDesc: "Verifying token permissions",
    stepApproveToken: "Approve token",
    stepApproveTokenDesc: "One-time approval (if needed)",
    stepSubmitTx: "Submitting transaction",
    stepFinalize: "Finalize",
    stepFinalizeDesc: "Waiting for confirmation",
    processing: "Processing",
    transactionFailed: "Transaction Failed",
    missingTxHash: "Missing tx hash",
    pollingFailed: "Polling failed",
    transactionFailedShort: "Transaction failed",
    toFarmsIn: (region) => `to farms in ${region}`,
    regionFallback: "Region",
    offChainAsset: "Off-chain Asset",
    yourBenefits: "Your Benefits",
    boostImpactScore: "Direct Regional Rewards",
    directProtocolRewards: "Direct Protocol Rewards",
    youDecideRegions: "You decide which regions receive funding.",
    startStaking: "Start Staking",
    whereToDirect: "Where to direct GLW?",
    legacy: "Legacy",
    continueButton: "Continue",
    tryAgain: "Try Again",
    mintEstimate: "Mint Estimate",
    enterToPreview: "Enter an amount to preview minted GCTL.",
    estimatingEthQuote: "Estimating ETH quote...",
    estimatedOutputNote:
      "Estimated output based on current quote and token prices.",
    unableToEstimate: "Unable to estimate minted GCTL right now.",
    impactPreview: "Impact Preview",
    gctlDoesNotCreateGlw:
      "GCTL does not create new GLW for you. It redirects existing protocol emissions toward your chosen region.",
    scoreBoost: "Reward Routing",
    regionShare: "Region Share",
    steeringScore: "Steering Status",
    regionLabel: "Region",
    powerActivated: "Power Activated",
    glwDirected: "GLW Directed",
    back: "Back",
    stepCount: (current, total) => `Step ${current}/${total}`,
    gctlName: "Glow Control (GCTL)",
    gctlTagline: "Governance • Impact • Rewards",
    gctlIntro:
      "GCTL is the governance power that directs where solar infrastructure is built. By staking to a region, you direct GLW emissions to fund solar farms there.",
    gctlNonTransferable:
      "GCTL is currently managed off-chain. It is non-transferable and cannot be sold or traded at this time.",
    nonTransferable: "non-transferable",
    boostImpactScoreDesc:
      "Stake GCTL to route regional GLW emissions. Delegate sGCTL separately to earn points.",
    selectRegion: "Select Region",
    currentShare: (share) => `Current Share: ${share}`,
    glwPerWeek: "GLW/week",
    inputAmount: "Input Amount",
    availableAmount: (amount, currency) => `Available: ${amount} ${currency}`,
    finalizingCountdown: (seconds) => `Finalizing (≈ ${seconds}s)…`,
    transactionFailedDesc: "We couldn’t complete your transaction.",
    rewardsRedirected: "Rewards Redirected",
    pointsUnit: "status",
    understandTitle: "I understand that:",
    understandRedirectPrefix: "GCTL ",
    understandRedirectStrong: "redirects GLW emissions to farms",
    understandRedirectSuffix: " in the selected region — not to my wallet",
    understandUnstakingPrefix: "Unstaking takes ",
    understandUnstakingStrong: "~100 weeks",
    understandUnstakingSuffix: " (1% release per week)",
    swappingEth: "Swapping ETH...",
    signing: "Signing...",
    successDesc:
      "Your Governance Power is now live and directing rewards.",
    profileUpdateDelay:
      "It may take up to 36 seconds to appear on your profile.",
    pointsGained: () => "Rewards redirected",
    perWeekShort: "/wk",
  },

  contribute: {
    title: "Contribute",
    chooseRegion: "Choose a region",
    pleaseSelectRegion: "Please select a region",
    loadingRegions: "Loading regions...",
    stakeGctl: "Stake GCTL",
    max: "Max",
    paymentMethod: "Payment method",
    connectWallet: "Please connect your wallet",
    enterValidAmount: "Please enter a valid amount",
    processing: "Processing...",
    contributionSuccess: "Contribution successful!",
    stakeFailed: "Stake failed",
    missingInfo: "Missing required information",
    failedToFetchBalance: "Failed to fetch token balance",
    failedToMintStake: "Failed to mint & stake",
    failedToStakeGctl: "Failed to stake GCTL",
    failedToSignMessage: "Failed to sign message",
    unknownError: "Unknown error",
    usd: "USD",
    enterGctlAmount: "Enter amount of GCTL to stake",
    loading: "Loading...",
    gctlBalance: "GCTL Balance",
    alreadyStaked: (amount) => `Already staked: ${amount} GCTL`,
    availableBalance: "Available balance",
    campaignNeeds: "Campaign needs",
    toReachThreshold: "to reach activation threshold",
    infrastructureProjectBalance: "Infrastructure Project Balance",
    stakedAmountForRegion: "Staked amount for this region",
    enterAmountIn: (symbol) => `Enter amount in ${symbol} to spend`,
    yourImpact: "Your Impact",
    ofGoal: (pct) => `+${pct}% of goal`,
    currentColon: (amount) => `Current: ${amount} GCTL`,
    afterColon: (amount) => `After: ${amount} GCTL`,
    approxUsd: (amount) => `≈ $${amount} USD`,
    stakeTo: (region) => `Stake to ${region}`,
    successHeading: "Contribution Successful",
    contributedBody: (amount, currency, suffix) =>
      `You've successfully contributed ${amount} ${currency}${suffix}`,
    amountContributed: "Amount Contributed",
    newTotalProgress: "New Total Progress",
    makeAnother: "Make Another Contribution",
    close: "Close",
    selectRegion: "Select region",
    selectStakeAmount: "Select stake amount",
    availablePrefix: "Available:",
    cancel: "Cancel",
    stakeAction: (amount) => `Stake ${amount}`,
    loadingVerb: "Processing...",
  },

  farmsPerformance: {
    phaseWeekClosing: "Week Closing",
    phaseAuditReview: "Audit Review",
    phaseFinalizing: "Finalizing",
    phaseClaimReady: "Claim Ready",
    phasePending: "Pending",
    dateLocale: "en-US",
    milestoneWeekCloses: "Week closes",
    milestoneAuditedPosted: "Audited & posted",
    milestoneFundsAvailable: "Funds available",
    milestoneFirstFundsAvailable: "First funds available",
    nowLabel: "Now",
    firstFundsTooltip:
      "Rewards are posted after the protocol week closes on Sunday and auditors review the batch. Funds then stay locked for a 3-week on-chain finalization window before the first claim opens.",
    firstFundsAriaLabel: "Why first funds are delayed",
    cost: "Cost",
    delegated: "Delegated",
    rewards: "Rewards",
    estWeekly: "Est. Weekly",
    estWeeklyLower: "Est. weekly",
    earned: "Earned",
    shopMinerBadge: "Shop Miner",
    shopMinerSource: "Points Shop",
    pointsSuffix: "pts",
    readyToClaim: "Ready to claim",
    rewardPipeline: "Reward Pipeline",
    breakdown: "Breakdown",
    recovered: "Recovered",
    inProgress: "In progress",
    rewardsStatus: "Rewards",
    funding: "Funding",
    startsEarning: "Starts earning",
    nextStep: "Next step",
    pdRecovered: "PD Recovered",
    rewardsStart: "Rewards start",
    emissions: "Emissions",
    total: "Total",
    weekCloses: "Week closes",
    auditedPosted: "Audited & posted",
    firstFundsAvailable: "First funds available",
    timeProgress: "Time Progress",
    valueProgress: "Value Progress",
    timeline: "Timeline",
    currentPhase: "Current phase",
    week: "Week",
    remaining: "Remaining",
    lastWeek: "Last week",
    identity: "Identity",
    lifecycle: "Lifecycle",
    keyMetrics: "Key Metrics",
    progress: "Progress",
    farmPerformance: "Farm Performance",
    all: "All",
    miners: "Miners",
    delegations: "Delegations",
    other: "Other",
    connectWalletPrompt: "Connect your wallet to view farm performance",
    retry: "Retry",
    roiRequiresSpotPrice:
      "ROI requires GLW spot price; showing $0 until price is available.",
    glowMining: "Glow Mining",
    last10Weeks: "Last 10 Weeks",
    viewDetails: "View Details",
    chartViewComponent: "[ Chart View Component ]",
    weekAbbrev: "wk",
    filledLabel: (filled, total) => `${filled} / ${total} filled`,
    minersFilledLabel: (filled, total) => `${filled} / ${total} miners filled`,
    percentFilled: (percent) => `${percent}% filled`,
    weeksProgress: (active, total) => `${active} / ${total} weeks`,
    weeksProgressShort: (active, total) => `${active} / ${total} wks`,
    weeksLeft: (weeks) => `${weeks} left`,
    weekOf: (active, total) => `${active} of ${total}`,
    remainingWeeks: (weeks) => `${weeks} weeks`,
    startsEarningOn: (date) => `Starts earning ${date ?? "—"}`,
    firstFundsAvailableOn: (date) => `First funds available ${date ?? "—"}`,
    regionFallback: (id) => `Region ${id}`,
    farmFallback: (id) => `Farm ${id}`,
    launchpadLabel: "Launchpad",
    minerLabel: "Miner",
    pending: "Pending",
    unableToLoadInProgress: "Unable to load in-progress delegations",
    unableToLoadFarms: "Unable to load farm performance",
    noInProgressFound: "No in-progress delegations found for this wallet",
    noFarmsFound: "No farms found for this wallet",
  },

  rewardsBreakdown: {
    title: "Rewards Breakdown",
    delegationsAndMinersDesc: "Detailed breakdown of your delegations and miners",
    delegationsDesc: "Detailed breakdown of your delegations",
    minersDesc: "Detailed breakdown of your miners",
    rewardsDesc: "Detailed breakdown of your rewards",
    delegation: "Delegation",
    mining: "Mining",
    lastWeek: "Last Week",
    weeklyFor: (type) => `Weekly rewards breakdown for this ${type}`,
    delegationNoun: "delegation",
    minerNoun: "miner",
    farmNoun: "farm",
    week: "Week",
    emissions: "Emissions",
    protocolDeposit: "Protocol Deposit",
    total: "Total",
    delegations: "Delegations",
    otherRewards: "Other Rewards",
    pendingRewards: "Pending Rewards",
    claimRewards: "Claim Rewards",
    delegated: "Delegated",
    estWeeklyRewards: "Estimated Weekly Rewards",
    weeksRemaining: "Weeks Remaining",
    totalEarned: "Total Earned",
    seeDetails: "See Details",
    seeAudit: "See Audit",
    pdAsset: "PD Asset",
    pending: "Pending",
    type: "Type",
  },
};

const ko: BigDialogsStrings = {
  impactBreakdown: {
    loadingTitle: "포인트 로드 중",
    errorTitle: "오류",
    errorBody: "점수 데이터를 불러올 수 없습니다.",
    toastFailed: "임팩트 내역을 불러오지 못했습니다",
    currentImpact: "현재 임팩트",
    updatedWeekly: "매주 업데이트",
    activeMultipliers: "활성 배수",
    allTimeBonus: "배수로 얻은 누적 보너스",
    includedBelow: "아래 포인트 출처에 포함됨",
    minerBonus: "마이너 보너스",
    minerBonusDesc: "이번 주에 마이너를 구매하여 활성화하세요.",
    streak: "연속 기록",
    streakDesc: "매주 위임을 늘리거나 마이너를 구매하세요.",
    pointSources: "포인트 출처",
    steeringPower: "스티어링 파워",
    steeringSubValue: "sGCTL 위임",
    stake: "스테이킹",
    boost: "부스트",
    emissions: "GLW 위임",
    emissionsSubValue: (glw) => `${glw} GLW 위임`,
    emissionsFallback: "위임된 GLW",
    earn: "획득",
    add: "추가",
    delegation: "위임",
    delegationSubValue: (glw) => `${glw} 적격 활동`,
    delegationFallback: "적격 활동",
    delegate: "위임",
    glowWorth: "시작 잔액",
    glowWorthSubValue: (glw) => `${glw} 이월됨`,
    glowWorthFallback: "V1 이월",
    buy: "구매",
    referralNetwork: "추천 네트워크",
    manage: "관리",
    share: "공유",
    noReferralsYet: "아직 추천인이 없습니다",
    privateReferralData: "추천 데이터는 비공개입니다",
    activeReferrals: (n) => `활성 추천 ${n}명`,
    activePendingReferrals: (active, pending) =>
      `활성 ${active}명 · 대기 ${pending}명`,
    referralBonuses: "추천 보너스",
    referralBonus10: "+10% 추천 보너스",
    weeksRemaining: (n) => `${n}주 남음`,
    change: "변경",
    totalEarned: "누적 획득",
    projectedThisWeek: (pts) => `이번 주 +${pts} pts 예상`,
    activationBonus: "활성화 보너스",
    activationAwardedDesc: "일회성 보상 (100pt 이상)",
    activationPendingDesc: "기준 충족 — 주말에 활성화됩니다",
    awarded: "지급됨",
    pending: "대기 중",
    regionalPointsDist: "지역별 포인트 분포",
    pointsUnit: "포인트",
    howScoresUpdate: "점수 업데이트 방식",
    basePointCalc: "기본 포인트 계산",
    basePointCalcBody1: "모든 포인트 출처(",
    basePointCalcBody2: ")는 보유분과 활동을 바탕으로 계산됩니다.",
    weeklyRollover: "주간 롤오버 (일요일 00:00 UTC)",
    weeklyRolloverBody1: "주간 롤오버 시, ",
    totalMultiplier: "총 배수",
    weeklyRolloverBody2:
      "(마이너 3× + 연속 +1×까지)가 ",
    allPointSources: "모든 포인트 출처",
    weeklyRolloverBody3:
      "에 적용됩니다 (Glow 자산 포함). 위에 표시된 포인트에는 이미 배수가 반영되어 있습니다.",
    passiveIncome: "수동 수익",
    finalized: "확정됨",
    weeklyRate: (rate) => `+${rate}/주`,
    extraPoints: "위임, 마이너 구매, 스트릭, 추천",
    subRegionCleanGrid: "클린 그리드 프로젝트 (CGP)",
    subRegionUtah: "유타 (UT)",
    subRegionMissouri: "미주리 (MO)",
    subRegionColorado: "콜로라도 (CO)",
  },

  referralNetwork: {
    title: "추천 코드 공유",
    subtitle: "친구를 초대하고 보너스 포인트를 받으세요",
    yourCode: "내 코드",
    share: "공유",
    copyLink: "링크 복사",
    copyForDiscord: "Discord용 복사",
    showQrCode: "QR 코드 표시",
    showReferralQrCode: "추천 QR 코드 표시",
    shareOnX: "X에 공유",
    shareOnXTwitter: "X (Twitter)에 공유",
    joinMeOnGlow: "Glow에서 함께해요",
    helpBuildFuture:
      "태양광 에너지의 미래를 함께 만들고 임팩트 포인트를 받아보세요.",
    shareReferralCode: "추천 코드 공유",
    toastLinkCopied: "추천 링크가 복사되었습니다!",
    toastDiscordCopied:
      "Discord 메시지가 복사되었습니다! 서버에 붙여넣어 주세요.",
    discordMessage: "Discord용 메시지 복사",
    tierSeed: "Aurora",
    tierGrow: "Solaris",
    tierScale: "Zenith",
    tierLegend: "Eclipse Prime",
    refereesLabel: "추천인",
    activate100pts: "연결 후 100 기본 포인트를 획득하면 잠금 해제됩니다",
    sunday: "SUNDAY",
    eclipse: "Eclipse",
    eclipsePrime: "Eclipse Prime",
    aurora: "Aurora",
    zenith: "Zenith",
    solaris: "Solaris",
    lifetimePointsEarned: "누적 획득 포인트",
    failedToLoad: "추천 네트워크를 불러오지 못했습니다.",
    finalizesOn: (date) => `${date} 확정`,
    youEarn: "내 보상",
    upTo20Pct: "최대 20%",
    ofFriendsBasePoints: "친구의 기본 포인트 중",
    theyGet: "친구의 보상",
    bonus10Pct: "+10% 보너스",
    forTwelveWeeks: "12주 동안",
    yourReferrer: "내 추천인",
    gracePeriod: "유예 기간",
    linkedOn: (date) => `연결일 ${date}`,
    weeksLeft: (n) => `${n}주 남음`,
    ptsProjected: (pts) => `+${pts} pts 예상`,
    activationBonus: "활성화 보너스",
    activationAwarded: (date) => `${date} 클레임됨`,
    activationLockHint: "연결 후 100 기본 포인트를 획득하면 잠금 해제",
    gracePeriodEnds: "유예 기간 종료",
    gracePeriodNote:
      "추천이 대기 중일 때만 추천인을 변경할 수 있습니다. 활성화되거나 유예가 종료되면 연결이 영구적으로 유지됩니다.",
    referrerLinkPermanent: "추천인 연결이 영구화되었습니다",
    thisWeek: "이번 주",
    networkSize: "네트워크 규모",
    activeCount: (n) => `활성 ${n}명`,
    pendingCount: (n) => `대기 ${n}명`,
    pendingActivation: (n) => `활성화 대기 ${n}명`,
    totalReferrals: "총 추천",
    progressTiers: "진행률 & 등급",
    locked: "잠김",
    levelN: (n) => `레벨 ${n}`,
    tierName: (name) => `${name} 등급`,
    rewardShare: "보상 비율",
    earnBaseToUnlock: "기본 포인트를 획득하여 잠금 해제",
    pendingParen: (n) => `(대기 ${n}명)`,
    upNext: "다음 단계",
    inviteMore: (n) => `${n}명 더`,
    activeFriendsToLevelUp: "활성 친구를 초대하면 레벨업",
    activatingNotice: (n) => `추천 ${n}명 일요일 활성화 예정`,
    badgesEarned: "획득한 뱃지",
    sundayLabel: "일요일",
    activeMilestone: (n) => `활성 ${n}명`,
    yourNetwork: "내 네트워크",
    totalLabel: (n) => `총 ${n}명`,
    waitingForActivation: "활성화 대기 중",
    waitingActivationBody:
      "추천인이 활성화되려면 연결 후 100 포인트를 획득해야 합니다. 링크로 가입하기 전에 획득한 포인트는 이 기준에 포함되지 않습니다.",
    pointsAfterLinkingBold: "연결 후 100 포인트",
    inviteFirstFriend: "첫 친구를 초대하세요",
    inviteFirstFriendBody:
      "링크를 공유해 Aurora 등급을 잠금 해제하고 친구 포인트의 5%를 받기 시작하세요.",
    postOnX: "X에 게시",
    discord: "Discord",
    qrCode: "QR 코드",
    noActiveYet: "아직 활성 추천이 없습니다",
    pendingNotShown: (n, plural) => `대기 중 추천 ${n}건이 표시되지 않습니다.`,
    referralCol: "추천",
    statusCol: "상태",
    yourEarningsCol: "내 수익",
    activating: "활성화 중",
    active: "활성",
    pending: "대기",
    needs100pts: "100 pts 필요",
    perWeekSuffix: "/주",
    faq: "자주 묻는 질문",
    faqActivationQ: "추천이 어떻게 활성화되나요?",
    faqActivationABody1: "추천인이 ",
    faqActivationABold: "연결 후 임팩트 포인트 100점",
    faqActivationABody2:
      "을 획득해야 합니다. 가입 전 획득한 포인트는 이 기준에 포함되지 않습니다. 활성화되면 친구의 활동에서 보상을 받기 시작합니다.",
    faqRewardsQ: "추천으로 얼마를 벌 수 있나요?",
    faqRewardsBody:
      "추천인의 기본 포인트(배수 적용 전) 일부를 보상으로 받습니다. 추천이 많을수록 비율이 올라갑니다:",
    faqRewardsBold: "기본 포인트",
    faqTier1: "추천 1명",
    faqTier2: "추천 2-3명",
    faqTier3: "추천 4-6명",
    faqTier4: "추천 7명 이상",
    faqRefereeQ: "추천인은 무엇을 받나요?",
    faqRefereeBody1: "내 링크로 가입한 사람은 ",
    faqRefereeBoldA: "+100 포인트 보너스",
    faqRefereeBody2: "를 100 포인트 누적 시(활성화) 받고, 추가로 ",
    faqRefereeBoldB: "12주 동안 기본 포인트에 10% 부스트",
    faqRefereeBody3:
      "를 받습니다. 시작 단계에서 리더보드를 빠르게 오르는 데 도움이 됩니다.",
    faqChangeQ: "추천인을 변경할 수 있나요?",
    faqChangeBody1: "사용자는 연결 후 ",
    faqChangeBold: "7일 유예 기간",
    faqChangeBody2:
      " 동안 추천인을 변경할 수 있습니다. 이후에는 연결이 영구적으로 유지됩니다.",
    faqFinalizationQ: "보상은 언제 업데이트되나요?",
    faqFinalizationBody1: "보상은 매주 계산되며 매주 ",
    faqFinalizationBold: "일요일 00:00 UTC",
    faqFinalizationBody2:
      "에 확정됩니다. 새 주 시작 시 수익이 업데이트됩니다.",
  },

  mintStake: {
    title: "GCTL 민트 & 스테이크",
    stakePower: "스테이크 파워",
    done: "완료",
    close: "닫기",
    confirmMintAndStake: "민트 & 스테이크 확정",
    confirmStake: "스테이크 확정",
    minting: "민팅 중...",
    approving: "승인 중...",
    confirming: "확인 중...",
    finalizing: "마무리 중...",
    approveToken: "토큰 승인",
    introduction: "소개",
    chooseTarget: "대상 선택",
    howGctlRedirects: "GCTL이 리워드를 재분배하는 방식",
    followSteps: "지갑에서 아래 단계를 따라주세요.",
    impactActivated: "임팩트 활성화됨",
    convertingUniswap: "Uniswap을 통해 변환 중",
    convertingUniswapDesc: "Uniswap을 통해 변환 중",
    failedMintStake: "GCTL 민트 & 스테이크에 실패했습니다",
    failedStake: "GCTL 스테이크에 실패했습니다",
    toastConnectWallet: "지갑을 연결해주세요",
    toastSelectRegion: "지역을 선택해주세요",
    toastEnterAmount: "유효한 금액을 입력해주세요",
    toastAcknowledgeTerms: "약관에 동의해주세요",
    toastConnectWalletContinue: "계속하려면 지갑을 연결해주세요",
    stepSignMessage: "스테이크 메시지 서명",
    stepSignDesc: "지갑 서명 (가스 없음)",
    stepSubmit: "스테이크 제출",
    stepSubmitDesc: "Glow Control로 전송 중",
    stepRefreshBalances: "잔액 새로고침",
    stepRefreshDesc: "대시보드 업데이트 중",
    stepCheckAllowance: "허용량 확인",
    stepCheckAllowanceDesc: "토큰 권한 검증 중",
    stepApproveToken: "토큰 승인",
    stepApproveTokenDesc: "1회 승인 (필요한 경우)",
    stepSubmitTx: "트랜잭션 제출 중",
    stepFinalize: "마무리",
    stepFinalizeDesc: "확인 대기 중",
    processing: "처리 중",
    transactionFailed: "트랜잭션 실패",
    missingTxHash: "트랜잭션 해시가 없습니다",
    pollingFailed: "폴링에 실패했습니다",
    transactionFailedShort: "트랜잭션 실패",
    toFarmsIn: (region) => `${region}의 발전소에`,
    regionFallback: "지역",
    offChainAsset: "오프체인 자산",
    yourBenefits: "내 혜택",
    boostImpactScore: "지역 리워드 방향 지정",
    directProtocolRewards: "직접 프로토콜 리워드",
    youDecideRegions: "펀딩할 지역을 직접 결정합니다.",
    startStaking: "스테이크 시작",
    whereToDirect: "GLW를 어디로 보낼까요?",
    legacy: "레거시",
    continueButton: "계속",
    tryAgain: "다시 시도",
    mintEstimate: "민트 추정치",
    enterToPreview: "민팅될 GCTL을 미리 보려면 금액을 입력하세요.",
    estimatingEthQuote: "ETH 견적 계산 중...",
    estimatedOutputNote:
      "현재 견적과 토큰 가격에 기반한 추정 출력입니다.",
    unableToEstimate: "지금은 민팅될 GCTL을 추정할 수 없습니다.",
    impactPreview: "임팩트 미리보기",
    gctlDoesNotCreateGlw:
      "GCTL이 새로운 GLW를 만드는 것은 아닙니다. 기존 프로토콜 발행분을 선택한 지역으로 재분배합니다.",
    scoreBoost: "리워드 라우팅",
    regionShare: "지역 비중",
    steeringScore: "스티어링 상태",
    regionLabel: "지역",
    powerActivated: "파워 활성화됨",
    glwDirected: "GLW 할당됨",
    back: "뒤로",
    stepCount: (current, total) => `단계 ${current}/${total}`,
    gctlName: "Glow Control (GCTL)",
    gctlTagline: "거버넌스 • 임팩트 • 리워드",
    gctlIntro:
      "GCTL은 태양광 인프라가 어디에 구축될지 지시하는 거버넌스 파워입니다. 지역에 스테이크하면 GLW 발행분이 해당 지역의 태양광 발전소 자금으로 향합니다.",
    gctlNonTransferable:
      "GCTL은 현재 오프체인으로 관리됩니다. 양도할 수 없으며 지금은 판매하거나 거래할 수 없습니다.",
    nonTransferable: "양도 불가",
    boostImpactScoreDesc:
      "GCTL을 스테이킹해 지역 GLW 발행분의 방향을 정하세요. 포인트는 sGCTL을 별도로 위임할 때 적립됩니다.",
    selectRegion: "지역 선택",
    currentShare: (share) => `현재 비중: ${share}`,
    glwPerWeek: "GLW/주",
    inputAmount: "입력 금액",
    availableAmount: (amount, currency) => `사용 가능: ${amount} ${currency}`,
    finalizingCountdown: (seconds) => `마무리 중 (약 ${seconds}초)…`,
    transactionFailedDesc: "트랜잭션을 완료하지 못했습니다.",
    rewardsRedirected: "리워드 재분배",
    pointsUnit: "상태",
    understandTitle: "다음을 이해했습니다:",
    understandRedirectPrefix: "GCTL은 ",
    understandRedirectStrong: "GLW 발행분을 발전소로 재분배합니다",
    understandRedirectSuffix: " 선택한 지역 안에서만 적용되며 내 지갑으로 들어오지 않습니다",
    understandUnstakingPrefix: "언스테이킹에는 ",
    understandUnstakingStrong: "약 100주",
    understandUnstakingSuffix: "가 걸립니다 (주당 1% 해제)",
    swappingEth: "ETH 스왑 중...",
    signing: "서명 중...",
    successDesc:
      "거버넌스 파워가 활성화되어 리워드 방향을 지정하고 있습니다.",
    profileUpdateDelay:
      "프로필에 표시되기까지 최대 36초가 걸릴 수 있습니다.",
    pointsGained: () => "리워드 방향 지정됨",
    perWeekShort: "/주",
  },

  contribute: {
    title: "기여",
    chooseRegion: "지역 선택",
    pleaseSelectRegion: "지역을 선택해주세요",
    loadingRegions: "지역 불러오는 중...",
    stakeGctl: "GCTL 스테이크",
    max: "최대",
    paymentMethod: "결제 방식",
    connectWallet: "지갑을 연결해주세요",
    enterValidAmount: "유효한 금액을 입력해주세요",
    processing: "처리 중...",
    contributionSuccess: "기여가 완료되었습니다!",
    stakeFailed: "스테이크 실패",
    missingInfo: "필수 정보가 누락되었습니다",
    failedToFetchBalance: "토큰 잔액 조회에 실패했습니다",
    failedToMintStake: "민트 & 스테이크에 실패했습니다",
    failedToStakeGctl: "GCTL 스테이크에 실패했습니다",
    failedToSignMessage: "서명에 실패했습니다",
    unknownError: "알 수 없는 오류",
    usd: "USD",
    enterGctlAmount: "스테이크할 GCTL 금액을 입력하세요",
    loading: "불러오는 중...",
    gctlBalance: "GCTL 잔액",
    alreadyStaked: (amount) => `이미 스테이킹됨: ${amount} GCTL`,
    availableBalance: "사용 가능 잔액",
    campaignNeeds: "캠페인 필요량",
    toReachThreshold: "활성화 기준에 도달하려면",
    infrastructureProjectBalance: "인프라 프로젝트 잔액",
    stakedAmountForRegion: "이 지역의 스테이킹 금액",
    enterAmountIn: (symbol) => `사용할 ${symbol} 금액을 입력하세요`,
    yourImpact: "내 임팩트",
    ofGoal: (pct) => `목표의 +${pct}%`,
    currentColon: (amount) => `현재: ${amount} GCTL`,
    afterColon: (amount) => `이후: ${amount} GCTL`,
    approxUsd: (amount) => `≈ $${amount} USD`,
    stakeTo: (region) => `${region}에 스테이크`,
    successHeading: "기여 완료",
    contributedBody: (amount, currency, suffix) =>
      `${amount} ${currency}을(를) 성공적으로 기여했습니다${suffix}`,
    amountContributed: "기여 금액",
    newTotalProgress: "새 총 진행률",
    makeAnother: "추가 기여하기",
    close: "닫기",
    selectRegion: "지역 선택",
    selectStakeAmount: "스테이크 금액 선택",
    availablePrefix: "사용 가능:",
    cancel: "취소",
    stakeAction: (amount) => `${amount} 스테이크`,
    loadingVerb: "처리 중...",
  },

  farmsPerformance: {
    phaseWeekClosing: "주간 마감",
    phaseAuditReview: "감사 검토",
    phaseFinalizing: "확정 중",
    phaseClaimReady: "클레임 준비",
    phasePending: "대기 중",
    dateLocale: "ko-KR",
    milestoneWeekCloses: "주간 마감",
    milestoneAuditedPosted: "감사 및 게시 완료",
    milestoneFundsAvailable: "자금 사용 가능",
    milestoneFirstFundsAvailable: "첫 자금 사용 가능",
    nowLabel: "지금",
    firstFundsTooltip:
      "일요일에 프로토콜 주차가 마감된 후 감사팀이 배치를 검토합니다. 이후 3주간의 온체인 확정 기간 동안 자금이 잠긴 뒤 첫 클레임이 열립니다.",
    firstFundsAriaLabel: "첫 자금이 지연되는 이유",
    cost: "비용",
    delegated: "위임됨",
    rewards: "리워드",
    estWeekly: "예상 주간",
    estWeeklyLower: "예상 주간",
    earned: "획득",
    shopMinerBadge: "샵 마이너",
    shopMinerSource: "포인트 샵",
    pointsSuffix: "pts",
    readyToClaim: "클레임 가능",
    rewardPipeline: "리워드 파이프라인",
    breakdown: "내역",
    recovered: "회수됨",
    inProgress: "진행 중",
    rewardsStatus: "리워드",
    funding: "모금",
    startsEarning: "수익 시작",
    nextStep: "다음 단계",
    pdRecovered: "PD 회수",
    rewardsStart: "리워드 시작",
    emissions: "발행분",
    total: "총합",
    weekCloses: "주간 마감",
    auditedPosted: "감사 및 게시 완료",
    firstFundsAvailable: "첫 자금 사용 가능",
    timeProgress: "시간 진행률",
    valueProgress: "가치 진행률",
    timeline: "타임라인",
    currentPhase: "현재 단계",
    week: "주차",
    remaining: "남음",
    lastWeek: "지난주",
    identity: "식별 정보",
    lifecycle: "수명 주기",
    keyMetrics: "핵심 지표",
    progress: "진행률",
    farmPerformance: "발전소 성과",
    all: "전체",
    miners: "마이너",
    delegations: "위임",
    other: "기타",
    connectWalletPrompt: "발전소 성과를 보려면 지갑을 연결하세요",
    retry: "다시 시도",
    roiRequiresSpotPrice:
      "ROI 계산에는 GLW 현물 가격이 필요합니다. 가격을 사용할 수 있을 때까지 $0으로 표시합니다.",
    glowMining: "Glow 마이닝",
    last10Weeks: "최근 10주",
    viewDetails: "상세 보기",
    chartViewComponent: "[ 차트 보기 컴포넌트 ]",
    weekAbbrev: "주",
    filledLabel: (filled, total) => `${filled} / ${total} 충족`,
    minersFilledLabel: (filled, total) => `${filled} / ${total} 마이너 충족`,
    percentFilled: (percent) => `${percent}% 충족`,
    weeksProgress: (active, total) => `${active} / ${total}주`,
    weeksProgressShort: (active, total) => `${active} / ${total}주`,
    weeksLeft: (weeks) => `${weeks}주 남음`,
    weekOf: (active, total) => `${active} / ${total}`,
    remainingWeeks: (weeks) => `${weeks}주`,
    startsEarningOn: (date) => `수익 시작 ${date ?? "—"}`,
    firstFundsAvailableOn: (date) => `첫 자금 사용 가능 ${date ?? "—"}`,
    regionFallback: (id) => `지역 ${id}`,
    farmFallback: (id) => `발전소 ${id}`,
    launchpadLabel: "런치패드",
    minerLabel: "마이너",
    pending: "대기 중",
    unableToLoadInProgress: "진행 중 위임을 불러올 수 없습니다",
    unableToLoadFarms: "발전소 성과를 불러올 수 없습니다",
    noInProgressFound: "이 지갑의 진행 중 위임이 없습니다",
    noFarmsFound: "이 지갑의 발전소가 없습니다",
  },

  rewardsBreakdown: {
    title: "리워드 내역",
    delegationsAndMinersDesc: "위임과 마이너의 상세 내역",
    delegationsDesc: "위임의 상세 내역",
    minersDesc: "마이너의 상세 내역",
    rewardsDesc: "리워드의 상세 내역",
    delegation: "위임",
    mining: "마이닝",
    lastWeek: "지난주",
    weeklyFor: (type) => `이 ${type}의 주간 리워드 내역`,
    delegationNoun: "위임",
    minerNoun: "마이너",
    farmNoun: "발전소",
    week: "주차",
    emissions: "발행분",
    protocolDeposit: "프로토콜 디포짓",
    total: "총합",
    delegations: "위임",
    otherRewards: "기타 리워드",
    pendingRewards: "대기 중 리워드",
    claimRewards: "리워드 클레임",
    delegated: "위임됨",
    estWeeklyRewards: "예상 주간 리워드",
    weeksRemaining: "남은 주차",
    totalEarned: "누적 획득",
    seeDetails: "상세 보기",
    seeAudit: "감사 보기",
    pdAsset: "PD 자산",
    pending: "대기 중",
    type: "종류",
  },
};

const zh: BigDialogsStrings = {
  impactBreakdown: {
    loadingTitle: "正在加载积分",
    errorTitle: "错误",
    errorBody: "无法加载分数数据。",
    toastFailed: "加载影响力明细失败",
    currentImpact: "当前影响力",
    updatedWeekly: "每周更新",
    activeMultipliers: "活跃倍率",
    allTimeBonus: "倍率累计奖励",
    includedBelow: "已包含在下方点数来源中",
    minerBonus: "矿工奖励",
    minerBonusDesc: "本周购买矿工以激活。",
    streak: "连续记录",
    streakDesc: "每周增加委托或购买矿工。",
    pointSources: "点数来源",
    steeringPower: "引导力",
    steeringSubValue: "sGCTL 委托",
    stake: "质押",
    boost: "加成",
    emissions: "GLW 委托",
    emissionsSubValue: (glw) => `${glw} GLW 已委托`,
    emissionsFallback: "已委托 GLW",
    earn: "赚取",
    add: "添加",
    delegation: "委托",
    delegationSubValue: (glw) => `${glw} 合格活动`,
    delegationFallback: "合格活动",
    delegate: "委托",
    glowWorth: "初始余额",
    glowWorthSubValue: (glw) => `${glw} 已结转`,
    glowWorthFallback: "V1 结转",
    buy: "购买",
    referralNetwork: "推荐网络",
    manage: "管理",
    share: "分享",
    noReferralsYet: "暂无推荐",
    privateReferralData: "推荐数据私密",
    activeReferrals: (n) => `${n} 个活跃推荐`,
    activePendingReferrals: (active, pending) =>
      `${active} 个活跃 · ${pending} 个待激活`,
    referralBonuses: "推荐奖励",
    referralBonus10: "+10% 推荐奖励",
    weeksRemaining: (n) => `剩余 ${n} 周`,
    change: "更改",
    totalEarned: "累计获得",
    projectedThisWeek: (pts) => `本周预计 +${pts} 点`,
    activationBonus: "激活奖励",
    activationAwardedDesc: "一次性奖励（≥100 点）",
    activationPendingDesc: "已达标 — 周末激活",
    awarded: "已发放",
    pending: "待处理",
    regionalPointsDist: "地区点数分布",
    pointsUnit: "点数",
    howScoresUpdate: "分数如何更新",
    basePointCalc: "基础点数计算",
    basePointCalcBody1: "所有点数来源（",
    basePointCalcBody2: "）均根据您的持有量与活动情况计算。",
    weeklyRollover: "周度结算（周日 00:00 UTC）",
    weeklyRolloverBody1: "每周结算时，您的 ",
    totalMultiplier: "总倍率",
    weeklyRolloverBody2: "（矿工 3× + 连续最多 +1×）将应用于 ",
    allPointSources: "所有点数来源",
    weeklyRolloverBody3:
      "，包括 Glow 资产。上方显示的点数已包含这些倍率。",
    passiveIncome: "被动收益",
    finalized: "已确认",
    weeklyRate: (rate) => `+${rate}/周`,
    extraPoints: "委托、矿工购买、连续活跃和推荐",
    subRegionCleanGrid: "清洁电网项目（CGP）",
    subRegionUtah: "犹他州（UT）",
    subRegionMissouri: "密苏里州（MO）",
    subRegionColorado: "科罗拉多州（CO）",
  },

  referralNetwork: {
    title: "分享推荐码",
    subtitle: "邀请好友赚取奖励点数",
    yourCode: "您的推荐码",
    share: "分享",
    copyLink: "复制链接",
    copyForDiscord: "复制到 Discord",
    showQrCode: "显示二维码",
    showReferralQrCode: "显示推荐二维码",
    shareOnX: "分享到 X",
    shareOnXTwitter: "分享到 X (Twitter)",
    joinMeOnGlow: "加入我在 Glow 的旅程",
    helpBuildFuture: "携手共建太阳能源未来,赚取积分。",
    shareReferralCode: "分享推荐码",
    toastLinkCopied: "推荐链接已复制!",
    toastDiscordCopied: "Discord 消息已复制!粘贴到您的服务器即可。",
    discordMessage: "复制 Discord 消息",
    tierSeed: "Aurora",
    tierGrow: "Solaris",
    tierScale: "Zenith",
    tierLegend: "Eclipse Prime",
    refereesLabel: "被推荐人",
    activate100pts: "关联后获得 100 基础点数即可解锁",
    sunday: "SUNDAY",
    eclipse: "Eclipse",
    eclipsePrime: "Eclipse Prime",
    aurora: "Aurora",
    zenith: "Zenith",
    solaris: "Solaris",
    lifetimePointsEarned: "累计获得点数",
    failedToLoad: "推荐网络加载失败。",
    finalizesOn: (date) => `${date} 确认`,
    youEarn: "您的收益",
    upTo20Pct: "最高 20%",
    ofFriendsBasePoints: "好友的基础点数",
    theyGet: "好友的奖励",
    bonus10Pct: "+10% 奖励",
    forTwelveWeeks: "持续 12 周",
    yourReferrer: "您的推荐人",
    gracePeriod: "宽限期",
    linkedOn: (date) => `关联于 ${date}`,
    weeksLeft: (n) => `剩余 ${n} 周`,
    ptsProjected: (pts) => `预计 +${pts} 点`,
    activationBonus: "激活奖励",
    activationAwarded: (date) => `${date} 已领取`,
    activationLockHint: "关联后获得 100 基础点数即可解锁",
    gracePeriodEnds: "宽限期结束",
    gracePeriodNote:
      "在推荐处于待激活状态期间,您可以更换推荐人。激活或宽限期结束后,关联将永久生效。",
    referrerLinkPermanent: "推荐人关联现已永久生效",
    thisWeek: "本周",
    networkSize: "网络规模",
    activeCount: (n) => `${n} 个活跃`,
    pendingCount: (n) => `${n} 个待激活`,
    pendingActivation: (n) => `${n} 个待激活`,
    totalReferrals: "推荐总数",
    progressTiers: "进度与等级",
    locked: "已锁定",
    levelN: (n) => `等级 ${n}`,
    tierName: (name) => `${name} 等级`,
    rewardShare: "奖励分成",
    earnBaseToUnlock: "获得基础点数以解锁",
    pendingParen: (n) => `(${n} 个待激活)`,
    upNext: "下一目标",
    inviteMore: (n) => `再邀请 ${n} 位`,
    activeFriendsToLevelUp: "活跃好友即可升级",
    activatingNotice: (n) => `${n} 个推荐将于周日激活`,
    badgesEarned: "已获得徽章",
    sundayLabel: "周日",
    activeMilestone: (n) => `活跃 ${n} 位`,
    yourNetwork: "您的网络",
    totalLabel: (n) => `共 ${n} 位`,
    waitingForActivation: "等待激活",
    waitingActivationBody:
      "您的推荐人需要在关联后获得 100 点数才能成为活跃。在通过您的链接加入之前所获得的点数不计入此门槛。",
    pointsAfterLinkingBold: "关联后 100 点数",
    inviteFirstFriend: "邀请您的第一位好友",
    inviteFirstFriendBody:
      "分享您的链接以解锁 Aurora 等级,并开始赚取他们点数的 5%。",
    postOnX: "发布到 X",
    discord: "Discord",
    qrCode: "二维码",
    noActiveYet: "暂无活跃推荐",
    pendingNotShown: (n, plural) =>
      `${n} 个待激活推荐${plural ? "" : ""}未显示。`,
    referralCol: "推荐",
    statusCol: "状态",
    yourEarningsCol: "您的收益",
    activating: "激活中",
    active: "活跃",
    pending: "待激活",
    needs100pts: "需要 100 点",
    perWeekSuffix: "/周",
    faq: "常见问题",
    faqActivationQ: "推荐如何变为活跃?",
    faqActivationABody1: "您的推荐人需要通过您的推荐码获得 ",
    faqActivationABold: "关联后 100 点数",
    faqActivationABody2:
      "。加入前获得的点数不计入此门槛。一旦激活,您将开始从他们的活动中赚取奖励。",
    faqRewardsQ: "通过推荐我能赚取多少?",
    faqRewardsBody:
      "您可以获得推荐人基础点数(倍率前)的一定比例。推荐越多,比例越高:",
    faqRewardsBold: "基础点数",
    faqTier1: "1 个推荐",
    faqTier2: "2-3 个推荐",
    faqTier3: "4-6 个推荐",
    faqTier4: "7+ 个推荐",
    faqRefereeQ: "我的推荐人能获得什么?",
    faqRefereeBody1: "通过您的链接加入的人将获得 ",
    faqRefereeBoldA: "+100 点奖励",
    faqRefereeBody2: ",当他们累计达到 100 点时(激活),并额外获得 ",
    faqRefereeBoldB: "12 周内基础点数 10% 加成",
    faqRefereeBody3: "。这有助于他们在起步阶段更快攀升排行榜。",
    faqChangeQ: "推荐人能更换其推荐人吗?",
    faqChangeBody1: "用户在关联后有 ",
    faqChangeBold: "7 天宽限期",
    faqChangeBody2: " 可以更换推荐人。之后,关联将永久生效。",
    faqFinalizationQ: "奖励何时更新?",
    faqFinalizationBody1: "奖励按周计算,并在每个 ",
    faqFinalizationBold: "周日 00:00 UTC",
    faqFinalizationBody2: " 确认。您将在每个新周开始时看到收益更新。",
  },

  mintStake: {
    title: "铸造并质押 GCTL",
    stakePower: "质押力",
    done: "完成",
    close: "关闭",
    confirmMintAndStake: "确认铸造与质押",
    confirmStake: "确认质押",
    minting: "铸造中...",
    approving: "授权中...",
    confirming: "确认中...",
    finalizing: "完成中...",
    approveToken: "授权代币",
    introduction: "介绍",
    chooseTarget: "选择目标",
    howGctlRedirects: "GCTL 如何重新分配奖励",
    followSteps: "请在您的钱包中按以下步骤操作。",
    impactActivated: "影响力已激活",
    convertingUniswap: "通过 Uniswap 转换中",
    convertingUniswapDesc: "通过 Uniswap 转换中",
    failedMintStake: "铸造与质押 GCTL 失败",
    failedStake: "质押 GCTL 失败",
    toastConnectWallet: "请连接您的钱包",
    toastSelectRegion: "请选择一个地区",
    toastEnterAmount: "请输入有效金额",
    toastAcknowledgeTerms: "请确认条款",
    toastConnectWalletContinue: "请连接您的钱包以继续",
    stepSignMessage: "签署质押消息",
    stepSignDesc: "钱包签名(无需 gas)",
    stepSubmit: "提交质押",
    stepSubmitDesc: "发送至 Glow Control",
    stepRefreshBalances: "刷新余额",
    stepRefreshDesc: "正在更新您的仪表板",
    stepCheckAllowance: "检查授权额度",
    stepCheckAllowanceDesc: "正在验证代币权限",
    stepApproveToken: "授权代币",
    stepApproveTokenDesc: "一次性授权(如有需要)",
    stepSubmitTx: "正在提交交易",
    stepFinalize: "完成",
    stepFinalizeDesc: "等待确认",
    processing: "处理中",
    transactionFailed: "交易失败",
    missingTxHash: "缺少交易哈希",
    pollingFailed: "轮询失败",
    transactionFailedShort: "交易失败",
    toFarmsIn: (region) => `至 ${region} 的太阳能场`,
    regionFallback: "地区",
    offChainAsset: "链下资产",
    yourBenefits: "您的权益",
    boostImpactScore: "引导地区奖励",
    directProtocolRewards: "直接协议奖励",
    youDecideRegions: "由您决定哪些地区获得资金。",
    startStaking: "开始质押",
    whereToDirect: "GLW 应导向何处?",
    legacy: "传统",
    continueButton: "继续",
    tryAgain: "重试",
    mintEstimate: "铸造估算",
    enterToPreview: "输入金额以预览铸造的 GCTL。",
    estimatingEthQuote: "正在估算 ETH 报价...",
    estimatedOutputNote: "基于当前报价和代币价格的估算输出。",
    unableToEstimate: "暂时无法估算铸造的 GCTL。",
    impactPreview: "影响力预览",
    gctlDoesNotCreateGlw:
      "GCTL 不会为您创造新的 GLW。它会将现有的协议释放量重新分配至您选择的地区。",
    scoreBoost: "奖励路由",
    regionShare: "地区份额",
    steeringScore: "引导状态",
    regionLabel: "地区",
    powerActivated: "力量已激活",
    glwDirected: "GLW 已导向",
    back: "返回",
    stepCount: (current, total) => `步骤 ${current}/${total}`,
    gctlName: "Glow Control (GCTL)",
    gctlTagline: "治理 • 影响力 • 奖励",
    gctlIntro:
      "GCTL 是决定太阳能基础设施建设地点的治理力量。通过质押到某个地区,您可以将 GLW 释放量导向资助该地区的太阳能场。",
    gctlNonTransferable:
      "GCTL 目前由链下管理。它不可转让,目前无法出售或交易。",
    nonTransferable: "不可转让",
    boostImpactScoreDesc: "质押 GCTL 来引导地区 GLW 增发。需要单独委托 sGCTL 才会获得积分。",
    selectRegion: "选择地区",
    currentShare: (share) => `当前份额: ${share}`,
    glwPerWeek: "GLW/周",
    inputAmount: "输入金额",
    availableAmount: (amount, currency) => `可用: ${amount} ${currency}`,
    finalizingCountdown: (seconds) => `完成中(约 ${seconds} 秒)…`,
    transactionFailedDesc: "我们无法完成您的交易。",
    rewardsRedirected: "奖励已重定向",
    pointsUnit: "状态",
    understandTitle: "我理解:",
    understandRedirectPrefix: "GCTL ",
    understandRedirectStrong: "将 GLW 释放量重新分配至太阳能场",
    understandRedirectSuffix: " 在所选地区 — 不会进入我的钱包",
    understandUnstakingPrefix: "解除质押需要 ",
    understandUnstakingStrong: "约 100 周",
    understandUnstakingSuffix: "(每周释放 1%)",
    swappingEth: "正在兑换 ETH...",
    signing: "签名中...",
    successDesc: "您的治理力量已上线并正在引导奖励。",
    profileUpdateDelay: "可能需要最多 36 秒才会显示在您的个人主页。",
    pointsGained: () => "奖励已重定向",
    perWeekShort: "/周",
  },

  contribute: {
    title: "贡献",
    chooseRegion: "选择地区",
    pleaseSelectRegion: "请选择一个地区",
    loadingRegions: "正在加载地区...",
    stakeGctl: "质押 GCTL",
    max: "最大",
    paymentMethod: "支付方式",
    connectWallet: "请连接您的钱包",
    enterValidAmount: "请输入有效金额",
    processing: "处理中...",
    contributionSuccess: "贡献成功!",
    stakeFailed: "质押失败",
    missingInfo: "缺少必要信息",
    failedToFetchBalance: "获取代币余额失败",
    failedToMintStake: "铸造与质押失败",
    failedToStakeGctl: "质押 GCTL 失败",
    failedToSignMessage: "签署消息失败",
    unknownError: "未知错误",
    usd: "USD",
    enterGctlAmount: "输入要质押的 GCTL 数量",
    loading: "加载中...",
    gctlBalance: "GCTL 余额",
    alreadyStaked: (amount) => `已质押: ${amount} GCTL`,
    availableBalance: "可用余额",
    campaignNeeds: "活动所需",
    toReachThreshold: "以达到激活门槛",
    infrastructureProjectBalance: "基础设施项目余额",
    stakedAmountForRegion: "此地区的质押金额",
    enterAmountIn: (symbol) => `输入要使用的 ${symbol} 金额`,
    yourImpact: "您的影响力",
    ofGoal: (pct) => `目标的 +${pct}%`,
    currentColon: (amount) => `当前: ${amount} GCTL`,
    afterColon: (amount) => `之后: ${amount} GCTL`,
    approxUsd: (amount) => `≈ $${amount} USD`,
    stakeTo: (region) => `质押至 ${region}`,
    successHeading: "贡献成功",
    contributedBody: (amount, currency, suffix) =>
      `您已成功贡献 ${amount} ${currency}${suffix}`,
    amountContributed: "贡献金额",
    newTotalProgress: "新总进度",
    makeAnother: "再次贡献",
    close: "关闭",
    selectRegion: "选择地区",
    selectStakeAmount: "选择质押金额",
    availablePrefix: "可用:",
    cancel: "取消",
    stakeAction: (amount) => `质押 ${amount}`,
    loadingVerb: "处理中...",
  },

  farmsPerformance: {
    phaseWeekClosing: "周度结算",
    phaseAuditReview: "审计审查",
    phaseFinalizing: "确认中",
    phaseClaimReady: "可领取",
    phasePending: "待处理",
    dateLocale: "zh-CN",
    milestoneWeekCloses: "周度结算",
    milestoneAuditedPosted: "审计完成并发布",
    milestoneFundsAvailable: "资金可用",
    milestoneFirstFundsAvailable: "首笔资金可用",
    nowLabel: "现在",
    firstFundsTooltip:
      "在周日协议周结算并由审计员审查批次后,奖励才会发布。资金随后会锁定 3 周的链上确认窗口期,然后开放首次领取。",
    firstFundsAriaLabel: "为什么首笔资金会延迟",
    cost: "成本",
    delegated: "已委托",
    rewards: "奖励",
    estWeekly: "预计每周",
    estWeeklyLower: "预计每周",
    earned: "已获得",
    shopMinerBadge: "商店矿机",
    shopMinerSource: "积分商店",
    pointsSuffix: "积分",
    readyToClaim: "可领取",
    rewardPipeline: "奖励管道",
    breakdown: "明细",
    recovered: "已回收",
    inProgress: "进行中",
    rewardsStatus: "奖励",
    funding: "募资",
    startsEarning: "开始获益",
    nextStep: "下一步",
    pdRecovered: "PD 已回收",
    rewardsStart: "奖励开始",
    emissions: "释放量",
    total: "合计",
    weekCloses: "周度结算",
    auditedPosted: "审计完成并发布",
    firstFundsAvailable: "首笔资金可用",
    timeProgress: "时间进度",
    valueProgress: "价值进度",
    timeline: "时间线",
    currentPhase: "当前阶段",
    week: "周",
    remaining: "剩余",
    lastWeek: "上周",
    identity: "身份信息",
    lifecycle: "生命周期",
    keyMetrics: "关键指标",
    progress: "进度",
    farmPerformance: "太阳能场表现",
    all: "全部",
    miners: "矿工",
    delegations: "委托",
    other: "其他",
    connectWalletPrompt: "连接您的钱包以查看太阳能场表现",
    retry: "重试",
    roiRequiresSpotPrice:
      "ROI 需要 GLW 现货价格;在价格可用前显示 $0。",
    glowMining: "Glow 挖矿",
    last10Weeks: "最近 10 周",
    viewDetails: "查看详情",
    chartViewComponent: "[ 图表视图组件 ]",
    weekAbbrev: "周",
    filledLabel: (filled, total) => `${filled} / ${total} 已填充`,
    minersFilledLabel: (filled, total) => `${filled} / ${total} 矿工已填充`,
    percentFilled: (percent) => `${percent}% 已填充`,
    weeksProgress: (active, total) => `${active} / ${total} 周`,
    weeksProgressShort: (active, total) => `${active} / ${total} 周`,
    weeksLeft: (weeks) => `剩余 ${weeks} 周`,
    weekOf: (active, total) => `${active} / ${total}`,
    remainingWeeks: (weeks) => `${weeks} 周`,
    startsEarningOn: (date) => `开始获益 ${date ?? "—"}`,
    firstFundsAvailableOn: (date) => `首笔资金可用 ${date ?? "—"}`,
    regionFallback: (id) => `地区 ${id}`,
    farmFallback: (id) => `太阳能场 ${id}`,
    launchpadLabel: "Launchpad",
    minerLabel: "矿工",
    pending: "待处理",
    unableToLoadInProgress: "无法加载进行中的委托",
    unableToLoadFarms: "无法加载太阳能场表现",
    noInProgressFound: "此钱包没有进行中的委托",
    noFarmsFound: "此钱包没有太阳能场",
  },

  rewardsBreakdown: {
    title: "奖励明细",
    delegationsAndMinersDesc: "您的委托与矿工的详细明细",
    delegationsDesc: "您的委托的详细明细",
    minersDesc: "您的矿工的详细明细",
    rewardsDesc: "您的奖励的详细明细",
    delegation: "委托",
    mining: "挖矿",
    lastWeek: "上周",
    weeklyFor: (type) => `此 ${type} 的每周奖励明细`,
    delegationNoun: "委托",
    minerNoun: "矿工",
    farmNoun: "太阳能场",
    week: "周",
    emissions: "释放量",
    protocolDeposit: "协议存款",
    total: "合计",
    delegations: "委托",
    otherRewards: "其他奖励",
    pendingRewards: "待领取奖励",
    claimRewards: "领取奖励",
    delegated: "已委托",
    estWeeklyRewards: "预计每周奖励",
    weeksRemaining: "剩余周数",
    totalEarned: "累计获得",
    seeDetails: "查看详情",
    seeAudit: "查看审计",
    pdAsset: "PD 资产",
    pending: "待处理",
    type: "类型",
  },
};

export const bigDialogsTranslations: Record<Lang, BigDialogsStrings> = {
  en,
  ko,
  zh,
};
