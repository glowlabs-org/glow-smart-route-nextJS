"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

import {
  useGctlApi,
  useRegions,
  useActiveRegionsSummary,
  useWallets,
  useWalletRegionAvailableStakeMap,
} from "@/hooks";

function gctlAmountFromRaw(raw: string) {
  try {
    return Number(formatUnits(BigInt(raw || "0"), DECIMALS_BY_TOKEN.GCTL));
  } catch {
    return 0;
  }
}

export function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(1).replace(/\.?0+$/, "");
}

export interface GctlSteeringStake {
  regionId: number;
  regionName: string;
  amountGctl: number;
  availableAmount: number;
  lockedAmount: number;
  totalRegionStaked: number;
  weeklyEmissions: number;
  /** Bar width normalized so the biggest stake's share = 75%. */
  normalizedWidth: number;
}

export interface GctlSteering {
  totalBalanceGctl: number;
  walletBalanceGctl: number;
  availableSgctl: number;
  lockedSgctl: number;
  stakedTotalGctl: number;
  totalSteeringPoints: number;
  stakes: GctlSteeringStake[];
  hasLiquidGctl: boolean;
  isLoading: boolean;
}

/**
 * The wallet's GCTL/steering position: holdings (liquid/available/locked),
 * estimated steering points, and per-region active stakes with the GLW each
 * directs. Moved out of the standalone GCTL widget so the My Impact section can
 * surface the same numbers.
 */
export function useGctlSteering(params: {
  walletAddress?: string | null;
  enabled?: boolean;
}): GctlSteering {
  const { walletAddress } = params;
  const isEnabled = Boolean(walletAddress) && (params.enabled ?? true);

  const { gctlBalance, isGctlBalanceLoading } = useGctlApi(
    walletAddress ?? undefined,
    { enabled: isEnabled }
  );
  const { walletDetails, isWalletDetailsLoading } = useWallets({
    walletAddress: walletAddress ?? undefined,
    enabled: isEnabled,
    includeMintedEvents: false,
    includeStakeEvents: false,
    includeMigrationAmount: false,
  });
  const regionIds = useMemo(
    () => (walletDetails?.regions ?? []).map((region) => region.regionId),
    [walletDetails?.regions]
  );
  const {
    impactEligibleStakedGctlByRegion,
    availableStakedGctlByRegion,
    availableStakeByRegion,
    isAvailableStakeMapLoading,
  } = useWalletRegionAvailableStakeMap({
    walletAddress: walletAddress ?? undefined,
    regionIds,
    enabled: isEnabled,
  });
  const { regions, isRegionsLoading } = useRegions();
  const { data: activeSummary, isLoading: isActiveSummaryLoading } =
    useActiveRegionsSummary({ enabled: isEnabled });

  const walletBalanceGctl = useMemo(() => {
    if (!isEnabled) return 0;
    return gctlAmountFromRaw(gctlBalance);
  }, [gctlBalance, isEnabled]);

  const regionDataMap = useMemo(() => {
    if (!activeSummary) return new Map<number, { totalStaked: number; weeklyEmissions: number }>();
    return new Map(
      activeSummary.regions.map((r) => [
        r.id,
        { totalStaked: r.stakedGctl, weeklyEmissions: r.glwPerWeek },
      ])
    );
  }, [activeSummary]);

  const stakes = useMemo<GctlSteeringStake[]>(() => {
    if (!isEnabled) return [];
    const rows =
      walletDetails?.regions
        ?.filter(
          (r) => (impactEligibleStakedGctlByRegion.get(r.regionId) ?? 0n) > 0n
        )
        .map((r) => {
          const fallbackName =
            regions.find((reg) => reg.id === r.regionId)?.name ??
            `Region ${r.regionId}`;
          const regionData = regionDataMap.get(r.regionId);
          const impactEligibleStaked =
            impactEligibleStakedGctlByRegion.get(r.regionId) ?? 0n;

          const snapshot = availableStakeByRegion.get(r.regionId) ?? null;
          let lockedWei = 0n;
          if (snapshot) {
            try {
              lockedWei += BigInt(snapshot.delegatedSgctlVaultBalance ?? "0");
              lockedWei += BigInt(snapshot.protocolDepositVaultBalance ?? "0");
            } catch {
              // ignore malformed values
            }
          }
          const totalAmount = gctlAmountFromRaw(impactEligibleStaked.toString());
          const lockedAmount = gctlAmountFromRaw(lockedWei.toString());
          const availableAmount = Math.max(totalAmount - lockedAmount, 0);

          return {
            regionId: r.regionId,
            regionName: r.region?.name || fallbackName,
            amountGctl: totalAmount,
            availableAmount,
            lockedAmount,
            totalRegionStaked: regionData?.totalStaked ?? 0,
            weeklyEmissions: regionData?.weeklyEmissions ?? 0,
          };
        })
        .sort((a, b) => b.amountGctl - a.amountGctl) ?? [];

    const shares = rows.map((stake) => ({
      stake,
      share:
        stake.totalRegionStaked > 0
          ? stake.amountGctl / stake.totalRegionStaked
          : 0,
    }));
    const maxShare = Math.max(...shares.map((s) => s.share), 0);
    return shares.map(({ stake, share }) => ({
      ...stake,
      normalizedWidth: maxShare > 0 ? (share / maxShare) * 75 : 0,
    }));
  }, [
    availableStakeByRegion,
    impactEligibleStakedGctlByRegion,
    isEnabled,
    regionDataMap,
    regions,
    walletDetails?.regions,
  ]);

  const stakedTotalGctl = useMemo(
    () => stakes.reduce((acc, curr) => acc + curr.amountGctl, 0),
    [stakes]
  );
  const totalBalanceGctl = walletBalanceGctl + stakedTotalGctl;

  const availableSgctl = useMemo(() => {
    let totalWei = 0n;
    availableStakedGctlByRegion.forEach((wei) => {
      totalWei += wei;
    });
    return gctlAmountFromRaw(totalWei.toString());
  }, [availableStakedGctlByRegion]);

  const lockedSgctl = useMemo(() => {
    let totalWei = 0n;
    availableStakeByRegion.forEach((snapshot) => {
      if (!snapshot) return;
      try {
        totalWei += BigInt(snapshot.delegatedSgctlVaultBalance ?? "0");
        totalWei += BigInt(snapshot.protocolDepositVaultBalance ?? "0");
      } catch {
        // ignore malformed values
      }
    });
    return gctlAmountFromRaw(totalWei.toString());
  }, [availableStakeByRegion]);

  // Estimated steering points = sum of (GLW directed) * 3 across stakes.
  const totalSteeringPoints = useMemo(
    () =>
      stakes.reduce((acc, curr) => {
        const share =
          curr.totalRegionStaked > 0
            ? curr.amountGctl / curr.totalRegionStaked
            : 0;
        return acc + curr.weeklyEmissions * share * 3;
      }, 0),
    [stakes]
  );

  return {
    totalBalanceGctl,
    walletBalanceGctl,
    availableSgctl,
    lockedSgctl,
    stakedTotalGctl,
    totalSteeringPoints,
    stakes,
    hasLiquidGctl: walletBalanceGctl > 0.01,
    isLoading:
      isGctlBalanceLoading ||
      isWalletDetailsLoading ||
      isAvailableStakeMapLoading ||
      isRegionsLoading ||
      isActiveSummaryLoading,
  };
}

export { gctlAmountFromRaw };
