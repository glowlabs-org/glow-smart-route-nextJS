"use client";

import React from "react";
import { useQueryState } from "nuqs";
import { parseAsString } from "nuqs";
import { Check, Cpu, Menu, Sparkles, Sprout, SunIcon, Users } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FarmsView } from "./farms-view";
import { MinersView } from "./miners-view";
import { WalletLeaderboardView } from "./wallet-leaderboard-view";
import { CashMinerIcon } from "@/components/impact-icons";
import { useLang } from "@/lib/i18n";

interface RewardsTabConfig {
  value: "wallet" | "farms" | "miner";
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export function RewardsSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RewardsView() {
  const { t } = useLang();
  const s = t.routes.stats;

  const REWARDS_TABS: RewardsTabConfig[] = React.useMemo(
    () => [
      {
        value: "wallet",
        label: s.tabWallets,
        description: s.tabWalletsDesc,
        Icon: Users,
      },
      {
        value: "miner",
        label: s.tabMiners,
        description: s.tabMinersDesc,
        Icon: CashMinerIcon,
      },
      {
        value: "farms",
        label: s.tabFarms,
        description: s.tabFarmsDesc,
        Icon: SunIcon,
      },
    ],
    [s]
  );

  const [type, setType] = useQueryState(
    "type",
    parseAsString.withDefault("wallet")
  );
  const [selectedFarmId, setSelectedFarmId] = useQueryState(
    "farmId",
    parseAsString.withDefault("")
  );

  // Legacy links (?type=impact / ?type=delegator) fold into the merged wallet
  // leaderboard.
  const validType: "wallet" | "miner" | "farms" =
    type === "miner" ? "miner" : type === "farms" ? "farms" : "wallet";

  const activeTab =
    REWARDS_TABS.find((tab) => tab.value === validType) ?? REWARDS_TABS[0]!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="max-w-screen-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {s.rewardsLeaderboard}
            </h1>

            {/* Wallets is the default view; Miners + Farms are tucked into a
                menu so the leaderboard stays focused on wallets for most
                visitors while power users can still reach the other views. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 self-start rounded-full border border-border/30 bg-card px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-foreground transition-colors hover:bg-muted/50 dark:border-border/50 dark:bg-muted/40 sm:self-auto"
                >
                  <Menu className="h-4 w-4" />
                  {activeTab.label}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-card">
                {REWARDS_TABS.map((tab) => {
                  const isActive = tab.value === validType;
                  return (
                    <DropdownMenuItem
                      key={tab.value}
                      onClick={() => {
                        setType(tab.value);
                        if (tab.value !== "farms" && selectedFarmId)
                          setSelectedFarmId("");
                      }}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 py-2.5",
                        isActive && "bg-accent"
                      )}
                    >
                      <tab.Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium">{tab.label}</span>
                        <span className="text-xs leading-snug text-muted-foreground">
                          {tab.description}
                        </span>
                      </div>
                      {isActive && (
                        <Check className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {validType === "wallet" ? (
            <WalletLeaderboardView />
          ) : validType === "farms" ? (
            <FarmsView
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
            />
          ) : (
            <MinersView />
          )}
        </div>
      </section>
    </div>
  );
}
