import type { Lang } from "../config";

export interface SwapStrings {
  youPay: string;
  youReceive: string;
  balance: string;
  max: string;
  calculating: string;
  pricePerGlw: (price: string) => string;

  // Slippage
  slippageTolerance: string;
  slippageCurrent: string;
  slippageCustom: string;
  slippageHighWarning: string;
  slippagePriceImpact: (pct: string) => string;
  slippageHighEnabled: (pct: string) => string;
  slippageAboveFive: string;
  slippageAriaLabel: string;

  // Route details
  uniswapRoute: string;
  bondingCurve: string;
  estimatedNetworkFee: string;

  // Button labels
  processing: string;
  earlyLiquidityDisabled: string;
  reconnectWallet: string;
  invalidSlippage: string;
  enterAnAmount: string;
  insufficientEthBalance: string;
  insufficientFunds: string;
  insufficientBalanceFor: (token: string) => string;
  convertUsdcToUsdg: string;
  buy: string;
  swap: string;

  // Toasts
  toastHighSlippage: string;
  toastHighSlippageBody: string;
  toastHasUsdg: string;
  toastUseUsdgInstead: string;
  toastYes: string;
  toastNo: string;
  toastInsufficientUsdc: string;

  // Error messages
  transactionFailed: string;
  failedEstimateSwap: string;
  failedComputeMaxEth: string;
  quoteRefreshing: string;

  // Placeholders
  placeholder0: string;
  placeholderLoadingBalances: string;
  placeholderSlippageExample: (value: string) => string;

  // Dialog
  dialogTitle: string;
  dialogUnableToLoad: string;
  dialogRetry: string;

  // Swap dialogs (review/processing/error/success)
  reviewSwap: string;
  swapFailed: string;
  processingSwap: string;
  reviewSwapDescription: string;
  processingSwapDescription: string;
  swapErrorFallback: string;
  approveAndSwap: string;
  approveAndBuy: string;
  approveAndRedeem: string;
  checking: string;
  cancel: string;
  tryAgain: string;
  close: string;
  viewOnEtherscan: string;
  notEnoughEthSwap: (shortfall: string) => string;
  notEnoughEthSwapPurchase: (shortfall: string) => string;
  notEnoughEthRedemption: (shortfall: string) => string;
  insufficientGasError: string;
  insufficientGasErrorExplained: string;
  smartAccountNotSupported: string;
  failedEstimateUsdg: string;
  glowWorthIncreasedMessage: string;
  transactionProgress: string;
  youPayLabel: string;
  youReceiveLabel: string;
  sentLabel: string;
  viaLabel: string;
  receivedLabel: string;

  // Step messages
  stepRequestingGlowApproval: string;
  stepApprovingGlow: string;
  stepSwappingGlowToUsdg: string;
  stepRequestingUsdgApproval: string;
  stepApprovingUsdg: string;
  stepRedeemingUsdgForUsdc: string;
  stepSwapDoneToUsdg: string;
  stepSwapDoneToUsdc: string;
  stepApprovingUsdgRedeem: string;
  stepDoneRedeemed: string;

  // Redemption dialog
  redeemUsdg: string;
  redeemDescription: string;
  youRedeem: string;
  exchangeRate: string;
  exchangeRateValue: string;
  processingRedemption: string;
  redeemedFromUsdg: string;
  fromLabel: string;
  toLabel: string;
  usdgBalance: string;
  usdcWallet: string;
  amountRedeemed: string;
  amountReceived: string;
  exchangeRateOneToOne: string;
}

