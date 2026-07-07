/**
 * Pure utility functions extracted from deposit-dialog.tsx for testability.
 * These functions contain no side effects, no React hooks, no blockchain calls.
 */

import { formatUnits, parseUnits } from "viem";
import { normalizeMinerWeeksRemainingDisplay } from "@/lib/mining-score";

export {
  getInitialPositionValueGuard,
  INITIAL_POSITION_USD_GRACE,
  MIN_INITIAL_POSITION_USD,
  type InitialPositionValueGuardInput,
  type InitialPositionValueGuardResult,
} from "@/lib/initial-position-guard";

// ============================================================================
// Types
// ============================================================================

export interface ActiveFraction {
  id: string;
  owner: string;
  step: string; // wei string (18 decimals for GLW)
  sgctlStepAtomic?: string | null; // atomic string (6 decimals for SGCTL/GCTL)
  stepPrice: string; // wei string (6 decimals for USDC)
  totalSteps: number;
  remainingSteps: number | null;
  splitsSold?: number;
  amountRaised?: string | null;
  totalAmountNeeded?: string | null;
  // Consolidated-launch-window shape: single 9 AM ET boundary + per-leg inventory.
  visibleAt?: string | null;
  glw?: { remainingSteps: number; stepWei: string } | null;
  sgctl?: {
    remainingUnits: number;
    /** Fixed sGCTL inventory (S) and units sold so far. Optional during the
     *  backend deploy gap; when present they drive a true capacity ring. */
    totalUnits?: number;
    soldUnits?: number;
    unitAtomic: string;
    splitBonusPercent: string | null;
  } | null;
  // @deprecated legacy phase fields (still emitted during the deploy gap).
  delegationAsset?: "GLW" | "SGCTL" | null;
  delegationPhase?: "hidden" | "sgctl" | "glw" | null;
}

export interface ApplicationPriceQuoteLike {
  prices?: Partial<Record<"GLW" | "GCTL" | "SGCTL" | "USDC" | "USDG", string>>;
}

export type DepositSelectedCurrency = "GLW" | "SGCTL" | "USDC";
export type DepositPaymentMethod =
  | "GLW"
  | "SGCTL"
  | "GCTL"
  | "USDC"
  | "ETH"
  | "UNCLAIMED_REWARDS";
export type DepositDialogMode =
  | "miners"
  | "glw_delegation"
  | "sgctl_delegation";
export type SgctlSourceMode =
  | "staked"
  | "wallet_gctl"
  | "mint_usdc"
  | "mint_eth";

export interface ContractErrorConfig {
  message: string;
  shouldRefresh?: boolean;
}

export interface AffordabilityInput {
  activeFraction: ActiveFraction | null;
  delegationStepAtomic?: bigint | null;
  quantity: number;
  selectedCurrency: DepositSelectedCurrency;
  selectedPaymentMethod: DepositPaymentMethod;
  glwSpotPrice: number;
  gctlSpotPrice?: number;
  ethSpotPrice: number;
  glwBalance: bigint;
  gctlBalance?: bigint;
  stakedGctlBalance?: bigint;
  usdcBalance: bigint;
  ethBalance: bigint;
  // Total GLW available across unclaimed inflation + PD-in-GLW weeks for the
  // connected wallet. Used by the "use unclaimed rewards" payment method on
  // GLW launchpad delegations. Defaults to 0n when omitted.
  unclaimedGlwBalance?: bigint;
}

export interface AffordabilityResult {
  requiredByMethod: Record<DepositPaymentMethod, bigint | null>;
  balances: Record<DepositPaymentMethod, bigint>;
  hasEnoughByMethod: Record<DepositPaymentMethod, boolean>;
  canSubmit: boolean;
}

export type BigintLike = bigint | string | number | null | undefined;
export interface WalletRegionStakeSnapshot {
  totalStaked?: BigintLike;
  totalStakedAndNotUsedInProtocolFees?: BigintLike;
  pendingUnstake?: BigintLike;
  pendingRestakeOut?: BigintLike;
}

export interface WalletRegionAvailableStakeSnapshot {
  availableStakedGctl?: BigintLike;
  totalStakedAndNotUsedInProtocolFees?: BigintLike;
  pendingUnstake?: BigintLike;
  pendingRestakeOut?: BigintLike;
  delegatedSgctlVaultBalance?: BigintLike;
  protocolDepositVaultBalance?: BigintLike;
}

export interface SgctlStepDerivationInput {
  glwStepAtomic: bigint;
  glwPriceMicros: bigint;
  gctlPriceMicros: bigint;
}

export interface TransactionStep {
  id: string;
  title: string;
  description: string;
  statusLabel?: string;
  tokenFrom?: "ETH" | "USDC" | "USDG" | "GLW";
  tokenTo?: "ETH" | "USDC" | "USDG" | "GLW";
  status: "idle" | "waiting_signature" | "confirming" | "completed" | "error";
  startedAt?: number;
  txHash?: string;
  errorMessage?: string;
}

export interface UpdateTransactionStepStatusExtras {
  txHash?: string;
  errorMessage?: string;
  deactivateStepIds?: string[];
  clearStartedAt?: boolean;
  now?: number;
}

export interface LaunchpadRewardScore {
  userWeeklyGlwRewards: string;
  userWeeklyPdRewards: string;
}

export interface MiningCenterScore {
  miningScore: number;
  weeklyGlwRewards?: string;
  weeklyGlwRewardsUsd?: string;
  weeksOfMinerLifeRemaining?: number;
}

export type RewardScore = LaunchpadRewardScore | MiningCenterScore;

export interface ImpactPointsBreakdown {
  emissionPoints: number;
  vaultBonusPoints: number;
  total: number;
}

export interface EstimatedRewardsBreakdown {
  glw: number;
  pd: number;
  pdSymbol: "GLW" | "SGCTL" | null;
  totalGlwEquivalent: number;
}

export interface ControlTransferStatusLike {
  status?: string | null;
  errorMessage?: string | null;
  errorDetails?: string | null;
}

