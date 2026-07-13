import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, PublicClient, WalletClient } from "viem";

const mocks = vi.hoisted(() => ({
  getFraction: vi.fn(),
  checkTokenBalance: vi.fn(),
  checkTokenAllowance: vi.fn(),
  sdkBuyFractions: vi.fn(),
  useOffchainFractions: vi.fn(),
  assertWalletClientForOrder: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock("@glowlabs-org/utils/browser", () => ({
  OFFCHAIN_FRACTIONS_ABI: [],
  OffchainFractionsError: {
    INVALID_PARAMETERS: "Invalid parameters",
    SIGNER_NOT_AVAILABLE: "Signer not available",
    INSUFFICIENT_BALANCE: "Insufficient balance",
  },
  parseViemError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  useOffchainFractions: (...args: unknown[]) => {
    mocks.useOffchainFractions(...args);
    return {
      addresses: {
        OFFCHAIN_FRACTIONS: "0x0000000000000000000000000000000000000030",
      },
      getFraction: mocks.getFraction,
      checkTokenBalance: mocks.checkTokenBalance,
      checkTokenAllowance: mocks.checkTokenAllowance,
      buyFractions: mocks.sdkBuyFractions,
    };
  },
}));

vi.mock("@/lib/wallet-chain", () => ({
  assertWalletClientAccount: vi.fn(),
  assertWalletClientForOrder: mocks.assertWalletClientForOrder,
  assertWalletClientOnExpectedChain: vi.fn(),
  getExpectedChain: () => ({ id: 1 }),
  getExpectedChainId: () => 1,
}));

vi.mock("@/lib/wait-for-transaction-receipt", () => ({
  DelayedConfirmationError: class DelayedConfirmationError extends Error {},
  waitForTransactionReceipt: mocks.waitForTransactionReceipt,
}));

import { usePatchedOffchainFractions } from "@/hooks/usePatchedOffchainFractions";
import { FRACTION_ORDER_CHANGED_MESSAGE } from "@/lib/fraction-order";

const ACCOUNT = "0x0000000000000000000000000000000000000001" as Address;
const CREATOR = "0x0000000000000000000000000000000000000002" as Address;
const USDC = "0x0000000000000000000000000000000000000010" as Address;
const OTHER_TOKEN = "0x0000000000000000000000000000000000000020" as Address;
const FRACTION_ID = `0x${"ab".repeat(32)}` as `0x${string}`;

function createClients() {
  const writeContract = vi.fn();
  const simulateContract = vi.fn();
  const waitForTransactionReceipt = vi.fn();
  const walletClient = {
    account: { address: ACCOUNT },
    chain: { id: 1 },
    getChainId: vi.fn().mockResolvedValue(1),
    getAddresses: vi.fn().mockResolvedValue([ACCOUNT]),
    writeContract,
  } as unknown as WalletClient;
  const publicClient = {
    chain: { id: 1 },
    simulateContract,
    waitForTransactionReceipt,
  } as unknown as PublicClient;

  return {
    publicClient,
    simulateContract,
    waitForTransactionReceipt,
    walletClient,
    writeContract,
  };
}

function purchaseParams() {
  return {
    creator: CREATOR,
    id: FRACTION_ID,
    stepsToBuy: 1n,
    minStepsToBuy: 1n,
    refundTo: ACCOUNT,
    creditTo: ACCOUNT,
    useCounterfactualAddressForRefund: false,
  };
}

describe("usePatchedOffchainFractions purchase-term binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertWalletClientForOrder.mockResolvedValue(undefined);
    mocks.checkTokenBalance.mockResolvedValue(10_000_000_000n);
    mocks.checkTokenAllowance.mockResolvedValue(10_000_000_000n);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("rejects an on-chain price change before reads, simulation, or writes", async () => {
    mocks.getFraction.mockResolvedValue({
      token: USDC,
      step: 500_000_000n,
    });
    const { publicClient, simulateContract, walletClient, writeContract } =
      createClients();
    const { result } = renderHook(() =>
      usePatchedOffchainFractions(walletClient, publicClient, 1),
    );

    await expect(
      act(() =>
        result.current.buyFractions(purchaseParams(), {
          expectedPaymentToken: USDC,
          expectedRequiredAmount: 399_000_000n,
        }),
      ),
    ).rejects.toThrow(FRACTION_ORDER_CHANGED_MESSAGE);

    expect(mocks.checkTokenBalance).not.toHaveBeenCalled();
    expect(mocks.checkTokenAllowance).not.toHaveBeenCalled();
    expect(simulateContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("rejects a changed token before the sufficient-allowance write path", async () => {
    mocks.getFraction.mockResolvedValue({
      token: OTHER_TOKEN,
      step: 399_000_000n,
    });
    const { publicClient, simulateContract, walletClient, writeContract } =
      createClients();
    const { result } = renderHook(() =>
      usePatchedOffchainFractions(walletClient, publicClient, 1),
    );

    await expect(
      act(() =>
        result.current.buyFractions(purchaseParams(), {
          expectedPaymentToken: USDC,
          expectedRequiredAmount: 399_000_000n,
        }),
      ),
    ).rejects.toThrow(FRACTION_ORDER_CHANGED_MESSAGE);

    expect(mocks.checkTokenBalance).not.toHaveBeenCalled();
    expect(mocks.checkTokenAllowance).not.toHaveBeenCalled();
    expect(simulateContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("fails closed before SDK reads when a stale reactive chain is supplied", async () => {
    mocks.getFraction.mockResolvedValue({
      token: USDC,
      step: 399_000_000n,
    });
    const { publicClient, simulateContract, walletClient, writeContract } =
      createClients();
    const { result } = renderHook(() =>
      // The read client already represents configured mainnet, while this
      // models a lagging reactive chain value after a wallet network switch.
      usePatchedOffchainFractions(walletClient, publicClient, 11155111),
    );

    await expect(
      result.current.assertPurchaseTerms(
        {
          creator: CREATOR,
          id: FRACTION_ID,
          stepsToBuy: 1n,
        },
        {
          expectedPaymentToken: USDC,
          expectedRequiredAmount: 399_000_000n,
        },
      ),
    ).rejects.toThrow("Miner purchase reads are not on the configured network");

    expect(mocks.getFraction).not.toHaveBeenCalled();
    expect(mocks.checkTokenBalance).not.toHaveBeenCalled();
    expect(mocks.checkTokenAllowance).not.toHaveBeenCalled();
    expect(simulateContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("mirrors an ETH-swap receipt and waits for the consuming RPC balance", async () => {
    vi.useFakeTimers();
    const prerequisiteHash = `0x${"3".repeat(64)}` as `0x${string}`;
    const purchaseHash = `0x${"4".repeat(64)}` as `0x${string}`;
    mocks.getFraction.mockResolvedValue({
      token: USDC,
      step: 399_000_000n,
    });
    mocks.checkTokenBalance
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(399_000_000n);
    mocks.checkTokenAllowance.mockResolvedValue(399_000_000n);
    mocks.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
    const {
      publicClient,
      simulateContract,
      waitForTransactionReceipt,
      walletClient,
      writeContract,
    } = createClients();
    waitForTransactionReceipt.mockResolvedValue({ status: "success" });
    simulateContract.mockResolvedValue({
      request: {
        address: "0x0000000000000000000000000000000000000030",
        abi: [],
        functionName: "buyFractions",
      },
    });
    writeContract.mockResolvedValue(purchaseHash);
    const { result } = renderHook(() =>
      usePatchedOffchainFractions(walletClient, publicClient, 1),
    );

    const purchase = result.current.buyFractions(purchaseParams(), {
      expectedPaymentToken: USDC,
      expectedRequiredAmount: 399_000_000n,
      prerequisiteTxHashes: [prerequisiteHash],
    });
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(purchase).resolves.toBe(purchaseHash);
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: prerequisiteHash,
      confirmations: 1,
      retryCount: 8,
      retryDelay: 1_000,
    });
    expect(mocks.checkTokenBalance).toHaveBeenCalledTimes(2);
    expect(simulateContract).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledOnce();
  });
});
