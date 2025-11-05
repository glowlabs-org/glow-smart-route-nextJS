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
  "io.rabby",
  "metaMaskSDK",
  "coinbaseWalletSDK",
  "walletConnect",
  "com.ledger.live",
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
        id: "io.rabby",
        name: "Rabby Wallet",
        icon: "data:image/png;base64,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",
        provider: (window) => (window as any)?.rabby,
      },
    }),
    injected({
      target: {
        id: "com.ledger.live",
        name: "Ledger Live",
        icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRH6IP0y4AqjwJt64nQi8oIE34XkyEBGmI8Xg&s",
        provider: (window) => {
          const eth = (window as any)?.ethereum;
          return eth?.isLedgerLive ? eth : undefined;
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
      if (id.includes("rabby") || name.includes("rabby")) return true;
      if (id.includes("ledger") || name.includes("ledger")) return true;
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
