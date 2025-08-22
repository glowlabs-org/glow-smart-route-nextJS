export interface FarmForSale {
  id: string;
  name: string;
  region: RegionName;
  pricePerAsset: Record<PaymentCurrency, number>; // principal protocol deposit per currency
  weeklyGlowRewards: number; // GLW per week
  weeklyDepositRewards: Record<PaymentCurrency, number>; // weekly rewards denominated in selected currency
  rewardRating: number; // 0..REWARD_RATING_MAX
  images: string[]; // 3 stock images
  auditUrl: string;
}

export type RegionName =
  | "Clean Grid Project"
  | "Rising Utah"
  | "Shining Missouri"
  | "Golden Colorado";

export type PaymentCurrency = "USDC" | "USDG" | "GCTL" | "GLW";

export const paymentCurrencies: PaymentCurrency[] = [
  "USDC",
  "USDG",
  "GCTL",
  "GLW",
];
export const regions: RegionName[] = [
  "Clean Grid Project",
  "Rising Utah",
  "Shining Missouri",
  "Golden Colorado",
];

// Reward rating scale for display and normalization
export const REWARD_RATING_MAX = 500;

// Simple stock images (reuse same for now)
const IMG = "/images/sections/residential.jpg";
const IMG2 = "/images/sections/residential.jpg";
const IMG3 = "/images/sections/residential.jpg";

// Helper to clone a base USDC price into all currencies with mock FX
const FX: Record<PaymentCurrency, number> = {
  USDC: 1,
  USDG: 1, // 1:1 for mock
  GCTL: 2.5, // pretend 1 GCTL ~ $2.5
  GLW: 0.5, // pretend 1 GLW ~ $0.5
};

function pricesFromUSDC(usdc: number): Record<PaymentCurrency, number> {
  return {
    USDC: usdc,
    USDG: usdc / FX.USDG,
    GCTL: usdc / FX.GCTL,
    GLW: usdc / FX.GLW,
  };
}

function weeklyRewardsFromUSDC(
  usdcPerWeek: number
): Record<PaymentCurrency, number> {
  return {
    USDC: usdcPerWeek,
    USDG: usdcPerWeek / FX.USDG,
    GCTL: usdcPerWeek / FX.GCTL,
    GLW: usdcPerWeek / FX.GLW,
  };
}

export const farmsForSale: FarmForSale[] = [
  {
    id: "farm-1",
    name: "Solar Vista Farm",
    region: "Rising Utah",
    pricePerAsset: pricesFromUSDC(25000),
    weeklyGlowRewards: 625,
    weeklyDepositRewards: weeklyRewardsFromUSDC(120),
    rewardRating: 420,
    images: [IMG, IMG2, IMG3],
    auditUrl: "https://example.com/audit/solar-vista",
  },
  {
    id: "farm-2",
    name: "Desert Wind Farm",
    region: "Clean Grid Project",
    pricePerAsset: pricesFromUSDC(30400),
    weeklyGlowRewards: 710,
    weeklyDepositRewards: weeklyRewardsFromUSDC(135),
    rewardRating: 380,
    images: [IMG, IMG2, IMG3],
    auditUrl: "https://example.com/audit/desert-wind",
  },
  {
    id: "farm-3",
    name: "Mountain Peak Solar",
    region: "Golden Colorado",
    pricePerAsset: pricesFromUSDC(27000),
    weeklyGlowRewards: 540,
    weeklyDepositRewards: weeklyRewardsFromUSDC(110),
    rewardRating: 460,
    images: [IMG, IMG2, IMG3],
    auditUrl: "https://example.com/audit/mountain-peak",
  },
  {
    id: "farm-4",
    name: "Shimmer Fields",
    region: "Shining Missouri",
    pricePerAsset: pricesFromUSDC(22000),
    weeklyGlowRewards: 480,
    weeklyDepositRewards: weeklyRewardsFromUSDC(95),
    rewardRating: 335,
    images: [IMG, IMG2, IMG3],
    auditUrl: "https://example.com/audit/shimmer-fields",
  },
];

export interface SoldFarmActivity {
  id: string;
  ts: string; // ISO date string
  farmId: string;
  region: RegionName;
  rewardRatingAtSale: number;
  depositAmount: number;
  depositCurrency: PaymentCurrency;
}

export const soldFarmsActivity: SoldFarmActivity[] = [
  {
    id: "sale-1",
    ts: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    farmId: "farm-1",
    region: "Rising Utah",
    rewardRatingAtSale: 435,
    depositAmount: 25000,
    depositCurrency: "USDC",
  },
  {
    id: "sale-2",
    ts: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    farmId: "farm-2",
    region: "Clean Grid Project",
    rewardRatingAtSale: 400,
    depositAmount: 15200,
    depositCurrency: "GCTL",
  },
  {
    id: "sale-3",
    ts: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    farmId: "farm-3",
    region: "Golden Colorado",
    rewardRatingAtSale: 455,
    depositAmount: 54000,
    depositCurrency: "GLW",
  },
  {
    id: "sale-4",
    ts: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    farmId: "farm-4",
    region: "Shining Missouri",
    rewardRatingAtSale: 350,
    depositAmount: 22000,
    depositCurrency: "USDG",
  },
];
