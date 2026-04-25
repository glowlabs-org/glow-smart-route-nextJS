import type { Lang } from "../config";

export interface DialogsStrings {
  // Glow Worth Breakdown
  glowWorth: {
    title: string;
    totalDescription: string;
    liquidLabel: string;
    liquidSublabel: string;
    delegatedLabel: string;
    delegatedSublabel: string;
    unclaimedLabel: string;
    unclaimedSublabel: string;
  };

  // Unstake GCTL dialog
  unstake: {
    title: string;
    region: string;
    selectRegion: string;
    yourStake: string;
    unstakeAmount: string;
    schedule: string;
    yourStakedRegions: string;
    noStakedGctl: string;
    selectUnstakeAmount: string;
    max: string;
    unstakingOfGctl: (amount: string, max: string) => string;
    scheduleValue: string;
    infoBlurb: string;
    stopUnstakeLabel: (amount: string) => string;
    cancel: string;
    unstake: string;
    toastSuccess: (amount: string) => string;
    toastSuccessDesc: (region: string) => string;
    toastEnterAmount: string;
    toastNoOngoingSchedules: string;
    toastStopped: string;
  };

  // Restake assistant
  restake: {
    title: string;
    fromRegion: string;
    region: string;
    yourStake: string;
    toRegion: string;
    yieldPct: string;
    unbindedCredits: string;
    showTop: string;
    showTop3: string;
    regionsMustDiffer: string;
    selectRestakeAmount: string;
    max: string;
    restakingOfGctl: (amount: string, max: string) => string;
    selectFromRegion: string;
    preview: string;
    fromTo: string;
    amount: string;
    infoBlurb: string;
    cancel: string;
    restake: string;
    toastSuccess: (amount: string) => string;
    toastSuccessDesc: (from: string, to: string) => string;
  };

  // Completed farms dialog (if any text)
  completedFarms: {
    title: string;
    empty: string;
    panels: (n: string) => string;
    ccPerWeek: (cc: string) => string;
    seeAudit: string;
    auditPending: string;
    farmsBrought: (n: number) => string;
  };

  // Unstaking explanation modal
  unstakingExplanation: {
    stableRewards: string;
    title: string;
    intro: string;
    onePercentBold: string;
    exampleHeader: string;
    exampleItem1Prefix: string;
    exampleItem1Amount: string;
    exampleItem1Body: string;
    exampleItem1Weeks: string;
    exampleItem2Prefix: string;
    exampleItem2Amount: string;
    exampleItem2Body: string;
    exampleItem2Rate: string;
    exampleItem2Tail: string;
    whyHeader: string;
    whyStableBold: string;
    whyStableBody: string;
    whyLongTermBold: string;
    whyLongTermBody: string;
    whyPredictableBold: string;
    whyPredictableBody: string;
    readGuide: string;
    readGuideSub: string;
    gotIt: string;
  };

  // Refund claims panel
  refundClaims: {
    claim: string;
    noRefunds: string;
    connectWallet: string;
    tryAgain: string;
    slowPipeline: string;
    slowPipelineDesc: string;
    submitted: string;
    submittedDesc: (txHash: string) => string;
    viewAction: string;
    refunded: string;
    refundedDesc: string;
    failed: string;
    availableRefunds: string;
    description: string;
    confirming: string;
    claimAll: string;
    refresh: string;
    processing: string;
    quantity: string;
    expired: string;
    cancelled: string;
    aboutTitle: string;
    totalRefundable: string;
    aboutDescription: (
      total: string,
      totalCount: number,
      expired: number,
      cancelled: number,
    ) => string;
    processingCount: (count: number) => string;
  };

  // Send tab
  send: {
    invalidAddress: string;
    invalidAmount: string;
    notReady: string;
    txFailed: string;
    txSuccessful: string;
    amount: string;
    balance: string;
    recipientAddress: string;
    enterAmount: string;
    enterAddress: string;
    insufficientBalance: (token: string) => string;
    send: string;
    sending: string;
  };

