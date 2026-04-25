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
};

export const walletTranslations: Record<Lang, WalletStrings> = {
  en,
  ko,
};
