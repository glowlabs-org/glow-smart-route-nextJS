"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import Decimal from "decimal.js";
import {
  WalletsRouter,
  DECIMALS_BY_TOKEN,
  type WalletWeeklyRewardsResponse,
} from "@glowlabs-org/utils/browser";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const walletsRouter = WalletsRouter(CONTROL_API_URL);

const QUERY_KEY = {
  v2Claims: (wallet?: string) => ["wallet-v2-claims", wallet] as const,
};

export interface WalletProtocolClaim {
  week: number;
  currency: string;
  amount: number;
  amountRaw: string;
  claimedAt: number;
}

export interface WalletInflationClaim {
  week: number;
  amount: number;
  amountRaw: string;
  claimedAt: number;
}

interface WalletV2ClaimsResult {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  protocolClaims: WalletProtocolClaim[];
  protocolTotals: Record<string, number>;
  inflationClaims: WalletInflationClaim[];
  inflationTotalGlw: number;
}

function weekToTimestamp(week: number) {
  const secondsPerWeek = 7 * 86_400;
  return (GENESIS_TIMESTAMP + week * secondsPerWeek) * 1000;
}

export function useWalletV2Claims(
  walletAddress: string | undefined
): WalletV2ClaimsResult {
  const currentEpoch = getCurrentEpoch();

  const { data, isLoading, isError, error } = useQuery<WalletWeeklyRewardsResponse | null>({
    queryKey: QUERY_KEY.v2Claims(walletAddress),
    enabled: Boolean(walletAddress),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    queryFn: async () => {
      if (!walletAddress) return null;
      return walletsRouter.fetchWalletWeeklyRewards(walletAddress, {
        endWeek: currentEpoch - 1,
        limit: 150,
      });
    },
  });

  const processed = React.useMemo(() => {
    if (!data?.rewards?.length) {
      return { claims: [] as WalletV2Claim[], totals: {} as Record<string, number> };
    }

    const protocolTotals: Record<string, number> = {};
    const protocolClaims: WalletProtocolClaim[] = [];
    const inflationClaims: WalletInflationClaim[] = [];
    let inflationTotalGlw = 0;

    for (const reward of data.rewards) {
      const raw = reward.protocolDepositRewardsReceived;
      if (raw && raw !== "0") {
        const currency = reward.paymentCurrency || "GLW";
        const decimals =
          DECIMALS_BY_TOKEN[currency as keyof typeof DECIMALS_BY_TOKEN] ?? 18;

        const amount = Number(formatUnits(BigInt(raw), decimals));
        if (Number.isFinite(amount) && amount > 0) {
          protocolTotals[currency] = new Decimal(protocolTotals[currency] || 0)
            .plus(amount)
            .toNumber();

          protocolClaims.push({
            week: reward.weekNumber,
            currency,
            amount,
            amountRaw: raw,
            claimedAt: weekToTimestamp(reward.weekNumber),
          });
        }
      }

      const inflationRaw = reward.glowInflationTotal;
      if (inflationRaw && inflationRaw !== "0") {
        const glwAmount = Number(
          formatUnits(BigInt(inflationRaw), DECIMALS_BY_TOKEN.GLW)
        );
        if (Number.isFinite(glwAmount) && glwAmount > 0) {
          inflationTotalGlw = new Decimal(inflationTotalGlw)
            .plus(glwAmount)
            .toNumber();
          inflationClaims.push({
            week: reward.weekNumber,
            amount: glwAmount,
            amountRaw: inflationRaw,
            claimedAt: weekToTimestamp(reward.weekNumber),
          });
        }
      }
    }

    protocolClaims.sort((a, b) => b.week - a.week);
    inflationClaims.sort((a, b) => b.week - a.week);

    return {
      protocolClaims,
      protocolTotals,
      inflationClaims,
      inflationTotalGlw,
    };
  }, [data]);

  return {
    isLoading,
    isError,
    error: error ?? null,
    protocolClaims: processed.protocolClaims,
    protocolTotals: processed.protocolTotals,
    inflationClaims: processed.inflationClaims,
    inflationTotalGlw: processed.inflationTotalGlw,
  };
}

