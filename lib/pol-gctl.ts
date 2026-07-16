import Decimal from "decimal.js";
import {
  decodeEventLog,
  parseAbiItem,
  zeroAddress,
  type Address,
  type Hex,
  type Log,
} from "viem";

export const POL_GCTL_ENDOWMENT_WALLET =
  "0x868D99B4a6e81b4683D10ea5665f13579A9d1607" as const;
export const POL_GCTL_LP_TOKEN =
  "0x6FA09ffC45F1dDC95c1bc192956717042f142c5d" as const;

const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export interface PolGctlPreview {
  txHash: string;
  wallet: string;
  endowmentWallet: string;
  lpTokenAddress: string;
  lpTokensRaw: string;
  blockNumber: string;
  blockTimestamp: string;
  confirmations: number;
  requiredConfirmations: number;
  ready: boolean;
  underlyingGlw: string;
  underlyingUsdg: string;
  glwSpotPriceUsd: string;
  usdValue: string;
  usdValueRaw6: string;
  gctlPriceUsd: string;
  gctlPriceRaw6: string;
  gctlMinted: string;
  gctlMintedRaw6: string;
}

export interface PolGctlMintResult extends PolGctlPreview {
  alreadyProcessed: boolean;
  notificationSent: boolean;
}

export interface PolGctlEstimate {
  usedGlw: string;
  usedUsdg: string;
  liquidityUsd: string;
  gctlPriceUsd: string;
  gctlMinted: string;
  usesFullInput: boolean;
}

export function applyBpsFloor(amount: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error("Basis points must be between 0 and 10,000");
  }
  return (amount * BigInt(10_000 - bps)) / 10_000n;
}

function parsePositiveDecimal(value: string, decimals: number) {
  const trimmed = value.trim();
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;

  const decimal = new Decimal(trimmed);
  if (!decimal.isFinite() || decimal.lte(0)) return null;
  return decimal.toDecimalPlaces(decimals, Decimal.ROUND_DOWN);
}

export function estimatePolGctlMint(args: {
  glw: string;
  usdg: string;
  glwReserveRaw: bigint;
  usdgReserveRaw: bigint;
}): PolGctlEstimate | null {
  const desiredGlw = parsePositiveDecimal(args.glw, 18);
  const desiredUsdg = parsePositiveDecimal(args.usdg, 6);
  if (
    !desiredGlw ||
    !desiredUsdg ||
    args.glwReserveRaw <= 0n ||
    args.usdgReserveRaw <= 0n
  ) {
    return null;
  }

  const glwReserve = new Decimal(args.glwReserveRaw.toString()).div("1e18");
  const usdgReserve = new Decimal(args.usdgReserveRaw.toString()).div(1e6);
  const glwSpotPriceUsd = usdgReserve.div(glwReserve);
  const optimalUsdgForGlw = desiredGlw.mul(glwSpotPriceUsd);

  let usedGlw: Decimal;
  let usedUsdg: Decimal;
  if (optimalUsdgForGlw.lte(desiredUsdg)) {
    usedGlw = desiredGlw;
    usedUsdg = optimalUsdgForGlw.toDecimalPlaces(6, Decimal.ROUND_DOWN);
  } else {
    usedUsdg = desiredUsdg;
    usedGlw = desiredUsdg
      .div(glwSpotPriceUsd)
      .toDecimalPlaces(18, Decimal.ROUND_DOWN);
  }

  const liquidityUsd = usedUsdg.plus(usedGlw.mul(glwSpotPriceUsd));
  const gctlPriceUsd = glwSpotPriceUsd.sqrt();
  const gctlMinted = liquidityUsd.div(gctlPriceUsd);

  return {
    usedGlw: usedGlw.toFixed(18),
    usedUsdg: usedUsdg.toFixed(6),
    liquidityUsd: liquidityUsd.toFixed(6, Decimal.ROUND_DOWN),
    gctlPriceUsd: gctlPriceUsd.toFixed(18, Decimal.ROUND_DOWN),
    gctlMinted: gctlMinted.toFixed(6, Decimal.ROUND_DOWN),
    usesFullInput:
      desiredGlw.sub(usedGlw).lte("1e-18") &&
      desiredUsdg.sub(usedUsdg).lte("0.000001"),
  };
}

export function quoteGlwForUsdg(args: {
  usdg: string;
  glwReserveRaw: bigint;
  usdgReserveRaw: bigint;
}): string {
  const usdg = new Decimal(args.usdg || "0");
  if (
    !usdg.isFinite() ||
    usdg.lte(0) ||
    args.glwReserveRaw <= 0n ||
    args.usdgReserveRaw <= 0n
  ) {
    return "";
  }

  const glwReserve = new Decimal(args.glwReserveRaw.toString()).div("1e18");
  const usdgReserve = new Decimal(args.usdgReserveRaw.toString()).div(1e6);
  return usdg
    .mul(glwReserve)
    .div(usdgReserve)
    .toDecimalPlaces(18, Decimal.ROUND_DOWN)
    .toFixed();
}

export function findMintedLpAmount(args: {
  logs: readonly Log[];
  lpTokenAddress?: Address;
  recipient: Address;
}): bigint {
  const lpToken = (
    args.lpTokenAddress ?? POL_GCTL_LP_TOKEN
  ).toLowerCase();
  const recipient = args.recipient.toLowerCase();

  return args.logs.reduce((total, log) => {
    if (log.address.toLowerCase() !== lpToken) return total;
    try {
      const decoded = decodeEventLog({
        abi: [ERC20_TRANSFER_EVENT],
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      const transfer = decoded.args as {
        from: Address;
        to: Address;
        value: bigint;
      };
      if (
        transfer.from.toLowerCase() !== zeroAddress ||
        transfer.to.toLowerCase() !== recipient ||
        transfer.value <= 0n
      ) {
        return total;
      }
      return total + transfer.value;
    } catch {
      return total;
    }
  }, 0n);
}

export function shortenHash(value: string): string {
  return value.length > 14
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;
}
