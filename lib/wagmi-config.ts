"use client";

import { createStorage } from "wagmi";
import { injected } from "wagmi/connectors";
import { createAppKit } from "@reown/appkit/react";
import { mainnet, sepolia } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import * as Sentry from "@sentry/nextjs";
import { instrumentedFallback, instrumentedHttp } from "@/lib/viem-rpc-logging";
import { createPersistentWalletStorage } from "@/lib/wallet-storage";

const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_ID ?? "";
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

if (!WALLET_CONNECT_PROJECT_ID)
  throw new Error("NEXT_PUBLIC_WALLET_CONNECT_ID is not set");
if (!MAINNET_RPC_URL)
  throw new Error("NEXT_PUBLIC_MAINNET_RPC_URL is not set");
if (!SEPOLIA_RPC_URL)
  throw new Error("NEXT_PUBLIC_SEPOLIA_RPC_URL is not set");

const MAINNET_RPC_URLS = [
  MAINNET_RPC_URL,
  MAINNET_RPC_FALLBACK_URL,
  ...MAINNET_RPC_BACKUP_URLS,
].filter(Boolean);

const networks = [
  process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia,
] as const;

const APPKIT_PRODUCTION_URL = "https://app.glow.org";

function getAppKitMetadata() {
  const url =
    typeof window !== "undefined"
      ? window.location.origin
      : APPKIT_PRODUCTION_URL;
  return {
    name: "Glow",
    description: "Glow app",
    url,
    icons: [`${APPKIT_PRODUCTION_URL}/icon.png`],
  };
}

const INJECTED_CONNECTOR_OPTIONS = {
  shimDisconnect: true,
  unstable_shimAsyncInject: 2_000,
} as const;

const EIP6963_PROVIDERS_KEY = "__glowEip6963Providers";
const EIP6963_LISTENER_READY_KEY = "__glowEip6963ListenerReady";
const CONNECTOR_DEBUG_CACHE_KEY = "__glowWalletConnectorDebugCache";
const CONNECTOR_DEBUG_REPORT_WINDOW_MS = 60_000;

type Eip6963ProviderInfo = {
  rdns?: string;
  name?: string;
  uuid?: string;
};

type Eip6963ProviderDetail = {
  info?: Eip6963ProviderInfo;
  provider?: any;
};

type ConnectorDebugLevel = "info" | "warning" | "error";

function getEip6963ProvidersCount(windowRef: any): number {
  const win = windowRef as any;
  const providers = win?.[EIP6963_PROVIDERS_KEY];
  return Array.isArray(providers) ? providers.length : 0;
}

function shouldReportConnectorDebug(windowRef: any, key: string): boolean {
  const win = windowRef as any;
  if (
    !win[CONNECTOR_DEBUG_CACHE_KEY] ||
    typeof win[CONNECTOR_DEBUG_CACHE_KEY] !== "object"
  ) {
    win[CONNECTOR_DEBUG_CACHE_KEY] = {};
  }

  const cache = win[CONNECTOR_DEBUG_CACHE_KEY] as Record<string, number>;
  const now = Date.now();
  const lastReportedAt = cache[key];
  if (
    typeof lastReportedAt === "number" &&
    now - lastReportedAt < CONNECTOR_DEBUG_REPORT_WINDOW_MS
  ) {
    return false;
  }

  cache[key] = now;
  return true;
}

function reportConnectorDebug(
  windowRef: any,
  params: {
    connectorId: string;
    event: string;
    level?: ConnectorDebugLevel;
    extra?: Record<string, unknown>;
  }
): void {
  if (typeof window === "undefined") return;
  const key = `${params.connectorId}:${params.event}`;
  if (!shouldReportConnectorDebug(windowRef, key)) return;

  Sentry.withScope((scope) => {
    // These are diagnostic breadcrumbs for MetaMask provider resolution, not
    // real warnings. Default to info so the client beforeSend filter drops
    // them out of the errors dashboard; callers can still override to warning
    // if something genuinely warrants attention.
    scope.setLevel(params.level ?? "info");
    scope.setTag("kind", "wallet_connector_debug");
    scope.setTag("connectorId", params.connectorId);
    scope.setTag("walletEvent", params.event);
    if (params.extra) {
      for (const [extraKey, extraValue] of Object.entries(params.extra)) {
        scope.setExtra(extraKey, extraValue);
      }
    }
    Sentry.captureMessage(`Wallet connector debug: ${params.event}`);
  });
}

function requestEip6963Providers(windowRef: any) {
  try {
    windowRef.dispatchEvent(new Event("eip6963:requestProvider"));
  } catch {
    // no-op
  }
}

