import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import Decimal from "decimal.js";

import type {
  AvailabilitySummary,
  FractionRecord,
  FractionsAvailabilityGroupedResponse,
  FractionsAvailabilityResponse,
} from "@/hooks";
import type { FractionsSummaryResponse } from "@/hooks";
import type { SplitActivity } from "@/hooks";

export interface ProtocolActivityMetrics {
  totalDelegatedGlw: number;
  totalMiningCenterValue: number;
  launchpadContributors: number;
  miningCenterContributors: number;
}

export interface ParsedFractionAvailability {
  summary: AvailabilitySummary;
  fractions: FractionRecord[];
}

export interface InventoryItem {
  id: string;
  applicationId: string;
  token: string;
  remainingStepsFormatted: string;
  remainingValueFormatted: string;
  remainingPercentFormatted: string;
  stepPriceFormatted: string;
  type: "launchpad" | "mining-center";
}

export interface MiningCenterStats {
  averageRewardScore: number;
}

export interface ProtocolEventRow {
  id: string;
  title: string;
  farmName: string;
  buyer: string;
  applicationId: string;
  token: string;
  totalValueFormatted: string;
  timestamp: string;
}

export function formatDelegationEvents(
  activity: SplitActivity[]
): ProtocolEventRow[] {
  return activity
    .filter((event) => event.fractionType === "launchpad")
    .map(
      (event) =>
        ({
          id: event.transactionHash,
          farmName: event.farmName,
          title: `${formatTokenAmount(
            event.totalValue,
            event.currency
          )} delegated`,
          buyer: shortenAddress(event.buyer),
          applicationId: event.applicationId,
          token: event.currency,
          totalValueFormatted: formatTokenAmount(
            event.totalValue,
            event.currency
          ),
          timestamp: formatTimestamp(event.timestamp * 1000),
        } satisfies ProtocolEventRow)
    );
}

export function formatMinerEvents(
  activity: SplitActivity[]
): ProtocolEventRow[] {
  return activity
    .filter((event) => event.fractionType === "mining-center")
    .map(
      (event) =>
        ({
          id: event.transactionHash,
          title: `${formatTokenAmount(
            event.totalValue,
            event.currency
          )} purchased`,
          farmName: event.farmName,
          buyer: shortenAddress(event.buyer),
          applicationId: event.applicationId,
          token: event.currency,
          totalValueFormatted: formatTokenAmount(
            event.totalValue,
            event.currency,
            { prefix: "$", fallbackToken: "USDC" }
          ),
          timestamp: formatTimestamp(event.timestamp * 1000),
        } satisfies ProtocolEventRow)
    );
}

export function parseFractionsSummary(
  summary: FractionsSummaryResponse | null
): ProtocolActivityMetrics {
  if (!summary) {
    return {
      totalDelegatedGlw: 0,
      totalMiningCenterValue: 0,
      launchpadContributors: 0,
      miningCenterContributors: 0,
    };
  }

  return {
    totalDelegatedGlw: toTokenNumber(summary.totalGlwDelegated, "GLW"),
    totalMiningCenterValue: toTokenNumber(
      summary.totalMiningCenterVolume,
      "USDC"
    ),
    launchpadContributors: summary.launchpadContributors,
    miningCenterContributors: summary.miningCenterContributors,
  };
}

export function parseFractionsAvailability(
  payload:
    | FractionsAvailabilityResponse
    | FractionsAvailabilityGroupedResponse
    | null
): {
  launchpad: ParsedFractionAvailability | null;
  miningCenter: ParsedFractionAvailability | null;
} {
  if (!payload) {
    return { launchpad: null, miningCenter: null };
  }

  if ("type" in payload) {
    const parsed = buildAvailability(payload);
    return {
      launchpad: payload.type === "launchpad" ? parsed : null,
      miningCenter: payload.type === "mining-center" ? parsed : null,
    };
  }

  return {
    launchpad: buildAvailability(payload.launchpad),
    miningCenter: buildAvailability(payload.miningCenter),
  };
}

