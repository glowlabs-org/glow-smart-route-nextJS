import { formatUnits } from "viem";
import type { GlowCirculatingSnapshotRow } from "./useGlowCirculatingSnapshot";

interface GlowCirculatingSupplyMetrics {
  circulatingSupply: number;
  totalSupply: number;
  marketCap: number;
  glowPrice: number;
}

function parseWeiToNumber(value?: string): number {
  if (!value) return 0;
  try {
    return Number(formatUnits(BigInt(value), 18));
  } catch {
    return 0;
  }
}

export function deriveGlowCirculatingSupplyMetrics(
  latestSnapshot: GlowCirculatingSnapshotRow | null | undefined,
  spotPrice: number
): GlowCirculatingSupplyMetrics {
  const circulatingSupply = parseWeiToNumber(latestSnapshot?.circulating_wei);
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
