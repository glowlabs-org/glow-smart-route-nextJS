"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletSwaps } from "@/hooks/useWalletSwaps";
import { useWalletV2Claims } from "@/hooks/useWalletV2Claims";
import {
  useRewardsBreakdown,
  type RewardsBreakdownResponse,
} from "@/hooks/useRewardsBreakdown";
import {
  useSplitsActivity,
  type SplitActivity,
} from "@/hooks/useGlowLaunchpad";
import { formatUnits, parseAbiItem } from "viem";
import { ExternalLink } from "lucide-react";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { addresses, SDKAddresses } from "@/web3/constants/addresses";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { nonceToWeek } from "@/hooks/useMerkleProofs";
import {
  buildWeeklyDelegations,
  getGlwFromWei,
  weekToTimestamp,
} from "@/lib/rewards/weekly-delegations";
import { GlowCommit } from "@/components/glow-commit";

const rewardClaimedEvent = parseAbiItem(
  "event RewardClaimed(address indexed user, address indexed to, uint256 indexed nonce, address from, (address token,uint256 amount)[] taa, bool[] isGuarded)"
);

const gcaPayoutClaimedEvent = parseAbiItem(
  "event GCAPayoutClaimed(address indexed agent, uint256 amount, uint256 totalSlashableBalance)"
);

interface ClaimEventsData {
  protocolByWeek: Map<number, number>;
  inflationEvents: Array<{ timestamp: number; amount: number }>;
}

async function fetchClaimEvents(
  walletAddress: `0x${string}`
): Promise<ClaimEventsData> {
  const rewardsKernelAddress = SDKAddresses.REWARDS_KERNEL as `0x${string}`;
  const minerPoolAddress = addresses.gcaAndMinerPoolContract as `0x${string}`;

  const [protocolLogs, inflationLogs] = await Promise.all([
    publicClient.getLogs({
      address: rewardsKernelAddress,
      event: rewardClaimedEvent,
      args: {
        user: walletAddress,
      },
      fromBlock: BigInt(0),
      toBlock: "latest",
    }),
    publicClient.getLogs({
      address: minerPoolAddress,
      event: gcaPayoutClaimedEvent,
      args: {
        agent: walletAddress,
      },
      fromBlock: BigInt(0),
      toBlock: "latest",
    }),
  ]);

  const blockTimestampCache = new Map<string, number>();
  async function getTimestamp(blockNumber: bigint) {
    const key = blockNumber.toString();
    if (!blockTimestampCache.has(key)) {
      const block = await publicClient.getBlock({ blockNumber });
      blockTimestampCache.set(key, Number(block.timestamp) * 1000);
    }
    return blockTimestampCache.get(key)!;
  }

  const protocolByWeek = new Map<number, number>();
  for (const log of protocolLogs) {
    const nonceValue = log.args?.nonce;
    if (nonceValue === undefined) continue;
    const timestamp = await getTimestamp(log.blockNumber);
    const week = nonceToWeek(BigInt(nonceValue));
    protocolByWeek.set(week, timestamp);
  }

  const inflationEvents = await Promise.all(
    inflationLogs.map(async (log) => ({
      timestamp: await getTimestamp(log.blockNumber),
      amount: Number(
        formatUnits(
          (log.args?.amount as bigint | undefined) ?? BigInt(0),
          DECIMALS_BY_TOKEN.GLW
        )
      ),
    }))
  );

  return {
    protocolByWeek,
    inflationEvents,
  };
}

interface WalletActivityKpisProps {
  walletAddress: string | undefined;
}

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function getUsdgFromMicros(value?: string) {
  if (!value) return 0;
  try {
    return Number(formatUnits(BigInt(value), 6));
  } catch {
    return 0;
  }
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExplorerUrl(txHash: `0x${string}`) {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  const isSepolia = chainId === "11155111";
  return isSepolia
    ? `https://sepolia.etherscan.io/tx/${txHash}`
    : `https://etherscan.io/tx/${txHash}`;
}

function getTotalsFromRewards(data: RewardsBreakdownResponse | null): {
  delegatedGlw: number;
  totalEarnedGlw: number;
  weeklyDelegations: Map<number, number>;
  usdgSpentOnMiners: number;
} {
  if (!data) {
    return {
      delegatedGlw: 0,
      totalEarnedGlw: 0,
      weeklyDelegations: new Map(),
      usdgSpentOnMiners: 0,
    };
  }

  const delegatedGlw =
    getGlwFromWei(data.totals.totalGlwDelegated) +
    getGlwFromWei(data.delegatedAfterWeekRange.totalGlwDelegatedAfter);

  const totalEarnedGlw =
    getGlwFromWei(data.rewards.delegator.allWeeks) +
    getGlwFromWei(data.rewards.miner.allWeeks);

  const usdgSpentOnMiners =
    getUsdgFromMicros(data.totals.totalUsdcSpentByMiners) +
    getUsdgFromMicros(data.delegatedAfterWeekRange.totalUsdcSpentAfter);

  const weeklyDelegations = buildWeeklyDelegations(data);

  return {
    delegatedGlw,
    totalEarnedGlw,
    weeklyDelegations,
    usdgSpentOnMiners,
  };
}

function ActivityTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <div className="text-sm text-muted-foreground uppercase font-semibold">
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {helper && (
        <div className="text-xs text-muted-foreground leading-tight">
          {helper}
        </div>
      )}
    </div>
  );
}

