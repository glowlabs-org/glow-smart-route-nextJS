import type { Lang } from "../config";

export interface ClaimsStrings {
  // Hero / header
  heroClaimableLabel: string;
  heroFarmRewardsLabel: string;
  heroAllClaimed: string;
  heroWeeksReadyToClaim: (n: number) => string;
  cardRewardsAvailable: string;
  cardRewardsHistory: string;
  cardTitleFarmRewards: string;
  cardDescriptionClaimable: string;
  cardDescriptionAllClaimed: string;

  // Totals summary
  totalClaimable: string;
  totalClaimed: string;
  weeksLabel: (n: number) => string;

  // Action buttons
  claimAllProtocolDeposits: string;
  claimingProtocolDeposits: string;
  checking: string;
  claimed: string;
  claimingInProgress: string;
  loadingProof: string;
  noRewards: string;
  claimableOn: (dateLabel: string) => string;
  pdIn: (countdown: string) => string;
  claimIn: (countdown: string) => string;
  claimPd: string;
  claimEmissions: string;
  days: (n: number) => string;
  dayOne: string;
  hoursMinutes: (h: number, m: number) => string;

  // Weekly breakdown section
  weeklyBreakdown: string;
  weekLabel: (n: number) => string;
  ready: string;
  readyToClaim: string;
  emissionsClaimed: string;
  finalizing: string;
  // The date under a week row is the date the rewards become available, not
  // the week's own calendar date — label it so a future date under a past week
  // number stops reading like a bug. Plain wording on purpose: no "unlock",
  // "finalize", or "epoch" in anything a user reads.
  rowAvailableOn: (date: string) => string;
  rowAvailableSince: (date: string) => string;

  // Reward rows
  emissionRewards: string;
  protocolDepositRewardsShort: string;
  protocolDepositWithCredit: string;
  protocolDepositLabel: string;
  claimButton: (type: string) => string;
  claimEmissionsShort: string;
  claimPdShort: string;
  emissionsPill: string;
  pdPill: string;

  // Pending / pipeline notice
  pendingWeeksOne: string;
  pendingWeeksMany: (n: number) => string;
  pendingNoticeBody: (date: string) => string;
  // Shown under the hero when nothing is claimable yet but weeks are still
  // finalizing, so the big "0" is never the only number on screen.
  heroPendingAmount: (amounts: string, date: string) => string;

  // Inflation claim reassurance
  inflationReassuranceTitle: string;
  inflationReassuranceBody: string;

  // Claim dialog (TransactionDialog chrome)
  reviewClaimTitle: string;
  claimCompleteTitle: string;
  claimFailedTitle: string;
  processingClaimTitle: string;
  reviewClaimDescription: string;
  processingClaimDescription: string;
  confirmClaim: string;
  cancel: string;

  // Stage labels
  stagePending: string;
  stageInProgress: string;
  stageSuccess: string;
  stageSkipped: string;
  stageError: string;
  stageSubmitting: string;
  stageConfirmed: string;
  stageUnableToComplete: string;
  stageEmissionRewards: string;
  stageProtocolDepositRewards: string;
  stageEmissionAlreadyClaimed: string;
  stageProtocolAlreadyClaimed: string;

  // Toast messages
  toastConnectWallet: string;
  toastNoRewardsSelection: string;
  toastNoProof: string;
  toastClaimSuccess: (type: string, week: number) => string;
  toastSomeFailed: string;
  toastUnableToComplete: string;
  toastRewardsAlreadyClaimed: string;
  toastTxHashUnavailable: string;
  toastNoProtocolAvailable: string;
  toastNoClaimableProofs: string;
  toastUnknownError: string;

  // Sub-types for rewards
  emissionRewardsWord: string;
  protocolDepositWord: string;

  // Info sections
  rewardTypesTitle: string;
  rewardTypesBody: string;
  aboutClaimsTitle: string;
  aboutClaimsBody: string;

  // Currency labels
  currencyGlw: string;
  currencyUsdc: string;
  currencyUsdg: string;
  currencySgctl: string;

  // Misc
  live: string;
  viewTransaction: string;
}

