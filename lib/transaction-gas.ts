const ERC20_APPROVAL_GAS = 70_000n;
const USDC_TO_USDG_APPROVAL_GAS = ERC20_APPROVAL_GAS * 2n;
const ETH_TO_USDC_SWAP_GAS = 180_000n;
const USDC_TO_USDG_GAS = 100_000n;
const USDG_TO_USDC_GAS = 100_000n;
const UNISWAP_TOKEN_SWAP_GAS = 180_000n;
const BONDING_CURVE_PURCHASE_GAS = 200_000n;
const MINER_PURCHASE_GAS = 300_000n;

export function estimateBuyGlowGasUnits({
  payToken,
  hasBondingAllocation,
}: {
  payToken: "USDC" | "USDG" | "ETH";
  hasBondingAllocation: boolean;
}): bigint {
  let gasUnits = ERC20_APPROVAL_GAS + UNISWAP_TOKEN_SWAP_GAS;

  if (payToken === "USDC" || payToken === "ETH") {
    gasUnits += USDC_TO_USDG_APPROVAL_GAS + USDC_TO_USDG_GAS;
  }
  if (payToken === "ETH") gasUnits += ETH_TO_USDC_SWAP_GAS;
  if (hasBondingAllocation) {
    gasUnits += ERC20_APPROVAL_GAS + BONDING_CURVE_PURCHASE_GAS;
  }

  return gasUnits;
}

export function estimateMinerPurchaseGasUnits(payToken: "USDC" | "ETH"): bigint {
  return (
    ERC20_APPROVAL_GAS +
    MINER_PURCHASE_GAS +
    (payToken === "ETH" ? ETH_TO_USDC_SWAP_GAS : 0n)
  );
}

export function estimateSwapGasUnits({
  sellToken,
  buyToken,
  hasBondingAllocation = false,
}: {
  sellToken: string;
  buyToken: string;
  hasBondingAllocation?: boolean;
}): bigint {
  if (sellToken === "ETH" && buyToken === "GLOW") {
    return estimateBuyGlowGasUnits({
      payToken: "ETH",
      hasBondingAllocation,
    });
  }
  if (sellToken === "USDC" && buyToken === "GLOW") {
    return estimateBuyGlowGasUnits({
      payToken: "USDC",
      hasBondingAllocation,
    });
  }
  if (sellToken === "USDG" && buyToken === "GLOW") {
    return estimateBuyGlowGasUnits({
      payToken: "USDG",
      hasBondingAllocation,
    });
  }
  if (sellToken === "USDC" && buyToken === "USDG") {
    return USDC_TO_USDG_APPROVAL_GAS + USDC_TO_USDG_GAS;
  }
  if (sellToken === "USDG" && buyToken === "USDC") {
    return ERC20_APPROVAL_GAS + USDG_TO_USDC_GAS;
  }
  if (sellToken === "GLOW" && (buyToken === "USDG" || buyToken === "USDC")) {
    return (
      ERC20_APPROVAL_GAS +
      UNISWAP_TOKEN_SWAP_GAS +
      (buyToken === "USDC" ? ERC20_APPROVAL_GAS + USDG_TO_USDC_GAS : 0n)
    );
  }
  if (sellToken === "ETH" && buyToken === "USDC") {
    return ETH_TO_USDC_SWAP_GAS;
  }

  return ERC20_APPROVAL_GAS + UNISWAP_TOKEN_SWAP_GAS;
}

export function computeBufferedGasCostWei({
  gasUnits,
  gasPriceWei,
  safetyBps = 1_500,
}: {
  gasUnits: bigint;
  gasPriceWei: bigint;
  safetyBps?: number;
}): bigint {
  const safeBps = Number.isFinite(safetyBps) ? Math.max(0, safetyBps) : 0;
  return (
    (gasUnits * gasPriceWei * (10_000n + BigInt(Math.floor(safeBps)))) /
    10_000n
  );
}

export function computeRequiredEthBalanceWei({
  gasUnits,
  gasPriceWei,
  valueWei = 0n,
  safetyBps = 1_500,
}: {
  gasUnits: bigint;
  gasPriceWei: bigint;
  valueWei?: bigint;
  safetyBps?: number;
}): bigint {
  return (
    computeBufferedGasCostWei({ gasUnits, gasPriceWei, safetyBps }) +
    (valueWei > 0n ? valueWei : 0n)
  );
}
