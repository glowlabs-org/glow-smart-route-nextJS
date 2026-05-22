"use client";

import * as React from "react";
import {
  CashMinerIcon,
  ImpactStreakIcon,
  SteeringIcon,
  VaultIcon,
  ReferralIcon,
} from "@/components/impact-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useReferralLaunch } from "@/hooks/use-referral-launch";

// V2 points are earned from actions, not passive GLW holdings. Each indicator
// is one of the V2 earning sources (no Glow Worth, no multipliers).
export interface ImpactIndicatorsState {
  hasGlwDelegation: boolean;
  hasSgctlDelegation: boolean;
  hasMinerPurchase: boolean;
  hasStreak: boolean;
  hasReferral?: boolean;
}

type IndicatorKey = "glw" | "sgctl" | "miner" | "streak" | "referral";

interface IndicatorMeta {
  key: IndicatorKey;
  label: string;
  howToGet: string;
  effect: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getActiveStyles(key: IndicatorKey): string {
  switch (key) {
    case "glw":
      return "border-[color:var(--delegation-purple)]/30 bg-[color:var(--delegation-purple)]/10 text-[color:var(--delegation-purple)]";
    case "sgctl":
      return "border-[#22D3EE]/30 bg-[#22D3EE]/10 text-[#22D3EE]";
    case "miner":
      return "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner-contrast)]";
    case "streak":
      return "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]";
    case "referral":
      return "border-[color:var(--color-glow-orange)]/30 bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)]";
    default:
      return "";
  }
}

function IndicatorIcon(props: {
  meta: IndicatorMeta;
  isActive: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const { meta, isActive, compact, onClick } = props;
  const sizeClasses = compact
    ? "h-8 w-8 rounded-full"
    : "h-7 w-7 md:h-9 md:w-9 rounded-full";
  const iconSizeClasses = compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5 md:h-4 md:w-4";
  const Icon = meta.icon;

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "group relative inline-flex items-center justify-center border transition-all duration-300 ease-out flex-shrink-0",
            "hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            sizeClasses,
            isActive
              ? getActiveStyles(meta.key)
              : "border-dashed border-border/70 bg-muted/20 text-muted-foreground/70",
            onClick ? "cursor-pointer" : "cursor-default",
          )}
        >
          <Icon
            className={cn(
              iconSizeClasses,
              meta.key === "streak" && isActive && "animate-pulse",
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="bg-popover text-popover-foreground border-border"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{meta.label}</span>
            <span
              className={cn(
                "text-[10px] uppercase px-1.5 py-0.5 rounded-sm font-bold tracking-wider",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isActive ? "Earning" : "Not yet"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{meta.effect}</div>
          <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide pt-1">
            {isActive ? "Keep it up: " : "Start via: "}
            <span className="text-foreground">{meta.howToGet}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const POINT_SOURCES: IndicatorMeta[] = [
  {
    key: "glw",
    label: "GLW Delegation",
    howToGet: "Delegate GLW",
    effect: "4 pts per $1 delegated",
    icon: VaultIcon,
  },
  {
    key: "sgctl",
    label: "sGCTL Delegation",
    howToGet: "Delegate sGCTL",
    effect: "16 pts per $1 delegated",
    icon: SteeringIcon,
  },
  {
    key: "miner",
    label: "Miner Purchase",
    howToGet: "Buy a miner",
    effect: "8 pts per $1 purchased",
    icon: CashMinerIcon,
  },
  {
    key: "streak",
    label: "Weekly Streak",
    howToGet: "Act every protocol week",
    effect: "100 pts × week, up to 2,000",
    icon: ImpactStreakIcon,
  },
  {
    key: "referral",
    label: "Referral Network",
    howToGet: "Invite friends",
    effect: "5-20% of referees' points",
    icon: ReferralIcon,
  },
];

export function ImpactIndicatorsRow(props: {
  state: ImpactIndicatorsState;
  className?: string;
  onIndicatorClick?: (key: IndicatorKey) => void;
}) {
  const { isLive: isReferralLive } = useReferralLaunch();

  const sources = React.useMemo(
    () =>
      isReferralLive
        ? POINT_SOURCES
        : POINT_SOURCES.filter((s) => s.key !== "referral"),
    [isReferralLive],
  );

  const isActive = React.useCallback(
    (key: IndicatorKey) => {
      switch (key) {
        case "glw":
          return props.state.hasGlwDelegation;
        case "sgctl":
          return props.state.hasSgctlDelegation;
        case "miner":
          return props.state.hasMinerPurchase;
        case "streak":
          return props.state.hasStreak;
        case "referral":
          return Boolean(props.state.hasReferral);
        default:
          return false;
      }
    },
    [props.state],
  );

  return (
    <div
      className={cn("flex items-center justify-center gap-1.5", props.className)}
    >
      {sources.map((meta) => (
        <IndicatorIcon
          key={meta.key}
          meta={meta}
          isActive={isActive(meta.key)}
          compact
          onClick={() => props.onIndicatorClick?.(meta.key)}
        />
      ))}
    </div>
  );
}
