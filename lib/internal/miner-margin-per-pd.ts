import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";

export interface MinerMarginFarmInput {
  appId: string;
  regionId: number | null;
  regionName: string;
  minerSalesUsd: number;
  bountyUsd: number | null;
  protocolDepositPaid: number;
  minerStepsSold: number;
}

export interface MinerMarginPerPdTotals {
  totalSalesUsd: number;
  totalBountyUsd: number;
  totalPdPaid: number;
  marginUsd: number;
  marginPerPd: number | null;
  farmCount: number;
}

export interface RegionMinerMarginPerPdRow extends MinerMarginPerPdTotals {
  regionId: number | null;
  regionName: string;
}

export function parseProtocolDepositFromPayment(params: {
  paymentAmount: string | undefined | null;
  paymentCurrency: string | undefined | null;
}) {
  const { paymentAmount, paymentCurrency } = params;
  if (!paymentAmount || !paymentCurrency) return 0;
  const decimals =
    DECIMALS_BY_TOKEN[paymentCurrency as keyof typeof DECIMALS_BY_TOKEN];
  if (typeof decimals !== "number") return 0;
  try {
    return Number(formatUnits(BigInt(paymentAmount), decimals));
  } catch {
    return 0;
  }
}

function toMinerMarginPerPdTotals(params: {
  totalSalesUsd: number;
  totalBountyUsd: number;
  totalPdPaid: number;
  farmCount: number;
}): MinerMarginPerPdTotals {
  const { totalSalesUsd, totalBountyUsd, totalPdPaid, farmCount } = params;
  const marginUsd = totalSalesUsd - totalBountyUsd;
  return {
    totalSalesUsd,
    totalBountyUsd,
    totalPdPaid,
    marginUsd,
    marginPerPd: totalPdPaid > 0 ? marginUsd / totalPdPaid : null,
    farmCount,
  };
}

export function computeMinerMarginPerPd(farms: MinerMarginFarmInput[]) {
  const overallAccumulator = {
    totalSalesUsd: 0,
    totalBountyUsd: 0,
    totalPdPaid: 0,
    farmCount: 0,
  };
  const regionAccumulators = new Map<
    string,
    {
      regionId: number | null;
      regionName: string;
      totalSalesUsd: number;
      totalBountyUsd: number;
      totalPdPaid: number;
      farmCount: number;
    }
  >();

  for (const farm of farms) {
    if (farm.minerStepsSold <= 0) continue;

    const pdPaidFirstWindow = farm.protocolDepositPaid;

    const salesUsd = farm.minerSalesUsd;
    const bountyUsd = farm.bountyUsd ?? 0;

    overallAccumulator.totalSalesUsd += salesUsd;
    overallAccumulator.totalBountyUsd += bountyUsd;
    overallAccumulator.totalPdPaid += pdPaidFirstWindow;
    overallAccumulator.farmCount += 1;

    const regionKey =
      typeof farm.regionId === "number" ? farm.regionId.toString() : "none";
    const regionAccumulator = regionAccumulators.get(regionKey) ?? {
      regionId: farm.regionId,
      regionName: farm.regionName || "Unassigned",
      totalSalesUsd: 0,
      totalBountyUsd: 0,
      totalPdPaid: 0,
      farmCount: 0,
    };

    regionAccumulator.totalSalesUsd += salesUsd;
    regionAccumulator.totalBountyUsd += bountyUsd;
    regionAccumulator.totalPdPaid += pdPaidFirstWindow;
    regionAccumulator.farmCount += 1;
    regionAccumulators.set(regionKey, regionAccumulator);
  }

  const overall = toMinerMarginPerPdTotals(overallAccumulator);
  const byRegion = Array.from(regionAccumulators.values())
    .map((region): RegionMinerMarginPerPdRow => {
      const totals = toMinerMarginPerPdTotals(region);
      return {
        regionId: region.regionId,
        regionName: region.regionName,
        ...totals,
      };
    })
    .sort((a, b) => {
      const aMargin =
        a.marginPerPd === null ? Number.NEGATIVE_INFINITY : a.marginPerPd;
      const bMargin =
        b.marginPerPd === null ? Number.NEGATIVE_INFINITY : b.marginPerPd;
      return (
        bMargin - aMargin ||
        b.totalSalesUsd - a.totalSalesUsd ||
        a.regionName.localeCompare(b.regionName)
      );
    });

  return { overall, byRegion };
}
