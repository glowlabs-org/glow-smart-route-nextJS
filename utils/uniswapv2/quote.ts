import { Result, Ok, Err } from "ts-results";
export function quote({
  amountA,
  reserveA,
  reserveB,
}: {
  amountA: bigint;
  reserveA: bigint;
  reserveB: bigint;
}): Result<bigint, string> {
  if (amountA === BigInt(0)) return new Err("amountA is 0");
  if (reserveA === BigInt(0)) return new Err("reserveA is 0");
  if (reserveB === BigInt(0)) return new Err("reserveB is 0");
  return new Ok((reserveB * amountA) / reserveA);
}
