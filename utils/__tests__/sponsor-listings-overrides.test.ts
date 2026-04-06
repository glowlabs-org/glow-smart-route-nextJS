import { describe, expect, it, vi } from "vitest";
import {
  applyLocalSponsorListingOverrides,
  isLocalMinerLaunchpadDuplicate,
} from "../sponsor-listings-overrides";

describe("applyLocalSponsorListingOverrides", () => {
  it("updates the local mini miner visibility timestamp when enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_LOCAL_MINER_LAUNCH_OVERRIDE", "1");

    const applications = [
      {
        id: "54c1ce52-15d3-4dbd-85d0-eb06f6feed8a",
        publishedOnAuctionTimestamp: "2026-04-07T17:00:00.000Z",
        activeFraction: {
          type: "mining-center",
          marketplaceVisibleAt: "2026-04-07T17:00:00.000Z",
        },
      },
    ] as any;

    const [result] = applyLocalSponsorListingOverrides(applications);

    expect(result.publishedOnAuctionTimestamp).toBe("2026-04-07T05:00:00.000Z");
    expect(result.activeFraction?.marketplaceVisibleAt).toBe(
      "2026-04-07T05:00:00.000Z",
    );

    vi.unstubAllEnvs();
  });

  it("does not move a launchpad delegation for the same application", () => {
    vi.stubEnv("NEXT_PUBLIC_LOCAL_MINER_LAUNCH_OVERRIDE", "1");

    const applications = [
      {
        id: "54c1ce52-15d3-4dbd-85d0-eb06f6feed8a",
        publishedOnAuctionTimestamp: "2026-04-07T17:00:00.000Z",
        activeFraction: {
          type: "launchpad",
          marketplaceVisibleAt: "2026-04-07T17:00:00.000Z",
        },
      },
    ] as any;

    const [result] = applyLocalSponsorListingOverrides(applications);

    expect(result.publishedOnAuctionTimestamp).toBe("2026-04-07T17:00:00.000Z");
    expect(result.activeFraction?.marketplaceVisibleAt).toBe(
      "2026-04-07T17:00:00.000Z",
    );

    vi.unstubAllEnvs();
  });

  it("identifies the launchpad duplicate for local filtering", () => {
    vi.stubEnv("NEXT_PUBLIC_LOCAL_MINER_LAUNCH_OVERRIDE", "1");

    expect(
      isLocalMinerLaunchpadDuplicate({
        id: "54c1ce52-15d3-4dbd-85d0-eb06f6feed8a",
        activeFraction: { type: "launchpad" },
      } as any),
    ).toBe(true);

    expect(
      isLocalMinerLaunchpadDuplicate({
        id: "54c1ce52-15d3-4dbd-85d0-eb06f6feed8a",
        activeFraction: { type: "mining-center" },
      } as any),
    ).toBe(false);

    vi.unstubAllEnvs();
  });
});
