import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUnstableCache } = vi.hoisted(() => ({
  mockUnstableCache: vi.fn((fn, keys, options) => ({
    fn,
    keys,
    options,
  })),
}));

vi.mock("next/cache", () => ({
  unstable_cache: mockUnstableCache,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/api/control-routers", () => ({
  getFarmsRouter: vi.fn(() => ({})),
}));

describe("estimate server cache windows", () => {
  beforeEach(() => {
    vi.resetModules();
    mockUnstableCache.mockClear();
  });

  it("configures 5-minute revalidation for reward and mining batch estimates", async () => {
    await import("../reward-scores");
    await import("../mining-scores");

    expect(mockUnstableCache).toHaveBeenCalledTimes(2);

    const rewardCacheCall = mockUnstableCache.mock.calls.find(
      (call) => call[1]?.[0] === "farms-reward-scores-batch"
    );
    const miningCacheCall = mockUnstableCache.mock.calls.find(
      (call) => call[1]?.[0] === "farms-mining-scores-batch"
    );

    expect(rewardCacheCall?.[2]).toMatchObject({
      revalidate: 300,
      tags: ["farms-reward-scores-batch"],
    });
    expect(miningCacheCall?.[2]).toMatchObject({
      revalidate: 300,
      tags: ["farms-mining-scores-batch"],
    });
  });
});
