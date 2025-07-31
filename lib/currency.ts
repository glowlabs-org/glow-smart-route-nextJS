export const CURRENCY_DECIMALS: Record<string, number> = {
  USDC: 6,
  GLW: 18,
  GCTL: 6,
  ETH: 18,
};

export const DISPLAY_DECIMALS: Record<string, number> = {
  USDC: 2,
  GLW: 6,
  GCTL: 6,
  ETH: 6,
};

export function getCurrencyDecimals(symbol: string): number {
  return CURRENCY_DECIMALS[symbol] ?? 18;
}

export function getDisplayDecimals(symbol: string): number {
  return DISPLAY_DECIMALS[symbol] ?? 6;
}
