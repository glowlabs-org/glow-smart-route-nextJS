import type { Lang } from "../config";

export interface WalletStrings {
  connectWallet: string;
  connected: string;
  reconnectWallet: string;
  wrongNetwork: string;
  switchTo: (network: string) => string;
  wrongNetworkBody: (connected: string, expected: string) => string;
  networkRequirementTitle: (network: string) => string;
  networkRequirementConnected: (network: string) => string;
  networkRequirementDisconnected: (network: string) => string;
  networkRequirementWrong: (connected: string, expected: string) => string;
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
  points: string;
  pointsShop: string;
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
  wrongNetworkBody: (connected, expected) =>
    `Your wallet is on ${connected}. Switch to ${expected} to see your balances and continue.`,
  networkRequirementTitle: (network) => `Network: ${network}`,
  networkRequirementConnected: (network) =>
    `You're connected to ${network}. Use ${network} assets for this purchase.`,
  networkRequirementDisconnected: (network) =>
    `Connect a wallet on ${network}. Assets on Base, BNB, or other networks will not appear here.`,
  networkRequirementWrong: (connected, expected) =>
    `On ${connected}; switch to ${expected}. Base/BNB assets won't show here.`,
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
  points: "Points",
  pointsShop: "Points Shop",
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
  wrongNetworkBody: (connected, expected) =>
    `지갑이 ${connected}에 연결되어 있습니다. 잔액을 확인하고 계속하려면 ${expected}(으)로 전환하세요.`,
  networkRequirementTitle: (network) => `네트워크: ${network}`,
  networkRequirementConnected: (network) =>
    `${network}에 연결되어 있습니다. 이 구매에는 ${network}의 자산을 사용하세요.`,
  networkRequirementDisconnected: (network) =>
    `${network}의 지갑을 연결하세요. Base, BNB 또는 다른 네트워크의 자산은 여기에 표시되지 않습니다.`,
  networkRequirementWrong: (connected, expected) =>
    `${connected}에 있습니다. ${expected}(으)로 전환하세요. Base/BNB 자산은 여기에 표시되지 않습니다.`,
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
  points: "포인트",
  pointsShop: "포인트 샵",
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

const zh: WalletStrings = {
  connectWallet: "连接钱包",
  connected: "已连接",
  reconnectWallet: "重新连接钱包",
  wrongNetwork: "网络错误",
  switchTo: (network) => `切换到 ${network}`,
  wrongNetworkBody: (connected, expected) =>
    `您的钱包当前在 ${connected}。请切换到 ${expected} 以查看余额并继续。`,
  networkRequirementTitle: (network) => `网络：${network}`,
  networkRequirementConnected: (network) =>
    `您已连接到 ${network}。本次购买请使用 ${network} 上的资产。`,
  networkRequirementDisconnected: (network) =>
    `请连接 ${network} 上的钱包。Base、BNB 或其他网络上的资产不会在这里显示。`,
  networkRequirementWrong: (connected, expected) =>
    `当前在 ${connected}；请切换到 ${expected}。Base/BNB 资产不会在这里显示。`,
  switching: "切换中...",
  openWalletAccount: "打开钱包账户",
  switchedToMainnet: "已切换到以太坊主网",
  switchedToSepolia: "已切换到 Sepolia 测试网",
  switchedTo: (network) => `已切换到 ${network}`,
  failedToSwitchNetwork: "切换网络失败",
  failedToOpenWallet: "无法打开钱包",
  disconnect: "断开连接",
  addressCopied: "地址已复制",
  copyAddress: "复制地址",
  openInExplorer: "在区块浏览器中打开",
  balances: "余额",
  points: "积分",
  pointsShop: "积分商店",
  copyReferralLink: "复制推荐链接",
  loadingReferral: "推荐链接加载中…",
  failedToCopyAddress: "复制地址失败",
  referralLinkNotReady: "推荐链接尚未就绪",
  referralLinkCopied: "推荐链接已复制",
  failedToCopyLink: "复制链接失败",
  connectWalletFirst: "请先连接钱包",
  cardPurchasesMainnetOnly: "信用卡购买仅在主网可用",
  buyAmountUsdcWithCard: (amount) => `用信用卡购买 ${amount} USDC`,
  cardOnRampMinNotice:
    "信用卡入金渠道需要最低购买金额；多出的部分将以 USDC 形式留在您的钱包中。",
};

export const walletTranslations: Record<Lang, WalletStrings> = {
  en,
  ko,
  zh,
};
