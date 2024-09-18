const ratio: number = 1.00000000693147;

function ln(x: number): number {
  return Math.log(x);
}

export function estimateGlowFromUSDG(
  first_term: number,
  usdc_to_use: number
): number {
  let nt: number = (ratio - 1) * usdc_to_use;
  nt = nt + first_term;
  nt = nt / first_term;
  const num: number = ln(nt);
  const den: number = ln(ratio);
  return num / den;
}
