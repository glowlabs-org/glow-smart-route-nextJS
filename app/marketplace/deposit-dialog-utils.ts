/**
 * Pure utility functions extracted from deposit-dialog.tsx for testability.
 * These functions contain no side effects, no React hooks, no blockchain calls.
 */

import { formatUnits, parseUnits } from "viem";

// ============================================================================
// Types
// ============================================================================

export interface ActiveFraction {
  id: string;
  owner: string;
  step: string; // wei string (18 decimals for GLW)
  stepPrice: string; // wei string (6 decimals for USDC)
  totalSteps: number;
  remainingSteps: number | null;
  splitsSold?: number;
}

export interface ContractErrorConfig {
  message: string;
  shouldRefresh?: boolean;
}

export interface AffordabilityInput {
  activeFraction: ActiveFraction | null;
  quantity: number;
  selectedCurrency: "GLW" | "USDC";
  selectedPaymentMethod: "GLW" | "USDC" | "ETH";
  glwSpotPrice: number;
  ethSpotPrice: number;
  glwBalance: bigint;
  usdcBalance: bigint;
  ethBalance: bigint;
}

export interface AffordabilityResult {
  requiredByMethod: Record<"GLW" | "USDC" | "ETH", bigint | null>;
  balances: Record<"GLW" | "USDC" | "ETH", bigint>;
  hasEnoughByMethod: Record<"GLW" | "USDC" | "ETH", boolean>;
  canSubmit: boolean;
}

export interface TransactionStep {
  id: string;
  title: string;
  description: string;
  tokenFrom?: "ETH" | "USDC" | "USDG" | "GLW";
  tokenTo?: "ETH" | "USDC" | "USDG" | "GLW";
  status: "idle" | "waiting_signature" | "confirming" | "completed" | "error";
  startedAt?: number;
  txHash?: string;
  errorMessage?: string;
}

export interface LaunchpadRewardScore {
  userWeeklyGlwRewards: string;
  userWeeklyPdRewards: string;
}

export interface MiningCenterScore {
  miningScore: number;
  weeklyGlwRewards?: string;
  weeklyGlwRewardsUsd?: string;
}

export type RewardScore = LaunchpadRewardScore | MiningCenterScore;

export interface ImpactPointsBreakdown {
  emissionPoints: number;
  vaultBonusPoints: number;
  total: number;
}

// ============================================================================
// Contract Error Messages
// ============================================================================

export const CONTRACT_ERROR_MESSAGES: Record<string, ContractErrorConfig> = {
  InsufficientSharesAvailable: {
    message:
      "Not enough slots available. Someone else may have just purchased. Please refresh and try again.",
    shouldRefresh: true,
  },
  Expired: {
    message: "This offering has expired and is no longer accepting purchases.",
    shouldRefresh: true,
  },
  AlreadyClosed: {
    message: "This offering has been closed and is no longer available.",
    shouldRefresh: true,
  },
  ZeroSteps: {
    message: "Please select at least one unit to purchase.",
  },
  MinStepsToBuyCannotBeZero: {
    message: "Please select at least one unit to purchase.",
  },
  InsufficientBalance: {
    message: "Insufficient token balance. Please add funds to your wallet.",
  },
  AddressInsufficientBalance: {
    message: "Insufficient token balance. Please add funds to your wallet.",
  },
  SafeERC20FailedOperation: {
    message: "Token transfer failed. Please check your balance and try again.",
  },
  ReentrancyGuardReentrantCall: {
    message: "Transaction in progress. Please wait and try again.",
  },
  FailedInnerCall: {
    message: "Transaction failed. Please try again.",
  },
};

export const RPC_INTERNAL_ERROR_MESSAGE =
  "RPC/provider error. Please retry or switch RPC.";

// ============================================================================
// Error Handling Functions
// ============================================================================

export function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error && error.message) return error.message;
  const anyError = error as any;
  return (
    anyError?.cause?.message ||
    anyError?.cause?.data?.message ||
    anyError?.data?.message ||
    anyError?.error?.message ||
    anyError?.shortMessage ||
    anyError?.message ||
    "Unknown error"
  );
}

export function getErrorCode(error: unknown): number | undefined {
  const anyError = error as any;
  const code = anyError?.cause?.code ?? anyError?.code;
  return typeof code === "number" ? code : undefined;
}

