import { describe, expect, it } from "vitest";

describe("launchpad timing helpers (consolidated 9 AM ET window)", () => {
  // April is EDT (UTC-4), so 9:00 AM ET == 13:00:00 UTC.
  it("computes the next Tuesday at 9 AM ET", async () => {
    const { getNextTuesdayAt9amET } = await import("../nextTuesdayET");

    const result = getNextTuesdayAt9amET(
      new Date("2026-04-06T15:00:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T13:00:00.000Z");
  });

  it("opens the next launchpad delegation batch at Tuesday 9 AM ET", async () => {
    const { getNextLaunchpadDelegationBatchAtET } = await import(
      "../nextTuesdayET"
    );

    const result = getNextLaunchpadDelegationBatchAtET(
      new Date("2026-04-06T15:00:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T13:00:00.000Z");
  });

  it("rolls the next launchpad delegation batch to the following Tuesday 9 AM ET once the window has passed", async () => {
    const { getNextLaunchpadDelegationBatchAtET } = await import(
      "../nextTuesdayET"
    );

    // Tue 2026-04-07 14:30:00 UTC == 10:30 AM ET, past the 9 AM open.
    const result = getNextLaunchpadDelegationBatchAtET(
      new Date("2026-04-07T14:30:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-14T13:00:00.000Z");
  });

  it("keeps the next sponsor listings batch on the same 9 AM ET Tuesday window", async () => {
    const { getNextSponsorListingsBatchAtET } = await import(
      "../nextTuesdayET"
    );

    const result = getNextSponsorListingsBatchAtET(
      new Date("2026-04-06T15:00:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T13:00:00.000Z");
  });

  it("opens the next mining batch at Tuesday 9 AM ET (no 12-hour head start)", async () => {
    const { getNextMiningCenterBatchAtET } = await import("../nextTuesdayET");

    const result = getNextMiningCenterBatchAtET(
      new Date("2026-04-06T15:00:00.000Z"),
    );

    expect(result.toISOString()).toBe("2026-04-07T13:00:00.000Z");
  });
});
