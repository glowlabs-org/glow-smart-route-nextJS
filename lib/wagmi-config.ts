"use client";

import { cookieStorage, createStorage, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";
import {
  injected,
  coinbaseWallet,
  metaMask,
  walletConnect,
} from "wagmi/connectors";
import type { Connector } from "wagmi";

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

const chains = [
  process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia,
] as const;

const ALLOWED_WALLET_IDS = new Set([
  "io.metamask",
  "com.coinbase.wallet",
  "com.trustwallet.app",
  "metaMaskSDK",
  "coinbaseWalletSDK",
  "walletConnect",
  "com.ledger.live", // ✅ add this
]);

// Get base config from ConnectKit
const connectKitConfig = getDefaultConfig({
  enableFamily: false,
  chains,
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID,
  appName: "Glow",
  appDescription: "Decentralized solar mining ecosystem",
  appUrl: "https://app.glow.org",
  appIcon: "https://app.glow.org/icon.png",
});

// Create config with only allowed wallet connectors
export const wagmiConfig = createConfig({
  ...connectKitConfig,
  connectors: [
    metaMask(),
    coinbaseWallet({
      appName: "Glow",
      appLogoUrl: "https://app.glow.org/icon.png",
    }),
    injected({
      target: {
        id: "com.trustwallet.app",
        name: "Trust Wallet",
        provider: (window) => (window as any)?.trustwallet,
      },
    }),
    injected({
      target: {
        id: "com.ledger.live",
        name: "Ledger Live",
        icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRH6IP0y4AqjwJt64nQi8oIE34XkyEBGmI8Xg&s",
        provider: (window) => {
          const eth = (window as any)?.ethereum;
          // Ledger’s DApp Browser marks the provider like this:
          return eth?.isLedgerLive ? eth : undefined; // ✅ only show when inside Ledger Live
        },
      },
    }),
  ],
  storage: createStorage({
    storage: persistentCookieStorage,
  }),
});

// Filter out any non-allowed wallets discovered via EIP-6963
if (typeof window !== "undefined") {
  const filterAllowedConnectors = (connectors: readonly Connector[]) => {
    return connectors.filter((connector) => {
      const id = connector.id.toLowerCase();
      const name = connector.name.toLowerCase();

      // Check if it's one of our explicitly allowed wallets
      if (ALLOWED_WALLET_IDS.has(connector.id)) return true;

      // Check by name/id patterns
      if (id.includes("metamask") || name.includes("metamask")) return true;
      if (id.includes("coinbase") || name.includes("coinbase")) return true;
      if (id.includes("trust") || name.includes("trust")) return true;
      if (id.includes("walletconnect") || name.includes("walletconnect"))
        return true;

      return false;
    });
  };

  // Filter initial connectors
  const initialFiltered = filterAllowedConnectors(wagmiConfig.connectors);
  if (initialFiltered.length < wagmiConfig.connectors.length) {
    wagmiConfig._internal.connectors.setState(initialFiltered);
  }

  // Subscribe to connector changes to filter out non-allowed wallets discovered via EIP-6963
  let isFiltering = false;
  wagmiConfig._internal.connectors.subscribe((connectors) => {
    if (isFiltering) return;

    isFiltering = true;
    try {
      const validConnectors = filterAllowedConnectors(connectors);
      if (validConnectors.length < connectors.length) {
        wagmiConfig._internal.connectors.setState(validConnectors);
      }
    } finally {
      isFiltering = false;
    }
  });
}
