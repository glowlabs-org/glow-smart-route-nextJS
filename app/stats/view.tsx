"use client";
import React from "react";
import { Zap, DollarSign, Sparkles, Activity } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { MarketTickers } from "./market-tickers";
import {
  ProtocolActivity,
  type ProtocolEventRowProps,
} from "./protocol-activity";
import { LifetimeFarms } from "./lifetime-farms";
import { EconomyOverview } from "./economy-overview";
import { RegionsStaking } from "./regions-staking";
import { MintedEventsTab } from "@/components/buy-gctl/minted-events-tab";
import { StakedEventsTab } from "@/components/buy-gctl/staked-events-tab";
import { useGctlApi, useRegions, useFractionsSummary } from "@/hooks";
import { parseFractionsSummary } from "@/lib/fractions";
import { useLang } from "@/lib/i18n";

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
      {title}
    </h2>
  );
}

export default function StatsView() {
  const { t } = useLang();
  const s = t.routes.stats;
  const [isDelegationDialogOpen, setIsDelegationDialogOpen] =
    React.useState(false);
  const [isMinerDialogOpen, setIsMinerDialogOpen] = React.useState(false);
  const [isMintedDialogOpen, setIsMintedDialogOpen] = React.useState(false);
  const [isStakedDialogOpen, setIsStakedDialogOpen] = React.useState(false);
  const [delegationEvents, setDelegationEvents] = React.useState<
    ProtocolEventRowProps[]
  >([]);
  const [minerEvents, setMinerEvents] = React.useState<ProtocolEventRowProps[]>(
    [],
  );
  const [mintedEvents, setMintedEvents] = React.useState<any[]>([]);
  const [stakedEvents, setStakedEvents] = React.useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);

  const { fetchMintedEvents, fetchStakedEvents } = useGctlApi();
  const { regions, isRegionsLoading } = useRegions();
  const {
    summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
  } = useFractionsSummary({ enabled: true });

  const { totalDelegatedGlw } = React.useMemo(
    () => parseFractionsSummary(summary),
    [summary],
  );

  const loadEvents = React.useCallback(async () => {
    setEventsLoading(true);
    try {
      const [mintedResult, stakedResult] = await Promise.all([
        fetchMintedEvents(),
        fetchStakedEvents({ limit: 100 }),
      ]);

      if (mintedResult.ok) {
        setMintedEvents(mintedResult.val);
      }
      if (stakedResult.ok) {
        setStakedEvents(stakedResult.val);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setEventsLoading(false);
    }
  }, [fetchMintedEvents, fetchStakedEvents]);

  React.useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-screen-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-8">
            <SectionHeader title={s.marketTickers2} />
            <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-4 sm:p-6 lg:p-12">
              <MarketTickers shouldLoad={true} />
            </div>
          </section>

          <section className="flex flex-col gap-8 pt-20">
            <SectionHeader title={s.economyOverview} />
            <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-4 sm:p-6 lg:p-12">
              <EconomyOverview shouldLoad={true} />
            </div>
          </section>

          <section className="flex flex-col gap-8 pt-20">
            <SectionHeader title={s.protocolActivity2} />
            <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-4 sm:p-6 lg:p-12">
              <ProtocolActivity
                shouldLoad={true}
                onSeeAllDelegation={(events) => {
                  setDelegationEvents(events);
                  setIsDelegationDialogOpen(true);
                }}
                onSeeAllMiners={(events) => {
                  setMinerEvents(events);
                  setIsMinerDialogOpen(true);
                }}
              />
            </div>
            <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-4 sm:p-6 lg:p-12">
              <LifetimeFarms
                shouldLoad={true}
                totalGlwDelegated={totalDelegatedGlw}
                isGlwDataLoading={summaryLoading || summaryFetching}
                withChart
              />
            </div>
          </section>

          <section className="flex flex-col gap-8 pt-20">
            <SectionHeader title={s.gctlStakingByRegion} />
            <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-4 sm:p-6 lg:p-12">
              <RegionsStaking shouldLoad={true} />
            </div>
          </section>

          <section className="flex flex-col gap-8 pt-20 pb-20">
            <SectionHeader title={s.protocolEvents} />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* GCTL Minting Card */}
              <Card className="overflow-hidden bg-card border-border/20 dark:border-border/40 !py-0 !gap-0">
                <CardHeader className="border-b border-border/20 dark:border-border/40 !py-6 !px-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {s.gctlMinting}
                      </h3>
                      <p className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                        {s.tokenCreationEvents}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="gap-1.5 text-xs font-mono font-semibold"
                    >
                      <Sparkles className="h-3 w-3" />
                      {mintedEvents.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="!p-8">
                  <div className="space-y-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                        {s.recentActivity}
                      </span>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono uppercase tracking-widest border-border/30 text-muted-foreground/60"
                        >
                          <Activity className="mr-1 h-3 w-3" />
                          {s.live}
                        </Badge>
                        {mintedEvents.length > 10 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => setIsMintedDialogOpen(true)}
                          >
                            {s.seeAll}
                          </Button>
                        )}
                      </div>
                    </div>
                    <MintedEventsTab
                      mintedEvents={mintedEvents}
                      dataLoading={eventsLoading}
                      maxItems={10}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* GCTL Staking Card */}
              <Card className="overflow-hidden bg-card border-border/20 dark:border-border/40 !py-0 !gap-0">
                <CardHeader className="border-b border-border/20 dark:border-border/40 !py-6 !px-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {s.gctlStaking}
                      </h3>
                      <p className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                        {s.stakeUnstakeEvents}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="gap-1.5 text-xs font-mono font-semibold"
                    >
                      <Zap className="h-3 w-3" />
                      {stakedEvents.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="!p-8">
                  <div className="space-y-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                        {s.recentActivity}
                      </span>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono uppercase tracking-widest border-border/30 text-muted-foreground/60"
                        >
                          <Activity className="mr-1 h-3 w-3" />
                          {s.live}
                        </Badge>
                        {stakedEvents.length > 10 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => setIsStakedDialogOpen(true)}
                          >
                            {s.seeAll}
                          </Button>
                        )}
                      </div>
                    </div>
                    <StakedEventsTab
                      stakedEvents={stakedEvents}
                      dataLoading={eventsLoading}
                      regions={regions}
                      isRegionsLoading={isRegionsLoading}
                      maxItems={10}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>

      <Dialog
        open={isDelegationDialogOpen}
        onOpenChange={setIsDelegationDialogOpen}
      >
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 max-h-[80vh] flex flex-col">
          <div className="border-b border-border/20 dark:border-border/40 pb-6 pt-8 px-6">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold text-foreground">
                {s.delegationHistory}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/60 mt-1">
                {s.delegationHistoryDesc}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-2">
              {delegationEvents.map((event) => (
                <div
                  key={event.id}
                  className="group flex items-center gap-3 px-4 py-3 bg-muted/30 dark:bg-muted/50 rounded-xl hover:bg-muted/50 dark:hover:bg-muted/60 transition-colors border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60"
                >
                  <div className="w-9 h-9 rounded-lg bg-delegation-purple/10 border border-delegation-purple/20 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-delegation-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {event.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 truncate">
                      <span>{event.farmName}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="font-mono">{event.buyer}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span>{event.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMinerDialogOpen} onOpenChange={setIsMinerDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 max-h-[80vh] flex flex-col">
          <div className="border-b border-border/20 dark:border-border/40 pb-6 pt-8 px-6">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold text-foreground">
                {s.minersHistory}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/60 mt-1">
                {s.minersHistoryDesc}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-2">
              {minerEvents.map((event) => (
                <div
                  key={event.id}
                  className="group flex items-center gap-3 px-4 py-3 bg-muted/30 dark:bg-muted/50 rounded-xl hover:bg-muted/50 dark:hover:bg-muted/60 transition-colors border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60"
                >
                  <div className="w-9 h-9 rounded-lg bg-[color:var(--color-miner)]/10 border border-[color:var(--color-miner)]/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4 text-[color:var(--color-miner)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {event.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 truncate">
                      <span>{event.farmName}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {event.totalValueFormatted}
                      </span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="font-mono">{event.buyer}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span>{event.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Minted Events Dialog */}
      <Dialog open={isMintedDialogOpen} onOpenChange={setIsMintedDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 max-h-[80vh] flex flex-col">
          <div className="border-b border-border/20 dark:border-border/40 pb-6 pt-8 px-6">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold text-foreground">
                {s.mintedHistory}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/60 mt-1">
                {s.mintedHistoryDesc}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <MintedEventsTab
              mintedEvents={mintedEvents}
              dataLoading={eventsLoading}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Staked Events Dialog */}
      <Dialog open={isStakedDialogOpen} onOpenChange={setIsStakedDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 max-h-[80vh] flex flex-col">
          <div className="border-b border-border/20 dark:border-border/40 pb-6 pt-8 px-6">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold text-foreground">
                {s.stakedHistory}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/60 mt-1">
                {s.stakedHistoryDesc}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <StakedEventsTab
              stakedEvents={stakedEvents}
              dataLoading={eventsLoading}
              regions={regions}
              isRegionsLoading={isRegionsLoading}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
