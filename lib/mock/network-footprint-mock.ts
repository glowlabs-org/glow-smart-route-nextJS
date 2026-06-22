// MOCK — swap for a real protocol-wide impact endpoint later.

export interface NetworkFootprint {
  totalWatts: number;
  homesPowered: number;
  energyPerYearMwh: number;
  treesEquivalent: number;
  totalTonsCo2: number;
  regional: { code: string; label: string; watts: number; color: string }[];
  growth: { date: string; watts: number }[];
}

export const MOCK_NETWORK_FOOTPRINT: NetworkFootprint = {
  totalWatts: 2_410_000,
  homesPowered: 370,
  energyPerYearMwh: 3_800,
  treesEquivalent: 78_400,
  totalTonsCo2: 12_400,
  // 8 regions, watts sum to 2,410,000 (= totalWatts).
  regional: [
    { code: "UT", label: "Utah", watts: 612_000, color: "#3b82f6" },
    { code: "MO", label: "Missouri", watts: 438_000, color: "#10b981" },
    { code: "CO", label: "Colorado", watts: 356_000, color: "#f59e0b" },
    { code: "RJ", label: "Rajasthan", watts: 298_000, color: "#eab308" },
    { code: "FL", label: "Florida", watts: 246_000, color: "#ec4899" },
    { code: "OK", label: "Oklahoma", watts: 190_000, color: "#a855f7" },
    { code: "ID", label: "Idaho", watts: 156_000, color: "#14b8a6" },
    { code: "MI", label: "Michigan", watts: 114_000, color: "#f43f5e" },
  ],
  // 9 monthly cumulative points, rising from ~120k to 2,410,000 (= totalWatts).
  growth: [
    { date: "2025-10-01", watts: 120_000 },
    { date: "2025-11-01", watts: 318_000 },
    { date: "2025-12-01", watts: 540_000 },
    { date: "2026-01-01", watts: 812_000 },
    { date: "2026-02-01", watts: 1_104_000 },
    { date: "2026-03-01", watts: 1_456_000 },
    { date: "2026-04-01", watts: 1_820_000 },
    { date: "2026-05-01", watts: 2_140_000 },
    { date: "2026-06-01", watts: 2_410_000 },
  ],
};
