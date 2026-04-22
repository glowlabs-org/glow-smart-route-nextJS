import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

// Mock wagmi's useWalletClient so we can push different walletClient values
// into the hook between renders. The hook reads from module-level state so
// a rerender() picks up the new value naturally.
let mockWalletClient: any = undefined;
let mockIsLoading = false;
vi.mock("wagmi", () => ({
  useWalletClient: () => ({ data: mockWalletClient, isLoading: mockIsLoading }),
}));

// Minimal ethers mock: BrowserProvider returns a stable-per-construction
// signer whose getAddress resolves to whatever wallet address was passed.
vi.mock("ethers", () => {
  class JsonRpcSigner {
    private _address: string;
    public id: number;
    constructor(address: string, id: number) {
      this._address = address;
      this.id = id;
    }
    async getAddress() {
      return this._address;
    }
  }
  let signerCounter = 0;
  class BrowserProvider {
    constructor(_transport: unknown) {}
    async getSigner(address: string) {
      signerCounter += 1;
      return new JsonRpcSigner(address, signerCounter);
    }
  }
  return { BrowserProvider, JsonRpcSigner };
});

import { useEthersSigner } from "@/hooks/useEthersSigner";

function makeWalletClient(overrides: Partial<{
  address: string;
  chainId: number;
  transportKey: string;
  transportName: string;
  transportType: string;
}> = {}) {
  return {
    account: { address: overrides.address ?? "0xabcDEF0000000000000000000000000000001234" },
    chain: { id: overrides.chainId ?? 1 },
    transport: {
      config: {
        key: overrides.transportKey ?? "injected",
        name: overrides.transportName ?? "MetaMask",
        type: overrides.transportType ?? "custom",
      },
    },
  };
}

describe("useEthersSigner", () => {
  beforeEach(() => {
    mockWalletClient = undefined;
    mockIsLoading = false;
  });
  afterEach(() => {
    // Explicitly unmount prior React trees so effects from one test can't
    // leak into the next (happy-dom shares document across tests).
    cleanup();
  });

  it("resolves a signer once the wallet client is available", async () => {
    mockWalletClient = makeWalletClient();
    const { result } = renderHook(() => useEthersSigner());

    await waitFor(() => expect(result.current.signer).toBeDefined());
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps the same signer reference when the walletClient object identity changes but address+chain stay the same", async () => {
    // This is the regression that broke /buy swap UI: wagmi emits a fresh
    // walletClient object on unrelated state churn (new block, etc.). The
    // signer used to blank out and recreate on every such churn, which
    // aborted in-flight estimate requests mid-flow. The fix keeps the
    // signer pinned when address+chain are unchanged.
    mockWalletClient = makeWalletClient();
    const { result, rerender } = renderHook(() => useEthersSigner());
    await waitFor(() => expect(result.current.signer).toBeDefined());
    const signerBefore = result.current.signer;

    // Simulate a transient walletClient identity change with no real
    // state change (same address, chain, transport).
    mockWalletClient = makeWalletClient();
    rerender();

    // Let any pending microtasks resolve.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current.signer).toBe(signerBefore);
  });

  it("rebuilds the signer when the connected address changes", async () => {
    mockWalletClient = makeWalletClient({
      address: "0x1111111111111111111111111111111111111111",
    });
    const { result, rerender } = renderHook(() => useEthersSigner());
    await waitFor(() => expect(result.current.signer).toBeDefined());
    const signerBefore = result.current.signer;

    mockWalletClient = makeWalletClient({
      address: "0x2222222222222222222222222222222222222222",
    });
    rerender();

    await waitFor(
      () => {
        expect(result.current.signer).toBeDefined();
        expect(result.current.signer).not.toBe(signerBefore);
      },
      { timeout: 2_000 },
    );
  });

  it("rebuilds the signer when the chain id changes", async () => {
    mockWalletClient = makeWalletClient({ chainId: 1 });
    const { result, rerender } = renderHook(() => useEthersSigner());
    await waitFor(() => expect(result.current.signer).toBeDefined());
    const signerBefore = result.current.signer;

    mockWalletClient = makeWalletClient({ chainId: 11155111 });
    rerender();

    await waitFor(
      () => {
        expect(result.current.signer).toBeDefined();
        expect(result.current.signer).not.toBe(signerBefore);
      },
      { timeout: 2_000 },
    );
  });

  it("clears the signer when the wallet disconnects", async () => {
    mockWalletClient = makeWalletClient();
    const { result, rerender } = renderHook(() => useEthersSigner());
    await waitFor(() => expect(result.current.signer).toBeDefined());

    mockWalletClient = undefined;
    rerender();

    await waitFor(() => expect(result.current.signer).toBeUndefined());
  });
});
