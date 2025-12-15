"use client";

import React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RankWidget() {
  return (
    <Card className="h-[340px] overflow-hidden flex flex-col">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle>Global Rank</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 gap-4 pt-0">
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center px-1">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Impact Score
          </div>
          <div className="mt-2 font-mono text-5xl md:text-6xl font-bold tracking-tighter text-foreground tabular-nums">
            {new Intl.NumberFormat().format(14203)}
          </div>

          <div className="mt-3 font-mono text-xs text-muted-foreground">
            Top 1% of Steerers
          </div>
          <Badge
            variant="outline"
            className="mt-2 font-mono text-[10px] font-bold rounded-full bg-[color:var(--color-glow-purple)]/10 border-[color:var(--color-glow-purple)]/30 text-[color:var(--color-glow-purple)]"
          >
            SOLAR WHALE
          </Badge>
        </div>

        <Button
          asChild
          variant="outline"
          className="w-full h-12 rounded-2xl font-mono font-bold text-base shrink-0"
        >
          <Link href="/stats">See leaderboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
