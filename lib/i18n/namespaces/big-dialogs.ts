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
    loadingTitle: "Loading Impact Score",
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
    steeringSubValue: "Staked GCTL (3x Pts)",
    stake: "Stake",
    boost: "Boost",
    emissions: "Emissions",
    emissionsSubValue: (glw) => `${glw} GLW × 1 pt/wk`,
    emissionsFallback: "GLW Emissions Rewards",
    earn: "Earn",
    add: "Add",
    delegation: "Delegation",
    delegationSubValue: (glw) => `${glw} GLW × 0.005 pts/wk`,
    delegationFallback: "Vault Bonus",
    delegate: "Delegate",
    glowWorth: "Glow Worth",
    glowWorthSubValue: (glw) => `${glw} GLW × 0.001 pts/wk`,
    glowWorthFallback: "Holding GLW",
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
    howScoresUpdate: "How Scores Update",
    basePointCalc: "Base Point Calculation",
    basePointCalcBody1: "All point sources (",
    basePointCalcBody2:
      ") are calculated based on your holdings and activity.",
    weeklyRollover: "Weekly Rollover (Sundays 00:00 UTC)",
    weeklyRolloverBody1: "On weekly rollover, your ",
    totalMultiplier: "Total Multiplier",
    weeklyRolloverBody2: " (Miner 3× + Streak up to +1×) is applied to ",
    allPointSources: "ALL point sources",
    weeklyRolloverBody3:
      ", including Glow Worth. The points displayed above already include these multipliers.",
    passiveIncome: "Passive income",
    finalized: "Finalized",
    weeklyRate: (rate) => `+${rate}/wk`,
    extraPoints: "Emissions, Steering, Vault Bonus, and Glow Worth",
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
      "Help build the future of solar energy and earn Impact Points.",
    shareReferralCode: "Share Referral Code",
    toastLinkCopied: "Referral link copied!",
    toastDiscordCopied: "Discord message copied! Paste it in your server.",
    discordMessage: "Copy message for Discord",
    tierSeed: "Seed",
    tierGrow: "Grow",
    tierScale: "Scale",
    tierLegend: "Legend",
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
    faqActivationABold: "100 Impact Points after linking",
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
    boostImpactScore: "Boost Impact Score",
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
    scoreBoost: "Score Boost",
    regionShare: "Region Share",
    steeringScore: "Steering Score",
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
      "Earn 3 pts per GLW steered on the leaderboard.",
    selectRegion: "Select Region",
    currentShare: (share) => `Current Share: ${share}`,
    glwPerWeek: "GLW/week",
    inputAmount: "Input Amount",
    availableAmount: (amount, currency) => `Available: ${amount} ${currency}`,
    finalizingCountdown: (seconds) => `Finalizing (≈ ${seconds}s)…`,
    transactionFailedDesc: "We couldn’t complete your transaction.",
    rewardsRedirected: "Rewards Redirected",
    pointsUnit: "pts",
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
    pointsGained: (amount) => `+${amount} gained`,
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
    loadingTitle: "임팩트 점수 로드 중",
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
    steeringSubValue: "스테이킹된 GCTL (3배 포인트)",
    stake: "스테이킹",
    boost: "부스트",
    emissions: "발행분",
    emissionsSubValue: (glw) => `${glw} GLW × 주당 1pt`,
    emissionsFallback: "GLW 발행분 리워드",
    earn: "획득",
    add: "추가",
    delegation: "위임",
    delegationSubValue: (glw) => `${glw} GLW × 주당 0.005pt`,
    delegationFallback: "볼트 보너스",
    delegate: "위임",
    glowWorth: "Glow 자산",
    glowWorthSubValue: (glw) => `${glw} GLW × 주당 0.001pt`,
    glowWorthFallback: "GLW 보유",
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
    extraPoints: "발행분, 스티어링, 볼트 보너스, Glow 자산",
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
    tierSeed: "시드",
    tierGrow: "그로우",
    tierScale: "스케일",
    tierLegend: "레전드",
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
    boostImpactScore: "임팩트 점수 부스트",
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
    scoreBoost: "점수 부스트",
    regionShare: "지역 비중",
    steeringScore: "스티어링 점수",
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
      "리더보드에서 할당한 GLW 1개당 3 pts를 획득합니다.",
    selectRegion: "지역 선택",
    currentShare: (share) => `현재 비중: ${share}`,
    glwPerWeek: "GLW/주",
    inputAmount: "입력 금액",
    availableAmount: (amount, currency) => `사용 가능: ${amount} ${currency}`,
    finalizingCountdown: (seconds) => `마무리 중 (약 ${seconds}초)…`,
    transactionFailedDesc: "트랜잭션을 완료하지 못했습니다.",
    rewardsRedirected: "리워드 재분배",
    pointsUnit: "pts",
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
    pointsGained: (amount) => `+${amount} 획득`,
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

export const bigDialogsTranslations: Record<Lang, BigDialogsStrings> = {
  en,
  ko,
};
