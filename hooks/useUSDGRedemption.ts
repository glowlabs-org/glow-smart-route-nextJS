import { Result, Ok, Err } from "ts-results";

import {
  formatUnits,
  erc20Abi,
  maxUint256,
  formatEther,
  parseAbi,
  type Address,
  type Hash,
} from "viem";
import { useContracts } from "./useContracts";
import { useEffect, useState } from "react";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { getAddresses } from "@glowlabs-org/utils/browser";
import { waitForTransactionReceipt } from "@/lib/wait-for-transaction-receipt";
import { useWalletClient } from "wagmi";
import {
  INVALID_WALLET_TX_RESPONSE_MESSAGE,
  isInvalidWalletTxResponseError,
  normalizeTxHash,
} from "@/lib/normalize-tx-hash";
import {
  getSmartAccountStatus,
  isSmartAccountPreflightReusable,
  isSmartAccountBlocked,
  SMART_ACCOUNT_UNSUPPORTED_MESSAGE,
  type SmartAccountPreflight,
  type SmartAccountStatus,
} from "@/web3/web3/utils/detectSmartAccount";
import {
  assertWalletClientAccount,
  assertWalletClientForOrder,
  assertWalletClientOnExpectedChain,
  getExpectedChain,
} from "@/lib/wallet-chain";
import {
  getTransactionOperationCancellation,
  type AssertTransactionActive,
} from "@/lib/transaction-operation";
import { sumErc20TransfersTo } from "@/lib/transaction-receipts";
import { synchronizePrerequisiteBalance } from "@/lib/prerequisite-balance";
import {
  WALLET_INTERACTION_TIMEOUT_MESSAGE,
  isWalletInteractionTimeoutError,
} from "@/lib/rpc-error-utils";
import {
  withWalletRequestAction,
  writeContractWithWalletLifecycle,
  type WalletRequestObserver,
} from "@/lib/wallet-request";

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

const SDKAddresses = getAddresses(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID));

// USDGRedemption contract address
export const USDG_REDEMPTION_ADDRESS = SDKAddresses.USDG_REDEMPTION;

// USDC contract address
const USDC_ADDRESS = SDKAddresses.USDC;

// Minimal ABI for the exchange function
const USDG_REDEMPTION_ABI = parseAbi([
  "function exchange(uint256 amountUSDG) external",
]);

export enum USDGRedemptionError {
  CONTRACT_NOT_AVAILABLE = "Contract not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
  UNKNOWN_ERROR = "Unknown error",
}

export interface USDGRedemptionSuccess {
  txHash: `0x${string}`;
  usdcReceived: bigint;
}

// Utility to extract the most useful revert reason from an ethers error object
function parseEthersError(error: unknown): string {
  if (!error) return "Unknown error";
  if (isWalletInteractionTimeoutError(error)) {
    return WALLET_INTERACTION_TIMEOUT_MESSAGE;
  }
  if (
    isInvalidWalletTxResponseError(error) ||
    isInvalidWalletTxResponseError((error as any)?.message)
  ) {
    return INVALID_WALLET_TX_RESPONSE_MESSAGE;
  }
  // Ethers v6 nests the original error under `error` property while v5 keeps it directly on the object
  // We try to exhaust the most common locations for a revert reason
  const possibleError: any = error;

  // If the error originates from a callStatic it will often be found at `error?.error?.body`
  if (possibleError?.error?.body) {
    try {
      const body = JSON.parse(possibleError.error.body);
      // Hardhat style errors
      if (body?.error?.message) return body.error.message as string;
    } catch {}
  }

  // Found on MetaMask/Alchemy shape errors
  if (possibleError?.data?.message) return possibleError.data.message as string;
  if (possibleError?.error?.message)
    return possibleError.error.message as string;

  // Standard ethers v5 message
  if (possibleError?.reason) return possibleError.reason as string;
  if (possibleError?.message) return possibleError.message as string;

  return USDGRedemptionError.UNKNOWN_ERROR;
}

