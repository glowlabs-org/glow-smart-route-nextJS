import type { Lang } from "../config";

export interface BuyGlowStrings {
  // Header
  title: string;
  subtitle: string;

  // Input
  youPay: string;
  youReceive: string;
  max: string;
  insufficientBalance: string;
  approximateUsd: (usd: string) => string;
  pricePerGlw: (value: string) => string;

  // Payment methods
  paymentMethod: string;
  usdcLabel: string;
  usdgLabel: string;
  ethLabel: string;
  connectWalletBalance: string;

  // Action buttons
  connectWallet: string;
  buyGlw: string;

  // Transaction steps (processing phase)
  processingTitle: string;
  processingBody: string;
  failedTitle: string;
  failedBody: string;

  stepSwapEthToUsdcTitle: string;
  stepSwapEthToUsdcDescription: string;
  stepSwapUsdcToUsdgTitle: string;
  stepSwapUsdcToUsdgDescription: string;
  stepSwapUsdgToGlwTitle: string;
  stepSwapUsdgToGlwDescription: string;
  stepBondingTitle: string;
  stepBondingDescription: string;
  stepConfirmTitle: string;
  stepConfirmDescription: string;

  close: string;
  tryAgain: string;

  // Success phase
  impactBoostedBadge: string;
  impactBoostedBody: string;
  sentLabel: string;
  receivedLabel: string;
  transactionLabel: string;

  // Toasts
  toastEnterAmount: string;
  toastConnectRequired: string;
  toastEstimateUpdating: string;
  toastPurchaseSuccess: string;
  toastTransactionFailed: string;
  toastTransactionRejected: string;
  toastFailedComputeMaxEth: string;

  // Estimate error
  errorEthPayNotSupported: string;
  errorInsufficientUsdc: string;
  errorInsufficientUsdg: string;
}

const en: BuyGlowStrings = {
  title: "Buy GLW",
  subtitle: "Swap stablecoins or ETH for GLW tokens",

  youPay: "You pay",
  youReceive: "You receive",
  max: "MAX",
  insufficientBalance: "Insufficient balance",
  approximateUsd: (usd) => `≈ $${usd}`,
  pricePerGlw: (value) => `$${value}/GLW`,

  paymentMethod: "Payment Method",
  usdcLabel: "USD Coin (USDC)",
  usdgLabel: "USD Glow (USDG)",
  ethLabel: "Ethereum (ETH)",
  connectWalletBalance: "Connect wallet",

  connectWallet: "Connect Wallet",
  buyGlw: "Buy GLW",

  processingTitle: "Processing Purchase",
  processingBody: "Please wait while we process your transaction.",
  failedTitle: "Transaction Failed",
  failedBody: "There was an error processing your transaction.",

  stepSwapEthToUsdcTitle: "Swap ETH → USDC",
  stepSwapEthToUsdcDescription: "Converting ETH to USDC via Uniswap",
  stepSwapUsdcToUsdgTitle: "Swap USDC → USDG",
  stepSwapUsdcToUsdgDescription: "Converting USDC to USDG",
  stepSwapUsdgToGlwTitle: "Swap USDG → GLW",
  stepSwapUsdgToGlwDescription: "Converting USDG to GLW via Uniswap",
  stepBondingTitle: "Purchase from Bonding Curve",
  stepBondingDescription: "Purchasing GLW from bonding curve",
  stepConfirmTitle: "Confirm Transaction",
  stepConfirmDescription: "Waiting for blockchain confirmation",

  close: "Close",
  tryAgain: "Try Again",

  impactBoostedBadge: "GLW Purchased",
  impactBoostedBody:
    "Buying GLW does not earn points by itself. Delegate GLW to a solar farm to earn spendable points.",
  sentLabel: "Sent",
  receivedLabel: "Received",
  transactionLabel: "Transaction",

  toastEnterAmount: "Please enter a valid amount",
  toastConnectRequired: "Connect your wallet to continue",
  toastEstimateUpdating: "Price estimate is updating. Please wait and try again.",
  toastPurchaseSuccess: "Successfully purchased GLW!",
  toastTransactionFailed: "Transaction failed",
  toastTransactionRejected: "Transaction rejected",
  toastFailedComputeMaxEth: "Failed to compute max ETH amount",

  errorEthPayNotSupported: "ETH pay is only supported on mainnet or sepolia.",
  errorInsufficientUsdc: "Insufficient USDC balance",
  errorInsufficientUsdg: "Insufficient USDG balance",
};

