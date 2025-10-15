// app/providers.tsx
"use client";

import { cookieStorage, createStorage, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import {
  injected,
  walletConnect,
  coinbaseWallet,
  metaMask,
} from "wagmi/connectors";

if (!process.env.NEXT_PUBLIC_WALLET_CONNECT_ID)
  throw new Error("NEXT_PUBLIC_WALLET_CONNECT_ID is not set");
if (!process.env.NEXT_PUBLIC_MAINNET_RPC_URL)
  throw new Error("NEXT_PUBLIC_MAINNET_RPC_URL is not set");
if (!process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL)
  throw new Error("NEXT_PUBLIC_SEPOLIA_RPC_URL is not set");

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID;

// IMPORTANT: ssr + cookieStorage so the selected connector persists across reloads in App Router.
export const wagmiConfig = createConfig({
  chains: [process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage, // works with SSR hydration; avoids `window` access during render
  }),
  // Restrict to these four connectors only and control ordering for the UI
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId,
      metadata: {
        name: "Glow",
        description: "Glow app",
        url: "https://app.glow.org",
        icons: ["https://app.glow.org/icon.png"],
      },
    }),
    coinbaseWallet({ appName: "app.glow.org" }),
    metaMask({
      dappMetadata: {
        name: "Glow",
        url: "https://app.glow.org",
        iconUrl: "https://app.glow.org/icon.png",
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  batch: { multicall: { wait: 32 } },
});