const en: SwapStrings = {
  youPay: "You pay",
  youReceive: "You receive",
  balance: "Balance:",
  max: "Max",
  calculating: "Calculating...",
  pricePerGlw: (price) => `$${price} per GLW`,

  slippageTolerance: "Slippage tolerance",
  slippageCurrent: "Current:",
  slippageCustom: "Custom",
  slippageHighWarning: "High slippage enabled",
  slippagePriceImpact: (pct) =>
    `Estimated price impact is about ${pct}%. Slippage above 5% can result in materially worse execution.`,
  slippageHighEnabled: (pct) =>
    `High slippage is enabled at ${pct}%. Execution can clear at materially worse prices above 5%.`,
  slippageAboveFive:
    "Slippage above 5% can lead to materially worse execution on swaps.",
  slippageAriaLabel: "Slippage tolerance",

  uniswapRoute: "Uniswap Route",
  bondingCurve: "Bonding Curve",
  estimatedNetworkFee: "Estimated Network Fee",

  processing: "Processing...",
  earlyLiquidityDisabled: "Early liquidity disabled",
  reconnectWallet: "Reconnect Wallet",
  invalidSlippage: "Enter a valid slippage tolerance",
  enterAnAmount: "Enter an amount",
  insufficientEthBalance: "Insufficient ETH balance",
  insufficientFunds: "Insufficient Funds",
  insufficientBalanceFor: (token) => `Insufficient ${token} balance`,
  convertUsdcToUsdg: "CONVERT USDC TO USDG",
  buy: "BUY",
  swap: "SWAP",

  toastHighSlippage: "High slippage enabled",
  toastHighSlippageBody:
    "Slippage above 5% can lead to materially worse execution on swaps.",
  toastHasUsdg: "You have sufficient USDG",
  toastUseUsdgInstead: "Would you like to use USDG instead?",
  toastYes: "Yes",
  toastNo: "No",
  toastInsufficientUsdc: "Insufficient USDC",

  transactionFailed: "Transaction failed",
  failedEstimateSwap: "Failed to estimate swap amount",
  failedComputeMaxEth: "Failed to compute max ETH amount",
  quoteRefreshing: "Your quote is updating. Please review the latest quote.",

  placeholder0: "0.00",
  placeholderLoadingBalances: "Loading balances…",
  placeholderSlippageExample: (value) => `e.g. ${value}`,

  dialogTitle: "Swap Tokens",
  dialogUnableToLoad: "Unable to load swap data. Please try again.",
  dialogRetry: "Retry",

  reviewSwap: "Review Swap",
  swapFailed: "Swap Failed",
  processingSwap: "Processing Swap",
  reviewSwapDescription: "Review your transaction details before confirming",
  processingSwapDescription: "Please wait while we process your swap",
  swapErrorFallback: "We were unable to complete your swap. Please try again.",
  approveAndSwap: "Approve and Swap",
  approveAndBuy: "Approve and Buy",
  approveAndRedeem: "Approve and Redeem",
  checking: "Checking…",
  cancel: "Cancel",
  tryAgain: "Try Again",
  close: "Close",
  viewOnEtherscan: "View on Etherscan",
  notEnoughEthSwap: (shortfall) =>
    `Not enough ETH to cover the full swap. Add ${shortfall} to this wallet and try again.`,
  notEnoughEthSwapPurchase: (shortfall) =>
    `Not enough ETH to cover the full swap + purchase. Add ${shortfall} to this wallet and try again.`,
  notEnoughEthRedemption: (shortfall) =>
    `Not enough ETH to cover the full swap + redemption. Add ${shortfall} to this wallet and try again.`,
  insufficientGasError:
    "Insufficient ETH for gas. Add more ETH to your wallet and try again.",
  insufficientGasErrorExplained:
    "Not enough ETH to cover the network fee. Network fees on Ethereum (gas) can only be paid in ETH — USDC and other tokens can't be used. Add some ETH to your wallet and try again.",
  smartAccountNotSupported: "Smart account not supported.",
  failedEstimateUsdg: "Failed to estimate USDG output",
  glowWorthIncreasedMessage:
    "Buying GLW does not earn points by itself. Delegate GLW to a solar farm to earn spendable points.",
  transactionProgress: "Transaction Progress",
  youPayLabel: "You Pay",
  youReceiveLabel: "You Receive",
  sentLabel: "Sent",
  viaLabel: "Via",
  receivedLabel: "Received",

  stepRequestingGlowApproval: "Requesting GLOW approval",
  stepApprovingGlow: "Approving GLOW",
  stepSwappingGlowToUsdg: "Swapping GLOW to USDG",
  stepRequestingUsdgApproval: "Requesting USDG approval",
  stepApprovingUsdg: "Approving USDG",
  stepRedeemingUsdgForUsdc: "Redeeming USDG for USDC",
  stepSwapDoneToUsdg: "Successfully swapped GLOW to USDG",
  stepSwapDoneToUsdc: "Successfully converted GLOW to USDC",
  stepApprovingUsdgRedeem: "Approving USDG for redemption",
  stepDoneRedeemed: "Successfully redeemed USDC",

  redeemUsdg: "Redeem USDG",
  redeemDescription: "Exchange your USDG for USDC at a 1:1 rate",
  youRedeem: "You redeem",
  exchangeRate: "Exchange Rate",
  exchangeRateValue: "1 USDG = 1 USDC",
  processingRedemption: "Processing redemption...",
  redeemedFromUsdg: "Redeemed from USDG",
  fromLabel: "From",
  toLabel: "To",
  usdgBalance: "USDG Balance",
  usdcWallet: "USDC Wallet",
  amountRedeemed: "Amount Redeemed",
  amountReceived: "Amount Received",
  exchangeRateOneToOne: "1:1",
};