const ko: BuyGlowStrings = {
  title: "GLW 구매",
  subtitle: "스테이블코인이나 ETH로 GLW 토큰을 교환하세요",

  youPay: "지불 금액",
  youReceive: "수령 금액",
  max: "최대",
  insufficientBalance: "잔액 부족",
  approximateUsd: (usd) => `≈ $${usd}`,
  pricePerGlw: (value) => `$${value}/GLW`,

  paymentMethod: "결제 방식",
  usdcLabel: "USD Coin (USDC)",
  usdgLabel: "USD Glow (USDG)",
  ethLabel: "Ethereum (ETH)",
  connectWalletBalance: "지갑 연결",

  connectWallet: "지갑 연결",
  buyGlw: "GLW 구매",

  processingTitle: "구매 처리 중",
  processingBody: "트랜잭션을 처리하는 동안 잠시만 기다려주세요.",
  failedTitle: "트랜잭션 실패",
  failedBody: "트랜잭션 처리 중 오류가 발생했습니다.",

  stepSwapEthToUsdcTitle: "ETH → USDC 교환",
  stepSwapEthToUsdcDescription: "Uniswap을 통해 ETH를 USDC로 교환 중",
  stepSwapUsdcToUsdgTitle: "USDC → USDG 교환",
  stepSwapUsdcToUsdgDescription: "USDC를 USDG로 교환 중",
  stepSwapUsdgToGlwTitle: "USDG → GLW 교환",
  stepSwapUsdgToGlwDescription: "Uniswap을 통해 USDG를 GLW로 교환 중",
  stepBondingTitle: "본딩 커브 구매",
  stepBondingDescription: "본딩 커브에서 GLW 구매 중",
  stepConfirmTitle: "트랜잭션 확인",
  stepConfirmDescription: "블록체인 확인 대기 중",

  close: "닫기",
  tryAgain: "다시 시도",

  impactBoostedBadge: "GLW 구매 완료",
  impactBoostedBody:
    "GLW 구매만으로는 포인트가 적립되지 않습니다. GLW를 태양광 발전소에 위임하면 사용할 수 있는 포인트를 얻습니다.",
  sentLabel: "전송",
  receivedLabel: "수령",
  transactionLabel: "트랜잭션",

  toastEnterAmount: "유효한 금액을 입력해주세요",
  toastConnectRequired: "계속하려면 지갑을 연결해주세요",
  toastEstimateUpdating:
    "가격 추정치를 업데이트 중입니다. 잠시 후 다시 시도해주세요.",
  toastPurchaseSuccess: "GLW 구매를 완료했습니다!",
  toastTransactionFailed: "트랜잭션 실패",
  toastTransactionRejected: "트랜잭션이 거절되었습니다",
  toastFailedComputeMaxEth: "최대 ETH 금액을 계산할 수 없습니다",

  errorEthPayNotSupported:
    "ETH 결제는 메인넷 또는 세폴리아에서만 지원됩니다.",
  errorInsufficientUsdc: "USDC 잔액이 부족합니다",
  errorInsufficientUsdg: "USDG 잔액이 부족합니다",
};

const zh: BuyGlowStrings = {
  title: "购买 GLW",
  subtitle: "用稳定币或 ETH 兑换 GLW 代币",

  youPay: "支付",
  youReceive: "获得",
  max: "最大",
  insufficientBalance: "余额不足",
  approximateUsd: (usd) => `≈ $${usd}`,
  pricePerGlw: (value) => `$${value}/GLW`,

  paymentMethod: "支付方式",
  usdcLabel: "USD Coin (USDC)",
  usdgLabel: "USD Glow (USDG)",
  ethLabel: "Ethereum (ETH)",
  connectWalletBalance: "连接钱包",

  connectWallet: "连接钱包",
  buyGlw: "购买 GLW",

  processingTitle: "正在处理购买",
  processingBody: "正在处理您的交易,请稍候。",
  failedTitle: "交易失败",
  failedBody: "处理交易时发生错误。",

  stepSwapEthToUsdcTitle: "兑换 ETH → USDC",
  stepSwapEthToUsdcDescription: "通过 Uniswap 将 ETH 兑换为 USDC",
  stepSwapUsdcToUsdgTitle: "兑换 USDC → USDG",
  stepSwapUsdcToUsdgDescription: "正在将 USDC 兑换为 USDG",
  stepSwapUsdgToGlwTitle: "兑换 USDG → GLW",
  stepSwapUsdgToGlwDescription: "通过 Uniswap 将 USDG 兑换为 GLW",
  stepBondingTitle: "通过 Bonding Curve 购买",
  stepBondingDescription: "正在从 Bonding Curve 购买 GLW",
  stepConfirmTitle: "确认交易",
  stepConfirmDescription: "等待区块链确认",

  close: "关闭",
  tryAgain: "重试",

  impactBoostedBadge: "GLW 购买完成",
  impactBoostedBody:
    "购买 GLW 本身不会获得积分。将 GLW 委托给太阳能农场即可获得可使用的积分。",
  sentLabel: "已发送",
  receivedLabel: "已收到",
  transactionLabel: "交易",

  toastEnterAmount: "请输入有效金额",
  toastConnectRequired: "请连接您的钱包以继续",
  toastEstimateUpdating: "价格估算正在更新,请稍后再试。",
  toastPurchaseSuccess: "成功购买 GLW!",
  toastTransactionFailed: "交易失败",
  toastTransactionRejected: "交易已被拒绝",
  toastFailedComputeMaxEth: "无法计算最大 ETH 金额",

  errorEthPayNotSupported: "ETH 支付仅支持主网或 Sepolia 网络。",
  errorInsufficientUsdc: "USDC 余额不足",
  errorInsufficientUsdg: "USDG 余额不足",
};

export const buyGlowTranslations: Record<Lang, BuyGlowStrings> = {
  en,
  ko,
  zh,
};
