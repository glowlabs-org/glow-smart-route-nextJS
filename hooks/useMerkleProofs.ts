"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  PaymentCurrency,
  OffChainPaymentCurrency,
} from "@glowlabs-org/utils/browser";
import { SDKAddresses } from "@/web3/constants/addresses";

// Base URL for merkle proof data
const MERKLE_PROOF_BASE_URL =
  "https://pub-311748c72106476cbeabe0a22a59217d.r2.dev";

// Type definitions based on the provided structure
export interface OffchainAssetEarned {
  asset: OffChainPaymentCurrency;
  amount: string;
}

export interface ReadableLeafReward {
  leaf: `0x${string}`;
  user: `0x${string}`;
  glowInflationEarned: string;
  glowInflationEarnedLeafWeight: string;
  onchainAssetsEarned: {
    asset: Exclude<PaymentCurrency, OffChainPaymentCurrency>;
    assetAddress: `0x${string}`;
    amount: string;
  }[];
  v1MerkleProof: string[];
  v2MerkleProof: string[];
  offchainAssetsEarned: OffchainAssetEarned[];
}

export interface WeeklyReportData {
  week: number;
  v1MerkleRoot: string;
  v2MerkleRoot: string;
  totalGlowInflationRewards: string;
  totalGlowInflationRewardsLeafWeight: string;
  totalV1UsdgWeight: string;
  fullOnchainTokensAndAmountsArray: {
    amount: string;
    asset: string;
    assetAddress: string;
  }[];
  readableLeaves: ReadableLeafReward[];
  // Other fields exist but we don't need them for claiming
}

// Query key factory
const QUERY_KEYS = {
  weeklyReport: (week: number) => ["merkle-proof", week] as const,
};

// Week 97 is the first v2 week (nonce 0)
const FIRST_V2_WEEK = 97;

export function weekToNonce(week: number): bigint {
  if (week < FIRST_V2_WEEK) {
    throw new Error(`Week ${week} is before v2 launch`);
  }
  return BigInt(week - FIRST_V2_WEEK);
}

export function nonceToWeek(nonce: bigint): number {
  return Number(nonce) + FIRST_V2_WEEK;
}

interface UseMerkleProofsResult {
  data: WeeklyReportData | null;
  userProof: ReadableLeafReward | null;
  nonce: bigint;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useMerkleProofs(
  week: number,
  userAddress?: string
): UseMerkleProofsResult {
  const nonce = weekToNonce(week);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEYS.weeklyReport(week),
    queryFn: async () => {
      const response = await fetch(
        `${MERKLE_PROOF_BASE_URL}/weekly-report-week-${week}.json`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch merkle proof for week ${week}`);
      }

      const data: WeeklyReportData = await response.json();
      return data;
    },
    enabled: week >= FIRST_V2_WEEK,
    staleTime: Infinity, // Merkle proofs never change
    gcTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    retry: 3,
  });

  // Find the user's proof in the data
  const userProof = React.useMemo(() => {
    if (!data || !userAddress) return null;

    return (
      data.readableLeaves.find(
        (leaf) => leaf.user.toLowerCase() === userAddress.toLowerCase()
      ) || null
    );
  }, [data, userAddress]);

  return {
    data: data || null,
    userProof,
    nonce,
    isLoading,
    isError,
    error: error as Error | null,
  };
}

// Helper to get the hot wallet address (from address) for a week
// This should ideally come from the backend, but we can extract it from the data
export function getHotWalletAddress(): `0x${string}` {
  return "0x465E5573c648BC50a11911Cd48D0e279F4409Ec8";
}
