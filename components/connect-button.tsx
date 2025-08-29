import { ConnectButton as RainbowKitConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import clsx from "clsx";
import * as React from "react";
import { useEffect, useState, useRef } from "react";

export const ConnectButton = ({
  className,
  variant = "default",
  size = "large",
}: {
  className?: string;
  variant: "default" | "outline-white";
  size?: "small" | "medium" | "large";
}) => {
  const { isConnecting, isReconnecting } = useAccount();
  const [isStuckConnecting, setIsStuckConnecting] = useState(false);
  const connectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Detect Safari browser
  const isSafari =
    typeof window !== "undefined" &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Handle stuck connection state (especially in Safari)
  useEffect(() => {
    if (isConnecting || isReconnecting) {
      // Clear any existing timeout
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
      }

      // Set a timeout to detect stuck connection (shorter for Safari)
      const timeoutDuration = isSafari ? 3000 : 5000;
      connectingTimeoutRef.current = setTimeout(() => {
        setIsStuckConnecting(true);
        // Force reload wallet state after timeout
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("wagmi.wallet");
          window.localStorage.removeItem("wagmi.connected");
          window.localStorage.removeItem("wagmi.store");
        }
      }, timeoutDuration);
    } else {
      // Clear timeout and reset stuck state when not connecting
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
      }
      setIsStuckConnecting(false);
    }

    return () => {
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
      }
    };
  }, [isConnecting, isReconnecting, isSafari]);

  const isWalletLoading =
    (isConnecting || isReconnecting) && !isStuckConnecting;

  const getSizeClasses = () => {
    switch (size) {
      case "small":
        return "h-8 lg:h-10 text-sm lg:text-base";
      case "medium":
        return "h-10 lg:h-12 text-base lg:text-lg";
      case "large":
      default:
        return "h-12 lg:h-16 text-base lg:text-lg";
    }
  };

  return (
    <RainbowKitConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            className={clsx("flex justify-center", className)}
            {...(!ready && {
              "aria-hidden": true,
              style: {
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!ready) {
                return (
                  <Button
                    variant={variant}
                    disabled
                    type="button"
                    className={`w-full ${getSizeClasses()} font-semibold`}
                  >
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </Button>
                );
              }

              if (isWalletLoading) {
                return (
                  <Button
                    variant={variant}
                    disabled
                    type="button"
                    className={`w-full ${getSizeClasses()} font-semibold`}
                  >
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isConnecting ? "Connecting..." : "Reconnecting..."}
                  </Button>
                );
              }

              if (!connected) {
                return (
                  <Button
                    variant={variant}
                    onClick={openConnectModal}
                    type="button"
                    className={`w-full ${getSizeClasses()} font-semibold`}
                  >
                    Connect Wallet
                  </Button>
                );
              }

              if (chain?.unsupported) {
                return (
                  <Button
                    variant={variant}
                    onClick={openChainModal}
                    type="button"
                    className={`w-full ${getSizeClasses()} font-semibold bg-destructive hover:bg-destructive/90`}
                  >
                    <Loader2 className="mr-2 h-4 w-4" />
                    Wrong Network
                  </Button>
                );
              }

              return (
                <div style={{ display: "flex", gap: 12 }}>
                  <Button
                    variant={variant}
                    onClick={openAccountModal}
                    type="button"
                    className={`w-full ${getSizeClasses()} font-semibold`}
                  >
                    {account?.displayName}
                  </Button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </RainbowKitConnectButton.Custom>
  );
};