const en: ClaimsStrings = {
  heroClaimableLabel: "Claimable Rewards",
  heroFarmRewardsLabel: "Farm Rewards",
  heroAllClaimed: "All rewards have been claimed",
  heroWeeksReadyToClaim: (n) =>
    `${n} week${n !== 1 ? "s" : ""} ready to claim`,
  cardRewardsAvailable: "Rewards Available",
  cardRewardsHistory: "Rewards History",
  cardTitleFarmRewards: "Farm Rewards",
  cardDescriptionClaimable:
    "Claim your earned rewards from solar farm delegations",
  cardDescriptionAllClaimed: "Your farm rewards history",

  totalClaimable: "Total Claimable",
  totalClaimed: "Total Claimed",
  weeksLabel: (n) => (n === 1 ? "1 week" : `${n} weeks`),

  claimAllProtocolDeposits: "Claim All Protocol Deposits",
  claimingProtocolDeposits: "Claiming Protocol Deposits...",
  checking: "Checking...",
  claimed: "Claimed",
  claimingInProgress: "Claiming...",
  loadingProof: "Loading proof...",
  noRewards: "No rewards",
  claimableOn: (dateLabel) => `Claimable ${dateLabel}`,
  pdIn: (countdown) => `PD in ${countdown}`,
  claimIn: (countdown) => `Claim in ${countdown}`,
  claimPd: "Claim PD",
  claimEmissions: "Claim Emissions",
  days: (n) => `${n} days`,
  dayOne: "1 day",
  hoursMinutes: (h, m) => `${h}h ${m}m`,

  weeklyBreakdown: "Weekly Breakdown",
  weekLabel: (n) => `Week ${n}`,
  ready: "Ready",
  readyToClaim: "Ready to Claim",
  emissionsClaimed: "Emissions Claimed",
  finalizing: "Finalizing",
  rowAvailableOn: (date) => `Available ${date}`,
  rowAvailableSince: (date) => `Available since ${date}`,

  emissionRewards: "Emission Rewards",
  protocolDepositRewardsShort: "Protocol Deposit Rewards",
  protocolDepositWithCredit: "Protocol Deposit · credited to staked balance",
  protocolDepositLabel: "Protocol Deposit",
  claimButton: (type) => `Claim ${type}`,
  claimEmissionsShort: "Emissions",
  claimPdShort: "PD",
  emissionsPill: "Emissions",
  pdPill: "PD",

  pendingWeeksOne: "1 reward week in the pipeline",
  pendingWeeksMany: (n) => `${n} reward weeks in the pipeline`,
  pendingNoticeBody: (date) =>
    `These rewards are still moving through review and finalization. Your next claim should open around ${date}.`,
  heroPendingAmount: (amounts, date) =>
    `${amounts} on the way · first available ${date}`,

  inflationReassuranceTitle: "Emissions rewards claim status",
  inflationReassuranceBody:
    "Some of your emission rewards appear claimed. They were distributed previously.",

  reviewClaimTitle: "Review Claim",
  claimCompleteTitle: "Claim Complete",
  claimFailedTitle: "Claim Failed",
  processingClaimTitle: "Processing Claim",
  reviewClaimDescription: "Review your rewards before confirming the claim.",
  processingClaimDescription: "Please wait while we process your claim.",
  confirmClaim: "Confirm Claim",
  cancel: "Cancel",

  stagePending: "Pending",
  stageInProgress: "In progress",
  stageSuccess: "Completed",
  stageSkipped: "Skipped",
  stageError: "Failed",
  stageSubmitting: "Submitting transaction...",
  stageConfirmed: "Transaction confirmed",
  stageUnableToComplete: "Unable to complete",
  stageEmissionRewards: "Emission Rewards",
  stageProtocolDepositRewards: "Protocol Deposit Rewards",
  stageEmissionAlreadyClaimed: "Emission rewards already claimed.",
  stageProtocolAlreadyClaimed: "Protocol deposit rewards already claimed.",

  toastConnectWallet: "Connect your wallet to claim rewards.",
  toastNoRewardsSelection: "No rewards available to claim for this selection",
  toastNoProof: "No proof found for this week",
  toastClaimSuccess: (type, week) =>
    `Successfully claimed ${type} rewards for week ${week}`,
  toastSomeFailed:
    "Some rewards failed to claim. You can retry the remaining items.",
  toastUnableToComplete:
    "We were unable to complete your claim. Please try again.",
  toastRewardsAlreadyClaimed: "Rewards already claimed or unavailable.",
  toastTxHashUnavailable: "Transaction hash not available for this activity.",
  toastNoProtocolAvailable: "No protocol deposit rewards available to claim.",
  toastNoClaimableProofs: "No claimable protocol deposit proofs were found.",
  toastUnknownError: "Unknown error",

  emissionRewardsWord: "emission",
  protocolDepositWord: "protocol deposit",

  rewardTypesTitle: "Reward types",
  rewardTypesBody:
    "Emission rewards are freshly minted GLW distributed each week. Protocol Deposit rewards are your portion of the deposit recovery.",
  aboutClaimsTitle: "About claims",
  aboutClaimsBody:
    "Rewards become claimable after on-chain finalization. Claims may take a few minutes to confirm.",

  currencyGlw: "GLOW",
  currencyUsdc: "USDC",
  currencyUsdg: "USDG",
  currencySgctl: "sGCTL",

  live: "Live",
  viewTransaction: "View transaction",
};

