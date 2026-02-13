import { describe, expect, it } from "vitest";
import { formatUnits, parseUnits } from "viem";
import { deriveGlowCirculatingSupplyMetrics } from "../hooks/glow-circulating-supply-utils";
import type { GlowCirculatingSnapshotRow } from "../hooks/useGlowCirculatingSnapshot";

function createSnapshotRow(
  overrides: Partial<GlowCirculatingSnapshotRow> = {}
): GlowCirculatingSnapshotRow {
  return {
    week: 115,
    is_partial: true,
    circulating_wei: parseUnits("23800000", 18).toString(),
    circulating_glw: "23800000",
    breakdown: {
      total_supply_wei: parseUnits("180000000", 18).toString(),
      carbon_credit_auction_wei: "0",
      grants_treasury_wei: "0",
      veto_council_wei: "0",
      gca_and_miner_pool_wei: "0",
      glow_contract_wei: "0",
      early_liquidity_wei: "0",
      pol_glw_in_positions_wei: "0",
      vaulted_delegated_wei: "0",
      miner_allocated_wei: "0",
      miner_claimed_wei: "0",
      yet_to_be_claimed_wei: "0",
    },
    ...overrides,
  };
}

describe("deriveGlowCirculatingSupplyMetrics", () => {
  it("derives circulating supply, total supply, and market cap from API snapshot row", () => {
    const row = createSnapshotRow({
      circulating_wei: parseUnits("23799999.123456789123456789", 18).toString(),
      breakdown: {
        ...createSnapshotRow().breakdown,
        total_supply_wei: parseUnits("179999999.5", 18).toString(),
      },
    });

    const result = deriveGlowCirculatingSupplyMetrics(row, 0.3105);

    expect(result.circulatingSupply).toBeCloseTo(23799999.12345679, 8);
    expect(result.totalSupply).toBeCloseTo(179999999.5, 6);
    expect(result.glowPrice).toBe(0.3105);
    expect(result.marketCap).toBeCloseTo(result.circulatingSupply * 0.3105, 6);
  });

  it("replaces snapshot vaulted delegated term with delegated-by-week override", () => {
    const row = createSnapshotRow({
      circulating_wei: "23796774472425106952085797",
      breakdown: {
        ...createSnapshotRow().breakdown,
        total_supply_wei: "43144454480820105769093366",
        vaulted_delegated_wei: "0",
      },
    });
    const delegatedByWeekWei = "2484459260955067821057365";

    const result = deriveGlowCirculatingSupplyMetrics(
      row,
      0.31209756002327427,
      delegatedByWeekWei
    );

    const expectedCirculating = Number(
      formatUnits(BigInt(row.circulating_wei) - BigInt(delegatedByWeekWei), 18)
    );

    expect(result.circulatingSupply).toBeCloseTo(expectedCirculating, 8);
    expect(result.marketCap).toBeCloseTo(
      expectedCirculating * 0.31209756002327427,
      6
    );
  });

  it("does not double-subtract when snapshot already includes vaulted delegated", () => {
    const row = createSnapshotRow({
      circulating_wei: parseUnits("100", 18).toString(),
      breakdown: {
        ...createSnapshotRow().breakdown,
        total_supply_wei: parseUnits("150", 18).toString(),
        vaulted_delegated_wei: parseUnits("20", 18).toString(),
      },
    });

    const result = deriveGlowCirculatingSupplyMetrics(
      row,
      1,
      parseUnits("20", 18).toString()
    );

    expect(result.circulatingSupply).toBe(100);
    expect(result.marketCap).toBe(100);
  });

  it("returns zeros when snapshot row is missing", () => {
    const result = deriveGlowCirculatingSupplyMetrics(null, 0.5);

    expect(result).toEqual({
      circulatingSupply: 0,
      totalSupply: 0,
      marketCap: 0,
      glowPrice: 0.5,
    });
  });

  it("uses zero glow price for non-finite spot prices", () => {
    const row = createSnapshotRow();

    expect(deriveGlowCirculatingSupplyMetrics(row, Number.NaN)).toEqual({
      circulatingSupply: 23800000,
      totalSupply: 180000000,
      marketCap: 0,
      glowPrice: 0,
    });

    expect(deriveGlowCirculatingSupplyMetrics(row, Number.POSITIVE_INFINITY))
      .toEqual({
        circulatingSupply: 23800000,
        totalSupply: 180000000,
        marketCap: 0,
        glowPrice: 0,
      });
  });

  it("falls back to zero when API payload contains malformed wei values", () => {
    const row = createSnapshotRow({
      circulating_wei: "not-a-number",
      breakdown: {
        ...createSnapshotRow().breakdown,
        total_supply_wei: "",
      },
    });

    const result = deriveGlowCirculatingSupplyMetrics(row, 0.25);

    expect(result).toEqual({
      circulatingSupply: 0,
      totalSupply: 0,
      marketCap: 0,
      glowPrice: 0.25,
    });
  });

  it("ignores malformed delegated override and keeps snapshot circulating value", () => {
    const row = createSnapshotRow({
      circulating_wei: parseUnits("123.456", 18).toString(),
    });

    const result = deriveGlowCirculatingSupplyMetrics(row, 1, "bad-value");
    expect(result.circulatingSupply).toBeCloseTo(123.456, 6);
  });
});
