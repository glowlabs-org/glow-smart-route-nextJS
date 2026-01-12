import { formatUnits } from "viem";
import { formatNumber } from "@/utils/format";
import type { ImpactGlowScoreComposition } from "@/hooks";

export function shortAddress(address: string) {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function safeNumber(value: string | undefined) {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatImpactPoints(value: string | undefined, maximumFractionDigits = 2) {
  return formatNumber(safeNumber(value), { maximumFractionDigits });
}

export function formatGlwFromWei(wei: string | undefined) {
  if (!wei) return "—";
  try {
    const glw = Number(formatUnits(BigInt(wei), 18));
    if (!Number.isFinite(glw)) return "—";
    return formatNumber(glw, { maximumFractionDigits: 0 });
  } catch {
    return "—";
  }
}

export function formatTopPercentile(percentile: number) {
  if (!Number.isFinite(percentile) || percentile <= 0) return "—";
  if (percentile < 0.01) return "<0.01%";
  if (percentile < 1) return `${percentile.toFixed(2)}%`;
  if (percentile < 10) return `${percentile.toFixed(1)}%`;
  return `${percentile.toFixed(0)}%`;
}

export function getPrimaryStrategy(composition: ImpactGlowScoreComposition | undefined) {
  const steeringPoints = safeNumber(composition?.steeringPoints);
  const inflationPoints = safeNumber(composition?.inflationPoints);
  const worthPoints = safeNumber(composition?.worthPoints);
  const vaultPoints = safeNumber(composition?.vaultPoints);

  const entries = [
    { key: "steering", label: "Steering heavy", points: steeringPoints },
    { key: "worth", label: "High net worth", points: worthPoints },
    { key: "inflation", label: "Emissions", points: inflationPoints },
    { key: "vault", label: "Vault bonus", points: vaultPoints },
  ] as const;

  const best = entries.reduce(
    (acc, cur) => (cur.points > acc.points ? cur : acc),
    entries[0]
  );
  return best;
}

export function getStrategyPillClasses(key: "steering" | "worth" | "inflation" | "vault") {
  if (key === "steering")
    return "border-[#22D3EE]/30 bg-[#22D3EE]/10 text-foreground dark:text-foreground";
  if (key === "inflation")
    return "border-[color:var(--color-miner)]/35 bg-[color:var(--color-miner)]/15 text-foreground dark:text-foreground";
  if (key === "vault")
    return "border-delegation-purple/35 bg-delegation-purple/15 text-foreground dark:text-foreground";
  return "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-foreground dark:text-foreground";
}