export function formatRemainingInventory(
  availability: ParsedFractionAvailability | null
): InventoryItem[] {
  if (!availability) return [];

  return availability.fractions.map((fraction) => {
    const remainingStepsDecimal = new Decimal(fraction.remainingSteps || "0");
    const totalStepsDecimal = new Decimal(fraction.totalSteps || "0");
    const remainingStepsFormatted = formatCount(remainingStepsDecimal);

    const remainingValue = formatTokenAmount(
      fraction.remainingValue,
      fraction.token as keyof typeof DECIMALS_BY_TOKEN,
      isStableCurrency(fraction.token)
        ? { prefix: "$", fallbackToken: fraction.token }
        : { fallbackToken: fraction.token }
    );

    const percent = totalStepsDecimal.gt(0)
      ? remainingStepsDecimal.dividedBy(totalStepsDecimal).mul(100).toNumber()
      : 0;

    return {
      id: fraction.id,
      applicationId: fraction.applicationId,
      token: fraction.token,
      remainingStepsFormatted,
      remainingValueFormatted: remainingValue,
      remainingPercentFormatted: `${Math.max(
        0,
        Math.min(100, Math.round(percent))
      )}%`,
      stepPriceFormatted: formatTokenAmount(
        fraction.stepPrice,
        fraction.token as keyof typeof DECIMALS_BY_TOKEN,
        isStableCurrency(fraction.token)
          ? { prefix: "$", fallbackToken: fraction.token }
          : { fallbackToken: fraction.token }
      ),
      type: fraction.type,
    } satisfies InventoryItem;
  });
}

export function calculateMiningCenterStats(
  fractions: FractionRecord[]
): MiningCenterStats {
  if (fractions.length === 0) {
    return { averageRewardScore: 0 };
  }

  const validScores = fractions
    .map((fraction) => fraction.rewardScore ?? null)
    .filter(
      (score): score is number =>
        typeof score === "number" && !Number.isNaN(score)
    );

  if (validScores.length === 0) {
    return { averageRewardScore: 0 };
  }

  const total = validScores.reduce((sum, score) => sum + score, 0);
  return { averageRewardScore: total / validScores.length };
}

function buildAvailability(
  response: FractionsAvailabilityResponse
): ParsedFractionAvailability {
  return {
    summary: response.summary,
    fractions: response.fractions,
  };
}

export function toTokenNumber(
  amount: string,
  token: keyof typeof DECIMALS_BY_TOKEN
): number {
  if (!amount) return 0;

  const decimals = DECIMALS_BY_TOKEN[token];
  if (decimals === undefined) return 0;

  try {
    const decimalAmount = new Decimal(amount);
    return decimalAmount.dividedBy(new Decimal(10).pow(decimals)).toNumber();
  } catch (error) {
    console.error(`Failed to convert ${amount} for token ${token}`, error);
    return 0;
  }
}

export function formatTokenAmount(
  amount: string,
  token: keyof typeof DECIMALS_BY_TOKEN,
  options?: { prefix?: string; fallbackToken?: string }
): string {
  const decimals = DECIMALS_BY_TOKEN[token];
  if (decimals === undefined) return "--";

  try {
    const formatted = new Decimal(amount || "0")
      .dividedBy(new Decimal(10).pow(decimals))
      .toSignificantDigits(4)
      .toNumber()
      .toLocaleString();

    const prefix = options?.prefix ?? "";
    const suffix = options?.prefix ? "" : ` ${options?.fallbackToken ?? token}`;
    return `${prefix}${formatted}${suffix}`.trim();
  } catch (error) {
    console.error(
      `Failed to format amount ${amount} for token ${token}`,
      error
    );
    return "--";
  }
}

function formatTimestamp(unixMilliseconds: number): string {
  return new Date(unixMilliseconds).toLocaleString();
}

function shortenAddress(address: string): string {
  if (!address) return "--";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatCount(value: Decimal): string {
  try {
    return value.toNumber().toLocaleString();
  } catch (error) {
    console.error("Failed to format count", error);
    return value.toFixed(0);
  }
}

function isStableCurrency(token: string): boolean {
  return token === "USDC" || token === "USDG";
}
