import { Result, Ok, Err } from "ts-results";
export function getAmountOut({
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