export function useUSDGRedemption() {
  const { data: walletClient } = useWalletClient();
  const { usdg } = useContracts(undefined);
  const [usdcInRedemption, setUsdcInRedemption] = useState<number>(0);

  useEffect(() => {
    async function fetchUsdcInRedemption() {
      await getUSDCBalanceOfRedemptionContract();
    }
    fetchUsdcInRedemption();
  }, []);

  /**
   * Get USDC balance of the USDG Redemption contract
   * Uses publicClient so no wallet connection is required
   */
  async function getUSDCBalanceOfRedemptionContract(): Promise<bigint | null> {
    if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
      return BigInt(0);
    }
    try {
      const balance = (await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [USDG_REDEMPTION_ADDRESS],
      })) as bigint;

      const formattedBalance = formatUnits(balance, 6);
      setUsdcInRedemption(Number(formattedBalance));
      return balance;
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      setUsdcInRedemption(0);
      return null;
    }
  }

  /**
   * Redeem USDG for USDC 1:1 using the exchange function
   * Handles allowance: if insufficient, approve MaxUint256 first
   * @param amountUSDG Amount of USDG to redeem (BigNumber, 6 decimals)
   */
  async function redeemUSDGForUSDC(
    amountUSDG: bigint,
    options?: {
      expectedAccount?: Address;
      prerequisiteTxHashes?: Hash[];
      assertTransactionActive?: AssertTransactionActive;
      smartAccountPreflight?: SmartAccountPreflight;
      walletRequest?: WalletRequestObserver;
    },
  ): Promise<Result<USDGRedemptionSuccess, USDGRedemptionError | string>> {
    try {
      const assertTransactionActive = options?.assertTransactionActive;
      assertTransactionActive?.();
      if (amountUSDG <= 0n) return new Err("Amount must be greater than 0");
      if (!walletClient)
        return new Err(USDGRedemptionError.SIGNER_NOT_AVAILABLE);
      assertWalletClientOnExpectedChain(walletClient);
      if (options?.expectedAccount) {
        assertWalletClientAccount(walletClient, options.expectedAccount);
      }
      assertTransactionActive?.();

      if (!usdg) return new Err("USDG contract not available");

      const owner = walletClient.account?.address as `0x${string}` | undefined;
      if (!owner) return new Err(USDGRedemptionError.SIGNER_NOT_AVAILABLE);
      const prerequisiteTxHashes = options?.prerequisiteTxHashes ?? [];
      const chainId = walletClient.chain?.id;
      const smartStatusPromise: Promise<SmartAccountStatus | null> =
        isSmartAccountPreflightReusable({
          preflight: options?.smartAccountPreflight,
          address: owner,
          chainId,
        })
          ? Promise.resolve(options?.smartAccountPreflight?.status ?? null)
          : getSmartAccountStatus({
              address: owner,
              chainId,
              walletClient,
              getBytecode: publicClient.getBytecode,
            }).catch(() => null);
      const synchronizedBalancePromise =
        prerequisiteTxHashes.length > 0
          ? synchronizePrerequisiteBalance({
              prerequisiteTxHashes,
              waitForReceipt: (hash) =>
                publicClient.waitForTransactionReceipt({
                  hash,
                  confirmations: 1,
                  retryCount: 8,
                  retryDelay: 1_000,
                }),
              minimumBalance: amountUSDG,
              readBalance: () => usdg.balanceOf(owner),
              assertTransactionActive,
            })
          : Promise.resolve<bigint | null>(null);
      const allowancePromise = usdg.allowance(owner, USDG_REDEMPTION_ADDRESS);
      const [smartStatus, synchronizedBalance, allowance] = await Promise.all([
        smartStatusPromise,
        synchronizedBalancePromise,
        allowancePromise,
      ]);
      assertTransactionActive?.();

      if (isSmartAccountBlocked(smartStatus)) {
        return new Err(SMART_ACCOUNT_UNSUPPORTED_MESSAGE);
      }
      if (
        synchronizedBalance !== null &&
        synchronizedBalance < amountUSDG
      ) {
        return new Err(
          "The confirmed GLOW swap is not visible to the redemption RPC yet.",
        );
      }

      if (allowance < amountUSDG) {
        try {
          const approveTx = await usdg.approve(
            USDG_REDEMPTION_ADDRESS,
            maxUint256,
            options?.expectedAccount,
            assertTransactionActive,
            withWalletRequestAction(options?.walletRequest, "approve_usdg"),
          );
          assertTransactionActive?.();
          // Use standard ethers wait with timeout
          await Promise.race([
            approveTx.wait(),
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error("Approval transaction timeout after 2 minutes")
                  ),
                120000
              )
            ),
          ]);
          assertTransactionActive?.();
        } catch (approveError) {
          const cancellation = getTransactionOperationCancellation(
            approveError,
            assertTransactionActive,
          );
          if (cancellation) throw cancellation;
          return new Err(
            parseEthersError(approveError) || "USDG approval failed"
          );
        }
      }

      // Simulate to surface any revert reason to the UI
      try {
        await publicClient.simulateContract({
          account: owner,
          address: USDG_REDEMPTION_ADDRESS,
          abi: USDG_REDEMPTION_ABI,
          functionName: "exchange",
          args: [amountUSDG],
        });
        assertTransactionActive?.();
      } catch (staticError) {
        const cancellation = getTransactionOperationCancellation(
          staticError,
          assertTransactionActive,
        );
        if (cancellation) throw cancellation;
        return new Err(parseEthersError(staticError));
      }

      assertWalletClientOnExpectedChain(walletClient);
      if (options?.expectedAccount) {
        assertWalletClientAccount(walletClient, options.expectedAccount);
      }
      await assertWalletClientForOrder(
        walletClient,
        options?.expectedAccount,
      );
      assertTransactionActive?.();
      const rawHash = await writeContractWithWalletLifecycle(
        walletClient,
        {
          address: USDG_REDEMPTION_ADDRESS,
          abi: USDG_REDEMPTION_ABI,
          functionName: "exchange",
          args: [amountUSDG],
          chain: getExpectedChain(),
          account: walletClient.account,
        },
        withWalletRequestAction(options?.walletRequest, "redeem_usdg_for_usdc"),
      );
      assertTransactionActive?.();
      const hash = normalizeTxHash(rawHash);
      const receipt = await waitForTransactionReceipt(hash);
      assertTransactionActive?.();
      const usdcReceived = sumErc20TransfersTo({
        logs: receipt.logs,
        token: USDC_ADDRESS,
        recipient: owner,
      });
      if (usdcReceived < amountUSDG) {
        return new Err(
          "The confirmed redemption returned less USDC than this order required.",
        );
      }

      return new Ok({ txHash: hash, usdcReceived });
    } catch (txError: any) {
      const cancellation = getTransactionOperationCancellation(
        txError,
        options?.assertTransactionActive,
      );
      if (cancellation) throw cancellation;
      return new Err(parseEthersError(txError));
    }
  }

  /**
   * Estimate gas for redeeming USDG for USDC
   * @param amountUSDG Amount of USDG to redeem (BigNumber, 6 decimals)
   * @param ethPriceInUSD Current ETH price in USD (for cost estimation)
   */
  async function estimateGasForRedeemUSDG(
    amountUSDG: bigint,
    ethPriceInUSD: number | null
  ): Promise<Result<string, USDGRedemptionError | string>> {
    try {
      if (!walletClient)
        return new Err(USDGRedemptionError.SIGNER_NOT_AVAILABLE);
      const owner = walletClient.account?.address as `0x${string}` | undefined;
      if (!owner) return new Err(USDGRedemptionError.SIGNER_NOT_AVAILABLE);
      const gasPrice = await publicClient.getGasPrice();
      const estimatedGas = await publicClient.estimateContractGas({
        account: owner,
        address: USDG_REDEMPTION_ADDRESS,
        abi: USDG_REDEMPTION_ABI,
        functionName: "exchange",
        args: [amountUSDG],
      });
      const estimatedCost = estimatedGas * gasPrice;
      if (ethPriceInUSD) {
        const estimatedCostInEth = formatEther(estimatedCost);
        const estimatedCostInUSD = (
          parseFloat(estimatedCostInEth) * ethPriceInUSD
        ).toFixed(2);
        return new Ok(estimatedCostInUSD);
      } else {
        return new Err(
          "Could not fetch the ETH price to calculate cost in USD."
        );
      }
    } catch (error: any) {
      return new Err(parseEthersError(error));
    }
  }

  return {
    redeemUSDGForUSDC,
    estimateGasForRedeemUSDG,
    getUSDCBalanceOfRedemptionContract,
    usdcInRedemption,
  };
}
