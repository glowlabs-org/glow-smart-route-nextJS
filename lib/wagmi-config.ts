"use client";

import { createStorage } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { createConfig } from "@privy-io/wagmi";
import { instrumentedFallback, instrumentedHttp } from "@/lib/viem-rpc-logging";
import { createPersistentWalletStorage } from "@/lib/wallet-storage";

const MAINNET_RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "";
const MAINNET_RPC_FALLBACK_URL =
  process.env.NEXT_PUBLIC_MAINNET_RPC_FALLBACK_URL ?? "";
const MAINNET_RPC_BACKUP_URLS = (
  process.env.NEXT_PUBLIC_MAINNET_RPC_BACKUP_URLS ?? ""
)
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "";

if (!MAINNET_RPC_URL)
  throw new Error("NEXT_PUBLIC_MAINNET_RPC_URL is not set");
if (!SEPOLIA_RPC_URL)
  throw new Error("NEXT_PUBLIC_SEPOLIA_RPC_URL is not set");

const MAINNET_RPC_URLS = [
  MAINNET_RPC_URL,
  MAINNET_RPC_FALLBACK_URL,
  ...MAINNET_RPC_BACKUP_URLS,
].filter(Boolean);

const activeChain =
  process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia;

export const wagmiConfig = createConfig({
  chains: [activeChain],
  ssr: true,
  storage: createStorage({ storage: createPersistentWalletStorage() }),
  transports: {
    [mainnet.id]: instrumentedFallback(MAINNET_RPC_URLS, undefined, {
      source: "wagmi",
    }),
    [sepolia.id]: instrumentedHttp(SEPOLIA_RPC_URL, undefined, {
      source: "wagmi",
    }),
  },
});
