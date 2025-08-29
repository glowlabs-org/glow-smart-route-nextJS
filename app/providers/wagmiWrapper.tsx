"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { Chain, mainnet, sepolia } from "wagmi/chains";
import { http } from "wagmi";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

if (!process.env.NEXT_PUBLIC_WALLET_CONNECT_ID) {
  throw new Error("NEXT_PUBLIC_WALLET_CONNECT_ID is not set");
}

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

let chain: Chain;
if (process.env.NEXT_PUBLIC_CHAIN_ID === "1") {
  chain = mainnet;
} else if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
  chain = sepolia;
} else {
  throw new Error("Invalid chain ID");
}

console.log(
  "process.env.NEXT_PUBLIC_CHAIN_ID",
  process.env.NEXT_PUBLIC_CHAIN_ID
);
console.log(chain);

const config = getDefaultConfig({
  appName: "app.glow.org",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID,
  chains: [chain],
  transports: {
    [chain.id]: http(),
  },
  ssr: true, // If your dApp uses server side rendering (SSR)
  batch: {
    multicall: {
      wait: 32,
    },
  },
});

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

  // Detect Safari to handle its specific issues
  const isSafari =
    typeof window !== "undefined" &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Clear potentially corrupted wallet state on Safari
  React.useEffect(() => {
    if (isSafari && typeof window !== "undefined") {
      // Check for corrupted state
      const wagmiStore = window.localStorage.getItem("wagmi.store");
      if (wagmiStore) {
        try {
          JSON.parse(wagmiStore);
        } catch (e) {
          // Clear corrupted state
          window.localStorage.removeItem("wagmi.wallet");
          window.localStorage.removeItem("wagmi.connected");
          window.localStorage.removeItem("wagmi.store");
        }
      }
    }
  }, [isSafari]);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config} reconnectOnMount={!isSafari}>
        <RainbowKitProvider>
          <Toaster />
          {/* <SmartAccountWarningDialog /> */}
          {children}
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};
