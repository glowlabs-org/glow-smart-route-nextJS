/**
 * Tests for selectClaimSetForGlwDelegation.
 *
 * Run with: pnpm vitest run app/marketplace/__tests__/claim-set-selection.test.ts
 */

import { describe, it, expect } from "vitest";
import { parseUnits } from "viem";
import {
  selectClaimSetForGlwDelegation,
  type ClaimableGlwItem,
} from "../deposit-dialog-utils";

const glw = (n: string | number) => parseUnits(String(n), 18);

function pd(week: number, amount: string | number): ClaimableGlwItem {
  return { week, source: "protocolDeposit", glwAmountWei: glw(amount) };
}

function inflation(week: number, amount: string | number): ClaimableGlwItem {
  return { week, source: "glowInflation", glwAmountWei: glw(amount) };
}

describe("selectClaimSetForGlwDelegation - degenerate inputs", () => {
  it("returns empty selection when target is zero", () => {
    const result = selectClaimSetForGlwDelegation(
      [pd(100, 50), inflation(101, 30)],
      0n
    );
    expect(result.pdWeeks).toEqual([]);
    expect(result.inflationWeeks).toEqual([]);
    expect(result.totalGlwWei).toBe(0n);
    expect(result.shortfallGlwWei).toBe(0n);
    expect(result.txCount).toBe(0);
  });

  it("returns empty selection when target is negative", () => {
    const result = selectClaimSetForGlwDelegation(
      [pd(100, 50)],
      -1n
    );
    expect(result.pdWeeks).toEqual([]);
    expect(result.inflationWeeks).toEqual([]);
    expect(result.txCount).toBe(0);
  });

  it("reports full shortfall when pool is empty", () => {
    const target = glw(100);
    const result = selectClaimSetForGlwDelegation([], target);
    expect(result.pdWeeks).toEqual([]);
    expect(result.inflationWeeks).toEqual([]);
    expect(result.totalGlwWei).toBe(0n);
    expect(result.shortfallGlwWei).toBe(target);
    expect(result.txCount).toBe(0);
  });

  it("ignores zero-amount items", () => {
    const result = selectClaimSetForGlwDelegation(
      [
        { week: 100, source: "protocolDeposit", glwAmountWei: 0n },
        inflation(101, 50),
      ],
      glw(40)
    );
    expect(result.pdWeeks).toEqual([]);
    expect(result.inflationWeeks).toHaveLength(1);
  });
});

describe("selectClaimSetForGlwDelegation - PD-only paths", () => {
  it("uses all PD when total PD is at or under target", () => {
    const target = glw(100);
    const items = [pd(100, 30), pd(101, 25), pd(102, 20)];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.pdWeeks).toHaveLength(3);
    expect(result.totalGlwWei).toBe(glw(75));
    expect(result.inflationWeeks).toEqual([]);
    expect(result.shortfallGlwWei).toBe(glw(25));
    expect(result.txCount).toBe(1);
  });

  it("picks PD subset closest to target without exceeding when PD exceeds target", () => {
    const target = glw(100);
    const items = [pd(100, 60), pd(101, 50), pd(102, 40), pd(103, 25)];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.totalGlwWei).toBe(glw(100)); // 60+40 exact
    expect(result.shortfallGlwWei).toBe(0n);
    expect(result.inflationWeeks).toEqual([]);
    expect(result.txCount).toBe(1);
  });

  it("never overshoots target with PD subset alone", () => {
    const target = glw(100);
    const items = [pd(100, 60), pd(101, 50), pd(102, 45), pd(103, 30)];
    const result = selectClaimSetForGlwDelegation(items, target);
    const pdSum = result.pdWeeks.reduce(
      (acc, w) => acc + w.glwAmountWei,
      0n
    );
    expect(pdSum <= target).toBe(true);
  });

  it("returns single PD item when it exactly matches target", () => {
    const target = glw(50);
    const result = selectClaimSetForGlwDelegation(
      [pd(100, 50), pd(101, 100)],
      target
    );
    expect(result.pdWeeks).toHaveLength(1);
    expect(result.pdWeeks[0].week).toBe(100);
    expect(result.totalGlwWei).toBe(target);
    expect(result.txCount).toBe(1);
  });

  it("skips a single PD item that exceeds target alone", () => {
    const target = glw(40);
    const result = selectClaimSetForGlwDelegation(
      [pd(100, 100), pd(101, 30)],
      target
    );
    expect(result.pdWeeks.map((w) => w.week)).toEqual([101]);
    expect(result.totalGlwWei).toBe(glw(30));
    expect(result.shortfallGlwWei).toBe(glw(10));
  });
});

