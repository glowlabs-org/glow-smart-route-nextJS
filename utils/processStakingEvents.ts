import { format, parseISO } from "date-fns";

export interface StakingEvent {
  id: string;
  regionId?: number;
  wallet: string;
  epoch: number;
  amount: string;
  direction: string;
  ts: string;
  processed?: boolean;
  progressClaimed?: string;
  progressMoved?: string;
  actionSignatureData?: any;
}

export interface Region {
  id: number;
  name: string;
  code: string;
  slug: string;
  isUs: boolean;
  gctlStaked: string;
  glwRewardPerWeek: string;
  rewardShare: string;
  pendingUnstake: string;
  pendingRestakeOut: string;
  pendingRestakeIn: string;
  events: StakingEvent[];
}

export interface WeeklyNetMovement {
  epoch: number;
  date: string;
  regions: {
    [regionId: number]: {
      name: string;
      stake: bigint;
      unstake: bigint;
      restake: bigint;
      immediateUnstake: bigint;
      netMovement: bigint;
      cumulativeStaked: bigint;
    };
  };
  totalNetMovement: bigint;
}

export function processStakingEvents(regions: Region[]): WeeklyNetMovement[] {
  // Group events by epoch
  const eventsByEpoch = new Map<number, StakingEvent[]>();

  regions.forEach((region) => {
    region.events.forEach((event) => {
      const epochEvents = eventsByEpoch.get(event.epoch) || [];
      // Ensure regionId is set from the parent region
      epochEvents.push({ ...event, regionId: event.regionId ?? region.id });
      eventsByEpoch.set(event.epoch, epochEvents);
    });
  });

  // Get all unique epochs and sort them
  const epochs = Array.from(eventsByEpoch.keys()).sort((a, b) => a - b);

  // Track cumulative staked amounts per region
  const cumulativeStaked = new Map<number, bigint>();

  // Process each epoch
  const weeklyMovements: WeeklyNetMovement[] = epochs.map((epoch) => {
    const epochEvents = eventsByEpoch.get(epoch) || [];
    const regionMovements: WeeklyNetMovement["regions"] = {};

    // Initialize regions for this epoch
    regions.forEach((region) => {
      regionMovements[region.id] = {
        name: region.name,
        stake: BigInt(0),
        unstake: BigInt(0),
        restake: BigInt(0),
        immediateUnstake: BigInt(0),
        netMovement: BigInt(0),
        cumulativeStaked: cumulativeStaked.get(region.id) || BigInt(0),
      };
    });

    // Process events for this epoch
    epochEvents.forEach((event) => {
      const amount = BigInt(event.amount);
      const regionId = event.regionId;
      if (!regionId) return; // Skip if no regionId

      const regionData = regionMovements[regionId];
      if (!regionData) return; // Skip if region not found

      switch (event.direction) {
        case "stake":
          regionData.stake += amount;
          regionData.netMovement += amount;
          break;
        case "unstake":
          regionData.unstake += amount;
          regionData.netMovement -= amount;
          break;
        case "restake":
          // Restake out from current region
          regionData.restake += amount;
          regionData.netMovement -= amount;

          // If we have actionSignatureData, add to the destination region
          if (event.actionSignatureData?.toZone) {
            const toRegion = regionMovements[event.actionSignatureData.toZone];
            if (toRegion) {
              toRegion.restake -= amount; // Negative because it's coming in
              toRegion.netMovement += amount;
            }
          }
          break;
        case "immediate_unstake":
          regionData.immediateUnstake += amount;
          regionData.netMovement -= amount;
          break;
      }
    });

    // Update cumulative staked amounts
    Object.entries(regionMovements).forEach(([regionId, data]) => {
      const id = parseInt(regionId);
      const currentCumulative = cumulativeStaked.get(id) || BigInt(0);
      const newCumulative = currentCumulative + data.netMovement;
      cumulativeStaked.set(id, newCumulative);
      data.cumulativeStaked = newCumulative;
    });

    // Calculate total net movement for the epoch
    const totalNetMovement = Object.values(regionMovements).reduce(
      (sum, region) => sum + region.netMovement,
      BigInt(0)
    );

    // Get the date from the first event of this epoch
    const firstEvent = epochEvents[0];
    const epochDate = firstEvent
      ? format(parseISO(firstEvent.ts), "MMM d, yyyy")
      : `Epoch ${epoch}`;

    return {
      epoch,
      date: epochDate,
      regions: regionMovements,
      totalNetMovement,
    };
  });

  return weeklyMovements;
}

// Helper function to format large numbers
export function formatStakeAmount(amount: bigint): string {
  const gctl = Number(amount) / 1e7; // GCTL has 7 decimals

  if (gctl >= 1e9) return `${(gctl / 1e9).toFixed(2)}B`;
  if (gctl >= 1e6) return `${(gctl / 1e6).toFixed(2)}M`;
  if (gctl >= 1e3) return `${(gctl / 1e3).toFixed(2)}K`;
  return gctl.toFixed(2);
}

// Helper to get region color
export function getRegionColor(regionId: number): string {
  const colors = {
    1: "hsl(var(--chart-1))", // Clean Grid Project
    2: "hsl(var(--chart-2))", // Rising Utah
    3: "hsl(var(--chart-3))", // Shining Missouri
    4: "hsl(var(--chart-4))", // Golden Colorado
  };
  return colors[regionId as keyof typeof colors] || "hsl(var(--chart-5))";
}
