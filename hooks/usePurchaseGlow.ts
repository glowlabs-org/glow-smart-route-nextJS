import { BigNumber, BigNumberish, ethers } from "ethers";
import { useContracts } from "./useContracts";
import { Ok, Err, Result } from "ts-results";
import { useState } from "react";
import { useEthersSigner } from "./useEthersSigner";
import { estimateGlowFromUSDG } from "@/utils/math/estimateGlowFromUSDG";
import { formatUnits } from "viem";
import { getOptimalUSDGAmounts } from "@/utils/glowSmartBalancing";
import { getReserves } from "@/utils/uniswapv2/getReserves";
import {
  UnifapV2Router,
  UnifapV2Router__factory,
  ERC20,
  ERC20__factory,
  addresses,
} from "@glowlabs-org/guarded-launch-ethers-sdk";
import {
  UnifapV2Pair,
  UnifapV2Pair__factory,
} from "@glowlabs-org/guarded-launch-ethers-sdk";
import { Contract } from "ethers";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";

const UNISWAP_V2_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
];

const UNISWAP_V2_FACTORY_ADDRESS: `0x${string}` =
  "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f" as `0x${string}`;

export type SmartBalancingAmounts = {
  amount_in_uni: BigNumberish;
  amount_in_glow_bonding_curve: BigNumberish;
  amount_out_uni: string;
  amount_out_glow: string;
  uniswapUSDGReserves: number;
  uniswapGlowReserves: number;
  earlyLiquidityCurrentPrice: number;
  usdgToSpend: number;
};

export type PurchaseGlowState =
  | "NONE"
  | "QUOTING"
  | "REQUESTING_USDC_APPROVAL_TO_OBTAIN_USDG"
  | "APPROVING_USDC_TO_OBTAIN_USDG"
  | "PURCHASING_USDG"
  | "SUCCESSFULLY_OBTAINED_USDG"
  | "REQUESTING_USDG_APPROVAL_TO_OBTAIN_GLOW"
  | "APPROVING_USDG_TO_OBTAIN_GLOW"
  | "PURCHASING_GLOW"
  | "DONE"
  | "ERROR";

export const purchaseGlowStateMessages = {
  NONE: "None",
  QUOTING: "Quoting",
  REQUESTING_USDC_APPROVAL_TO_OBTAIN_USDG:
    "Requesting USDC Approval to Obtain USDG",
  APPROVING_USDC_TO_OBTAIN_USDG: "Approving USDC to Obtain USDG",
  PURCHASING_USDG: "Swaping USDC for USDG",
  SUCCESSFULLY_OBTAINED_USDG: "Successfully Obtained USDG",
  REQUESTING_USDG_APPROVAL_TO_OBTAIN_GLOW:
    "Requesting USDG Approval to Obtain Glow",
  APPROVING_USDG_TO_OBTAIN_GLOW: "Approving USDG to Obtain Glow",
  PURCHASING_GLOW: "Purchasing Glow From Bonding Curve",
  DONE: "Success",
  ERROR: "Error",
};

