"use client";

import * as React from "react";
import {
  CashMinerIcon,
  ImpactStreakIcon,
  SteeringIcon,
  EmissionsIcon,
  VaultIcon,
  GlwWorthIcon,
} from "@/components/impact-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ImpactIndicatorsState {
  hasMinerMultiplier: boolean;
  hasImpactStreak: boolean;
  streakBonusMultiplier?: number;
  hasSteeringStake: boolean;
  hasEmissionsEarned: boolean;
  hasVaultBonus: boolean;
  hasGlwWorth: boolean;
}

interface IndicatorMeta {
  key: "miner" | "streak" | "steering" | "vault" | "emissions" | "worth";
  label: string;
  howToGet: string;
  effect: string;
  icon: React.ComponentType<{ className?: string }>;
}

// --- Visual Configurations ---

function getVariantStyles(
  key: IndicatorMeta["key"],
  isActive: boolean,
  variant: "multiplier" | "source"
) {
  // 1. Inactive State (The "Empty Socket" look)
  // Uses generic theme variables for Light/Dark compatibility
  if (!isActive) {
    return cn(
      "border-border bg-muted/30 text-muted-foreground",
      variant === "multiplier"
        ? "border-2 border-dashed shadow-inner"
        : "border border-transparent bg-muted/50"
    );
  }

  // 2. Active State (The "Power-up" look)
  switch (key) {
    // --- Multipliers (Turbo) ---

    // Miner: Blue
    case "miner":
      return cn(
        "border-[color:var(--color-miner)] text-[color:var(--color-miner)]",
        "bg-[color:var(--color-miner)]/10"
      );

    // Streak: Purple (Same as Vault now)
    case "streak":
      return cn(
        "border-[color:var(--delegation-purple)] text-[color:var(--delegation-purple)]",
        "bg-[color:var(--delegation-purple)]/10"
      );

    // --- Sources (Fuel) ---

    // Steering: Cyan
    case "steering":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-600 dark:text-cyan-400";

    // Emissions: Miner Blue (Brand consistency)
    case "emissions":
      return "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]";

    // Vault: Purple
    case "vault":
      return "border-[color:var(--delegation-purple)]/30 bg-[color:var(--delegation-purple)]/10 text-[color:var(--delegation-purple)]";

    // Worth: Green
    case "worth":
      return "border-green-400/30 bg-green-400/10 text-green-600 dark:text-green-400";

    default:
      return "";
  }
}

