import { describe, expect, it } from "vitest";

import {
  buildSgctlClaimActivityEntries,
  groupClaimActivityEntries,
  normalizeClaimActivityKey,
  type ClaimActivityEntry,
} from "@/app/wallet/activity-feed-claim-utils";

describe("activity feed claim utils", () => {
  it("merges onchain claim rows with SGCTL settlement rows by tx hash and log index", () => {
    const entries: ClaimActivityEntry[] = [
      {
        groupKey: normalizeClaimActivityKey("0xtx", 12),
        txHash: "0xtx" as `0x${string}`,
        logIndex: 12,
        timestampMs: 1_710_000_000_000,
        source: "rewardsKernel",
        nonce: "23",
        subIndex: 0,
        tokenSymbol: "GLW",
        amount: 10,
      },
      {
        groupKey: normalizeClaimActivityKey("0xtx", 12),
        txHash: "0xtx" as `0x${string}`,
        logIndex: 12,
        timestampMs: 1_710_000_000_000,
        source: "rewardsKernel",
        nonce: "23",
        subIndex: Number.MAX_SAFE_INTEGER,
        tokenSymbol: "SGCTL",
        amount: 124.787285,
      },
    ];

    const groups = groupClaimActivityEntries(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      txHash: "0xtx",
      logIndex: 12,
      nonce: "23",
      source: "rewardsKernel",
      tokenEntries: [
        ["SGCTL", 124.787285],
        ["GLW", 10],
      ],
    });
  });

  it("builds SGCTL settlement entries from backend rows", () => {
    const rows = buildSgctlClaimActivityEntries(
      [
        {
          txHash: "0xabc" as `0x${string}`,
          logIndex: 7,
          nonce: "4",
          weekNumber: 101,
          wallet: "0xwallet" as `0x${string}`,
          regionId: 4,
          amount: "124787285",
          blockNumber: "24000000",
          settledAt: "2026-04-11T02:30:45.000Z",
        },
      ],
      (rawAmount) => Number(rawAmount) / 1_000_000
    );

    expect(rows).toEqual([
      expect.objectContaining({
        groupKey: "0xabc:7",
        tokenSymbol: "SGCTL",
        amount: 124.787285,
        nonce: "4",
      }),
    ]);
  });
});
