"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { Chain, mainnet, sepolia } from "wagmi/chains";
import { http } from "wagmi";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";

if (!process.env.NEXT_PUBLIC_WALLET_CONNECT_ID) {
  throw new Error("NEXT_PUBLIC_WALLET_CONNECT_ID is not set");
}

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

let chain: Chain;
if (process.env.NEXT_PUBLIC_CHAIN_ID === "1") {
  chain = mainnet;
} else process.env.NEXT_PUBLIC_CHAIN_ID === "11155111";
{
  chain = sepolia;
}

const config = getDefaultConfig({
  appName: "BuyGlow.xyz",
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
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider>
          <Toaster />
          {/* <SmartAccountWarningDialog /> */}
          {children}
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};