  // Launchpad dialog
  launchpad: {
    title: string;
  };

  // Contribute dialog (placeholder, extend as needed)
  contribute: {
    title: string;
  };

  // Migration claim panel
  migration: {
    title: string;
    description: string;
    checkingAllocation: string;
    available: string;
    allocationDescription: string;
    gctlAvailableToUnstake: string;
    claiming: string;
    unstakeAndClaim: string;
    claimSuccessful: string;
    claimSuccessfulBody: string;
    exploreRegions: string;
    stakeYourGctl: string;
    stakeYourGctlBody: string;
    confirmTitle: string;
    confirmDescription: string;
    amountToClaim: string;
    onceOnlyNotice: string;
    cancel: string;
    confirmUnstake: string;
    claimSuccessTitle: string;
    claimSuccessSub: string;
    amountClaimed: string;
    done: string;
  };

  // Stats sidebar
  statsSidebar: {
    marketCap: string;
    usdcInRedemption: string;
    marketOverview: string;
    glwMarketCap: string;
    glwPrice: string;
    gctlPrice: string;
    usdcAvailable: string;
    updating: string;
    viewGlwUsdgActivity: string;
  };
}

const en: DialogsStrings = {
  glowWorth: {
    title: "Your Glow Worth",
    totalDescription: "Total GLW across all sources",
    liquidLabel: "GLW in your wallet",
    liquidSublabel: "Updates right away when you receive or swap GLW",
    delegatedLabel: "GLW from delegations + pending recovery",
    delegatedSublabel:
      "Includes delegated GLW and protocol deposit recovery not yet claimable",
    unclaimedLabel: "Unclaimed rewards",
    unclaimedSublabel: "Rewards you've earned but haven't claimed yet",
  },
  unstake: {
    title: "Unstake GCTL",
    region: "Region",
    selectRegion: "Select a region to continue",
    yourStake: "Your Stake",
    unstakeAmount: "Unstake Amount",
    schedule: "Schedule",
    yourStakedRegions: "Your staked regions",
    noStakedGctl: "You have no staked GCTL in any region.",
    selectUnstakeAmount: "Select unstake amount",
    max: "Max",
    unstakingOfGctl: (amount, max) =>
      `Unstaking ${amount} GCTL of ${max} GCTL`,
    scheduleValue: "100 weeks (1%/wk)",
    infoBlurb:
      "Unstaking releases 1% weekly. You can restake released GCTL at any time.",
    stopUnstakeLabel: (amount) => `Stop Unstake (${amount} GCTL)`,
    cancel: "Cancel",
    unstake: "Unstake",
    toastSuccess: (amount) => `Unstaking ${amount} GCTL`,
    toastSuccessDesc: (region) =>
      `${region} • Drips over 100 weeks (1%/wk)`,
    toastEnterAmount: "Enter a valid amount to unstake",
    toastNoOngoingSchedules: "No ongoing unstake schedules",
    toastStopped: "Stopped ongoing unstake schedule",
  },
  restake: {
    title: "Restake GCTL",
    fromRegion: "From region (your staked)",
    region: "Region",
    yourStake: "Your Stake",
    toRegion: "To region",
    yieldPct: "Yield %",
    unbindedCredits: "Unbinded Credits",
    showTop: "Show Top",
    showTop3: "Show Top 3",
    regionsMustDiffer: "From and To regions must be different",
    selectRestakeAmount: "Select restake amount",
    max: "Max",
    restakingOfGctl: (amount, max) =>
      `Restaking ${amount} GCTL of ${max} GCTL`,
    selectFromRegion: "Select a from region to continue",
    preview: "Preview",
    fromTo: "From → To",
    amount: "Amount",
    infoBlurb: "Restaking drips 1% per week.",
    cancel: "Cancel",
    restake: "Restake",
    toastSuccess: (amount) => `Restaking ${amount} GCTL`,
    toastSuccessDesc: (from, to) => `${from} → ${to}`,
  },
  completedFarms: {
    title: "Completed Farms",
    empty: "No completed farms yet",
    panels: (n) => `${n} panels`,
    ccPerWeek: (cc) => `${cc} cc/week`,
    seeAudit: "See audit",
    auditPending: "Audit pending",
    farmsBrought: (n) => `${n} farms brought online`,
  },
  unstakingExplanation: {
    stableRewards: "Stable rewards",
    title: "Understanding GCTL Unstaking",
    intro:
      "GCTL uses a gradual unstaking mechanism to ensure stable, predictable rewards for solar farms. When you unstake GCTL, ",
    onePercentBold: "1% of your staked balance is released each week",
    exampleHeader: "Example",
    exampleItem1Prefix: "If you stake ",
    exampleItem1Amount: "100 GCTL",
    exampleItem1Body: ", it takes ",
    exampleItem1Weeks: "100 weeks",
    exampleItem2Prefix: "If you stake ",
    exampleItem2Amount: "1,000 GCTL",
    exampleItem2Body: ", you receive ",
    exampleItem2Rate: "10 GCTL per week",
    exampleItem2Tail: " for 100 weeks",
    whyHeader: "Why This Design?",
    whyStableBold: "Stable rewards",
    whyStableBody: " for solar farms - prevents sudden emission drops",
    whyLongTermBold: "Long-term alignment",
    whyLongTermBody: " - encourages sustained commitment to regions",
    whyPredictableBold: "Predictable planning",
    whyPredictableBody: " - farms can count on consistent GLW incentives",
    readGuide: "Read the full guide",
    readGuideSub: "Learn more about GCTL mechanics",
    gotIt: "Got it",
  },
  refundClaims: {
    claim: "Claim",
    noRefunds: "No refunds available to claim",
    connectWallet: "Please connect your wallet",
    tryAgain: "Please try again",
    slowPipeline: "Refund processing is taking longer than expected",
    slowPipelineDesc:
      "Your refund may still be processing. Please check your wallet.",
    submitted: "Refund transaction submitted",
    submittedDesc: (txHash) => `Transaction: ${txHash}`,
    viewAction: "View",
    refunded: "Refund claimed successfully!",
    refundedDesc: "Your GLW tokens have been refunded to your wallet",
    failed: "Failed to claim refund",
    availableRefunds: "Available Refunds",
    description: "Claim refunds from expired or cancelled listings",
    confirming: "Confirming...",
    claimAll: "Claim All",
    refresh: "Refresh",
    processing: "Processing...",
    quantity: "Quantity",
    expired: "Expired",
    cancelled: "Cancelled",
    aboutTitle: "About Refunds",
    totalRefundable: "Total refundable:",
    aboutDescription: (total, totalCount, expired, cancelled) =>
      `${total} GLW from ${totalCount} failed listings (${expired} expired, ${cancelled} cancelled).`,
    processingCount: (count) => `Processing ${count} refund claims...`,
  },
  send: {
    invalidAddress: "Invalid address",
    invalidAmount: "Invalid amount",
    notReady: "Send tokens hook not ready",
    txFailed: "Transaction failed",
    txSuccessful: "Transaction successful",
    amount: "Amount",
    balance: "Balance:",
    recipientAddress: "Recipient Address",
    enterAmount: "Enter an amount",
    enterAddress: "Enter an address",
    insufficientBalance: (token) => `Insufficient ${token} balance`,
    send: "Send",
    sending: "Sending...",
  },
  launchpad: {
    title: "Launchpad",
  },
  contribute: {
    title: "Contribute",
  },
  migration: {
    title: "GCTL Allocation",
    description: "Migrate your legacy balance",
    checkingAllocation: "Checking your V2 GCTL allocation",
    available: "Available",
    allocationDescription:
      "Your V2 GCTL allocation is staked to the Clean Grid Project by default. Claim to unstake to your wallet.",
    gctlAvailableToUnstake: "GCTL available to unstake",
    claiming: "Claiming...",
    unstakeAndClaim: "Unstake and claim GCTL",
    claimSuccessful: "Claim successful",
    claimSuccessfulBody:
      "Your GCTL allocation has been unstaked from the Clean Grid Project and transferred to your wallet. Balances will update automatically.",
    exploreRegions: "Explore regions",
    stakeYourGctl: "Stake your GCTL",
    stakeYourGctlBody:
      "Consider staking your GCTL to one of these active regions to support renewable energy and earn rewards:",
    confirmTitle: "Unstake and claim GCTL",
    confirmDescription:
      "Your V2 GCTL allocation from prior contributions is currently staked to the Clean Grid Project. Confirm to unstake and transfer it to your wallet.",
    amountToClaim: "Amount to claim",
    onceOnlyNotice:
      "This will instantly unstake your GCTL and move it to your wallet. This can only be done once, after that all unstaking events take 100 weeks",
    cancel: "Cancel",
    confirmUnstake: "Confirm unstake and claim",
    claimSuccessTitle: "Claim successful",
    claimSuccessSub:
      "Your GCTL has been unstaked and transferred to your wallet.",
    amountClaimed: "Amount claimed",
    done: "Done",
  },
  statsSidebar: {
    marketCap: "Market Cap",
    usdcInRedemption: "USDC in Redemption",
    marketOverview: "Market Overview",
    glwMarketCap: "GLW Market Cap",
    glwPrice: "GLW Price",
    gctlPrice: "GCTL Price",
    usdcAvailable: "USDC Available",
    updating: "Updating...",
    viewGlwUsdgActivity: "View GLW/USDG activity",
  },
};

