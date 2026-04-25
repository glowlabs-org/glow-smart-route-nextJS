import type { Lang } from "../config";

// NOTE: Only the surrounding UI chrome is translated here. The legal ToS body
// text stays in English because its hash is what the user signs — a translated
// version would break signature verification. The JSX that mirrors the legal
// text is also intentionally not translated to avoid legal ambiguity.

export interface TosStrings {
  dialogTitle: string;
  intro: string;
  readFullTos: string;
  digitalSignatureRequiredLabel: string;
  digitalSignatureRequiredBody: string;
  declineAndDisconnect: string;
  signAndAccept: string;
  signing: string;
  switching: string;
  connecting: string;
  tryAgain: string;
  wrongNetworkAlertTitle: string;
  wrongNetworkAlertConnected: (network: string) => string;
  wrongNetworkAlertSuggestion: (network: string) => string;
  wrongNetworkErrorMessage: (network: string) => string;
  wrongNetworkErrorSuggestion: (network: string) => string;
  smartWalletTipsLabel: string;
  smartWalletTips: string[];
  stillHavingTrouble: string;
  // Toasts
  toastWalletRequired: string;
  toastWalletInitializing: string;
  toastFailedToSign: string;
  toastFailedToSwitchNetwork: string;
  toastFailedToSwitchNetworkDescription: string;
  toastTermsAccepted: string;
  toastTermsAcceptedWithReferral: string;
  toastSignatureRequired: string;
  toastSignatureRequiredDescription: string;
  toastSmartWalletIssue: string;
  toastSmartWalletIssueDescription: string;
}

const en: TosStrings = {
  dialogTitle: "Welcome to Glow",
  intro:
    "In order to interact with GLW and use the Glow Application, you must accept our Terms of Service. This ensures a safe and compliant environment for all users.",
  readFullTos: "Read Full Terms of Service",
  digitalSignatureRequiredLabel: "Digital Signature Required:",
  digitalSignatureRequiredBody:
    'By clicking "Sign & Accept", you will be prompted to sign a message with your wallet. This signature serves as your legally binding acceptance of these Terms of Service.',
  declineAndDisconnect: "Decline & Disconnect",
  signAndAccept: "Sign & Accept",
  signing: "Signing...",
  switching: "Switching...",
  connecting: "Connecting...",
  tryAgain: "Try Again",
  wrongNetworkAlertTitle: "Wrong Network",
  wrongNetworkAlertConnected: (network) =>
    `Your wallet is connected to ${network}.`,
  wrongNetworkAlertSuggestion: (network) =>
    `Please switch to ${network} to continue.`,
  wrongNetworkErrorMessage: (network) =>
    `Your wallet is connected to ${network}.`,
  wrongNetworkErrorSuggestion: (network) =>
    `Please switch to ${network} to sign the Terms of Service.`,
  smartWalletTipsLabel: "Smart Wallet Tips:",
  smartWalletTips: [
    "Ensure your wallet is fully deployed on-chain",
    "For multisig wallets, all required signers must approve",
    "Try using the wallet's built-in browser if available",
  ],
  stillHavingTrouble:
    "Still having trouble? Try disconnecting your wallet and reconnecting, or use a different wallet.",

  toastWalletRequired: "Please ensure your wallet is connected",
  toastWalletInitializing: "Wallet is initializing, please try again in a moment",
  toastFailedToSign: "Failed to sign message",
  toastFailedToSwitchNetwork: "Failed to switch network",
  toastFailedToSwitchNetworkDescription:
    "Please switch networks in your wallet and try again.",
  toastTermsAccepted: "Terms of Service accepted successfully",
  toastTermsAcceptedWithReferral: "Terms accepted and referral linked",
  toastSignatureRequired: "Signature required",
  toastSignatureRequiredDescription:
    "Please approve the signature request in your wallet.",
  toastSmartWalletIssue: "Smart wallet issue detected",
  toastSmartWalletIssueDescription: "See the error details below for help.",
};

const ko: TosStrings = {
  dialogTitle: "Glow에 오신 것을 환영합니다",
  intro:
    "GLW와 상호작용하고 Glow 애플리케이션을 사용하려면 이용약관에 동의해야 합니다. 이는 모든 사용자에게 안전하고 규정을 준수하는 환경을 보장합니다.",
  readFullTos: "전체 이용약관 보기",
  digitalSignatureRequiredLabel: "디지털 서명 필요:",
  digitalSignatureRequiredBody:
    '"서명 및 동의"를 클릭하면 지갑으로 메시지에 서명하라는 요청을 받게 됩니다. 이 서명은 이용약관에 대한 법적 구속력이 있는 동의로 간주됩니다.',
  declineAndDisconnect: "거부 및 연결 해제",
  signAndAccept: "서명 및 동의",
  signing: "서명 중...",
  switching: "전환 중...",
  connecting: "연결 중...",
  tryAgain: "다시 시도",
  wrongNetworkAlertTitle: "잘못된 네트워크",
  wrongNetworkAlertConnected: (network) =>
    `지갑이 ${network}에 연결되어 있습니다.`,
  wrongNetworkAlertSuggestion: (network) =>
    `계속하려면 ${network}(으)로 전환해 주세요.`,
  wrongNetworkErrorMessage: (network) =>
    `지갑이 ${network}에 연결되어 있습니다.`,
  wrongNetworkErrorSuggestion: (network) =>
    `이용약관에 서명하려면 ${network}(으)로 전환해 주세요.`,
  smartWalletTipsLabel: "스마트 지갑 팁:",
  smartWalletTips: [
    "지갑이 온체인에 완전히 배포되어 있는지 확인하세요",
    "멀티시그 지갑의 경우 필요한 모든 서명자가 승인해야 합니다",
    "가능한 경우 지갑의 내장 브라우저를 사용해 보세요",
  ],
  stillHavingTrouble:
    "여전히 문제가 있나요? 지갑 연결을 해제하고 다시 연결하거나 다른 지갑을 사용해 보세요.",

  toastWalletRequired: "지갑이 연결되어 있는지 확인해 주세요",
  toastWalletInitializing: "지갑이 초기화 중입니다. 잠시 후 다시 시도해 주세요",
  toastFailedToSign: "메시지 서명에 실패했습니다",
  toastFailedToSwitchNetwork: "네트워크 전환에 실패했습니다",
  toastFailedToSwitchNetworkDescription:
    "지갑에서 네트워크를 전환한 후 다시 시도해 주세요.",
  toastTermsAccepted: "이용약관에 성공적으로 동의했습니다",
  toastTermsAcceptedWithReferral: "약관이 승인되고 추천인이 연결되었습니다",
  toastSignatureRequired: "서명이 필요합니다",
  toastSignatureRequiredDescription:
    "지갑에서 서명 요청을 승인해 주세요.",
  toastSmartWalletIssue: "스마트 지갑 문제가 감지되었습니다",
  toastSmartWalletIssueDescription:
    "도움말은 아래 오류 상세 내용을 확인하세요.",
};

export const tosTranslations: Record<Lang, TosStrings> = {
  en,
  ko,
};