function resolveLaunchpadRewardShareCountForDialog(
  activeFraction: ActiveFraction | null,
  selectedCurrency?: DepositSelectedCurrency | null
): number {
  if (!activeFraction) return 0;

  const baseTotalSteps = Number.isFinite(activeFraction.totalSteps)
    ? Math.max(0, Math.floor(activeFraction.totalSteps))
    : 0;
  const remainingSteps = Number.isFinite(activeFraction.remainingSteps ?? null)
    ? Math.max(0, Math.floor(activeFraction.remainingSteps ?? 0))
    : 0;

  // The sGCTL leg is unit-gated by sgctl.remainingUnits, NOT the GLW step
  // ledger. Returning the GLW remainingSteps/totalSteps here would show wrong
  // per-unit/remaining counts whenever the sGCTL unit count (S) differs from
  // the GLW unit count (G).
  if (
    selectedCurrency === "SGCTL" ||
    (selectedCurrency == null && activeFraction.delegationAsset === "SGCTL")
  ) {
    // New consolidated-window shape: read the sGCTL leg's unit inventory. During
    // the deploy gap (legacy listings with no `sgctl` leg object) fall back to
    // the step ledger so older fixtures/listings keep working.
    return activeFraction.sgctl &&
      Number.isFinite(activeFraction.sgctl.remainingUnits)
      ? Math.max(0, Math.floor(activeFraction.sgctl.remainingUnits))
      : remainingSteps > 0
      ? remainingSteps
      : baseTotalSteps;
  }

  return baseTotalSteps;
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
  ERC20InsufficientAllowance: {
    message:
      "Token approval is not visible yet. Please wait a moment and retry.",
  },
  ReentrancyGuardReentrantCall: {
    message: "Transaction in progress. Please wait and try again.",
  },
  FailedInnerCall: {
    message: "Transaction failed. Please try again.",
  },
  deadline_expired: {
    message: "Signature expired. Please try again.",
  },
  deadline_too_far: {
    message: "Signature deadline was invalid. Please refresh and try again.",
  },
  deadline_is_milliseconds: {
    message: "Signature deadline was invalid. Please refresh and try again.",
  },
  signer_mismatch: {
    message:
      "Signature does not match your connected wallet. Reconnect the correct wallet and try again.",
  },
  signature_failed: {
    message: "Signature verification failed. Please try signing again.",
  },
  "already used": {
    message:
      "This signature was already used. Please refresh and try again.",
    shouldRefresh: true,
  },
  "Nonce already used": {
    message:
      "This signature was already used. Please refresh and try again.",
    shouldRefresh: true,
  },
  "is not active (status=": {
    message: "This listing is no longer active. Please refresh and try again.",
    shouldRefresh: true,
  },
  "Delegation paymentDate is after fraction expiration": {
    message:
      "This SGCTL delegation window has expired. Please refresh and try again.",
    shouldRefresh: true,
  },
  "is not in SGCTL delegation phase at paymentDate": {
    message:
      "This listing is not currently in the SGCTL delegation window. Please refresh and try again.",
    shouldRefresh: true,
  },
  "Region mismatch for application": {
    message:
      "The selected region no longer matches this listing. Please refresh and try again.",
    shouldRefresh: true,
  },
  "Zone is not active": {
    message: "This region is not active right now. Please refresh and try again.",
    shouldRefresh: true,
  },
  "Application not found": {
    message: "This application is no longer available. Please refresh and try again.",
    shouldRefresh: true,
  },
  "Active launchpad fraction not found": {
    message: "This listing is no longer available. Please refresh and try again.",
    shouldRefresh: true,
  },
  "already committed on-chain for GLW delegation": {
    message:
      "This listing has already moved to committed GLW delegation. Please refresh before trying again.",
    shouldRefresh: true,
  },
};

export const RPC_INTERNAL_ERROR_MESSAGE =
  "RPC/provider error. Please retry or switch RPC.";
export const SWAP_VOLATILITY_ERROR_MESSAGE =
  "Swap failed because price/liquidity changed while processing. Please retry. If it keeps failing, try a smaller quantity.";
export const SPLIT_CONFIRMATION_DELAYED_MESSAGE =
  "Transaction submitted but confirmation is delayed. Please refresh before retrying.";

/**
 * Asset selection is now caller-driven, not phase-driven: the marketplace card
 * opens the dialog with the explicit leg the user chose (GLW / sGCTL / USDC).
 * The legacy `delegationAsset === "SGCTL"` auto-flip is gone — under the
 * consolidated launch window both legs are live simultaneously, so the leg is a
 * deliberate choice. The only inference left is the degenerate sGCTL-only
 * listing (no GLW leg), which still resolves to the sGCTL path.
 */
export function resolveDepositDialogMode(
  selectedCurrency: DepositSelectedCurrency,
  activeFraction: ActiveFraction | null
): DepositDialogMode {
  if (selectedCurrency === "USDC") return "miners";
  if (selectedCurrency === "SGCTL") return "sgctl_delegation";

  const hasGlwLeg = activeFraction?.glw != null;
  const hasSgctlLeg = activeFraction?.sgctl != null;
  if (hasGlwLeg || hasSgctlLeg) {
    // New shape present: GLW requested but the listing has only an sGCTL leg
    // (no GLW units) -> resolve to the sGCTL path so a GLW-defaulted entry point
    // still works. Otherwise honor the GLW request (both legs are live; the leg
    // is a deliberate caller choice).
    if (!hasGlwLeg && hasSgctlLeg) return "sgctl_delegation";
    return "glw_delegation";
  }

  // Legacy fallback (deploy gap: new leg objects not yet emitted).
  if (activeFraction?.delegationAsset === "SGCTL") return "sgctl_delegation";
  return "glw_delegation";
}

export function resolveRuntimeSelectedCurrency(
  selectedCurrency: DepositSelectedCurrency,
  activeFraction: ActiveFraction | null
): DepositSelectedCurrency {
  const mode = resolveDepositDialogMode(selectedCurrency, activeFraction);
  if (mode === "miners") return "USDC";
  if (mode === "sgctl_delegation") return "SGCTL";
  return "GLW";
}

export function requiresSmartAccountCheck(
  selectedCurrency: DepositSelectedCurrency
): boolean {
  return selectedCurrency !== "SGCTL";
}

