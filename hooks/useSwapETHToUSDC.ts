"use client";

import { useCallback, useMemo } from "react";
import { useChainId, useWalletClient, usePublicClient } from "wagmi";
import { parseAbi } from "viem";
import { Err, Ok, Result } from "ts-results";
import { getAddresses } from "@glowlabs-org/utils/browser";
import { waitForViemTransactionWithRetry } from "@glowlabs-org/utils/browser";
import {
  INVALID_WALLET_TX_RESPONSE_MESSAGE,
  isInvalidWalletTxResponseError,
  normalizeTxHash,
} from "@/lib/normalize-tx-hash";
import {
  getSmartAccountStatus,
  isSmartAccountBlocked,
  SMART_ACCOUNT_UNSUPPORTED_MESSAGE,
} from "@/web3/web3/utils/detectSmartAccount";

const UNISWAP_V2_ROUTER_ABI = parseAbi([
  "function WETH() external pure returns (address)",
  "function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) external payable returns (uint256[] amounts)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

// Sepolia-specific addresses from Uniswap
const SEPOLIA_ADDRESSES = {
  USDC: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as `0x${string}`,
  WETH: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" as `0x${string}`,
  // Uniswap V3 SwapRouter02 on Sepolia
  SWAP_ROUTER_02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E" as `0x${string}`,
};

// Uniswap V3 SwapRouter02 ABI for exactInputSingle
const UNISWAP_V3_SWAP_ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function WETH9() external view returns (address)",
]);