const ko: ClaimsStrings = {
  heroClaimableLabel: "클레임 가능한 리워드",
  heroFarmRewardsLabel: "발전소 리워드",
  heroAllClaimed: "모든 리워드를 클레임했습니다",
  heroWeeksReadyToClaim: (n) => `${n}주 클레임 준비 완료`,
  cardRewardsAvailable: "사용 가능한 리워드",
  cardRewardsHistory: "리워드 내역",
  cardTitleFarmRewards: "발전소 리워드",
  cardDescriptionClaimable:
    "태양광 발전소 위임에서 획득한 리워드를 클레임하세요",
  cardDescriptionAllClaimed: "발전소 리워드 내역입니다",

  totalClaimable: "총 클레임 가능",
  totalClaimed: "총 클레임 완료",
  weeksLabel: (n) => `${n}주`,

  claimAllProtocolDeposits: "모든 프로토콜 디포짓 클레임",
  claimingProtocolDeposits: "프로토콜 디포짓 클레임 중...",
  checking: "확인 중...",
  claimed: "클레임 완료",
  claimingInProgress: "클레임 중...",
  loadingProof: "증명 로드 중...",
  noRewards: "리워드 없음",
  claimableOn: (dateLabel) => `${dateLabel} 클레임 가능`,
  pdIn: (countdown) => `PD ${countdown} 후`,
  claimIn: (countdown) => `${countdown} 후 클레임`,
  claimPd: "PD 클레임",
  claimEmissions: "발행분 클레임",
  days: (n) => `${n}일`,
  dayOne: "1일",
  hoursMinutes: (h, m) => `${h}시간 ${m}분`,

  weeklyBreakdown: "주간 내역",
  weekLabel: (n) => `${n}주차`,
  ready: "준비 완료",
  readyToClaim: "클레임 가능",
  emissionsClaimed: "발행분 클레임 완료",
  finalizing: "확정 중",
  rowAvailableOn: (date) => `${date} 수령 가능`,
  rowAvailableSince: (date) => `${date}부터 수령 가능`,

  emissionRewards: "발행분 리워드",
  protocolDepositRewardsShort: "프로토콜 디포짓 리워드",
  protocolDepositWithCredit: "프로토콜 디포짓 · 스테이킹 잔액에 반영됨",
  protocolDepositLabel: "프로토콜 디포짓",
  claimButton: (type) => `${type} 클레임`,
  claimEmissionsShort: "발행분",
  claimPdShort: "PD",
  emissionsPill: "발행분",
  pdPill: "PD",

  pendingWeeksOne: "1주차 리워드 진행 중",
  pendingWeeksMany: (n) => `${n}주차 리워드 진행 중`,
  pendingNoticeBody: (date) =>
    `검토 및 확정 과정을 진행 중입니다. 다음 클레임은 ${date} 전후에 열립니다.`,
  heroPendingAmount: (amounts, date) =>
    `${amounts} 준비 중 · 최초 수령 ${date}`,

  inflationReassuranceTitle: "발행분 리워드 클레임 상태",
  inflationReassuranceBody:
    "일부 발행분 리워드가 이미 클레임 완료된 것으로 보입니다. 이전에 분배된 리워드입니다.",

  reviewClaimTitle: "클레임 검토",
  claimCompleteTitle: "클레임 완료",
  claimFailedTitle: "클레임 실패",
  processingClaimTitle: "클레임 처리 중",
  reviewClaimDescription: "클레임 확정 전에 리워드를 검토하세요.",
  processingClaimDescription: "클레임을 처리하는 동안 잠시만 기다려주세요.",
  confirmClaim: "클레임 확정",
  cancel: "취소",

  stagePending: "대기 중",
  stageInProgress: "진행 중",
  stageSuccess: "완료",
  stageSkipped: "건너뜀",
  stageError: "실패",
  stageSubmitting: "트랜잭션 제출 중...",
  stageConfirmed: "트랜잭션 확인됨",
  stageUnableToComplete: "완료할 수 없습니다",
  stageEmissionRewards: "발행분 리워드",
  stageProtocolDepositRewards: "프로토콜 디포짓 리워드",
  stageEmissionAlreadyClaimed: "발행분 리워드를 이미 클레임했습니다.",
  stageProtocolAlreadyClaimed: "프로토콜 디포짓 리워드를 이미 클레임했습니다.",

  toastConnectWallet: "리워드를 클레임하려면 지갑을 연결하세요.",
  toastNoRewardsSelection: "이 선택 항목에는 클레임할 리워드가 없습니다",
  toastNoProof: "이번 주차에 대한 증명을 찾을 수 없습니다",
  toastClaimSuccess: (type, week) =>
    `${week}주차 ${type} 리워드를 클레임했습니다`,
  toastSomeFailed:
    "일부 리워드 클레임에 실패했습니다. 남은 항목은 다시 시도할 수 있습니다.",
  toastUnableToComplete: "클레임을 완료하지 못했습니다. 다시 시도해주세요.",
  toastRewardsAlreadyClaimed: "이미 클레임했거나 사용할 수 없는 리워드입니다.",
  toastTxHashUnavailable:
    "이 활동의 트랜잭션 해시를 확인할 수 없습니다.",
  toastNoProtocolAvailable: "클레임 가능한 프로토콜 디포짓 리워드가 없습니다.",
  toastNoClaimableProofs:
    "클레임 가능한 프로토콜 디포짓 증명을 찾을 수 없습니다.",
  toastUnknownError: "알 수 없는 오류",

  emissionRewardsWord: "발행분",
  protocolDepositWord: "프로토콜 디포짓",

  rewardTypesTitle: "리워드 종류",
  rewardTypesBody:
    "발행분 리워드는 매주 새로 발행되는 GLW입니다. 프로토콜 디포짓 리워드는 디포짓 회수에 대한 본인 몫입니다.",
  aboutClaimsTitle: "클레임 안내",
  aboutClaimsBody:
    "온체인 확정 이후 리워드를 클레임할 수 있습니다. 클레임 확인까지 몇 분이 걸릴 수 있습니다.",

  currencyGlw: "GLOW",
  currencyUsdc: "USDC",
  currencyUsdg: "USDG",
  currencySgctl: "sGCTL",

  live: "실시간",
  viewTransaction: "트랜잭션 보기",
};

