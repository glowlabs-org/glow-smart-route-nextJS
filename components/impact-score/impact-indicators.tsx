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

function IndicatorIcon(props: {
  meta: IndicatorMeta;
  isActive: boolean;
  variant: "multiplier" | "source";
  onClick?: () => void;
}) {
  const { meta, isActive, variant, onClick } = props;

  const sizeClassName = variant === "multiplier" ? "h-10 w-10" : "h-8 w-8";
  const base = cn(
    "relative inline-flex items-center justify-center rounded-xl border transition-colors",
    sizeClassName,
    variant === "multiplier" ? "ring-1 ring-white/10" : undefined
  );
  const cursorClassName = onClick ? "cursor-pointer" : "cursor-default";
  const inactive = "border-border bg-muted/10 text-muted-foreground/70";

  const active =
    variant === "multiplier"
      ? meta.key === "miner"
        ? "border-[color:var(--color-miner-yellow)]/90 bg-[color:var(--color-miner-yellow)]/25 text-[color:var(--color-miner-yellow)] "
        : "border-delegation-purple/90 bg-delegation-purple/25 text-delegation-purple"
      : meta.key === "steering"
      ? "border-[#22D3EE] bg-[#22D3EE]/12 text-[#22D3EE]"
      : meta.key === "emissions"
      ? "border-[color:var(--color-miner-yellow)] bg-[color:var(--color-miner-yellow)]/12 text-[color:var(--color-miner-yellow)]"
      : meta.key === "vault"
      ? "border-delegation-purple bg-delegation-purple/12 text-delegation-purple"
      : "border-[#4ADE80] bg-[#4ADE80]/5 text-[#4ADE80]";

  const Icon = meta.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(base, cursorClassName, isActive ? active : inactive)}
          aria-label={`${meta.label} ${variant} ${
            isActive ? "active" : "missing"
          }`}
          onClick={onClick}
        >
          <Icon
            className={cn(
              variant === "multiplier" ? "h-5 w-5" : "h-5 w-5",
              meta.key === "streak"
                ? isActive
                  ? "dark:brightness-100"
                  : "opacity-70"
                : undefined
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        <div className="space-y-0.5">
          <div className="font-semibold">
            {meta.label} — {isActive ? "ACTIVE" : "MISSING"}
          </div>
          <div>{meta.effect}</div>
          <div className="opacity-90">
            {isActive ? "How to keep: " : "How to get: "}
            {meta.howToGet}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const POINT_SOURCES: IndicatorMeta[] = [
  {
    key: "steering",
    label: "Steering Power (sGCTL)",
    howToGet: "Stake GCTL",
    effect: "3× points per GLW steered this week",
    icon: SteeringIcon,
  },
  {
    key: "emissions",
    label: "Emissions Earned",
    howToGet: "Earn GLW emissions (miner, delegation, farms)",
    effect: "+1.0 pts per GLW earned in emission rewards",
    icon: EmissionsIcon,
  },
  {
    key: "vault",
    label: "Vault Bonus",
    howToGet: "Delegate GLW",
    effect: "+0.005 pts per GLW delegated per week",
    icon: VaultIcon,
  },
  {
    key: "worth",
    label: "GLW Worth",
    howToGet: "Hold GLW / build Glow Worth",
    effect: "+0.001 pts per GLW per week",
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
      key: "miner",
      label: "Cash Miner",
      howToGet: "Buy a miner",
      effect: "3× rollover multiplier (weekly points tripled)",
      icon: CashMinerIcon,
    },
    {
      key: "streak",
      label: "Impact streak",
      howToGet: "Increase delegation weekly",
      effect: `Streak bonus +0.25× per week (max +1.0×)${streakSuffix}`,
      icon: ImpactStreakIcon,
    },
  ];
}

export function ImpactPointSourcesIcons(props: {
  state: ImpactIndicatorsState;
  className?: string;
  onIndicatorClick?: (key: IndicatorMeta["key"]) => void;
}) {
  const { state, className, onIndicatorClick } = props;
  return (
    <div
      className={cn("inline-flex items-center flex-wrap gap-1.5", className)}
    >
      {POINT_SOURCES.map((meta) => {
        const isActive =
          meta.key === "steering"
            ? state.hasSteeringStake
            : meta.key === "emissions"
            ? state.hasEmissionsEarned
            : meta.key === "vault"
            ? state.hasVaultBonus
            : state.hasGlwWorth;
        return (
          <IndicatorIcon
            key={meta.key}
            meta={meta}
            isActive={isActive}
            variant="source"
            onClick={() => onIndicatorClick?.(meta.key)}
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
  const { state, className, onIndicatorClick } = props;
  const items = React.useMemo(
    () =>
      getMultipliersMeta({
        hasImpactStreak: state.hasImpactStreak,
        streakBonusMultiplier: state.streakBonusMultiplier,
      }),
    [state.hasImpactStreak, state.streakBonusMultiplier]
  );
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {items.map((meta) => {
        const isActive =
          meta.key === "miner"
            ? state.hasMinerMultiplier
            : state.hasImpactStreak;
        return (
          <IndicatorIcon
            key={meta.key}
            meta={meta}
            isActive={isActive}
            variant="multiplier"
            onClick={() => onIndicatorClick?.(meta.key)}
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
  const { state, className, onIndicatorClick } = props;
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <ImpactPointSourcesIcons
        state={state}
        className="justify-end"
        onIndicatorClick={onIndicatorClick}
      />
      <div className="h-8 w-px bg-border/60" />
      <ImpactMultipliersIcons
        state={state}
        onIndicatorClick={onIndicatorClick}
      />
    </div>
  );
}
