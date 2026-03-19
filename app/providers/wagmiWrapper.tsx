"use client";

import React from "react";
import {
  WagmiProvider,
  cookieToInitialState,
  type Config,
  type State,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { wagmiConfig } from "@/lib/wagmi-config";
import {
  HUB_RATE_LIMIT_EVENT,
  getHubRateLimitDelayMs,
  isHubRateLimitError,
  type HubRateLimitEventDetail,
} from "@/lib/api/hub-client";
import { installBrowserRateLimitFetchInterceptor } from "@/lib/api/browser-rate-limit-fetch";
import { toast } from "sonner";

type WagmiWrapperProps = {
  children: React.ReactNode;
  cookies?: string | null;
};

export const WagmiWrapper = ({ children, cookies }: WagmiWrapperProps) => {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            retry: (failureCount, error) => {
              // Hub GET already does bounded retry with Retry-After handling.
              if (isHubRateLimitError(error)) return false;
              return failureCount < 3;
            },
            retryDelay: (attemptIndex, error) => {
              const retryAfterMs = getHubRateLimitDelayMs(error);
              if (typeof retryAfterMs === "number") return retryAfterMs;
              return Math.min(1000 * 2 ** attemptIndex, 30000);
            },
          },
        },
      })
  );

  const initialState = React.useMemo<State | undefined>(() => {
    if (!cookies) return undefined;

    try {
      return cookieToInitialState(wagmiConfig as Config, cookies);
    } catch {
      return undefined;
    }
  }, [cookies]);

  React.useEffect(() => {
    const teardownFetchInterceptor = installBrowserRateLimitFetchInterceptor({
      maxRetries: 1,
    });

    const handleRateLimit = (event: Event) => {
      const customEvent = event as CustomEvent<HubRateLimitEventDetail>;
      const { retryAfterMs } = customEvent.detail;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      toast("Too many requests", {
        id: "hub-rate-limit",
        description: `Retrying in about ${retryAfterSeconds}s.`,
      });
    };

    window.addEventListener(HUB_RATE_LIMIT_EVENT, handleRateLimit as EventListener);
    return () => {
      teardownFetchInterceptor();
      window.removeEventListener(
        HUB_RATE_LIMIT_EVENT,
        handleRateLimit as EventListener
      );
    };
  }, []);

  return (
    <WagmiProvider
      config={wagmiConfig}
      initialState={initialState}
      reconnectOnMount
    >
      <QueryClientProvider client={queryClient}>
        <Toaster position="bottom-right" />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
};
