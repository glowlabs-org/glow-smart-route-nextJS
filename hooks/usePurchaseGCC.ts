/**
Users purchase GCC From Uniswap using USDG
*/
import {
  UnifapV2Router,
  UnifapV2Router__factory,
} from "@glowlabs-org/guarded-launch-ethers-sdk";
import { useContracts } from "./useContracts";
import { useEthersSigner } from "./useEthersSigner";
import { useEffect, useState } from "react";
import {
  UnifapV2Pair,
  UnifapV2Pair__factory,
} from "@glowlabs-org/guarded-launch-ethers-sdk";
import { formatUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";
import { getReserves } from "@/utils/uniswapv2/getReserves";
import { Result, Ok, Err } from "ts-results";
import { getAmountOut } from "@/utils/uniswapv2/getAmountOut";

const UNISWAP_V2_ROUTER_ADDRESS: `0x${string}` =
  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as `0x${string}`;

const USDG_GCC_PAIR_ADDRESS =
  "0xeed0974404f635aa5e5f6e4793d1a417798f164e" as `0x${string}`;

export const usePurchaseGCC = () => {
  const signer = useEthersSigner();
  const { usdg, gcc, usdc } = useContracts(signer);
  const [gccPrice, setGCCPrice] = useState<string>();

  const [uniswapRouter, setUniswapRouter] = useState<UnifapV2Router | null>(
    null
  );
  const [pair, setPair] = useState<UnifapV2Pair | null>(null);
  const SLIPPAGE_NUMERATOR_DEFAULT = BigNumber.from(50); //.5%
  const SLIPPAGE_DENOMINATOR_DEFAULT = BigNumber.from(10000);
  const [usdgAllowance, setUSDGAllowance] = useState<string>();
  async function fetchGCCPrice() {
    if (!uniswapRouter) return;
    if (!pair) return;
    if (!gcc) return;
    if (!usdg) return;
    const [reserve0, reserve1] = await pair.getReserves();
    const reserveGCC =
      BigInt(gcc?.address) > BigInt(usdg?.address) ? reserve1 : reserve0;
    const reserveUSDG =
      BigInt(gcc?.address) > BigInt(usdg?.address) ? reserve0 : reserve1;
    const price =
      Number(formatUnits(reserveUSDG, 6)) / Number(formatUnits(reserveGCC, 18));
    setGCCPrice(price.toFixed(2));
  }

  async function getPurchaseGCCQuote({
    amount,
  }: {
    amount: BigNumber;
  }): Promise<Result<BigNumber, string>> {
    if (!usdg) return new Err("USDG not available");
    if (!gcc) return new Err("GCC not available");
    if (!uniswapRouter) return new Err("Uniswap Router not available");
    if (!signer) return new Err("Signer not available");
    const getReservesResult = await getReserves({
      tokenA: gcc.address,
      tokenB: usdg.address,
      pairAddress: USDG_GCC_PAIR_ADDRESS,
      signer: signer,
    });
    if (!getReservesResult.ok) return new Err(getReservesResult.val);
    const { reserveTokenA: gccReserves, reserveTokenB: usdgReserves } =
      getReservesResult.val;
    const amountOutResult = getAmountOut({
      amountIn: amount,
      reserveIn: usdgReserves,
      reserveOut: gccReserves,
    });
    if (!amountOutResult.ok) return new Err(amountOutResult.val);
    const amountOut: BigNumber = amountOutResult.val;
    return new Ok(amountOut);
  }
  async function purchaseGCC({
    amount,
    slippagePercentTenThousandDenominator,
  }: {
    amount: BigNumber;
    slippagePercentTenThousandDenominator?: BigNumber;
  }) {
    let slippagePercentTenThousand =
      slippagePercentTenThousandDenominator || SLIPPAGE_DENOMINATOR_DEFAULT;
    if (!usdg) return new Err("USDG not available");
    if (!gcc) return new Err("GCC not available");
    if (!uniswapRouter) return new Err("Uniswap Router not available");
    if (!signer) return new Err("Signer not available");
    if (!usdc) return new Err("USDC not available");
    const amountOutResult = await getPurchaseGCCQuote({ amount });
    if (!amountOutResult.ok) return new Err(amountOutResult.val);
    const amountOut: BigNumber = amountOutResult.val;
    const amountOutWithSlippage = amountOut
      .mul(slippagePercentTenThousand)
      .div(SLIPPAGE_DENOMINATOR_DEFAULT);
    const signerAddress = await signer.getAddress();

    const usdgBalance = await usdg.balanceOf(signerAddress);
    if (usdgBalance.lt(amount)) {
      const usdcBalance = await usdc.balanceOf(signerAddress);
      const usdcNeeded = amount.sub(usdgBalance);
      if (usdcNeeded.gt(usdcBalance)) {
        return new Err("Insufficient USDG and USDC Balance");
      }
      const usdcAllowance = await usdc.allowance(signerAddress, usdg.address);
      if (usdcAllowance.lt(usdcNeeded)) {
        try {
          const approveTx = await usdc.approve(usdg.address, usdcNeeded);
          await approveTx.wait();
        } catch (e) {
          return new Err("Error approving USDC to obtain USDG");
        }
      }
      try {
        const swapTx = await usdg.swap(signerAddress, usdcNeeded);
        await swapTx.wait();
      } catch (e) {
        return new Err("Error purchasing USDG");
      }
    }

    const usdgAllowance = await usdg.allowance(
      signer._address,
      uniswapRouter.address
    );
    if (usdgAllowance.lt(amount)) {
      try {
        const approveTx = await usdg.approve(uniswapRouter.address, amount);
        await approveTx.wait();
      } catch (e) {
        return new Err("Error approving USDG to swap");
      }
    }
    try {
      const tx = await uniswapRouter.swapExactTokensForTokens(
        amount,
        amountOutWithSlippage,
        [usdg.address, gcc.address],
        signerAddress,
        Math.floor(Date.now() / 1000) + 60 * 10 //10 minute deadline
      );
      await tx.wait();
      return new Ok(true);
    } catch (e) {
      return new Err("Error purchasing GCC");
    }
  }
  useEffect(() => {
    if (signer) {
      const router = UnifapV2Router__factory.connect(
        UNISWAP_V2_ROUTER_ADDRESS,
        signer
      );
      setUniswapRouter(router);

      const pair = UnifapV2Pair__factory.connect(USDG_GCC_PAIR_ADDRESS, signer);
      setPair(pair);
    }
  }, [signer]);

  useEffect(() => {
    if (pair) {
      fetchGCCPrice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  return {
    gccPrice,
    purchaseGCC,
  };
};
