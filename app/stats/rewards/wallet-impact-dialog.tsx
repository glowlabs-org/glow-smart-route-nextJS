"use client";

import * as React from "react";
import { MapPin, Sun } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNumber } from "@/utils/format";
import { formatAddress } from "@/lib/utils";
import { useRegions } from "@/hooks/control-regions";
import { useV2ImpactWallet } from "@/hooks/v2-impact";

interface WalletImpactDialogProps {
  /** Wallet to show impact details for; `null` keeps the dialog closed. */
  wallet: string | null;
  /** Optional ENS name resolved by the leaderboard, shown in the header. */
  ensName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** parseFloat is fine here — these strings are only used for display. */
function fmt(value: string | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return "—";
  return formatNumber(n, { maximumFractionDigits: decimals });
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function WalletImpactDialog({
  wallet,
  ensName,
  open,
  onOpenChange,
}: WalletImpactDialogProps) {
  const query = useV2ImpactWallet(open ? wallet : null);
  const { regions } = useRegions();

  const regionName = React.useCallback(
    (regionId: number): string => {
      const match = regions.find((r) => r.id === regionId);
      return match?.name ?? `Region ${regionId}`;
    },
    [regions],
  );

  const data = query.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Wallet impact</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {ensName ?? (wallet ? formatAddress(wallet) : "")}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : query.isError ? (
          <p className="py-6 text-sm text-muted-foreground">
            Could not load impact details for this wallet. Try again shortly.
          </p>
        ) : !data || data.farms.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No farm impact recorded for this wallet yet. Impact is earned when a
            delegated or mined farm fully funds.
          </p>
        ) : (
          <ScrollArea className="-mr-4 flex-1 pr-4">
            <div className="space-y-5 py-1">
              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <StatBlock label="Total watts" value={fmt(data.totalWatts)} />
                <StatBlock
                  label="Carbon credits"
                  value={fmt(data.totalCarbonCredits)}
                />
              </div>

              {/* Watts by region */}
              {data.wattsByRegion.length > 0 ? (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Watts by region
                  </h3>
                  <div className="space-y-1">
                    {data.wattsByRegion.map((r) => (
                      <div
                        key={`w-${r.regionId}`}
                        className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span>{regionName(r.regionId)}</span>
                        <span className="tabular-nums">{fmt(r.watts)} W</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Policy credits by region */}
              {data.policyCreditsByRegion.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-medium">
                    Policy credits by region
                  </h3>
                  <div className="space-y-1">
                    {data.policyCreditsByRegion.map((r) => (
                      <div
                        key={`p-${r.regionId}`}
                        className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span>{regionName(r.regionId)}</span>
                        <span className="tabular-nums">
                          {fmt(r.policyCredits)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Farm-level breakdown */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  Farm breakdown
                </h3>
                <div className="overflow-hidden rounded-xl border border-border/40">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Farm</th>
                        <th className="px-3 py-2 font-medium">Region</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Watts
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Carbon
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Policy
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.farms.map((f) => (
                        <tr
                          key={f.farmId}
                          className="border-b border-border/20 last:border-0"
                        >
                          <td className="px-3 py-2 font-mono text-xs">
                            {f.farmId.length > 14
                              ? `${f.farmId.slice(0, 10)}…`
                              : f.farmId}
                          </td>
                          <td className="px-3 py-2">
                            {regionName(f.regionId)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmt(f.wattsTotal)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmt(f.carbonCredits)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmt(f.policyCredits)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {data.updatedAt ? (
                <p className="text-[11px] text-muted-foreground">
                  Updated {new Date(data.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
