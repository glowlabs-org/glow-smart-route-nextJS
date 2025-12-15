"use client";

import React from "react";
import { HeaderHamburgerMenu } from "@/components/header";

import SolarFarmWidget from "./widgets/solar-farm-widget";
import NetWorthWidget from "./widgets/net-worth";
import RankWidget from "./widgets/rank-widget";
import RewardsWidget from "./widgets/rewards-widget";
import WeeklyActivityWidget from "./widgets/weekly-activity-widget";
import GctlHeatmapWidget from "./widgets/gctl-heatmap-widget";
import QuickActionsWidget from "./widgets/quick-actions-widget";
import RecentActivityWidget from "./widgets/recent-activity-widget";
import { GlowSymbol } from "@/components/glow-symbol";

export default function GlowSoftDashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 selection:bg-[color:var(--color-glow-yellow)] selection:text-foreground">
      {/* Header */}
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-background">
            <GlowSymbol className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight">
              Power Wallet
            </span>
            <span className="text-xs text-muted-foreground">
              Your all-in-one wallet for Glow
            </span>
          </div>
        </div>

        <HeaderHamburgerMenu triggerClassName="h-12 w-12 rounded-full p-0 flex items-center justify-center" />
      </div>

      <div className="max-w-screen-2xl mx-auto space-y-4">
        {/* Row 1: Assets & Score */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6">
            <NetWorthWidget />
          </div>
          <div className="col-span-12 lg:col-span-3">
            <RankWidget />
          </div>
          <div className="col-span-12 lg:col-span-3 h-[340px]">
            <RewardsWidget />
          </div>
        </div>

        {/* Row 2: Performance & Actions */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-7">
            <SolarFarmWidget />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <QuickActionsWidget />
          </div>
        </div>

        {/* Row 3: Deep Dive */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5">
            <GctlHeatmapWidget />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <RecentActivityWidget />
          </div>
          <div className="col-span-12 lg:col-span-3">
            <WeeklyActivityWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
