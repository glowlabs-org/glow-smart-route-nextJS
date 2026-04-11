import { describe, expect, it, vi } from "vitest";

describe("launchpad timing helpers", () => {
  it("computes the next Tuesday at 1 AM ET", async () => {
    const { getNextTuesdayAt1amET } = await import("../nextTuesdayET");

    const result = getNextTuesdayAt1amET(
      new Date("2026-04-06T15:00:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T05:00:00.000Z");
  });

  it("defaults the next launchpad delegation batch to Tuesday at 1 AM ET before the SGCTL window opens", async () => {
    const { getNextLaunchpadDelegationBatchAtET } = await import(
      "../nextTuesdayET"
    );

    const result = getNextLaunchpadDelegationBatchAtET(
      new Date("2026-04-06T15:00:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T05:00:00.000Z");
  });

  it("rolls the next launchpad delegation batch to Tuesday at 1 PM ET once the SGCTL window has started", async () => {
    const { getNextLaunchpadDelegationBatchAtET } = await import(
      "../nextTuesdayET"
    );

    const result = getNextLaunchpadDelegationBatchAtET(
      new Date("2026-04-07T14:30:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T17:00:00.000Z");
  });

  it("keeps the next sponsor listings batch on the same-day Tuesday 1 PM ET GLW handoff after the SGCTL window starts", async () => {
    const { getNextSponsorListingsBatchAtET } = await import(
      "../nextTuesdayET"
    );

    const result = getNextSponsorListingsBatchAtET(
      new Date("2026-04-07T14:30:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T17:00:00.000Z");
  });

  it("uses the local miner override for the next mining batch when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOCAL_MINER_LAUNCH_OVERRIDE", "1");
    const { getNextMiningCenterBatchAtET } = await import("../nextTuesdayET");

    const result = getNextMiningCenterBatchAtET(
      new Date("2026-04-06T15:00:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T05:00:00.000Z");
    vi.unstubAllEnvs();
  });

  it("defaults the next mining batch to Tuesday at 1 AM ET", async () => {
    const { getNextMiningCenterBatchAtET } = await import("../nextTuesdayET");

    const result = getNextMiningCenterBatchAtET(
      new Date("2026-04-06T15:00:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T05:00:00.000Z");
  });
});