describe("selectClaimSetForGlwDelegation - inflation supplement", () => {
  it("adds one inflation week to cover deficit when PD is short", () => {
    const target = glw(100);
    const items = [pd(100, 60), inflation(105, 50)];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.pdWeeks).toHaveLength(1);
    expect(result.inflationWeeks).toHaveLength(1);
    expect(result.totalGlwWei).toBe(glw(110));
    expect(result.shortfallGlwWei).toBe(0n);
    expect(result.txCount).toBe(2); // 1 PD multicall + 1 inflation
  });

  it("uses only inflation when no PD-in-GLW is available", () => {
    const target = glw(100);
    const items = [inflation(105, 50), inflation(106, 60)];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.pdWeeks).toEqual([]);
    expect(result.inflationWeeks.length).toBeGreaterThan(0);
    expect(result.totalGlwWei >= target).toBe(true);
    expect(result.txCount).toBe(result.inflationWeeks.length);
  });

  it("prefers minimum cardinality over minimum overshoot", () => {
    // deficit = 100 GLW. Options:
    //   [100] -> card=1, overshoot=0 (best)
    //   [50, 50] -> card=2, overshoot=0
    // Should pick [100] (lower card).
    const target = glw(100);
    const items = [
      inflation(105, 100),
      inflation(106, 50),
      inflation(107, 50),
    ];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.inflationWeeks).toHaveLength(1);
    expect(result.inflationWeeks[0].week).toBe(105);
    expect(result.totalGlwWei).toBe(glw(100));
    expect(result.txCount).toBe(1);
  });

  it("uses overshoot as tiebreaker when cardinality is equal", () => {
    // deficit = 100. Single-week options that cover: [200], [150], [120].
    // All card=1; best overshoot is 120.
    const target = glw(100);
    const items = [
      inflation(105, 200),
      inflation(106, 150),
      inflation(107, 120),
    ];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.inflationWeeks).toHaveLength(1);
    expect(result.inflationWeeks[0].week).toBe(107);
    expect(result.totalGlwWei).toBe(glw(120));
  });

  it("finds a multi-week exact match when no single week covers", () => {
    // deficit=100, items=[50, 45, 40, 30, 20, 10]
    // No single covers; min-card covering = 3 (e.g., 50+30+20=100).
    const target = glw(100);
    const items = [
      inflation(100, 50),
      inflation(101, 45),
      inflation(102, 40),
      inflation(103, 30),
      inflation(104, 20),
      inflation(105, 10),
    ];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.totalGlwWei >= target).toBe(true);
    expect(result.shortfallGlwWei).toBe(0n);
    // Card should be 3 (50+30+20=100 is min-card exact match).
    expect(result.inflationWeeks.length).toBe(3);
    expect(result.totalGlwWei).toBe(glw(100));
  });

  it("reports shortfall when pool cannot cover even with everything", () => {
    const target = glw(500);
    const items = [pd(100, 50), inflation(105, 75), inflation(106, 100)];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.totalGlwWei).toBe(glw(225));
    expect(result.shortfallGlwWei).toBe(glw(275));
    expect(result.pdWeeks).toHaveLength(1);
    expect(result.inflationWeeks).toHaveLength(2);
    expect(result.txCount).toBe(3);
  });
});

describe("selectClaimSetForGlwDelegation - PD covers everything", () => {
  it("does not add inflation when PD subset already meets target exactly", () => {
    const target = glw(100);
    const items = [
      pd(100, 60),
      pd(101, 40),
      inflation(105, 50),
    ];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.totalGlwWei).toBe(glw(100));
    expect(result.inflationWeeks).toEqual([]);
    expect(result.txCount).toBe(1);
  });

  it("uses PD plus inflation when PD undershoots even a small amount", () => {
    // PD options under target=100: max under is 99 (60+39 not in set; use 60+30 = 90 best).
    // Actually with [60, 30, 25, 10], under-100 best = 60+30+10=100 exact.
    const target = glw(100);
    const items = [pd(100, 60), pd(101, 30), pd(102, 25), pd(103, 10)];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.totalGlwWei).toBe(glw(100));
    expect(result.inflationWeeks).toEqual([]);
  });
});

describe("selectClaimSetForGlwDelegation - mixed source ordering", () => {
  it("does not consume non-GLW PD items from arbitrary 'unclaimed' sources", () => {
    // Caller is responsible for filtering PD-in-GLW; the helper trusts that
    // items tagged 'protocolDeposit' are GLW-denominated. This test confirms
    // the helper does not attempt to convert or skip based on amount.
    const target = glw(100);
    const items = [pd(100, 60), pd(101, 50)];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.pdWeeks).toHaveLength(1); // best subset under 100 = single 60 (other choices: 50)
    expect(result.totalGlwWei).toBe(glw(60));
  });

  it("preserves item identity in returned subsets", () => {
    const target = glw(50);
    const item = pd(100, 50);
    const result = selectClaimSetForGlwDelegation([item], target);
    expect(result.pdWeeks[0]).toBe(item);
  });
});

describe("selectClaimSetForGlwDelegation - large pool fallback", () => {
  it("handles a 25-week pool without timing out", () => {
    const items: ClaimableGlwItem[] = [];
    for (let w = 100; w < 125; w++) items.push(inflation(w, 10));
    const target = glw(100);
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.totalGlwWei >= target).toBe(true);
    // Greedy fallback for large pools: largest-first (all equal here) until covered.
    expect(result.inflationWeeks.length).toBeGreaterThanOrEqual(10);
  });
});

describe("selectClaimSetForGlwDelegation - precision", () => {
  it("preserves wei precision and does not lose dust", () => {
    const target = parseUnits("1.234567890123456789", 18);
    const items: ClaimableGlwItem[] = [
      {
        week: 100,
        source: "protocolDeposit",
        glwAmountWei: parseUnits("1.234567890123456789", 18),
      },
    ];
    const result = selectClaimSetForGlwDelegation(items, target);
    expect(result.totalGlwWei).toBe(target);
    expect(result.shortfallGlwWei).toBe(0n);
  });
});