export function WalletActivityKpis({ walletAddress }: WalletActivityKpisProps) {
  const {
    swaps,
    totals: swapTotals,
    isLoading: swapsLoading,
    error: swapError,
  } = useWalletSwaps(walletAddress);
  const {
    inflationTotalGlw,
    protocolTotals,
    protocolClaims,
    inflationClaims,
    isLoading: claimsLoading,
    isError: claimsError,
  } = useWalletV2Claims(walletAddress);
  const {
    data: rewardsData,
    isLoading: rewardsLoading,
    isError: rewardsError,
  } = useRewardsBreakdown({
    walletAddress: walletAddress || null,
    enabled: Boolean(walletAddress),
  });

  // Fetch actual delegation transaction timestamps
  const { activity: splitsActivity, isLoading: splitsLoading } =
    useSplitsActivity({
      walletAddress: walletAddress || undefined,
      enabled: Boolean(walletAddress),
      limit: 100,
    });

  if (!walletAddress) return null;

  const isLoading =
    swapsLoading || claimsLoading || rewardsLoading || splitsLoading;
  const hasError = Boolean(swapError) || claimsError || rewardsError;
  const safeProtocolTotals = protocolTotals ?? {};

  const { delegatedGlw, totalEarnedGlw, weeklyDelegations, usdgSpentOnMiners } =
    React.useMemo(() => getTotalsFromRewards(rewardsData), [rewardsData]);

  const { data: claimEventData } = useQuery({
    queryKey: ["wallet-claim-events", walletAddress],
    enabled: Boolean(walletAddress),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error("No wallet");
      }
      return fetchClaimEvents(walletAddress as `0x${string}`);
    },
  });

  const glwSold = swapTotals.totalGlwIn;
  const usdFromSwaps = swapTotals.totalUsdgOut;
  const glwClaimed = inflationTotalGlw + (safeProtocolTotals["GLW"] ?? 0);
  const otherProtocolClaims = Object.entries(safeProtocolTotals)
    .filter(([currency]) => currency !== "GLW" && currency !== "USDG")
    .map(([currency, amount]) => `${formatNumber(amount, 2)} ${currency}`)
    .join(" · ");

  const weeklyGlwClaims = React.useMemo(() => {
    const map = new Map<number, number>();
    (inflationClaims ?? []).forEach((claim) => {
      map.set(claim.week, (map.get(claim.week) ?? 0) + claim.amount);
    });
    (protocolClaims ?? [])
      .filter((claim) => claim.currency === "GLW")
      .forEach((claim) => {
        map.set(claim.week, (map.get(claim.week) ?? 0) + claim.amount);
      });
    return map;
  }, [inflationClaims, protocolClaims]);

  const redelegatedFromClaims = React.useMemo(() => {
    if (glwClaimed <= 0 || weeklyGlwClaims.size === 0) return 0;
    const weeks = Array.from(
      new Set([...weeklyGlwClaims.keys(), ...weeklyDelegations.keys()])
    ).sort((a, b) => a - b);

    let claimBalance = 0;
    let covered = 0;

    weeks.forEach((week) => {
      claimBalance += weeklyGlwClaims.get(week) ?? 0;
      const delegated = weeklyDelegations.get(week) ?? 0;
      if (delegated <= 0) return;
      const used = Math.min(claimBalance, delegated);
      covered += used;
      claimBalance -= used;
    });

    return covered;
  }, [glwClaimed, weeklyGlwClaims, weeklyDelegations]);

  const inflationTimestampByWeek = React.useMemo(() => {
    if (!claimEventData?.inflationEvents?.length) {
      return new Map<number, number>();
    }

    const remainingEvents = [...claimEventData.inflationEvents];
    const map = new Map<number, number>();
    const protocolEntries = claimEventData.protocolByWeek
      ? Array.from(claimEventData.protocolByWeek.entries())
      : [];

    protocolEntries
      .sort((a, b) => a[1] - b[1])
      .forEach(([week, protocolTs]) => {
        let bestIdx = -1;
        let bestGap = Number.POSITIVE_INFINITY;
        remainingEvents.forEach((event, idx) => {
          const gap = Math.abs(event.timestamp - protocolTs);
          if (gap < bestGap) {
            bestGap = gap;
            bestIdx = idx;
          }
        });

        const MAX_GAP = 6 * 60 * 60 * 1000; // 6 hours
        if (bestIdx !== -1 && bestGap <= MAX_GAP) {
          const [event] = remainingEvents.splice(bestIdx, 1);
          map.set(week, event.timestamp);
        }
      });

    if (remainingEvents.length > 0 && inflationClaims?.length) {
      const unmatchedWeeks = inflationClaims
        .filter((claim) => !map.has(claim.week))
        .sort((a, b) => b.amount - a.amount);

      unmatchedWeeks.forEach((claim) => {
        let bestIdx = -1;
        let bestDiff = Number.POSITIVE_INFINITY;
        remainingEvents.forEach((event, idx) => {
          const diff = Math.abs(event.amount - claim.amount);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = idx;
          }
        });
        const AMOUNT_TOLERANCE = 0.5;
        if (bestIdx !== -1 && bestDiff <= AMOUNT_TOLERANCE) {
          const [event] = remainingEvents.splice(bestIdx, 1);
          map.set(claim.week, event.timestamp);
        }
      });
    }

    return map;
  }, [claimEventData, inflationClaims]);

  const redelegatedShare =
    glwClaimed > 0 ? Math.min(redelegatedFromClaims / glwClaimed, 1) : null;
  const dumpedShare = glwClaimed > 0 ? Math.min(glwSold / glwClaimed, 1) : null;
  const idleShare =
    glwClaimed > 0 && redelegatedShare !== null && dumpedShare !== null
      ? Math.max(0, 1 - redelegatedShare - dumpedShare)
      : null;

  const usdcRedeployed = Math.min(usdgSpentOnMiners, usdFromSwaps);
  const usdcRedeployShare =
    usdFromSwaps > 0 ? Math.min(usdcRedeployed / usdFromSwaps, 1) : null;

  interface TimelineEvent {
    id: string;
    title: string;
    amount: string;
    subtitle: string;
    date: number;
    link?: string;
  }

  const timelineEvents = React.useMemo(() => {
    const events: TimelineEvent[] = [];
    const protocolByWeek =
      claimEventData?.protocolByWeek ?? new Map<number, number>();

    const resolveClaimTimestamp = (week: number) => {
      const candidates: number[] = [];
      const protocolTs = protocolByWeek.get(week);
      if (protocolTs) candidates.push(protocolTs);
      const inflationTs = inflationTimestampByWeek.get(week);
      if (inflationTs) candidates.push(inflationTs);
      if (candidates.length === 0) {
        return weekToTimestamp(week);
      }
      const sum = candidates.reduce((acc, ts) => acc + ts, 0);
      return Math.round(sum / candidates.length);
    };

    // Add GLW claim events with actual on-chain timestamps
    weeklyGlwClaims.forEach((amount, week) => {
      if (amount <= 0) return;
      events.push({
        id: `claim-${week}`,
        title: "GLW Claimed",
        amount: `${formatNumber(amount, 2)} GLW`,
        subtitle: `Week #${week}`,
        date: resolveClaimTimestamp(week),
      });
    });

    // Add delegation events with ACTUAL transaction timestamps from splits-activity API
    splitsActivity
      .filter((split) => split.fractionType === "launchpad")
      .forEach((split) => {
        const glwAmount = Number(formatUnits(BigInt(split.amount), 18));
        if (glwAmount <= 0) return;
        events.push({
          id: `delegation-${split.transactionHash}`,
          title: "GLW Delegated",
          amount: `${formatNumber(glwAmount, 0)} GLW`,
          subtitle: split.farmName?.substring(0, 20) || "Farm",
          date: split.timestamp * 1000, // Convert to ms
          link: getExplorerUrl(split.transactionHash as `0x${string}`),
        });
      });

    // Add swap events
    swaps.forEach((swap) => {
      if (swap.glwIn <= 0) return;
      events.push({
        id: `swap-${swap.txHash}`,
        title: "GLW Sold",
        amount: `${formatNumber(swap.glwIn, 0)} GLW → ${formatNumber(
          swap.usdgOut,
          0
        )} USD`,
        subtitle: "Swap via GLW/USDG pool",
        date: swap.timestamp,
        link: getExplorerUrl(swap.txHash),
      });
    });

    return events.sort((a, b) => b.date - a.date).slice(0, 15);
  }, [
    weeklyGlwClaims,
    splitsActivity,
    swaps,
    claimEventData,
    inflationTimestampByWeek,
  ]);

  const strategyLabel = React.useMemo(() => {
    if (!glwClaimed || glwClaimed <= 0) {
      return "No GLW claims recorded yet.";
    }
    if (dumpedShare !== null && dumpedShare > 0.5) {
      return "Majority of claimed GLW is being sold.";
    }
    if (redelegatedShare !== null && redelegatedShare > 0.6) {
      return "Most claims are redelegated into miners.";
    }
    if (
      redelegatedShare !== null &&
      dumpedShare !== null &&
      Math.abs(redelegatedShare - dumpedShare) < 0.15
    ) {
      return "Claims are split between redelegating and selling.";
    }
    if (
      redelegatedShare !== null &&
      dumpedShare !== null &&
      redelegatedShare > dumpedShare
    ) {
      return "Redelegation is the dominant behavior.";
    }
    return "Mixed strategy detected.";
  }, [glwClaimed, redelegatedShare, dumpedShare]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Activity KPIs</CardTitle>
        <CardDescription>
          Quick read on how this wallet turns rewards into swaps, redelegations,
          or miner purchases.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        ) : hasError ? (
          <p className="text-sm text-destructive">
            Unable to load KPI summary. Please try again later.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="">
              <GlowCommit walletAddress={walletAddress} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <ActivityTile
                label="GLW Claimed"
                value={`${formatNumber(glwClaimed, 2)} GLW`}
                helper="Inflation + protocol-deposit GLW"
              />
              <ActivityTile
                label="GLW Sold (90d)"
                value={`${formatNumber(glwSold, 0)} GLW`}
                helper={`Generated ${formatNumber(usdFromSwaps, 0)} USDG`}
              />
              <ActivityTile
                label="GLW Delegated"
                value={`${formatNumber(delegatedGlw, 2)} GLW`}
                helper="Total spent on miners/delegations"
              />
              <ActivityTile
                label="GLW Redelegated (Est.)"
                value={`${formatNumber(redelegatedFromClaims, 2)} GLW`}
                helper={
                  redelegatedShare !== null
                    ? `${formatPercent(redelegatedShare)} of GLW claims`
                    : undefined
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <ActivityTile
                label="USDC Spent on Miners"
                value={`${formatNumber(usdcRedeployed, 0)} USD`}
                helper={
                  usdcRedeployShare !== null
                    ? `${formatPercent(
                        usdcRedeployShare
                      )} of recent sell proceeds`
                    : undefined
                }
              />
              <ActivityTile
                label="GLW Earned on Miners"
                value={`${formatNumber(totalEarnedGlw, 2)} GLW`}
                helper="Lifetime miner + delegation rewards"
              />
              <div className="hidden xl:block" />
            </div>

            {otherProtocolClaims && (
              <div className="text-xs text-muted-foreground">
                Additional protocol assets claimed: {otherProtocolClaims}
              </div>
            )}

            {timelineEvents.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Flow Timeline
                </h3>
                <div className="space-y-2">
                  {timelineEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="text-xs uppercase text-muted-foreground font-semibold">
                          {event.title}
                        </div>
                        <div className="text-base font-semibold">
                          {event.amount}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>{event.subtitle}</span>
                          {event.link && (
                            <a
                              href={event.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              View tx
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(event.date)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Strategy Snapshot
              </div>
              <p className="text-sm text-foreground">{strategyLabel}</p>
              {redelegatedShare !== null && dumpedShare !== null && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Redelegated</div>
                    <div className="font-semibold">
                      {formatPercent(redelegatedShare)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Sold</div>
                    <div className="font-semibold">
                      {formatPercent(dumpedShare)}
                    </div>
                  </div>
                  {idleShare !== null && (
                    <div>
                      <div className="text-muted-foreground">Untracked</div>
                      <div className="font-semibold">
                        {formatPercent(Math.max(0, idleShare))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