function ensureEip6963Listener(windowRef: any) {
  const win = windowRef as any;

  if (!Array.isArray(win[EIP6963_PROVIDERS_KEY])) {
    win[EIP6963_PROVIDERS_KEY] = [];
  }
  if (win[EIP6963_LISTENER_READY_KEY]) {
    return;
  }

  const announcedProviders = win[EIP6963_PROVIDERS_KEY] as Eip6963ProviderDetail[];

  const onAnnounceProvider = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (!detail?.provider) return;

    const alreadyTracked = announcedProviders.some(
      (entry) =>
        entry.provider === detail.provider ||
        (Boolean(detail.info?.uuid) && entry.info?.uuid === detail.info?.uuid),
    );

    if (!alreadyTracked) {
      announcedProviders.push(detail);
    }
  };

  win.addEventListener(
    "eip6963:announceProvider",
    onAnnounceProvider as EventListener,
  );
  win[EIP6963_LISTENER_READY_KEY] = true;

  requestEip6963Providers(win);
  window.setTimeout(() => {
    requestEip6963Providers(win);
  }, 50);
}

function pickEip6963Provider(
  windowRef: any,
  predicate: (provider: any, info?: Eip6963ProviderInfo) => boolean,
) {
  ensureEip6963Listener(windowRef);
  requestEip6963Providers(windowRef);

  const win = windowRef as any;
  const announcedProviders = Array.isArray(win[EIP6963_PROVIDERS_KEY])
    ? (win[EIP6963_PROVIDERS_KEY] as Eip6963ProviderDetail[])
    : [];

  const match = announcedProviders.find((entry) =>
    matchesProvider(entry.provider, (provider) =>
      predicate(provider, entry.info),
    ),
  );

  return match?.provider;
}

function matchesProvider(
  provider: any,
  predicate: (provider: any) => boolean
) {
  if (!provider) return false;
  try {
    return predicate(provider);
  } catch {
    return false;
  }
}

function pickInjectedProvider(
  windowRef: any,
  predicate: (provider: any) => boolean,
  eip6963Predicate?: (provider: any, info?: Eip6963ProviderInfo) => boolean,
) {
  const ethereum = (windowRef as any)?.ethereum;
  if (matchesProvider(ethereum, predicate)) return ethereum;

  const providers = Array.isArray(ethereum?.providers)
    ? ethereum.providers
    : [];
  const providerFromEthereum = providers.find((provider: any) =>
    matchesProvider(provider, predicate)
  );
  if (providerFromEthereum) return providerFromEthereum;

  return pickEip6963Provider(
    windowRef,
    eip6963Predicate ?? ((provider) => predicate(provider)),
  );
}

function isMetaMaskProvider(provider: any) {
  return (
    provider?.isMetaMask === true &&
    provider?.isRabby !== true &&
    provider?.isCoinbaseWallet !== true &&
    provider?.isPhantom !== true &&
    provider?.isTrust !== true &&
    provider?.isTrustWallet !== true
  );
}

function isRabbyProvider(provider: any) {
  return provider?.isRabby === true;
}

function isTrustWalletProvider(provider: any) {
  return (
    (provider?.isTrust === true || provider?.isTrustWallet === true) &&
    provider?.isMetaMask !== true
  );
}

