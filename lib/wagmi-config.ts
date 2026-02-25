"use client";

import { createStorage, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { instrumentedHttp } from "@/lib/viem-rpc-logging";
import { createPersistentWalletStorage } from "@/lib/wallet-storage";

if (!process.env.NEXT_PUBLIC_WALLET_CONNECT_ID)
  throw new Error("NEXT_PUBLIC_WALLET_CONNECT_ID is not set");
if (!process.env.NEXT_PUBLIC_MAINNET_RPC_URL)
  throw new Error("NEXT_PUBLIC_MAINNET_RPC_URL is not set");
if (!process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL)
  throw new Error("NEXT_PUBLIC_SEPOLIA_RPC_URL is not set");

const chains = [
  process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia,
] as const;

const INJECTED_CONNECTOR_OPTIONS = {
  shimDisconnect: true,
  unstable_shimAsyncInject: 2_000,
} as const;

export const wagmiConfig = createConfig({
  ssr: true,
  multiInjectedProviderDiscovery: false,
  chains,
  transports: {
    [mainnet.id]: instrumentedHttp(
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
      undefined,
      { source: "wagmi" }
    ),
    [sepolia.id]: instrumentedHttp(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
      undefined,
      { source: "wagmi" }
    ),
  },
  connectors:
    typeof window === "undefined"
      ? []
      : [
          injected({
            ...INJECTED_CONNECTOR_OPTIONS,
            target: "metaMask",
          }),
          injected({
            ...INJECTED_CONNECTOR_OPTIONS,
            target: "coinbaseWallet",
          }),
          injected({
            ...INJECTED_CONNECTOR_OPTIONS,
            target: "phantom",
          }),
          walletConnect({
            projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID,
            showQrModal: false,
            metadata: {
              name: "Glow",
              description: "Glow app",
              url: "https://app.glow.org",
              icons: ["https://app.glow.org/icon.png"],
            },
          }),
        ],
  storage: createStorage({
    storage: createPersistentWalletStorage(),
  }),
});
