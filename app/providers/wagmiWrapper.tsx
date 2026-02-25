"use client";

import React from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "@/lib/wagmi-config";

export const WagmiWrapper = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
          },
        },
      })
  );

  const reconnectOnMount = React.useMemo(() => {
    if (typeof window === "undefined") return true;
    const ethereum = (window as any)?.ethereum;
    const providers = Array.isArray(ethereum?.providers)
      ? ethereum.providers
      : ethereum
      ? [ethereum]
      : [];

    const hasMetaMask = providers.some(
      (provider: any) =>
        provider?.isMetaMask === true && provider?.isCoinbaseWallet !== true
    );
    const hasCoinbase = providers.some(
      (provider: any) => provider?.isCoinbaseWallet === true
    );

    // Temporary safety valve: avoid auto reconnect deadlock observed when both
    // MetaMask and Coinbase extensions are injected into the same Chrome profile.
    return !(hasMetaMask && hasCoinbase);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={reconnectOnMount}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <Toaster position="bottom-right" />
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
