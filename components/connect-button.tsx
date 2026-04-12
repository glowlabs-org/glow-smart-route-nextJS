import { Button } from "./ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useAccount, useChainId, useConnect } from "wagmi";
import clsx from "clsx";
import * as React from "react";
import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { getAppKitClient } from "@/lib/wagmi-config";
import { Dialog, DialogContent } from "./ui/dialog";
import { WalletOptions } from "./wallet-options";

const CONNECT_PENDING_SENTRY_TIMEOUT_MS = 12_000;
const CONNECT_SHOW_WATCHDOG_TIMEOUT_MS = 15_000;
const CONNECT_ATTEMPT_WINDOW_MS = 30_000;
const PROPOSAL_EXPIRED_REPORT_WINDOW_MS = 30_000;

function getRejectionMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    const message = (reason as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function isProposalExpiredReason(reason: unknown): boolean {
  return /proposal expired/i.test(getRejectionMessage(reason));
}

function isBenignWalletDiscoveryRejection(reason: unknown): boolean {
  return /not found rainbowkit/i.test(getRejectionMessage(reason));
}

export const ConnectButton = ({
  className,
  variant = "default",
  size = "large",
  onConnect,
  minimal = false,
}: {
  className?: string;
  variant: "default" | "outline-white";
  size?: "small" | "medium" | "large";
  onConnect?: () => void;
  minimal?: boolean;
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    error: connectError,
    isPending,
    variables: connectVariables,
    connectors,
  } = useConnect();
  const pendingConnector = connectVariables?.connector;
  const pendingConnectorId =
    typeof (pendingConnector as any)?.id === "string"
      ? (pendingConnector as any).id
      : "unknown";
  const pendingConnectorName =
    typeof (pendingConnector as any)?.name === "string"
      ? (pendingConnector as any).name
      : "unknown";
  const onConnectRef = useRef(onConnect);
  const pendingReportKeyRef = useRef<string | null>(null);
  const isConnectedRef = useRef(isConnected);
  const isPendingRef = useRef(isPending);
  const isWalletDialogOpenRef = useRef(false);
  const connectShowWatchdogRef = useRef<number | null>(null);
  const pendingConnectorIdRef = useRef(pendingConnectorId);
  const pendingConnectorNameRef = useRef(pendingConnectorName);
  const lastConnectAttemptAtRef = useRef(0);
  const proposalExpiredLastReportedAtRef = useRef(0);
  const [isWalletDialogOpen, setIsWalletDialogOpen] = React.useState(false);

  const clearConnectShowWatchdog = React.useCallback(() => {
    if (connectShowWatchdogRef.current !== null) {
      window.clearTimeout(connectShowWatchdogRef.current);
      connectShowWatchdogRef.current = null;
    }
  }, []);

  const scheduleConnectShowWatchdog = React.useCallback(() => {
    clearConnectShowWatchdog();
    connectShowWatchdogRef.current = window.setTimeout(() => {
      if (isConnectedRef.current) return;
      const appKitClient = getAppKitClient();
      const isAppKitOpen = Boolean(appKitClient?.isOpen?.());
      const isConnectSurfaceOpen = isWalletDialogOpenRef.current || isAppKitOpen;
      if (!isConnectSurfaceOpen) return;

      const connectorId = pendingConnectorIdRef.current;
      const connectorName = pendingConnectorNameRef.current;
      const hasPendingAttempt =
        isPendingRef.current ||
        connectorId !== "unknown" ||
        connectorName !== "unknown";
      if (!hasPendingAttempt) return;

      const ethereum = (window as any)?.ethereum;
      Sentry.withScope((scope) => {
        scope.setLevel("warning");
        scope.setTag("kind", "wallet_connect_show_timeout");
        scope.setTag("walletConnectorId", connectorId);
        scope.setTag("walletConnectorName", connectorName);
        scope.setExtra("hasWindowEthereum", Boolean(ethereum));
        scope.setExtra(
          "ethereumProvidersCount",
          ethereum && Array.isArray(ethereum.providers)
            ? ethereum.providers.length
            : 0
        );
        scope.setExtra("ethereumIsMetaMask", ethereum?.isMetaMask ?? null);
        scope.setExtra(
          "ethereumIsCoinbaseWallet",
          ethereum?.isCoinbaseWallet ?? null
        );
        scope.setExtra("ethereumIsPhantom", ethereum?.isPhantom ?? null);
        scope.setExtra(
          "configuredConnectors",
          connectors.map((connector) => ({
            id: connector.id,
            name: connector.name,
            type: connector.type,
          }))
        );
        scope.setExtra("isPending", isPendingRef.current);
        scope.setExtra("isWalletDialogOpen", isWalletDialogOpenRef.current);
        scope.setExtra("isAppKitOpen", isAppKitOpen);
        Sentry.captureMessage(
          "Wallet connect surface open with unresolved pending connection"
        );
      });
    }, CONNECT_SHOW_WATCHDOG_TIMEOUT_MS);
  }, [clearConnectShowWatchdog, connectors]);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    isPendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    isWalletDialogOpenRef.current = isWalletDialogOpen;
  }, [isWalletDialogOpen]);

  useEffect(() => {
    pendingConnectorIdRef.current = pendingConnectorId;
    pendingConnectorNameRef.current = pendingConnectorName;
  }, [pendingConnectorId, pendingConnectorName]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const appKitClient = getAppKitClient();
      const isConnectSurfaceOpen =
        Boolean(appKitClient?.isOpen?.()) || isWalletDialogOpenRef.current;
      const hasRecentConnectAttempt =
        Date.now() - lastConnectAttemptAtRef.current <= CONNECT_ATTEMPT_WINDOW_MS;
      if (
        !isConnectSurfaceOpen &&
        !isPendingRef.current &&
        !hasRecentConnectAttempt
      ) {
        return;
      }

      if (isBenignWalletDiscoveryRejection(reason)) {
        event.preventDefault();
        return;
      }

      if (!isProposalExpiredReason(reason)) return;

      event.preventDefault();

      const now = Date.now();
      if (
        now - proposalExpiredLastReportedAtRef.current <
        PROPOSAL_EXPIRED_REPORT_WINDOW_MS
      ) {
        return;
      }
      proposalExpiredLastReportedAtRef.current = now;

      const normalizedError =
        reason instanceof Error
          ? reason
          : new Error(getRejectionMessage(reason) || "WalletConnect proposal expired");

      Sentry.captureException(normalizedError, {
        level: "warning",
        tags: {
          walletStage: "connect",
          walletError: "walletconnect_proposal_expired",
          walletConnectorId: pendingConnectorIdRef.current,
          walletConnectorName: pendingConnectorNameRef.current,
        },
        extra: {
          isPending: isPendingRef.current,
          isConnectSurfaceOpen,
          hasRecentConnectAttempt,
        },
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);
    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
        true
      );
    };
  }, []);

  // Check if on wrong network (assuming mainnet or sepolia are supported)
  const isWrongNetwork =
    isConnected && chainId && ![1, 11155111].includes(chainId);

  // Call onConnect when wallet connects
  useEffect(() => {
    isConnectedRef.current = isConnected;
    if (!isConnected) return;
    setIsWalletDialogOpen(false);
    clearConnectShowWatchdog();
    lastConnectAttemptAtRef.current = 0;
    onConnectRef.current?.();
  }, [clearConnectShowWatchdog, isConnected]);

  const handleWalletDialogOpenChange = React.useCallback(
    (open: boolean) => {
      setIsWalletDialogOpen(open);
      if (!open && !isPendingRef.current) {
        clearConnectShowWatchdog();
        lastConnectAttemptAtRef.current = 0;
      }
    },
    [clearConnectShowWatchdog]
  );

  const handleConnectorSelected = React.useCallback(() => {
    lastConnectAttemptAtRef.current = Date.now();
    scheduleConnectShowWatchdog();
  }, [scheduleConnectShowWatchdog]);

  useEffect(() => {
    if (!connectError) return;
    lastConnectAttemptAtRef.current = 0;
    const normalizedError =
      connectError instanceof Error
        ? connectError
        : new Error(String((connectError as any)?.message ?? connectError));

    Sentry.captureException(normalizedError, {
      tags: {
        walletStage: "connect",
        walletConnectorId: pendingConnectorId,
        walletConnectorName: pendingConnectorName,
      },
      extra: {
        code: (connectError as any)?.code ?? null,
        shortMessage: (connectError as any)?.shortMessage ?? null,
        details: (connectError as any)?.details ?? null,
      },
    });
  }, [connectError, pendingConnectorId, pendingConnectorName]);

  useEffect(() => {
    if (!isPending) {
      pendingReportKeyRef.current = null;
      return;
    }

    const pendingKey = `${pendingConnectorId}:${pendingConnectorName}`;
    const timeoutId = window.setTimeout(() => {
      if (pendingReportKeyRef.current === pendingKey) return;
      pendingReportKeyRef.current = pendingKey;
      Sentry.withScope((scope) => {
        scope.setLevel("warning");
        scope.setTag("kind", "wallet_connect_pending");
        scope.setTag("walletConnectorId", pendingConnectorId);
        scope.setTag("walletConnectorName", pendingConnectorName);
        Sentry.captureMessage("Wallet connection is still pending after timeout");
      });
    }, CONNECT_PENDING_SENTRY_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isPending, pendingConnectorId, pendingConnectorName]);

  useEffect(() => {
    return () => {
      clearConnectShowWatchdog();
    };
  }, [clearConnectShowWatchdog]);

  return (
    <>
      <Dialog
        open={isWalletDialogOpen}
        onOpenChange={handleWalletDialogOpenChange}
      >
        <DialogContent className="max-w-xl p-0" showCloseButton={true}>
          <WalletOptions onConnectorSelected={handleConnectorSelected} />
        </DialogContent>
      </Dialog>
      <div className={clsx("flex justify-center", className)}>
        {!isConnected ? (
          <Button
            variant={variant}
            onClick={() => {
              handleWalletDialogOpenChange(true);
            }}
            type="button"
            className={clsx(
              "font-semibold",
              minimal ? "w-auto px-2 min-w-0 aspect-square" : "w-full",
              size === "small"
                ? "h-8 lg:h-10 text-sm lg:text-base"
                : size === "medium"
                ? "h-10 lg:h-12 text-base lg:text-lg"
                : "h-12 lg:h-16 text-base lg:text-lg"
            )}
          >
            <Wallet className={clsx(minimal ? "mr-0" : "mr-2 h-4 w-4")} />
            {!minimal && "Connect Wallet"}
          </Button>
        ) : isWrongNetwork ? (
          <Button
            variant="destructive"
            type="button"
            onClick={async () => {
              try {
                const appKitClient = getAppKitClient();
                if (!appKitClient) {
                  throw new Error("AppKit client is not initialized");
                }
                await appKitClient.open({ view: "Networks" });
              } catch (error) {
                const normalizedError =
                  error instanceof Error ? error : new Error(String(error));
                Sentry.captureException(normalizedError, {
                  tags: {
                    walletStage: "network_switch_show",
                  },
                });
              }
            }}
            className={clsx(
              "font-semibold",
              minimal ? "w-auto px-2 min-w-0 aspect-square" : "w-full",
              size === "small"
                ? "h-8 lg:h-10 text-sm lg:text-base"
                : size === "medium"
                ? "h-10 lg:h-12 text-base lg:text-lg"
                : "h-12 lg:h-16 text-base lg:text-lg"
            )}
          >
            <Loader2 className={clsx(minimal ? "mr-0" : "mr-2 h-4 w-4")} />
            {!minimal && "Wrong Network"}
          </Button>
        ) : (
          <Button
            variant={variant}
            onClick={async () => {
              try {
                const appKitClient = getAppKitClient();
                if (!appKitClient) {
                  throw new Error("AppKit client is not initialized");
                }
                await appKitClient.open({ view: "Account" });
              } catch (error) {
                const normalizedError =
                  error instanceof Error ? error : new Error(String(error));
                Sentry.captureException(normalizedError, {
                  tags: {
                    walletStage: "account_show",
                  },
                });
              }
            }}
            type="button"
            className={clsx(
              "font-semibold",
              minimal ? "w-auto px-2 min-w-0 aspect-square" : "w-full",
              size === "small"
                ? "h-8 lg:h-10 text-sm lg:text-base"
                : size === "medium"
                ? "h-10 lg:h-12 text-base lg:text-lg"
                : "h-12 lg:h-16 text-base lg:text-lg"
            )}
          >
            {!minimal ? (
              address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connected"
            ) : (
              <div className="h-2 w-2 rounded-full bg-green-500" />
            )}
          </Button>
        )}
      </div>
    </>
  );
};
