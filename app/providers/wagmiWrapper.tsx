"use client";

import React from "react";
import {
  WagmiProvider,
  useAccount,
  useConfig,
  useConnect,
  useDisconnect,
} from "wagmi";
import type { Connector } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { wagmiConfig } from "@/lib/wagmi-config";

const RECONNECT_LOOKUP_KEY = "recentConnectorId";

interface MetaMaskProvider {
  _metamask?: {
    isUnlocked?: () => Promise<boolean>;
  };
}

const WalletConnectionManager = () => {
  const { status, connector } = useAccount();
  const config = useConfig();
  const { disconnectAsync } = useDisconnect();
  const { connectAsync, connectors, status: connectStatus } = useConnect();

  const hasShownLockToastRef = React.useRef(false);
  const reconnectAttemptedRef = React.useRef(false);
  const validationRunRef = React.useRef(false);

  const checkWalletUnlocked = async (
    targetConnector: Connector | null | undefined
  ): Promise<boolean> => {
    if (!targetConnector) return true;

    try {
      const candidate = targetConnector as Connector & {
        isAuthorized?: () => Promise<boolean>;
        getAccounts?: () => Promise<readonly string[]>;
        getProvider?: () => Promise<any>;
      };

      if (candidate.isAuthorized) {
        const authorized = await candidate.isAuthorized();
        if (!authorized) return false;
      }

      if (candidate.getAccounts) {
        const accounts = await candidate.getAccounts().catch(() => null);
        if (!accounts || accounts.length === 0) return false;
      }

      if (candidate.getProvider) {
        const provider = await candidate.getProvider().catch(() => null);
        const metamaskProvider = provider as MetaMaskProvider;

        if (metamaskProvider?._metamask?.isUnlocked) {
          const unlocked = await metamaskProvider._metamask
            .isUnlocked()
            .catch(() => true);
          return unlocked;
        }
      }
    } catch (error) {
      console.warn("Wallet unlock validation failed", error);
      return false;
    }

    return true;
  };

  const handleLockedWallet = async () => {
    await disconnectAsync().catch(() => {});
    if (!hasShownLockToastRef.current) {
      toast.info("Unlock wallet to finish connecting", {
        description: "Please unlock MetaMask (or your wallet) and try again.",
        duration: 7000,
      });
      hasShownLockToastRef.current = true;
    }
  };

  const validateConnection = async () => {
    if (status !== "connected" || !connector) {
      hasShownLockToastRef.current = false;
      return;
    }

    const unlocked = await checkWalletUnlocked(connector);
    if (!unlocked) {
      await handleLockedWallet();
    } else {
      hasShownLockToastRef.current = false;
    }
  };

  const attemptReconnect = async () => {
    // Respect one-shot disable flag set by forceDisconnect
    try {
      if (typeof document !== "undefined") {
        const cookie = document.cookie || "";
        if (cookie.includes("wagmi_disable_auto_connect_once=1")) return;
      }
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("wagmi_disable_auto_connect_once") === "1") {
          return;
        }
      }
    } catch {}

    if (
      !config.storage ||
      connectStatus === "pending" ||
      status !== "disconnected"
    ) {
      reconnectAttemptedRef.current = false;
      return;
    }

    if (reconnectAttemptedRef.current) return;

    try {
      const lastConnectorId = await config.storage.getItem(
        RECONNECT_LOOKUP_KEY,
        null
      );
      if (!lastConnectorId) return;

      const target = connectors.find(
        (item) => item.id === lastConnectorId || item.uid === lastConnectorId
      );
      if (!target) return;

      const unlocked = await checkWalletUnlocked(target);
      if (!unlocked) return;

      reconnectAttemptedRef.current = true;
      await connectAsync({ connector: target });
    } catch (error) {
      console.warn("Auto reconnect skipped", error);
    }
  };

  if (!validationRunRef.current || status === "connected") {
    validationRunRef.current = true;
    validateConnection();
  }

  if (
    status === "disconnected" &&
    config.storage &&
    !reconnectAttemptedRef.current
  ) {
    attemptReconnect();
  }

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWindowFocus = () => {
      validateConnection();
      attemptReconnect();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleWindowFocus);
    };
  }, []);

  return null;
};

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
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <WalletConnectionManager />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
};
