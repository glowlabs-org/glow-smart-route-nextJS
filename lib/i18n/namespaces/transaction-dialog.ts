import type { Lang } from "../config";

export interface TransactionDialogStrings {
  defaultTitle: string;
  defaultDescription: string;
  defaultProcessingTitle: string;
  defaultProcessingDescription: string;
  defaultSuccessTitle: string;
  defaultErrorTitle: string;
  defaultErrorDescription: string;
  confirm: string;
  cancel: string;
  close: string;
  transactionLabel: string;
  transactionId: string;
  explorer: string;
  viewOnEtherscan: string;
  networkFee: string;
  calculating: string;
  submitting: string;
  eta: (seconds: number) => string;
  processingShouldComplete: string;
  percentComplete: (pct: number) => string;
  doNotClose: string;
  impactScoreBoosted: string;
  toastTxCopied: string;
}

const en: TransactionDialogStrings = {
  defaultTitle: "Review & Confirm",
  defaultDescription: "Please review the details before confirming",
  defaultProcessingTitle: "Processing Transaction",
  defaultProcessingDescription: "Please wait while we process your transaction",
  defaultSuccessTitle: "Transaction Successful",
  defaultErrorTitle: "Transaction Failed",
  defaultErrorDescription:
    "We were unable to process your transaction. Please try again or contact support.",
  confirm: "Confirm",
  cancel: "Cancel",
  close: "Close",
  transactionLabel: "Transaction",
  transactionId: "Transaction ID",
  explorer: "Explorer",
  viewOnEtherscan: "View on Etherscan",
  networkFee: "Network Fee",
  calculating: "Calculating...",
  submitting: "Submitting transaction...",
  eta: (seconds) => `${seconds}s`,
  processingShouldComplete: "Processing should complete soon",
  percentComplete: (pct) => `${pct}% complete • Checking status every 5s`,
  doNotClose: "Please do not close this window or refresh the page",
  impactScoreBoosted: "Impact Score Boosted",
  toastTxCopied: "Transaction ID copied to clipboard",
};

const ko: TransactionDialogStrings = {
  defaultTitle: "검토 및 확정",
  defaultDescription: "확정 전에 세부 정보를 검토해주세요",
  defaultProcessingTitle: "트랜잭션 처리 중",
  defaultProcessingDescription:
    "트랜잭션을 처리하는 동안 잠시만 기다려주세요",
  defaultSuccessTitle: "트랜잭션 성공",
  defaultErrorTitle: "트랜잭션 실패",
  defaultErrorDescription:
    "트랜잭션을 처리할 수 없습니다. 다시 시도하거나 지원팀에 문의해주세요.",
  confirm: "확정",
  cancel: "취소",
  close: "닫기",
  transactionLabel: "트랜잭션",
  transactionId: "트랜잭션 ID",
  explorer: "익스플로러",
  viewOnEtherscan: "Etherscan에서 보기",
  networkFee: "네트워크 수수료",
  calculating: "계산 중...",
  submitting: "트랜잭션 제출 중...",
  eta: (seconds) => `${seconds}초`,
  processingShouldComplete: "곧 처리가 완료됩니다",
  percentComplete: (pct) => `${pct}% 완료 · 5초마다 상태 확인 중`,
  doNotClose: "이 창을 닫거나 새로고침하지 마세요",
  impactScoreBoosted: "임팩트 점수 상승",
  toastTxCopied: "트랜잭션 ID를 클립보드에 복사했습니다",
};

export const transactionDialogTranslations: Record<Lang, TransactionDialogStrings> = {
  en,
  ko,
};
