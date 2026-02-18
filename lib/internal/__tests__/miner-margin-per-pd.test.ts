import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import {
  computeMinerMarginPerPd,
  parseProtocolDepositFromPayment,
} from "../miner-margin-per-pd";

describe("parseProtocolDepositFromPayment", () => {
  it("parses GLW payment amounts with token decimals", () => {
    expect(
      parseProtocolDepositFromPayment({
        paymentAmount: parseUnits("12.5", 18).toString(),
        paymentCurrency: "GLW",
      })
    ).toBeCloseTo(12.5, 8);
  });

  it("parses USDG payment amounts with token decimals", () => {
    expect(
      parseProtocolDepositFromPayment({
        paymentAmount: parseUnits("3.75", 6).toString(),
        paymentCurrency: "USDG",
      })
    ).toBeCloseTo(3.75, 8);
  });
});

describe("computeMinerMarginPerPd", () => {
  it("aggregates all mining farms and returns per-region totals", () => {
    const summary = computeMinerMarginPerPd([
      {
        appId: "farm-a",
        regionId: 1,
        regionName: "Region A",
        minerSalesUsd: 1000,
        bountyUsd: 100,
        protocolDepositPaid: 150,
        minerStepsSold: 2,
      },
      {
        appId: "farm-b",
        regionId: 2,
        regionName: "Region B",
        minerSalesUsd: 500,
        bountyUsd: 0,
        protocolDepositPaid: 50,
        minerStepsSold: 1,
      },
      {
        appId: "farm-c",
        regionId: 3,
        regionName: "Region C",
        minerSalesUsd: 900,
        bountyUsd: 90,
        protocolDepositPaid: 100,
        minerStepsSold: 1,
      },
    ]);

    expect(summary.overall.totalPdPaid).toBeCloseTo(300, 8);
    expect(summary.overall.marginUsd).toBeCloseTo(2210, 8);
    expect(summary.overall.marginPerPd).toBeCloseTo(2210 / 300, 8);
    expect(summary.overall.farmCount).toBe(3);

    const regionA = summary.byRegion.find((region) => region.regionId === 1);
    const regionB = summary.byRegion.find((region) => region.regionId === 2);
    const regionC = summary.byRegion.find((region) => region.regionId === 3);

    expect(regionA?.totalPdPaid).toBeCloseTo(150, 8);
    expect(regionA?.marginPerPd).toBeCloseTo(6, 8);
    expect(regionB?.totalPdPaid).toBeCloseTo(50, 8);
    expect(regionB?.marginPerPd).toBeCloseTo(10, 8);
    expect(regionC?.totalPdPaid).toBeCloseTo(100, 8);
    expect(regionC?.marginPerPd).toBeCloseTo(8.1, 8);
  });

  it("skips farms with no sold miner steps", () => {
    const summary = computeMinerMarginPerPd([
      {
        appId: "farm-a",
        regionId: 1,
        regionName: "Region A",
        minerSalesUsd: 1000,
        bountyUsd: 100,
        protocolDepositPaid: 150,
        minerStepsSold: 0,
      },
    ]);

    expect(summary.overall.farmCount).toBe(0);
    expect(summary.overall.totalSalesUsd).toBe(0);
    expect(summary.overall.totalPdPaid).toBe(0);
    expect(summary.overall.marginPerPd).toBeNull();
    expect(summary.byRegion).toHaveLength(0);
  });

  it("returns null marginPerPd when PD denominator is zero", () => {
    const summary = computeMinerMarginPerPd([
      {
        appId: "farm-a",
        regionId: 1,
        regionName: "Region A",
        minerSalesUsd: 800,
        bountyUsd: 50,
        protocolDepositPaid: 0,
        minerStepsSold: 1,
      },
    ]);

    expect(summary.overall.marginUsd).toBe(750);
    expect(summary.overall.totalPdPaid).toBe(0);
    expect(summary.overall.marginPerPd).toBeNull();
  });
});
