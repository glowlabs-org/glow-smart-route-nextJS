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

const EIP6963_PROVIDERS_KEY = "__glowEip6963Providers";
const EIP6963_LISTENER_READY_KEY = "__glowEip6963ListenerReady";

type Eip6963ProviderInfo = {
  rdns?: string;
  name?: string;
  uuid?: string;
};

type Eip6963ProviderDetail = {
  info?: Eip6963ProviderInfo;
  provider?: any;
};

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
            target: {
              id: "io.metamask",
              name: "MetaMask",
              provider: (window) =>
                pickInjectedProvider(
                  window,
                  (provider) =>
                    provider.isMetaMask === true &&
                    provider.isCoinbaseWallet !== true &&
                    provider.isPhantom !== true,
                  (provider, info) =>
                    info?.rdns === "io.metamask" ||
                    (provider.isMetaMask === true &&
                      provider.isCoinbaseWallet !== true &&
                      provider.isPhantom !== true),
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
