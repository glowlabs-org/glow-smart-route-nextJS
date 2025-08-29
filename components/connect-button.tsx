import { ConnectButton as RainbowKitConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import clsx from "clsx";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

export const ConnectButton = ({
  className,
  variant = "default",
  size = "large",
}: {
  className?: string;
  variant: "default" | "outline-white";
  size?: "small" | "medium" | "large";
}) => {
  const { isConnecting, isReconnecting, isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const isWalletLoading = isConnecting || isReconnecting;

  const [isTosOpen, setIsTosOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isConnected || !address) return;
    try {
      const key = `tos_ack_${address.toLowerCase()}`;
      const ack = window.localStorage.getItem(key);
      if (ack !== "1") setIsTosOpen(true);
    } catch {}
  }, [isConnected, address]);

  function handleAcceptTos() {
    try {
      if (address) {
        window.localStorage.setItem(`tos_ack_${address.toLowerCase()}`, "1");
      } else {
        window.localStorage.setItem("tos_ack", "1");
      }
    } catch {}
    setIsTosOpen(false);
  }

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
                <>
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

                  <Dialog open={isTosOpen} onOpenChange={setIsTosOpen}>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="text-base">
                          Terms of Service
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          By connecting your wallet, you acknowledge and agree
                          to Glow’s Terms of Service. This application is
                          experimental and does not provide financial advice.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Your acceptance will be remembered on this device.
                        </p>
                      </div>

                      <DialogFooter className="gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsTosOpen(false);
                            try {
                              disconnect();
                            } catch {}
                          }}
                        >
                          Disconnect
                        </Button>
                        <Button onClick={handleAcceptTos}>I Accept</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              );
            })()}
          </div>
        );
      }}
    </RainbowKitConnectButton.Custom>
  );
};