export function isInternalRpcError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error);
  return (
    code === -32603 ||
    message.includes("internal error") ||
    message.includes("internalrpcerror") ||
    message.includes("could not coalesce") ||
    message.includes("missing or invalid parameters")
  );
}

export function findErrorInMessage(
  msg: string
): ContractErrorConfig | null {
  for (const [errorName, config] of Object.entries(CONTRACT_ERROR_MESSAGES)) {
    if (msg.includes(errorName)) {
      return config;
    }
  }
  return null;
}

export async function withInternalRpcRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 1;
  const delayMs = options.delayMs ?? 1500;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= maxRetries;
      if (isLastAttempt || !isInternalRpcError(error)) {
        throw error;
      }
      options.onRetry?.(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // TypeScript: unreachable, but satisfies return type
  throw new Error("Retry loop exited unexpectedly");
}

// ============================================================================
// Cost Calculation Functions
// ============================================================================

export function calculateCostInGLW(
  quantity: number,
  activeFraction: ActiveFraction | null
): number {
  if (!activeFraction) return 0;
  const step = parseFloat(formatUnits(BigInt(activeFraction.step), 18));
  return step * quantity;
}

export function calculateCostInUSDC(
  quantity: number,
  activeFraction: ActiveFraction | null,
  selectedCurrency: "GLW" | "USDC",
  glwSpotPrice: number
): number {
  if (!activeFraction) return 0;
  if (selectedCurrency === "USDC") {
    // Miner: direct stepPrice
    const stepPrice = parseFloat(
      formatUnits(BigInt(activeFraction.stepPrice), 6)
    );
    return stepPrice * quantity;
  } else {
    // Delegation (via swap): GLW cost * spot price
    const glwCost = calculateCostInGLW(quantity, activeFraction);
    return glwCost * (glwSpotPrice || 0);
  }
}

export function calculateCostInETH(
  quantity: number,
  activeFraction: ActiveFraction | null,
  selectedCurrency: "GLW" | "USDC",
  glwSpotPrice: number,
  ethSpotPrice: number
): number {
  const usdcCost = calculateCostInUSDC(
    quantity,
    activeFraction,
    selectedCurrency,
    glwSpotPrice
  );
  return ethSpotPrice > 0 ? usdcCost / ethSpotPrice : 0;
}

// ============================================================================
// Affordability Calculation
// ============================================================================

export function calculateAffordability(
  input: AffordabilityInput
): AffordabilityResult {
  const {
    activeFraction,
    quantity,
    selectedCurrency,
    selectedPaymentMethod,
    glwSpotPrice,
    ethSpotPrice,
    glwBalance,
    usdcBalance,
    ethBalance,
  } = input;

  const qty = BigInt(Math.max(0, Math.floor(quantity)));

  const balances = {
    GLW: glwBalance,
    USDC: usdcBalance,
    ETH: ethBalance,
  } as const;

  const requiredByMethod: Record<"GLW" | "USDC" | "ETH", bigint | null> = {
    GLW: null,
    USDC: null,
    ETH: null,
  };

  if (!activeFraction || qty <= 0n) {
    return {
      requiredByMethod,
      balances,
      hasEnoughByMethod: { GLW: false, USDC: false, ETH: false },
      canSubmit: false,
    };
  }

  // GLW required (delegate directly)
  requiredByMethod.GLW = BigInt(activeFraction.step) * qty;

  // USDC required:
  // - miners: pay stepPrice
  // - delegations (swap): buy GLW via USDC with a 5% buffer
  if (selectedCurrency === "USDC") {
    requiredByMethod.USDC = BigInt(activeFraction.stepPrice) * qty;
  } else {
    if (Number.isFinite(glwSpotPrice) && glwSpotPrice > 0) {
      const glwNeeded = BigInt(activeFraction.step) * qty; // 18 decimals
      const glwPrice = parseUnits(glwSpotPrice.toFixed(6), 6); // USDC price (6 decimals)
      const rawUsdcCost = (glwNeeded * glwPrice) / BigInt(1e18); // 6 decimals
      requiredByMethod.USDC = (rawUsdcCost * 105n) / 100n; // 5% buffer
    } else {
      requiredByMethod.USDC = null;
    }
  }

  // ETH required (approx): convert required USDC -> ETH with a small buffer.
  if (Number.isFinite(ethSpotPrice) && ethSpotPrice > 0) {
    const requiredUsdc =
      selectedCurrency === "USDC"
        ? BigInt(activeFraction.stepPrice) * qty
        : requiredByMethod.USDC;

    if (requiredUsdc != null) {
      const ethPrice = parseUnits(ethSpotPrice.toFixed(6), 6);
      if (ethPrice > 0n) {
        const requiredEth =
          (requiredUsdc * 10n ** 18n) / ethPrice; // 18 decimals
        const requiredEthWithBuffer = (requiredEth * 103n) / 100n; // +3% buffer
        requiredByMethod.ETH =
          requiredEthWithBuffer > 0n ? requiredEthWithBuffer : null;
      } else {
        requiredByMethod.ETH = null;
      }
    } else {
      requiredByMethod.ETH = null;
    }
  } else {
    requiredByMethod.ETH = null;
  }

  const hasEnoughByMethod: Record<"GLW" | "USDC" | "ETH", boolean> = {
    GLW: requiredByMethod.GLW != null && balances.GLW >= requiredByMethod.GLW,
    USDC:
      requiredByMethod.USDC != null && balances.USDC >= requiredByMethod.USDC,
    ETH: requiredByMethod.ETH != null && balances.ETH >= requiredByMethod.ETH,
  };

  const canSubmit = hasEnoughByMethod[selectedPaymentMethod];

  return { requiredByMethod, balances, hasEnoughByMethod, canSubmit };
}

