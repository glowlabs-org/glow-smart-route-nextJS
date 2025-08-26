"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { formatNumber } from "./utils";
import { getDisplayDecimals } from "@/lib/currency";
import {
  farmsForSale,
  regions,
  paymentCurrencies,
  REWARD_RATING_MAX,
  PaymentCurrency,
  FarmForSale,
} from "./mock-farms";
import { DepositDialog } from "./deposit-dialog";
import { ListFarmDialog } from "./list-farm-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { soldFarmsActivity } from "./mock-farms";

export default function MiningMarketplacePage() {
  const [regionParam, setRegionParam] = useQueryState("region");
  const [currencyParam, setCurrencyParam] = useQueryState("currency", {
    defaultValue: "GLW",
  });
  const [sortParam, setSortParam] = useQueryState("sort", {
    defaultValue: "rating-desc",
  });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedFarmForDeposit, setSelectedFarmForDeposit] =
    React.useState<FarmForSale | null>(null);
  const [listDialogOpen, setListDialogOpen] = React.useState(false);

  const selectedRegion = regionParam || "All";
  const selectedCurrency = currencyParam || "GLW";
  const selectedSort = sortParam || "rating-desc";

  const filtered = farmsForSale.filter((farm) =>
    selectedRegion === "All" ? true : farm.region === selectedRegion
  );

  const sorted = React.useMemo(() => {
    const base = [...filtered];
    if (selectedSort === "rating-asc") {
      base.sort((a, b) => a.rewardRating - b.rewardRating);
    } else {
      base.sort((a, b) => b.rewardRating - a.rewardRating);
    }
    return base;
  }, [filtered, selectedSort]);

  function onPayDeposit(farm: FarmForSale) {
    setSelectedFarmForDeposit(farm);
    setDialogOpen(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Mining Marketplace</h1>
            <p className="text-muted-foreground mt-2">
              Browse farms for sale and pay the protocol deposit in your
              preferred currency
            </p>
          </div>
          <Button variant="outline" onClick={() => setListDialogOpen(true)}>
            List a Farm (Test)
          </Button>
        </div>

        <Tabs defaultValue="market">
          <TabsList>
            <TabsTrigger value="market">Marketplace</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="mt-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Region</span>
                <Select
                  value={selectedRegion}
                  onValueChange={(v) => setRegionParam(v === "All" ? null : v)}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All regions</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Currency</span>
                <Select
                  value={selectedCurrency}
                  onValueChange={(v) => setCurrencyParam(v)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentCurrencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort</span>
                <Select
                  value={selectedSort}
                  onValueChange={(v) => setSortParam(v)}
                >
                  <SelectTrigger className="w-[230px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating-desc">
                      Reward rating: high to low
                    </SelectItem>
                    <SelectItem value="rating-asc">
                      Reward rating: low to high
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No farms match your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                {sorted.map((farm) => {
                  const priceInSelected =
                    farm.pricePerAsset[selectedCurrency as PaymentCurrency];
                  const weeklyDepositReward =
                    farm.weeklyDepositRewards[
                      selectedCurrency as PaymentCurrency
                    ];
                  const decimals = getDisplayDecimals(selectedCurrency);
                  const ratingPct = Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round((farm.rewardRating / REWARD_RATING_MAX) * 100)
                    )
                  );

                  return (
                    <Card key={farm.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        {/* Image grid: 1 large + 2 small half-width */}
                        <div className="grid grid-cols-2 gap-1">
                          <div className="col-span-2">
                            <img
                              src={farm.images[0]}
                              alt={`${farm.name} main`}
                              className="w-full h-56 object-cover"
                            />
                          </div>
                          <img
                            src={farm.images[1]}
                            alt={`${farm.name} alt 1`}
                            className="w-full h-28 object-cover"
                          />
                          <img
                            src={farm.images[2]}
                            alt={`${farm.name} alt 2`}
                            className="w-full h-28 object-cover"
                          />
                        </div>

                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {farm.region}
                              </div>
                              <div className="text-base font-semibold">
                                {farm.name}
                              </div>
                            </div>
                            {/* Rating chip */}
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-muted-foreground">
                                Reward Score
                              </div>
                              <div className="text-xl font-bold tabular-nums">
                                {farm.rewardRating}
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="size-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>
                                  expected_rewards_per_week($$) * 100^2 /
                                  protocol_deposit($$)
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>

                          {/* Principal price */}
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Protocol Deposit
                            </div>
                            <div className="text-2xl font-bold tabular-nums">
                              {formatNumber(priceInSelected, decimals)}{" "}
                              {selectedCurrency}
                            </div>
                          </div>

                          {/* Rewards */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-md border p-3">
                              <div className="text-xs text-muted-foreground">
                                Weekly GLW Rewards
                              </div>
                              <div className="font-medium tabular-nums">
                                {formatNumber(farm.weeklyGlowRewards, 2)} GLW
                              </div>
                            </div>
                            <div className="rounded-md border p-3">
                              <div className="text-xs text-muted-foreground">
                                Weekly Deposit Rewards
                              </div>
                              <div className="font-medium tabular-nums">
                                {formatNumber(weeklyDepositReward, decimals)}{" "}
                                {selectedCurrency}
                              </div>
                            </div>
                          </div>

                          {/* CTAs */}
                          <div className="flex items-center gap-3">
                            <Button
                              className="flex-1"
                              onClick={() => onPayDeposit(farm)}
                            >
                              Pay Protocol Deposit
                            </Button>
                            <a
                              href={farm.auditUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1"
                            >
                              <Button variant="outline" className="w-full">
                                See Audit
                              </Button>
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Reward Score
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Region</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Protocol Deposit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soldFarmsActivity.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">
                            {new Date(item.ts).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.ts).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {item.rewardRatingAtSale}
                      </TableCell>
                      <TableCell className="text-sm">{item.region}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {item.depositAmount.toLocaleString()}{" "}
                        {item.depositCurrency}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Deposit Dialog */}
        <DepositDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          farm={selectedFarmForDeposit}
          selectedCurrency={selectedCurrency as PaymentCurrency}
        />

        <ListFarmDialog
          open={listDialogOpen}
          onOpenChange={setListDialogOpen}
          onListed={() => {
            // mock: simply show toast, the real flow would push to backend and refetch
          }}
        />
      </div>
    </div>
  );
}