const ko: SwapStrings = {
  youPay: "지불 금액",
  youReceive: "수령 금액",
  balance: "잔액:",
  max: "최대",
  calculating: "계산 중...",
  pricePerGlw: (price) => `GLW당 $${price}`,

  slippageTolerance: "슬리피지 허용치",
  slippageCurrent: "현재:",
  slippageCustom: "사용자 지정",
  slippageHighWarning: "높은 슬리피지 사용",
  slippagePriceImpact: (pct) =>
    `예상 가격 영향이 약 ${pct}%입니다. 5%를 초과하는 슬리피지는 체결가가 크게 불리해질 수 있습니다.`,
  slippageHighEnabled: (pct) =>
    `${pct}%의 높은 슬리피지가 적용되었습니다. 5%를 초과하면 체결가가 크게 불리해질 수 있습니다.`,
  slippageAboveFive:
    "5%를 초과하는 슬리피지는 스왑 체결가가 크게 불리해질 수 있습니다.",
  slippageAriaLabel: "슬리피지 허용치",

  uniswapRoute: "Uniswap 경로",
  bondingCurve: "본딩 커브",
  estimatedNetworkFee: "예상 네트워크 수수료",

  processing: "처리 중...",
  earlyLiquidityDisabled: "얼리 리퀴디티 비활성화됨",
  reconnectWallet: "지갑 재연결",
  invalidSlippage: "유효한 슬리피지 허용치를 입력하세요",
  enterAnAmount: "금액을 입력하세요",
  insufficientEthBalance: "ETH 잔액 부족",
  insufficientFunds: "잔액 부족",
  insufficientBalanceFor: (token) => `${token} 잔액 부족`,
  convertUsdcToUsdg: "USDC → USDG 변환",
  buy: "구매",
  swap: "스왑",

  toastHighSlippage: "높은 슬리피지 사용",
  toastHighSlippageBody:
    "5%를 초과하는 슬리피지는 스왑 체결가가 크게 불리해질 수 있습니다.",
  toastHasUsdg: "USDG 잔액이 충분합니다",
  toastUseUsdgInstead: "USDG로 대신 사용하시겠습니까?",
  toastYes: "예",
  toastNo: "아니오",
  toastInsufficientUsdc: "USDC 잔액 부족",

  transactionFailed: "트랜잭션 실패",
  failedEstimateSwap: "스왑 금액 추정에 실패했습니다",
  failedComputeMaxEth: "최대 ETH 금액을 계산할 수 없습니다",
  quoteRefreshing: "견적을 업데이트하고 있습니다. 최신 견적을 확인해주세요.",

  placeholder0: "0.00",
  placeholderLoadingBalances: "잔액 불러오는 중…",
  placeholderSlippageExample: (value) => `예: ${value}`,

  dialogTitle: "토큰 스왑",
  dialogUnableToLoad: "스왑 데이터를 불러올 수 없습니다. 다시 시도해주세요.",
  dialogRetry: "다시 시도",

  reviewSwap: "스왑 검토",
  swapFailed: "스왑 실패",
  processingSwap: "스왑 처리 중",
  reviewSwapDescription: "확정하기 전에 트랜잭션 내역을 검토하세요",
  processingSwapDescription: "스왑을 처리하는 동안 잠시만 기다려주세요",
  swapErrorFallback: "스왑을 완료할 수 없었습니다. 다시 시도해주세요.",
  approveAndSwap: "승인 및 스왑",
  approveAndBuy: "승인 및 구매",
  approveAndRedeem: "승인 및 상환",
  checking: "확인 중…",
  cancel: "취소",
  tryAgain: "다시 시도",
  close: "닫기",
  viewOnEtherscan: "Etherscan에서 보기",
  notEnoughEthSwap: (shortfall) =>
    `전체 스왑에 필요한 ETH가 부족합니다. 이 지갑에 ${shortfall}를 추가한 후 다시 시도해주세요.`,
  notEnoughEthSwapPurchase: (shortfall) =>
    `전체 스왑 + 구매에 필요한 ETH가 부족합니다. 이 지갑에 ${shortfall}를 추가한 후 다시 시도해주세요.`,
  notEnoughEthRedemption: (shortfall) =>
    `전체 스왑 + 상환에 필요한 ETH가 부족합니다. 이 지갑에 ${shortfall}를 추가한 후 다시 시도해주세요.`,
  insufficientGasError:
    "가스용 ETH가 부족합니다. 지갑에 ETH를 추가한 후 다시 시도해주세요.",
  insufficientGasErrorExplained:
    "네트워크 수수료를 지불할 ETH가 부족합니다. 이더리움의 네트워크 수수료(가스)는 ETH로만 지불할 수 있으며, USDC나 다른 토큰은 사용할 수 없습니다. 지갑에 ETH를 추가한 후 다시 시도해주세요.",
  smartAccountNotSupported: "스마트 계정은 지원되지 않습니다.",
  failedEstimateUsdg: "USDG 출력 추정에 실패했습니다",
  glowWorthIncreasedMessage:
    "GLW 구매만으로는 포인트가 적립되지 않습니다. GLW를 태양광 발전소에 위임하면 사용할 수 있는 포인트를 얻습니다.",
  transactionProgress: "트랜잭션 진행 상황",
  youPayLabel: "지불 금액",
  youReceiveLabel: "수령 금액",
  sentLabel: "송금됨",
  viaLabel: "경유",
  receivedLabel: "수령됨",

  stepRequestingGlowApproval: "GLOW 승인 요청",
  stepApprovingGlow: "GLOW 승인 중",
  stepSwappingGlowToUsdg: "GLOW를 USDG로 스왑",
  stepRequestingUsdgApproval: "USDG 승인 요청",
  stepApprovingUsdg: "USDG 승인 중",
  stepRedeemingUsdgForUsdc: "USDG를 USDC로 상환",
  stepSwapDoneToUsdg: "GLOW를 USDG로 스왑 완료",
  stepSwapDoneToUsdc: "GLOW를 USDC로 변환 완료",
  stepApprovingUsdgRedeem: "상환을 위해 USDG 승인 중",
  stepDoneRedeemed: "USDC 상환 완료",

  redeemUsdg: "USDG 상환",
  redeemDescription: "USDG를 1:1 비율로 USDC로 교환",
  youRedeem: "상환할 금액",
  exchangeRate: "환율",
  exchangeRateValue: "1 USDG = 1 USDC",
  processingRedemption: "상환 처리 중...",
  redeemedFromUsdg: "USDG에서 상환됨",
  fromLabel: "보내는 토큰",
  toLabel: "받는 토큰",
  usdgBalance: "USDG 잔액",
  usdcWallet: "USDC 지갑",
  amountRedeemed: "상환 금액",
  amountReceived: "수령 금액",
  exchangeRateOneToOne: "1:1",
};

