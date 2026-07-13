import { describe, expect, it, vi } from "vitest";
import type { Address, WalletClient } from "viem";

import {
  assertWalletClientForOrder,
  getExpectedChainId,
} from "@/lib/wallet-chain";

const expected = "0x0000000000000000000000000000000000000010" as Address;
const changed = "0x0000000000000000000000000000000000000020" as Address;

describe("assertWalletClientForOrder", () => {
  const expectedChainId = getExpectedChainId();

  function wallet(
    activeAccount: Address,
    activeChainId = expectedChainId,
  ): WalletClient {
    return {
      account: { address: expected },
      chain: { id: expectedChainId },
      getAddresses: async () => [activeAccount],
      getChainId: async () => activeChainId,
    } as unknown as WalletClient;
  }

  it("accepts the pinned account on the configured chain", async () => {
    await expect(
      assertWalletClientForOrder(wallet(expected), expected),
    ).resolves.toBeUndefined();
  });

  it("detects a provider account change even when the client snapshot is stale", async () => {
    await expect(
      assertWalletClientForOrder(wallet(changed), expected),
    ).rejects.toThrow("Wallet account changed");
  });

  it("detects a provider chain change even when the client snapshot is stale", async () => {
    const otherChainId = expectedChainId === 1 ? 11155111 : 1;
    await expect(
      assertWalletClientForOrder(wallet(expected, otherChainId), expected),
    ).rejects.toThrow("Wrong network");
  });

  it("starts live chain and account reads in parallel", async () => {
    let resolveChain: ((value: number) => void) | undefined;
    let resolveAddresses: ((value: Address[]) => void) | undefined;
    const getChainId = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveChain = resolve;
        }),
    );
    const getAddresses = vi.fn(
      () =>
        new Promise<Address[]>((resolve) => {
          resolveAddresses = resolve;
        }),
    );
    const client = {
      account: { address: expected },
      chain: { id: expectedChainId },
      getChainId,
      getAddresses,
    } as unknown as WalletClient;

    const pending = assertWalletClientForOrder(client, expected);

    expect(getChainId).toHaveBeenCalledOnce();
    expect(getAddresses).toHaveBeenCalledOnce();

    resolveChain?.(expectedChainId);
    resolveAddresses?.([expected]);
    await expect(pending).resolves.toBeUndefined();
  });
});
