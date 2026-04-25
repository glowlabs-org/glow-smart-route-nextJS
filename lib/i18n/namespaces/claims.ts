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

export const claimsTranslations: Record<Lang, ClaimsStrings> = {
  en,
  ko,
};