const zh: SwapStrings = {
  youPay: "支付",
  youReceive: "获得",
  balance: "余额：",
  max: "最大",
  calculating: "计算中...",
  pricePerGlw: (price) => `每枚 GLW $${price}`,

  slippageTolerance: "滑点容差",
  slippageCurrent: "当前：",
  slippageCustom: "自定义",
  slippageHighWarning: "已启用高滑点",
  slippagePriceImpact: (pct) =>
    `预计价格影响约为 ${pct}%。滑点超过 5% 可能导致成交价格明显恶化。`,
  slippageHighEnabled: (pct) =>
    `已启用 ${pct}% 的高滑点。超过 5% 时，成交价格可能显著恶化。`,
  slippageAboveFive: "滑点超过 5% 可能导致兑换成交价格明显恶化。",
  slippageAriaLabel: "滑点容差",

  uniswapRoute: "Uniswap 路由",
  bondingCurve: "联合曲线",
  estimatedNetworkFee: "预计网络费用",

  processing: "处理中...",
  earlyLiquidityDisabled: "早期流动性已停用",
  reconnectWallet: "重新连接钱包",
  invalidSlippage: "请输入有效的滑点容差",
  enterAnAmount: "请输入金额",
  insufficientEthBalance: "ETH 余额不足",
  insufficientFunds: "余额不足",
  insufficientBalanceFor: (token) => `${token} 余额不足`,
  convertUsdcToUsdg: "将 USDC 兑换为 USDG",
  buy: "购买",
  swap: "兑换",

  toastHighSlippage: "已启用高滑点",
  toastHighSlippageBody: "滑点超过 5% 可能导致兑换成交价格明显恶化。",
  toastHasUsdg: "您拥有充足的 USDG",
  toastUseUsdgInstead: "是否改用 USDG？",
  toastYes: "是",
  toastNo: "否",
  toastInsufficientUsdc: "USDC 余额不足",

  transactionFailed: "交易失败",
  failedEstimateSwap: "无法估算兑换金额",
  failedComputeMaxEth: "无法计算最大 ETH 金额",
  quoteRefreshing: "报价正在更新，请查看最新报价。",

  placeholder0: "0.00",
  placeholderLoadingBalances: "正在加载余额…",
  placeholderSlippageExample: (value) => `例如 ${value}`,

  dialogTitle: "代币兑换",
  dialogUnableToLoad: "无法加载兑换数据，请重试。",
  dialogRetry: "重试",

  reviewSwap: "确认兑换",
  swapFailed: "兑换失败",
  processingSwap: "正在处理兑换",
  reviewSwapDescription: "请在确认前核对您的交易详情",
  processingSwapDescription: "请稍候，正在为您处理兑换",
  swapErrorFallback: "我们无法完成您的兑换，请重试。",
  approveAndSwap: "授权并兑换",
  approveAndBuy: "授权并购买",
  approveAndRedeem: "授权并赎回",
  checking: "检查中…",
  cancel: "取消",
  tryAgain: "重试",
  close: "关闭",
  viewOnEtherscan: "在 Etherscan 上查看",
  notEnoughEthSwap: (shortfall) =>
    `ETH 不足以完成整笔兑换。请向此钱包充入 ${shortfall} 后重试。`,
  notEnoughEthSwapPurchase: (shortfall) =>
    `ETH 不足以完成兑换与购买。请向此钱包充入 ${shortfall} 后重试。`,
  notEnoughEthRedemption: (shortfall) =>
    `ETH 不足以完成兑换与赎回。请向此钱包充入 ${shortfall} 后重试。`,
  insufficientGasError: "ETH 不足以支付 Gas。请向钱包充入更多 ETH 后重试。",
  insufficientGasErrorExplained:
    "ETH 不足以支付网络费用。以太坊上的网络费用（Gas）只能用 ETH 支付，无法使用 USDC 或其他代币。请向钱包充入一些 ETH 后重试。",
  smartAccountNotSupported: "暂不支持智能账户。",
  failedEstimateUsdg: "无法估算 USDG 输出金额",
  glowWorthIncreasedMessage:
    "购买 GLW 本身不会获得积分。将 GLW 委托给太阳能农场即可获得可使用的积分。",
  transactionProgress: "交易进度",
  youPayLabel: "支付",
  youReceiveLabel: "获得",
  sentLabel: "已发送",
  viaLabel: "途径",
  receivedLabel: "已收到",

  stepRequestingGlowApproval: "正在请求 GLOW 授权",
  stepApprovingGlow: "正在授权 GLOW",
  stepSwappingGlowToUsdg: "正在将 GLOW 兑换为 USDG",
  stepRequestingUsdgApproval: "正在请求 USDG 授权",
  stepApprovingUsdg: "正在授权 USDG",
  stepRedeemingUsdgForUsdc: "正在将 USDG 赎回为 USDC",
  stepSwapDoneToUsdg: "已成功将 GLOW 兑换为 USDG",
  stepSwapDoneToUsdc: "已成功将 GLOW 转换为 USDC",
  stepApprovingUsdgRedeem: "正在授权 USDG 以进行赎回",
  stepDoneRedeemed: "已成功赎回 USDC",

  redeemUsdg: "赎回 USDG",
  redeemDescription: "以 1:1 的比例将 USDG 兑换为 USDC",
  youRedeem: "赎回金额",
  exchangeRate: "兑换比率",
  exchangeRateValue: "1 USDG = 1 USDC",
  processingRedemption: "正在处理赎回...",
  redeemedFromUsdg: "已从 USDG 赎回",
  fromLabel: "从",
  toLabel: "至",
  usdgBalance: "USDG 余额",
  usdcWallet: "USDC 钱包",
  amountRedeemed: "赎回金额",
  amountReceived: "收到金额",
  exchangeRateOneToOne: "1:1",
};

export const swapTranslations: Record<Lang, SwapStrings> = {
  en,
  ko,
  zh,
};