export function getDefaultPaymentMethodForRuntimeCurrency(
  selectedCurrency: DepositSelectedCurrency
): DepositPaymentMethod {
  if (selectedCurrency === "SGCTL") return "GCTL";
  if (selectedCurrency === "GLW") return "GLW";
  return "USDC";
}

export function hasConfirmedSplitPurchase(
  initialPurchased: number,
  currentPurchased: number,
  expectedAdditionalSteps: number
): boolean {
  const safeInitial = Number.isFinite(initialPurchased)
    ? Math.max(0, Math.floor(initialPurchased))
    : 0;
  const safeCurrent = Number.isFinite(currentPurchased)
    ? Math.max(0, Math.floor(currentPurchased))
    : 0;
  const safeExpected = Number.isFinite(expectedAdditionalSteps)
    ? Math.max(1, Math.floor(expectedAdditionalSteps))
    : 1;

  return safeCurrent >= safeInitial + safeExpected;
}

// ============================================================================
// Error Handling Functions
// ============================================================================

export function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error && error.message) return error.message;
  const anyError = error as any;
  return (
    anyError?.cause?.data?.errorName ||
    anyError?.data?.errorName ||
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

export function isRetriableStakeSyncRefreshError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    error instanceof TypeError ||
    isInternalRpcError(error) ||
    message.includes("transfer not found") ||
    message.includes("not found") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load resource") ||
    message.includes("econnrefused") ||
    message.includes("err_connection_refused") ||
    message.includes("fetch")
  );
}

export function isDelayedSplitConfirmationErrorMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("transaction submitted") &&
    normalizedMessage.includes("confirmation is delayed")
  );
}

export function extractControlTransferTrackingId(result: unknown): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;

  const anyResult = result as Record<string, unknown>;
  const candidate =
    anyResult.txHash ??
    anyResult.transferId ??
    anyResult.operationId ??
    anyResult.id ??
    null;

  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

