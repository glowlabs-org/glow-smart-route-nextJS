import { ConnectButton as RainbowKitConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "./ui/button";
import clsx from "clsx";

export const ConnectButton = ({
  className,
  variant = "default",
}: {
  className?: string;
  variant: "default" | "outline";
}) => {
  return (
    <RainbowKitConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        return (
          <div
            className={clsx("flex justify-center", className)}
            {...(!mounted && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!mounted || !account || !chain) {
                return (
                  <Button
                    variant={variant}
                    onClick={openConnectModal}
                    type="button"
                    className="w-full"
                  >
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button
                    variant={variant}
                    onClick={openChainModal}
                    type="button"
                    className="w-full"
                  >
                    Wrong network
                  </Button>
                );
              }

              return (
                <div style={{ display: "flex", gap: 12 }}>
                  <Button
                    variant={variant}
                    onClick={openAccountModal}
                    type="button"
                    className="w-full"
                  >
                    {account.displayName}
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
