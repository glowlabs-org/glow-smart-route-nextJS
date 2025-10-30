import { Button } from "./ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import clsx from "clsx";
import * as React from "react";
import { useEffect, useState, useRef } from "react";
import { WalletOptions } from "./wallet-options";
import { Account } from "./account";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const ConnectButton = ({
  className,
  variant = "default",
  size = "large",
  onConnect,
}: {
  className?: string;
  variant: "default" | "outline-white";
  size?: "small" | "medium" | "large";
  onConnect?: () => void;
}) => {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { isPending, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isStuckConnecting, setIsStuckConnecting] = useState(false);
  const connectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hasAnnouncedStuckRef = useRef(false);

  // Detect Safari browser
  const isSafari =
    typeof window !== "undefined" &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Handle stuck connection state (especially in Safari)
  useEffect(() => {
    if (isConnecting || isReconnecting || isPending) {
      // Clear any existing timeout
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
      }

      // Set a timeout to detect stuck connection (shorter for Safari)
      const timeoutDuration = isSafari ? 3000 : 5000;
      connectingTimeoutRef.current = setTimeout(() => {
        setIsStuckConnecting(true);
      }, timeoutDuration);
    } else {
      // Clear timeout and reset stuck state when not connecting
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
      }
      setIsStuckConnecting(false);
      hasAnnouncedStuckRef.current = false;
    }

    return () => {
      if (connectingTimeoutRef.current) {
        clearTimeout(connectingTimeoutRef.current);
      }
    };
  }, [isConnecting, isReconnecting, isPending, isSafari]);

  useEffect(() => {
    if (isStuckConnecting && !hasAnnouncedStuckRef.current) {
      toast.info("Still waiting on wallet confirmation", {
        description:
          "Unlock your wallet or approve the pending request, then retry.",
        duration: 6000,
      });
      hasAnnouncedStuckRef.current = true;
    }
  }, [isStuckConnecting]);

  // Close modal when connected
  useEffect(() => {
    if (isConnected) {
      setIsModalOpen(false);
      onConnect?.();
    }
  }, [isConnected, onConnect]);

  const isWalletLoading =
    (isConnecting || isReconnecting || isPending) && !isStuckConnecting;

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

  // Check if on wrong network (assuming mainnet or sepolia are supported)
  const isWrongNetwork =
    isConnected && chainId && ![1, 11155111].includes(chainId);

  const getDisplayName = () => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleOpenConnectModal = () => {
    // Reset any previous connection errors
    disconnect();
    reset();
    setIsModalOpen(true);
  };
  return (
    <>
      <div className={clsx("flex justify-center", className)}>
        {(() => {
          if (isWalletLoading) {
            return (
              <Button
                variant={variant}
                disabled
                type="button"
                className={`w-full ${getSizeClasses()} font-semibold`}
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isConnecting
                  ? "Connecting..."
                  : isPending
                  ? "Connecting..."
                  : "Reconnecting..."}
              </Button>
            );
          }

          if (isStuckConnecting) {
            return (
              <Button
                variant="destructive"
                onClick={handleOpenConnectModal}
                type="button"
                className={`w-full ${getSizeClasses()} font-semibold`}
              >
                <Loader2 className="mr-2 h-4 w-4" />
                Unlock wallet & retry
              </Button>
            );
          }

          if (isWrongNetwork) {
            return (
              <Button
                variant="destructive"
                onClick={() => disconnect()}
                type="button"
                className={`w-full ${getSizeClasses()} font-semibold`}
              >
                <Loader2 className="mr-2 h-4 w-4" />
                Wrong Network
              </Button>
            );
          }

          if (!isConnected) {
            return (
              <div className="space-y-2 w-full">
                <Button
                  variant={variant}
                  onClick={handleOpenConnectModal}
                  type="button"
                  className={`w-full ${getSizeClasses()} font-semibold`}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </Button>
              </div>
            );
          }

          return (
            <Button
              variant={variant}
              onClick={() => setIsAccountModalOpen(true)}
              type="button"
              className={`w-full ${getSizeClasses()} font-semibold`}
            >
              {getDisplayName()}
            </Button>
          );
        })()}
      </div>

      {/* Connect Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-[500px] w-full border-border shadow-2xl overflow-hidden">
          <WalletOptions />
        </DialogContent>
      </Dialog>

      {/* Account Modal */}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-[500px] w-full border-border shadow-2xl overflow-hidden">
          <Account />
        </DialogContent>
      </Dialog>
    </>
  );
};
