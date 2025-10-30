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

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const persistentCookieStorage: typeof cookieStorage = {
  getItem: cookieStorage.getItem,
  setItem(key: string, value: string) {
    if (typeof document === "undefined") return;
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${key}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  },
  removeItem(key: string) {
    if (typeof document === "undefined") return;
    document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax`;
  },
};

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID;

// Determine one-shot autoConnect disable flag (set by forceDisconnect)
let shouldDisableAutoConnectOnce = false;
try {
  if (typeof document !== "undefined") {
    const cookie = document.cookie || "";
    if (cookie.includes("wagmi_disable_auto_connect_once=1")) {
      shouldDisableAutoConnectOnce = true;
      // clear the cookie so it applies only once
      document.cookie =
        "wagmi_disable_auto_connect_once=; Max-Age=0; Path=/; SameSite=Lax";
    }
  }
  if (!shouldDisableAutoConnectOnce && typeof localStorage !== "undefined") {
    if (localStorage.getItem("wagmi_disable_auto_connect_once") === "1") {
      shouldDisableAutoConnectOnce = true;
      localStorage.removeItem("wagmi_disable_auto_connect_once");
    }
  }
} catch {}

// IMPORTANT: ssr + cookieStorage so the selected connector persists across reloads in App Router.
export const wagmiConfig = createConfig({
  chains: [process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia],
  ssr: true,
  storage: createStorage({
    storage: persistentCookieStorage, // works with SSR hydration; avoids `window` access during render
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
