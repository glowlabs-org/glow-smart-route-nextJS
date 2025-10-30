/**
Users purchase GCC From Uniswap using USDG
*/

import { useEthersSigner } from "./useEthersSigner";
import { useEffect, useState } from "react";
import { Result, Ok, Err } from "ts-results";
import { addresses } from "@glowlabs-org/guarded-launch-abis";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { useWalletClient } from "wagmi";
import { formatEther, parseAbi } from "viem";
import Decimal from "decimal.js";

const UNISWAP_V2_FACTORY_ABI = parseAbi([
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
]);
const UNISWAP_V2_PAIR_ABI = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);
const UNISWAP_V2_ROUTER_ADDRESS: `0x${string}` =
  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as `0x${string}`;

const UNISWAP_V2_FACTORY_ADDRESS: `0x${string}` =
  "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f" as `0x${string}`;

export type UniswapPurchaseState =
  | "NONE"
  | "REQUESTING_TOKEN_APPROVAL"
  | "APPROVING_TOKEN"
  | "PURCHASING_TOKEN"
  | "DONE"
  | "ERROR";

export enum SwapError {
  INSUFFICIENT_TOKEN_A_BALANCE = "Insufficient balance",
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  FAILED_TO_APPROVE_TOKEN_A = "Failed to approve token A",
  FAILED_TO_SWAP = "Failed to swap",
  GET_AMOUNT_OUT_FAILED = "Failed to get amount out",
  USDC_NOT_AVAILABLE = "USDC not available",
}