function IndicatorIcon(props: {
  meta: IndicatorMeta;
  isActive: boolean;
  variant: "multiplier" | "source";
  onClick?: () => void;
}) {
  const { meta, isActive, variant, onClick } = props;

  // Multipliers are larger to show hierarchy; smaller on mobile
  const sizeClasses =
    variant === "multiplier"
      ? "h-9 w-9 md:h-11 md:w-11 rounded-xl"
      : "h-7 w-7 md:h-9 md:w-9 rounded-full";

  const baseClasses = cn(
    "relative inline-flex items-center justify-center transition-all duration-300 ease-out",
    "hover:scale-105 active:scale-95", // Tactile feedback
    sizeClasses,
    getVariantStyles(meta.key, isActive, variant)
  );

  const Icon = meta.icon;

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            baseClasses,
            onClick ? "cursor-pointer" : "cursor-default"
          )}
          onClick={onClick}
        >
          {/* Inner Gloss for Multipliers (Light mode specific adjustments handled via opacity) */}
          {isActive && variant === "multiplier" && (
            <div className="absolute inset-0 rounded-xl bg-background/20 opacity-0 transition-opacity group-hover:opacity-100" />
          )}

          <Icon
            className={cn(
              variant === "multiplier"
                ? "h-4 w-4 md:h-5 md:w-5"
                : "h-3.5 w-3.5 md:h-4 md:w-4",
              // Pulse effect for active Streak
              meta.key === "streak" && isActive && "animate-pulse"
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        // Use standard shadcn classes for popover compatibility
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
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{meta.effect}</div>
          <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide pt-1">
            {isActive ? "Maintain via: " : "Unlock via: "}
            <span className="text-foreground">{meta.howToGet}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// --- Data Configuration ---

const POINT_SOURCES: IndicatorMeta[] = [
  {
    key: "steering",
    label: "Steering Power",
    howToGet: "Stake GCTL",
    effect: "3× points per GLW steered",
    icon: SteeringIcon,
  },
  {
    key: "emissions",
    label: "Emissions",
    howToGet: "Earn GLW rewards",
    effect: "+1.0 pts per GLW earned",
    icon: EmissionsIcon,
  },
  {
    key: "vault",
    label: "Vault Bonus",
    howToGet: "Delegate GLW",
    effect: "+0.005 pts per GLW delegated",
    icon: VaultIcon,
  },
  {
    key: "worth",
    label: "Glow Worth",
    howToGet: "Hold GLW",
    effect: "+0.001 pts per GLW held",
    icon: GlwWorthIcon,
  },
];

function getMultipliersMeta(args: {
  hasImpactStreak: boolean;
  streakBonusMultiplier?: number;
}): IndicatorMeta[] {
  const streakSuffix =
    args.hasImpactStreak &&
    args.streakBonusMultiplier != null &&
    args.streakBonusMultiplier > 0
      ? ` • +${args.streakBonusMultiplier.toFixed(2)}×`
      : "";
  return [
    {
      key: "streak",
      label: "Impact Streak",
      howToGet: "Weekly Delegation or Miner Purchase",
      effect: `Streak bonus +0.25× per week${streakSuffix}`,
      icon: ImpactStreakIcon,
    },
    {
      key: "miner",
      label: "Cash Miner",
      howToGet: "Buy a miner",
      effect: "3× Rollover Multiplier",
      icon: CashMinerIcon,
    },
  ];
}

// --- Components ---

export function ImpactPointSourcesIcons(props: {
  state: ImpactIndicatorsState;
  className?: string;
  onIndicatorClick?: (key: IndicatorMeta["key"]) => void;
}) {
  return (
    <div className={cn("flex items-center gap-1 md:gap-2", props.className)}>
      {POINT_SOURCES.map((meta) => {
        const isActive =
          meta.key === "steering"
            ? props.state.hasSteeringStake
            : meta.key === "emissions"
            ? props.state.hasEmissionsEarned
            : meta.key === "vault"
            ? props.state.hasVaultBonus
            : props.state.hasGlwWorth;
        return (
          <IndicatorIcon
            key={meta.key}
            meta={meta}
            isActive={isActive}
            variant="source"
            onClick={() => props.onIndicatorClick?.(meta.key)}
          />
        );
      })}
    </div>
  );
}

export function ImpactMultipliersIcons(props: {
  state: ImpactIndicatorsState;
  className?: string;
  onIndicatorClick?: (key: IndicatorMeta["key"]) => void;
}) {
  const items = React.useMemo(
    () =>
      getMultipliersMeta({
        hasImpactStreak: props.state.hasImpactStreak,
        streakBonusMultiplier: props.state.streakBonusMultiplier,
      }),
    [props.state.hasImpactStreak, props.state.streakBonusMultiplier]
  );
  return (
    <div className={cn("flex items-center gap-2 md:gap-3", props.className)}>
      {items.map((meta) => {
        const isActive =
          meta.key === "miner"
            ? props.state.hasMinerMultiplier
            : props.state.hasImpactStreak;
        return (
          <IndicatorIcon
            key={meta.key}
            meta={meta}
            isActive={isActive}
            variant="multiplier"
            onClick={() => props.onIndicatorClick?.(meta.key)}
          />
        );
      })}
    </div>
  );
}

export function ImpactIndicatorsRow(props: {
  state: ImpactIndicatorsState;
  className?: string;
  onIndicatorClick?: (key: IndicatorMeta["key"]) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 md:gap-3",
        props.className
      )}
    >
      {/* Sources Container - The "Tray" look */}
      <div className="flex items-center bg-muted/40 rounded-full px-1.5 py-1 md:px-2 md:py-1.5 border border-border/50">
        <ImpactPointSourcesIcons
          state={props.state}
          onIndicatorClick={props.onIndicatorClick}
        />
      </div>

      {/* Visual Separator - Hidden on mobile */}
      <div className="hidden md:block w-8 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />

      {/* Multipliers Container */}
      <ImpactMultipliersIcons
        state={props.state}
        onIndicatorClick={props.onIndicatorClick}
      />
    </div>
  );
}
