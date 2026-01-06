import { SDKAddresses } from "@/web3/constants/addresses";

export const tokens = {
  ETH: {
    label: "ETH",
    // Native ETH (not an ERC20). Address is a placeholder; swaps use `useSwapETHToUSDC`.
    address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    decimals: 18,
    allowedPairs: ["GLOW"],
    toFixed: 6,
  },
  USDG: {
    label: "USDG",
    address: SDKAddresses.USDG,
    decimals: 6,
    allowedPairs: ["GLOW", "USDC"],
    toFixed: 6,
  },
  GLOW: {
    label: "GLOW",
    address: SDKAddresses.GLW,
    decimals: 18,
    allowedPairs: ["USDC", "USDG"],
    toFixed: 6,
  },
  USDC: {
    label: "USDC",
    address: SDKAddresses.USDC as `0x${string}`,
    decimals: 6,
    allowedPairs: ["GLOW", "USDG"],
    toFixed: 6,
  },
  GCTL: {
    label: "GCTL",
    address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    decimals: 6,
    allowedPairs: [], // GCTL cannot be selected as sell token
    toFixed: 6,
  },
} as const;

export type Token = (typeof tokens)[keyof typeof tokens];