// ============================================================================
// Transaction Steps Initialization
// ============================================================================

export function initializeTransactionSteps(
  selectedCurrency: "GLW" | "USDC",
  selectedPaymentMethod: "GLW" | "USDC" | "ETH"
): TransactionStep[] {
  const isSwapDelegate =
    selectedCurrency === "GLW" && selectedPaymentMethod !== "GLW";

  const steps: TransactionStep[] = [];

  if (selectedPaymentMethod === "ETH") {
    steps.push({
      id: "SWAP_ETH_TO_USDC",
      title: "Swap ETH → USDC",
      description: "Converting ETH to USDC via Uniswap",
      tokenFrom: "ETH",
      tokenTo: "USDC",
      status: "idle",
    });
  }

  if (isSwapDelegate) {
    steps.push({
      id: "SWAP_USDC_TO_USDG",
      title: "Swap USDC → USDG",
      description: "Converting USDC to USDG",
      tokenFrom: "USDC",
      tokenTo: "USDG",
      status: "idle",
    });
    steps.push({
      id: "SWAP_USDG_TO_GLOW",
      title: "Swap USDG → GLW",
      description: "Converting USDG to GLW via Uniswap",
      tokenFrom: "USDG",
      tokenTo: "GLW",
      status: "idle",
    });
    steps.push({
      id: "DELEGATE_GLW",
      title: "Delegate GLW",
      description: "Delegating GLW to the solar farm",
      tokenFrom: "GLW",
      status: "idle",
    });
  } else {
    steps.push({
      id: "BUY_FRACTIONS",
      title: selectedCurrency === "USDC" ? "Purchase Miners" : "Delegate GLW",
      description:
        selectedCurrency === "USDC"
          ? "Purchasing miner units"
          : "Delegating GLW to the solar farm",
      tokenFrom: selectedCurrency === "USDC" ? "USDC" : "GLW",
      status: "idle",
    });
  }

  steps.push({
    id: "CONFIRM_TX",
    title: "Confirm Transaction",
    description: "Waiting for blockchain confirmation",
    status: "idle",
  });

  return steps;
}

// ============================================================================
// Rewards Calculations
// ============================================================================

export function calculateEstimatedRewards(
  quantity: number,
  activeFraction: ActiveFraction | null,
  rewardScore: RewardScore | null
): number {
  if (!activeFraction || !rewardScore) return 0;

  let weeklyGlw = 0;
  const totalShares = activeFraction.totalSteps || 1; // avoid div 0

  if ("userWeeklyGlwRewards" in rewardScore) {
    // Launchpad
    const glw = parseFloat(
      formatUnits(BigInt(rewardScore.userWeeklyGlwRewards), 18)
    );
    const pd = parseFloat(
      formatUnits(BigInt(rewardScore.userWeeklyPdRewards), 18)
    );
    weeklyGlw = (glw + pd) / totalShares;
  } else if ("miningScore" in rewardScore) {
    // Mining
    if (rewardScore.weeklyGlwRewards) {
      weeklyGlw = parseFloat(
        formatUnits(BigInt(rewardScore.weeklyGlwRewards || "0"), 18)
      );
    }
  }

  return weeklyGlw * quantity;
}

