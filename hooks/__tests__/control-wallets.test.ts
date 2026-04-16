import { afterEach, describe, expect, it, vi } from "vitest";

import {
  calculateImpactEligibleStakedGctl,
  fetchWalletRegionAvailableStakeBatch,
  getRewardCurrencyDecimals,
} from "../control-wallets";

const originalControlApiUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;

describe("calculateImpactEligibleStakedGctl", () => {
  it("counts total staked, delegated, and protocol deposit SGCTL toward impact", () => {
    expect(
      calculateImpactEligibleStakedGctl({
        availableStakedGctl: "2870419030",
        totalStakedAndNotUsedInProtocolFees: "2870419030",
        delegatedSgctlVaultBalance: "25336980000",
        protocolDepositVaultBalance: "55792546932",
      }),
    ).toBe(83999945962n);
  });

  it("does not use available stake as the total impact basis", () => {
    expect(
      calculateImpactEligibleStakedGctl({
        availableStakedGctl: "100",
        totalStakedAndNotUsedInProtocolFees: "250",
        delegatedSgctlVaultBalance: "10",
        protocolDepositVaultBalance: "20",
      }),
    ).toBe(280n);
  });

  it("handles missing fields safely", () => {
    expect(calculateImpactEligibleStakedGctl()).toBe(0n);
    expect(
      calculateImpactEligibleStakedGctl({
        totalStakedAndNotUsedInProtocolFees: "100",
      }),
    ).toBe(100n);
  });
});

describe("getRewardCurrencyDecimals", () => {
  it("maps SGCTL to the staked GCTL decimal precision", () => {
    expect(getRewardCurrencyDecimals("SGCTL")).toBe(6);
  });
});

describe("fetchWalletRegionAvailableStakeBatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalControlApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CONTROL_API_URL;
    } else {
      process.env.NEXT_PUBLIC_CONTROL_API_URL = originalControlApiUrl;
    }
  });

  it("batches and normalizes region requests into a single POST", async () => {
    process.env.NEXT_PUBLIC_CONTROL_API_URL = "https://control.example";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        wallet: "0xabc",
        results: [
          {
            regionId: 3,
            availableStakedGctl: "15",
          },
          {
            regionId: 8,
            availableStakedGctl: "42",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWalletRegionAvailableStakeBatch("0xabc", [
      8,
      3,
      8,
      Number.NaN,
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://control.example/wallet/0xabc/available-stake/batch",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regionIds: [3, 8] }),
      }),
    );
    expect(result.get(3)?.availableStakedGctl).toBe("15");
    expect(result.get(8)?.availableStakedGctl).toBe("42");
  });
});
