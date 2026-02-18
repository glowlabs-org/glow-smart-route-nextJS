import { readFile } from "node:fs/promises";
import Decimal from "decimal.js";
import {
  computeMinerMarginPerPd,
  parseProtocolDepositFromPayment,
  type MinerMarginFarmInput,
} from "../lib/internal/miner-margin-per-pd";

interface FarmsPerPieceStatsResponse {
  farms: Array<{
    farmId: string;
    appId: string;
    miner: {
      stepsSold: number;
      weightedPiecePriceUsdc: string;
    };
  }>;
}

interface CompletedFarm {
  id: string;
  farm?: {
    id?: string;
    region?: string;
    regionFullName?: string;
  } | null;
  paymentAmount?: string;
  paymentCurrency?: string;
  zone?: {
    id: number;
    name: string;
  } | null;
}

interface FarmBountyRow {
  farm_id: string;
  bounty_usd: string | number | null;
}

function parseArg(name: string) {
  const token = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return token?.split("=")[1] ?? null;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value === 0) return "$0";
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  const digits = absValue >= 1000 ? 0 : 2;
  return `${sign}$${absValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

function formatPd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const digits = value >= 1000 ? 0 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

async function main() {
  const endWeek = Number(parseArg("endWeek") ?? "114");
  const top = Number(parseArg("top") ?? "20");
  const inputPath = parseArg("input");
  const completedPath = parseArg("completed");
  const bountiesPath = parseArg("bounties");

  let stats: FarmsPerPieceStatsResponse;
  let completed: CompletedFarm[];
  let bountyRows: FarmBountyRow[];

  if (inputPath) {
    const statsJson = await readFile(inputPath, "utf-8");
    stats = JSON.parse(statsJson) as FarmsPerPieceStatsResponse;
    if (completedPath) {
      const completedJson = await readFile(completedPath, "utf-8");
      completed = JSON.parse(completedJson) as CompletedFarm[];
    } else {
      completed = [];
    }
    if (bountiesPath) {
      const bountiesJson = await readFile(bountiesPath, "utf-8");
      bountyRows = JSON.parse(bountiesJson) as FarmBountyRow[];
    } else {
      bountyRows = [];
    }
  } else {
    const hubUrl = process.env.NEXT_PUBLIC_HUB_URL;
    if (!hubUrl) {
      throw new Error(
        "NEXT_PUBLIC_HUB_URL is required unless --input=<stats.json> is provided"
      );
    }

    const statsUrl = `${hubUrl}/fractions/farms-per-piece-stats?endWeek=${endWeek}`;
    const completedUrl = `${hubUrl}/applications/completed`;
    const bountiesUrl = `${hubUrl}/pol/bounties/farms`;

    const [statsRes, completedRes, bountiesRes] = await Promise.all([
      fetch(statsUrl),
      fetch(completedUrl),
      fetch(bountiesUrl),
    ]);

    if (!statsRes.ok) {
      throw new Error(
        `Failed to fetch farms-per-piece-stats: ${statsRes.status} ${statsRes.statusText}`
      );
    }
    if (!completedRes.ok) {
      throw new Error(
        `Failed to fetch completed farms: ${completedRes.status} ${completedRes.statusText}`
      );
    }
    if (!bountiesRes.ok) {
      throw new Error(
        `Failed to fetch farm cash bounties: ${bountiesRes.status} ${bountiesRes.statusText}`
      );
    }

    stats = (await statsRes.json()) as FarmsPerPieceStatsResponse;
    completed = (await completedRes.json()) as CompletedFarm[];
    bountyRows = (await bountiesRes.json()) as FarmBountyRow[];
  }

  const cashBountyByFarmId = new Map<string, number>();
  for (const row of bountyRows || []) {
    if (!row?.farm_id) continue;
    const bounty = Number(row.bounty_usd ?? 0);
    if (!Number.isFinite(bounty)) continue;
    cashBountyByFarmId.set(row.farm_id, bounty);
  }

  const regionMetaByAppId = new Map<
    string,
    {
      id: number | null;
      name: string;
      protocolDepositPaid: number;
      backendFarmId: string | null;
    }
  >();
  for (const farm of completed) {
    if (!farm?.id) continue;
    const regionId = farm.zone?.id ?? null;
    const regionName =
      farm.zone?.name ||
      farm.farm?.regionFullName ||
      farm.farm?.region ||
      (regionId ? `Region ${regionId}` : "Unassigned");
    regionMetaByAppId.set(farm.id, {
      id: regionId,
      name: regionName,
      protocolDepositPaid: parseProtocolDepositFromPayment({
        paymentAmount: farm.paymentAmount,
        paymentCurrency: farm.paymentCurrency,
      }),
      backendFarmId: farm.farm?.id ?? null,
    });
  }

  const farmInputs: MinerMarginFarmInput[] = (stats.farms || []).map((farm) => {
    const regionMeta = regionMetaByAppId.get(farm.appId);
    return {
      appId: farm.appId,
      regionId: regionMeta?.id ?? null,
      regionName: regionMeta?.name || "Unassigned",
      minerSalesUsd: new Decimal(farm.miner.weightedPiecePriceUsdc || "0")
        .times(farm.miner.stepsSold || 0)
        .div(1e6)
        .toNumber(),
      bountyUsd:
        cashBountyByFarmId.get(farm.farmId) ??
        (regionMeta?.backendFarmId
          ? cashBountyByFarmId.get(regionMeta.backendFarmId)
          : undefined) ??
        null,
      protocolDepositPaid: regionMeta?.protocolDepositPaid ?? 0,
      minerStepsSold: farm.miner.stepsSold || 0,
    };
  });

  const summary = computeMinerMarginPerPd(farmInputs);
  const overallMarginPerPd =
    summary.overall.marginPerPd === null
      ? "N/A"
      : `${formatUsd(summary.overall.marginPerPd)} per PD`;

  console.log("");
  console.log(
    `Miner Margin / PD (all mining farms, endWeek=${endWeek}, farms=${summary.overall.farmCount})`
  );
  console.log(
    `Overall: ${overallMarginPerPd} | ` +
      `Sales=${formatUsd(summary.overall.totalSalesUsd)} ` +
      `Bounties=${formatUsd(summary.overall.totalBountyUsd)} ` +
      `PD=${formatPd(summary.overall.totalPdPaid)}`
  );
  console.log("");
  console.log("By region:");

  const rows = summary.byRegion.slice(0, Math.max(top, 0));
  rows.forEach((region, idx) => {
    const rank = String(idx + 1).padStart(2, " ");
    const marginPerPd =
      region.marginPerPd === null ? "N/A" : formatUsd(region.marginPerPd);
    console.log(
      `${rank}. ${region.regionName} | farms=${region.farmCount} | ` +
        `margin/PD=${marginPerPd} | sales=${formatUsd(region.totalSalesUsd)} | ` +
        `bounties=${formatUsd(region.totalBountyUsd)} | PD=${formatPd(
          region.totalPdPaid
        )}`
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
