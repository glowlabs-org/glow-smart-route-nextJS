import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import { mainnet } from "viem/chains";
import { instrumentedFallback } from "@/lib/viem-rpc-logging";

// Ports nothing listens on, so every leg fails immediately with a connection
// error instead of reaching the network.
// Trailing segment stays short so URL masking leaves it intact.
const FIRST_URL = "http://127.0.0.1:9/first/rpc";
const SECOND_URL = "http://127.0.0.1:9/second/rpc";

function reportedUrl(): string | null {
  const call = captureException.mock.calls.at(-1);
  return (call?.[1] as { extra?: { rpc_url?: string | null } })?.extra?.rpc_url ?? null;
}

describe("instrumentedFallback error attribution", () => {
  beforeEach(() => {
    captureException.mockClear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports the URL that actually failed, not always the first one", async () => {
    // Both legs fail, so fallback surfaces the last leg's error. Before the
    // per-leg tagging this was filed against urls[0] regardless, which sent
    // anyone reading Sentry to the wrong provider.
    const transport = instrumentedFallback(
      [FIRST_URL, SECOND_URL],
      { retryCount: 0, timeout: 1_000 },
      { source: "test" }
    )({ chain: mainnet });

    await expect(
      transport.request({ method: "eth_blockNumber" })
    ).rejects.toThrow();

    const url = reportedUrl();
    expect(url).toBeTruthy();
    expect(url).toContain("/second/");
    expect(url).not.toContain("/first/");
  }, 20_000);

  it("masks the credential segment of the reported URL", async () => {
    const transport = instrumentedFallback(
      ["http://127.0.0.1:9/v2/SUPERSECRETKEYVALUE"],
      { retryCount: 0, timeout: 1_000 },
      { source: "test-masking" }
    )({ chain: mainnet });

    await expect(
      transport.request({ method: "eth_chainId" })
    ).rejects.toThrow();

    expect(reportedUrl()).not.toContain("SUPERSECRETKEYVALUE");
  }, 20_000);
});
