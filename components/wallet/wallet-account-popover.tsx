"use client";

import * as React from "react";
import { Copy, ExternalLink, LogOut, Share2, Wallet } from "lucide-react";
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
import { GlowSymbol } from "@/components/glow-symbol";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { hubGet } from "@/lib/api/hub-client";
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
      toast.success("Address copied");
    } catch {
      toast.error("Failed to copy address");
    }
  };

  const handleCopyReferral = async () => {
    const link = referralQuery.data?.shareableLink;
    if (!link) {
      toast.error("Referral link not ready");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Referral link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (!address) return <>{trigger}</>;

  const explorerUrl = `${explorerBaseFor(chainId)}/address/${address}`;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Popover>
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
              aria-label="Copy address"
            >
              <Copy className="h-4 w-4" />
            </button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              aria-label="Open in block explorer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="border-t border-border/40" />

        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Balances
          </p>
        </div>
        <div className="px-2 pb-2 space-y-0.5">
          <BalanceRow
            symbol="GLW"
            label="GLW"
            amount={formatAmount(balances.glwBalance, 18, 4)}
            isLoading={balances.isLoading}
          />
          <BalanceRow
            symbol="USDG"
            label="USDG"
            amount={formatAmount(balances.usdgBalance, 6, 2)}
            isLoading={balances.isLoading}
          />
          <BalanceRow
            symbol="USDC"
            label="USDC"
            amount={formatAmount(balances.usdcBalance, 6, 2)}
            isLoading={balances.isLoading}
          />
          <BalanceRow
            symbol="ETH"
            label="ETH"
            amount={formatAmount(balances.ethBalance, 18, 5)}
            isLoading={balances.isLoading}
          />
        </div>

        <div className="border-t border-border/40" />

        <div className="p-2 space-y-1">
          <ActionButton
            onClick={handleCopyReferral}
            icon={<Share2 className="h-4 w-4" />}
            disabled={!referralQuery.data?.shareableLink}
          >
            {referralQuery.data?.shareableLink
              ? "Copy referral link"
              : referralQuery.isLoading
              ? "Loading referral…"
              : "Copy referral link"}
          </ActionButton>
        </div>

        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => disconnect()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors py-2.5 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      </PopoverContent>
    </Popover>
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