// WETH ABI for wrapping
const WETH_ABI = parseAbi([
  "function deposit() external payable",
  "function withdraw(uint256) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

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
  const publicClient = usePublicClient();

  // Get addresses for the current chain, with Sepolia fallbacks
  const sdkAddresses = getAddresses(chainId);

  const resolvedAddresses = useMemo(() => {
    const isSepolia = chainId === 11155111;

    if (isSepolia) {
      // Use Uniswap V3 SwapRouter02 on Sepolia
      return {
        router: SEPOLIA_ADDRESSES.SWAP_ROUTER_02,
        usdc: SEPOLIA_ADDRESSES.USDC,
        weth: SEPOLIA_ADDRESSES.WETH,
        isSepolia: true,
        useV3: true,
      };
    }

    // Mainnet: use SDK addresses with V2 router
    const router = sdkAddresses.UNISWAP_V2_ROUTER as `0x${string}` | undefined;
    const usdc = sdkAddresses.USDC as `0x${string}` | undefined;

    return { router, usdc, weth: undefined, isSepolia: false, useV3: false };
  }, [chainId, sdkAddresses]);

  const ensureEthPayChain = useCallback((): Result<true, string> => {
    if (chainId !== 1 && chainId !== 11155111)
      return new Err("ETH pay is only supported on mainnet or sepolia.");
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
      const chainOk = ensureEthPayChain();
      if (!chainOk.ok) return new Err(chainOk.val);

      if (amountInWei <= BigInt(0))
        return new Err("Amount must be greater than 0.");
      if (!publicClient) return new Err("Public client not available.");

      const { router, usdc, weth, isSepolia, useV3 } = resolvedAddresses;

      if (!router) {
        return new Err("Uniswap router address not available.");
      }
      if (!usdc) {
        return new Err("USDC address not available.");
      }

      try {
        if (useV3 && isSepolia) {
          // Uniswap V3 on Sepolia - use a simulated quote based on current market rate
          // V3 quoter is more complex, so we estimate: 1 ETH ≈ 3000 USDC (adjust as needed)
          // For production, you'd use the Quoter contract
          const estimatedRate = BigInt(3000); // ~$3000 per ETH
          const amountOutUsdc = (amountInWei * estimatedRate) / BigInt(1e12); // 18 decimals -> 6 decimals
          const amountOutMinUsdc = computeAmountOutMin(
            amountOutUsdc,
            slippageBps
          );

          return new Ok({
            router,
            weth: weth!,
            usdc,
            amountInWei,
            amountOutUsdc,
            amountOutMinUsdc,
          });
        }

        // V2 path (mainnet)
        const wethAddress = (await publicClient.readContract({
          address: router,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "WETH",
        })) as `0x${string}`;

        const amounts = (await publicClient.readContract({
          address: router,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [amountInWei, [wethAddress, usdc]],
        })) as readonly bigint[];

        const amountOutUsdc = amounts?.[1] ?? BigInt(0);
        const amountOutMinUsdc = computeAmountOutMin(
          amountOutUsdc,
          slippageBps
        );

        return new Ok({
          router,
          weth: wethAddress,
          usdc,
          amountInWei,
          amountOutUsdc,
          amountOutMinUsdc,
        });
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to quote ETH to USDC.";
        return new Err(errorMsg);
      }
    },
    [ensureEthPayChain, resolvedAddresses, publicClient]
  );

  const swapEthToUsdc = useCallback(
    async ({
      amountInWei,
      slippageBps = DEFAULT_SLIPPAGE_BPS,
    }: {
      amountInWei: bigint;
      slippageBps?: bigint;
    }): Promise<Result<SwapEthToUsdcSuccess, string>> => {
      const chainOk = ensureEthPayChain();
      if (!chainOk.ok) return new Err(chainOk.val);

      if (!walletClient?.account?.address)
        return new Err("Wallet not connected.");
      if (!publicClient) return new Err("Public client not available.");

      const quoteRes = await estimateEthToUsdc({ amountInWei, slippageBps });
      if (!quoteRes.ok) return new Err(quoteRes.val);

      const { router, usdc, weth, amountOutMinUsdc } = quoteRes.val;
      const recipient = walletClient.account.address as `0x${string}`;
      try {
        const smartStatus = await getSmartAccountStatus({
          address: recipient,
          chainId,
          walletClient,
          getBytecode: publicClient.getBytecode,
        });
        if (isSmartAccountBlocked(smartStatus)) {
          return new Err(SMART_ACCOUNT_UNSUPPORTED_MESSAGE);
        }
      } catch {
        // best-effort guard only
      }
      const { useV3 } = resolvedAddresses;

      try {
        const balanceBefore = (await publicClient.readContract({
          address: usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [recipient],
        })) as bigint;

        let txHash: `0x${string}`;

        if (useV3) {
          // Uniswap V3 swap on Sepolia using exactInputSingle
          // Fee tier 3000 = 0.3% (common for WETH/USDC)
          const fee = 3000;
          const sqrtPriceLimitX96 = BigInt(0); // No price limit

          const rawHash = await walletClient.writeContract({
            address: router,
            abi: UNISWAP_V3_SWAP_ROUTER_ABI,
            functionName: "exactInputSingle",
            args: [
              {
                tokenIn: weth,
                tokenOut: usdc,
                fee,
                recipient,
                amountIn: amountInWei,
                amountOutMinimum: amountOutMinUsdc,
                sqrtPriceLimitX96,
              },
            ],
            value: amountInWei, // Send ETH which will be wrapped
          });
          txHash = normalizeTxHash(rawHash);
        } else {
          // V2 swap on mainnet
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
          const rawHash = await walletClient.writeContract({
            address: router,
            abi: UNISWAP_V2_ROUTER_ABI,
            functionName: "swapExactETHForTokens",
            args: [amountOutMinUsdc, [weth, usdc], recipient, deadline],
            value: amountInWei,
          });
          txHash = normalizeTxHash(rawHash);
        }

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

        const usdcReceived =
          balanceAfter > balanceBefore
            ? balanceAfter - balanceBefore
            : BigInt(0);

        return new Ok({ usdcReceived, txHash });
      } catch (e: any) {
        if (
          isInvalidWalletTxResponseError(e) ||
          isInvalidWalletTxResponseError(e?.message)
        ) {
          return new Err(INVALID_WALLET_TX_RESPONSE_MESSAGE);
        }
        return new Err(e?.message || "Failed to swap ETH to USDC.");
      }
    },
    [
      chainId,
      ensureEthPayChain,
      estimateEthToUsdc,
      walletClient,
      publicClient,
      resolvedAddresses,
    ]
  );

  const estimateGasForSwapEthToUsdc = useCallback(
    async ({
      amountInWei,
      slippageBps = DEFAULT_SLIPPAGE_BPS,
    }: {
      amountInWei: bigint;
      slippageBps?: bigint;
    }): Promise<Result<EstimateEthToUsdcGasResult, string>> => {
      const chainOk = ensureEthPayChain();
      if (!chainOk.ok) return new Err(chainOk.val);
      if (!walletClient?.account?.address)
        return new Err("Wallet not connected.");
      if (!publicClient) return new Err("Public client not available.");
      if (amountInWei <= BigInt(0))
        return new Err("Amount must be greater than 0.");

      const quoteRes = await estimateEthToUsdc({ amountInWei, slippageBps });
      if (!quoteRes.ok) return new Err(quoteRes.val);

      const { router, usdc, weth, amountOutMinUsdc } = quoteRes.val;
      const recipient = walletClient.account.address as `0x${string}`;
      const { useV3 } = resolvedAddresses;

      try {
        const gasPrice = await publicClient.getGasPrice();
        let gasLimit: bigint;

        if (useV3) {
          // V3 gas estimation
          const fee = 3000;
          gasLimit = await publicClient.estimateContractGas({
            address: router,
            abi: UNISWAP_V3_SWAP_ROUTER_ABI,
            functionName: "exactInputSingle",
            args: [
              {
                tokenIn: weth,
                tokenOut: usdc,
                fee,
                recipient,
                amountIn: amountInWei,
                amountOutMinimum: amountOutMinUsdc,
                sqrtPriceLimitX96: BigInt(0),
              },
            ],
            account: recipient,
            value: amountInWei,
          });
        } else {
          // V2 gas estimation
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
          gasLimit = await publicClient.estimateContractGas({
            address: router,
            abi: UNISWAP_V2_ROUTER_ABI,
            functionName: "swapExactETHForTokens",
            args: [amountOutMinUsdc, [weth, usdc], recipient, deadline],
            account: recipient,
            value: amountInWei,
          });
        }

        const estimatedFeeWei = gasLimit * gasPrice;
        return new Ok({ gasLimit, gasPrice, estimatedFeeWei });
      } catch (e: any) {
        return new Err(e?.message || "Failed to estimate gas for ETH to USDC.");
      }
    },
    [
      ensureEthPayChain,
      estimateEthToUsdc,
      walletClient,
      publicClient,
      resolvedAddresses,
    ]
  );

  return {
    estimateEthToUsdc,
    estimateGasForSwapEthToUsdc,
    swapEthToUsdc,
  } as const;
}