const ko: DialogsStrings = {
  glowWorth: {
    title: "내 Glow 자산",
    totalDescription: "모든 출처의 총 GLW",
    liquidLabel: "지갑의 GLW",
    liquidSublabel: "GLW를 받거나 스왑하면 즉시 업데이트됩니다",
    delegatedLabel: "위임 GLW + 회수 대기분",
    delegatedSublabel:
      "위임된 GLW와 아직 클레임할 수 없는 프로토콜 디포짓 회수분을 포함합니다",
    unclaimedLabel: "미청구 리워드",
    unclaimedSublabel: "획득했지만 아직 클레임하지 않은 리워드",
  },
  unstake: {
    title: "GCTL 언스테이크",
    region: "지역",
    selectRegion: "계속하려면 지역을 선택하세요",
    yourStake: "내 스테이킹",
    unstakeAmount: "언스테이크 금액",
    schedule: "스케줄",
    yourStakedRegions: "스테이킹된 지역",
    noStakedGctl: "어느 지역에도 스테이킹된 GCTL이 없습니다.",
    selectUnstakeAmount: "언스테이크 비율 선택",
    max: "최대",
    unstakingOfGctl: (amount, max) =>
      `전체 ${max} GCTL 중 ${amount} GCTL 언스테이크`,
    scheduleValue: "100주 (주당 1%)",
    infoBlurb:
      "언스테이크는 매주 1%씩 해제됩니다. 해제된 GCTL은 언제든 다시 스테이킹할 수 있습니다.",
    stopUnstakeLabel: (amount) => `언스테이크 중지 (${amount} GCTL)`,
    cancel: "취소",
    unstake: "언스테이크",
    toastSuccess: (amount) => `${amount} GCTL 언스테이크 중`,
    toastSuccessDesc: (region) => `${region} · 100주 동안 (주당 1%) 해제`,
    toastEnterAmount: "언스테이크할 유효한 금액을 입력하세요",
    toastNoOngoingSchedules: "진행 중인 언스테이크 스케줄이 없습니다",
    toastStopped: "진행 중인 언스테이크 스케줄을 중지했습니다",
  },
  restake: {
    title: "GCTL 리스테이크",
    fromRegion: "출발 지역 (스테이킹된)",
    region: "지역",
    yourStake: "내 스테이킹",
    toRegion: "도착 지역",
    yieldPct: "수익률 %",
    unbindedCredits: "미연결 크레딧",
    showTop: "전체 보기",
    showTop3: "상위 3개 보기",
    regionsMustDiffer: "출발과 도착 지역은 달라야 합니다",
    selectRestakeAmount: "리스테이크 비율 선택",
    max: "최대",
    restakingOfGctl: (amount, max) =>
      `전체 ${max} GCTL 중 ${amount} GCTL 리스테이크`,
    selectFromRegion: "계속하려면 출발 지역을 선택하세요",
    preview: "미리보기",
    fromTo: "출발 → 도착",
    amount: "금액",
    infoBlurb: "리스테이크는 주당 1%씩 적용됩니다.",
    cancel: "취소",
    restake: "리스테이크",
    toastSuccess: (amount) => `${amount} GCTL 리스테이크 중`,
    toastSuccessDesc: (from, to) => `${from} → ${to}`,
  },
  completedFarms: {
    title: "완료된 발전소",
    empty: "아직 완료된 발전소가 없습니다",
    panels: (n) => `패널 ${n}개`,
    ccPerWeek: (cc) => `주당 ${cc} cc`,
    seeAudit: "감사 보기",
    auditPending: "감사 대기",
    farmsBrought: (n) => `발전소 ${n}곳 가동 개시`,
  },
  unstakingExplanation: {
    stableRewards: "안정적인 리워드",
    title: "GCTL 언스테이크 이해하기",
    intro:
      "GCTL은 태양광 발전소에 안정적이고 예측 가능한 리워드를 보장하기 위해 점진적 언스테이크 방식을 사용합니다. GCTL을 언스테이크하면, ",
    onePercentBold: "매주 스테이킹 잔액의 1%가 해제됩니다",
    exampleHeader: "예시",
    exampleItem1Prefix: "",
    exampleItem1Amount: "100 GCTL",
    exampleItem1Body: "을 스테이킹한 경우, 전량 언스테이크까지 ",
    exampleItem1Weeks: "100주",
    exampleItem2Prefix: "",
    exampleItem2Amount: "1,000 GCTL",
    exampleItem2Body: "을 스테이킹한 경우, 100주 동안 ",
    exampleItem2Rate: "주당 10 GCTL",
    exampleItem2Tail: "을 받습니다",
    whyHeader: "이 설계 이유",
    whyStableBold: "안정적인 리워드",
    whyStableBody: " - 태양광 발전소의 급격한 발행분 감소를 방지합니다",
    whyLongTermBold: "장기적 정렬",
    whyLongTermBody: " - 지역에 대한 지속적인 약속을 장려합니다",
    whyPredictableBold: "예측 가능한 계획",
    whyPredictableBody: " - 발전소가 일관된 GLW 인센티브를 기대할 수 있습니다",
    readGuide: "전체 가이드 읽기",
    readGuideSub: "GCTL 작동 방식 자세히 보기",
    gotIt: "확인",
  },
  refundClaims: {
    claim: "클레임",
    noRefunds: "클레임 가능한 환불이 없습니다",
    connectWallet: "지갑을 연결해주세요",
    tryAgain: "다시 시도해주세요",
    slowPipeline: "환불 처리가 예상보다 오래 걸리고 있습니다",
    slowPipelineDesc:
      "환불이 아직 처리 중일 수 있습니다. 지갑을 확인해주세요.",
    submitted: "환불 트랜잭션이 제출되었습니다",
    submittedDesc: (txHash) => `트랜잭션: ${txHash}`,
    viewAction: "보기",
    refunded: "환불 클레임이 완료되었습니다!",
    refundedDesc: "GLW 토큰이 지갑으로 환불되었습니다",
    failed: "환불 클레임에 실패했습니다",
    availableRefunds: "사용 가능한 환불",
    description: "만료되었거나 취소된 목록의 환불을 클레임하세요",
    confirming: "확인 중...",
    claimAll: "전체 클레임",
    refresh: "새로고침",
    processing: "처리 중...",
    quantity: "수량",
    expired: "만료됨",
    cancelled: "취소됨",
    aboutTitle: "환불 안내",
    totalRefundable: "환불 가능 총액:",
    aboutDescription: (total, totalCount, expired, cancelled) =>
      `실패한 ${totalCount}건 (만료 ${expired}건, 취소 ${cancelled}건)에서 ${total} GLW.`,
    processingCount: (count) => `${count}건의 환불 클레임 처리 중...`,
  },
  send: {
    invalidAddress: "잘못된 주소",
    invalidAmount: "잘못된 금액",
    notReady: "토큰 전송 훅이 준비되지 않았습니다",
    txFailed: "트랜잭션 실패",
    txSuccessful: "트랜잭션 성공",
    amount: "금액",
    balance: "잔액:",
    recipientAddress: "받는 주소",
    enterAmount: "금액을 입력하세요",
    enterAddress: "주소를 입력하세요",
    insufficientBalance: (token) => `${token} 잔액 부족`,
    send: "전송",
    sending: "전송 중...",
  },
  launchpad: {
    title: "런치패드",
  },
  contribute: {
    title: "기여",
  },
  migration: {
    title: "GCTL 할당",
    description: "기존 잔액을 마이그레이션하세요",
    checkingAllocation: "V2 GCTL 할당을 확인하는 중",
    available: "사용 가능",
    allocationDescription:
      "V2 GCTL 할당이 기본적으로 Clean Grid Project에 스테이킹되어 있습니다. 클레임하면 지갑으로 언스테이크됩니다.",
    gctlAvailableToUnstake: "언스테이크 가능한 GCTL",
    claiming: "클레임 중...",
    unstakeAndClaim: "GCTL 언스테이크 및 클레임",
    claimSuccessful: "클레임 완료",
    claimSuccessfulBody:
      "GCTL 할당이 Clean Grid Project에서 언스테이크되어 지갑으로 전송되었습니다. 잔액이 자동으로 업데이트됩니다.",
    exploreRegions: "지역 둘러보기",
    stakeYourGctl: "GCTL 스테이킹하기",
    stakeYourGctlBody:
      "GCTL을 아래 활성 지역 중 한 곳에 스테이킹하여 재생 에너지를 지원하고 리워드를 받아보세요:",
    confirmTitle: "GCTL 언스테이크 및 클레임",
    confirmDescription:
      "이전 기여분의 V2 GCTL 할당이 Clean Grid Project에 스테이킹되어 있습니다. 언스테이크 후 지갑으로 전송하려면 확정해주세요.",
    amountToClaim: "클레임 금액",
    onceOnlyNotice:
      "GCTL이 즉시 언스테이크되어 지갑으로 이동합니다. 이 작업은 한 번만 가능하며, 이후의 모든 언스테이크는 100주가 소요됩니다",
    cancel: "취소",
    confirmUnstake: "언스테이크 및 클레임 확정",
    claimSuccessTitle: "클레임 완료",
    claimSuccessSub: "GCTL이 언스테이크되어 지갑으로 전송되었습니다.",
    amountClaimed: "클레임된 금액",
    done: "완료",
  },
  statsSidebar: {
    marketCap: "시가총액",
    usdcInRedemption: "환매 중 USDC",
    marketOverview: "시장 개요",
    glwMarketCap: "GLW 시가총액",
    glwPrice: "GLW 가격",
    gctlPrice: "GCTL 가격",
    usdcAvailable: "사용 가능 USDC",
    updating: "업데이트 중...",
    viewGlwUsdgActivity: "GLW/USDG 활동 보기",
  },
};

export const dialogsTranslations: Record<Lang, DialogsStrings> = {
  en,
  ko,
};
