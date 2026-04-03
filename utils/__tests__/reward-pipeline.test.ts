import { describe, expect, it } from "vitest";

import { buildPendingRewardTimeline } from "@/utils/reward-pipeline";

describe("buildPendingRewardTimeline", () => {
  it("builds the Sunday close, Friday post, and 3-week finalization schedule from a purchase date", () => {
    const timeline = buildPendingRewardTimeline({
      purchaseDate: "2026-03-31T12:00:00.000Z",
      nowMs: Date.parse("2026-04-03T12:00:00.000Z"),
    });

    expect(new Date(timeline.epochEndsAtMs).toISOString()).toBe(
      "2026-04-05T00:00:00.000Z"
    );
    expect(new Date(timeline.auditPostedAtMs).toISOString()).toBe(
      "2026-04-10T00:00:00.000Z"
    );
    expect(new Date(timeline.claimableAtMs).toISOString()).toBe(
      "2026-05-01T00:00:00.000Z"
    );
    expect(timeline.phase).toBe("epoch");
  });

  it("moves through audit and finalization phases before claimable", () => {
    const duringAudit = buildPendingRewardTimeline({
      purchaseDate: "2026-03-31T12:00:00.000Z",
      nowMs: Date.parse("2026-04-08T12:00:00.000Z"),
    });
    const duringFinalization = buildPendingRewardTimeline({
      purchaseDate: "2026-03-31T12:00:00.000Z",
      nowMs: Date.parse("2026-04-20T12:00:00.000Z"),
    });
    const afterFinalization = buildPendingRewardTimeline({
      purchaseDate: "2026-03-31T12:00:00.000Z",
      nowMs: Date.parse("2026-05-02T12:00:00.000Z"),
    });

    expect(duringAudit.phase).toBe("audit");
    expect(duringFinalization.phase).toBe("finalization");
    expect(afterFinalization.phase).toBe("claimable");
  });
});
