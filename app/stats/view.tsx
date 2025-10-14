"use client";
import React from "react";
import {
  Clock,
  TrendingUp,
  Activity,
  Building,
  Coins,
  Zap,
  DollarSign,
  Sun,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { MarketTickers } from "./market-tickers";
import {
  ProtocolActivity,
  type ProtocolEventRowProps,
} from "./protocol-activity";
import { LifetimeFarms } from "./lifetime-farms";
import { EconomyOverview } from "./economy-overview";
import { RegionsStaking } from "./regions-staking";

export default function StatsView() {
  const [activeTab, setActiveTab] = React.useState("t0");
  const [lastUpdated, setLastUpdated] = React.useState(new Date());
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [shouldLoadRest, setShouldLoadRest] = React.useState(false);
  const [isDelegationDialogOpen, setIsDelegationDialogOpen] =
    React.useState(false);
  const [isMinerDialogOpen, setIsMinerDialogOpen] = React.useState(false);
  const [delegationEvents, setDelegationEvents] = React.useState<
    ProtocolEventRowProps[]
  >([]);
  const [minerEvents, setMinerEvents] = React.useState<ProtocolEventRowProps[]>(
    []
  );

  const sectionRefs = React.useMemo(
    () => ({
      t0: React.createRef<HTMLDivElement>(),
      t1: React.createRef<HTMLDivElement>(),
      t2: React.createRef<HTMLDivElement>(),
      t3: React.createRef<HTMLDivElement>(),
    }),
    []
  );

  // Only T0 (tickers) loads at first; once the user scrolls or navigates to another tab, load the rest

  const handleRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 1000);
  }, []);

  React.useEffect(() => {
    const interval = setInterval(handleRefresh, 30_000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id as keyof typeof sectionRefs;
          setActiveTab(id);
          // If any non-T0 section becomes visible, consider that a user scroll and load the rest
          if (id !== "t0") setShouldLoadRest(true);
        });
      },
      {
        // Trigger earlier to ensure data starts loading as the section nears the viewport
        threshold: 0.1,
        rootMargin: "0px 0px -25% 0px",
      }
    );

    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, [sectionRefs]);

  // First scroll loads the rest
  React.useEffect(() => {
    if (shouldLoadRest) return;
    const onScroll = () => {
      setShouldLoadRest(true);
      window.removeEventListener("scroll", onScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [shouldLoadRest]);

  const scrollToSection = (id: string) => {
    if (id !== "t0" && !shouldLoadRest) setShouldLoadRest(true);
    setActiveTab(id);
    const ref = sectionRefs[id as keyof typeof sectionRefs];
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden min-h-screen pt-20">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 relative z-10 min-h-screen">
          <div className="py-8 border-b border-border/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-4xl font-bold mb-2">Protocol Overview</h1>
                <p className="text-muted-foreground">
                  Real-time insights into Glow token markets, protocol activity,
                  regional staking, and economic health
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Clock
                    className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  <span>Last updated {lastUpdated.toLocaleTimeString()}</span>
                </button>
              </div>
            </div>
          </div>

          <div
            className="sticky top-20 z-40 bg-background border-b border-border/50 -mx-4 md:-mx-6 lg:-mx-12 px-4 md:px-6 lg:px-12"
            role="navigation"
            aria-label="Page sections"
          >
            <div className="flex items-center gap-2 overflow-x-auto py-3">
              {[
                { id: "t0", label: "Tickers", icon: TrendingUp },
                { id: "t1", label: "Activity", icon: Activity },
                { id: "t2", label: "Regions", icon: Sun },
                { id: "t3", label: "Economy", icon: Coins },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => scrollToSection(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                  aria-current={activeTab === tab.id ? "true" : undefined}
                  aria-label={`Navigate to ${tab.label}`}
                >
                  <tab.icon className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <section id="t0" ref={sectionRefs.t0} className="scroll-mt-36">
            <MarketTickers shouldLoad={true} />
          </section>

          <section id="t1" ref={sectionRefs.t1} className="py-12 scroll-mt-36">
            <ProtocolActivity
              shouldLoad={shouldLoadRest}
              onSeeAllDelegation={(events) => {
                setDelegationEvents(events);
                setIsDelegationDialogOpen(true);
              }}
              onSeeAllMiners={(events) => {
                setMinerEvents(events);
                setIsMinerDialogOpen(true);
              }}
            />
            <LifetimeFarms shouldLoad={shouldLoadRest} />
          </section>

          <section id="t2" ref={sectionRefs.t2} className="py-12 scroll-mt-36">
            <RegionsStaking shouldLoad={shouldLoadRest} />
          </section>

          <section
            id="t3"
            ref={sectionRefs.t3}
            className="py-12 pb-24 scroll-mt-36"
          >
            <EconomyOverview shouldLoad={shouldLoadRest} />
          </section>
        </div>
      </div>

      <Dialog
        open={isDelegationDialogOpen}
        onOpenChange={setIsDelegationDialogOpen}
      >
        <DialogContent className="md:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Delegation History</DialogTitle>
            <DialogDescription>
              All delegation and undelegation events across all farms
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-2">
              {delegationEvents.map((event) => (
                <div
                  key={event.id}
                  className="group flex items-start gap-3 p-4 bg-muted/30 rounded-xl hover:bg-muted transition-all border border-border/50 hover:border-border hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold mb-1.5">
                      {event.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">
                        {event.applicationId}
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMinerDialogOpen} onOpenChange={setIsMinerDialogOpen}>
        <DialogContent className="md:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Purchase History</DialogTitle>
            <DialogDescription>
              All miner purchases across the platform
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-2">
              {minerEvents.map((event) => (
                <div
                  key={event.id}
                  className="group flex items-start gap-3 p-4 bg-muted/30 rounded-xl hover:bg-muted transition-all border border-border/50 hover:border-border hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold mb-1.5">
                      {event.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">
                        {event.applicationId}
                      </span>
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
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
