import { BigNumberish } from "ethers";

// Constants
const ratio: number = 1.0000006931474208;

// Utils
function ln(x: number): number {
  return Math.log(x);
}

// Mocks A Swap using UniV2
function uniEq(
  amountIn: number,
  reserveIn: number,
  reserveOut: number
): number {
  const amountInWithFee = amountIn * 997;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000 + amountInWithFee;
  const amountOut = numerator / denominator;
  return amountOut;
}

// Function to estimate Glow from USDG
function estimateGlowFromUsdg(firstTerm: number, usdcToUse: number): number {
  let nt = (ratio - 1) * usdcToUse + firstTerm;
  nt = nt / firstTerm;
  const num = ln(nt);
  const den = ln(ratio);
  return num / den;
}

const UNISWAP_NUMERATOR = 997;
const UNISWAP_DENOMINATOR = 1000;
const EL_SENSITIVITY = 1442482.295;

function calcBondingCurvePrice({
  tokensSold,
  numTokensToBuy,
}: {
  tokensSold: number;
  numTokensToBuy: number;
}): number {
  return 0.3 * 2 ** ((tokensSold + numTokensToBuy) / 1_000_000);
}

function tokensSoldBondingCurveFromPrice(price: number): number {
  return 1_442_700 * Math.log(3.333333333333333 * price);
}

export type GetAmountsInResult = {
  amountUSDGToSpendInUniswap: number;
  amountUSDGToSpendInEarlyLiquidity: number;
  expectedOutFromUniswap: number;
  expectedOutFromEarlyLiquidity: number;
  expectedEndingPriceUniswap: number;
  expectedEndingPriceEarlyLiquidity: number;
};

export interface GetAmountsInArgs {
  uniswapUSDGReserve: number;
  uniswapGlowReserve: number;
  earlyLiquidityCurrentPrice: number;
  usdgToSpend: number;
}
export function getOptimalUSDGAmounts(
  args: GetAmountsInArgs
): GetAmountsInResult {
  const u = args.uniswapUSDGReserve;
  const g = args.uniswapGlowReserve;
  const b = args.earlyLiquidityCurrentPrice;
  const v = args.usdgToSpend;
  const f1 = UNISWAP_NUMERATOR;
  const f2 = UNISWAP_DENOMINATOR;
  const c = EL_SENSITIVITY;
  const numerator =
    Math.sqrt(
      u *
        (4 * c * f1 * f2 * (b * c * g - c * u + g * v) +
          u * (c * (f1 + f2) + f2 * g) ** 2)
    ) -
    c * f1 * u -
    c * f2 * u -
    f2 * g * u;

  const denominator = 2 * c * f1;
  let amountUSDGToSpendInUniswap = numerator / denominator;
  let amountUSDGToSpendInEarlyLiquidity =
    args.usdgToSpend - amountUSDGToSpendInUniswap;

  if (amountUSDGToSpendInUniswap <= 0) {
    amountUSDGToSpendInUniswap = 0;
    amountUSDGToSpendInEarlyLiquidity = args.usdgToSpend;
  }
  if (amountUSDGToSpendInEarlyLiquidity <= 0) {
    amountUSDGToSpendInUniswap = args.usdgToSpend;
    amountUSDGToSpendInEarlyLiquidity = 0;
  }
  const expectedOutFromUniswap =
    amountUSDGToSpendInUniswap > 0
      ? uniEq(amountUSDGToSpendInUniswap, u, g)
      : 0;
  const expectedOutFromEarlyLiquidity =
    amountUSDGToSpendInEarlyLiquidity > 0
      ? estimateGlowFromUsdg(b, amountUSDGToSpendInEarlyLiquidity)
      : 0;

  const expectedEndingPriceUniswap =
    (u + amountUSDGToSpendInUniswap) / (g - expectedOutFromUniswap);
  const expectedEndingPriceEarlyLiquidity = calcBondingCurvePrice({
    tokensSold: tokensSoldBondingCurveFromPrice(b),
    numTokensToBuy: expectedOutFromEarlyLiquidity,
  });

  return {
    amountUSDGToSpendInUniswap,
    amountUSDGToSpendInEarlyLiquidity,
    expectedOutFromUniswap,
    expectedOutFromEarlyLiquidity,
    expectedEndingPriceUniswap,
    expectedEndingPriceEarlyLiquidity,
  };
}

