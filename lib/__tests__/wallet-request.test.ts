import { afterEach, describe, expect, it, vi } from "vitest";
import { mainnet } from "viem/chains";
import { parseAbi, type WalletClient } from "viem";

import {
  WALLET_RESPONSE_TIMEOUT_MS,
  WalletResponseTimeoutError,
  requestWithWalletLifecycle,
  writeContractWithWalletLifecycle,
} from "@/lib/wallet-request";

describe("requestWithWalletLifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("observes the exact wallet send boundary and dispatches once", async () => {
    const order: string[] = [];
    const request = vi.fn(async () => {
      order.push("provider");
      return "0xabc";
    });
    const onEvent = vi.fn((event) => order.push(event.phase));

    await expect(
      requestWithWalletLifecycle(
        request,
        { method: "eth_sendTransaction", params: [{ to: "0x1" }] },
        { action: "swap", onEvent },
      ),
    ).resolves.toBe("0xabc");

    expect(order).toEqual(["dispatched", "provider", "resolved"]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      { method: "eth_sendTransaction", params: [{ to: "0x1" }] },
      { retryCount: 0 },
    );
    expect(onEvent.mock.calls.map(([event]) => event.phase)).toEqual([
      "dispatched",
      "resolved",
    ]);
  });

  it("times out without retrying or emitting a late resolution", async () => {
    vi.useFakeTimers();
    let resolveProvider: ((value: unknown) => void) | undefined;
    const request = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveProvider = resolve;
        }),
    );
    const phases: string[] = [];

    const pending = requestWithWalletLifecycle(
      request,
      { method: "eth_sendTransaction" },
      {
        action: "swap",
        onEvent: (event) => phases.push(event.phase),
      },
    );
    const rejection = expect(pending).rejects.toBeInstanceOf(
      WalletResponseTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(WALLET_RESPONSE_TIMEOUT_MS);
    await rejection;

    expect(request).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(["dispatched", "timed_out"]);

    resolveProvider?.("0xlate");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(WALLET_RESPONSE_TIMEOUT_MS);

    expect(request).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(["dispatched", "timed_out"]);
  });

  it("reports provider rejection once", async () => {
    const rejection = new Error("User rejected the request");
    const request = vi.fn().mockRejectedValue(rejection);
    const phases: string[] = [];

    await expect(
      requestWithWalletLifecycle(
        request,
        { method: "eth_sendTransaction" },
        {
          action: "swap",
          onEvent: (event) => phases.push(event.phase),
        },
      ),
    ).rejects.toBe(rejection);

    expect(request).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(["dispatched", "rejected"]);
  });

  it("passes non-send provider calls through without lifecycle events", async () => {
    const request = vi.fn().mockResolvedValue("0x1");
    const onEvent = vi.fn();

    await expect(
      requestWithWalletLifecycle(
        request,
        { method: "eth_chainId" },
        { action: "read", onEvent },
      ),
    ).resolves.toBe("0x1");

    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith({ method: "eth_chainId" });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("bypasses viem's pre-bound send action and observes its provider request", async () => {
    const request = vi.fn().mockResolvedValue(`0x${"a".repeat(64)}`);
    const preboundSendTransaction = vi.fn();
    const client = {
      account: {
        address: "0x0000000000000000000000000000000000000010",
        type: "json-rpc",
      },
      chain: mainnet,
      uid: "wallet-request-test",
      getChainId: vi.fn().mockResolvedValue(mainnet.id),
      request,
      sendTransaction: preboundSendTransaction,
    } as unknown as WalletClient;
    const phases: string[] = [];

    await writeContractWithWalletLifecycle(
      client,
      {
        address: "0x0000000000000000000000000000000000000020",
        abi: parseAbi(["function approve(address spender, uint256 amount)"]),
        functionName: "approve",
        args: ["0x0000000000000000000000000000000000000030", 1n],
        account: client.account,
        chain: mainnet,
      },
      {
        action: "approve",
        onEvent: (event) => phases.push(event.phase),
      },
    );

    expect(preboundSendTransaction).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_sendTransaction" }),
      { retryCount: 0 },
    );
    expect(phases).toEqual(["dispatched", "resolved"]);
  });
});
