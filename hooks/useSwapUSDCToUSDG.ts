import { formatEther } from "viem";
import { useContracts } from "./useContracts";
import { useEthersSigner } from "./useEthersSigner";
import { Result, Ok, Err } from "ts-results";
import { waitForEthersTransactionWithRetry } from "@glowlabs-org/utils/browser";

export enum SwapUSDCToUSDGError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
  UNKNOWN_ERROR = "Unknown error",
  INSUFFICIENT_USDC_BALANCE = "Insufficient USDC balance",
  APPROVAL_FAILED = "Failed to approve USDC",
  SWAP_FAILED = "Failed to swap USDC to USDG",
  TRANSACTION_REJECTED = "Transaction was rejected",
}
// Helper function to parse errors
function parseSwapError(error: any): string {
  // Check for user rejection
  if (
    error?.code === 4001 ||
    error?.message?.includes("rejected") ||
    error?.message?.includes("denied")
  ) {
    return SwapUSDCToUSDGError.TRANSACTION_REJECTED;
  }

  // Check for RPC errors
  if (error?.code === -32603 || error?.error?.code === -32603) {
    // Internal JSON-RPC error often means the transaction would fail
    const message = error?.error?.message || error?.message || "";
    if (message.includes("insufficient")) {
      return SwapUSDCToUSDGError.INSUFFICIENT_USDC_BALANCE;
    }
    // Try to extract more specific error from data
    if (error?.data?.message) {
      return `Transaction failed: ${error.data.message}`;
    }
    if (error?.error?.data?.message) {
      return `Transaction failed: ${error.error.data.message}`;
    }
    return `Transaction would fail. Please try again or contact support.`;
  }

  // Check for specific error messages
  if (error?.message) {
    // Check for timeout errors
    if (
      error.message.includes("timeout") ||
      error.message.includes("Timeout")
    ) {
      return "Transaction confirmation timed out. The transaction may have succeeded - please check your wallet.";
    }
    if (
      error.message.includes("insufficient funds") ||
      error.message.includes("insufficient balance")
    ) {
      return SwapUSDCToUSDGError.INSUFFICIENT_USDC_BALANCE;
    }
    if (error.message.includes("approve")) {
      return SwapUSDCToUSDGError.APPROVAL_FAILED;
    }
    return error.message;
  }

  return SwapUSDCToUSDGError.UNKNOWN_ERROR;
}

export const useSwapUSDCToUSDG = () => {
  const { signer } = useEthersSigner();
  const { usdc, usdg, isReady } = useContracts(signer);

  const estimateGasForswapUSDCToUSDG = async (
    amount: bigint,
    ethPriceInUSD: number | null
  ): Promise<Result<string, string>> => {
    try {
      if (!usdc || !usdg)
        return new Err(SwapUSDCToUSDGError.CONTRACTS_NOT_AVAILABLE);
      if (!signer) return new Err(SwapUSDCToUSDGError.SIGNER_NOT_AVAILABLE);
      const signerAddress = await signer.getAddress();
      const usdcGasPrice = await usdc.provider.getGasPrice();

      const allowance = await usdc.allowance(signerAddress, usdg.address);
      let totalEstimatedGas = BigInt(0);
      if (allowance < amount) {
        const estimatedGas = await usdc.estimateGas.approve(
          usdg.address,
          amount
        );

        const estimatedCost = estimatedGas * BigInt(usdcGasPrice);
        totalEstimatedGas = totalEstimatedGas + estimatedCost;
      }

      const estimatedGas = BigInt(100000);

      const estimatedCost = estimatedGas * BigInt(usdcGasPrice);
      totalEstimatedGas = totalEstimatedGas + estimatedCost;

      if (ethPriceInUSD) {
        const estimatedCostInEth = formatEther(totalEstimatedGas);
        const estimatedCostInUSD = (
          parseFloat(estimatedCostInEth) * ethPriceInUSD
        ).toFixed(2);
        return new Ok(estimatedCostInUSD);
      } else {
        return new Err(
          "Could not fetch the ETH price to calculate cost in USD."
        );
      }
    } catch (e: any) {
      return new Err(SwapUSDCToUSDGError.UNKNOWN_ERROR);
    }
  };

  const swapUSDCToUSDG = async (
    amount: bigint
  ): Promise<Result<boolean, SwapUSDCToUSDGError | string>> => {
    try {
      if (!usdc || !usdg || !isReady)
        return new Err(SwapUSDCToUSDGError.CONTRACTS_NOT_AVAILABLE);
      if (!signer) return new Err(SwapUSDCToUSDGError.SIGNER_NOT_AVAILABLE);

      const signerAddress = await signer.getAddress();

      // Validate amount
      if (amount <= BigInt(0)) {
        return new Err("Amount must be greater than 0");
      }

      // Check USDC balance before attempting swap
      const usdcBalance = await usdc.balanceOf(signerAddress);

      if (usdcBalance < amount) {
        return new Err(SwapUSDCToUSDGError.INSUFFICIENT_USDC_BALANCE);
      }

      // Check and handle allowance
      const allowance = await usdc.allowance(signerAddress, usdg.address);

      if (allowance < amount) {
        try {
          const tx = await usdc.approve(usdg.address, amount);
          await waitForEthersTransactionWithRetry(signer!, tx.hash, {
            maxRetries: 10, // Increased retries for USDG-related approvals
            timeoutMs: 300000, // 5 minutes timeout
            enableLogging: true,
            pollIntervalMs: 3000, // Poll every 3 seconds to avoid rate limiting
          });
        } catch (approvalError: any) {
          return new Err(parseSwapError(approvalError));
        }
      }

      // Perform the swap
      try {
        const tx = await usdg.swap(signerAddress, amount);

        if (!tx || !tx.hash) {
          return new Err(
            "Failed to get transaction hash from swap. Please try again."
          );
        }

        await waitForEthersTransactionWithRetry(signer!, tx.hash, {
          maxRetries: 10, // Increased retries for USDG swaps
          timeoutMs: 300000, // 5 minutes timeout for USDG swaps
          enableLogging: true,
          pollIntervalMs: 3000, // Poll every 3 seconds to avoid rate limiting
        });
        return new Ok(true);
      } catch (swapError: any) {
        // Check if it's a timeout error
        if (
          swapError?.message?.includes("timeout") ||
          swapError?.message?.includes("Timeout")
        ) {
          return new Err(
            "Transaction submitted but confirmation timed out. Please check your wallet to verify if the swap completed successfully."
          );
        }

        // Check if it's a simulation/validation error from ethers
        if (swapError?.code === "UNPREDICTABLE_GAS_LIMIT") {
          return new Err(
            "Transaction would fail on-chain. Please check your balance and try again."
          );
        }
        return new Err(parseSwapError(swapError));
      }
    } catch (e: any) {
      return new Err(parseSwapError(e));
    }
  };

  return { swapUSDCToUSDG, estimateGasForswapUSDCToUSDG };
};
