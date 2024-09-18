import { BigNumber } from "ethers";
import { Result, Ok, Err } from "ts-results";
export function getAmountOut({
  amountIn,
  reserveIn,
  reserveOut,
}: {
  amountIn: BigNumber;
  reserveIn: BigNumber;
  reserveOut: BigNumber;
}): Result<BigNumber, string> {
  if (amountIn.eq(BigNumber.from(0))) return new Err("amountIn is 0");
  if (reserveIn.eq(BigNumber.from(0))) return new Err("reserveIn is 0");
  if (reserveOut.eq(BigNumber.from(0))) return new Err("reserveOut is 0");
  const amountInWithFee = amountIn.mul(997);
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.mul(1000).add(amountInWithFee);
  return new Ok(numerator.div(denominator));
}
