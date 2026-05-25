"use client";

import * as React from "react";
import {
  ChevronRight,
  Copy,
  ExternalLink,
  History,
  LogOut,
  Share2,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlowSymbol } from "@/components/glow-symbol";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useRecentActivityFeed } from "@/hooks/useRecentActivityFeed";
import { useV2PointsBalance } from "@/hooks/v2-points";
import { RecentActivity } from "@/app/wallet/recent-activity";
import { hubGet } from "@/lib/api/hub-client";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ReferralCodeResponse = {
  code: string;
  shareableLink: string;
};

const TOKEN_ICON_SRC_BY_SYMBOL = {
  ETH: "/images/tokens/eth.svg",
  USDC: "/images/tokens/usdc.svg",
  USDG: "/images/tokens/usdg.svg",
} as const;

function TokenIcon({ symbol }: { symbol: "ETH" | "GLW" | "USDC" | "USDG" }) {
  if (symbol === "GLW") {
    return (
      <div className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        <GlowSymbol className="h-4 w-4" />
      </div>
    );
  }
  if (symbol === "USDG") {
    return (
      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary">
        U
      </div>
    );
  }
  const src = TOKEN_ICON_SRC_BY_SYMBOL[symbol as "ETH" | "USDC"];
  return (
    <img src={src} alt={symbol} className="h-7 w-7 rounded-full" draggable={false} />
  );
}

