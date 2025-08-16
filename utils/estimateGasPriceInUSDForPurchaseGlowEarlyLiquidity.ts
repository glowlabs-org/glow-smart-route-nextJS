import { Err, Ok, Result } from "ts-results";
import { getEthPriceInUSD } from "./getEthPriceInUSD";
import { formatEther } from "viem";
const PURCHASE_GLOW_DENOMINATOR = BigInt(10_000);

/**
 *
 * @param amount ~ The amount of glow in 18 decimals to quote
 * @returns Result<BigNumber, string> ~ The amount of usdc needed to purchase the amount of glow
 */
async function getGlowQuoteEarlyLiquidity(
  earlyLiquidity: { getPrice: (increments: number) => Promise<bigint> },
  incrementsToPurchase: number
): Promise<Result<bigint, string>> {
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
  slippagePointsTenThousandths = BigInt(500), //.5%
  earlyLiquidity,
  usdc,
  usdg,
  glow,
  signer,
}: {
  incrementsToPurchase: number;
  slippagePointsTenThousandths: bigint;
  earlyLiquidity: {
    address: `0x${string}`;
    getPrice: (increments: number) => Promise<bigint>;
    estimateGas: {
      buy: (increments: number, maxUsd: bigint) => Promise<bigint>;
    };
  };
  usdc: {
    address: `0x${string}`;
    provider: { getGasPrice: () => Promise<bigint> };
    allowance: (
      owner: `0x${string}`,
      spender: `0x${string}`
    ) => Promise<bigint>;
    estimateGas: {
      approve: (spender: `0x${string}`, amount: bigint) => Promise<bigint>;
    };
  };
  usdg: {
    address: `0x${string}`;
    balanceOf: (owner: `0x${string}`) => Promise<bigint>;
    allowance: (
      owner: `0x${string}`,
      spender: `0x${string}`
    ) => Promise<bigint>;
    estimateGas: {
      swap: (recipient: `0x${string}`, usdcAmount: bigint) => Promise<bigint>;
      approve: (spender: `0x${string}`, amount: bigint) => Promise<bigint>;
    };
    provider: { getGasPrice: () => Promise<bigint> };
  };
  glow: unknown;
  signer: { getAddress: () => Promise<`0x${string}`> };
}): Promise<Result<string, string>> {
  if (!earlyLiquidity) return new Err("Early Liquidity not available");
  if (!usdc) return new Err("USDC not available");
  if (!usdg) return new Err("USDG not available");
  if (!glow) return new Err("Glow not available");
  let totalEstimatedGas = BigInt(0);
  const priceResult: Result<bigint, string> = await getGlowQuoteEarlyLiquidity(
    earlyLiquidity,
    incrementsToPurchase
  );
  if (!priceResult.ok) return new Err(priceResult.val);
  const price: bigint = priceResult.val;
  // console.log({ price, incrementsToPurchase });
  const priceTimesSlippage: bigint =
    (price * slippagePointsTenThousandths) / PURCHASE_GLOW_DENOMINATOR;
  const usdgNeeded: bigint = price + priceTimesSlippage;

  const signerAddress = await signer.getAddress();
  // console.log({ signerAddress });
  const udsgBalance = await usdg.balanceOf(signerAddress);

  if (udsgBalance < usdgNeeded) {
    const usdcNeeded = usdgNeeded - udsgBalance;
    const usdcAllowance = await usdc.allowance(signerAddress, usdg.address);
    if (usdcAllowance < usdcNeeded) {
      const estimatedGas = await usdc.estimateGas.approve(
        usdg.address,
        usdcNeeded
      );

      const gasPrice = await usdc.provider.getGasPrice();
      const estimatedCost = estimatedGas * gasPrice;
      totalEstimatedGas = totalEstimatedGas + estimatedCost;
    }

    const estimatedGas = await usdg.estimateGas.swap(signerAddress, usdcNeeded);
    const gasPrice = await usdg.provider.getGasPrice();
    const estimatedCost = estimatedGas * gasPrice;
    totalEstimatedGas = totalEstimatedGas + estimatedCost;
  }

  //Now we can approve USDG to be used by early liquidity
  const usdgAllowance = await usdg.allowance(
    signerAddress,
    earlyLiquidity.address
  );

  if (usdgAllowance < usdgNeeded) {
    const estimatedGas = await usdg.estimateGas.approve(
      earlyLiquidity.address,
      usdgNeeded
    );
    const gasPrice = await usdc.provider.getGasPrice();
    const estimatedCost = estimatedGas * gasPrice;
    totalEstimatedGas = totalEstimatedGas + estimatedCost;
  }

  const estimatedGas = await earlyLiquidity.estimateGas.buy(
    incrementsToPurchase,
    usdgNeeded
  );
  const gasPrice = await usdc.provider.getGasPrice();
  const estimatedCost = estimatedGas * gasPrice;
  totalEstimatedGas = totalEstimatedGas + estimatedCost;
  const ethPriceInUSD = await getEthPriceInUSD();
  if (ethPriceInUSD) {
    const estimatedCostInEth = formatEther(totalEstimatedGas);
    const estimatedCostInUSD = (
      parseFloat(estimatedCostInEth) * ethPriceInUSD
    ).toFixed(2);
    return new Ok(estimatedCostInUSD);
  } else {
    return new Err("Could not fetch the ETH price to calculate cost in USD.");
  }
}
