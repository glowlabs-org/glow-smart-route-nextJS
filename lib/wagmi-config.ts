// app/providers.tsx
"use client";

import {
  WagmiProvider,
  cookieStorage,
  createStorage,
  createConfig,
  http,
} from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import {
  injected,
  walletConnect,
  coinbaseWallet,
  safe,
  metaMask,
} from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

if (!process.env.NEXT_PUBLIC_WALLET_CONNECT_ID)
  throw new Error("NEXT_PUBLIC_WALLET_CONNECT_ID is not set");
if (!process.env.NEXT_PUBLIC_MAINNET_RPC_URL)
  throw new Error("NEXT_PUBLIC_MAINNET_RPC_URL is not set");
if (!process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL)
  throw new Error("NEXT_PUBLIC_SEPOLIA_RPC_URL is not set");

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID;

// IMPORTANT: ssr + cookieStorage so the selected connector persists across reloads in App Router.
export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage, // works with SSR hydration; avoids `window` access during render
  }),
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    walletConnect({
      projectId,
      // metadata improves WC session restore on mobile wallets
      metadata: {
        name: "Glow",
        description: "Glow app",
        url: "https://app.glow.org",
        icons: ["https://app.glow.org/icon.png"],
      },
    }),
    coinbaseWallet({
      appName: "app.glow.org",
    }),
  ],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  batch: { multicall: { wait: 32 } },
});
