import { Button } from "./ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import clsx from "clsx";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ConnectKitButton } from "connectkit";
import { Account } from "./account";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const onConnectRef = useRef(onConnect);

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
        <DialogContent className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-[500px] w-full border-border shadow-2xl overflow-hidden">
          <Account onClose={() => setIsAccountModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};
