import { describe, expect, it } from "vitest";

import { resolveDisplayLifetimeLq } from "../hooks/usePolRevenue";

describe("resolveDisplayLifetimeLq", () => {
  it("returns the raw lifetime value when it is already non-negative", () => {
    expect(
      resolveDisplayLifetimeLq({
        lifetime_lq: "235216289591775572",
        lifetime_attributed_lq: "235216289591775572",
      })
    ).toBeCloseTo(235216.28959177557);
  });

  it("falls back to attributed lifetime when the net lifetime is negative", () => {
    expect(
      resolveDisplayLifetimeLq({
        lifetime_lq: "-12649612725211061",
        lifetime_attributed_lq: "197862387441885388",
      })
    ).toBeCloseTo(197862.38744188537);
  });

  it("clamps to zero when the only available lifetime value is negative", () => {
    expect(
      resolveDisplayLifetimeLq({
        lifetime_lq: "-1000000000000",
      })
    ).toBe(0);
  });
});