export type GetOptimalUSDGAmountsWithFeesResult = {
  amount_usdg_in_uniswap: number;
  amount_out_glow_uniswap: number;
  amount_usdg_in_bonding_curve: number;
  amount_out_glow_bonding_curve: number;
};
export function getOptimalUSDGAmountsWithFees({
  amount_glow_out_uniswap,
  amount_glow_out_bonding_curve,
  fees,
  amount_usdg_in_uniswap,
  amount_usdg_in_bonding_curve,
  uniswapUSDGReserves,
  uniswapGlowReserves,
  earlyLiquidityCurrentPrice,
  usdgToSpend,
  endingPriceIfBoth,
}: {
  amount_glow_out_uniswap: number | typeof NaN; //explicitly state that it can be NaN
  amount_glow_out_bonding_curve: number | typeof NaN; //explicitly state that it can be NaN
  fees: { uniswapFees: number; bondingCurveFees: number };
  endingPriceIfBoth: number;
  amount_usdg_in_uniswap: number | typeof NaN; //explicitly state that it can be NaN
  amount_usdg_in_bonding_curve: number | typeof NaN; //explicitly state that it can be NaN
  uniswapUSDGReserves: number;
  uniswapGlowReserves: number;
  earlyLiquidityCurrentPrice: number;
  usdgToSpend: number;
}): GetOptimalUSDGAmountsWithFeesResult {
  //First handle the NaN or zero cases for usdg_in_uniswap and usdg_in_bonding_curve
  //Log input args
  console.log({
    amount_glow_out_uniswap,
    amount_glow_out_bonding_curve,
    fees,
    amount_usdg_in_uniswap,
    amount_usdg_in_bonding_curve,
    uniswapUSDGReserves,
    uniswapGlowReserves,
    earlyLiquidityCurrentPrice,
    usdgToSpend,
  });
  if (amount_glow_out_uniswap == 0 || !amount_glow_out_uniswap) {
    return {
      amount_usdg_in_uniswap: 0,
      amount_out_glow_uniswap: 0,
      amount_usdg_in_bonding_curve,
      amount_out_glow_bonding_curve: amount_glow_out_bonding_curve,
    };
  }

  if (amount_glow_out_bonding_curve == 0 || !amount_glow_out_bonding_curve) {
    return {
      amount_usdg_in_uniswap,
      amount_out_glow_uniswap: amount_glow_out_uniswap,
      amount_usdg_in_bonding_curve: 0,
      amount_out_glow_bonding_curve: 0,
    };
  }
  // const uniswapCurrentPrice = uniswapUSDGReserves / uniswapGlowReserves;
  // const totalGlowOutIfUsingBoth =
  //   amount_glow_out_uniswap + amount_glow_out_bonding_curve;
  const totalUSDGIn = amount_usdg_in_uniswap + amount_usdg_in_bonding_curve;
  const totalGlowOutIfOnlyUniswap = uniEq(
    totalUSDGIn,
    uniswapUSDGReserves,
    uniswapGlowReserves
  );
  const totalGlowOutIfOnlyBondingCurve = estimateGlowFromUsdg(
    earlyLiquidityCurrentPrice,
    totalUSDGIn
  );

  const amountOutIfBoth =
    amount_glow_out_uniswap + amount_glow_out_bonding_curve;

  let selection: "uniswap" | "bondingCurve" | "both" = "uniswap";
  //Here we decide if we are only going to use uniswap or not.
  if (totalGlowOutIfOnlyUniswap > totalGlowOutIfOnlyBondingCurve) {
    const differenceInTokensIfOnlyUsingUniswap =
      amountOutIfBoth - totalGlowOutIfOnlyUniswap;
    const usdValueOfTokenDiff =
      differenceInTokensIfOnlyUsingUniswap * endingPriceIfBoth;
    if (usdValueOfTokenDiff > fees.bondingCurveFees) {
      selection = "both";
    } else {
      selection = "uniswap";
    }
  }

  if (totalGlowOutIfOnlyUniswap <= totalGlowOutIfOnlyBondingCurve) {
    const differenceInTokensIfOnlyUsingBondingCurve =
      amountOutIfBoth - totalGlowOutIfOnlyBondingCurve;
    const usdValueOfTokenDiff =
      differenceInTokensIfOnlyUsingBondingCurve * endingPriceIfBoth;
    if (usdValueOfTokenDiff > fees.uniswapFees) {
      selection = "both";
    } else {
      selection = "bondingCurve";
    }
  }

  // const minDeltaIfUsingBothAndUniswapFirst = endingPriceIfBoth

  switch (selection) {
    case "uniswap":
      return {
        amount_usdg_in_uniswap: totalUSDGIn,
        amount_out_glow_uniswap: totalGlowOutIfOnlyUniswap,
        amount_usdg_in_bonding_curve: 0,
        amount_out_glow_bonding_curve: 0,
      };
    case "bondingCurve":
      return {
        amount_usdg_in_uniswap: 0,
        amount_out_glow_uniswap: 0,
        amount_usdg_in_bonding_curve: totalUSDGIn,
        amount_out_glow_bonding_curve: totalGlowOutIfOnlyBondingCurve,
      };
    case "both":
      return {
        amount_usdg_in_uniswap,
        amount_out_glow_uniswap: amount_glow_out_uniswap,
        amount_usdg_in_bonding_curve,
        amount_out_glow_bonding_curve: amount_glow_out_bonding_curve,
      };
  }
}
