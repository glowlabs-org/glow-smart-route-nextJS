import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Glow Mining Streak";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;
const V2_START_TIMESTAMP = new Date("2025-10-11T00:00:00Z").getTime();

function getWeekNumberFromTimestamp(timestamp: number): number {
  const genesisTimestamp = 1696118400000;
  return Math.floor((timestamp - genesisTimestamp) / (7 * 24 * 60 * 60 * 1000));
}

function weekToTimestamp(weekNumber: number): number {
  const genesisTimestamp = 1696118400000;
  return genesisTimestamp + weekNumber * 7 * 24 * 60 * 60 * 1000;
}

const V2_START_WEEK = getWeekNumberFromTimestamp(V2_START_TIMESTAMP);

interface SplitActivity {
  fractionType: string;
  amount: string;
  timestamp: number;
}

interface WeekData {
  week: number;
  hasDelegation: boolean;
  hasMiner: boolean;
  amount: number;
  monthLabel: string;
}

async function fetchStreakData(wallet: string) {
  try {
    const splitsUrl = `${HUB_URL}/fractions/splits-activity?walletAddress=${wallet}&limit=200`;
    const response = await fetch(splitsUrl, { next: { revalidate: 60 } });

    if (!response.ok) {
      return { longestStreak: 0, weeks: [] as WeekData[] };
    }

    const data = await response.json();
    const activity: SplitActivity[] = data.activity || [];

    const delegationsByWeek = new Map<number, number>();
    const minerWeeks = new Set<number>();

    activity.forEach((split) => {
      const weekNumber = getWeekNumberFromTimestamp(split.timestamp);
      if (split.fractionType === "launchpad") {
        const amount = Number(split.amount) / 1e18;
        if (amount > 0) {
          delegationsByWeek.set(
            weekNumber,
            (delegationsByWeek.get(weekNumber) ?? 0) + amount
          );
        }
      } else if (split.fractionType === "mining-center") {
        minerWeeks.add(weekNumber);
      }
    });

    const currentWeek = getWeekNumberFromTimestamp(Date.now());
    const lastKnownWeek = Math.max(
      currentWeek,
      ...Array.from(delegationsByWeek.keys()),
      ...Array.from(minerWeeks)
    );

    let currentStreak = 0;
    let maxStreak = 0;
    for (let week = V2_START_WEEK; week <= lastKnownWeek; week++) {
      const amount = delegationsByWeek.get(week) ?? 0;
      const hasMiner = minerWeeks.has(week);
      if (amount > 0 || hasMiner) {
        currentStreak += 1;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    const displayCount = 10;
    const startWeek = Math.max(
      V2_START_WEEK,
      lastKnownWeek - (displayCount - 1)
    );
    const weeks: WeekData[] = [];

    for (let week = startWeek; week <= lastKnownWeek; week++) {
      const amount = delegationsByWeek.get(week) ?? 0;
      const date = new Date(weekToTimestamp(week));
      weeks.push({
        week,
        hasDelegation: amount > 0,
        hasMiner: minerWeeks.has(week),
        amount,
        monthLabel: date.toLocaleDateString("en-US", { month: "short" }),
      });
    }

    return { longestStreak: maxStreak, weeks };
  } catch (error) {
    console.error("Failed to fetch streak data:", error);
    return { longestStreak: 0, weeks: [] as WeekData[] };
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  const { longestStreak, weeks } = await fetchStreakData(wallet);

  const CELL_SIZE = 56;
  const GAP = 8;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          padding: "40px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <span
            style={{
              fontSize: "120px",
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1,
            }}
          >
            {longestStreak}
          </span>
          <span
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#71717a",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginTop: "8px",
            }}
          >
            LONGEST MINING STREAK
          </span>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: `${GAP}px`,
            maxWidth: "600px",
            justifyContent: "center",
            padding: "24px",
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: "16px",
          }}
        >
          {weeks.map((w) => {
            let bgColor = "rgb(45,51,59)";
            if (w.hasDelegation && w.hasMiner) {
              bgColor = "linear-gradient(135deg, #ccffd4 45%, #dcc4ff 100%)";
            } else if (w.hasMiner) {
              bgColor = "rgba(204,255,212,0.85)";
            } else if (w.hasDelegation) {
              bgColor = "rgba(220,196,255,0.95)";
            }

            const isGradient = w.hasDelegation && w.hasMiner;

            return (
              <div
                key={w.week}
                style={{
                  width: `${CELL_SIZE}px`,
                  height: `${CELL_SIZE}px`,
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  ...(isGradient
                    ? { backgroundImage: bgColor }
                    : { backgroundColor: bgColor }),
                }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "24px",
            fontSize: "14px",
            color: "#71717a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                backgroundColor: "rgba(220,196,255,0.95)",
              }}
            />
            <span>Delegation</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                backgroundColor: "rgba(204,255,212,0.85)",
              }}
            />
            <span>Miner</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "4px",
                backgroundImage:
                  "linear-gradient(135deg, #ccffd4 45%, #dcc4ff 100%)",
              }}
            />
            <span>Both</span>
          </div>
        </div>

        {/* Branding */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            right: "32px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "16px",
            color: "#71717a",
          }}
        >
          <span style={{ fontWeight: 600 }}>app.glow.org</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
