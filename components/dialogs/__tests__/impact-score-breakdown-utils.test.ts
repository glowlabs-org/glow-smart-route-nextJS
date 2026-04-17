import { describe, expect, it } from "vitest";

import { getImpactScoreDialogTotalPoints } from "@/components/dialogs/impact-score-breakdown-utils";

describe("getImpactScoreDialogTotalPoints", () => {
  it("prefers totals.totalPoints when available", () => {
    expect(
      getImpactScoreDialogTotalPoints({
        totals: {
          totalPoints: "20565.686738",
          rolloverPoints: "2159.787346",
          continuousPoints: "20.597336",
        },
      } as never),
    ).toBe("20565.686738");
  });

  it("falls back to rollover plus continuous points", () => {
    expect(
      getImpactScoreDialogTotalPoints({
        totals: {
          rolloverPoints: "2159.787346",
          continuousPoints: "20.597336",
        },
      } as never),
    ).toBe("2180.384682");
  });
});
