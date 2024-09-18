/**
Users purchase GCC From Uniswap using USDG
*/
import {
  UnifapV2Router,
  UnifapV2Router__factory,
  ERC20,
  ERC20__factory,
  addresses,
} from "@glowlabs-org/guarded-launch-ethers-sdk";

import { useEthersSigner } from "./useEthersSigner";
import { useEffect, useState } from "react";
import { Contract, ethers } from "ethers";
import {
  UnifapV2Pair,
  UnifapV2Pair__factory,
} from "@glowlabs-org/guarded-launch-ethers-sdk";

import { BigNumber } from "ethers";
import { getReserves } from "@/utils/uniswapv2/getReserves";
import { Result, Ok, Err } from "ts-results";
import { getAmountOut } from "@/utils/uniswapv2/getAmountOut";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";

const UNISWAP_V2_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
];
const UNISWAP_V2_ROUTER_ADDRESS: `0x${string}` =
  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as `0x${string}`;

const UNISWAP_V2_FACTORY_ADDRESS: `0x${string}` =
  "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f" as `0x${string}`;

const USDG_GCC_PAIR_ADDRESS =
  "0xeed0974404f635aa5e5f6e4793d1a417798f164e" as `0x${string}`;

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
type UseSwapProps = {
  tokenA_address: string;
  tokenB_address: string;
};
export const useSwap = ({ tokenA_address, tokenB_address }: UseSwapProps) => {
  const signer = useEthersSigner();
  const [uniswapV2Factory, setUniswapV2Factory] = useState<Contract | null>(
    null
  );
  const [isUsdcSelected, setIsUsdcSelected] = useState<boolean>(false);
  const [tokenA, setTokenA] = useState<ERC20 | null>();
  const [tokenB, setTokenB] = useState<ERC20 | null>();
  const [gccPrice, setGCCPrice] = useState<string>();
  // const[swapState, setSwapState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [uniswapRouter, setUniswapRouter] = useState<UnifapV2Router | null>(
    null
  );
  const [uniswapPurchaseState, setUniswapPurchaseState] =
    useState<UniswapPurchaseState>("NONE");
  const [pair, setPair] = useState<UnifapV2Pair | null>(null);
  const SLIPPAGE_NUMERATOR_DEFAULT = BigNumber.from(50); //.5%
  const SLIPPAGE_DENOMINATOR_DEFAULT = BigNumber.from(10000);

  function resetUniswapPurchaseState() {
    setUniswapPurchaseState("NONE");
  }

  async function estimateGasForUniswap({
    amount,
    ethPriceInUSD,
  }: {
    amount: BigNumber;

    ethPriceInUSD: number | null;
  }): Promise<Result<string, string>> {
    if (!uniswapRouter) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!pair) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenA) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenB) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!signer) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    let totalEstimatedGas = BigNumber.from(0);
    const getReservesResult = await getReserves({
      tokenA: tokenA.address,
      tokenB: tokenB.address,
      pairAddress: pair.address,
      signer,
    });
    const signerAddress = await signer.getAddress();

    const allowanceTokenA = await tokenA.allowance(
      signerAddress,
      uniswapRouter.address
    );

    if (!getReservesResult.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    if (allowanceTokenA.lt(amount)) {
      const estimatedGas = await tokenA.estimateGas.approve(
        uniswapRouter.address,
        amount
      );
      const gasPrice = await tokenA.provider.getGasPrice();
      const estimatedCost = estimatedGas.mul(gasPrice);
      totalEstimatedGas = totalEstimatedGas.add(estimatedCost);
    }

    const estimatedGas = BigNumber.from(160000);
    const gasPrice = await uniswapRouter.provider.getGasPrice();
    const estimatedCost = estimatedGas.mul(gasPrice);
    totalEstimatedGas = totalEstimatedGas.add(estimatedCost);

    if (ethPriceInUSD) {
      const estimatedCostInEth = ethers.utils.formatEther(totalEstimatedGas);
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
    amount: BigNumber;
    slippagePercentTenThousandDenominator?: BigNumber;
  }): Promise<Result<boolean, SwapError>> {
    if (!uniswapRouter) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!pair) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenA) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenB) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!signer) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    const getReservesResult = await getReserves({
      tokenA: tokenA.address,
      tokenB: tokenB.address,
      pairAddress: pair.address,
      signer,
    });
    const signerAddress = await signer.getAddress();

    const balanceTokenA = await tokenA.balanceOf(signerAddress);
    if (balanceTokenA.lt(amount))
      return new Err(SwapError.INSUFFICIENT_TOKEN_A_BALANCE);
    const allowanceTokenA = await tokenA.allowance(
      signerAddress,
      uniswapRouter.address
    );

    if (allowanceTokenA.lt(amount)) {
      try {
        setUniswapPurchaseState("REQUESTING_TOKEN_APPROVAL");
        const approveTx = await tokenA.approve(uniswapRouter.address, amount);
        setUniswapPurchaseState("APPROVING_TOKEN");
        await approveTx.wait();
      } catch (err) {
        setUniswapPurchaseState("ERROR");
        return new Err(SwapError.FAILED_TO_APPROVE_TOKEN_A);
      }
    }

    if (!getReservesResult.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    const { reserveTokenA, reserveTokenB } = getReservesResult.val;
    const amountOut = getAmountOut({
      amountIn: amount,
      reserveIn: reserveTokenA,
      reserveOut: reserveTokenB,
    });
    if (!amountOut.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    const amountOutMin = amountOut.val.sub(
      amountOut.val
        .mul(slippagePercentTenThousandDenominator)
        .div(SLIPPAGE_DENOMINATOR_DEFAULT)
    );

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const path = [tokenA.address, tokenB.address];

    try {
      setUniswapPurchaseState("PURCHASING_TOKEN");

      const tx = await uniswapRouter.swapExactTokensForTokens(
        amount,
        amountOutMin,
        path,
        signerAddress,
        deadline
      );
      await tx.wait();
      setUniswapPurchaseState("DONE");
    } catch (err) {
      setUniswapPurchaseState("ERROR");
      return new Err(SwapError.FAILED_TO_SWAP);
    }
    return new Ok(true);
  }

  async function estimateOutputAmount({
    amountIn,
  }: {
    amountIn: BigNumber;
  }): Promise<Result<BigNumber, SwapError>> {
    if (!signer) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!uniswapRouter) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!pair) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenA) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    if (!tokenB) return new Err(SwapError.CONTRACTS_NOT_AVAILABLE);
    // console.log({
    //   tokenA: tokenA.address,
    //   tokenB: tokenB.address,
    //   pairAddress: pair.address,
    // });

    const getReservesResult = await getReserves({
      tokenA: tokenA.address,
      tokenB: tokenB.address,
      pairAddress: pair.address,
      signer,
    });

    if (!getReservesResult.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);
    const { reserveTokenA, reserveTokenB } = getReservesResult.val;
    const amountOut = getAmountOut({
      amountIn,
      reserveIn: reserveTokenA,
      reserveOut: reserveTokenB,
    });
    if (!amountOut.ok) return new Err(SwapError.GET_AMOUNT_OUT_FAILED);

    return new Ok(amountOut.val);
  }

  async function deployFixture() {
    if (signer) {
      const router = UnifapV2Router__factory.connect(
        UNISWAP_V2_ROUTER_ADDRESS,
        signer
      );
      const factory = new Contract(
        UNISWAP_V2_FACTORY_ADDRESS,
        UNISWAP_V2_FACTORY_ABI,
        signer
      );
      let pair: UnifapV2Pair;
      let tokenA: ERC20;
      if (tokenA_address === "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48") {
        const pairAddress = await factory.getPair(
          addresses.usdg,
          tokenB_address
        );
        pair = UnifapV2Pair__factory.connect(pairAddress, signer);
        tokenA = ERC20__factory.connect(addresses.usdg, signer);
        setIsUsdcSelected(true);
      } else {
        const pairAddress = await factory.getPair(
          tokenA_address,
          tokenB_address
        );
        pair = UnifapV2Pair__factory.connect(pairAddress, signer);
        tokenA = ERC20__factory.connect(tokenA_address, signer);
        setIsUsdcSelected(false);
      }

      const tokenB = ERC20__factory.connect(tokenB_address, signer);
      setTokenA(tokenA);
      setTokenB(tokenB);

      setUniswapRouter(router);
      setUniswapV2Factory(factory);

      setPair(pair);
    }
  }

  useEffect(() => {
    deployFixture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, tokenA_address, tokenB_address]);

  return {
    swap,
    estimateOutputAmount,
    estimateGasForUniswap,
    resetUniswapPurchaseState,
    uniswapPurchaseState,
  };
};
