import { Button } from "./ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { useConnectWallet } from "@privy-io/react-auth";
import clsx from "clsx";
import * as React from "react";
import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { useLang } from "@/lib/i18n";
import { WalletAccountPopover } from "./wallet/wallet-account-popover";

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
  const { t } = useLang();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const targetChainId =
    process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet.id : sepolia.id;

  const onConnectRef = useRef(onConnect);
  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  const { connectWallet } = useConnectWallet({
    onError: (error) => {
      Sentry.captureException(new Error(String(error)), {
        tags: { walletStage: "connect" },
      });
    },
  });

  const supportedChainIds: number[] = [mainnet.id, sepolia.id];
  const isWrongNetwork =
    isConnected && chainId && !supportedChainIds.includes(chainId);

  useEffect(() => {
    if (!isConnected) return;
    onConnectRef.current?.();
  }, [isConnected]);

  const buttonSizeClass = clsx(
    minimal ? "w-auto px-2 min-w-0 aspect-square" : "w-full",
    size === "small"
      ? "h-8 lg:h-10 text-sm lg:text-base"
      : size === "medium"
      ? "h-10 lg:h-12 text-base lg:text-lg"
      : "h-12 lg:h-16 text-base lg:text-lg",
    "font-semibold"
  );

  const handleSwitchToTarget = async () => {
    try {
      await switchChain({ chainId: targetChainId });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      Sentry.captureException(normalizedError, {
        tags: { walletStage: "network_switch" },
      });
    }
  };

  return (
    <div className={clsx("flex justify-center", className)}>
      {!isConnected ? (
        <Button
          variant={variant}
          onClick={() => connectWallet()}
          type="button"
          className={buttonSizeClass}
        >
          <Wallet className={clsx(minimal ? "mr-0" : "mr-2 h-4 w-4")} />
          {!minimal && t.wallet.connectWallet}
        </Button>
      ) : isWrongNetwork ? (
        <Button
          variant="destructive"
          type="button"
          onClick={handleSwitchToTarget}
          disabled={isSwitchingChain}
          className={buttonSizeClass}
        >
          <Loader2 className={clsx(minimal ? "mr-0" : "mr-2 h-4 w-4")} />
          {!minimal && t.wallet.wrongNetwork}
        </Button>
      ) : (
        <WalletAccountPopover
          trigger={
            <Button variant={variant} type="button" className={buttonSizeClass}>
              {!minimal ? (
                address ? `${address.slice(0, 6)}...${address.slice(-4)}` : t.wallet.connected
              ) : (
                <div className="h-2 w-2 rounded-full bg-green-500" />
              )}
            </Button>
          }
        />
      )}
    </div>
  );
};
