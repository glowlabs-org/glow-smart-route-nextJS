"use client";

import React from "react";
import { useQueryState } from "nuqs";
import { parseAsString } from "nuqs";
import { Cpu, Sparkles, Sprout, SunIcon, Users } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FarmsView } from "./farms-view";
import { DelegatorsView } from "./delegators-view";
import { MinersView } from "./miners-view";
import { ImpactView } from "./impact-view";
import { CashMinerIcon, ImpactStreakIcon } from "@/components/impact-icons";
import { useLang } from "@/lib/i18n";

interface RewardsTabConfig {
  value: "impact" | "farms" | "delegator" | "miner";
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
        value: "impact",
        label: s.tabImpact,
        description: s.tabImpactDesc,
        Icon: ImpactStreakIcon,
      },
      {
        value: "delegator",
        label: s.tabDelegators,
        description: s.tabDelegatorsDesc,
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
    parseAsString.withDefault("impact")
  );
  const [selectedFarmId, setSelectedFarmId] = useQueryState(
    "farmId",
    parseAsString.withDefault("")
  );

  const validType = ["impact", "delegator", "miner", "farms"].includes(type)
    ? (type as "impact" | "delegator" | "miner" | "farms")
    : "impact";

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

            <Tabs
              value={validType}
              onValueChange={(value) => {
                if (!["impact", "delegator", "miner", "farms"].includes(value))
                  return;

                const nextType = value as
                  | "impact"
                  | "delegator"
                  | "miner"
                  | "farms";

                setType(nextType);
                if (nextType !== "farms" && selectedFarmId)
                  setSelectedFarmId("");
              }}
            >
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border/30 dark:border-border/50 bg-muted/30 dark:bg-muted/40 p-1.5 sm:w-auto sm:grid-cols-4 sm:rounded-full sm:p-2">
                {REWARDS_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-10 gap-2 justify-center rounded-xl px-4 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-none sm:rounded-full sm:px-5"
                  >
                    <tab.Icon className="h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {validType === "impact" ? (
            <ImpactView />
          ) : validType === "farms" ? (
            <FarmsView
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
            />
          ) : validType === "delegator" ? (
            <DelegatorsView />
          ) : (
            <MinersView />
          )}
        </div>
      </section>
    </div>
  );
}
