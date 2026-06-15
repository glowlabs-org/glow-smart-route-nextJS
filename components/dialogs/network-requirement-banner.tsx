"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NetworkRequirementBannerProps {
  expectedNetworkLabel: string;
  connectedNetworkLabel?: string;
  isConnected: boolean;
  isWrongNetwork: boolean;
  isSwitching?: boolean;
  onSwitchNetwork?: () => void;
  copy: {
    title: (network: string) => string;
    connected: (network: string) => string;
    disconnected: (network: string) => string;
    wrong: (connected: string, expected: string) => string;
    switchTo: (network: string) => string;
    switching: string;
  };
}

export function NetworkRequirementBanner({
  expectedNetworkLabel,
  connectedNetworkLabel,
  isConnected,
  isWrongNetwork,
  isSwitching = false,
  onSwitchNetwork,
  copy,
}: NetworkRequirementBannerProps) {
  const Icon = isWrongNetwork ? AlertCircle : isConnected ? CheckCircle2 : Network;

  return (
    <div
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs",
        isWrongNetwork
          ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-border/30 bg-muted/20 text-muted-foreground",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
            isWrongNetwork
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : isConnected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-3 w-3" />
        </span>
        <span className="truncate whitespace-nowrap">
          {isWrongNetwork
            ? copy.wrong(
                connectedNetworkLabel || "another network",
                expectedNetworkLabel,
              )
            : copy.title(expectedNetworkLabel)}
        </span>
      </div>
      {isWrongNetwork && onSwitchNetwork ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 shrink-0 rounded-full px-1.5 text-[11px] text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
          onClick={onSwitchNetwork}
          disabled={isSwitching}
        >
          {isSwitching ? copy.switching : copy.switchTo(expectedNetworkLabel)}
        </Button>
      ) : null}
    </div>
  );
}
