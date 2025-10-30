"use client";

import { cookieStorage, createStorage, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";
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

// Helper function to check if a connector is Phantom wallet
async function isPhantomConnector(connector: Connector): Promise<boolean> {
  try {
    const provider = await connector.getProvider().catch(() => null);
    if (!provider) return false;

    // Check if provider is Phantom
    if ((provider as any).isPhantom) return true;

    // Check connector ID/name for Phantom indicators
    const id = connector.id.toLowerCase();
    const name = connector.name.toLowerCase();
    if (id.includes("phantom") || name.includes("phantom")) return true;
    if (id === "app.phantom" || id.includes("app.phantom")) return true;

    return false;
  } catch {
    return false;
  }
}

// Use ConnectKit's getDefaultConfig for better wallet handling
// Merge with custom storage for SSR persistence
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

// Create config with ConnectKit defaults but override storage for SSR
export const wagmiConfig = createConfig({
  ...connectKitConfig,
  storage: createStorage({
    storage: persistentCookieStorage,
  }),
});

// Filter out Phantom wallet connectors after config creation
// This handles both initial connectors and EIP-6963 discovered connectors
if (typeof window !== "undefined") {
  // Filter function that checks and removes Phantom connectors
  const filterPhantomConnectors = async (connectors: readonly Connector[]) => {
    const filteredConnectors = await Promise.all(
      connectors.map(async (connector) => {
        const isPhantom = await isPhantomConnector(connector);
        return isPhantom ? null : connector;
      })
    );
    return filteredConnectors.filter((c): c is Connector => c !== null);
  };

  // Filter initial connectors
  filterPhantomConnectors(wagmiConfig.connectors).then((validConnectors) => {
    if (validConnectors.length < wagmiConfig.connectors.length) {
      wagmiConfig._internal.connectors.setState(validConnectors);
    }
  });

  // Subscribe to connector changes to filter out Phantom when discovered via EIP-6963
  // Use a flag to prevent infinite loops
  let isFiltering = false;
  wagmiConfig._internal.connectors.subscribe(async (connectors) => {
    // Skip if we're already filtering to prevent infinite loop
    if (isFiltering) return;

    // Check if any connectors might be Phantom
    const hasPotentialPhantom = connectors.some(
      (c) =>
        c.id.toLowerCase().includes("phantom") ||
        c.name.toLowerCase().includes("phantom") ||
        c.id === "app.phantom"
    );

    if (!hasPotentialPhantom) return;

    isFiltering = true;
    try {
      const validConnectors = await filterPhantomConnectors(connectors);
      // Only update if we actually filtered something out
      if (validConnectors.length < connectors.length) {
        wagmiConfig._internal.connectors.setState(validConnectors);
      }
    } finally {
      isFiltering = false;
    }
  });
}
