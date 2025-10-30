import { Button } from "./ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import clsx from "clsx";
import * as React from "react";
import { useState, useEffect } from "react";
import { ConnectKitButton } from "connectkit";
import { Account } from "./account";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Check if on wrong network (assuming mainnet or sepolia are supported)
  const isWrongNetwork =
    isConnected && chainId && ![1, 11155111].includes(chainId);

  // Call onConnect when wallet connects
  useEffect(() => {
    if (isConnected && onConnect) {
      onConnect();
    }
  }, [isConnected, onConnect]);

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
                  className={`w-full ${
                    size === "small"
                      ? "h-8 lg:h-10 text-sm lg:text-base"
                      : size === "medium"
                      ? "h-10 lg:h-12 text-base lg:text-lg"
                      : "h-12 lg:h-16 text-base lg:text-lg"
                  } font-semibold`}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </Button>
              );
            }

            if (isWrongNetwork) {
              return (
                <Button
                  variant="destructive"
                  type="button"
                  className={`w-full ${
                    size === "small"
                      ? "h-8 lg:h-10 text-sm lg:text-base"
                      : size === "medium"
                      ? "h-10 lg:h-12 text-base lg:text-lg"
                      : "h-12 lg:h-16 text-base lg:text-lg"
                  } font-semibold`}
                >
                  <Loader2 className="mr-2 h-4 w-4" />
                  Wrong Network
                </Button>
              );
            }

            return (
              <Button
                variant={variant}
                onClick={() => setIsAccountModalOpen(true)}
                type="button"
                className={`w-full ${
                  size === "small"
                    ? "h-8 lg:h-10 text-sm lg:text-base"
                    : size === "medium"
                    ? "h-10 lg:h-12 text-base lg:text-lg"
                    : "h-12 lg:h-16 text-base lg:text-lg"
                } font-semibold`}
              >
                {address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : ensName || "Connected"}
              </Button>
            );
          }}
        </ConnectKitButton.Custom>
      </div>

      {/* Account Modal */}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-[500px] w-full border-border shadow-2xl overflow-hidden">
          <Account onClose={() => setIsAccountModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};
