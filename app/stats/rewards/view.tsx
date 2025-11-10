"use client";

import React from "react";
import { useQueryState } from "nuqs";
import { parseAsString } from "nuqs";
import { Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FarmsView } from "./farms-view";
import { DelegatorsView } from "./delegators-view";
import { MinersView } from "./miners-view";

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
    parseAsString.withDefault("farms")
  );
  const [selectedFarmId, setSelectedFarmId] = useQueryState(
    "farmId",
    parseAsString.withDefault("")
  );

  const validType = ["delegator", "miner", "farms"].includes(type)
    ? (type as "delegator" | "miner" | "farms")
    : "farms";

  return (
    <div className="min-h-screen bg-background">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-20">
        <div className="flex flex-col gap-8">
          <header className="border border-border/60 bg-muted/20 rounded-2xl p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  Glow Mining Rewards
                </h1>
                <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                  {`Understand how ${
                    validType === "delegator"
                      ? "delegators"
                      : validType === "miner"
                      ? "miners"
                      : "farms"
                  } are deploying capital, earning GLW, and driving solar farm performance across the network.`}
                </p>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  Latest network activity
                </p>
              </div>
              <Badge variant="outline" className="w-fit">
                <Activity className="mr-1 h-3 w-3" /> Live feed
              </Badge>
            </div>
          </header>

          <div className="flex items-center justify-center">
            <Tabs
              value={validType}
              onValueChange={(value) =>
                setType(value as "delegator" | "miner" | "farms")
              }
            >
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="delegator">Delegators</TabsTrigger>
                <TabsTrigger value="miner">Miners</TabsTrigger>
                <TabsTrigger value="farms">Farms</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {validType === "farms" ? (
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
