"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowDownUp,
  Info,
  Send,
  Plus,
  Minus,
  ChevronRight,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RestakeAssistant } from "@/app/wallet/restake-assistant";
import { UnstakeDialog } from "@/app/wallet/unstake-dialog";
import { ClaimsPanel } from "@/app/wallet/claims-panel";
import { RecentActivity } from "@/app/wallet/recent-activity";
import { ScenarioType, getScenarioData } from "@/app/wallet/mock-scenarios";
import { Progress } from "@/components/ui/progress";

export default function View() {
  const [selectedScenario, setSelectedScenario] =
    useState<ScenarioType>("full");
  const scenarioData = getScenarioData(selectedScenario);

  const {
    balances,
    claimable,
    impactCertificates,
    regionYields,
    purchasedFarms,
    recentActivity,
  } = scenarioData;
  const [activeTab, setActiveTab] = useState<"swap" | "send">("swap");
  const [swapFrom, setSwapFrom] = useState("USDC");
  const [swapTo, setSwapTo] = useState("GLOW");
  const [swapAmount, setSwapAmount] = useState("");
  const [sendAsset, setSendAsset] = useState("USDC");
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [autoRestake, setAutoRestake] = useState(true);
  const [isRestakeOpen, setIsRestakeOpen] = useState(false);
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isUnstakeOpen, setIsUnstakeOpen] = useState(false);

  // Progressive disclosure helpers
  function parseAmountString(value: string): number {
    try {
      return parseFloat(value.replace(/,/g, "")) || 0;
    } catch {
      return 0;
    }
  }

  const hasUsdc = parseAmountString(balances.usdc) > 0;
  const hasUsdg = parseAmountString(balances.usdg) > 0;
  const hasGlow = parseAmountString(balances.glow) > 0;
  const hasGctl =
    parseAmountString(balances.gctl) > 0 ||
    parseAmountString(balances.gctlStaked) > 0 ||
    parseAmountString(balances.gctlUnstaking) > 0;

  const hasUnstaking = parseAmountString(balances.gctlUnstaking) > 0;
  const impactRegions = Object.entries(impactCertificates)
    .filter(([, amount]) => (amount as number) > 0)
    .map(([region]) => `Impact (${region})`);

  // Impact certificates breakdown helpers
  const impactEntries = Object.entries(impactCertificates).filter(
    ([, amount]) => Number(amount) > 0
  );
  const totalImpact = impactEntries.reduce(
    (sum, [, amt]) => sum + Number(amt),
    0
  );

  const baseTokenOptions = (() => {
    const options = new Set<string>();
    if (hasUsdc) {
      ["USDG", "GLOW", "GCTL"].forEach((t) => options.add(t));
    }
    if (hasUsdg) {
      ["USDC", "GLOW", "GCTL"].forEach((t) => options.add(t));
    }

    return Array.from(options);
  })();

  // From: always include USDC as default; also include assets the user holds (GCTL excluded)
  const fromOptions = Array.from(
    new Set([
      "USDC",
      ...(hasUsdg ? ["USDG"] : []),
      ...(hasGlow ? ["GLOW"] : []),
      ...(hasUsdc ? ["USDC"] : []),
    ])
  );

  function isImpactAsset(symbol: string): boolean {
    return symbol.startsWith("Impact (");
  }

  // To options are constrained by protocol rules
  const toOptions = (() => {
    switch (swapFrom) {
      case "GLOW":
        return ["USDC", "USDG"]; // GLW is tradable only to USDC or USDG
      case "USDC":
        return ["USDG", "GLOW", "GCTL"]; // USDC → USDG/GLW or mint GCTL
      case "USDG":
        return ["USDC", "GLOW", "GCTL"]; // USDG → USDC/GLW or mint GCTL
      default:
        // For any other source (e.g., Impact via special flows), fall back to core tokens
        return ["USDC", "USDG", "GLOW"];
    }
  })();

  // Ensure currently selected assets remain valid across scenarios
  React.useEffect(() => {
    if (fromOptions.length > 0 && !fromOptions.includes(swapFrom)) {
      setSwapFrom(fromOptions[0]);
    }
    if (toOptions.length > 0 && !toOptions.includes(swapTo)) {
      setSwapTo(toOptions[0]);
    }
    if (baseTokenOptions.length > 0 && !baseTokenOptions.includes(sendAsset)) {
      setSendAsset(baseTokenOptions[0]);
    }
  }, [selectedScenario, balances, impactCertificates]);

  // Mock functions
  const handleSwap = () => {
    if (!swapAmount) {
      toast.error("Please enter an amount");
      return;
    }
    if (swapTo === "GCTL") {
      toast.success("Minting GCTL (mock)", {
        description: `${swapFrom} → GCTL prepared`,
      });
    } else {
      toast.success(`Swapping ${swapAmount} ${swapFrom} to ${swapTo}`, {
        description: "Transaction submitted successfully",
      });
    }
    setSwapAmount("");
  };

  const handleSend = () => {
    if (!sendAmount || !sendTo) {
      toast.error("Please fill all fields");
      return;
    }
    toast.success(`Sending ${sendAmount} ${sendAsset}`, {
      description: `To: ${sendTo.slice(0, 6)}...${sendTo.slice(-4)}`,
    });
    setSendAmount("");
    setSendTo("");
  };

  const handleClaim = (token: string) => {
    toast.success(`Claiming ${token}`, {
      description: "Your tokens will be available shortly",
    });
  };

  const handleClaimAll = () => {
    toast.success("Claiming all available tokens", {
      description: "Multiple transactions initiated",
    });
  };

  const handleSwapUsdgToUsdc = () => {
    try {
      if (!hasUsdg) {
        toast.info("No USDG available to swap");
        return;
      }
      setActiveTab("swap");
      setSwapFrom("USDG");
      setSwapTo("USDC");
      setSwapAmount(parseAmountString(balances.usdg).toString());
      toast.success("Prepared USDG → USDC swap (1:1)");
    } catch (error: any) {
      toast.error(error?.message || "Failed to prepare swap");
    }
  };

  function prepareSwap(from: string, to: string, amount: string) {
    try {
      setActiveTab("swap");
      setSwapFrom(from);
      setSwapTo(to);
      setSwapAmount(amount);
      toast.success(`Prepared ${from} → ${to} swap`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to prepare swap");
    }
  }

  const handleSwapUsdcToUsdg = () => {
    if (!hasUsdc) {
      toast.info("No USDC available to swap");
      return;
    }
    prepareSwap("USDC", "USDG", parseAmountString(balances.usdc).toString());
  };

  const handleSwapGlowToUsdc = () => {
    if (!hasGlow) {
      toast.info("No GLOW available to swap");
      return;
    }
    prepareSwap("GLOW", "USDC", parseAmountString(balances.glow).toString());
  };

  const getRoutePreview = () => {
    if (swapTo === "GCTL" && swapFrom === "USDG") return "USDG → GCTL (mint)";
    if (swapTo === "GCTL" && swapFrom === "USDC")
      return "USDC → USDG → GCTL (mint)";
    if (swapFrom === "GLOW" && swapTo === "USDC") return "GLOW → USDG → USDC";
    if (swapFrom === "USDG" && swapTo === "GLOW") return "USDG → GLOW";
    if (swapFrom === "USDC" && swapTo === "GLOW") return "USDC → USDG → GLOW";
    if (swapFrom.includes("Impact") && swapTo === "GLOW")
      return `${swapFrom} Burn → USDC → GLOW`;
    if (swapFrom.includes("Impact") && swapTo === "USDG")
      return `${swapFrom} Burn → USDC → USDG`;
    return `${swapFrom} → ${swapTo}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-8">
        {/* Page Header with Scenario Selector */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Power Wallet</h1>
            <p className="text-muted-foreground mt-2">
              Your balances, staking, swaps, claims, and recent activity across
              Glow
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Shuffle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Test Scenario</span>
            </div>
            <Select
              value={selectedScenario}
              onValueChange={(value) =>
                setSelectedScenario(value as ScenarioType)
              }
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">
                  Full Dashboard (All Features)
                </SelectItem>
                <SelectItem value="glow-only">GLOW Holder Only</SelectItem>
                <SelectItem value="usdc-only">USDC Holder Only</SelectItem>
                <SelectItem value="glow-and-usdc">
                  GLOW & USDC Holder
                </SelectItem>
                <SelectItem value="gctl-staker">Active GCTL Staker</SelectItem>
                <SelectItem value="new-user">New User (Empty)</SelectItem>
                <SelectItem value="no-activity">No Recent Activity</SelectItem>
                <SelectItem value="no-farms">No Purchased Farms</SelectItem>

                <SelectItem value="impact-holder">
                  Impact Certificate Holder
                </SelectItem>
                <SelectItem value="unstaking-user">
                  Unstaking in Progress
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              For UX Workshop Testing
            </p>
          </div>
        </div>

        {/* A. Balances & Claims Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* USDC Card */}

          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">USDC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${balances.usdc}</div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toast.info("Send modal would open")}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Send
                </Button>
                {hasUsdc && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSwapUsdcToUsdg}
                  >
                    Convert to USDG
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* USDG Card */}
          {(hasUsdg || claimable.usdg !== "0") && (
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">USDG</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${balances.usdg}</div>
                {claimable.usdg !== "0" && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground">
                      Claimable: ${claimable.usdg}
                    </div>
                    <div className="flex items-center gap-2 mt-2    s">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClaim("USDG")}
                      >
                        Claim
                      </Button>
                      {hasUsdg && (
                        <div className="">
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleSwapUsdgToUsdc}>
                              Swap for USDC
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* GLOW Card */}
          {(hasGlow || claimable.glow !== "0") && (
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">GLOW</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{balances.glow}</div>
                {claimable.glow !== "0" && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground">
                      Claimable: {claimable.glow}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleClaim("GLOW")}
                    >
                      Claim
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* GCTL Card */}
          {hasGctl && (
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">GCTL</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      Wallet
                    </span>
                    <span className="font-semibold">{balances.gctl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      Staked
                    </span>
                    <span className="font-semibold text-green-600">
                      {balances.gctlStaked}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      Unstaking
                    </span>
                    <span className="font-semibold text-orange-600">
                      {balances.gctlUnstaking}
                    </span>
                  </div>
                  <div className="pt-2 text-xs text-muted-foreground">
                    Non-transferable during Phase I
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Impact Certificates Card */}
          {(impactRegions.length > 0 || claimable.impactVested !== "0") && (
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Impact Certificates</CardTitle>
              </CardHeader>
              <CardContent>
                {totalImpact > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-bold">
                        {totalImpact.toLocaleString()} credits
                      </div>
                      {claimable.impactVested !== "0" && (
                        <div className="text-xs text-muted-foreground">
                          Vested: {claimable.impactVested}
                        </div>
                      )}
                    </div>
                    {/* Segmented progress bar */}
                    <div className="w-full h-3 rounded-full bg-muted/50 overflow-hidden flex">
                      {impactEntries.map(([region, amt], idx) => {
                        const pct = (Number(amt) / totalImpact) * 100;
                        const isLast = idx === impactEntries.length - 1;
                        return (
                          <div
                            key={region}
                            style={{
                              width: `${pct}%`,
                              backgroundColor: "#000000",
                              borderRight: isLast
                                ? "none"
                                : "1px solid rgba(255,255,255,0.4)",
                            }}
                            className="h-full"
                            title={`${region}: ${amt}`}
                          />
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {impactEntries.map(([region, amt], idx) => (
                        <div
                          key={region}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className="inline-block w-3 h-3 rounded-sm"
                            style={{
                              backgroundColor: "#000000",
                            }}
                          />
                          <span className="text-muted-foreground">
                            {region}
                          </span>
                          <span className="ml-auto font-medium">
                            {Number(amt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mb-2">
                    No impact certificates yet.
                  </div>
                )}
                {claimable.impactVested !== "0" && (
                  <div className="text-xs text-muted-foreground">
                    Vested: {claimable.impactVested}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* B. Swap & Send */}
        <Card className="mb-8 max-w-screen-md mx-auto">
          <CardHeader>
            <CardTitle>Swap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* From */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={swapFrom} onValueChange={setSwapFrom}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fromOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Swap Icon */}
              <div className="flex justify-center">
                <div className="bg-background border-4 border-border rounded-full p-2">
                  <ArrowDownUp className="w-4 h-4" />
                </div>
              </div>

              {/* To */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    readOnly
                    value={
                      swapAmount
                        ? (parseFloat(swapAmount) * 0.82).toFixed(2)
                        : ""
                    }
                    className="flex-1"
                  />
                  <Select value={swapTo} onValueChange={setSwapTo}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {toOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Route Preview */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Route Preview</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {getRoutePreview()}
                </div>
              </div>

              <Button className="w-full" onClick={handleSwap}>
                Swap Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* C. GCTL Staking */}
        {(balances.gctl !== "0" || balances.gctlStaked !== "0") && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>GCTL Staking</CardTitle>
              <CardDescription>
                Manage your staked GCTL across regions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Snapshot Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Total GCTL
                  </div>
                  <div className="text-2xl font-bold">
                    {(
                      parseFloat(balances.gctl.replace(/,/g, "")) +
                      parseFloat(balances.gctlStaked.replace(/,/g, "")) +
                      parseFloat(balances.gctlUnstaking.replace(/,/g, ""))
                    ).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Staked</div>
                  <div className="text-2xl font-bold text-green-600">
                    {balances.gctlStaked}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Unstaking</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {balances.gctlUnstaking}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Wallet</div>
                    <div className="font-semibold">{balances.gctl}</div>
                  </div>
                  {hasUnstaking && (
                    <Badge variant="secondary">Dripping 1%/wk</Badge>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsUnstakeOpen(true)}
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Unstake
                </Button>
                <Button onClick={() => setIsRestakeOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Restake
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setIsRestakeOpen(true)}
                  className="ml-auto"
                >
                  Manage by Region
                </Button>
              </div>
              {hasUnstaking && (
                <div className="text-xs text-muted-foreground mt-3">
                  An active unstake is in progress. New schedules will drip 1%
                  weekly.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* D. Claims Panel */}
        <ClaimsPanel
          claimable={claimable}
          onClaim={handleClaim}
          onClaimAll={handleClaimAll}
        />

        {/* E. Purchased Farms */}
        {purchasedFarms.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Purchased Farms</CardTitle>
              <CardDescription>
                Farms where you've paid participation dividends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {purchasedFarms.map((farm, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{farm.farm}</div>
                      <div className="text-sm text-muted-foreground">
                        {farm.region} • {farm.split} GLW split
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {farm.weeklyGlow} GLOW/week
                      </div>
                      <div className="text-sm text-muted-foreground">
                        + {farm.otherRewardsAmount} {farm.otherRewards}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast.info("Opening marketplace")}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* F. Recent Activity */}
        <RecentActivity activities={recentActivity} />
      </div>

      {/* Restake Assistant Modal */}
      <RestakeAssistant
        isOpen={isRestakeOpen}
        onClose={() => setIsRestakeOpen(false)}
        regionYields={regionYields}
      />
      <UnstakeDialog
        isOpen={isUnstakeOpen}
        onClose={() => setIsUnstakeOpen(false)}
        regionYields={regionYields}
        gctlUnstaking={balances.gctlUnstaking}
      />
    </div>
  );
}
