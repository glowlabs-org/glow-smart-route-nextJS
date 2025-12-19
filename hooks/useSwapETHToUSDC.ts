"use client";

import { useCallback } from "react";
import { useChainId, useWalletClient } from "wagmi";
import { parseAbi } from "viem";
import { Err, Ok, Result } from "ts-results";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { SDKAddresses } from "@/web3/constants/addresses";
import { waitForViemTransactionWithRetry } from "@glowlabs-org/utils/browser";

const UNISWAP_V2_ROUTER_ABI = parseAbi([
  "function WETH() external pure returns (address)",
  "function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) external payable returns (uint256[] amounts)",
]);

const ERC20_ABI = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

const SLIPPAGE_DENOMINATOR_BPS = BigInt(10_000);
const DEFAULT_SLIPPAGE_BPS = BigInt(100); // 1%

export interface EthToUsdcQuote {
  router: `0x${string}`;
  weth: `0x${string}`;
  usdc: `0x${string}`;
  amountInWei: bigint;
  amountOutUsdc: bigint;
  amountOutMinUsdc: bigint;
}

export interface SwapEthToUsdcSuccess {
  usdcReceived: bigint;
  txHash: `0x${string}`;
}

export interface EstimateEthToUsdcGasResult {
  gasLimit: bigint;
  gasPrice: bigint;
  estimatedFeeWei: bigint;
}

function computeAmountOutMin(amountOut: bigint, slippageBps: bigint) {
  if (amountOut <= BigInt(0)) return BigInt(0);
  if (slippageBps <= BigInt(0)) return amountOut;
  const slip = (amountOut * slippageBps) / SLIPPAGE_DENOMINATOR_BPS;
  const min = amountOut - slip;
  return min > BigInt(0) ? min : BigInt(0);
}

export function useSwapETHToUSDC() {
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  const ensureMainnet = useCallback((): Result<true, string> => {
    if (chainId !== 1) return new Err("ETH pay is only supported on mainnet.");
    return new Ok(true);
  }, [chainId]);

  const estimateEthToUsdc = useCallback(
    async ({
      amountInWei,
      slippageBps = DEFAULT_SLIPPAGE_BPS,
    }: {
      amountInWei: bigint;
      slippageBps?: bigint;
    }): Promise<Result<EthToUsdcQuote, string>> => {
      const mainnetOk = ensureMainnet();
      if (!mainnetOk.ok) return new Err(mainnetOk.val);

      if (amountInWei <= BigInt(0)) return new Err("Amount must be greater than 0.");

      const router = SDKAddresses.UNISWAP_V2_ROUTER as `0x${string}` | undefined;
      const usdc = SDKAddresses.USDC as `0x${string}` | undefined;
      if (!router || !usdc) return new Err("Uniswap router or USDC address not available.");

      try {
        const weth = (await publicClient.readContract({
          address: router,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "WETH",
        })) as `0x${string}`;

        const amounts = (await publicClient.readContract({
          address: router,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [amountInWei, [weth, usdc]],
        })) as readonly bigint[];

        const amountOutUsdc = amounts?.[1] ?? BigInt(0);
        const amountOutMinUsdc = computeAmountOutMin(amountOutUsdc, slippageBps);

        return new Ok({
          router,
          weth,
          usdc,
          amountInWei,
          amountOutUsdc,
          amountOutMinUsdc,
        });
      } catch (e: any) {
        return new Err(e?.message || "Failed to quote ETH to USDC.");
      }
    },
    [ensureMainnet]
  );

  const swapEthToUsdc = useCallback(
    async ({
      amountInWei,
      slippageBps = DEFAULT_SLIPPAGE_BPS,
    }: {
      amountInWei: bigint;
      slippageBps?: bigint;
    }): Promise<Result<SwapEthToUsdcSuccess, string>> => {
      const mainnetOk = ensureMainnet();
      if (!mainnetOk.ok) return new Err(mainnetOk.val);

      if (!walletClient?.account?.address) return new Err("Wallet not connected.");

      const quoteRes = await estimateEthToUsdc({ amountInWei, slippageBps });
      if (!quoteRes.ok) return new Err(quoteRes.val);

      const { router, usdc, weth, amountOutMinUsdc } = quoteRes.val;
      const recipient = walletClient.account.address as `0x${string}`;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      try {
        const balanceBefore = (await publicClient.readContract({
          address: usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [recipient],
        })) as bigint;

        const txHash = await walletClient.writeContract({
          address: router,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "swapExactETHForTokens",
          args: [amountOutMinUsdc, [weth, usdc], recipient, deadline],
          value: amountInWei,
        });

        await waitForViemTransactionWithRetry(publicClient, txHash, {
          maxRetries: 5,
          timeoutMs: 120000,
          enableLogging: true,
          pollIntervalMs: 2000,
        });

        const balanceAfter = (await publicClient.readContract({
          address: usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [recipient],
        })) as bigint;

        const usdcReceived = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : BigInt(0);

        return new Ok({ usdcReceived, txHash });
      } catch (e: any) {
        return new Err(e?.message || "Failed to swap ETH to USDC.");
      }
    },
    [ensureMainnet, estimateEthToUsdc, walletClient]
  );

  const estimateGasForSwapEthToUsdc = useCallback(
    async ({
      amountInWei,
      slippageBps = DEFAULT_SLIPPAGE_BPS,
    }: {
      amountInWei: bigint;
      slippageBps?: bigint;
    }): Promise<Result<EstimateEthToUsdcGasResult, string>> => {
      const mainnetOk = ensureMainnet();
      if (!mainnetOk.ok) return new Err(mainnetOk.val);
      if (!walletClient?.account?.address) return new Err("Wallet not connected.");
      if (amountInWei <= BigInt(0)) return new Err("Amount must be greater than 0.");

      const quoteRes = await estimateEthToUsdc({ amountInWei, slippageBps });
      if (!quoteRes.ok) return new Err(quoteRes.val);

      const { router, usdc, weth, amountOutMinUsdc } = quoteRes.val;
      const recipient = walletClient.account.address as `0x${string}`;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      try {
        const [gasPrice, gasLimit] = await Promise.all([
          publicClient.getGasPrice(),
          publicClient.estimateContractGas({
            address: router,
            abi: UNISWAP_V2_ROUTER_ABI,
            functionName: "swapExactETHForTokens",
            args: [amountOutMinUsdc, [weth, usdc], recipient, deadline],
            account: recipient,
            value: amountInWei,
          }),
        ]);
        const estimatedFeeWei = gasLimit * gasPrice;
        return new Ok({ gasLimit, gasPrice, estimatedFeeWei });
      } catch (e: any) {
        return new Err(e?.message || "Failed to estimate gas for ETH to USDC.");
      }
    },
    [ensureMainnet, estimateEthToUsdc, walletClient]
  );

  return { estimateEthToUsdc, estimateGasForSwapEthToUsdc, swapEthToUsdc } as const;
}