function formatAmount(raw: bigint | null, decimals: number, maxFractionDigits = 4) {
  if (raw == null) return "—";
  const value = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

function explorerBaseFor(chainId: number) {
  if (chainId === sepolia.id) return "https://sepolia.etherscan.io";
  return "https://etherscan.io";
}

type WalletAccountPopoverProps = {
  trigger: React.ReactNode;
};

export function WalletAccountPopover({ trigger }: WalletAccountPopoverProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const balances = useWalletTokenBalances(address);
  const { t } = useLang();

  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [isActivityOpen, setIsActivityOpen] = React.useState(false);
  // Only fetch the activity feed once the dialog is opened, so the always-mounted
  // header popover doesn't pull recent activity on every page load.
  const activityFeed = useRecentActivityFeed(
    isActivityOpen ? address : undefined
  );
  // Points balance loads only while the popover is open (header is always mounted).
  const pointsQuery = useV2PointsBalance(popoverOpen ? address : null);
  const availablePoints = pointsQuery.data?.availablePoints;
  const showPoints =
    popoverOpen &&
    (pointsQuery.isLoading || typeof availablePoints === "number");

  const referralQuery = useQuery({
    queryKey: ["wallet-popover-referral-code", address],
    enabled: Boolean(address),
    queryFn: () =>
      hubGet<ReferralCodeResponse>("/referral/code", {
        params: { walletAddress: address! },
      }),
  });

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.success(t.wallet.addressCopied);
    } catch {
      toast.error(t.wallet.failedToCopyAddress);
    }
  };

  const handleCopyReferral = async () => {
    const link = referralQuery.data?.shareableLink;
    if (!link) {
      toast.error(t.wallet.referralLinkNotReady);
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t.wallet.referralLinkCopied);
    } catch {
      toast.error(t.wallet.failedToCopyLink);
    }
  };

  if (!address) return <>{trigger}</>;

  const explorerUrl = `${explorerBaseFor(chainId)}/address/${address}`;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const balanceRows = [
    { symbol: "GLW", label: "GLW", raw: balances.glwBalance, decimals: 18, max: 4 },
    { symbol: "USDG", label: "USDG", raw: balances.usdgBalance, decimals: 6, max: 2 },
    { symbol: "USDC", label: "USDC", raw: balances.usdcBalance, decimals: 6, max: 2 },
    { symbol: "ETH", label: "ETH", raw: balances.ethBalance, decimals: 18, max: 5 },
  ] as const;
  // Hide assets the wallet holds none of (keep all rows while still loading).
  const visibleBalanceRows = balanceRows.filter(
    (row) => balances.isLoading || (row.raw != null && row.raw > 0n)
  );

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-foreground/10 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Wallet className="h-3.5 w-3.5" />
            </div>
            <span className="font-mono text-sm font-medium truncate">
              {shortAddress}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleCopyAddress}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              aria-label={t.wallet.copyAddress}
            >
              <Copy className="h-4 w-4" />
            </button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              aria-label={t.wallet.openInExplorer}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {visibleBalanceRows.length > 0 || showPoints ? (
          <>
            <div className="border-t border-border/40" />

            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t.wallet.balances}
              </p>
            </div>
            <div className="px-2 pb-2 space-y-0.5">
              {showPoints ? (
                <div className="flex items-center justify-between px-2 py-2 rounded-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-[color:var(--color-glow-orange)]/10 border border-[color:var(--color-glow-orange)]/30 flex items-center justify-center text-[color:var(--color-glow-orange)] shrink-0">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium">
                      {t.wallet.points}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      pointsQuery.isLoading && "opacity-50"
                    )}
                  >
                    {pointsQuery.isLoading
                      ? "…"
                      : (availablePoints ?? 0).toLocaleString("en-US", {
                          maximumFractionDigits: 0,
                        })}
                  </span>
                </div>
              ) : null}
              {visibleBalanceRows.map((row) => (
                <BalanceRow
                  key={row.symbol}
                  symbol={row.symbol}
                  label={row.label}
                  amount={formatAmount(row.raw, row.decimals, row.max)}
                  isLoading={balances.isLoading}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="border-t border-border/40" />

        <div className="p-2 space-y-1">
          <ActionButton
            onClick={() => {
              setPopoverOpen(false);
              setIsActivityOpen(true);
            }}
            icon={<History className="h-4 w-4" />}
          >
            {t.widgets.recentActivity.dialogTitle}
          </ActionButton>
          <Link
            href="/shop"
            onClick={() => setPopoverOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-muted/40 transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>{t.wallet.pointsShop}</span>
          </Link>
          <ActionButton
            onClick={handleCopyReferral}
            icon={<Share2 className="h-4 w-4" />}
            disabled={!referralQuery.data?.shareableLink}
          >
            {referralQuery.data?.shareableLink
              ? t.wallet.copyReferralLink
              : referralQuery.isLoading
              ? t.wallet.loadingReferral
              : t.wallet.copyReferralLink}
          </ActionButton>
        </div>

        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => disconnect()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors py-2.5 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            {t.wallet.disconnect}
          </button>
        </div>
      </PopoverContent>
      </Popover>

      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md p-0 max-h-[85vh] flex flex-col overflow-hidden bg-card border-border/20 dark:border-border/40 rounded-2xl">
          <DialogHeader className="px-6 py-5 border-b border-border/20 dark:border-border/40 flex-shrink-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {t.widgets.recentActivity.dialogTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <RecentActivity
              className="h-auto lg:max-h-none bg-transparent border-transparent overflow-visible"
              walletAddress={address}
              splitsActivity={activityFeed.splitsActivity}
              swapsActivity={activityFeed.swapsActivity}
              isSplitsActivityLoading={activityFeed.isSplitsActivityLoading}
              isSwapsActivityLoading={activityFeed.isSwapsActivityLoading}
              hideIfEmpty={false}
              showHeader={false}
              showKpis={false}
              maxItems={50}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BalanceRow({
  symbol,
  label,
  amount,
  isLoading,
}: {
  symbol: "GLW" | "USDG" | "USDC" | "ETH";
  label: string;
  amount: string;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-2 rounded-lg">
      <div className="flex items-center gap-2.5 min-w-0">
        <TokenIcon symbol={symbol} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          isLoading && "opacity-50"
        )}
      >
        {isLoading ? "…" : amount}
      </span>
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