function extractErrorMessage(err: any, defaultMessage: string): string {
  let errorMessage: string = defaultMessage;

  if (err?.message) {
    errorMessage = err.message;
  } else if (err?.reason) {
    errorMessage = err.reason;
  } else if (err?.data?.message) {
    errorMessage = err.data.message;
  } else if (err?.shortMessage) {
    errorMessage = err.shortMessage;
  } else if (typeof err === "string") {
    errorMessage = err;
  }

  // Handle common error cases
  if (
    errorMessage.includes("revert") ||
    errorMessage.includes("revert data") ||
    errorMessage.includes("missing revert data")
  ) {
    errorMessage =
      "Transaction failed. This could be due to insufficient liquidity, slippage tolerance exceeded, or contract revert. Please try again with a smaller amount or adjust your slippage tolerance.";
  } else if (errorMessage.includes("insufficient")) {
    errorMessage = "Insufficient balance or liquidity";
  } else if (
    errorMessage.includes("User rejected") ||
    errorMessage.includes("User denied") ||
    errorMessage.includes("rejected")
  ) {
    errorMessage = "Transaction was rejected";
  }

  return errorMessage;
}
type UseSwapProps = {
  tokenA_address: string;
  tokenB_address: string;
};
export const useSwap = ({ tokenA_address, tokenB_address }: UseSwapProps) => {
  const { signer } = useEthersSigner();
  const { data: walletClient } = useWalletClient();
  const [isUsdcSelected, setIsUsdcSelected] = useState<boolean>(false);
  const [tokenA, setTokenA] = useState<any | null>();
  const [tokenB, setTokenB] = useState<any | null>();

  // const[swapState, setSwapState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [uniswapRouter, setUniswapRouter] = useState<any | null>(null);
  const [uniswapPurchaseState, setUniswapPurchaseState] =
    useState<UniswapPurchaseState>("NONE");
  const [pairAddress, setPairAddress] = useState<`0x${string}` | null>(null);
  const [tokenADecimals, setTokenADecimals] = useState<number | null>(null);
  const [tokenBDecimals, setTokenBDecimals] = useState<number | null>(null);
  const SLIPPAGE_NUMERATOR_DEFAULT = BigInt(50); //.5%
  const SLIPPAGE_DENOMINATOR_DEFAULT = BigInt(10000);

  const USDC_MAINNET_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

  function getTokenADecimalsSafe(): number {
    if (tokenADecimals != null) return tokenADecimals;
    const addr = (tokenA?.address || "").toLowerCase();
    if (
      addr === (addresses.usdg || "").toLowerCase() ||
      addr === USDC_MAINNET_ADDRESS.toLowerCase()
    ) {
      return 6;
    }
    return 18;
  }

  function toBigIntAmount(value: bigint | { toString(): string }): bigint {
    if (typeof value === "bigint") return value;
    const raw = (value?.toString?.() || "0").trim();
    // Fast path for plain integers in base units
    if (/^\d+$/.test(raw)) return BigInt(raw);

    const decimals = getTokenADecimalsSafe();
    const decimalValue = new Decimal(raw);
    if (!decimalValue.isFinite()) return BigInt(0);

    // If already an integer (e.g., scientific notation representing an integer), don't rescale
    if (decimalValue.isInteger()) return BigInt(decimalValue.toFixed(0));

    const scaled = decimalValue
      .mul(new Decimal(10).pow(decimals))
      .toFixed(0, Decimal.ROUND_DOWN);
    return BigInt(scaled);
  }

  // Converts numbers/strings to BigInt WITHOUT applying token decimals scaling.
  // Use this for slippage or other unit-less integer parameters.
  function toBigIntPlain(value: bigint | { toString(): string }): bigint {
    if (typeof value === "bigint") return value;
    const raw = (value?.toString?.() || "0").trim();
    try {
      return BigInt(raw);
    } catch {
      return BigInt(0);
    }
  }

  function getAmountOutBigInt({
    amountIn,
    reserveIn,
    reserveOut,
  }: {
    amountIn: bigint;
    reserveIn: bigint;
    reserveOut: bigint;
  }): Result<bigint, string> {
    if (amountIn === BigInt(0)) return new Err("amountIn is 0");
    if (reserveIn === BigInt(0)) return new Err("reserveIn is 0");
    if (reserveOut === BigInt(0)) return new Err("reserveOut is 0");
    const amountInWithFee = amountIn * BigInt(997);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * BigInt(1000) + amountInWithFee;
    return new Ok(numerator / denominator);
  }

  function makeTx(hash: `0x${string}`) {
    return {
      wait: async () => publicClient.waitForTransactionReceipt({ hash }),
    };
  }

  function makeErc20(address: `0x${string}`) {
    return {
      address,
      provider: {
        getGasPrice: async () => publicClient.getGasPrice(),
      },
      decimals: async () =>
        (await publicClient.readContract({
          address,
          abi: parseAbi(["function decimals() view returns (uint8)"]),
          functionName: "decimals",
        })) as number,
      balanceOf: async (owner: `0x${string}`) =>
        (await publicClient.readContract({
          address,
          abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
          functionName: "balanceOf",
          args: [owner],
        })) as bigint,
      allowance: async (owner: `0x${string}`, spender: `0x${string}`) =>
        (await publicClient.readContract({
          address,
          abi: parseAbi([
            "function allowance(address owner, address spender) view returns (uint256)",
          ]),
          functionName: "allowance",
          args: [owner, spender],
        })) as bigint,
      approve: async (spender: `0x${string}`, amount: bigint) => {
        if (!walletClient) throw new Error("Wallet client not available");
        const hash = await walletClient.writeContract({
          address,
          abi: parseAbi([
            "function approve(address spender, uint256 amount) returns (bool)",
          ]),
          functionName: "approve",
          args: [spender, amount],
        });
        return makeTx(hash);
      },
      estimateGas: {
        approve: async (spender: `0x${string}`, amount: bigint) =>
          publicClient.estimateContractGas({
            address,
            abi: parseAbi([
              "function approve(address spender, uint256 amount) returns (bool)",
            ]),
            functionName: "approve",
            account: walletClient?.account?.address as
              | `0x${string}`
              | undefined,
            args: [spender, amount],
          }),
      },
    };
  }

  function makeUniswapRouter(address: `0x${string}`) {
    const ROUTER_ABI = parseAbi([
      "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
    ]);
    return {
      address,
      provider: { getGasPrice: async () => publicClient.getGasPrice() },
      swapExactTokensForTokens: async (
        amountIn: bigint,
        amountOutMin: bigint,
        path: `0x${string}`[],
        to: `0x${string}`,
        deadline: number
      ) => {
        if (!walletClient) throw new Error("Wallet client not available");
        const hash = await walletClient.writeContract({
          address,
          abi: ROUTER_ABI,
          functionName: "swapExactTokensForTokens",
          args: [amountIn, amountOutMin, path, to, BigInt(deadline)],
        });
        return makeTx(hash);
      },
    };
  }

  async function getReservesViem({
    tokenA,
    tokenB,
    pairAddress,
  }: {
    tokenA: `0x${string}`;
    tokenB: `0x${string}`;
    pairAddress: `0x${string}`;
  }): Promise<
    Result<
      {
        reserveTokenA: bigint;
        reserveTokenB: bigint;
      },
      string
    >
  > {
    try {
      const [reserve0, reserve1] = (await publicClient.readContract({
        address: pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: "getReserves",
      })) as readonly [bigint, bigint, number];
      const tokenAIsToken0 = tokenA.toLowerCase() < tokenB.toLowerCase();
      const reserveTokenA = tokenAIsToken0 ? reserve0 : reserve1;
      const reserveTokenB = tokenAIsToken0 ? reserve1 : reserve0;
      return new Ok({ reserveTokenA, reserveTokenB });
    } catch {
      return new Err("Error getting reserves");
    }
  }

  function resetUniswapPurchaseState() {
    setUniswapPurchaseState("NONE");
  }

  async function estimateGasForUniswap({
    amount,
    ethPriceInUSD,
  }: {
    amount: bigint | { toString(): string };

    ethPriceInUSD: number | null;
  }): Promise<Result<string, string>> {
    if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
      return new Ok("0");
    }
    if (!uniswapRouter) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!pairAddress) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenA) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenB) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!signer) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    let totalEstimatedGas = BigInt(0);
    const amountBigInt = toBigIntAmount(amount);
    const getReservesResult = await getReservesViem({
      tokenA: tokenA.address as `0x${string}`,
      tokenB: tokenB.address as `0x${string}`,
      pairAddress: pairAddress as `0x${string}`,
    });
    const signerAddress = await signer.getAddress();

    const allowanceTokenA = await tokenA.allowance(
      signerAddress,
      uniswapRouter.address
    );

    if (!getReservesResult.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    if (allowanceTokenA < amountBigInt) {
      const estimatedGas: bigint = await tokenA.estimateGas.approve(
        uniswapRouter.address,
        amountBigInt
      );
      const gasPrice: bigint = await tokenA.provider.getGasPrice();
      const estimatedCost: bigint = estimatedGas * gasPrice;
      totalEstimatedGas = totalEstimatedGas + estimatedCost;
    }

    const estimatedGas: bigint = BigInt(160000);
    const gasPrice: bigint = await uniswapRouter.provider.getGasPrice();
    const estimatedCost: bigint = estimatedGas * gasPrice;
    totalEstimatedGas = totalEstimatedGas + estimatedCost;

    if (ethPriceInUSD) {
      const estimatedCostInEth = formatEther(totalEstimatedGas);
      const estimatedCostInUSD = (
        parseFloat(estimatedCostInEth) * ethPriceInUSD
      ).toFixed(2);
      return new Ok(estimatedCostInUSD);
    } else {
      return new Err("Failed to get eth price in USD");
    }
  }

  async function swap({
    amount,
    slippagePercentTenThousandDenominator = SLIPPAGE_NUMERATOR_DEFAULT,
  }: {
    amount: bigint | { toString(): string };
    slippagePercentTenThousandDenominator?: bigint | { toString(): string };
  }): Promise<Result<boolean, SwapError>> {
    if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
      return new Ok(false);
    }
    if (!uniswapRouter) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!pairAddress) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenA) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenB) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!signer) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    const amountBigInt = toBigIntAmount(amount);
    const slippageBigInt = toBigIntPlain(slippagePercentTenThousandDenominator);
    const getReservesResult = await getReservesViem({
      tokenA: tokenA.address as `0x${string}`,
      tokenB: tokenB.address as `0x${string}`,
      pairAddress: pairAddress as `0x${string}`,
    });
    const signerAddress = await signer.getAddress();

    const balanceTokenA = await tokenA.balanceOf(signerAddress);
    console.log("balanceTokenA", balanceTokenA.toString());
    console.log("amountBigInt", amountBigInt.toString());
    if (balanceTokenA < amountBigInt)
      return new Err(SwapError.INSUFFICIENT_TOKEN_A_BALANCE);
    const allowanceTokenA = await tokenA.allowance(
      signerAddress,
      uniswapRouter.address
    );

    console.log("allowanceTokenA", allowanceTokenA.toString());
    console.log("amountBigInt", amountBigInt.toString());
    if (allowanceTokenA < amountBigInt) {
      try {
        setUniswapPurchaseState("REQUESTING_TOKEN_APPROVAL");
        const approveTx = await tokenA.approve(
          uniswapRouter.address,
          amountBigInt
        );
        setUniswapPurchaseState("APPROVING_TOKEN");
        await approveTx.wait();
      } catch (err: any) {
        setUniswapPurchaseState("ERROR");
        console.error("Approval error:", err);
        const errorMessage = extractErrorMessage(
          err,
          SwapError.FAILED_TO_APPROVE_TOKEN_A
        );
        return new Err(errorMessage as SwapError);
      }
    }

    if (!getReservesResult.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    const { reserveTokenA, reserveTokenB } = getReservesResult.val;
    const amountOut = getAmountOutBigInt({
      amountIn: amountBigInt,
      reserveIn: BigInt(reserveTokenA.toString()),
      reserveOut: BigInt(reserveTokenB.toString()),
    });
    if (!amountOut.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    const amountOutVal = amountOut.val;
    const amountOutMin =
      amountOutVal -
      (amountOutVal * slippageBigInt) / SLIPPAGE_DENOMINATOR_DEFAULT;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
    const path = [tokenA.address, tokenB.address];

    try {
      setUniswapPurchaseState("PURCHASING_TOKEN");

      const tx = await uniswapRouter.swapExactTokensForTokens(
        amountBigInt,
        amountOutMin,
        path as any,
        signerAddress as any,
        Number(deadline)
      );
      await tx.wait();
      setUniswapPurchaseState("DONE");
    } catch (err: any) {
      setUniswapPurchaseState("ERROR");
      console.error("Swap error:", err);
      const errorMessage = extractErrorMessage(err, SwapError.FAILED_TO_SWAP);
      return new Err(errorMessage as SwapError);
    }
    return new Ok(true);
  }

  async function estimateOutputAmount({
    amountIn,
  }: {
    amountIn: bigint | { toString(): string };
  }): Promise<Result<bigint, SwapError>> {
    if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
      return new Ok(BigInt(0));
    }
    if (!signer) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!uniswapRouter) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!pairAddress) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenA) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenB) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    const amountInBigInt = toBigIntAmount(amountIn);
    // console.log({
    //   tokenA: tokenA.address,
    //   tokenB: tokenB.address,
    //   pairAddress: pair.address,
    // });

    const getReservesResult = await getReservesViem({
      tokenA: tokenA.address as `0x${string}`,
      tokenB: tokenB.address as `0x${string}`,
      pairAddress: pairAddress as `0x${string}`,
    });

    if (!getReservesResult.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    const { reserveTokenA, reserveTokenB } = getReservesResult.val;
    const amountOut = getAmountOutBigInt({
      amountIn: amountInBigInt,
      reserveIn: BigInt(reserveTokenA.toString()),
      reserveOut: BigInt(reserveTokenB.toString()),
    });
    if (!amountOut.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);

    return new Ok(amountOut.val);
  }

  async function estimateGlowToUSDG({
    amountIn,
  }: {
    amountIn: bigint | { toString(): string };
  }): Promise<Result<bigint, SwapError>> {
    if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
      return new Ok(BigInt(0));
    }
    if (!signer) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!uniswapRouter) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    const amountInBigInt = toBigIntAmount(amountIn);

    const pairAddress = (await publicClient.readContract({
      address: UNISWAP_V2_FACTORY_ADDRESS,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "getPair",
      args: [addresses.glow, addresses.usdg],
    })) as `0x${string}`;

    const getReservesResult = await getReservesViem({
      tokenA: addresses.glow,
      tokenB: addresses.usdg,
      pairAddress: pairAddress,
    });

    if (!getReservesResult.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    const { reserveTokenA, reserveTokenB } = getReservesResult.val;
    const amountOut = getAmountOutBigInt({
      amountIn: amountInBigInt,
      reserveIn: BigInt(reserveTokenA.toString()),
      reserveOut: BigInt(reserveTokenB.toString()),
    });
    if (!amountOut.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);

    return new Ok(amountOut.val);
  }

  async function swapGlowToUSDG({
    amount,
    slippagePercentTenThousandDenominator = SLIPPAGE_NUMERATOR_DEFAULT,
  }: {
    amount: bigint | { toString(): string };
    slippagePercentTenThousandDenominator?: bigint | { toString(): string };
  }): Promise<Result<boolean, SwapError>> {
    if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
      return new Ok(false);
    }
    if (!uniswapRouter) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!signer) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);

    // Create token instances for GLOW and USDG
    const glowToken = makeErc20(addresses.glow);
    const usdgToken = makeErc20(addresses.usdg);

    // Get pair for GLOW/USDG
    const pairAddress = (await publicClient.readContract({
      address: UNISWAP_V2_FACTORY_ADDRESS,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "getPair",
      args: [addresses.glow, addresses.usdg],
    })) as `0x${string}`;

    const getReservesResult = await getReservesViem({
      tokenA: addresses.glow,
      tokenB: addresses.usdg,
      pairAddress: pairAddress,
    });

    const signerAddress = (await signer.getAddress()) as `0x${string}`;
    const balanceGlow = await glowToken.balanceOf(signerAddress);

    const amountBigInt = toBigIntAmount(amount);
    const slippageBigInt = toBigIntPlain(slippagePercentTenThousandDenominator);
    console.log("balanceGlow", balanceGlow.toString());
    console.log("amountBigInt", amountBigInt.toString());
    if (balanceGlow < amountBigInt)
      return new Err(SwapError.INSUFFICIENT_TOKEN_A_BALANCE);

    const allowanceGlow = await glowToken.allowance(
      signerAddress,
      uniswapRouter.address
    );

    if (allowanceGlow < amountBigInt) {
      try {
        setUniswapPurchaseState("REQUESTING_TOKEN_APPROVAL");
        const approveTx = await glowToken.approve(
          uniswapRouter.address,
          amountBigInt
        );
        setUniswapPurchaseState("APPROVING_TOKEN");
        await approveTx.wait();
      } catch (err: any) {
        setUniswapPurchaseState("ERROR");
        console.error("Approval error:", err);
        const errorMessage = extractErrorMessage(
          err,
          SwapError.FAILED_TO_APPROVE_TOKEN_A
        );
        return new Err(errorMessage as SwapError);
      }
    }

    if (!getReservesResult.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    const { reserveTokenA, reserveTokenB } = getReservesResult.val;
    const amountOut = getAmountOutBigInt({
      amountIn: amountBigInt,
      reserveIn: BigInt(reserveTokenA.toString()),
      reserveOut: BigInt(reserveTokenB.toString()),
    });
    if (!amountOut.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);

    const amountOutVal = amountOut.val;
    const amountOutMin =
      amountOutVal -
      (amountOutVal * slippageBigInt) / SLIPPAGE_DENOMINATOR_DEFAULT;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
    const path = [addresses.glow, addresses.usdg];

    try {
      setUniswapPurchaseState("PURCHASING_TOKEN");

      const tx = await uniswapRouter.swapExactTokensForTokens(
        amountBigInt,
        amountOutMin,
        path as any,
        signerAddress as any,
        Number(deadline)
      );
      await tx.wait();
      setUniswapPurchaseState("DONE");
    } catch (err: any) {
      setUniswapPurchaseState("ERROR");
      console.error("Swap error:", err);
      const errorMessage = extractErrorMessage(err, SwapError.FAILED_TO_SWAP);
      return new Err(errorMessage as SwapError);
    }
    return new Ok(true);
  }

  async function deployFixture() {
    if (!walletClient) return;
    if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
      return;
    }
    const router = makeUniswapRouter(UNISWAP_V2_ROUTER_ADDRESS);
    let pairAddr: `0x${string}`;
    let tokenAWrapper: any;

    if (
      tokenA_address.toLowerCase() ===
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48".toLowerCase()
    ) {
      pairAddr = (await publicClient.readContract({
        address: UNISWAP_V2_FACTORY_ADDRESS,
        abi: UNISWAP_V2_FACTORY_ABI,
        functionName: "getPair",
        args: [addresses.usdg, tokenB_address as `0x${string}`],
      })) as `0x${string}`;
      tokenAWrapper = makeErc20(addresses.usdg);
      setIsUsdcSelected(true);
    } else {
      pairAddr = (await publicClient.readContract({
        address: UNISWAP_V2_FACTORY_ADDRESS,
        abi: UNISWAP_V2_FACTORY_ABI,
        functionName: "getPair",
        args: [
          tokenA_address as `0x${string}`,
          tokenB_address as `0x${string}`,
        ],
      })) as `0x${string}`;
      tokenAWrapper = makeErc20(tokenA_address as `0x${string}`);
      setIsUsdcSelected(false);
    }

    const tokenBWrapper = makeErc20(tokenB_address as `0x${string}`);
    setTokenA(tokenAWrapper);
    setTokenB(tokenBWrapper);

    setUniswapRouter(router);
    setPairAddress(pairAddr);

    try {
      const [decA, decB] = await Promise.all([
        tokenAWrapper.decimals(),
        tokenBWrapper.decimals(),
      ]);
      setTokenADecimals(Number(decA));
      setTokenBDecimals(Number(decB));
    } catch {}
  }

  useEffect(() => {
    deployFixture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient, tokenA_address, tokenB_address]);

  return {
    swap,
    estimateOutputAmount,
    estimateGasForUniswap,
    estimateGlowToUSDG,
    swapGlowToUSDG,
    resetUniswapPurchaseState,
    uniswapPurchaseState,
  };
};