export const purchaseGlowStateToMessage = (state: PurchaseGlowState) => {
  return purchaseGlowStateMessages[state];
};
export function usePurchaseGlow() {
  const DENOMINATOR = BigNumber.from(10_000);
  const signer = useEthersSigner();
  const { usdc, usdg, glow, earlyLiquidity } = useContracts(signer);
  const [glowPurchaseState, setGlowPurchaseState] =
    useState<PurchaseGlowState>("NONE");

  function resetGlowPurchaseState() {
    setGlowPurchaseState("NONE");
  }

  /**
   *
   * @param amount ~ The amount of glow in 18 decimals to quote
   * @returns Result<BigNumber, string> ~ The amount of usdc needed to purchase the amount of glow
   */
  async function getGlowQuoteEarlyLiquidity(
    incrementsToPurchase: number
  ): Promise<Result<BigNumber, string>> {
    if (!earlyLiquidity) return new Err("Early Liquidity not available");
    const price = await earlyLiquidity.getPrice(incrementsToPurchase);
    return new Ok(price);
  }

  async function findAmountGlowFromUSDGAmount(
    usdgAmount: BigNumberish
  ): Promise<Result<BigNumber, string>> {
    if (!usdg) return new Err("USDG not available");
    if (!glow) return new Err("Glow not available");
    if (!earlyLiquidity)
      return new Err("Early Liquidity or USDC not available");
    const firstTermBN = await earlyLiquidity.getPrice(1);
    const firstTermNumber = firstTermBN.toNumber();
    const amountGlowEstimated =
      estimateGlowFromUSDG(
        firstTermNumber / 1e6,
        Number(formatUnits(BigInt(usdgAmount.toString()), 6))
      ) / 100;
    return new Ok(ethers.utils.parseUnits(amountGlowEstimated.toString(), 18));
  }

  /**
   *
   * @param incrementsToPurchase ~ The amount of .01 GLOW Increments to purchase (100 increments = 1 GLOW)
   * @param slippagePointsTenThousandths ~ The amount of slippage to allow in the purchase (denominator 10_000)
   * @returns
   */
  async function purchaseGlowEarlyLiquidity({
    incrementsToPurchase,
    slippagePointsTenThousandths = BigNumber.from(0), // 0%
  }: {
    incrementsToPurchase: number;
    slippagePointsTenThousandths: BigNumber;
  }): Promise<Result<boolean, string>> {
    if (!earlyLiquidity) return new Err("Early Liquidity not available");
    if (!usdc) return new Err("USDC not available");
    if (!usdg) return new Err("USDG not available");
    if (!glow) return new Err("Glow not available");

    setGlowPurchaseState("QUOTING");
    // commented for now
    // const decreasedIncrementsToPurchase =
    //   incrementsToPurchase *
    //   (1 - slippagePointsTenThousandths.toNumber() / 10000);
    const priceResult: Result<BigNumber, string> =
      await getGlowQuoteEarlyLiquidity(incrementsToPurchase);
    if (!priceResult.ok) return new Err(priceResult.val);
    const price: BigNumber = priceResult.val;
    const priceTimesSlippage: BigNumber = price
      .mul(slippagePointsTenThousandths)
      .div(DENOMINATOR);
    const usdgNeeded: BigNumber = price.add(priceTimesSlippage);

    const signerAddress = await usdc.signer.getAddress();
    const udsgBalance = await usdg.balanceOf(signerAddress);

    //If we don't have enough USDG, try obtaining more by swapping USDC

    if (udsgBalance.lt(usdgNeeded)) {
      const usdcBalance = await usdc.balanceOf(signerAddress);
      const usdcNeeded = usdgNeeded.sub(udsgBalance);
      if (usdcNeeded.gt(usdcBalance)) {
        setGlowPurchaseState("ERROR");
        return new Err("Insufficient USDG and USDC Balance");
      }
      const usdcAllowance = await usdc.allowance(signerAddress, usdg.address);
      if (usdcAllowance.lt(usdcNeeded)) {
        setGlowPurchaseState("REQUESTING_USDC_APPROVAL_TO_OBTAIN_USDG");

        try {
          const approveTx = await usdc.approve(usdg.address, usdcNeeded);
          setGlowPurchaseState("APPROVING_USDC_TO_OBTAIN_USDG");
          await approveTx.wait();
        } catch (e) {
          setGlowPurchaseState("ERROR");
          return new Err("Error approving USDC to obtain USDG");
        }
      }

      setGlowPurchaseState("PURCHASING_USDG");
      try {
        const swapTx = await usdg.swap(signerAddress, usdcNeeded);
        await swapTx.wait();
        setGlowPurchaseState("SUCCESSFULLY_OBTAINED_USDG");
      } catch (e) {
        setGlowPurchaseState("ERROR");
        return new Err("Error swapping USDC for USDG");
      }
    }

    //Now we can approve USDG to be used by early liquidity
    const usdgAllowance = await usdg.allowance(
      signerAddress,
      earlyLiquidity.address
    );
    if (usdgAllowance.lt(usdgNeeded)) {
      try {
        const approveTx = await usdg.approve(
          earlyLiquidity.address,
          usdgNeeded
        );
        setGlowPurchaseState("APPROVING_USDG_TO_OBTAIN_GLOW");
        await approveTx.wait();
      } catch (e) {
        setGlowPurchaseState("ERROR");
        return new Err("Error approving USDG to obtain Glow");
      }
    }

    //Now we can purchase the glow
    setGlowPurchaseState("PURCHASING_GLOW");

    try {
      const purchaseTx = await earlyLiquidity.buy(
        incrementsToPurchase,
        usdgNeeded
      );
      await purchaseTx.wait();
    } catch (e) {
      setGlowPurchaseState("ERROR");
      return new Err("Error purchasing Glow");
    }
    setGlowPurchaseState("DONE");
    return new Ok(true);
  }

  /**
   *
   * @param incrementsToPurchase ~ The amount of .01 GLOW Increments to purchase (100 increments = 1 GLOW)
   * @param slippagePointsTenThousandths ~ The amount of slippage to allow in the purchase (denominator 10_000)
   * @returns
   */
  async function estimateGasForPurchaseGlowEarlyLiquidity({
    incrementsToPurchase,
    slippagePointsTenThousandths = BigNumber.from(500), //.5%
    ethPriceInUSD,
  }: {
    incrementsToPurchase: number;
    slippagePointsTenThousandths: BigNumber;
    ethPriceInUSD: number | null;
  }): Promise<Result<string, string>> {
    if (!earlyLiquidity) return new Err("Early Liquidity not available");
    if (!usdc) return new Err("USDC not available");
    if (!usdg) return new Err("USDG not available");
    if (!glow) return new Err("Glow not available");
    let totalEstimatedGas = BigNumber.from(0);
    const priceResult: Result<BigNumber, string> =
      await getGlowQuoteEarlyLiquidity(incrementsToPurchase);
    if (!priceResult.ok) return new Err(priceResult.val);
    const price: BigNumber = priceResult.val;
    const priceTimesSlippage: BigNumber = price
      .mul(slippagePointsTenThousandths)
      .div(DENOMINATOR);
    const usdgNeeded: BigNumber = price.add(priceTimesSlippage);

    const usdcGasPrice = await usdc.provider.getGasPrice();
    const signerAddress = await usdc.signer.getAddress();

    const usdgAllowance = await usdg.allowance(
      signerAddress,
      earlyLiquidity.address
    );

    if (usdgAllowance.lt(usdgNeeded)) {
      const estimatedGas = await usdg.estimateGas.approve(
        earlyLiquidity.address,
        usdgNeeded
      );

      const estimatedCost = estimatedGas.mul(usdcGasPrice);
      totalEstimatedGas = totalEstimatedGas.add(estimatedCost);
    }

    const estimatedGas = BigNumber.from(160000);

    const estimatedCost = estimatedGas.mul(usdcGasPrice);
    totalEstimatedGas = totalEstimatedGas.add(estimatedCost);

    if (ethPriceInUSD) {
      const estimatedCostInEth = ethers.utils.formatEther(totalEstimatedGas);
      const estimatedCostInUSD = (
        parseFloat(estimatedCostInEth) * ethPriceInUSD
      ).toFixed(2);
      return new Ok(estimatedCostInUSD);
    } else {
      return new Err("Could not fetch the ETH price to calculate cost in USD.");
    }
  }

  /**
   *
   * @param amountUsdgIn ~ The amount of USDG to purchase glow with
   * @param earlyLiquidityCurrentPrice ~ The price of glow in USD for the early liquidity
   * @returns
   */
  async function getSmartBalancingAmounts({
    amountUsdgIn,
    earlyLiquidityCurrentPrice,
  }: {
    amountUsdgIn: number;
    earlyLiquidityCurrentPrice: number;
  }): Promise<Result<SmartBalancingAmounts, string>> {
    if (!signer) return new Err("Signer not available");
    const factory = new Contract(
      UNISWAP_V2_FACTORY_ADDRESS,
      UNISWAP_V2_FACTORY_ABI,
      signer
    );
    const pairAddress = await factory.getPair(addresses.usdg, addresses.glow);
    const pair = UnifapV2Pair__factory.connect(pairAddress, signer);
    const getReservesResult = await getReserves({
      tokenA: addresses.usdg,
      tokenB: addresses.glow,
      pairAddress: pair.address,
      signer,
    });

    if (!getReservesResult.ok) return new Err("Error getting reserves");
    const { reserveTokenA, reserveTokenB } = getReservesResult.val;

    const reservesUsdg = Number(
      ethers.utils.formatUnits(reserveTokenA.toString(), "6")
    );

    const reservesGlow = Number(
      ethers.utils.formatUnits(reserveTokenB.toString(), "18")
    );

    const {
      amountUSDGToSpendInUniswap,
      amountUSDGToSpendInEarlyLiquidity,
      expectedOutFromUniswap,
      expectedOutFromEarlyLiquidity,
      expectedEndingPriceEarlyLiquidity,
      expectedEndingPriceUniswap,
    } = getOptimalUSDGAmounts({
      uniswapUSDGReserve: reservesUsdg,
      uniswapGlowReserve: reservesGlow,
      earlyLiquidityCurrentPrice: earlyLiquidityCurrentPrice,
      usdgToSpend: amountUsdgIn,
    });

    return new Ok({
      amount_in_uni: amountUSDGToSpendInUniswap,
      amount_in_glow_bonding_curve: amountUSDGToSpendInEarlyLiquidity,
      amount_out_uni: expectedOutFromUniswap.toFixed(2),
      amount_out_glow: expectedOutFromEarlyLiquidity.toFixed(2),
      uniswapUSDGReserves: reservesUsdg,
      uniswapGlowReserves: reservesGlow,
      expectedEndingPriceEarlyLiquidity: expectedEndingPriceEarlyLiquidity,
      expectedEndingPriceUniswap: expectedEndingPriceUniswap,
      earlyLiquidityCurrentPrice: earlyLiquidityCurrentPrice,
      usdgToSpend: amountUsdgIn,
    });
  }

  return {
    resetGlowPurchaseState,
    glowPurchaseState,
    purchaseGlowEarlyLiquidity,
    getGlowQuoteEarlyLiquidity,
    findAmountGlowFromUSDGAmount,
    getSmartBalancingAmounts,
    estimateGasForPurchaseGlowEarlyLiquidity,
  };
}