export async function pollControlTransferConfirmation(
  params: {
    poll: () => Promise<ControlTransferStatusLike>;
    maxAttempts?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<ControlTransferStatusLike> {
  const maxAttempts = params.maxAttempts ?? 24;
  const delayMs = params.delayMs ?? 5_000;
  const sleep =
    params.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let sawTransferRecord = false;
  let lastRetriableError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const transfer = await params.poll();
      const status = String(transfer.status ?? "").toLowerCase();

      sawTransferRecord = true;

      if (status === "confirmed") {
        return transfer;
      }

      if (status === "failed") {
        throw new Error(
          transfer.errorMessage ||
            transfer.errorDetails ||
            "Control transfer failed"
        );
      }
    } catch (error) {
      if (!isRetriableStakeSyncRefreshError(error)) {
        throw error;
      }
      lastRetriableError = error;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  if (!sawTransferRecord && lastRetriableError) {
    throw new Error(
      "Unable to verify your Control transfer right now. Please wait a few seconds and retry."
    );
  }

  throw new Error(
    "Your stake transfer is still confirming in Control. Please wait a moment and retry."
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

export function getSwapVolatilityErrorMessage(
  rawMsg: string,
  failedStepId?: string
): string | null {
  if (failedStepId !== "SWAP_USDG_TO_GLOW") return null;

  const normalized = rawMsg.toLowerCase();
  const volatilityIndicators = [
    "slippage",
    "liquidity",
    "failed to swap",
    "failed to get amount out",
    "get amount out",
    "insufficient output amount",
    "amountoutmin",
    "revert",
  ];

  return volatilityIndicators.some((indicator) =>
    normalized.includes(indicator)
  )
    ? SWAP_VOLATILITY_ERROR_MESSAGE
    : null;
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

// GLW and GCTL step costs are identical apart from token decimals; this is the
// shared core. Keep calculateCostInGLW / calculateCostInGCTL as thin wrappers so
// callers and tests are unaffected.
function calculateStepCost(
  quantity: number,
  activeFraction: ActiveFraction | null,
  decimals: number,
  delegationStepAtomic?: bigint | null
): number {
  if (!activeFraction) return 0;
  const fallbackStep = (() => {
    try {
      return BigInt(activeFraction.step);
    } catch {
      return 0n;
    }
  })();
  const stepAtomic = delegationStepAtomic ?? fallbackStep;
  const step = parseFloat(formatUnits(stepAtomic, decimals));
  return step * quantity;
}

export function calculateCostInGLW(
  quantity: number,
  activeFraction: ActiveFraction | null,
  delegationStepAtomic?: bigint | null
): number {
  return calculateStepCost(quantity, activeFraction, 18, delegationStepAtomic);
}

export function calculateCostInGCTL(
  quantity: number,
  activeFraction: ActiveFraction | null,
  delegationStepAtomic?: bigint | null
): number {
  return calculateStepCost(quantity, activeFraction, 6, delegationStepAtomic);
}

export function calculateCostInUSDC(
  quantity: number,
  activeFraction: ActiveFraction | null,
  selectedCurrency: DepositSelectedCurrency,
  glwSpotPrice: number,
  gctlSpotPrice?: number,
  delegationStepAtomic?: bigint | null
): number {
  if (!activeFraction) return 0;
  if (selectedCurrency === "USDC") {
    // Miner: direct stepPrice
    const stepPrice = parseFloat(
      formatUnits(BigInt(activeFraction.stepPrice), 6)
    );
    return stepPrice * quantity;
  }

  if (selectedCurrency === "SGCTL") {
    const gctlCost = calculateCostInGCTL(
      quantity,
      activeFraction,
      delegationStepAtomic
    );
    return gctlCost * (gctlSpotPrice || 0);
  }

  // Delegation (via swap): GLW cost * spot price
  const glwCost = calculateCostInGLW(
    quantity,
    activeFraction,
    delegationStepAtomic
  );
  return glwCost * (glwSpotPrice || 0);
}

export function calculateCostInETH(
  quantity: number,
  activeFraction: ActiveFraction | null,
  selectedCurrency: DepositSelectedCurrency,
  glwSpotPrice: number,
  ethSpotPrice: number,
  gctlSpotPrice?: number,
  delegationStepAtomic?: bigint | null
): number {
  const usdcCost = calculateCostInUSDC(
    quantity,
    activeFraction,
    selectedCurrency,
    glwSpotPrice,
    gctlSpotPrice,
    delegationStepAtomic
  );
  return ethSpotPrice > 0 ? usdcCost / ethSpotPrice : 0;
}

// ============================================================================
// Affordability Calculation
// ============================================================================

export function coerceToBigInt(value: BigintLike): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0n;
    try {
      return BigInt(trimmed);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export function calculateAvailableStakedGctl(
  snapshot?: WalletRegionStakeSnapshot | null
): bigint {
  if (!snapshot) return 0n;

  if (snapshot.totalStakedAndNotUsedInProtocolFees != null) {
    return coerceToBigInt(snapshot.totalStakedAndNotUsedInProtocolFees);
  }

  const totalStaked = coerceToBigInt(snapshot.totalStaked);
  const pendingUnstake = coerceToBigInt(snapshot.pendingUnstake);
  const pendingRestakeOut = coerceToBigInt(snapshot.pendingRestakeOut);
  const unavailable = pendingUnstake + pendingRestakeOut;

  return totalStaked > unavailable ? totalStaked - unavailable : 0n;
}

export function parseAvailableStakeSnapshot(
  payload: WalletRegionAvailableStakeSnapshot | null | undefined
): {
  availableStakedGctl: bigint;
  totalStakedAndNotUsedInProtocolFees: bigint;
  pendingUnstake: bigint;
  pendingRestakeOut: bigint;
  delegatedSgctlVaultBalance: bigint;
  protocolDepositVaultBalance: bigint;
} {
  const snapshot = (payload ?? {}) as WalletRegionAvailableStakeSnapshot;

  return {
    availableStakedGctl: coerceToBigInt(snapshot.availableStakedGctl),
    totalStakedAndNotUsedInProtocolFees: coerceToBigInt(
      snapshot.totalStakedAndNotUsedInProtocolFees
    ),
    pendingUnstake: coerceToBigInt(snapshot.pendingUnstake),
    pendingRestakeOut: coerceToBigInt(snapshot.pendingRestakeOut),
    delegatedSgctlVaultBalance: coerceToBigInt(
      snapshot.delegatedSgctlVaultBalance
    ),
    protocolDepositVaultBalance: coerceToBigInt(
      snapshot.protocolDepositVaultBalance
    ),
  };
}

export function calculateSgctlStepAtomicFromGlwStep(
  input: SgctlStepDerivationInput
): bigint | null {
  const { glwStepAtomic, glwPriceMicros, gctlPriceMicros } = input;
  if (glwStepAtomic <= 0n || glwPriceMicros <= 0n || gctlPriceMicros <= 0n) {
    return null;
  }

  const glwBase = 10n ** 18n;
  const microUsdBase = 10n ** 6n;
  const usdMicrosPerStep = (glwStepAtomic * glwPriceMicros) / glwBase;
  if (usdMicrosPerStep <= 0n) return null;

  const sgctlStepAtomic = (usdMicrosPerStep * microUsdBase) / gctlPriceMicros;
  return sgctlStepAtomic > 0n ? sgctlStepAtomic : null;
}

export function resolveDelegationStepAtomic(params: {
  activeFraction: ActiveFraction | null | undefined;
  selectedCurrency: DepositSelectedCurrency;
  applicationPriceQuotes?: ApplicationPriceQuoteLike[] | null;
}): bigint | null {
  const { activeFraction, selectedCurrency, applicationPriceQuotes } = params;
  if (!activeFraction || selectedCurrency === "USDC") return null;

  if (selectedCurrency === "SGCTL") {
    const lockedSgctlStepAtomic = (() => {
      try {
        return activeFraction.sgctlStepAtomic != null
          ? BigInt(activeFraction.sgctlStepAtomic)
          : null;
      } catch {
        return null;
      }
    })();
    if (lockedSgctlStepAtomic != null && lockedSgctlStepAtomic > 0n) {
      return lockedSgctlStepAtomic;
    }
  }

  const glwStepAtomic = (() => {
    try {
      return BigInt(activeFraction.step);
    } catch {
      return null;
    }
  })();

  if (glwStepAtomic == null || glwStepAtomic <= 0n) return null;
  if (selectedCurrency === "GLW") return glwStepAtomic;

  const totalSteps = BigInt(Math.max(0, Math.floor(activeFraction.totalSteps)));
  const exactTotalAmountNeeded = (() => {
    try {
      return activeFraction.totalAmountNeeded != null
        ? BigInt(activeFraction.totalAmountNeeded)
        : null;
    } catch {
      return null;
    }
  })();

  if (
    totalSteps > 0n &&
    exactTotalAmountNeeded != null &&
    exactTotalAmountNeeded > 0n &&
    exactTotalAmountNeeded % totalSteps === 0n
  ) {
    const exactStepAtomic = exactTotalAmountNeeded / totalSteps;
    if (exactStepAtomic > 0n && exactStepAtomic < 1_000_000_000_000n) {
      return exactStepAtomic;
    }
  }

  const latestQuote = applicationPriceQuotes?.[0];
  const glwPriceRaw = latestQuote?.prices?.GLW;
  const gctlPriceRaw = latestQuote?.prices?.GCTL;
  if (!glwPriceRaw || !gctlPriceRaw) return null;

  try {
    return calculateSgctlStepAtomicFromGlwStep({
      glwStepAtomic,
      glwPriceMicros: BigInt(glwPriceRaw),
      gctlPriceMicros: BigInt(gctlPriceRaw),
    });
  } catch {
    return null;
  }
}

export function calculateShortfall(
  required: bigint | null,
  balance: BigintLike
): bigint {
  if (required == null) return 0n;
  const safeBalance = coerceToBigInt(balance);
  return safeBalance >= required ? 0n : required - safeBalance;
}

export function calculateAffordability(
  input: AffordabilityInput
): AffordabilityResult {
  const {
    activeFraction,
    delegationStepAtomic,
    quantity,
    selectedCurrency,
    selectedPaymentMethod,
    glwSpotPrice,
    gctlSpotPrice = 0,
    ethSpotPrice,
    glwBalance,
    gctlBalance = 0n,
    stakedGctlBalance = 0n,
    usdcBalance,
    ethBalance,
    unclaimedGlwBalance = 0n,
  } = input;

  const qty = BigInt(Math.max(0, Math.floor(quantity)));
  const fallbackDelegationStepAtomic = (() => {
    if (!activeFraction) return 0n;
    try {
      return BigInt(activeFraction.step);
    } catch {
      return 0n;
    }
  })();
  const fallbackSgctlStepAtomic =
    fallbackDelegationStepAtomic > 0n && fallbackDelegationStepAtomic < 10n ** 15n
      ? fallbackDelegationStepAtomic
      : null;
  const resolvedDelegationStepAtomic =
    delegationStepAtomic ??
    (selectedCurrency === "SGCTL"
      ? fallbackSgctlStepAtomic ?? 0n
      : fallbackDelegationStepAtomic);

  const balances = {
    GLW: glwBalance,
    SGCTL: stakedGctlBalance,
    GCTL: gctlBalance + stakedGctlBalance,
    USDC: usdcBalance,
    ETH: ethBalance,
    UNCLAIMED_REWARDS: unclaimedGlwBalance,
  } as const;

  const requiredByMethod: Record<DepositPaymentMethod, bigint | null> = {
    GLW: null,
    SGCTL: null,
    GCTL: null,
    USDC: null,
    ETH: null,
    UNCLAIMED_REWARDS: null,
  };

  if (!activeFraction || qty <= 0n) {
    return {
      requiredByMethod,
      balances,
      hasEnoughByMethod: {
        GLW: false,
        SGCTL: false,
        GCTL: false,
        USDC: false,
        ETH: false,
        UNCLAIMED_REWARDS: false,
      },
      canSubmit: false,
    };
  }

  // GLW required (delegate directly)
  if (selectedCurrency === "GLW") {
    requiredByMethod.GLW = resolvedDelegationStepAtomic * qty;
    // Unclaimed-rewards payment delivers GLW into the same delegate call, so
    // the GLW requirement is identical.
    requiredByMethod.UNCLAIMED_REWARDS = requiredByMethod.GLW;
  }

  const gctlNeeded =
    selectedCurrency === "SGCTL" ? resolvedDelegationStepAtomic * qty : 0n;
  const gctlShortfall =
    selectedCurrency === "SGCTL"
      ? gctlNeeded > stakedGctlBalance
        ? gctlNeeded - stakedGctlBalance
        : 0n
      : 0n;

  if (selectedCurrency === "SGCTL") {
    requiredByMethod.SGCTL = gctlNeeded;
    requiredByMethod.GCTL = gctlNeeded;
  }

  // USDC required:
  // - miners: pay stepPrice
  // - GLW delegations (swap): buy GLW via USDC with a 2% buffer
  // - SGCTL delegations (mint+stake): buy GCTL via USDC with a 2% buffer
  if (selectedCurrency === "USDC") {
    requiredByMethod.USDC = BigInt(activeFraction.stepPrice) * qty;
  } else if (selectedCurrency === "SGCTL") {
    if (Number.isFinite(gctlSpotPrice) && gctlSpotPrice > 0) {
      const gctlPrice = parseUnits(gctlSpotPrice.toFixed(6), 6); // 6 decimals
      const rawUsdcCost = (gctlShortfall * gctlPrice) / BigInt(1e6); // 6 decimals
      requiredByMethod.USDC = (rawUsdcCost * 102n) / 100n; // 2% buffer
    } else {
      requiredByMethod.USDC = null;
    }
  } else {
    if (Number.isFinite(glwSpotPrice) && glwSpotPrice > 0) {
      const glwNeeded = resolvedDelegationStepAtomic * qty; // 18 decimals
      const glwPrice = parseUnits(glwSpotPrice.toFixed(6), 6); // USDC price (6 decimals)
      const rawUsdcCost = (glwNeeded * glwPrice) / BigInt(1e18); // 6 decimals
      requiredByMethod.USDC = (rawUsdcCost * 102n) / 100n; // 2% buffer
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

  const hasEnoughByMethod: Record<DepositPaymentMethod, boolean> = {
    GLW: requiredByMethod.GLW != null && balances.GLW >= requiredByMethod.GLW,
    SGCTL:
      requiredByMethod.SGCTL != null &&
      balances.SGCTL >= requiredByMethod.SGCTL,
    GCTL:
      requiredByMethod.GCTL != null && balances.GCTL >= requiredByMethod.GCTL,
    USDC:
      requiredByMethod.USDC != null && balances.USDC >= requiredByMethod.USDC,
    ETH: requiredByMethod.ETH != null && balances.ETH >= requiredByMethod.ETH,
    UNCLAIMED_REWARDS:
      requiredByMethod.UNCLAIMED_REWARDS != null &&
      balances.UNCLAIMED_REWARDS >= requiredByMethod.UNCLAIMED_REWARDS,
  };

  const canSubmit = hasEnoughByMethod[selectedPaymentMethod];

  return { requiredByMethod, balances, hasEnoughByMethod, canSubmit };
}

// ============================================================================
// Transaction Steps Initialization
// ============================================================================

export function initializeTransactionSteps(
  selectedCurrency: DepositSelectedCurrency,
  selectedPaymentMethod: DepositPaymentMethod,
  options?: { sgctlSource?: SgctlSourceMode }
): TransactionStep[] {
  // Paying with unclaimed GLW rewards is NOT a swap: the reward GLW is claimed
  // then delegated (execution uses the BUY_FRACTIONS/DELEGATE_GLW path, see
  // useDepositConfirm's isSwapDelegate). Excluding it here keeps the displayed
  // steps in sync with execution; otherwise the dialog showed USDC->USDG->GLW
  // swap steps for the "use unclaimed rewards" option.
  const isSwapDelegate =
    selectedCurrency === "GLW" &&
    selectedPaymentMethod !== "GLW" &&
    selectedPaymentMethod !== "UNCLAIMED_REWARDS";

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

  if (selectedCurrency === "SGCTL") {
    const sgctlSource =
      options?.sgctlSource ??
      (selectedPaymentMethod === "ETH"
        ? "mint_eth"
        : selectedPaymentMethod === "USDC"
        ? "mint_usdc"
        : selectedPaymentMethod === "SGCTL"
        ? "staked"
        : "wallet_gctl");

    if (sgctlSource === "mint_usdc" || sgctlSource === "mint_eth") {
      steps.push({
        id: "MINT_AND_STAKE_GCTL",
        title: "Buy and stake GCTL",
        description: "Turning your funds into staked GCTL for this region",
        tokenFrom: "USDC",
        tokenTo: undefined,
        status: "idle",
      });
    }

    if (sgctlSource === "wallet_gctl") {
      steps.push({
        id: "STAKE_GCTL",
        title: "Stake your GCTL",
        description: "Moving your GCTL into the selected region",
        status: "idle",
      });
    }

    if (sgctlSource !== "staked") {
      steps.push({
        id: "INDEX_STAKE",
        title: "Update balance",
        description: "Checking that your newly staked balance is ready to use",
        statusLabel: "Updating your balance...",
        status: "idle",
      });
    }

    steps.push({
      id: "DELEGATE_SGCTL",
      title: "Reserve your delegation",
      description: "Submitting your SGCTL delegation for this farm",
      status: "idle",
    });
    steps.push({
      id: "CONFIRM_TX",
      title: "Finish up",
      description: "Confirming your delegation",
      status: "idle",
    });

    return steps;
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
    title: "Finish up",
    description: "Confirming your transaction",
    status: "idle",
  });

  return steps;
}

export function updateTransactionStepStatus(
  steps: TransactionStep[],
  stepId: string,
  status: TransactionStep["status"],
  extras?: UpdateTransactionStepStatusExtras
): TransactionStep[] {
  const now = extras?.now ?? Date.now();
  const deactivateStepIds = new Set(extras?.deactivateStepIds ?? []);
  const shouldActivate =
    status === "waiting_signature" || status === "confirming";

  return steps.map((step) => {
    if (deactivateStepIds.has(step.id) && step.id !== stepId) {
      return {
        ...step,
        status: "idle",
        startedAt: undefined,
        errorMessage: undefined,
      };
    }

    if (step.id !== stepId) return step;

    return {
      ...step,
      status,
      startedAt: shouldActivate
        ? step.startedAt ?? now
        : extras?.clearStartedAt
        ? undefined
        : step.startedAt,
      txHash: extras?.txHash ?? step.txHash,
      errorMessage:
        extras?.errorMessage !== undefined
          ? extras.errorMessage
          : status === "error"
          ? step.errorMessage
          : undefined,
    };
  });
}

// ============================================================================
// Rewards Calculations
// ============================================================================

export function calculateEstimatedRewards(
  quantity: number,
  activeFraction: ActiveFraction | null,
  rewardScore: RewardScore | null
): number {
  return calculateEstimatedRewardsBreakdown(
    quantity,
    activeFraction,
    rewardScore
  ).totalGlwEquivalent;
}

export function calculateEstimatedRewardsBreakdown(
  quantity: number,
  activeFraction: ActiveFraction | null,
  rewardScore: RewardScore | null,
  selectedCurrency?: DepositSelectedCurrency | null,
  totalSharesOverride?: number | null
): EstimatedRewardsBreakdown {
  if (!activeFraction || !rewardScore) {
    return { glw: 0, pd: 0, pdSymbol: null, totalGlwEquivalent: 0 };
  }
  let weeklyGlw = 0;
  let weeklyPd = 0;
  let pdSymbol: "GLW" | "SGCTL" | null = null;
  const totalShares =
    (totalSharesOverride != null && totalSharesOverride > 0
      ? totalSharesOverride
      : resolveLaunchpadRewardShareCountForDialog(
          activeFraction,
          selectedCurrency
        )) || 1; // avoid div 0

  if ("userWeeklyGlwRewards" in rewardScore) {
    // Launchpad
    const glw = parseFloat(
      formatUnits(BigInt(rewardScore.userWeeklyGlwRewards), 18)
    );
    const pdIsSgctl =
      selectedCurrency === "SGCTL" ||
      (selectedCurrency == null && activeFraction?.delegationAsset === "SGCTL");
    const pdDecimals = pdIsSgctl ? 6 : 18;
    const pd = parseFloat(
      formatUnits(BigInt(rewardScore.userWeeklyPdRewards), pdDecimals)
    );
    weeklyGlw = glw / totalShares;
    weeklyPd = pd / totalShares;
    pdSymbol = pdIsSgctl ? "SGCTL" : "GLW";
  } else if ("miningScore" in rewardScore) {
    // Mining
    if (rewardScore.weeklyGlwRewards) {
      weeklyGlw = parseFloat(
        formatUnits(BigInt(rewardScore.weeklyGlwRewards || "0"), 18)
      );
    }
  }
  const glwAmount = weeklyGlw * quantity;
  const pdAmount = weeklyPd * quantity;
  const totalGlwEquivalent =
    glwAmount + (pdSymbol === "GLW" ? pdAmount : 0);

  return {
    glw: glwAmount,
    pd: pdAmount,
    pdSymbol,
    totalGlwEquivalent,
  };
}

export function calculateImpactPointsBreakdown(
  quantity: number,
  activeFraction: ActiveFraction | null,
  rewardScore: RewardScore | null,
  calculateCostInGLWFn: (qty: number) => number,
  options?: {
    includeVaultBonus?: boolean;
    selectedCurrency?: DepositSelectedCurrency | null;
    totalSharesOverride?: number | null;
  }
): ImpactPointsBreakdown {
  if (!activeFraction || !rewardScore) {
    return { emissionPoints: 0, vaultBonusPoints: 0, total: 0 };
  }

  const includeVaultBonus = options?.includeVaultBonus ?? true;
  const totalShares =
    (options?.totalSharesOverride != null && options.totalSharesOverride > 0
      ? options.totalSharesOverride
      : resolveLaunchpadRewardShareCountForDialog(
          activeFraction,
          options?.selectedCurrency
        )) || 1;

  if ("userWeeklyGlwRewards" in rewardScore) {
    // Launchpad (delegation) - earns both emission points and vault bonus
    const emissionGlw = parseFloat(
      formatUnits(BigInt(rewardScore.userWeeklyGlwRewards), 18)
    );
    const emissionPointsPerStep = emissionGlw / totalShares;
    const emissionPoints = emissionPointsPerStep * quantity;

    // Vault bonus: +0.005 points per week per GLW delegated
    const vaultBonusPoints = includeVaultBonus
      ? calculateCostInGLWFn(quantity) * 0.005
      : 0;

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
  selectedCurrency: DepositSelectedCurrency,
  quantity: number,
  farmLabelForShare: string | null,
  hasSuccessMetrics: boolean,
  weeksOfMinerLifeRemaining?: number | null
): string | null {
  if (!farmLabelForShare) return null;
  if (!hasSuccessMetrics) return null;

  if (selectedCurrency === "USDC") {
    const weeksLeft =
      normalizeMinerWeeksRemainingDisplay(weeksOfMinerLifeRemaining) ?? 99;
    const text = [
      `I just bought ${quantity} miner${
        quantity > 1 ? "s" : ""
      } from ${farmLabelForShare} on @glowFND`,
      "",
      `Every miner I own earns me GLW weekly for the next ${weeksLeft} weeks.`,
      "",
      APP_DOMAIN_PLAIN_TEXT,
    ].join("\n");
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }

  const delegatedAsset = selectedCurrency === "SGCTL" ? "SGCTL" : "GLW";
  const text = [
    `I just helped fund ${farmLabelForShare} by delegating ${delegatedAsset} tokens.`,
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
  quantity: number,
  selectedCurrency?: DepositSelectedCurrency | null,
  // Optional: the wallet's CUMULATIVE units in the current leg (GLW steps or
  // sGCTL units) AFTER this transaction, sourced from the refreshed
  // splits-by-wallet summary. When provided, the ring highlights the wallet's
  // whole participation instead of just this transaction's slice, keeping the
  // total fill (filledBeforeSteps + userSteps) unchanged. When omitted, the
  // legacy this-tx-only behavior is preserved.
  userCumulativeStepsInLeg?: number
): SuccessMetrics | null {
  try {
    const userSteps = Math.max(0, Math.floor(quantity));

    // Re-slice a default metrics result so `userSteps` reflects the wallet's
    // cumulative units in the leg while the overall fill stays constant. The
    // fraction passed in is the fresh post-transaction snapshot, so
    // filledBeforeSteps already reflects the current total sold (including this
    // tx); the cumulative slice is carved OUT of that total, not added on top.
    const applyCumulative = (metrics: SuccessMetrics): SuccessMetrics => {
      if (
        userCumulativeStepsInLeg == null ||
        !Number.isFinite(userCumulativeStepsInLeg)
      ) {
        return metrics;
      }
      // Fresh post-transaction snapshot: filledBeforeSteps already reflects the
      // current total sold; userSteps (the cumulative slice) is carved out of
      // that total, not added on top.
      const filledAfter = metrics.filledBeforeSteps;
      const cumulative = Math.max(0, Math.floor(userCumulativeStepsInLeg));
      const cappedUserSteps = Math.min(metrics.totalSteps, cumulative);
      const filledBeforeSteps = Math.max(
        0,
        Math.min(metrics.totalSteps, filledAfter - cappedUserSteps)
      );
      return {
        totalSteps: metrics.totalSteps,
        filledBeforeSteps,
        userSteps: cappedUserSteps,
      };
    };

    const isSgctlLeg =
      (selectedCurrency === "SGCTL" ||
        (selectedCurrency == null &&
          activeFraction.delegationAsset === "SGCTL")) &&
      activeFraction.sgctl != null &&
      Number.isFinite(activeFraction.sgctl.remainingUnits);
    if (isSgctlLeg) {
      const sgctl = activeFraction.sgctl!;
      // Preferred: a TRUE capacity ring (sold/total). The success modal snapshots
      // the PRE-purchase fraction, so soldUnits is the count filled before this
      // purchase and totalUnits is the fixed sGCTL inventory S. The user's slice
      // (userSteps) is added on top at the call site.
      const totalUnits =
        sgctl.totalUnits != null && Number.isFinite(sgctl.totalUnits)
          ? Math.max(0, Math.floor(sgctl.totalUnits))
          : null;
      const soldUnits =
        sgctl.soldUnits != null && Number.isFinite(sgctl.soldUnits)
          ? Math.max(0, Math.floor(sgctl.soldUnits))
          : null;
      if (totalUnits != null && totalUnits > 0 && soldUnits != null) {
        return applyCumulative({
          totalSteps: totalUnits,
          filledBeforeSteps: Math.min(totalUnits, soldUnits),
          userSteps,
        });
      }
      // Fallback (older payloads exposing only remainingUnits, no total/sold):
      // the user buys FROM the units that were available, so the ring is their
      // contribution out of remainingUnits. total = remainingUnits (NOT
      // remaining + userSteps, which double-counts the purchase and wrongly
      // shows "N left" after buying all N). Math.max guards userSteps > remaining.
      const remainingUnits = Math.max(0, Math.floor(sgctl.remainingUnits));
      return applyCumulative({
        totalSteps: Math.max(remainingUnits, userSteps),
        filledBeforeSteps: 0,
        userSteps,
      });
    }

    const totalSteps = resolveLaunchpadRewardShareCountForDialog(
      activeFraction,
      selectedCurrency
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

    return applyCumulative({
      totalSteps,
      filledBeforeSteps,
      userSteps,
    });
  } catch {
    return null;
  }
}

// ============================================================================
// Early-claim selection (claim-and-delegate flow)
// ============================================================================

export type ClaimableGlwSource = "glowInflation" | "protocolDeposit";

export interface ClaimableGlwItem {
  week: number;
  source: ClaimableGlwSource;
  glwAmountWei: bigint;
}

export interface ClaimSetSelection {
  pdWeeks: ClaimableGlwItem[];
  inflationWeeks: ClaimableGlwItem[];
  totalGlwWei: bigint;
  shortfallGlwWei: bigint;
  txCount: number;
}

// Brute-force subset search is O(2^n * n). 2^20 = ~1M masks finishes in tens of
// ms on modern hardware. Beyond that we fall back to greedy.
const CLAIM_SET_BRUTE_FORCE_THRESHOLD = 20;

/**
 * Picks unclaimed weeks to fund a GLW delegation in the early-claim window.
 * PD-in-GLW weeks first (one multicall, free to add), then inflation weeks
 * (one tx each) chosen with minimum cardinality covering the deficit and
 * minimum overshoot as tiebreaker.
 */
export function selectClaimSetForGlwDelegation(
  unclaimed: ClaimableGlwItem[],
  targetGlwWei: bigint
): ClaimSetSelection {
  if (targetGlwWei <= 0n) {
    return {
      pdWeeks: [],
      inflationWeeks: [],
      totalGlwWei: 0n,
      shortfallGlwWei: 0n,
      txCount: 0,
    };
  }

  const pdItems = unclaimed.filter(
    (item) => item.source === "protocolDeposit" && item.glwAmountWei > 0n
  );
  const inflationItems = unclaimed.filter(
    (item) => item.source === "glowInflation" && item.glwAmountWei > 0n
  );

  const pdTotal = sumGlwAmount(pdItems);
  const pdSubset =
    pdTotal <= targetGlwWei
      ? pdItems
      : pdSubsetMaximizingUnderTarget(pdItems, targetGlwWei);
  const pdSum = sumGlwAmount(pdSubset);

  if (pdSum >= targetGlwWei) {
    return {
      pdWeeks: pdSubset,
      inflationWeeks: [],
      totalGlwWei: pdSum,
      shortfallGlwWei: 0n,
      txCount: pdSubset.length > 0 ? 1 : 0,
    };
  }

  const deficit = targetGlwWei - pdSum;
  const inflationSubset = inflationSubsetCoveringDeficit(
    inflationItems,
    deficit
  );
  const inflationSum = sumGlwAmount(inflationSubset);
  const total = pdSum + inflationSum;
  const shortfall = total >= targetGlwWei ? 0n : targetGlwWei - total;

  return {
    pdWeeks: pdSubset,
    inflationWeeks: inflationSubset,
    totalGlwWei: total,
    shortfallGlwWei: shortfall,
    txCount: (pdSubset.length > 0 ? 1 : 0) + inflationSubset.length,
  };
}

function sumGlwAmount(items: ClaimableGlwItem[]): bigint {
  let total = 0n;
  for (const item of items) total += item.glwAmountWei;
  return total;
}

function pdSubsetMaximizingUnderTarget(
  items: ClaimableGlwItem[],
  target: bigint
): ClaimableGlwItem[] {
  if (items.length === 0) return [];
  if (items.length > CLAIM_SET_BRUTE_FORCE_THRESHOLD) {
    return greedyPdSubset(items, target);
  }

  const n = items.length;
  let bestSum = 0n;
  let bestMask = 0;
  const total = 1 << n;
  for (let mask = 1; mask < total; mask++) {
    let sum = 0n;
    for (let i = 0; i < n; i++) {
      if ((mask >>> i) & 1) sum += items[i].glwAmountWei;
    }
    if (sum <= target && sum > bestSum) {
      bestSum = sum;
      bestMask = mask;
    }
  }

  return collectMaskedItems(items, bestMask);
}

function greedyPdSubset(
  items: ClaimableGlwItem[],
  target: bigint
): ClaimableGlwItem[] {
  const sorted = [...items].sort((a, b) =>
    compareBigintDesc(a.glwAmountWei, b.glwAmountWei)
  );
  const subset: ClaimableGlwItem[] = [];
  let sum = 0n;
  for (const item of sorted) {
    if (sum + item.glwAmountWei <= target) {
      subset.push(item);
      sum += item.glwAmountWei;
    }
  }
  return subset;
}

function inflationSubsetCoveringDeficit(
  items: ClaimableGlwItem[],
  deficit: bigint
): ClaimableGlwItem[] {
  if (deficit <= 0n) return [];
  if (items.length === 0) return [];
  if (items.length > CLAIM_SET_BRUTE_FORCE_THRESHOLD) {
    return greedyInflationSubset(items, deficit);
  }

  const n = items.length;
  let bestCard = Infinity;
  let bestSum = 0n;
  let bestMask = -1;
  const total = 1 << n;
  for (let mask = 1; mask < total; mask++) {
    let sum = 0n;
    let card = 0;
    for (let i = 0; i < n; i++) {
      if ((mask >>> i) & 1) {
        sum += items[i].glwAmountWei;
        card++;
      }
    }
    if (sum < deficit) continue;
    if (
      bestMask < 0 ||
      card < bestCard ||
      (card === bestCard && sum < bestSum)
    ) {
      bestCard = card;
      bestSum = sum;
      bestMask = mask;
    }
  }

  if (bestMask < 0) {
    // Pool cannot cover the deficit; return everything as a best effort and
    // let the caller surface the shortfall.
    return [...items];
  }
  return collectMaskedItems(items, bestMask);
}

function greedyInflationSubset(
  items: ClaimableGlwItem[],
  deficit: bigint
): ClaimableGlwItem[] {
  const sorted = [...items].sort((a, b) =>
    compareBigintDesc(a.glwAmountWei, b.glwAmountWei)
  );
  const subset: ClaimableGlwItem[] = [];
  let sum = 0n;
  for (const item of sorted) {
    if (sum >= deficit) break;
    subset.push(item);
    sum += item.glwAmountWei;
  }
  return subset;
}

function collectMaskedItems(
  items: ClaimableGlwItem[],
  mask: number
): ClaimableGlwItem[] {
  if (mask <= 0) return [];
  const subset: ClaimableGlwItem[] = [];
  for (let i = 0; i < items.length; i++) {
    if ((mask >>> i) & 1) subset.push(items[i]);
  }
  return subset;
}

function compareBigintDesc(a: bigint, b: bigint): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}
