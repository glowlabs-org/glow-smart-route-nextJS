import { Result, Ok, Err } from "ts-results";

import { formatUnits, erc20Abi, maxUint256, formatEther, parseAbi } from "viem";
import { useContracts } from "./useContracts";
import { useEffect, useState } from "react";
import { publicClient } from "@/web3/web3/clients/publicClient";
import {
  getAddresses,
  waitForViemTransactionWithRetry,
} from "@glowlabs-org/utils/browser";
import { useWalletClient } from "wagmi";
import {
  INVALID_WALLET_TX_RESPONSE_MESSAGE,
  isInvalidWalletTxResponseError,
  normalizeTxHash,
} from "@/lib/normalize-tx-hash";

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

// Utility to extract the most useful revert reason from an ethers error object
function parseEthersError(error: unknown): string {
  if (!error) return "Unknown error";
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
    amountUSDG: bigint
  ): Promise<Result<boolean, USDGRedemptionError | string>> {
    try {
      if (!walletClient)
        return new Err(USDGRedemptionError.SIGNER_NOT_AVAILABLE);

      if (!usdg) return new Err("USDG contract not available");

      const owner = walletClient.account?.address as `0x${string}` | undefined;
      if (!owner) return new Err(USDGRedemptionError.SIGNER_NOT_AVAILABLE);
      const allowance: bigint = await usdg.allowance(
        owner,
        USDG_REDEMPTION_ADDRESS
      );

      if (allowance < amountUSDG) {
        try {
          const approveTx = await usdg.approve(
            USDG_REDEMPTION_ADDRESS,
            maxUint256
          );
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
        } catch (approveError) {
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
      } catch (staticError) {
        return new Err(parseEthersError(staticError));
      }

      const rawHash = await walletClient.writeContract({
        address: USDG_REDEMPTION_ADDRESS,
        abi: USDG_REDEMPTION_ABI,
        functionName: "exchange",
        args: [amountUSDG],
      });
      const hash = normalizeTxHash(rawHash);
      await waitForViemTransactionWithRetry(publicClient, hash, {
        maxRetries: 5,
        timeoutMs: 120000, // 2 minutes timeout
        enableLogging: true,
        pollIntervalMs: 2000, // Poll every 2 seconds
      });

      return new Ok(true);
    } catch (txError: any) {
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
