"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Cpu, Zap, LayoutGrid, Sun } from "lucide-react";

// --- Shadcn UI Components ---
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

import { FarmsPerformanceDialogContent } from "./farms-performance-dialog";

// --- MOCK DATA ---

// Chart Data (Aggregated)
const HISTORY_DATA = Array.from({ length: 10 }, (_, i) => {
  const weekNum = 33 + i;
  const minerReward = 600 + Math.floor(Math.random() * 50);
  const delegationReward = 300 + Math.floor(Math.random() * 150);
  return {
    week: `Wk ${weekNum}`,
    minerReward,
    delegationReward,
    total: minerReward + delegationReward,
  };
});
const CURRENT_WEEK_DATA = HISTORY_DATA[HISTORY_DATA.length - 1];
const CHART_STATS = {
  activeMiners: 4,
  activeFarms: 3,
  weeklyPayout: CURRENT_WEEK_DATA.total,
  trend: "+2.4%",
};

// --- SUB-COMPONENTS ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const minerVal = payload[0].value;
    const delVal = payload[1].value;
    const total = minerVal + delVal;
    return (
      <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl shadow-xl min-w-[160px]">
        <p className="text-zinc-400 text-[10px] font-mono uppercase mb-2">
          {label}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-300 font-mono">Miners</span>
            </div>
            <span className="text-xs font-bold text-white font-mono">
              {minerVal}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#C084FC]" />
              <span className="text-xs text-zinc-300 font-mono">
                Delegation
              </span>
            </div>
            <span className="text-xs font-bold text-white font-mono">
              {delVal}
            </span>
          </div>
          <div className="h-px bg-zinc-800 my-1" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-mono uppercase">
              Total
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {total} GLW
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// --- MAIN COMPONENT ---

export default function SolarFarmWidget() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      {/* --- DASHBOARD CARD --- */}
      <Card className="h-full max-h-[400px] flex flex-col overflow-hidden bg-[#09090b] border-zinc-800 shadow-2xl shadow-black/50">
        <CardHeader className="pb-2 border-b border-zinc-800/50 bg-zinc-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="tracking-tight text-sm font-bold text-white uppercase font-mono">
                Reward Flow
              </CardTitle>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-mono">
                Last 10 Weeks
              </span>
            </div>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1"
              >
                <LayoutGrid className="w-3 h-3" />
                View Details
              </Button>
            </DialogTrigger>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-6 flex flex-col gap-6">
          {/* Dashboard Stats */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase text-zinc-500 font-mono tracking-wider">
                Current Weekly Payout
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Sun className="w-5 h-5 text-orange-400 fill-orange-400/20" />
                  <span className="text-3xl font-bold text-white tracking-tight font-mono">
                    {CHART_STATS.weeklyPayout.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-zinc-500 font-mono">
                    GLW
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                  {CHART_STATS.trend}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-zinc-900/50 px-4 py-2 rounded-xl border border-zinc-800">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-white font-mono">
                    {CHART_STATS.activeMiners}
                  </span>
                  <Cpu className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-[9px] uppercase text-zinc-500 font-mono tracking-wider">
                  Miners
                </span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-white font-mono">
                    {CHART_STATS.activeFarms}
                  </span>
                  <Zap className="w-4 h-4 text-[#C084FC]" />
                </div>
                <span className="text-[9px] uppercase text-zinc-500 font-mono tracking-wider">
                  Delegations
                </span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 w-full min-h-[160px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HISTORY_DATA} barSize={24}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#27272a"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#71717a",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                  dy={10}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#27272a", opacity: 0.4 }}
                />
                <Bar
                  dataKey="minerReward"
                  stackId="a"
                  fill="#10B981"
                  radius={[0, 0, 4, 4]}
                  animationDuration={1500}
                />
                <Bar
                  dataKey="delegationReward"
                  stackId="a"
                  fill="#A855F7"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <FarmsPerformanceDialogContent />
    </Dialog>
  );
}
