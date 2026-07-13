import { afterEach, describe, expect, it, vi } from "vitest";
import type { Address } from "viem";

import {
  getSmartAccountStatus,
  isSmartAccountPreflightReusable,
  type SmartAccountPreflight,
} from "../detectSmartAccount";

const address = "0x0000000000000000000000000000000000000010" as Address;
const originalEthereumDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "ethereum",
);

describe("smart-account detection", () => {
  afterEach(() => {
    if (originalEthereumDescriptor) {
      Object.defineProperty(window, "ethereum", originalEthereumDescriptor);
    } else {
      delete (window as typeof window & { ethereum?: unknown }).ethereum;
    }
    vi.restoreAllMocks();
  });

  it("starts capability and bytecode reads in parallel with scoped params", async () => {
    let resolveCapabilities: ((value: unknown) => void) | undefined;
    let resolveBytecode: ((value: "0x") => void) | undefined;
    const request = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCapabilities = resolve;
        }),
    );
    const getBytecode = vi.fn(
      () =>
        new Promise<"0x">((resolve) => {
          resolveBytecode = resolve;
        }),
    );

    const pending = getSmartAccountStatus({
      address,
      chainId: 1,
      walletClient: { transport: { request } },
      getBytecode,
    });

    expect(request).toHaveBeenCalledWith({
      method: "wallet_getCapabilities",
      params: [address, ["0x1"]],
    });
    expect(getBytecode).toHaveBeenCalledWith({ address });

    resolveCapabilities?.({
      "0x1": { wallet_sendCalls: { enabled: true } },
    });
    resolveBytecode?.("0x");

    await expect(pending).resolves.toMatchObject({
      hasWalletAABatching: true,
      isContractWallet: false,
    });
  });

  it("does not duplicate capability requests through window.ethereum", async () => {
    const injectedRequest = vi.fn();
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { request: injectedRequest },
    });
    const transportRequest = vi.fn().mockRejectedValue(new Error("unsupported"));

    await getSmartAccountStatus({
      address,
      chainId: 1,
      walletClient: { transport: { request: transportRequest } },
      getBytecode: vi.fn().mockResolvedValue("0x"),
    });

    expect(transportRequest).toHaveBeenCalledOnce();
    expect(injectedRequest).not.toHaveBeenCalled();
  });

  it("reuses preflight only for the same account, chain, and age window", () => {
    const checkedAt = 10_000;
    const preflight: SmartAccountPreflight = {
      address,
      chainId: 1,
      checkedAt,
      status: {
        isContractWallet: false,
        isEip7702Delegated: false,
        hasWalletAABatching: false,
      },
    };

    expect(
      isSmartAccountPreflightReusable({
        preflight,
        address,
        chainId: 1,
        now: checkedAt + 59_999,
      }),
    ).toBe(true);
    expect(
      isSmartAccountPreflightReusable({
        preflight,
        address,
        chainId: 11155111,
        now: checkedAt + 1,
      }),
    ).toBe(false);
    expect(
      isSmartAccountPreflightReusable({
        preflight,
        address,
        chainId: 1,
        now: checkedAt + 60_001,
      }),
    ).toBe(false);
  });
});
