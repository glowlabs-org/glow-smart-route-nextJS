"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRegions } from "@/hooks/useRegions";
import { useQueryState, parseAsString } from "nuqs";
import { toast } from "sonner";

interface BuybackActivityRow {
  id: string;
  regionCode: string;
  regionName: string;
  burnedCredits: number; // units
  usdgPaid: number; // USDG amount
  timestamp: number; // ms
}

function formatNumber(n: number, digits: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function useMockBalances(regionCode: string | null) {
  // Mocked balances derived from region code for stable demo values
  const seed = regionCode
    ? regionCode.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    : 1;
  const regionPot = 100_000 + (seed % 10_000);
  const unboundedSupply = 1_000_000 + (seed % 50_000);
  const certificates = 12_345 + (seed % 2_000);
  return { regionPot, unboundedSupply, certificates };
}

function useMockActivity(): BuybackActivityRow[] {
  // Stable mock rows
  return React.useMemo(
    () => [
      {
        id: "1",
        regionCode: "US-UT",
        regionName: "Utah",
        burnedCredits: 1250,
        usdgPaid: 6875,
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
      },
      {
        id: "2",
        regionCode: "US-CO",
        regionName: "Colorado",
        burnedCredits: 420,
        usdgPaid: 2205,
        timestamp: Date.now() - 1000 * 60 * 60 * 26,
      },
      {
        id: "3",
        regionCode: "US-MO",
        regionName: "Missouri",
        burnedCredits: 3000,
        usdgPaid: 15250,
        timestamp: Date.now() - 1000 * 60 * 60 * 80,
      },
    ],
    []
  );
}

export function ImpactBuybackView() {
  const { regions, isRegionsLoading } = useRegions();

  // URL state for active tab and region
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("buyback")
  );
  const [regionCode, setRegionCode] = useQueryState(
    "region",
    parseAsString.withDefault("")
  );

  const selectedRegion = React.useMemo(() => {
    return regions.find((r) => r.code === regionCode) ?? null;
  }, [regions, regionCode]);

  const { regionPot, unboundedSupply, certificates } = useMockBalances(
    selectedRegion?.code ?? null
  );

  const [creditsToBurn, setCreditsToBurn] = React.useState<string>("");
  const madeUSDG = React.useMemo(() => {
    const qty = Number(creditsToBurn || 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    // Mock price per credit: 5.5 USDG
    return qty * 5.5;
  }, [creditsToBurn]);

  const newBalanceAfterBurn = React.useMemo(() => {
    const qty = Number(creditsToBurn || 0);
    if (!Number.isFinite(qty) || qty <= 0) return certificates;
    return Math.max(0, certificates - qty);
  }, [certificates, creditsToBurn]);

  const onRedeem = async () => {
    try {
      const qty = Number(creditsToBurn || 0);
      if (!selectedRegion) {
        toast.error("Select a region first");
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error("Enter a valid credits amount to burn");
        return;
      }
      // Mock async
      await new Promise((r) => setTimeout(r, 600));
      toast.success(`Submitted buyback in ${selectedRegion.name}`);
      setCreditsToBurn("");
    } catch (err) {
      toast.error("Failed to submit buyback");
    }
  };

  const activity = useMockActivity();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Impact Buyback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pilot for Phase I – mock flows wired to live regions list.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v)}>
        <TabsList className="bg-muted/40">
          <TabsTrigger value="buyback">Buyback</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="buyback" className="mt-4">
          <Card className="rounded-3xl border border-border">
            <CardHeader className="border-b">
              <CardTitle>Buyback</CardTitle>
              <CardDescription>
                Burn impact credits for USDG. All values are mocked.
              </CardDescription>
            </CardHeader>
            <CardContent className="py-6 space-y-6">
              <div className="space-y-2">
                <div className="text-sm font-medium">Select a region</div>
                <Select
                  value={regionCode || undefined}
                  onValueChange={(v) => setRegionCode(v)}
                  disabled={isRegionsLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        isRegionsLoading ? "Loading…" : "Choose a region"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        <span>{r.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({r.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="rounded-xl">
                  <CardContent className="py-4">
                    <div className="text-xs text-muted-foreground">
                      Region Pot
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {formatNumber(regionPot, 0)} USDG
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="py-4">
                    <div className="text-xs text-muted-foreground">
                      Unbounded Supply
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {formatNumber(unboundedSupply, 0)} credits
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="py-4">
                    <div className="text-xs text-muted-foreground">
                      Certificates Balance
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {formatNumber(certificates, 0)} credits
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Credits to Burn</div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={creditsToBurn}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (Number(v) < 0) {
                      setCreditsToBurn("0");
                      return;
                    }
                    setCreditsToBurn(v);
                  }}
                  className="text-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="rounded-xl">
                  <CardContent className="py-4">
                    <div className="text-xs text-muted-foreground">
                      New balance after burn
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {formatNumber(newBalanceAfterBurn, 0)} credits
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-xl">
                  <CardContent className="py-4">
                    <div className="text-xs text-muted-foreground">$made</div>
                    <div className="text-lg font-bold tabular-nums">
                      {formatNumber(madeUSDG, 2)} USDG
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Button
                className="w-full h-12"
                onClick={onRedeem}
                disabled={!selectedRegion}
              >
                Redeem now
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="rounded-3xl border border-border">
            <CardHeader className="border-b">
              <CardTitle>Latest buybacks</CardTitle>
              <CardDescription>
                Mocked recent activity across regions
              </CardDescription>
            </CardHeader>
            <CardContent className="py-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Credits burned</TableHead>
                    <TableHead className="text-right">USDG paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {new Date(row.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{row.regionName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.burnedCredits, 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.usdgPaid, 2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ImpactBuybackView;