export function calculateImpactPointsBreakdown(
  quantity: number,
  activeFraction: ActiveFraction | null,
  rewardScore: RewardScore | null,
  calculateCostInGLWFn: (qty: number) => number
): ImpactPointsBreakdown {
  if (!activeFraction || !rewardScore) {
    return { emissionPoints: 0, vaultBonusPoints: 0, total: 0 };
  }

  const totalShares = activeFraction.totalSteps || 1;

  if ("userWeeklyGlwRewards" in rewardScore) {
    // Launchpad (delegation) - earns both emission points and vault bonus
    const emissionGlw = parseFloat(
      formatUnits(BigInt(rewardScore.userWeeklyGlwRewards), 18)
    );
    const emissionPointsPerStep = emissionGlw / totalShares;
    const emissionPoints = emissionPointsPerStep * quantity;

    // Vault bonus: +0.005 points per week per GLW delegated
    const delegatedGlw = calculateCostInGLWFn(quantity);
    const vaultBonusPoints = delegatedGlw * 0.005;

    return {
      emissionPoints,
      vaultBonusPoints,
      total: emissionPoints + vaultBonusPoints,
    };
  } else if ("miningScore" in rewardScore) {
    // Mining Center - only emission points (no vault bonus)
    if (rewardScore.weeklyGlwRewards) {
      const emissionGlw = parseFloat(
        formatUnits(BigInt(rewardScore.weeklyGlwRewards), 18)
      );
      const emissionPoints = emissionGlw * quantity;
      return { emissionPoints, vaultBonusPoints: 0, total: emissionPoints };
    }
  }

  return { emissionPoints: 0, vaultBonusPoints: 0, total: 0 };
}

// ============================================================================
// Share URL Generation
// ============================================================================

const APP_DOMAIN_PLAIN_TEXT = "app.\u200Bglow.\u200Borg";

export function generateShareUrl(
  selectedCurrency: "GLW" | "USDC",
  quantity: number,
  farmLabelForShare: string | null,
  hasSuccessMetrics: boolean
): string | null {
  if (!farmLabelForShare) return null;
  if (!hasSuccessMetrics) return null;

  if (selectedCurrency === "USDC") {
    const text = [
      `I just bought ${quantity} miner${
        quantity > 1 ? "s" : ""
      } from ${farmLabelForShare} on @glowFND`,
      "",
      `Every miner I own earns me GLW weekly for the next 99 weeks.`,
      "",
      APP_DOMAIN_PLAIN_TEXT,
    ].join("\n");
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }

  const text = [
    `I just helped fund ${farmLabelForShare} by delegating GLW tokens.`,
    "",
    `You can do the same and start earning GLW weekly for 100 weeks here: ${APP_DOMAIN_PLAIN_TEXT}`,
  ].join("\n");

  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

// ============================================================================
// Quantity Handling
// ============================================================================

export function clampQuantity(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, value));
}

export function parseQuantityInput(
  value: string,
  currentQuantity: number,
  maxQuantity: number
): number {
  const num = parseInt(value, 10);
  if (!isNaN(num)) {
    return clampQuantity(num, 1, maxQuantity);
  }
  if (value === "") {
    return 1;
  }
  return currentQuantity;
}

// ============================================================================
// Success Metrics Calculation
// ============================================================================

export interface SuccessMetrics {
  totalSteps: number;
  filledBeforeSteps: number;
  userSteps: number;
}

export function calculateSuccessMetrics(
  activeFraction: ActiveFraction,
  quantity: number
): SuccessMetrics | null {
  try {
    const totalSteps = Math.max(
      0,
      Math.floor(activeFraction.totalSteps || 0)
    );
    let filledBeforeSteps = 0;

    if (totalSteps > 0) {
      if (activeFraction.remainingSteps != null) {
        filledBeforeSteps = Math.max(
          0,
          Math.min(
            totalSteps,
            totalSteps -
              Math.max(0, Math.floor(activeFraction.remainingSteps))
          )
        );
      } else {
        filledBeforeSteps = Math.max(
          0,
          Math.min(totalSteps, Math.floor(activeFraction.splitsSold || 0))
        );
      }
    }

    return {
      totalSteps,
      filledBeforeSteps,
      userSteps: Math.max(0, Math.floor(quantity)),
    };
  } catch {
    return null;
  }
}
