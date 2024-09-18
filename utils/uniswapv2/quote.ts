import { BigNumber } from "ethers";
import { Result, Ok, Err } from "ts-results";
export function quote({
  amountA,
  reserveA,
  reserveB,
}: {
  amountA: BigNumber;
  reserveA: BigNumber;
  reserveB: BigNumber;
}): Result<BigNumber, string> {
  if (amountA.eq(BigNumber.from(0))) return new Err("amountA is 0");
  if (reserveA.eq(BigNumber.from(0))) return new Err("reserveA is 0");
  if (reserveB.eq(BigNumber.from(0))) return new Err("reserveB is 0");
  return new Ok(reserveB.mul(amountA).div(reserveA));
}