const zh: ClaimsStrings = {
  heroClaimableLabel: "可领取奖励",
  heroFarmRewardsLabel: "电站奖励",
  heroAllClaimed: "所有奖励均已领取",
  heroWeeksReadyToClaim: (n) => `${n} 周奖励可领取`,
  cardRewardsAvailable: "可用奖励",
  cardRewardsHistory: "奖励记录",
  cardTitleFarmRewards: "电站奖励",
  cardDescriptionClaimable: "领取您通过太阳能电站委托所获得的奖励",
  cardDescriptionAllClaimed: "您的电站奖励历史记录",

  totalClaimable: "可领取总额",
  totalClaimed: "已领取总额",
  weeksLabel: (n) => `${n} 周`,

  claimAllProtocolDeposits: "领取全部协议存款奖励",
  claimingProtocolDeposits: "正在领取协议存款奖励...",
  checking: "正在检查...",
  claimed: "已领取",
  claimingInProgress: "正在领取...",
  loadingProof: "正在加载凭证...",
  noRewards: "暂无奖励",
  claimableOn: (dateLabel) => `${dateLabel} 可领取`,
  pdIn: (countdown) => `PD 将于 ${countdown} 后开放`,
  claimIn: (countdown) => `${countdown} 后可领取`,
  claimPd: "领取 PD",
  claimEmissions: "领取发行奖励",
  days: (n) => `${n} 天`,
  dayOne: "1 天",
  hoursMinutes: (h, m) => `${h} 小时 ${m} 分钟`,

  weeklyBreakdown: "每周明细",
  weekLabel: (n) => `第 ${n} 周`,
  ready: "已就绪",
  readyToClaim: "可领取",
  emissionsClaimed: "发行奖励已领取",
  finalizing: "确认中",
  rowAvailableOn: (date) => `${date} 可领取`,
  rowAvailableSince: (date) => `${date} 起可领取`,

  emissionRewards: "发行奖励",
  protocolDepositRewardsShort: "协议存款奖励",
  protocolDepositWithCredit: "协议存款 · 已计入质押余额",
  protocolDepositLabel: "协议存款",
  claimButton: (type) => `领取${type}`,
  claimEmissionsShort: "发行奖励",
  claimPdShort: "PD",
  emissionsPill: "发行奖励",
  pdPill: "PD",

  pendingWeeksOne: "1 周奖励正在处理中",
  pendingWeeksMany: (n) => `${n} 周奖励正在处理中`,
  pendingNoticeBody: (date) =>
    `这些奖励正在审核与最终确认中。下次领取预计将于 ${date} 前后开放。`,
  heroPendingAmount: (amounts, date) =>
    `${amounts} 正在路上 · 最早 ${date} 可领取`,

  inflationReassuranceTitle: "发行奖励领取状态",
  inflationReassuranceBody:
    "您的部分发行奖励显示已领取。这些奖励此前已完成发放。",

  reviewClaimTitle: "确认领取",
  claimCompleteTitle: "领取完成",
  claimFailedTitle: "领取失败",
  processingClaimTitle: "正在处理领取",
  reviewClaimDescription: "请在确认领取前核对您的奖励。",
  processingClaimDescription: "正在处理您的领取请求,请稍候。",
  confirmClaim: "确认领取",
  cancel: "取消",

  stagePending: "等待中",
  stageInProgress: "处理中",
  stageSuccess: "已完成",
  stageSkipped: "已跳过",
  stageError: "失败",
  stageSubmitting: "正在提交交易...",
  stageConfirmed: "交易已确认",
  stageUnableToComplete: "无法完成",
  stageEmissionRewards: "发行奖励",
  stageProtocolDepositRewards: "协议存款奖励",
  stageEmissionAlreadyClaimed: "发行奖励已被领取。",
  stageProtocolAlreadyClaimed: "协议存款奖励已被领取。",

  toastConnectWallet: "请连接钱包以领取奖励。",
  toastNoRewardsSelection: "当前选择无可领取的奖励",
  toastNoProof: "未找到本周的领取凭证",
  toastClaimSuccess: (type, week) =>
    `已成功领取第 ${week} 周的${type}奖励`,
  toastSomeFailed: "部分奖励领取失败,您可以重试剩余项目。",
  toastUnableToComplete: "我们无法完成您的领取,请重试。",
  toastRewardsAlreadyClaimed: "奖励已领取或不可用。",
  toastTxHashUnavailable: "此操作的交易哈希不可用。",
  toastNoProtocolAvailable: "暂无可领取的协议存款奖励。",
  toastNoClaimableProofs: "未找到可领取的协议存款凭证。",
  toastUnknownError: "未知错误",

  emissionRewardsWord: "发行",
  protocolDepositWord: "协议存款",

  rewardTypesTitle: "奖励类型",
  rewardTypesBody:
    "发行奖励是每周新增铸造并分发的 GLW。协议存款奖励则是您在存款回收中应得的份额。",
  aboutClaimsTitle: "关于领取",
  aboutClaimsBody:
    "奖励将在链上最终确认后开放领取。领取交易可能需要几分钟才能确认。",

  currencyGlw: "GLOW",
  currencyUsdc: "USDC",
  currencyUsdg: "USDG",
  currencySgctl: "sGCTL",

  live: "实时",
  viewTransaction: "查看交易",
};

export const claimsTranslations: Record<Lang, ClaimsStrings> = {
  en,
  ko,
  zh,
};
