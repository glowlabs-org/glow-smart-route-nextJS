import { formatUnits } from "viem";
import type { GlowCirculatingSnapshotRow } from "./useGlowCirculatingSnapshot";

interface GlowCirculatingSupplyMetrics {
  circulatingSupply: number;
  totalSupply: number;
  marketCap: number;
  glowPrice: number;
}

function parseWeiToBigInt(value?: string | null): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function parseWeiToNumber(value?: string): number {
  const parsed = parseWeiToBigInt(value);
  if (parsed === null) return 0;
  return Number(formatUnits(parsed, 18));
}

function deriveAdjustedCirculatingWei(
  latestSnapshot: GlowCirculatingSnapshotRow | null | undefined,
  delegatedByWeekWei?: string | null
): bigint {
  const baseCirculatingWei = parseWeiToBigInt(latestSnapshot?.circulating_wei) ?? 0n;
  const snapshotVaultedWei =
    parseWeiToBigInt(latestSnapshot?.breakdown?.vaulted_delegated_wei) ?? 0n;
  const delegatedOverrideWei = parseWeiToBigInt(delegatedByWeekWei);

  // Snapshot circulating already subtracts snapshotVaultedWei. Replace that term with
  // delegatedOverrideWei when available to keep supply consistent across widgets.
  if (delegatedOverrideWei === null) {
    return baseCirculatingWei;
  }

  const adjusted = baseCirculatingWei + snapshotVaultedWei - delegatedOverrideWei;
  return adjusted > 0n ? adjusted : 0n;
}

export function deriveGlowCirculatingSupplyMetrics(
  latestSnapshot: GlowCirculatingSnapshotRow | null | undefined,
  spotPrice: number,
  delegatedByWeekWei?: string | null
): GlowCirculatingSupplyMetrics {
  const circulatingSupply = Number(
    formatUnits(
      deriveAdjustedCirculatingWei(latestSnapshot, delegatedByWeekWei),
      18
    )
  );
  const totalSupply = parseWeiToNumber(
    latestSnapshot?.breakdown?.total_supply_wei
  );
  const glowPrice = Number.isFinite(spotPrice) ? spotPrice : 0;
  const marketCap = circulatingSupply * glowPrice;

  return {
    circulatingSupply,
    totalSupply,
    marketCap,
    glowPrice,
  };
}
