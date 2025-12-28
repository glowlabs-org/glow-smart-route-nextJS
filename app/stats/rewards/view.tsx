"use client";

import React from "react";
import { useQueryState } from "nuqs";
import { parseAsString } from "nuqs";
import { Cpu, Sparkles, Sprout, Users } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FarmsView } from "./farms-view";
import { DelegatorsView } from "./delegators-view";
import { MinersView } from "./miners-view";
import { ImpactView } from "./impact-view";

interface RewardsTabConfig {
  value: "impact" | "farms" | "delegator" | "miner";
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const REWARDS_TABS: RewardsTabConfig[] = [
  {
    value: "impact",
    label: "Impact",
    description: "Weekly impact score + leaderboard",
    Icon: Sparkles,
  },
  {
    value: "farms",
    label: "Farms",
    description: "Solar farms & sponsorship performance",
    Icon: Sprout,
  },
  {
    value: "delegator",
    label: "Delegators",
    description: "Delegation activity & rankings",
    Icon: Users,
  },
  {
    value: "miner",
    label: "Miners",
    description: "Miner multiplier status & rankings",
    Icon: Cpu,
  },
] as const;

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
    <div className="min-h-screen bg-background">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Rewards
              </div>
              <div className="text-xs text-muted-foreground font-mono hidden lg:block">
                <span className="text-foreground">{activeTab.label}</span> ·{" "}
                {activeTab.description}
              </div>
            </div>

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
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-border bg-background/60 p-2 dark:bg-muted/20 sm:w-auto sm:grid-cols-4 sm:gap-1 sm:rounded-full sm:p-1">
                {REWARDS_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-10 justify-start rounded-xl px-3 py-2 text-sm sm:h-9 sm:justify-center sm:rounded-full sm:px-4 sm:text-xs sm:font-mono sm:uppercase sm:tracking-wider"
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
