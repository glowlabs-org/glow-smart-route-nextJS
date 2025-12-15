"use client";

import React from "react";
import { Share2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type WeekStatus = "missed" | "delegated" | "miner" | "both";

function getWeekStyle(status: WeekStatus) {
  if (status === "delegated")
    return "bg-purple-200 dark:bg-[color:var(--color-glow-purple)]";
  if (status === "miner")
    return "bg-amber-200 dark:bg-[color:var(--color-glow-yellow)]";
  if (status === "both")
    return "bg-emerald-200 dark:bg-[color:var(--color-glow-green)]";
  return "bg-muted";
}

export default function WeeklyActivityWidget() {
  const weeksCount = 24;
  const weeks = Array.from({ length: weeksCount }, (_, i) => {
    const r = Math.random();
    let status: WeekStatus = "missed";

    if (r > 0.3) status = "delegated";
    if (r > 0.7) status = "miner";
    if (r > 0.9) status = "both";

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (weeksCount - 1 - i) * 7);

    return { id: i + 1, status, weekStart };
  });

  const activeWeeks = weeks.filter((w) => w.status !== "missed").length;
  const tweetText = `🔥 My Glow weekly streak: ${activeWeeks}/${weeksCount} weeks`;
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText
  )}`;

  return (
    <Card className="col-span-12 lg:col-span-3 overflow-hidden">
      <CardHeader className="pb-0">
        <CardTitle>Weekly Streak</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col h-full min-h-0">
          <div className="flex flex-col items-center justify-center text-center mb-4">
            <div className="font-mono text-5xl font-bold tracking-tight text-foreground leading-none">
              {activeWeeks}
              <span className="ml-2 text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider align-middle">
                Wks
              </span>
            </div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              Last {weeksCount} Weeks
            </div>
          </div>

          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-8 grid-rows-3 gap-2">
              {weeks.map((week) => {
                const label = week.weekStart.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <Tooltip key={week.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-[4px] border border-border/60",
                          "hover:ring-2 hover:ring-foreground/10 hover:ring-offset-2 hover:ring-offset-background",
                          getWeekStyle(week.status)
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" sideOffset={10}>
                      <div className="font-mono text-[10px]">
                        {label}: {week.status}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>

          <div className="mt-auto pt-4 space-y-4">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono uppercase">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-200 dark:bg-[color:var(--color-glow-yellow)] border border-border/40" />
                  <span>Miner</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-200 dark:bg-[color:var(--color-glow-purple)] border border-border/40" />
                  <span>Delegator</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-200 dark:bg-[color:var(--color-glow-green)] border border-border/40" />
                  <span>Both</span>
                </div>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full rounded-xl">
              <a
                href={tweetHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share on X
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
