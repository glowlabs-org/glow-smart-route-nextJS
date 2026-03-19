import { Button } from "./ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useAccount, useChainId, useConnect } from "wagmi";
import clsx from "clsx";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ConnectKitButton } from "connectkit";
import * as Sentry from "@sentry/nextjs";
import { Account } from "./account";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const CONNECT_PENDING_SENTRY_TIMEOUT_MS = 12_000;

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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const onConnectRef = useRef(onConnect);
  const pendingReportKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  // Check if on wrong network (assuming mainnet or sepolia are supported)
  const isWrongNetwork =
    isConnected && chainId && ![1, 11155111].includes(chainId);

  // Call onConnect when wallet connects
  useEffect(() => {
    if (!isConnected) return;
    onConnectRef.current?.();
  }, [isConnected]);

  useEffect(() => {
    if (!connectError) return;
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

  // Use ConnectKitButton which handles all wallet connection logic
  // Customize it with our styling and account modal
  return (
    <>
      <div className={clsx("flex justify-center", className)}>
        <ConnectKitButton.Custom>
          {({ isConnected, show, address, ensName }) => {
            if (!isConnected) {
              return (
                <Button
                  variant={variant}
                  onClick={show}
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
              );
            }

            if (isWrongNetwork) {
              return (
                <Button
                  variant="destructive"
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
                  <Loader2 className={clsx(minimal ? "mr-0" : "mr-2 h-4 w-4")} />
                  {!minimal && "Wrong Network"}
                </Button>
              );
            }

            return (
              <Button
                variant={variant}
                onClick={() => setIsAccountModalOpen(true)}
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
                  address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : ensName || "Connected"
                 ) : (
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                 )}
              </Button>
            );
          }}
        </ConnectKitButton.Custom>
      </div>

      {/* Account Modal */}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="bg-background backdrop-blur-sm rounded-2xl p-0 sm:max-w-[500px] w-full border-border shadow-2xl overflow-hidden">
          <Account onClose={() => setIsAccountModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};
