"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutDashboard, ShoppingCart } from "lucide-react";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useGctlApi } from "@/hooks/control-gctl";
import { useLang } from "@/lib/i18n";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

const MintAndStakeGctlDialog = dynamic(
  () =>
    import("@/components/dialogs/mint-and-stake-gctl-dialog").then(
      (m) => m.MintAndStakeGctlDialog
    ),
  { ssr: false }
);

const BuyGlowDialog = dynamic(
  () =>
    import("@/components/dialogs/buy-glow-dialog").then((m) => m.BuyGlowDialog),
  { ssr: false }
);

export function GctlWalletIndicator() {
  const { isConnected } = useAccount();
  if (!isConnected) return null;
  return <ConnectButton variant="default" size="small" />;
}

export function GctlLandingCta() {
  const { t } = useLang();
  const r = t.routes.gctlLanding;
  const { isConnected, address } = useAccount();
  const { signer } = useEthersSigner();
  const { usdcBalance, usdgBalance } = useER20Balances({ signer });
  const { gctlBalance } = useGctlApi(address, { enabled: isConnected });
  const glwSpotPrice = useGlowSpotPriceSummary();
  const [isMintDialogOpen, setIsMintDialogOpen] = React.useState(false);
  const [isBuyGlwDialogOpen, setIsBuyGlwDialogOpen] = React.useState(false);

  const hasGctl = React.useMemo(() => {
    try {
      return BigInt(gctlBalance ?? "0") > 0n;
    } catch {
      return false;
    }
  }, [gctlBalance]);

  const gctlBalanceFormatted = React.useMemo(() => {
    try {
      const raw = Number(
        formatUnits(BigInt(gctlBalance ?? "0"), DECIMALS_BY_TOKEN.GCTL)
      );
      return raw.toLocaleString("en-US", { maximumFractionDigits: 2 });
    } catch {
      return "0";
    }
  }, [gctlBalance]);

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

  const handleBuyGlwClick = React.useCallback(() => {
    trackEvent("dashboard_buy_glw_click", {
      source: "gctl_landing",
      wallet_connected: isConnected,
      wallet_address: address ?? null,
    });
    setIsBuyGlwDialogOpen(true);
  }, [isConnected, address]);

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
        ) : hasGctl ? (
          <div className="flex flex-col sm:flex-row gap-3 sm:max-w-md">
            <Button
              className="h-12 sm:h-14 flex-1"
              onClick={handleBuyGlwClick}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {r.buyGlw}
            </Button>
            <Button variant="outline" className="h-12 sm:h-14 flex-1" asChild>
              <Link href="/" prefetch>{r.goToDashboard}</Link>
            </Button>
          </div>
        ) : (
          <Button
            className="h-12 sm:h-14 w-full sm:max-w-xs"
            onClick={handleMintClick}
          >
            {r.mintAndStake}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="text-xs sm:text-sm text-muted-foreground/60 mt-6 lg:mt-4">
        {!isConnected
          ? r.connectPrompt
          : hasGctl
          ? r.youHoldGctl(gctlBalanceFormatted)
          : r.mintPriceNote}
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

      {isBuyGlwDialogOpen && (
        <BuyGlowDialog
          open={isBuyGlwDialogOpen}
          onOpenChange={setIsBuyGlwDialogOpen}
          usdcBalance={usdcBalance ?? null}
          glowSpotPrice={glwSpotPrice.spotPriceUsd || 0}
          source="gctl_landing"
          defaultUsdcAmount="20"
        />
      )}
    </>
  );
}
