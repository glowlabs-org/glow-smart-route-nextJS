import type { Lang } from "../config";

export interface WalletStrings {
  connectWallet: string;
  connected: string;
  reconnectWallet: string;
  wrongNetwork: string;
  switchTo: (network: string) => string;
  switching: string;
  openWalletAccount: string;
  switchedToMainnet: string;
  switchedToSepolia: string;
  switchedTo: (network: string) => string;
  failedToSwitchNetwork: string;
  failedToOpenWallet: string;
  disconnect: string;
  addressCopied: string;
  // Account popover
  copyAddress: string;
  openInExplorer: string;
  balances: string;
  copyReferralLink: string;
  loadingReferral: string;
  failedToCopyAddress: string;
  referralLinkNotReady: string;
  referralLinkCopied: string;
  failedToCopyLink: string;
  // Card on-ramp
  connectWalletFirst: string;
  cardPurchasesMainnetOnly: string;
  buyAmountUsdcWithCard: (amount: string) => string;
  cardOnRampMinNotice: string;
}

const en: WalletStrings = {
  connectWallet: "Connect Wallet",
  connected: "Connected",
  reconnectWallet: "Reconnect Wallet",
  wrongNetwork: "Wrong Network",
  switchTo: (network) => `Switch to ${network}`,
  switching: "Switching...",
  openWalletAccount: "Open wallet account",
  switchedToMainnet: "Switched to Ethereum Mainnet",
  switchedToSepolia: "Switched to Sepolia Testnet",
  switchedTo: (network) => `Switched to ${network}`,
  failedToSwitchNetwork: "Failed to switch network",
  failedToOpenWallet: "Failed to open wallet",
  disconnect: "Disconnect",
  addressCopied: "Address copied",
  copyAddress: "Copy address",
  openInExplorer: "Open in block explorer",
  balances: "Balances",
  copyReferralLink: "Copy referral link",
  loadingReferral: "Loading referral…",
  failedToCopyAddress: "Failed to copy address",
  referralLinkNotReady: "Referral link not ready",
  referralLinkCopied: "Referral link copied",
  failedToCopyLink: "Failed to copy link",
  connectWalletFirst: "Connect a wallet first",
  cardPurchasesMainnetOnly: "Card purchases are only available on mainnet",
  buyAmountUsdcWithCard: (amount) => `Buy ${amount} USDC with card`,
  cardOnRampMinNotice:
    "Card on-ramps require a minimum purchase; the surplus will stay in your wallet as USDC.",
};

const ko: WalletStrings = {
  connectWallet: "지갑 연결",
  connected: "연결됨",
  reconnectWallet: "지갑 재연결",
  wrongNetwork: "잘못된 네트워크",
  switchTo: (network) => `${network}(으)로 전환`,
  switching: "전환 중...",
  openWalletAccount: "지갑 계정 열기",
  switchedToMainnet: "이더리움 메인넷으로 전환되었습니다",
  switchedToSepolia: "세폴리아 테스트넷으로 전환되었습니다",
  switchedTo: (network) => `${network}(으)로 전환되었습니다`,
  failedToSwitchNetwork: "네트워크 전환에 실패했습니다",
  failedToOpenWallet: "지갑을 열 수 없습니다",
  disconnect: "연결 해제",
  addressCopied: "주소가 복사되었습니다",
  copyAddress: "주소 복사",
  openInExplorer: "블록 탐색기에서 열기",
  balances: "잔액",
  copyReferralLink: "추천 링크 복사",
  loadingReferral: "추천 링크 불러오는 중…",
  failedToCopyAddress: "주소 복사에 실패했습니다",
  referralLinkNotReady: "추천 링크를 준비 중입니다",
  referralLinkCopied: "추천 링크가 복사되었습니다",
  failedToCopyLink: "링크 복사에 실패했습니다",
  connectWalletFirst: "먼저 지갑을 연결하세요",
  cardPurchasesMainnetOnly: "카드 결제는 메인넷에서만 사용할 수 있습니다",
  buyAmountUsdcWithCard: (amount) => `${amount} USDC를 카드로 구매`,
  cardOnRampMinNotice:
    "카드 온램프는 최소 구매 금액이 필요합니다. 초과 금액은 USDC로 지갑에 보관됩니다.",
};

export const walletTranslations: Record<Lang, WalletStrings> = {
  en,
  ko,
};