const wagmiAdapter = new WagmiAdapter({
  projectId: WALLET_CONNECT_PROJECT_ID,
  networks: [...networks],
  ssr: true,
  multiInjectedProviderDiscovery: false,
  transports: {
    [mainnet.id]: instrumentedFallback(
      MAINNET_RPC_URLS,
      undefined,
      { source: "wagmi" }
    ),
    [sepolia.id]: instrumentedHttp(
      SEPOLIA_RPC_URL,
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
            target: {
              id: "io.metamask",
              name: "MetaMask",
              provider: (window) => {
                const provider = pickInjectedProvider(
                  window,
                  isMetaMaskProvider,
                  (provider, info) =>
                    info?.rdns === "io.metamask" ||
                    isMetaMaskProvider(provider),
                );
                if (provider) return provider;

                const ethereum = (window as any)?.ethereum;
                if (
                  ethereum &&
                  typeof ethereum.request === "function" &&
                  isMetaMaskProvider(ethereum)
                ) {
                  reportConnectorDebug(window, {
                    connectorId: "io.metamask",
                    event: "metamask_provider_fallback_window_ethereum",
                    extra: {
                      ethereumIsMetaMask: ethereum.isMetaMask ?? null,
                      ethereumIsCoinbaseWallet: ethereum.isCoinbaseWallet ?? null,
                      ethereumIsPhantom: ethereum.isPhantom ?? null,
                      ethereumProvidersCount: Array.isArray(ethereum.providers)
                        ? ethereum.providers.length
                        : 0,
                      eip6963ProvidersCount: getEip6963ProvidersCount(window),
                    },
                  });
                  return ethereum as any;
                }

                if (ethereum && typeof ethereum.request === "function") {
                  reportConnectorDebug(window, {
                    connectorId: "io.metamask",
                    event: "metamask_provider_fallback_rejected_non_metamask",
                    extra: {
                      ethereumIsMetaMask: ethereum.isMetaMask ?? null,
                      ethereumIsCoinbaseWallet: ethereum.isCoinbaseWallet ?? null,
                      ethereumIsPhantom: ethereum.isPhantom ?? null,
                      ethereumProvidersCount: Array.isArray(ethereum.providers)
                        ? ethereum.providers.length
                        : 0,
                      eip6963ProvidersCount: getEip6963ProvidersCount(window),
                    },
                  });
                  return undefined;
                }

                reportConnectorDebug(window, {
                  connectorId: "io.metamask",
                  event: "metamask_provider_not_found",
                  extra: {
                    hasWindowEthereum: Boolean(ethereum),
                    ethereumProvidersCount:
                      ethereum && Array.isArray(ethereum.providers)
                        ? ethereum.providers.length
                        : 0,
                    eip6963ProvidersCount: getEip6963ProvidersCount(window),
                  },
                });

                return undefined;
              },
            },
          }),
          injected({
            ...INJECTED_CONNECTOR_OPTIONS,
            target: {
              id: "io.rabby",
              name: "Rabby",
              provider: (window) =>
                pickInjectedProvider(
                  window,
                  isRabbyProvider,
                  (provider, info) =>
                    info?.rdns === "io.rabby" || isRabbyProvider(provider),
                ),
            },
          }),
          injected({
            ...INJECTED_CONNECTOR_OPTIONS,
            target: {
              id: "phantom",
              name: "Phantom",
              icon: "/images/icons/phantom.svg",
              provider: (window) =>
                ((window as any)?.phantom?.ethereum as any) ??
                pickInjectedProvider(
                  window,
                  (provider) => provider.isPhantom === true,
                  (provider, info) =>
                    info?.rdns === "app.phantom" || provider.isPhantom === true,
                ),
            },
          }),
          injected({
            ...INJECTED_CONNECTOR_OPTIONS,
            target: {
              id: "com.trustwallet.app",
              name: "Trust Wallet",
              provider: (window) =>
                ((window as any)?.trustwallet as any) ??
                pickInjectedProvider(
                  window,
                  isTrustWalletProvider,
                  (provider, info) =>
                    info?.rdns === "com.trustwallet.app" ||
                    isTrustWalletProvider(provider),
                ),
            },
          }),
          injected({
            ...INJECTED_CONNECTOR_OPTIONS,
            target: {
              id: "coinbaseWallet",
              name: "Coinbase Wallet",
              provider: (window) =>
                ((window as any)?.coinbaseWalletExtension as any) ??
                pickInjectedProvider(
                  window,
                  (provider) => provider.isCoinbaseWallet === true,
                  (provider, info) =>
                    info?.rdns === "com.coinbase.wallet" ||
                    provider.isCoinbaseWallet === true,
                ),
            },
          }),
        ],
  storage: createStorage({
    storage: createPersistentWalletStorage(),
  }),
});

function initializeAppKit() {
  if (typeof window === "undefined") return;

  const win = window as Window & {
    __glowReownAppKitInitialized?: boolean;
    __glowReownAppKitClient?: ReturnType<typeof createAppKit>;
  };
  if (win.__glowReownAppKitInitialized && win.__glowReownAppKitClient) {
    return win.__glowReownAppKitClient;
  }

  const appKitClient = createAppKit({
    adapters: [wagmiAdapter],
    networks: [...networks],
    projectId: WALLET_CONNECT_PROJECT_ID,
    metadata: getAppKitMetadata(),
    enableWallets: true,
    // Keep AppKit from layering its own Coinbase/Injected connectors on top
    // of the explicit wagmi connectors above.
    enableCoinbase: false,
    enableInjected: false,
    features: {
      email: false,
      socials: false,
      connectMethodsOrder: ["wallet"],
      onramp: false,
      swaps: true,
      send: true,
      history: true,
    },
  });

  win.__glowReownAppKitInitialized = true;
  win.__glowReownAppKitClient = appKitClient;
  return appKitClient;
}

initializeAppKit();

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export function getAppKitClient() {
  return initializeAppKit();
}
