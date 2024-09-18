import {
  ERC20,
  EarlyLiquidity,
  Glow,
  USDG,
} from "@glowlabs-org/guarded-launch-ethers-sdk";
import { BigNumber, ethers } from "ethers";
import { Err, Ok, Result } from "ts-results";
import { getEthPriceInUSD } from "./getEthPriceInUSD";
const PURCHASE_GLOW_DENOMINATOR = BigNumber.from(10_000);

/**
 *
 * @param amount ~ The amount of glow in 18 decimals to quote
 * @returns Result<BigNumber, string> ~ The amount of usdc needed to purchase the amount of glow
 */
async function getGlowQuoteEarlyLiquidity(
  earlyLiquidity: EarlyLiquidity,
  incrementsToPurchase: number
): Promise<Result<BigNumber, string>> {
  if (!earlyLiquidity) return new Err("Early Liquidity not available");
  const price = await earlyLiquidity.getPrice(incrementsToPurchase);
  return new Ok(price);
}

/**
 *
 * @param incrementsToPurchase ~ The amount of .01 GLOW Increments to purchase (100 increments = 1 GLOW)
 * @param slippagePointsTenThousandths ~ The amount of slippage to allow in the purchase (denominator 10_000)
 * @returns
 */
export async function estimateGasPriceInUSDForPurchaseGlowEarlyLiquidity({
  incrementsToPurchase,
  slippagePointsTenThousandths = BigNumber.from(500), //.5%
  earlyLiquidity,
  usdc,
  usdg,
  glow,
  signer,
}: {
  incrementsToPurchase: number;
  slippagePointsTenThousandths: BigNumber;
  earlyLiquidity: EarlyLiquidity;
  usdc: ERC20;
  usdg: USDG;
  glow: Glow;
  signer: ethers.Signer;
}): Promise<Result<string, string>> {
  if (!earlyLiquidity) return new Err("Early Liquidity not available");
  if (!usdc) return new Err("USDC not available");
  if (!usdg) return new Err("USDG not available");
  if (!glow) return new Err("Glow not available");
  let totalEstimatedGas = BigNumber.from(0);
  const priceResult: Result<BigNumber, string> =
    await getGlowQuoteEarlyLiquidity(earlyLiquidity, incrementsToPurchase);
  if (!priceResult.ok) return new Err(priceResult.val);
  const price: BigNumber = priceResult.val;
  // console.log({ price, incrementsToPurchase });
  const priceTimesSlippage: BigNumber = price
    .mul(slippagePointsTenThousandths)
    .div(PURCHASE_GLOW_DENOMINATOR);
  const usdgNeeded: BigNumber = price.add(priceTimesSlippage);

  const signerAddress = await signer.getAddress();
  // console.log({ signerAddress });
  const udsgBalance = await usdg.balanceOf(signerAddress);

  if (udsgBalance.lt(usdgNeeded)) {
    const usdcNeeded = usdgNeeded.sub(udsgBalance);
    const usdcAllowance = await usdc.allowance(signerAddress, usdg.address);
    if (usdcAllowance.lt(usdcNeeded)) {
      const estimatedGas = await usdc.estimateGas.approve(
        usdg.address,
        usdcNeeded
      );

      const gasPrice = await usdc.provider.getGasPrice();
      const estimatedCost = estimatedGas.mul(gasPrice);
      totalEstimatedGas = totalEstimatedGas.add(estimatedCost);
    }

    const estimatedGas = await usdg.estimateGas.swap(signerAddress, usdcNeeded);
    const gasPrice = await usdg.provider.getGasPrice();
    const estimatedCost = estimatedGas.mul(gasPrice);
    totalEstimatedGas = totalEstimatedGas.add(estimatedCost);
  }

  //Now we can approve USDG to be used by early liquidity
  const usdgAllowance = await usdg.allowance(
    signerAddress,
    earlyLiquidity.address
  );

  if (usdgAllowance.lt(usdgNeeded)) {
    const estimatedGas = await usdg.estimateGas.approve(
      earlyLiquidity.address,
      usdgNeeded
    );
    const gasPrice = await usdc.provider.getGasPrice();
    const estimatedCost = estimatedGas.mul(gasPrice);
    totalEstimatedGas = totalEstimatedGas.add(estimatedCost);
  }

  const estimatedGas = await earlyLiquidity.estimateGas.buy(
    incrementsToPurchase,
    usdgNeeded
  );
  const gasPrice = await usdc.provider.getGasPrice();
  const estimatedCost = estimatedGas.mul(gasPrice);
  totalEstimatedGas = totalEstimatedGas.add(estimatedCost);
  const ethPriceInUSD = await getEthPriceInUSD();
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
