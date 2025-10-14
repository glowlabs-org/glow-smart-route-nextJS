"use client";

import React from "react";
import Link from "next/link";

import { Activity, Building, DollarSign, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { InventoryItem } from "@/lib/fractions";
import { MiniCountdown } from "./mini-countdown";

export interface ProtocolEventRowProps {
  id: string;
  title: string;
  farmName: string;
  buyer: string;
  applicationId: string;
  token: string;
  totalValueFormatted: string;
  timestamp: string;
}

interface DelegationCardProps {
  totalGlwDelegated: number;
  summaryLoading: boolean;
  delegatorsCount: number;
  availableFarms: InventoryItem[];
  farmsCountdownDate: Date;
  delegationPreviewEvents: ProtocolEventRowProps[];
  isProtocolActivityLoading: boolean;
  hasDelegationPreview: boolean;
  shouldShowDelegationSeeAll: boolean;
  onSeeAllDelegation: () => void;
}

interface MinerCardProps {
  totalMinersSold: number;
  summaryLoading: boolean;
  buyersCount: number;
  availableMiners: InventoryItem[];
  minersCountdownDate: Date;
  minerPreviewEvents: ProtocolEventRowProps[];
  minerEvents: ProtocolEventRowProps[];
  hasMinerPreview: boolean;
  shouldShowMinerSeeAll: boolean;
  onSeeAllMiners: () => void;
}

interface ProtocolActivityProps {
  delegation: DelegationCardProps;
  miners: MinerCardProps;
  isProtocolActivityLoading?: boolean;
  skeletonCount?: number;
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <p className="mb-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function InventoryList({
  items,
  emptyLabel,
  countdownLabel,
  countdownDate,
  badgeColor,
}: {
  items: InventoryItem[];
  emptyLabel: string;
  countdownLabel: string;
  countdownDate: Date;
  badgeColor: "green" | "blue";
}) {
  if (items.length === 0) {
    return (
      <div className="mb-6 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center">
        <div className="mb-2 text-lg font-bold">SOLD OUT</div>
        <div className="mb-6 text-sm text-muted-foreground">
          {countdownLabel}
        </div>
        <MiniCountdown target={countdownDate} />
      </div>
    );
  }

  const accent = badgeColor === "green" ? "bg-green-500" : "bg-blue-500";

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${accent} animate-pulse`} />
        <div className="text-sm font-semibold">
          Available {emptyLabel} ({items.length})
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/?tab=${
              item.type === "launchpad" ? "launchpad" : "mining-center"
            }&fractionId=${item.id}`}
            className="block"
          >
            <div className="cursor-pointer rounded-xl border border-border bg-muted/50 p-4 transition-all hover:border-gray-300 hover:bg-muted dark:hover:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 text-sm font-semibold">
                    {item.applicationId}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="h-5">
                      {item.token}
                    </Badge>
                    <span>Remaining {item.remainingStepsFormatted}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {item.remainingValueFormatted}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Inventory value
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EventList({
  rows,
  empty,
}: {
  rows: ProtocolEventRowProps[];
  empty: React.ReactNode;
}) {
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {rows.map((event) => (
        <div
          key={event.id}
          className="group flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 transition-all hover:border-border hover:bg-muted hover:shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10">
            <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 text-sm font-semibold">{event.title}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {event.farmName}
              </span>
              <span>·</span>
              <Badge
                variant="secondary"
                className="h-5 px-2 text-xs font-medium"
              >
                {event.token}
              </Badge>
              <span>·</span>
              <span className="font-mono">{event.buyer}</span>
              <span>·</span>
              <span>{event.timestamp}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DelegationEmptyState() {
  return (
    <EmptyState
      icon={<Zap className="h-8 w-8 text-muted-foreground" />}
      title="No delegations yet"
      description="When delegations happen, they'll appear here. Start with an available farm above."
    />
  );
}

function MinerItem({ event }: { event: ProtocolEventRowProps }) {
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 transition-all hover:border-border hover:bg-muted hover:shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10">
        <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-sm font-semibold">{event.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{event.farmName}</span>
          <span>·</span>
          <span className="font-semibold text-green-600 dark:text-green-400">
            {event.totalValueFormatted}
          </span>
          <span>·</span>
          <span className="font-mono">{event.buyer}</span>
          <span>·</span>
          <span>{event.timestamp}</span>
        </div>
      </div>
    </div>
  );
}

function MinerEmptyState() {
  return (
    <EmptyState
      icon={<DollarSign className="h-8 w-8 text-muted-foreground" />}
      title="No purchases yet"
      description="Miner purchases will appear here."
    />
  );
}

export function ProtocolActivity({
  delegation,
  miners,
  isProtocolActivityLoading = false,
}: ProtocolActivityProps) {
  const {
    totalGlwDelegated,
    summaryLoading,
    delegatorsCount,
    availableFarms,
    farmsCountdownDate,
    delegationPreviewEvents,
    shouldShowDelegationSeeAll,
    onSeeAllDelegation,
  } = delegation;

  const {
    totalMinersSold,
    buyersCount,
    availableMiners,
    minersCountdownDate,
    minerPreviewEvents,
    hasMinerPreview,
    shouldShowMinerSeeAll,
    onSeeAllMiners,
  } = miners;

  return (
    <div className="py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Protocol Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time delegation and miner activity
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden pt-0">
          <CardHeader className="border-b border-border/50 bg-muted/30 pt-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Total GLW Delegated</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Community-backed solar farms
                </p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {delegatorsCount}
                {delegatorsCount === 1 ? " Delegator" : " Delegators"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6 text-4xl font-bold tracking-tight">
              {summaryLoading ? "--" : totalGlwDelegated.toLocaleString()}{" "}
              <span className="text-2xl text-muted-foreground">GLW</span>
            </div>

            <InventoryList
              items={availableFarms}
              emptyLabel="Farms"
              countdownLabel="All farm slots are filled. Next batch available soon."
              countdownDate={farmsCountdownDate}
              badgeColor="green"
            />

            <div className="space-y-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Delegation History</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Activity className="mr-1 h-3 w-3" />
                    Live
                  </Badge>
                  {shouldShowDelegationSeeAll ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={onSeeAllDelegation}
                    >
                      See All
                    </Button>
                  ) : null}
                </div>
              </div>
              <EventList
                rows={delegationPreviewEvents}
                empty={<DelegationEmptyState />}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden pt-0">
          <CardHeader className="border-b border-border/50 bg-muted/30 pt-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Total Miners Sold</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mining infrastructure investments
                </p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Building className="h-3 w-3" />
                {buyersCount}
                {buyersCount === 1 ? " Buyer" : " Buyers"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6 text-4xl font-bold tracking-tight">
              {summaryLoading ? "--" : `$${totalMinersSold.toLocaleString()}`}
            </div>

            <InventoryList
              items={availableMiners}
              emptyLabel="Miners"
              countdownLabel="All miners are sold. Next batch available soon."
              countdownDate={minersCountdownDate}
              badgeColor="blue"
            />

            <div className="space-y-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Purchase History</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Activity className="mr-1 h-3 w-3" />
                    Live
                  </Badge>
                  {shouldShowMinerSeeAll ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={onSeeAllMiners}
                    >
                      See All
                    </Button>
                  ) : null}
                </div>
              </div>
              {hasMinerPreview ? (
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {minerPreviewEvents.map((event) => (
                    <MinerItem key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <MinerEmptyState />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
