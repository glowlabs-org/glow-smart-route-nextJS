"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";

const MintAndStakeGctlDialog = dynamic(
  () =>
    import("@/components/dialogs/mint-and-stake-gctl-dialog").then(
      (m) => m.MintAndStakeGctlDialog
    ),
  { ssr: false }
);

export function GctlLandingCta() {
  const { isConnected, address } = useAccount();
  const { signer } = useEthersSigner();
  const { usdcBalance, usdgBalance } = useER20Balances({ signer });
  const [isMintDialogOpen, setIsMintDialogOpen] = React.useState(false);

  const hasTrackedViewRef = React.useRef(false);
  React.useEffect(() => {
    if (hasTrackedViewRef.current) return;
    hasTrackedViewRef.current = true;
    trackEvent("gctl_landing_view", {
      wallet_connected: isConnected,
      wallet: address ?? null,
    });
  }, [isConnected, address]);

  const handleConnectClick = React.useCallback(() => {
    if (isConnected) return;
    trackEvent("gctl_landing_connect_click");
  }, [isConnected]);

  const handleConnectSuccess = React.useCallback(() => {
    trackEvent("gctl_landing_connect_success", {
      wallet: address ?? null,
    });
  }, [address]);

  const handleMintClick = React.useCallback(() => {
    trackEvent("gctl_landing_mint_click", {
      wallet: address ?? null,
    });
    setIsMintDialogOpen(true);
  }, [address]);

  return (
    <>
      <div className="space-y-4">
        {!isConnected ? (
          <div onClickCapture={handleConnectClick}>
            <ConnectButton
              variant="default"
              size="large"
              className="w-full sm:max-w-xs"
              onConnect={handleConnectSuccess}
            />
          </div>
        ) : (
          <Button
            className="h-12 sm:h-14 w-full sm:max-w-xs"
            onClick={handleMintClick}
          >
            Mint &amp; Stake GCTL
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="text-xs sm:text-sm text-muted-foreground/60 mt-6 lg:mt-4">
        {!isConnected
          ? "Connect wallet to get started"
          : "Mint price = \u221AGLW price. Funds flow to the Glow Endowment."}
      </div>

      {isMintDialogOpen && (
        <MintAndStakeGctlDialog
          open={isMintDialogOpen}
          onOpenChange={setIsMintDialogOpen}
          usdcBalance={usdcBalance}
          usdgBalance={usdgBalance}
          forceStep1
        />
      )}
    </>
  );
}
