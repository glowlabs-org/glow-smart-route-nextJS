"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FallbackImage } from "@/components/ui/fallback-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  useGctlApi,
  useActiveRegionsSummary,
  useGctlHoldersCount,
  useTotalActivelyDelegated,
  useActivelyDelegatedByWeek,
} from "@/hooks";
import {
  useImpactNewWalletsByWeek,
  useImpactWalletStats,
} from "@/hooks/hub-impact";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { useGlowCirculatingSnapshot } from "@/hooks/useGlowCirculatingSnapshot";
import { usePoolInfo } from "@/hooks/useLiquidityPositionsOptimized";
import { useImpactMetrics } from "@/hooks/useImpactMetrics";
import { usePolLiquiditySnapshot } from "@/hooks/usePolLiquiditySnapshot";
import { usePolLiquidity } from "@/hooks/usePolLiquidity";
import { usePolSummary } from "@/hooks/usePolSummary";
import {
  parseLqUnits,
  resolveDisplayLifetimeLq,
  usePolRevenueAggregate,
  usePolRevenueFarms,
  usePolRevenueRegions,
} from "@/hooks/usePolRevenue";
import {
  parseSystemWattageOutputKw,
  useCompletedFarms,
} from "@/hooks/useCompletedFarms";
import { useGlwVestingSchedule } from "@/hooks/useGlwVestingSchedule";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";
import type {
  MiniBlogGraphButtonProps,
  MiniBlogGraphCluster,
} from "./mini-blog-graph-button";

import { formatUnits } from "viem";
import { getCurrentWeekNumber } from "@/lib/rewards/weekly-delegations";
import { useLang } from "@/lib/i18n";

const MiniBlogGraphButton = dynamic<MiniBlogGraphButtonProps>(
  () =>
    import("./mini-blog-graph-button").then((mod) => mod.MiniBlogGraphButton),
  {
    ssr: false,
    loading: function MiniBlogGraphLoading() {
      const p = usePolCopy();
      return (
        <button
          type="button"
          disabled
          className="w-full rounded-xl border border-border/40 bg-muted/30 px-4 py-3 text-xs font-mono uppercase tracking-wider text-foreground/50"
        >
          {p.viewAllTopics}
        </button>
      );
    },
  },
);

const NetworkImpactSection = dynamic(
  () =>
    import("./network-impact-section").then((mod) => mod.NetworkImpactSection),
  {
    ssr: false,
    loading: () => (
      <section className="pt-16">
        <div className="rounded-3xl border border-border/20 bg-card p-8 text-sm text-muted-foreground">
          Loading network impact...
        </div>
      </section>
    ),
  },
);

const PRICE_RANGE = { min: 0.001, max: 100 };
const ZERO_SUPPLY_PRICE_EPSILON = 1.001;
const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;
const LIQUIDITY_UNIT = "Ⱡ";
const POL_LIQUIDITY_V2_START_WEEK = 97;
const FDV_TOTAL_TOKENS_GLW = 180_000_000;
const MINER_INFLATION_PER_WEEK_GLW = 175_000;
const VETO_COUNCIL_INFLATION_PER_WEEK_GLW = 5_000;
const MIN_LIFETIME_REVENUE_LQ = 2_000;
const FARM_IMAGE_MODAL_WIDTH = 900;
const FARM_IMAGE_MODAL_QUALITY = 85;
const DEFINED_FI_GLOW_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";

const POL_COPY = {
  en: {
    clickForBasics: "Click for basics ↗",
    clickForNotes: "Click for notes ↗",
    clickToExplore: "Click to explore ↗",
    liveUnavailable: "Live data unavailable",
    open: "Open ↗",
    overview: "Overview",
    openGlowEconomy: "Open The Glow economy",
    marketCap: "Market Cap",
    glwPrice: "GLW Price",
    poolActivity: "Pool activity ↗",
    embeddedLiquidity: "Embedded Liquidity",
    liquidityUnitValue: `1${LIQUIDITY_UNIT} Value`,
    oneLiquidityUnit: "1 liquidity unit",
    monthlySolarConstruction: "Monthly Solar Construction",
    embeddedLiquidityGrowth3m: "Embedded Liquidity Growth (3 Months)",
    annualizedCirculatingGrowth: "Annualized Circulating Supply Growth",
    embeddedLiquidityGrowthMom: "Embedded Liquidity Growth",
    mom: "MoM",
    supplyAndCirculation: "Supply & Circulation",
    openSupplyModel: "Open supply model explorer",
    circulatingSupply: "Circulating supply",
    circulating: "Circulating",
    vaulted: "Vaulted",
    embeddedGlw: "Embedded GLW",
    exploreSupplyModel: "Explore Supply Model",
    solarFarmEconomics: "Solar Farm Economics",
    sortBy: "Sort by",
    latest: "Latest",
    lifetime: "Lifetime",
    ccPerWeek: "CC / Week",
    seeAll: "See all",
    generatedRevenue: "Generated Revenue",
    lifetimeProgress: "Lifetime Progress",
    embeddedLiquidityGctlWallets: "Embedded Liquidity, GCTL, Wallets",
    openProtocolLiquidityNotes: "Open protocol liquidity notes",
    liquidity: "Liquidity",
    apy: "APY",
    marketCapExitable: "Market cap exitable",
    openGctlNotes: "Open GCTL notes",
    totalGctl: "Total GCTL",
    mintPrice: "Mint Price",
    staked: "Staked",
    unstaked: "Unstaked",
    stakingByRegion: "Staking by region",
    openWalletStatsNotes: "Open wallet stats notes",
    walletStats: "Wallet Stats",
    glwHolders: "GLW Holders",
    protocolParticipants: "Protocol Participants",
    newWalletsPerWeek: "New wallets per week",
    walletBreakdown: "Wallet breakdown",
    walletBreakdownLabels: {
      Delegators: "Delegators",
      Miners: "Miners",
      "GCTL holders": "GCTL holders",
    } as Record<string, string>,
    delegationRegions: "Delegation + Regions",
    openDelegationNotes: "Open delegation metrics notes",
    delegationMetrics: "Delegation Metrics",
    glwDelegated: "GLW delegated",
    delegators: "Delegators",
    estimatedApy: "Est. APY",
    delegationGrowth: "Delegation growth (V2)",
    current: "Current",
    delegated: "Delegated",
    delegationRatio: "Delegation ratio",
    openRegionRevenueNotes: "Open per-region protocol revenue notes",
    perRegionRevenue: "Per-Region Protocol Revenue",
    region: "Region",
    threeMonth: "3 Month",
    farms: "Farms",
    gctlStakedSuffix: "GCTL staked",
    tokenEmissions: "Token Emissions Over Time",
    tokenBreakdown: "Token breakdown",
    glwTotal: "GLW total",
    fdvHelperAt: "at",
    embeddedUsdc: "Embedded USDC",
    glwPriceLower: "GLW price",
    reset: "Reset",
    priceHistory: "Price History ↗",
    coreMetrics: "Core Metrics",
    growthDetailsDesc: "Growth card details and mini-blog.",
    protocolLiquidity: "Protocol Liquidity",
    noRegionSelected: "No region selected.",
    fallbackCc: "Fallback from CC / week",
    shareOfTotal: "Share of Total",
    totalPds: "Total PDs",
    farmDetailsDesc: "Solar farm details and revenue stats.",
    selectFarmDetails: "Select a farm to view details.",
    panels: "panels",
    creditType: "Credit Type",
    generatedCreditsLifetime: "Generated Credits (Lifetime)",
    projectedLifetimeCredits: "Projected Lifetime Credits",
    numberOfPanels: "Number of Panels",
    openFarmDetails: (name: string) => `Open details for ${name}`,
    learnMore: "Learn more",
    readFullBlog: "Read the full blog",
    viewAllTopics: "View all topics",
    week: "Week",
    endowment: "Endowment",
    tradingBot: "Trading bot",
    revenueContribution: "Revenue contribution",
    last90Days: "Last 90 days",
    noRegionData: "No region data available.",
    liveBreakdownUnavailable: "Live breakdown unavailable.",
    activeDelegators: "Active Delegators",
    networkImpact: "Network Impact",
    networkImpactDesc:
      "Aggregate environmental output of Glow solar installations.",
    homesPoweredByCleanEnergy: "Homes powered by clean energy",
    totalPanels: "Total Panels",
    installedCapacity: "Installed Capacity",
    treesEquivalent: "Trees Equivalent",
    fullyDilutedValuation: "Fully Diluted Valuation",
    tokenFdvDesc: "Token FDV excluding embedded liquidity GLW.",
    tokenCategoryLabels: {
      solarFarms: "Solar farms",
      grants: "Grants",
      governance: "Governance",
      ecosystem: "Ecosystem",
      earlyStageFunding: "Early stage funding",
      lateStageFunding: "Late stage funding",
      grantsBootstrap: "Grants bootstrap",
      earlyLiquidityBootstrap: "Liquidity bootstrap",
    } as Record<string, string>,
  },
  ko: {
    clickForBasics: "기본 내용 보기 ↗",
    clickForNotes: "설명 보기 ↗",
    clickToExplore: "자세히 보기 ↗",
    liveUnavailable: "실시간 데이터 없음",
    open: "열기 ↗",
    overview: "개요",
    openGlowEconomy: "Glow 경제 설명 열기",
    marketCap: "시가총액",
    glwPrice: "GLW 가격",
    poolActivity: "풀 활동 보기 ↗",
    embeddedLiquidity: "내장 유동성",
    liquidityUnitValue: `1${LIQUIDITY_UNIT} 가치`,
    oneLiquidityUnit: "유동성 단위 1개",
    monthlySolarConstruction: "월간 태양광 구축",
    embeddedLiquidityGrowth3m: "내장 유동성 성장 (3개월)",
    annualizedCirculatingGrowth: "유통 공급량 연환산 성장",
    embeddedLiquidityGrowthMom: "내장 유동성 성장",
    mom: "전월 대비",
    supplyAndCirculation: "공급량 & 유통량",
    openSupplyModel: "공급 모델 탐색 열기",
    circulatingSupply: "유통량",
    circulating: "유통 중",
    vaulted: "보관됨",
    embeddedGlw: "내장 GLW",
    exploreSupplyModel: "공급 모델 탐색",
    solarFarmEconomics: "태양광 발전소 경제성",
    sortBy: "정렬 기준",
    latest: "최신순",
    lifetime: "누적",
    ccPerWeek: "CC / 주",
    seeAll: "전체 보기",
    generatedRevenue: "생성 수익",
    lifetimeProgress: "누적 진행률",
    embeddedLiquidityGctlWallets: "내장 유동성, GCTL, 지갑",
    openProtocolLiquidityNotes: "프로토콜 유동성 설명 열기",
    liquidity: "유동성",
    apy: "APY",
    marketCapExitable: "인출 가능 시가총액 비율",
    openGctlNotes: "GCTL 설명 열기",
    totalGctl: "총 GCTL",
    mintPrice: "민트 가격",
    staked: "스테이킹됨",
    unstaked: "스테이킹 안 됨",
    stakingByRegion: "지역별 스테이킹",
    openWalletStatsNotes: "지갑 통계 설명 열기",
    walletStats: "지갑 통계",
    glwHolders: "GLW 보유자",
    protocolParticipants: "프로토콜 참여자",
    newWalletsPerWeek: "주간 신규 지갑",
    walletBreakdown: "지갑 구성",
    walletBreakdownLabels: {
      Delegators: "위임자",
      Miners: "마이너",
      "GCTL holders": "GCTL 보유자",
    } as Record<string, string>,
    delegationRegions: "위임 + 지역",
    openDelegationNotes: "위임 지표 설명 열기",
    delegationMetrics: "위임 지표",
    glwDelegated: "위임된 GLW",
    delegators: "위임자",
    estimatedApy: "예상 APY",
    delegationGrowth: "위임 성장 (V2)",
    current: "현재",
    delegated: "위임됨",
    delegationRatio: "위임 비율",
    openRegionRevenueNotes: "지역별 프로토콜 수익 설명 열기",
    perRegionRevenue: "지역별 프로토콜 수익",
    region: "지역",
    threeMonth: "3개월",
    farms: "발전소",
    gctlStakedSuffix: "GCTL 스테이킹",
    tokenEmissions: "시간별 토큰 발행",
    tokenBreakdown: "토큰 구성",
    glwTotal: "GLW 총량",
    fdvHelperAt: "가격 기준",
    embeddedUsdc: "내장 USDC",
    glwPriceLower: "GLW 가격",
    reset: "초기화",
    priceHistory: "가격 내역 ↗",
    coreMetrics: "핵심 지표",
    growthDetailsDesc: "성장 카드 세부 정보와 미니 블로그입니다.",
    protocolLiquidity: "프로토콜 유동성",
    noRegionSelected: "선택한 지역이 없습니다.",
    fallbackCc: "CC / 주 기준 대체값",
    shareOfTotal: "전체 비중",
    totalPds: "총 PD",
    farmDetailsDesc: "태양광 발전소 세부 정보와 수익 통계입니다.",
    selectFarmDetails: "세부 정보를 보려면 발전소를 선택하세요.",
    panels: "패널",
    creditType: "크레딧 유형",
    generatedCreditsLifetime: "생성된 크레딧 (누적)",
    projectedLifetimeCredits: "예상 누적 크레딧",
    numberOfPanels: "패널 수",
    openFarmDetails: (name: string) => `${name} 세부 정보 열기`,
    learnMore: "더 알아보기",
    readFullBlog: "전체 블로그 읽기",
    viewAllTopics: "전체 주제 보기",
    week: "주",
    endowment: "Endowment",
    tradingBot: "트레이딩 봇",
    revenueContribution: "수익 기여도",
    last90Days: "최근 90일",
    noRegionData: "지역 데이터가 없습니다.",
    liveBreakdownUnavailable: "실시간 구성 데이터를 사용할 수 없습니다.",
    activeDelegators: "활성 위임자",
    networkImpact: "네트워크 임팩트",
    networkImpactDesc: "Glow 태양광 설치의 종합 환경 성과입니다.",
    homesPoweredByCleanEnergy: "청정 에너지 공급 가구 수",
    totalPanels: "총 패널 수",
    installedCapacity: "설치 용량",
    treesEquivalent: "나무 환산치",
    fullyDilutedValuation: "완전 희석 가치",
    tokenFdvDesc: "내장 유동성 GLW를 제외한 토큰 FDV입니다.",
    tokenCategoryLabels: {
      solarFarms: "태양광 발전소",
      grants: "그랜트",
      governance: "거버넌스",
      ecosystem: "생태계",
      earlyStageFunding: "초기 단계 펀딩",
      lateStageFunding: "후기 단계 펀딩",
      grantsBootstrap: "그랜트 부트스트랩",
      earlyLiquidityBootstrap: "유동성 부트스트랩",
    } as Record<string, string>,
  },
} as const;

function usePolCopy() {
  const { lang } = useLang();
  return POL_COPY[lang];
}

const NUMBER_FORMATTER_WHOLE = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const NUMBER_FORMATTER_COMPACT_1 = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const NUMBER_FORMATTER_COMPACT_2 = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_FORMATTER_UP_TO_2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const NUMBER_FORMATTER_UP_TO_2_OR_1_SMALL = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const NUMBER_FORMATTER_UP_TO_2_OR_1_LARGE = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const USD_FORMATTER_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const USD_FORMATTER_COMPACT_1 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const USD_FORMATTER_2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const USD_FORMATTER_4 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});
const DATE_FORMATTER_SHORT_UTC = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const DATE_FORMATTER_AXIS_UTC = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const DATE_FORMATTER_MONTH_UTC = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

// TODO: mock data (fallback if live regions unavailable)
const GCTL_REGIONS = [
  { name: "Golden Colorado", value: 38, color: "#a855f7" },
  { name: "Rising Utah", value: 24, color: "#2081e2" },
  { name: "Shining Missouri", value: 18, color: "#ffb472" },
  { name: "Clean Grid", value: 12, color: "#4ade80" },
  { name: "Other", value: 8, color: "#94a3b8" },
];

// TODO: mock data (delegation trend + APY history)
// TODO: mock data (vesting schedule)
const VESTING_SCHEDULE = [
  { year: "2024", unlocked: 10 },
  { year: "2025", unlocked: 18 },
  { year: "2026", unlocked: 28 },
  { year: "2027", unlocked: 44 },
  { year: "2028", unlocked: 60 },
  { year: "2029", unlocked: 72 },
  { year: "2030", unlocked: 86 },
];

const POL_LIQUIDITY_GREEN = "hsl(142, 71%, 45%)";

// Token Supply chart palette from app/globals.css design tokens.
const VESTING_CATEGORIES = [
  {
    key: "solarFarms" as const,
    label: "Solar farms",
    color: POL_LIQUIDITY_GREEN,
  },
  {
    key: "grants" as const,
    label: "Grants",
    color: "var(--color-glow-orange)",
  },
  {
    key: "governance" as const,
    label: "Governance",
    color: "var(--color-governance-accent)",
  },
  {
    key: "ecosystem" as const,
    label: "Ecosystem",
    color: "var(--color-miner)",
  },
  {
    key: "earlyStageFunding" as const,
    label: "Early stage funding",
    color: "var(--color-4)",
  },
  {
    key: "lateStageFunding" as const,
    label: "Late stage funding",
    color: "var(--color-glow-purple)",
  },
  {
    key: "grantsBootstrap" as const,
    label: "Grants bootstrap",
    color: "var(--color-5)",
  },
  {
    key: "earlyLiquidityBootstrap" as const,
    label: "Liquidity bootstrap",
    color: "var(--color-1)",
  },
];

const vestingCategoryChartConfig = Object.fromEntries(
  VESTING_CATEGORIES.map((c) => [c.key, { label: c.label, color: c.color }]),
) as Record<string, { label: string; color: string }> satisfies ChartConfig;

const vestingChartConfig = {
  unlocked: { label: "Unlocked supply", color: "var(--color-glow-orange)" },
} satisfies ChartConfig;

const delegationTrendChartConfig = {
  delegated: { label: "GLW delegated (M)", color: "hsl(270, 70%, 60%)" },
} satisfies ChartConfig;

const gctlRegionChartConfig = Object.fromEntries(
  GCTL_REGIONS.map((r) => [r.name, { label: r.name, color: r.color }]),
) as Record<string, { label: string; color: string }> satisfies ChartConfig;

const GCTL_REGION_PIE_DATA = GCTL_REGIONS.map((r) => ({
  name: r.name,
  value: Math.round((284_000 * r.value) / 100),
  fill: r.color,
  pct: r.value,
}));

const walletGrowthChartConfig = {
  newWallets: { label: "New wallets", color: "hsl(215, 90%, 55%)" },
} satisfies ChartConfig;

const polLiquidityChartConfig = {
  liquidity: { label: "Embedded liquidity", color: POL_LIQUIDITY_GREEN },
} satisfies ChartConfig;

const supplyCirculationChartConfig = {
  circulating: { label: "Circulating", color: "#4ade80" },
  vaulted: { label: "Vaulted", color: "#a855f7" },
  pol: { label: "Embedded GLW", color: "#ffb472" },
} satisfies ChartConfig;

const REGION_COLORS: Record<string, string> = {
  "Golden Colorado": "#a855f7",
  "Rising Utah": "#2081e2",
  "Shining Missouri": "#ffb472",
  "Clean Grid Project": "#4ade80",
  "Steadfast Idaho": "#14b8a6",
  "Noble Oklahoma": "#ec4899",
  "Ratan Rajasthan": "#eab308",
};
const DEFAULT_REGION_COLOR = "#94a3b8";

const SectionHeader = React.memo(function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
        {title}
      </div>
      {subtitle ? (
        <p className="text-sm text-muted-foreground max-w-3xl">{subtitle}</p>
      ) : null}
    </div>
  );
});

SectionHeader.displayName = "SectionHeader";

function formatNumber(value: number) {
  return NUMBER_FORMATTER_WHOLE.format(value);
}

function formatUsdCompact(value: number) {
  return formatUsdCompactPrecise(value);
}

// For hero KPIs where we always want compact currency formatting (e.g. `$335.7K`)
// instead of switching to full numbers in the mid-six-fig range.
function formatUsdCompactHero(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000) {
    return USD_FORMATTER_COMPACT_1.format(value);
  }

  return abs < 1
    ? USD_FORMATTER_4.format(value)
    : USD_FORMATTER_2.format(value);
}

function formatUsdCompactPrecise(value: number) {
  const abs = Math.abs(value);

  // Keep USD formatting consistent with compact numbers:
  // - Avoid confusing outputs like `$359.922K`.
  // - For mid 6-figure values, show the full number instead of `K`.
  if (abs >= 100_000 && abs < 1_000_000) {
    return USD_FORMATTER_WHOLE.format(value);
  }

  if (abs >= 1_000) {
    return USD_FORMATTER_COMPACT_1.format(value);
  }

  return abs < 1
    ? USD_FORMATTER_4.format(value)
    : USD_FORMATTER_2.format(value);
}

function formatUsdWhole(value: number) {
  return USD_FORMATTER_WHOLE.format(value);
}

function formatCompactNumberPrecise(value: number) {
  const abs = Math.abs(value);

  // Avoid confusing outputs like `359.922K`:
  // - If we use compact (K/M/B), cap at 1 decimal.
  // - For mid 6-figure values, show the full number instead of a highly precise `K`.
  if (abs >= 100_000 && abs < 1_000_000) {
    return NUMBER_FORMATTER_WHOLE.format(value);
  }

  if (abs >= 1_000) {
    return NUMBER_FORMATTER_COMPACT_1.format(value);
  }

  return abs < 10
    ? NUMBER_FORMATTER_UP_TO_2_OR_1_SMALL.format(value)
    : NUMBER_FORMATTER_UP_TO_2_OR_1_LARGE.format(value);
}

function formatCompactNumberTwoDecimals(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000) {
    return NUMBER_FORMATTER_COMPACT_2.format(value);
  }
  return NUMBER_FORMATTER_UP_TO_2.format(value);
}

function formatCompactNumberForceCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000) {
    return NUMBER_FORMATTER_COMPACT_1.format(value);
  }
  return abs < 10
    ? NUMBER_FORMATTER_UP_TO_2_OR_1_SMALL.format(value)
    : NUMBER_FORMATTER_UP_TO_2_OR_1_LARGE.format(value);
}

function formatLiquidityCompact(value: number) {
  return `${LIQUIDITY_UNIT}${formatCompactNumberForceCompact(value)}`;
}

function formatCompactNumber(value: number) {
  return NUMBER_FORMATTER_COMPACT_1.format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatSignedNumber(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
}

function formatNullableNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatNumber(value);
}

function formatNullableCompact(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatCompactNumberPrecise(value);
}

function formatNullableFixed(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatDateShortUtc(value: Date) {
  return DATE_FORMATTER_SHORT_UTC.format(value);
}

function formatDateAxisUtc(value: Date) {
  return DATE_FORMATTER_AXIS_UTC.format(value);
}

function formatMonthAxisUtc(value: Date) {
  return DATE_FORMATTER_MONTH_UTC.format(value);
}

function getWeekStartMs(weekNumber: number) {
  return (GENESIS_TIMESTAMP + weekNumber * SECONDS_PER_WEEK) * 1000;
}

function getWeekEndMs(weekNumber: number) {
  return getWeekStartMs(weekNumber) + SECONDS_PER_WEEK * 1000;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : null;
  if (parsed === null || !Number.isFinite(parsed)) return null;
  return parsed;
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  const random = mulberry32(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled;
}

function reservesToLiquidity(usdc: number, glw: number) {
  return Math.sqrt(Math.abs(usdc) * Math.abs(glw));
}

function getBreakdownFromLq(liquidity: number, pricePerGlw: number) {
  const normalizedPrice = Math.max(pricePerGlw, 0.0001);
  const absLq = Math.abs(liquidity);
  const usdgSide = absLq * Math.sqrt(normalizedPrice);
  const glwSide = usdgSide / normalizedPrice;

  return {
    usdgSide,
    glwSide,
    breakdown: `$${formatCompactNumber(usdgSide)} / ${formatCompactNumber(
      glwSide,
    )} GLW`,
  };
}

function getLiquidityFromReserves(usdc: number, glw: number) {
  const liquidity = reservesToLiquidity(usdc, glw);

  return {
    liquidity,
    value: formatLiquidityCompact(liquidity),
    breakdown: `$${formatCompactNumber(usdc)} / ${formatCompactNumber(
      glw,
    )} GLW`,
  };
}

function isSolarPanelsImageUrl(url: string) {
  const lower = url.toLowerCase();
  // Heuristic: our curated farm photos that show panels are typically saved as
  // "after_install_pictures_*" (often drone shots). Keep strict to avoid
  // unrelated photos.
  return (
    lower.includes("after_install_pictures") ||
    lower.includes("after-install") ||
    lower.includes("solar_panel") ||
    lower.includes("solar-panel") ||
    lower.includes("solarpanel")
  );
}

function pickSolarPanelsImageUrl(
  urls: Array<string | null | undefined>,
): string | null {
  for (const url of urls) {
    if (!url) continue;
    if (isSolarPanelsImageUrl(url)) return url;
  }
  return null;
}

function buildImageProxyUrl(url: string, width?: number, quality: number = 75) {
  if (!url || url.startsWith("/images/") || url.startsWith("/")) {
    return url;
  }
  const params = new URLSearchParams({
    url,
    ...(width ? { w: width.toString() } : {}),
    q: quality.toString(),
  });
  return `/api/image-proxy?${params.toString()}`;
}

type WalletGrowthDatum = {
  week: string;
  newWallets: number;
  weekNumber?: number;
  weekStartMs?: number;
  weekEndMs?: number;
};

type DelegationTrendDatum = {
  week: string;
  delegated: number;
  weekNumber: number;
  weekStartMs: number;
  weekEndMs: number;
  isCurrent?: boolean;
};

type FarmRow = {
  key: string;
  farmId: string | null;
  name: string;
  region: string;
  panels: number;
  lifetimeLq: number | null;
  ccLifetime: number;
  ccPerWeek: number;
  projectedLifetimeCredits: number | null;
  creditType: string;
  lifetimeWeeksElapsed: number | null;
  lifetimeWeeksTarget: number;
  imageUrl: string | null;
  recencyKey?: number;
  auditWeek?: number | null;
};

type GrowthCardKey =
  | "installations"
  | "liquidityGrowth"
  | "circulatingGrowth"
  | "embeddedGrowth";

type MiniBlogId =
  | "glow-economy-basics"
  | "glw-token-basics"
  | "liquidity-basics"
  | "control-basics"
  | "solar-installations-basics"
  | "uniswap-vs-protocol-liquidity"
  | "glow-endowment"
  | "embedded-liquidity-growth-basics"
  | "circulating-supply-basics"
  | "why-liquidity-instead-of-dollars"
  | "farm-revenue-distribution"
  | "wallet-participants-basics"
  | "delegation-metrics-basics"
  | "region-revenue-basics"
  | "network-impact-basics"
  | "emissions-schedule"
  | "delegating-tokens"
  | "glw-token-value"
  | "embedded-liquidity"
  | "minting-gctl"
  | "embedded-glw-supply"
  | "constant-product-rule"
  | "superlinear-market-cap"
  | "100-weeks-of-rewards"
  | "durable-liquidity"
  | "market-cap-exitable"
  | "endowment-bot"
  | "delegations-operational-risk"
  | "token-fdv"
  | "glw-miners"
  | "gctl-staking";

type MiniBlogEntry = {
  title: string;
  paragraphs: string[];
  learnMore?: MiniBlogId[];
  externalLink?: { url: string; label: string };
};

type MiniBlogCluster = MiniBlogGraphCluster;

type ModalBlogKey =
  | "overview"
  | "growthCards"
  | "supply"
  | "farm"
  | "polLiquidity"
  | "gctl"
  | "walletStats"
  | "delegation"
  | "regions"
  | "networkImpact"
  | "tokenEmissions";

type ModalBlogState = {
  current: MiniBlogId;
  history: MiniBlogId[];
};

const MINI_BLOGS: Record<MiniBlogId, MiniBlogEntry> = {
  "glow-economy-basics": {
    title: "The Glow Economy",
    paragraphs: [
      "Just as Bitcoin turned tokens into mining machines, Glow turns tokens into solar farms. And just as BTC is the main token of the Bitcoin economy, GLW is the main token of the Glow economy. Each week, new GLW is minted and distributed to solar farms being built on the protocol.",
      "Glow generates revenue by selling the ability to control where these solar farms get built. When participants pay to mint a token called Glow Control (GCTL), the funds are used to permanently add liquidity to GLW. Because this liquidity can never be removed, it is called Embedded Liquidity.",
    ],
    learnMore: ["glw-token-basics", "control-basics", "embedded-liquidity"],
  },
  "glw-token-basics": {
    title: "The GLW Token",
    paragraphs: [
      "GLW is the native token of the Glow protocol. Each week, the protocol mints GLW and distributes it across three economic stakeholder groups: active solar farms competing for mining rewards, the grants pool, and the Glow Foundation for operational expenses.",
      "Solar farms earn GLW by producing verified clean energy and competing on impact per dollar of electricity revenue earned. GLW token holders can share in these rewards by delegating their GLW to the solar farms, which helps the solar farms to meet the financial requirements of the protocol.",
    ],
    learnMore: ["emissions-schedule", "delegating-tokens", "glw-token-value"],
  },
  "liquidity-basics": {
    title: "Liquidity Fundamentals",
    paragraphs: [
      "A liquidity pool is best understood as an automatically rebalancing portfolio that holds two assets, in this case GLW and USDC. The pool guarantees that there will be a buyer when someone wants to sell and a seller when someone wants to buy. In exchange for this service, the pool collects a fee on each swap.",
      "The portfolio continuously rebalances to maintain a target ratio between its two assets. If the GLW price falls, the portfolio now holds more USDC value than GLW value, so it uses some of its USDC to buy GLW, restoring the balance. If the GLW price rises, it sells some GLW for USDC. This automatic rebalancing means the pool always has depth on both sides of the market, and it earns fees on every trade that passes through it.",
    ],
    learnMore: ["constant-product-rule"],
  },
  "control-basics": {
    title: "Glow Control",
    paragraphs: [
      "Glow is a protocol that produces large amounts of solar power, and the Glow Control token allows stakeholders to direct where in the world that solar power is produced. GCTL holders stake their tokens to specific geographic regions, and the protocol allocates rewards proportionally. The more GCTL staked to a region, the larger share of protocol resources and farm rewards that region receives.",
      "When GCTL is minted, the funds paid flow directly into the Glow Endowment, permanently deepening the embedded liquidity behind GLW. This creates a direct link between governance participation and protocol strength: every decision to steer where solar gets built simultaneously reinforces the economic foundation of the token.",
    ],
    learnMore: ["minting-gctl", "glow-endowment"],
  },
  "solar-installations-basics": {
    title: "Monthly Solar Construction",
    paragraphs: [
      'Within the Glow ecosystem, the term "solar farm" refers to any solar installation of any size, ranging from 4kW residential rooftop systems to 16 MW utility-scale arrays. Each farm competes for GLW rewards based on its impact efficiency relative to all other farms in the same region.',
      "Monthly Solar Construction measures how fast Glow adds new generation capacity. It is calculated by summing the nameplate capacity of every farm that became active on Glow within the trailing 13 weeks, averaging that total across a 4-week month, and reporting the result in kilowatts.",
      "Farms are active on the Glow protocol for exactly 100 weeks. During this window, they earn GLW tokens, compete with farms in their region, and recover delegator protocol deposits based on performance. After 100 weeks, the farm stops receiving GLW rewards and its protocol deposit has been fully distributed, but the solar installation itself continues producing clean energy and generating verified impact for decades beyond the initial reward window.",
    ],
    learnMore: ["farm-revenue-distribution"],
  },
  "uniswap-vs-protocol-liquidity": {
    title: "Uniswap Liquidity vs Embedded Liquidity",
    paragraphs: [
      "Liquidity on standard DEXs like Uniswap is owned by individual LPs. These are traders, funds, and institutions who deposit tokens to earn trading fees and can withdraw their liquidity at any time. If markets experience higher than expected volatility, rational LPs pull their capital to avoid further impermanent losses.",
      "This means that LPs face the strongest incentive to withdraw at exactly the moment liquidity matters most. If enough LPs withdraw simultaneously, the pool's available depth can shrink to a fraction of its prior level before other participants have had the opportunity to trade.",
      "Embedded liquidity solves this problem by removing the withdrawal option entirely. Because the Glow Endowment's liquidity position is permanent, it continues providing market depth through volatility, downturns, and panic selling. The liquidity is there precisely when it matters most, and it compounds through trading fees regardless of market conditions. This is why embedded liquidity provides a fundamentally stronger foundation than LP-supplied liquidity for long-term token stability.",
    ],
    learnMore: ["why-liquidity-instead-of-dollars", "embedded-liquidity"],
  },
  "glow-endowment": {
    title: "The Glow Endowment",
    paragraphs: [
      "The Glow Endowment is embedded liquidity in the GLW/USDC Uniswap pool. When Glow earns protocol revenue, it is used to purchase GLW tokens on the open market. The resulting GLW and remaining USDC are committed together as a permanent liquidity position that cannot be withdrawn.",
      "Because the Endowment is a Uniswap LP position, it automatically rebalances through trading activity. When GLW appreciates, the pool sells GLW and accumulates USDC. When GLW declines, the pool uses its USDC reserves to buy GLW out of circulation. This rebalancing requires no human intervention and provides depth for traders in both directions regardless of market conditions.",
      "The Endowment earns trading fees on every swap, and these fees compound directly back into the position. Revenue from GCTL minting adds new capital, and trading fees compound on top of it. The result is a liquidity position that gains momentum over time, providing deeper markets and greater price stability as it grows.",
    ],
  },
  "embedded-liquidity-growth-basics": {
    title: "Embedded Liquidity Growth",
    paragraphs: [
      "Embedded liquidity growth measures how quickly the Glow Endowment's permanent liquidity position is compounding. The growth rate, expressed as an APY, reflects two sources of new capital entering the position: revenue from GCTL minting and trading fees earned on every swap in the pool.",
      "Because the Endowment is still in its early scaling phase, annualized growth rates can be high even as the absolute depth of the position increases. As the base grows larger, the APY may moderate, but the absolute dollar amount added per period continues to rise. Tracking this growth rate shows how quickly the protocol's liquidity foundation is strengthening over time.",
    ],
    learnMore: ["market-cap-exitable", "endowment-bot"],
  },
  "circulating-supply-basics": {
    title: "GLW Circulating Supply",
    paragraphs: [
      "Not all GLW is freely tradeable. The two largest non-circulating categories are embedded GLW and delegated GLW. Embedded GLW is permanently locked inside the Glow Endowment's liquidity position and can only re-enter circulation if swapped for USDC. Delegated GLW is committed to solar farm vaults for 100-week periods, making it unavailable for trading until earned back.",
      "Beyond these two primary categories, the protocol also holds GLW across several contract wallets including the Grants Treasury, the Veto Council, the GCA and Miner Pool, and the Early Liquidity allocation. Circulating supply is the portion that remains after removing all of these balances, reflecting the tokens genuinely accessible to market participants at any given time.",
    ],
    learnMore: ["embedded-glw-supply", "superlinear-market-cap"],
  },
  "why-liquidity-instead-of-dollars": {
    title: "Why Liquidity not Dollars?",
    paragraphs: [
      "Liquidity monotonically increases for a given LP position. As the price moves, the LP's dollar amount and token counts shift, but their liquidity amount strictly stays the same or grows from accumulated trading fees. A position that started at 1,000 units of liquidity will never fall below 1,000 units of liquidity, regardless of what happens to the price.",
      "Dollar-denominated metrics fluctuate with price. If GLW doubles in value, the dollar value of GLW reserves in the pool doubles too, but the pool now holds fewer GLW tokens and more USDC due to rebalancing. The pool's actual capacity to absorb a large GLW sale has decreased, even though the dollar figure went up. Using liquidity instead of dollar-denominated price as the reference metric for token health tracks the compounding growth and stability of the Glow token ecosystem over time.",
      "This property is especially significant for the Glow Endowment. The Endowment is a permanent LP position in the GLW/USDC pool that earns fees on every swap. Those fees compound directly back into the position, so the Endowment's liquidity grows even without new protocol revenue inflows. Revenue from GCTL minting adds new capital, and trading fees compound on top of it. The result is a liquidity position that gains momentum and only increases in depth over time.",
    ],
    learnMore: ["glow-endowment"],
  },
  "farm-revenue-distribution": {
    title: "Solar Farm Value",
    paragraphs: [
      "Every region provides value to the Glow protocol, and each solar farm provides value to the region that it resides within. This value flows into the protocol's embedded liquidity through three revenue streams: miner sales, GCTL mint attribution, and GCTL yield attribution.",
      "Miner sales occur when farms sell portions of their GLW reward streams. The proceeds, minus operational bounties paid to the farm, enter the Endowment as new liquidity. GCTL mint attribution distributes a share of new GCTL minting revenue to each farm based on the GCTL staked in its region and the farm's verified impact credits within that region. GCTL yield attribution works the same way, but distributes the Endowment's earned trading fees and rebalancing gains rather than new capital.",
    ],
  },
  "wallet-participants-basics": {
    title: "Wallet Stats",
    paragraphs: [
      "Protocol participants are wallets that have engaged in meaningful on-chain activity within the Glow ecosystem. A wallet qualifies as a participant the first time it performs any protocol action: purchasing a mining fraction, appearing in a reward distribution, or staking GCTL.",
      "Participants break down into three overlapping categories. Delegators hold active vault ownership shares and have committed GLW to back solar farms. Miners have purchased mining-center fractions to participate in the competitive reward system. GCTL holders maintain a non-zero stake, directing where the protocol builds solar infrastructure.",
      "The dashboard tracks the total number of protocol participants alongside the rate of new wallet activity per week. This provides a view of both the current size of the Glow economy and the pace at which new participants are entering.",
    ],
    learnMore: ["delegating-tokens", "glw-miners", "gctl-staking"],
  },
  "delegation-metrics-basics": {
    title: "Aggregate Delegation Mechanics",
    paragraphs: [
      "Each week, GLW token holders delegate their tokens to solar farms by locking them into vaults that serve as protocol deposits. These deposits are required for farms to participate in the competitive mining system. Once delegated, the GLW is committed for the duration of the farm's 100-week reward lifecycle, during which it is gradually released back into circulation as the deposit is recovered.",
      "Delegated GLW does not count as part of the circulating supply. Because it is locked in vaults and unavailable for trading, it effectively removes tokens from the market for an extended period. The aggregate amount of GLW currently delegated, combined with the rate at which older delegations are releasing tokens, determines the net impact of delegation on circulating supply at any given time.",
    ],
    learnMore: ["delegating-tokens", "circulating-supply-basics"],
  },
  "region-revenue-basics": {
    title: "Per-Region Revenue",
    paragraphs: [
      "Glow operates across multiple geographic regions, each with its own pool of competing solar farms. Within each region, farms compete on verified impact efficiency. Farms that produce more impact per dollar of electricity revenue capture a larger share of the region's allocated rewards.",
      "Each region generates revenue based on its total impact, and the total interest in the region from Glow ecosystem participants.",
    ],
  },
  "network-impact-basics": {
    title: "Network Impact",
    paragraphs: [
      "Network impact measures the aggregate environmental output of every solar installation on the Glow protocol. These figures represent the real-world energy production and carbon displacement generated by the farms that the token economy supports.",
      "The dashboard tracks four headline metrics: total solar panels installed across all farms, total energy generation capacity in megawatts per year, the equivalent number of homes powered by that energy, and the equivalent number of adult trees needed to offset the same amount of carbon. Each metric grows as new farms join and existing installations continue producing clean energy beyond their 100-week reward window.",
      "These metrics are the heartbeat the Glow protocol. Every token minted, every delegation made, and every GCTL staked ultimately exists to drive these impact figures higher. The network impact dashboard connects the token economy back to its physical purpose: building and sustaining verified solar infrastructure at scale.",
    ],
  },
  "emissions-schedule": {
    title: "Emissions Schedule",
    paragraphs: [
      "Each week, the Glow protocol mints 230,000 new GLW tokens and allocates them across three groups: 175,000 to active solar farms competing for mining rewards, 40,000 to the grants pool for ecosystem development, and 15,000 to the Glow Foundation for governance and operational expenses.",
      "This fixed weekly emission is the only source of new GLW. There is no variable or discretionary minting. The predictable schedule allows participants to model future supply with certainty and evaluate how delegation rewards, farm economics, and circulating supply will evolve over time.",
    ],
    externalLink: {
      url: "https://glow.org/blog/glow-tokenomics-overview",
      label: "Glow Tokenomics Overview",
    },
    // learnMore: ["glw-token-basics"],
  },
  "delegating-tokens": {
    title: "Delegating GLW",
    paragraphs: [
      "To participate in Glow's solar mining incentives, solar farms must post a protocol deposit. Delegation allows GLW token holders to provide this deposit on behalf of a farm, committing their GLW for 100 weeks. In return, delegators earn two types of rewards: deposit recovery based on the farm's competitive performance, and a share of the farm's weekly GLW inflation rewards.",
      "The task of the delegator is to evaluate which farms offer attractive reward terms relative to their competitive standing, and commit GLW accordingly.",
    ],
    learnMore: ["delegations-operational-risk"],
  },
  "glw-token-value": {
    title: "GLW Token Value",
    paragraphs: [
      "The fundamental value of GLW is anchored by its embedded liquidity. The Glow Endowment is a permanent liquidity position that grows from GCTL minting revenue and compounding trading fees. Because this liquidity can never be withdrawn, it establishes a floor of market depth beneath the token price that only increases over time.",
      "Consider the long-term picture: after early speculation fades and trading volume normalizes, the embedded liquidity remains. It represents real capital that was generated by the protocol's economic activity and permanently committed to supporting the token. Unlike speculative demand, which is cyclical, embedded liquidity is cumulative. Every dollar that enters the Endowment stays forever, making the price floor progressively stronger as the protocol scales.",
    ],
    learnMore: ["glow-endowment", "embedded-liquidity"],
  },
  "embedded-liquidity": {
    title: "Embedded Liquidity",
    paragraphs: [
      "Embedded liquidity is permanently committed to the GLW/USDC trading pool. Unlike standard liquidity provided by individuals who can withdraw at any time, embedded liquidity is a one-way commitment. Once it enters the pool, it cannot be removed. This guarantees that a baseline of market depth is always available for GLW holders to trade against, regardless of market conditions.",
      "Embedded liquidity grows as the protocol generates revenue from two sources. The first is revenue from people minting new Glow Control (GCTL), and the second is from collecting trading fees as people interact with the trading pool. Because the position is permanent, these fees accumulate indefinitely, and a larger position earns more fees, which in turn grows the position faster. The result is a self-reinforcing liquidity foundation that deepens over time.",
    ],
    learnMore: ["liquidity-basics", "durable-liquidity"],
  },
  "minting-gctl": {
    title: "Minting GCTL",
    paragraphs: [
      "Anyone can mint new GCTL tokens using USDC. The price to mint one GCTL equals the square root of the current GLW token price, rounded to the nearest five cents. For example, if GLW is worth $9, one GCTL costs approximately $3 to mint. If GLW is worth $100, the mint price would be approximately $10.",
      "All funds used to mint GCTL become embedded liquidity, which provides permanent liquidity support for the GLW token. Each GCTL minted strengthens the GLW economy by deepening the embedded liquidity that underpins the token's market depth and price stability.",
    ],
    learnMore: ["embedded-liquidity"],
  },
  "embedded-glw-supply": {
    title: "Embedded GLW Supply",
    paragraphs: [
      "The GLW inside the Glow Endowment's liquidity position is permanently committed and cannot be withdrawn or traded independently. This portion of the total GLW supply is effectively removed from circulation, reducing the number of tokens available on the open market.",
      "Because the Endowment is a Uniswap LP position, its GLW balance changes with price. When the GLW price falls, the pool's automated rebalancing uses USDC reserves to buy GLW, increasing the amount of GLW held inside the position and further reducing circulating supply. When the price rises, the pool sells GLW for USDC, releasing some back toward the market. The result is a supply that naturally tightens during downturns and loosens during upswings, providing a stabilizing force on the token economy.",
    ],
    learnMore: ["embedded-liquidity"],
  },
  "constant-product-rule": {
    title: "The Constant Product Rule",
    paragraphs: [
      "The constant product rule is the mathematical foundation behind automated market makers like Uniswap. It states that the product of the two token reserves in a pool must remain constant: x * y = k, where x is the quantity of one token, y is the quantity of the other, and k is a constant that only grows from accumulated fees.",
      "When someone buys GLW from the pool, they add USDC and remove GLW. The USDC reserve increases, the GLW reserve decreases, but x * y still equals k. This constraint is what forces the price to move: as GLW becomes scarcer in the pool, each additional unit costs more. The rule guarantees that the pool can always quote a price and always has liquidity available, no matter how large or small the trade.",
    ],
    externalLink: {
      url: "https://glow.org/blog/providing-liquidity-for-profit",
      label: "Providing Liquidity for Profit",
    },
  },
  "superlinear-market-cap": {
    title: "Superlinear Market Cap",
    paragraphs: [
      "In traditional markets, market cap scales linearly with price: double the price, double the market cap. In a system with embedded liquidity, the relationship becomes superlinear. As the GLW price rises, the Endowment's USDC reserves grow from rebalancing, and its fee income increases from higher trading volume. Both effects compound the Endowment's depth faster than price alone would suggest.",
      "This superlinear dynamic means that embedded liquidity provides disproportionately stronger support at higher valuations. The protocol's liquidity foundation doesn't just keep pace with growth, it accelerates ahead of it, creating a widening moat of market depth that makes the token increasingly resilient as it scales.",
    ],
    learnMore: ["market-cap-exitable", "glw-token-value"],
  },
  "100-weeks-of-rewards": {
    title: "100 Weeks of Rewards",
    paragraphs: [
      "Every solar farm on the Glow protocol operates on a fixed 100-week reward lifecycle. During this window, the farm earns GLW tokens by competing with other farms in its region on verified impact efficiency. The farm's protocol deposit is also recovered over this period based on competitive performance.",
      "After 100 weeks, the farm stops receiving GLW rewards and its protocol deposit has been fully distributed. However, the solar installation itself continues producing clean energy for decades. The 100-week window defines the economic engagement period, not the useful life of the farm. New farms continuously enter the protocol, maintaining competitive pressure and ensuring the network's efficiency keeps improving.",
    ],
    learnMore: ["delegating-tokens", "solar-installations-basics"],
  },
  "durable-liquidity": {
    title: "Durable Liquidity",
    paragraphs: [
      "Total effective liquidity in any token economy has two components: withdrawable liquidity and embedded liquidity. Withdrawable liquidity is capital provided by external LPs who are there to earn yield. It is mobile and mercenary: when conditions change, these LPs withdraw. Embedded liquidity is capital that exists because the protocol itself generated it. It is permanent and cannot be removed.",
      "Because withdrawable liquidity is unreliable under stress, it should be discounted by a stability factor when assessing how much liquidity a protocol can actually depend on. In most DeFi systems, only a fraction of LP capital is truly sticky. Glow's design targets a steady state where embedded liquidity vastly exceeds withdrawable liquidity, meaning the protocol's market depth is generated by real economic activity rather than rented through emissions.",
    ],
  },
  "market-cap-exitable": {
    title: "Market Cap Exitable",
    paragraphs: [
      "Market cap exitable measures the portion of a token's total market capitalization that could realistically be converted to dollars without catastrophic slippage. For most tokens, the exitable fraction is a small percentage of the headline market cap because liquidity is shallow and provided by mobile LPs who withdraw under stress.",
    ],
  },
  "endowment-bot": {
    title: "The Endowment Bot",
    paragraphs: [
      "The Endowment Bot is an automated system that manages the Glow Endowment's liquidity operations. It handles the mechanics of converting protocol revenue into permanent liquidity positions, ensuring that every dollar of GCTL minting revenue and every fee earned by the pool is efficiently compounded back into the Endowment.",
    ],
  },
  "delegations-operational-risk": {
    title: "Expectation-Based Rewards",
    paragraphs: [
      "Delegators are protected from operational risk when backing solar farms on the Glow protocol. Rewards are calculated based on a farm's audited performance capabilities rather than its actual energy output, so weather events, equipment downtime, or seasonal variation do not reduce delegator returns.",
      "This design separates the financial risk of delegation from the physical risk of solar operation. Delegators evaluate farms based on their competitive standing, reward terms, and verified capabilities. The farm operator bears the operational risk of maintaining equipment and maximizing output, while the delegator's returns are tied to the farm's protocol-level metrics.",
    ],

    externalLink: {
      url: "https://glow.org/blog/rewards-with-great-expectations",
      label: "Rewards with Great Expectations",
    },
  },
  "token-fdv": {
    title: "Token FDV",
    paragraphs: [
      "Fully diluted valuation (FDV) estimates the total value of all GLW tokens that will ever exist, priced at today's market rate. The Glow protocol mints 230,000 GLW per week over a defined emission schedule, and FDV projects the value of the complete final supply at the current token price.",
      "Importantly, not all GLW counts toward the effective FDV. GLW that is permanently embedded inside the Endowment's liquidity position is excluded because it can never re-enter circulation. GLW that is actively delegated to solar farm vaults is also excluded because it is locked for the duration of the farm's 100-week lifecycle. The result is an FDV figure that reflects only the tokens that will eventually be available to market participants.",
    ],
    learnMore: ["embedded-glw-supply"],
  },
  "glw-miners": {
    title: "GLW Miners",
    paragraphs: [
      "GLW miners pay cash incentives to solar farm installers to onboard high-impact farms onto the Glow protocol. In exchange, miners receive the GLW tokens that the farm earns over its lifetime, splitting a portion of these rewards with delegators who provide the required protocol deposits. Miners purchase mining-center fractions to participate in the competitive reward system.",
      "A miner's profit equals their retained GLW minus the cash paid out to installers. The most attractive opportunities are marginally viable solar farms that are highly competitive on the protocol: these require smaller cash incentives while earning strong GLW rewards relative to other farms in the same region.",
    ],
    externalLink: {
      url: "https://glow.org/blog/guide-to-glow-mining",
      label: "A Guide to Glow Mining",
    },
  },
  "gctl-staking": {
    title: "GCTL Staking",
    paragraphs: [
      "GCTL staking is the process of committing Glow Control tokens to specific geographic regions. Staked GCTL determines how protocol resources and farm rewards are allocated across regions. The more GCTL staked to a region, the larger its share of new farm capacity, reward distribution, and protocol attention.",
    ],
    externalLink: {
      url: "https://glow.org/blog/beginner-guide-to-gctl",
      label: "A Beginner's Guide to GCTL",
    },
  },
};

function inheritMiniBlogMeta(
  id: MiniBlogId,
  title: string,
  paragraphs: string[],
): MiniBlogEntry {
  return {
    ...MINI_BLOGS[id],
    title,
    paragraphs,
  };
}

const KO_MINI_BLOGS: Record<MiniBlogId, MiniBlogEntry> = {
  "glow-economy-basics": inheritMiniBlogMeta("glow-economy-basics", "Glow 경제", [
    "Bitcoin이 토큰을 채굴 장비로 바꾸었듯, Glow는 토큰을 태양광 발전소로 바꿉니다. BTC가 Bitcoin 경제의 핵심 토큰인 것처럼 GLW는 Glow 경제의 핵심 토큰입니다. 매주 새 GLW가 발행되어 프로토콜에서 구축되는 태양광 발전소에 배분됩니다.",
    "Glow는 태양광 발전소가 어디에 구축될지 결정할 수 있는 권한을 판매해 수익을 만듭니다. 참여자가 Glow Control(GCTL)을 민팅하기 위해 지불한 자금은 GLW의 유동성을 영구적으로 깊게 하는 데 사용됩니다. 이 유동성은 제거될 수 없기 때문에 내장 유동성이라고 부릅니다.",
  ]),
  "glw-token-basics": inheritMiniBlogMeta("glw-token-basics", "GLW 토큰", [
    "GLW는 Glow 프로토콜의 네이티브 토큰입니다. 프로토콜은 매주 GLW를 발행해 세 경제 주체에 배분합니다: 마이닝 리워드를 두고 경쟁하는 활성 태양광 발전소, 그랜트 풀, 그리고 운영 비용을 위한 Glow Foundation입니다.",
    "태양광 발전소는 검증된 청정 에너지를 생산하고 전력 매출 1달러당 임팩트 효율로 경쟁해 GLW를 획득합니다. GLW 보유자는 발전소가 프로토콜의 재무 요건을 충족하도록 GLW를 위임함으로써 이 리워드에 참여할 수 있습니다.",
  ]),
  "liquidity-basics": inheritMiniBlogMeta("liquidity-basics", "유동성 기본 원리", [
    "유동성 풀은 두 자산을 보유하고 자동으로 재조정되는 포트폴리오로 이해할 수 있습니다. 여기서는 GLW와 USDC를 보유합니다. 풀은 누군가 팔고 싶을 때 매수자를, 사고 싶을 때 매도자를 제공하며, 그 대가로 각 스왑에서 수수료를 받습니다.",
    "풀은 두 자산의 목표 비율을 유지하기 위해 계속 재조정됩니다. GLW 가격이 하락하면 USDC 비중이 커지므로 일부 USDC로 GLW를 사서 균형을 맞춥니다. GLW 가격이 상승하면 일부 GLW를 팔아 USDC를 확보합니다. 이 자동 재조정 덕분에 풀은 시장 양쪽에 깊이를 제공하고, 통과하는 모든 거래에서 수수료를 얻습니다.",
  ]),
  "control-basics": inheritMiniBlogMeta("control-basics", "Glow Control", [
    "Glow는 대규모 태양광 전력을 생산하는 프로토콜이며, Glow Control 토큰은 이해관계자가 그 전력이 세계 어디에서 생산될지 지정할 수 있게 합니다. GCTL 보유자는 특정 지역에 토큰을 스테이크하고, 프로토콜은 그 비율에 따라 리워드를 배분합니다.",
    "GCTL이 민팅될 때 지불된 자금은 Glow Endowment로 직접 유입되어 GLW 뒤의 내장 유동성을 영구적으로 깊게 합니다. 따라서 태양광 구축 지역을 조정하는 의사결정은 동시에 토큰 경제의 기반을 강화합니다.",
  ]),
  "solar-installations-basics": inheritMiniBlogMeta("solar-installations-basics", "월간 태양광 구축", [
    'Glow 생태계에서 "태양광 발전소"는 4kW 주거용 옥상 시스템부터 16MW 유틸리티 규모 배열까지 모든 규모의 태양광 설치를 의미합니다. 각 발전소는 같은 지역의 다른 발전소와 비교해 임팩트 효율을 기준으로 GLW 리워드를 경쟁합니다.',
    "월간 태양광 구축은 Glow가 새 발전 용량을 얼마나 빠르게 추가하는지 보여줍니다. 최근 13주 동안 Glow에서 활성화된 모든 발전소의 명목 용량을 합산하고, 이를 4주 월간 평균으로 환산해 kW 단위로 표시합니다.",
    "발전소는 정확히 100주 동안 Glow 프로토콜에서 활성 상태입니다. 이 기간 동안 GLW를 획득하고 지역 내 경쟁을 하며, 성과에 따라 위임자의 프로토콜 디포짓을 회수합니다. 100주 후에는 GLW 리워드가 종료되지만, 설치된 태양광 설비는 이후 수십 년 동안 청정 에너지와 검증된 임팩트를 계속 생산합니다.",
  ]),
  "uniswap-vs-protocol-liquidity": inheritMiniBlogMeta("uniswap-vs-protocol-liquidity", "Uniswap 유동성과 내장 유동성", [
    "Uniswap 같은 일반 DEX의 유동성은 개별 LP가 소유합니다. 이들은 거래 수수료를 얻기 위해 토큰을 예치하는 트레이더, 펀드, 기관이며 언제든 유동성을 회수할 수 있습니다. 변동성이 예상보다 커지면 합리적인 LP는 비영구 손실을 피하려고 자금을 회수합니다.",
    "따라서 유동성이 가장 중요한 순간에 LP는 오히려 회수할 유인이 가장 강합니다. 충분한 LP가 동시에 회수하면 다른 참여자가 거래할 기회를 얻기 전에 풀의 가용 깊이가 크게 줄어들 수 있습니다.",
    "내장 유동성은 회수 옵션을 제거해 이 문제를 해결합니다. Glow Endowment의 유동성 포지션은 영구적이므로 변동성, 하락장, 패닉 매도 속에서도 시장 깊이를 제공합니다. 이 유동성은 가장 필요할 때 존재하며, 시장 상황과 관계없이 거래 수수료로 복리 성장합니다.",
  ]),
  "glow-endowment": inheritMiniBlogMeta("glow-endowment", "Glow Endowment", [
    "Glow Endowment는 GLW/USDC Uniswap 풀의 내장 유동성입니다. Glow가 프로토콜 수익을 얻으면 공개 시장에서 GLW를 매수하는 데 사용합니다. 이렇게 확보한 GLW와 남은 USDC는 함께 영구 유동성 포지션으로 투입되며 회수할 수 없습니다.",
    "Endowment는 Uniswap LP 포지션이므로 거래 활동을 통해 자동 재조정됩니다. GLW가 상승하면 풀은 GLW를 팔고 USDC를 축적합니다. GLW가 하락하면 USDC 준비금으로 GLW를 매수해 유통량에서 제거합니다. 이 재조정은 사람의 개입 없이 이루어지며 양방향 거래 깊이를 제공합니다.",
    "Endowment는 모든 스왑에서 거래 수수료를 얻고, 이 수수료는 포지션에 직접 복리로 더해집니다. GCTL 민팅 수익은 새 자본을 추가하고, 거래 수수료는 그 위에서 복리 성장합니다.",
  ]),
  "embedded-liquidity-growth-basics": inheritMiniBlogMeta("embedded-liquidity-growth-basics", "내장 유동성 성장", [
    "내장 유동성 성장은 Glow Endowment의 영구 유동성 포지션이 얼마나 빠르게 복리 성장하는지 측정합니다. APY로 표시되는 성장률은 GCTL 민팅 수익과 풀의 모든 스왑에서 얻은 거래 수수료라는 두 자금 유입원을 반영합니다.",
    "Endowment가 아직 초기 확장 단계에 있기 때문에 절대 깊이가 커지는 중에도 연환산 성장률은 높게 보일 수 있습니다. 기반이 커질수록 APY는 완화될 수 있지만, 기간당 추가되는 절대 금액은 계속 증가합니다.",
  ]),
  "circulating-supply-basics": inheritMiniBlogMeta("circulating-supply-basics", "GLW 유통 공급량", [
    "모든 GLW가 자유롭게 거래 가능한 것은 아닙니다. 가장 큰 비유통 범주는 내장 GLW와 위임된 GLW입니다. 내장 GLW는 Glow Endowment의 유동성 포지션 안에 영구적으로 잠겨 있으며, USDC로 스왑될 때만 유통으로 돌아올 수 있습니다. 위임된 GLW는 100주 동안 발전소 vault에 커밋되어 거래에 사용할 수 없습니다.",
    "그 밖에도 프로토콜은 Grants Treasury, Veto Council, GCA 및 Miner Pool, Early Liquidity 배정 등 여러 컨트랙트 지갑에 GLW를 보유합니다. 유통 공급량은 이러한 잔액을 제외한 나머지로, 시장 참여자가 실제 접근할 수 있는 토큰을 나타냅니다.",
  ]),
  "why-liquidity-instead-of-dollars": inheritMiniBlogMeta("why-liquidity-instead-of-dollars", "왜 달러가 아니라 유동성인가?", [
    "특정 LP 포지션의 유동성은 단조롭게 증가합니다. 가격이 움직이면 LP의 달러 가치와 토큰 수량은 변하지만, 유동성 수량은 그대로 유지되거나 누적 수수료로 증가합니다. 1,000 유동성 단위로 시작한 포지션은 가격이 어떻게 움직여도 1,000 아래로 내려가지 않습니다.",
    "달러 표시 지표는 가격에 따라 흔들립니다. GLW 가격이 두 배가 되면 풀의 GLW 준비금 달러 가치는 증가하지만, 재조정 때문에 풀은 더 적은 GLW와 더 많은 USDC를 보유하게 됩니다. 달러 수치가 올라도 대규모 GLW 매도를 흡수하는 실제 능력은 줄어들 수 있습니다.",
    "이 특성은 Glow Endowment에서 특히 중요합니다. Endowment는 모든 스왑 수수료를 포지션에 복리로 더하는 영구 GLW/USDC LP 포지션입니다. 그래서 새 프로토콜 수익이 없어도 유동성은 성장합니다.",
  ]),
  "farm-revenue-distribution": inheritMiniBlogMeta("farm-revenue-distribution", "태양광 발전소 가치", [
    "모든 지역은 Glow 프로토콜에 가치를 제공하고, 각 태양광 발전소는 자신이 속한 지역에 가치를 제공합니다. 이 가치는 마이너 판매, GCTL 민팅 귀속, GCTL 수익 귀속이라는 세 수익 흐름을 통해 프로토콜의 내장 유동성으로 들어갑니다.",
    "마이너 판매는 발전소가 GLW 리워드 스트림 일부를 판매할 때 발생합니다. 운영 바운티를 제외한 수익은 Endowment에 새 유동성으로 들어갑니다. GCTL 민팅 귀속은 지역에 스테이킹된 GCTL과 해당 지역 내 발전소의 검증된 임팩트 크레딧에 따라 새 GCTL 민팅 수익 일부를 각 발전소에 배분합니다. GCTL 수익 귀속도 같은 방식이지만 새 자본이 아니라 Endowment가 얻은 거래 수수료와 재조정 이익을 배분합니다.",
  ]),
  "wallet-participants-basics": inheritMiniBlogMeta("wallet-participants-basics", "지갑 통계", [
    "프로토콜 참여자는 Glow 생태계에서 의미 있는 온체인 활동을 한 지갑입니다. 마이닝 프랙션 구매, 리워드 분배에 등장, GCTL 스테이킹 등 첫 프로토콜 행동을 수행하면 참여자로 간주됩니다.",
    "참여자는 서로 겹칠 수 있는 세 범주로 나뉩니다. 위임자는 활성 vault 소유 지분을 보유하고 GLW를 태양광 발전소 지원에 커밋합니다. 마이너는 경쟁 리워드 시스템에 참여하기 위해 마이닝 센터 프랙션을 구매합니다. GCTL 보유자는 지분을 스테이킹해 프로토콜이 태양광 인프라를 어디에 구축할지 지시합니다.",
    "대시보드는 총 프로토콜 참여자 수와 주간 신규 지갑 활동 속도를 함께 추적합니다. 이를 통해 Glow 경제의 현재 규모와 신규 참여자 유입 속도를 볼 수 있습니다.",
  ]),
  "delegation-metrics-basics": inheritMiniBlogMeta("delegation-metrics-basics", "집계 위임 메커니즘", [
    "매주 GLW 보유자는 토큰을 태양광 발전소에 위임하며, 토큰은 프로토콜 디포짓 역할을 하는 vault에 잠깁니다. 이 디포짓은 발전소가 경쟁 마이닝 시스템에 참여하기 위해 필요합니다. 일단 위임되면 GLW는 발전소의 100주 리워드 수명 동안 커밋되고, 디포짓 회수 과정에서 점진적으로 유통으로 돌아옵니다.",
    "위임된 GLW는 유통 공급량에 포함되지 않습니다. vault에 잠겨 거래할 수 없기 때문에 장기간 시장에서 사실상 제거됩니다. 현재 위임된 GLW 총량과 과거 위임이 해제되는 속도가 특정 시점의 유통 공급량에 미치는 순효과를 결정합니다.",
  ]),
  "region-revenue-basics": inheritMiniBlogMeta("region-revenue-basics", "지역별 수익", [
    "Glow는 여러 지리적 지역에서 운영되며, 각 지역에는 경쟁하는 태양광 발전소 풀이 있습니다. 각 지역 안에서 발전소는 검증된 임팩트 효율로 경쟁합니다. 전력 매출 1달러당 더 많은 임팩트를 생산하는 발전소가 해당 지역에 배정된 리워드의 더 큰 몫을 가져갑니다.",
    "각 지역의 수익은 지역의 총 임팩트와 Glow 생태계 참여자가 해당 지역에 보이는 관심을 기반으로 생성됩니다.",
  ]),
  "network-impact-basics": inheritMiniBlogMeta("network-impact-basics", "네트워크 임팩트", [
    "네트워크 임팩트는 Glow 프로토콜의 모든 태양광 설치가 만들어내는 종합 환경 성과를 측정합니다. 이 수치는 토큰 경제가 지원하는 발전소가 생산한 실제 에너지와 탄소 대체 효과를 나타냅니다.",
    "대시보드는 전체 발전소의 총 태양광 패널 수, 연간 MW 단위 발전 용량, 그 에너지로 공급 가능한 가구 수, 같은 탄소량을 상쇄하는 데 필요한 성목 수 환산치를 추적합니다. 각 지표는 새 발전소가 참여하고 기존 설치가 100주 리워드 기간 이후에도 청정 에너지를 계속 생산하면서 성장합니다.",
    "이 지표들은 Glow 프로토콜의 심장박동입니다. 모든 토큰 민팅, 위임, GCTL 스테이킹은 궁극적으로 이 임팩트 수치를 높이기 위해 존재합니다.",
  ]),
  "emissions-schedule": inheritMiniBlogMeta("emissions-schedule", "발행 스케줄", [
    "Glow 프로토콜은 매주 230,000 GLW를 발행해 세 그룹에 배분합니다: 마이닝 리워드를 두고 경쟁하는 활성 태양광 발전소에 175,000, 생태계 개발을 위한 그랜트 풀에 40,000, 거버넌스와 운영 비용을 위한 Glow Foundation에 15,000입니다.",
    "이 고정 주간 발행이 새 GLW의 유일한 공급원입니다. 임의적이거나 가변적인 민팅은 없습니다. 예측 가능한 스케줄 덕분에 참여자는 미래 공급량을 모델링하고 위임 리워드, 발전소 경제성, 유통 공급량이 어떻게 변할지 평가할 수 있습니다.",
  ]),
  "delegating-tokens": inheritMiniBlogMeta("delegating-tokens", "GLW 위임", [
    "Glow의 태양광 마이닝 인센티브에 참여하려면 발전소가 프로토콜 디포짓을 게시해야 합니다. 위임은 GLW 보유자가 발전소를 대신해 이 디포짓을 제공하고, 100주 동안 GLW를 커밋하는 방식입니다. 위임자는 그 대가로 발전소의 경쟁 성과에 따른 디포짓 회수와 주간 GLW 인플레이션 리워드 일부를 받습니다.",
    "위임자의 역할은 각 발전소의 경쟁력 대비 리워드 조건이 매력적인지 평가하고 그에 따라 GLW를 커밋하는 것입니다.",
  ]),
  "glw-token-value": inheritMiniBlogMeta("glw-token-value", "GLW 토큰 가치", [
    "GLW의 기본 가치는 내장 유동성에 의해 지지됩니다. Glow Endowment는 GCTL 민팅 수익과 복리 거래 수수료로 성장하는 영구 유동성 포지션입니다. 이 유동성은 회수될 수 없기 때문에 토큰 가격 아래에 점점 강화되는 시장 깊이의 바닥을 형성합니다.",
    "장기적으로 보면 초기 투기가 사라지고 거래량이 정상화된 뒤에도 내장 유동성은 남습니다. 이는 프로토콜의 경제 활동이 생성해 토큰을 지지하도록 영구 커밋된 실제 자본입니다. 순환적인 투기 수요와 달리 내장 유동성은 누적됩니다.",
  ]),
  "embedded-liquidity": inheritMiniBlogMeta("embedded-liquidity", "내장 유동성", [
    "내장 유동성은 GLW/USDC 거래 풀에 영구적으로 커밋됩니다. 언제든 회수 가능한 개인 LP의 일반 유동성과 달리, 내장 유동성은 일방향 커밋입니다. 풀에 들어가면 제거될 수 없습니다. 따라서 시장 상황과 관계없이 GLW 보유자가 거래할 수 있는 기본 시장 깊이가 항상 존재합니다.",
    "내장 유동성은 프로토콜이 두 원천에서 수익을 만들면서 성장합니다. 첫째는 새 Glow Control(GCTL)을 민팅하는 사람들의 수익이고, 둘째는 사람들이 거래 풀을 사용할 때 발생하는 거래 수수료입니다. 포지션이 영구적이므로 이 수수료는 계속 누적되고, 더 큰 포지션은 더 많은 수수료를 벌어 다시 포지션을 더 빠르게 키웁니다.",
  ]),
  "minting-gctl": inheritMiniBlogMeta("minting-gctl", "GCTL 민팅", [
    "누구나 USDC로 새 GCTL 토큰을 민팅할 수 있습니다. GCTL 1개 민팅 가격은 현재 GLW 토큰 가격의 제곱근을 5센트 단위로 반올림한 값입니다. 예를 들어 GLW가 $9라면 GCTL 1개는 약 $3이고, GLW가 $100라면 민트 가격은 약 $10입니다.",
    "GCTL 민팅에 사용된 모든 자금은 내장 유동성이 되어 GLW 토큰에 영구 유동성 지원을 제공합니다. 민팅된 각 GCTL은 토큰의 시장 깊이와 가격 안정성을 뒷받침하는 내장 유동성을 깊게 하여 GLW 경제를 강화합니다.",
  ]),
  "embedded-glw-supply": inheritMiniBlogMeta("embedded-glw-supply", "내장 GLW 공급량", [
    "Glow Endowment의 유동성 포지션 안에 있는 GLW는 영구적으로 커밋되어 독립적으로 회수하거나 거래할 수 없습니다. 이 GLW는 사실상 유통에서 제거되어 공개 시장에서 이용 가능한 토큰 수를 줄입니다.",
    "Endowment가 Uniswap LP 포지션이기 때문에 GLW 잔액은 가격에 따라 변합니다. GLW 가격이 하락하면 풀의 자동 재조정이 USDC 준비금으로 GLW를 매수해 포지션 안의 GLW를 늘리고 유통 공급량을 더 줄입니다. 가격이 상승하면 풀은 GLW를 USDC로 팔아 일부를 시장 쪽으로 되돌립니다. 이 구조는 하락장에는 공급을 조이고 상승장에는 완화하는 안정화 효과를 제공합니다.",
  ]),
  "constant-product-rule": inheritMiniBlogMeta("constant-product-rule", "상수곱 규칙", [
    "상수곱 규칙은 Uniswap 같은 자동화 마켓메이커의 수학적 기반입니다. 풀의 두 토큰 준비금의 곱은 항상 일정해야 합니다: x * y = k. 여기서 x는 한 토큰의 수량, y는 다른 토큰의 수량, k는 누적 수수료로만 증가하는 상수입니다.",
    "누군가 풀에서 GLW를 사면 USDC를 넣고 GLW를 가져갑니다. USDC 준비금은 증가하고 GLW 준비금은 감소하지만 x * y는 여전히 k와 같습니다. 이 제약이 가격 변화를 강제하며, GLW가 풀에서 희소해질수록 추가 1개 가격은 더 비싸집니다.",
  ]),
  "superlinear-market-cap": inheritMiniBlogMeta("superlinear-market-cap", "초선형 시가총액", [
    "전통 시장에서 시가총액은 가격과 선형적으로 움직입니다. 가격이 두 배가 되면 시가총액도 두 배가 됩니다. 내장 유동성이 있는 시스템에서는 관계가 초선형이 됩니다. GLW 가격이 오르면 Endowment의 USDC 준비금은 재조정으로 증가하고, 더 큰 거래량에서 수수료 수입도 증가합니다.",
    "이 초선형 동학은 내장 유동성이 높은 가치평가에서 불균형적으로 더 강한 지지력을 제공한다는 뜻입니다. 프로토콜의 유동성 기반은 성장에 맞춰가는 데 그치지 않고 앞서 가며, 토큰이 확장될수록 더 탄력적인 시장 깊이를 만듭니다.",
  ]),
  "100-weeks-of-rewards": inheritMiniBlogMeta("100-weeks-of-rewards", "100주 리워드", [
    "Glow 프로토콜의 모든 태양광 발전소는 고정된 100주 리워드 수명 주기를 가집니다. 이 기간 동안 발전소는 검증된 임팩트 효율로 지역 내 다른 발전소와 경쟁해 GLW를 획득합니다. 발전소의 프로토콜 디포짓도 경쟁 성과에 따라 이 기간 동안 회수됩니다.",
    "100주 후 발전소는 GLW 리워드를 더 이상 받지 않고 프로토콜 디포짓도 완전히 분배됩니다. 하지만 태양광 설치 자체는 수십 년 동안 청정 에너지를 계속 생산합니다. 100주는 발전소의 유효 수명이 아니라 경제적 참여 기간을 정의합니다.",
  ]),
  "durable-liquidity": inheritMiniBlogMeta("durable-liquidity", "지속 가능한 유동성", [
    "토큰 경제의 총 유효 유동성은 회수 가능한 유동성과 내장 유동성이라는 두 구성요소를 가집니다. 회수 가능한 유동성은 수익을 얻기 위해 외부 LP가 제공한 자본이며, 조건이 바뀌면 이동합니다. 내장 유동성은 프로토콜 자체가 생성한 자본이며 영구적이고 제거할 수 없습니다.",
    "회수 가능한 유동성은 스트레스 상황에서 신뢰하기 어렵기 때문에, 프로토콜이 실제로 의존할 수 있는 유동성을 평가할 때 안정성 계수로 할인해야 합니다. Glow의 설계는 내장 유동성이 회수 가능한 유동성을 크게 초과하는 정상 상태를 목표로 합니다.",
  ]),
  "market-cap-exitable": inheritMiniBlogMeta("market-cap-exitable", "인출 가능 시가총액", [
    "인출 가능 시가총액은 토큰의 전체 시가총액 중 현실적으로 큰 슬리피지 없이 달러로 전환될 수 있는 비율을 측정합니다. 대부분의 토큰은 유동성이 얕고 스트레스 상황에서 회수되는 이동성 LP가 제공하기 때문에, 이 비율은 명목 시가총액의 작은 일부에 그칩니다.",
  ]),
  "endowment-bot": inheritMiniBlogMeta("endowment-bot", "Endowment 봇", [
    "Endowment 봇은 Glow Endowment의 유동성 운영을 관리하는 자동화 시스템입니다. GCTL 민팅 수익과 풀에서 얻은 수수료를 영구 유동성 포지션으로 효율적으로 전환하고 복리화하는 과정을 처리합니다.",
  ]),
  "delegations-operational-risk": inheritMiniBlogMeta("delegations-operational-risk", "기대값 기반 리워드", [
    "위임자는 Glow 프로토콜에서 태양광 발전소를 지원할 때 운영 리스크로부터 보호됩니다. 리워드는 실제 에너지 출력이 아니라 발전소의 감사된 성능 역량을 기준으로 계산되므로, 날씨, 장비 중단, 계절 변동이 위임자 수익을 줄이지 않습니다.",
    "이 설계는 위임의 금융 리스크와 태양광 운영의 물리적 리스크를 분리합니다. 위임자는 발전소의 경쟁 위치, 리워드 조건, 검증된 역량을 평가하고, 발전소 운영자는 장비 유지와 출력 극대화의 운영 리스크를 부담합니다.",
  ]),
  "token-fdv": inheritMiniBlogMeta("token-fdv", "토큰 FDV", [
    "완전 희석 가치(FDV)는 오늘의 시장 가격을 기준으로 앞으로 존재할 모든 GLW 토큰의 총 가치를 추정합니다. Glow 프로토콜은 정해진 발행 스케줄에 따라 매주 230,000 GLW를 발행하며, FDV는 최종 전체 공급량의 가치를 현재 가격으로 투영합니다.",
    "중요한 점은 모든 GLW가 유효 FDV에 포함되지 않는다는 것입니다. Endowment 유동성 포지션 안에 영구적으로 내장된 GLW는 다시 유통될 수 없으므로 제외됩니다. 태양광 발전소 vault에 활성 위임된 GLW도 100주 수명 동안 잠겨 있으므로 제외됩니다.",
  ]),
  "glw-miners": inheritMiniBlogMeta("glw-miners", "GLW 마이너", [
    "GLW 마이너는 고임팩트 발전소를 Glow 프로토콜에 온보딩하기 위해 태양광 설치자에게 현금 인센티브를 지급합니다. 그 대가로 마이너는 발전소가 수명 동안 획득하는 GLW를 받고, 필요한 프로토콜 디포짓을 제공한 위임자와 일부 리워드를 나눕니다.",
    "마이너의 이익은 보유한 GLW에서 설치자에게 지급한 현금을 뺀 값입니다. 가장 매력적인 기회는 한계적으로 실현 가능한 태양광 발전소이면서 프로토콜에서 경쟁력이 높은 경우입니다. 이런 발전소는 더 적은 현금 인센티브로도 같은 지역의 다른 발전소 대비 강한 GLW 리워드를 얻을 수 있습니다.",
  ]),
  "gctl-staking": inheritMiniBlogMeta("gctl-staking", "GCTL 스테이킹", [
    "GCTL 스테이킹은 Glow Control 토큰을 특정 지리적 지역에 커밋하는 과정입니다. 스테이킹된 GCTL은 프로토콜 자원과 발전소 리워드가 지역별로 어떻게 배분될지 결정합니다. 한 지역에 더 많은 GCTL이 스테이킹될수록 새 발전소 용량, 리워드 분배, 프로토콜 관심의 더 큰 몫을 받습니다.",
  ]),
};

function useMiniBlogs() {
  const { lang } = useLang();
  return lang === "ko" ? KO_MINI_BLOGS : MINI_BLOGS;
}

const MINI_BLOG_CLUSTERS: Record<MiniBlogId, MiniBlogCluster> = {
  "glow-economy-basics": "core",
  "glw-token-basics": "core",
  "liquidity-basics": "liquidity",
  "control-basics": "governance",
  "solar-installations-basics": "solar",
  "uniswap-vs-protocol-liquidity": "liquidity",
  "glow-endowment": "liquidity",
  "circulating-supply-basics": "core",
  "embedded-liquidity-growth-basics": "liquidity",
  "why-liquidity-instead-of-dollars": "liquidity",
  "farm-revenue-distribution": "solar",
  "wallet-participants-basics": "network",
  "delegation-metrics-basics": "network",
  "region-revenue-basics": "solar",
  "network-impact-basics": "solar",
  "emissions-schedule": "core",
  "delegating-tokens": "core",
  "glw-token-value": "core",
  "embedded-liquidity": "liquidity",
  "minting-gctl": "governance",
  "embedded-glw-supply": "liquidity",
  "constant-product-rule": "liquidity",
  "superlinear-market-cap": "liquidity",
  "100-weeks-of-rewards": "solar",
  "durable-liquidity": "liquidity",
  "market-cap-exitable": "liquidity",
  "endowment-bot": "liquidity",
  "delegations-operational-risk": "network",
  "token-fdv": "core",
  "glw-miners": "network",
  "gctl-staking": "governance",
};

const INITIAL_MODAL_BLOGS: Record<ModalBlogKey, MiniBlogId> = {
  overview: "glow-economy-basics",
  growthCards: "solar-installations-basics",
  supply: "circulating-supply-basics",
  farm: "farm-revenue-distribution",
  polLiquidity: "uniswap-vs-protocol-liquidity",
  gctl: "control-basics",
  walletStats: "wallet-participants-basics",
  delegation: "delegation-metrics-basics",
  regions: "region-revenue-basics",
  networkImpact: "network-impact-basics",
  tokenEmissions: "token-fdv",
};

const GROWTH_CARD_BLOG: Record<GrowthCardKey, MiniBlogId> = {
  installations: "solar-installations-basics",
  liquidityGrowth: "uniswap-vs-protocol-liquidity",
  circulatingGrowth: "circulating-supply-basics",
  embeddedGrowth: "embedded-liquidity",
};

const WalletGrowthTooltip = React.memo(function WalletGrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: WalletGrowthDatum; value?: number }>;
  label?: string;
}) {
  const p = usePolCopy();
  if (!active || !payload?.length) return null;

  const datum = payload[0]?.payload;
  const weekStart = datum?.weekStartMs ? new Date(datum.weekStartMs) : null;
  const weekEnd = datum?.weekEndMs ? new Date(datum.weekEndMs - 1) : null;

  const value =
    typeof payload[0]?.value === "number"
      ? payload[0]!.value
      : typeof datum?.newWallets === "number"
        ? datum.newWallets
        : 0;

  const labelText = (label ?? "").toString().trim() || p.week;
  const dateText =
    weekStart && weekEnd
      ? `${formatDateShortUtc(weekStart)} - ${formatDateShortUtc(weekEnd)} UTC`
      : null;

  return (
    <div className="rounded-xl border border-border/20 bg-background/95 px-3 py-2 text-xs shadow-none backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
            {labelText}
          </div>
          {dateText ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {dateText}
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-2 shrink-0">
          <span
            className="mt-1 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-newWallets)" }}
          />
          <div className="text-right">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {p.newWalletsPerWeek}
            </div>
            <div className="mt-0.5 text-base font-mono font-semibold tabular-nums text-foreground leading-none">
              {Math.max(0, Math.round(value)).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

WalletGrowthTooltip.displayName = "WalletGrowthTooltip";

function FarmDetailsDialog({
  open,
  onOpenChange,
  selectedFarm,
  displayPrice,
  blogId,
  onSelectBlog,
  onBackBlog,
  canGoBack,
  parentBlogId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFarm: FarmRow | null;
  displayPrice: number;
  blogId: MiniBlogId;
  onSelectBlog: (blogId: MiniBlogId) => void;
  onBackBlog: () => void;
  canGoBack: boolean;
  parentBlogId?: MiniBlogId;
}) {
  const lifetimeValue =
    selectedFarm?.lifetimeLq !== null && selectedFarm?.lifetimeLq !== undefined
      ? formatLiquidityCompact(selectedFarm.lifetimeLq)
      : "—";
  const lifetimeBreakdown =
    selectedFarm?.lifetimeLq !== null &&
    selectedFarm?.lifetimeLq !== undefined &&
    displayPrice > 0
      ? `(${
          getBreakdownFromLq(selectedFarm.lifetimeLq, displayPrice).breakdown
        })`
      : null;
  const lifetimeProgress =
    selectedFarm?.lifetimeWeeksElapsed !== null &&
    selectedFarm?.lifetimeWeeksElapsed !== undefined
      ? `${selectedFarm.lifetimeWeeksElapsed} / ${selectedFarm.lifetimeWeeksTarget} wks`
      : "—";
  const generatedCredits =
    selectedFarm?.ccLifetime !== null && selectedFarm?.ccLifetime !== undefined
      ? formatCompactNumberPrecise(selectedFarm.ccLifetime)
      : "—";
  const projectedCredits =
    selectedFarm?.projectedLifetimeCredits !== null &&
    selectedFarm?.projectedLifetimeCredits !== undefined
      ? formatCompactNumberPrecise(selectedFarm.projectedLifetimeCredits)
      : "—";
  const panels =
    selectedFarm?.panels !== null && selectedFarm?.panels !== undefined
      ? formatNumber(selectedFarm.panels)
      : "—";
  const p = usePolCopy();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[980px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>{p.solarFarmEconomics}</DialogTitle>
          <DialogDescription>{p.farmDetailsDesc}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh]">
          <div className="p-6 space-y-6">
            {!selectedFarm ? (
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 text-sm text-muted-foreground">
                {p.selectFarmDetails}
              </div>
            ) : (
              <>
                <div className="rounded-2xl overflow-hidden border border-border/20 bg-muted/20">
                  <div className="relative h-56 w-full bg-muted/40 dark:bg-muted/60">
                    {selectedFarm.imageUrl ? (
                      <FallbackImage
                        src={selectedFarm.imageUrl}
                        widthForProxy={FARM_IMAGE_MODAL_WIDTH}
                        quality={FARM_IMAGE_MODAL_QUALITY}
                        loading="eager"
                        alt={selectedFarm.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted/40 dark:bg-muted/60 flex items-center justify-center">
                        <span className="text-3xl opacity-25">&#9728;</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-white/75">
                        {selectedFarm.region}
                      </div>
                      <h3 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-white">
                        {selectedFarm.name}
                      </h3>
                      <div className="mt-1 text-xs font-mono uppercase tracking-widest text-white/70">
                        {selectedFarm.panels} {p.panels}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      {p.generatedRevenue}
                    </div>
                    <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                      {lifetimeValue}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {lifetimeBreakdown ?? p.liveUnavailable}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      {p.lifetimeProgress}
                    </div>
                    <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                      {lifetimeProgress}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      {p.creditType}
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
                      {selectedFarm.creditType}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      {p.generatedCreditsLifetime}
                    </div>
                    <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                      {generatedCredits}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      {p.projectedLifetimeCredits}
                    </div>
                    <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                      {projectedCredits}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                      {p.numberOfPanels}
                    </div>
                    <div className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums">
                      {panels}
                    </div>
                  </div>
                </div>

                <MiniBlogPanel
                  blogId={blogId}
                  onSelectBlog={onSelectBlog}
                  onBack={onBackBlog}
                  canGoBack={canGoBack}
                  parentBlogId={parentBlogId}
                />
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const MINI_BLOG_TITLE_MAX_CHARS = 36;

function truncateBlogTitle(title: string) {
  if (title.length <= MINI_BLOG_TITLE_MAX_CHARS) return title;
  return `${title.slice(0, MINI_BLOG_TITLE_MAX_CHARS - 1)}\u2026`;
}

function MiniBlogPanel({
  blogId,
  onSelectBlog,
  onBack,
  canGoBack,
  parentBlogId,
  className,
}: {
  blogId: MiniBlogId;
  onSelectBlog: (blogId: MiniBlogId) => void;
  onBack: () => void;
  canGoBack: boolean;
  parentBlogId?: MiniBlogId;
  className?: string;
}) {
  const p = usePolCopy();
  const miniBlogs = useMiniBlogs();
  const blog = miniBlogs[blogId];
  const parentTitle = parentBlogId ? miniBlogs[parentBlogId].title : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-muted/20 p-4 sm:p-5 space-y-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
          {blog.title}
        </div>
        {canGoBack && parentTitle ? (
          <button
            type="button"
            className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 hover:text-foreground transition-colors"
            onClick={onBack}
          >
            <span aria-hidden>&#8592;</span>
            {parentTitle}
          </button>
        ) : null}
      </div>
      <div className="space-y-4">
        {blog.paragraphs.map((paragraph, index) => (
          <p
            key={`${blogId}-${index}`}
            className={cn(
              "text-[13px] leading-relaxed",
              index === 0
                ? "text-muted-foreground/90 dark:text-muted-foreground"
                : "text-muted-foreground/80 dark:text-muted-foreground/90",
            )}
          >
            {paragraph}
          </p>
        ))}
      </div>
      {blog.learnMore && blog.learnMore.length > 0 ? (
        <div className="space-y-3 pt-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            {p.learnMore}
          </div>
          <div className="flex flex-wrap gap-2">
            {blog.learnMore.map((learnId) => (
              <button
                key={`${blogId}-${learnId}`}
                type="button"
                className="rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-xs font-mono uppercase tracking-wider text-foreground/80 hover:bg-foreground hover:text-background transition-colors text-left leading-snug"
                onClick={() => onSelectBlog(learnId)}
              >
                {truncateBlogTitle(miniBlogs[learnId].title)}
              </button>
            ))}
            {blog.externalLink && (
              <a
                href={blog.externalLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-xs font-mono uppercase tracking-wider text-foreground/80 hover:bg-foreground hover:text-background transition-colors leading-snug"
              >
                {blog.externalLink.label}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0"
                >
                  <path
                    d="M3.5 2H10V8.5M10 2L2 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {blog.externalLink && (
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {p.learnMore}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {blog.externalLink ? (
              <a
                href={blog.externalLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-xs font-mono uppercase tracking-wider text-foreground/80 hover:bg-foreground hover:text-background transition-colors leading-snug"
              >
                {blog.externalLink.label}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0"
                >
                  <path
                    d="M3.5 2H10V8.5M10 2L2 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            ) : (
              <a
                href="https://glow.org/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-xs font-mono uppercase tracking-wider text-foreground/80 hover:bg-foreground hover:text-background transition-colors leading-snug"
              >
                {p.readFullBlog}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0"
                >
                  <path
                    d="M3.5 2H10V8.5M10 2L2 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
      <MiniBlogGraphButton
        currentBlogId={blogId}
        onSelectBlog={(id) => onSelectBlog(id as MiniBlogId)}
        miniBlogs={miniBlogs}
        miniBlogClusters={
          MINI_BLOG_CLUSTERS as Record<string, MiniBlogGraphCluster>
        }
      />
    </div>
  );
}

const MetricCard = React.memo(function MetricCard({
  label,
  value,
  helper,
  labelClassName,
  valueClassName,
  helperClassName,
}: {
  label: string;
  value: string;
  helper?: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
  helperClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70",
          labelClassName,
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-5xl sm:text-6xl font-semibold tracking-tight font-mono tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </div>
      {helper ? (
        <div className={cn("text-xs text-muted-foreground", helperClassName)}>
          {helper}
        </div>
      ) : null}
    </div>
  );
});

MetricCard.displayName = "MetricCard";

const MiniStat = React.memo(function MiniStat({
  label,
  value,
  helper,
  valueClassName,
  labelClassName,
}: {
  label: string;
  value: string;
  helper?: React.ReactNode;
  valueClassName?: string;
  labelClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70",
          labelClassName,
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-2xl sm:text-3xl font-semibold font-mono tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </div>
      {helper ? (
        <div className="text-xs text-muted-foreground">{helper}</div>
      ) : null}
    </div>
  );
});

MiniStat.displayName = "MiniStat";

const RegionCompareCard = React.memo(function RegionCompareCard({
  title,
  row,
}: {
  title: string;
  row: {
    region: string;
    glwPerWeek: number | null;
    ccPerWeek: number | null;
    stakedGctl: number | null;
    shareOfTotal: number | null;
    totalPds: number | null;
    gctlPerPd: number | null;
  } | null;
}) {
  const p = usePolCopy();

  if (!row) {
    return (
      <div className="rounded-xl border border-border/20 bg-muted/20 p-4 text-sm text-muted-foreground">
        {p.noRegionSelected}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/20 bg-muted/20 p-4 space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
          {title}
        </div>
        <div className="mt-1 text-lg font-semibold tracking-tight">
          {row.region}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MiniStat
          label="GLW / Week"
          value={
            row.glwPerWeek !== null
              ? formatCompactNumberPrecise(row.glwPerWeek)
              : row.ccPerWeek !== null
                ? formatCompactNumberPrecise(row.ccPerWeek)
                : "—"
          }
          helper={
            row.glwPerWeek === null && row.ccPerWeek !== null
              ? p.fallbackCc
              : undefined
          }
          valueClassName="text-base sm:text-lg tracking-tight"
        />
        <MiniStat
          label={p.staked + " GCTL"}
          value={
            row.stakedGctl !== null
              ? formatCompactNumberPrecise(row.stakedGctl)
              : "—"
          }
          valueClassName="text-base sm:text-lg tracking-tight"
        />
        <MiniStat
          label={p.shareOfTotal}
          value={
            row.shareOfTotal !== null ? `${row.shareOfTotal.toFixed(1)}%` : "—"
          }
          valueClassName="text-base sm:text-lg tracking-tight"
        />
        <MiniStat
          label={p.totalPds}
          value={
            row.totalPds !== null
              ? `$${formatCompactNumberPrecise(row.totalPds)}`
              : "—"
          }
          valueClassName="text-base sm:text-lg tracking-tight"
        />
        <MiniStat
          label="GCTL / PD"
          value={
            row.gctlPerPd !== null
              ? formatCompactNumberTwoDecimals(row.gctlPerPd * 1000)
              : "—"
          }
          valueClassName="text-base sm:text-lg tracking-tight"
        />
      </div>
    </div>
  );
});

RegionCompareCard.displayName = "RegionCompareCard";

function resolvePriceRangeMin(minPrice?: number) {
  return Number.isFinite(minPrice) &&
    minPrice !== undefined &&
    minPrice > 0 &&
    minPrice < PRICE_RANGE.max
    ? minPrice
    : PRICE_RANGE.min;
}

function formatSliderBoundaryPrice(price: number) {
  if (price < 0.001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(4);
  if (price < 1) return price.toFixed(3);
  return price.toFixed(2);
}

function logSliderToPrice(sliderValue: number, minPrice = PRICE_RANGE.min) {
  const logMin = Math.log10(resolvePriceRangeMin(minPrice));
  const logMax = Math.log10(PRICE_RANGE.max);
  return Math.pow(10, logMin + (sliderValue / 100) * (logMax - logMin));
}

function priceToLogSlider(price: number, minPrice = PRICE_RANGE.min) {
  const rangeMin = resolvePriceRangeMin(minPrice);
  const safePrice = Math.min(Math.max(price, rangeMin), PRICE_RANGE.max);
  const logMin = Math.log10(rangeMin);
  const logMax = Math.log10(PRICE_RANGE.max);
  return ((Math.log10(safePrice) - logMin) / (logMax - logMin)) * 100;
}

const PolLiquidityTooltip = React.memo(function PolLiquidityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: any }>;
  label?: string;
}) {
  const copy = usePolCopy();

  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as
    | {
        weekStartMs?: number;
        weekEndMs?: number;
        liquidity?: number;
        endowmentLiquidity?: number;
        botActiveLiquidity?: number;
      }
    | undefined;
  if (!point) return null;
  const weekStart =
    typeof point.weekStartMs === "number" ? new Date(point.weekStartMs) : null;
  const weekEnd =
    typeof point.weekEndMs === "number" ? new Date(point.weekEndMs - 1) : null;
  const dateRangeLabel =
    weekStart && weekEnd
      ? `${formatDateShortUtc(weekStart)} - ${formatDateShortUtc(weekEnd)} UTC`
      : null;

  return (
    <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-card px-4 py-3 min-w-[240px]">
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
          {label ?? copy.week}
        </div>
        {dateRangeLabel ? (
          <div className="text-[11px] text-muted-foreground">
            {dateRangeLabel}
          </div>
        ) : null}
      </div>

      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            {copy.embeddedLiquidity}
          </div>
          <div className="text-sm font-mono font-semibold tabular-nums text-foreground">
            {typeof point.liquidity === "number"
              ? formatLiquidityCompact(point.liquidity)
              : "—"}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">{copy.endowment}</div>
          <div className="text-sm font-mono tabular-nums text-foreground">
            {typeof point.endowmentLiquidity === "number"
              ? formatLiquidityCompact(point.endowmentLiquidity)
              : "—"}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">{copy.tradingBot}</div>
          <div className="text-sm font-mono tabular-nums text-foreground">
            {typeof point.botActiveLiquidity === "number"
              ? formatLiquidityCompact(point.botActiveLiquidity)
              : "—"}
          </div>
        </div>
      </div>
    </div>
  );
});

PolLiquidityTooltip.displayName = "PolLiquidityTooltip";

type RegionsRow = {
  region: string;
  lifetimeLq: number | null;
  ninetyDayLq: number | null;
  farms: number;
  ccPerWeek: number | null;
  stakedGctl: number | null;
  glwPerWeek: number | null;
  totalPds: number | null;
  shareOfTotal: number | null;
  gctlPerPd: number | null;
};

type ImpactTotals = {
  panels: number | null;
  totalFarms: number | null;
  capacityMw: number | null;
  homesPowered: number | null;
  trees: number | null;
} | null;

type PolGrowthDisplay = {
  lq: string;
  breakdown: string | null;
} | null;

type PolBreakdownSummary = {
  lq: number | null;
  usd: number;
  breakdown: string;
} | null;

type PolLiquidityChartDatum = {
  week: string;
  weekStartMs: number;
  weekEndMs: number;
  liquidity: number;
  endowmentLiquidity: number;
  botActiveLiquidity: number;
};

type GctlRegionSlice = {
  name: string;
  value: number;
  fill: string;
  pct: number;
};

type WalletStatsSummary = {
  glwHolders: number;
  protocolParticipants: number;
  breakdown: Array<{
    label: string;
    count: number;
    pct: number;
    color: string;
  }>;
};

const OverviewSection = React.memo(function OverviewSection({
  marketCapDisplay,
  priceDisplay,
  totalPolLq,
  totalPolBreakdown,
  monthlySolarConstructionKw,
  polTrailingPolGrowthDisplay,
  liquidityUnitValueDisplay,
  supplyGrowthAnnualDisplay,
  polGrowthMoMDisplay,
  hasLiveSupply,
  circulatingSupplyForSupplyCard,
  vaultedGlw,
  polGlwInPol,
  openGrowthCardsDialog,
  resetModalBlog,
  setIsBannerBlogOpen,
  setIsSupplyDialogOpen,
}: {
  marketCapDisplay: string;
  priceDisplay: string;
  totalPolLq: number | null;
  totalPolBreakdown: PolBreakdownSummary;
  monthlySolarConstructionKw: number | null;
  polTrailingPolGrowthDisplay: PolGrowthDisplay;
  liquidityUnitValueDisplay: string;
  supplyGrowthAnnualDisplay: string;
  polGrowthMoMDisplay: string;
  hasLiveSupply: boolean;
  circulatingSupplyForSupplyCard: number;
  vaultedGlw: number | null;
  polGlwInPol: number | null;
  openGrowthCardsDialog: (card: GrowthCardKey) => void;
  resetModalBlog: (modal: ModalBlogKey, next?: MiniBlogId) => void;
  setIsBannerBlogOpen: (open: boolean) => void;
  setIsSupplyDialogOpen: (open: boolean) => void;
}) {
  const p = usePolCopy();
  const supplyPieData = React.useMemo(
    () =>
      [
        {
          name: p.circulating,
          value: Math.round(circulatingSupplyForSupplyCard),
          fill: "#4ade80",
        },
        {
          name: p.vaulted,
          value: Math.round(vaultedGlw ?? 0),
          fill: "#a855f7",
        },
        {
          name: p.embeddedGlw,
          value: Math.round(polGlwInPol ?? 0),
          fill: "#ffb472",
        },
      ].filter((d) => d.value > 0),
    [
      circulatingSupplyForSupplyCard,
      p.circulating,
      p.embeddedGlw,
      p.vaulted,
      polGlwInPol,
      vaultedGlw,
    ],
  );

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader title={p.overview} />

      {/* ── Row 1: Headline banner ── */}
      <Card
        className={cn(
          "!gap-0 !py-0 relative overflow-hidden border border-border/20 transition-colors cursor-pointer hover:border-border/40 dark:hover:border-border/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        role="button"
        tabIndex={0}
        aria-label={p.openGlowEconomy}
        onClick={() => {
          resetModalBlog("overview");
          setIsBannerBlogOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            resetModalBlog("overview");
            setIsBannerBlogOpen(true);
          }
        }}
      >
        <CardContent className="relative px-0 py-0">
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: "url('/images/pol-banner-crop.jpg')",
              }}
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 bg-gradient-to-br from-black/45 via-black/25 to-black/45" />
          </div>
          <div className="absolute right-[24px] top-[16px]">
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/75">
              {p.clickForBasics}
            </div>
          </div>
          <div className="relative z-10 mx-auto w-full max-w-5xl px-5 py-10 pt-14 sm:px-12 sm:py-14 sm:pt-16 lg:py-16 lg:pt-16 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-x-12 md:gap-y-8 md:items-end">
            <div className="grid grid-rows-[auto_auto] gap-3 md:col-span-3 md:justify-self-center md:items-center md:text-center">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/75">
                {p.marketCap}
              </div>
              <div className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight font-mono tabular-nums leading-none text-white">
                {marketCapDisplay}
              </div>
            </div>

            <div className="grid grid-rows-[auto_auto_auto] gap-3 md:justify-self-start md:items-center md:text-center">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/75">
                {p.glwPrice}
              </div>
              <div className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none text-white">
                {priceDisplay}
              </div>
              <Link
                href={DEFINED_FI_GLOW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/75 hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {p.poolActivity}
              </Link>
            </div>

            <div className="grid grid-rows-[auto_auto_auto] gap-3 md:justify-self-center md:items-center md:text-center">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/75">
                {p.embeddedLiquidity}
              </div>
              <div className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none text-white">
                {totalPolLq !== null ? formatLiquidityCompact(totalPolLq) : "—"}
              </div>
              <div className="text-sm text-white/75 text-left md:text-center">
                {totalPolBreakdown?.breakdown
                  ? `(${totalPolBreakdown.breakdown})`
                  : p.liveUnavailable}
              </div>
            </div>

            <div className="grid grid-rows-[auto_auto_auto] gap-3 md:justify-self-end md:items-center md:text-center">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/75">
                {p.liquidityUnitValue}
              </div>
              <div className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight font-mono tabular-nums leading-none text-white">
                {liquidityUnitValueDisplay}
              </div>
              <div className="text-sm text-white/75 text-left md:text-center">
                {p.oneLiquidityUnit}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Row 2: Growth cards + Supply/Circulation ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] lg:items-stretch">
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:h-full lg:grid-rows-2">
          <Card
            className={cn(
              "!gap-0 !py-0 h-full relative overflow-hidden transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            role="button"
            tabIndex={0}
        aria-label={p.monthlySolarConstruction}
            onClick={() => openGrowthCardsDialog("installations")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openGrowthCardsDialog("installations");
              }
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-25 dark:opacity-20"
              style={{
                background:
                  "linear-gradient(to top, var(--color-glow-green) 0%, transparent 82%)",
              }}
            />
            <CardContent className="relative h-full flex flex-col px-5 py-5 pb-14 sm:px-8 sm:py-7 sm:pb-14">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                {p.monthlySolarConstruction}
              </div>
              <div className="mt-4 text-5xl sm:text-7xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                {monthlySolarConstructionKw !== null
                  ? formatNumber(Math.round(monthlySolarConstructionKw))
                  : "—"}
                <span className="ml-2 text-xl font-mono text-muted-foreground/60">
                  kW
                </span>
              </div>
              <div className="pointer-events-none absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-black text-sm text-white dark:border-white/40 dark:bg-white dark:text-black">
                ↗
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "!gap-0 !py-0 h-full relative overflow-hidden transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            role="button"
            tabIndex={0}
        aria-label={p.embeddedLiquidityGrowth3m}
            onClick={() => openGrowthCardsDialog("liquidityGrowth")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openGrowthCardsDialog("liquidityGrowth");
              }
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-25 dark:opacity-20"
              style={{
                background:
                  "linear-gradient(to top, var(--color-glow-purple) 0%, transparent 82%)",
              }}
            />
            <CardContent className="relative h-full flex flex-col px-5 py-5 pb-14 sm:px-8 sm:py-7 sm:pb-14">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                {p.embeddedLiquidityGrowth3m}
              </div>
              <div className="mt-4 text-5xl sm:text-7xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                {polTrailingPolGrowthDisplay?.lq ?? "—"}
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {polTrailingPolGrowthDisplay?.breakdown
                  ? `(${polTrailingPolGrowthDisplay.breakdown})`
                  : p.liveUnavailable}
              </div>
              <div className="pointer-events-none absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-black text-sm text-white dark:border-white/40 dark:bg-white dark:text-black">
                ↗
              </div>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "!gap-0 !py-0 h-full relative overflow-hidden transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            role="button"
            tabIndex={0}
        aria-label={p.annualizedCirculatingGrowth}
            onClick={() => openGrowthCardsDialog("circulatingGrowth")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openGrowthCardsDialog("circulatingGrowth");
              }
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-25 dark:opacity-20"
              style={{
                background:
                  "linear-gradient(to top, var(--color-glow-orange) 0%, transparent 82%)",
              }}
            />
            <CardContent className="relative h-full flex flex-col px-5 py-5 pb-14 sm:px-8 sm:py-7 sm:pb-14">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                {p.annualizedCirculatingGrowth}
              </div>
              <div className="mt-4 text-5xl sm:text-7xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                {supplyGrowthAnnualDisplay}
              </div>
              <div className="pointer-events-none absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-black text-sm text-white dark:border-white/40 dark:bg-white dark:text-black">
                ↗
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              "!gap-0 !py-0 h-full relative overflow-hidden transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            role="button"
            tabIndex={0}
        aria-label={`${p.embeddedLiquidityGrowthMom} (${p.mom})`}
            onClick={() => openGrowthCardsDialog("embeddedGrowth")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openGrowthCardsDialog("embeddedGrowth");
              }
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-25 dark:opacity-20"
              style={{
                background:
                  "linear-gradient(to top, var(--color-miner) 0%, transparent 82%)",
              }}
            />
            <CardContent className="relative h-full flex flex-col px-5 py-5 pb-14 sm:px-8 sm:py-7 sm:pb-14">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                {p.embeddedLiquidityGrowthMom} (
                <span className="normal-case">{p.mom}</span>)
              </div>
              <div className="mt-4 text-5xl sm:text-7xl font-semibold tracking-tight font-mono tabular-nums leading-none">
                {polGrowthMoMDisplay}
              </div>
              <div className="pointer-events-none absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-black text-sm text-white dark:border-white/40 dark:bg-white dark:text-black">
                ↗
              </div>
            </CardContent>
          </Card>
        </div>

        <Card
          className={cn(
            "!gap-6 lg:h-full transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          role="button"
          tabIndex={0}
          aria-label={p.openSupplyModel}
          onClick={() => {
            resetModalBlog("supply");
            setIsSupplyDialogOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              resetModalBlog("supply");
              setIsSupplyDialogOpen(true);
            }
          }}
        >
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">
                {p.supplyAndCirculation}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                {p.clickToExplore}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div>
              <MetricCard
                label={p.circulatingSupply}
                value={
                  hasLiveSupply
                    ? `${formatCompactNumberPrecise(
                        circulatingSupplyForSupplyCard,
                      )} GLW`
                    : "—"
                }
              />
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="relative shrink-0">
                  <ChartContainer
                    config={supplyCirculationChartConfig}
                    className="h-36 w-36"
                  >
                    <PieChart>
                      <Pie
                        data={supplyPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={62}
                        strokeWidth={2}
                        stroke="var(--color-card)"
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => {
                              const n =
                                typeof value === "number"
                                  ? value
                                  : Number(value);
                              return `${formatCompactNumberPrecise(n)} GLW`;
                            }}
                          />
                        }
                      />
                    </PieChart>
                  </ChartContainer>
                </div>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ background: "#4ade80" }}
                    />
                    <span className="text-muted-foreground">
                      {p.circulating}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ background: "#ffb472" }}
                    />
                    <span className="text-muted-foreground">
                      {p.embeddedGlw}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ background: "#a855f7" }}
                    />
                    <span className="text-muted-foreground">{p.vaulted}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MiniStat
                label={p.vaulted}
                value={
                  vaultedGlw !== null
                    ? formatCompactNumberPrecise(vaultedGlw)
                    : "—"
                }
                valueClassName="text-xl sm:text-2xl tracking-tight"
              />
              <MiniStat
                label={p.embeddedGlw}
                value={
                  polGlwInPol !== null
                    ? `${formatCompactNumberPrecise(polGlwInPol)} GLW`
                    : "—"
                }
                valueClassName="text-xl sm:text-2xl tracking-tight"
              />
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                resetModalBlog("supply");
                setIsSupplyDialogOpen(true);
              }}
            >
              {p.exploreSupplyModel}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
});

OverviewSection.displayName = "OverviewSection";

const SolarFarmEconomicsSection = React.memo(
  function SolarFarmEconomicsSection({
    showAllFarms,
    farmSortKey,
    setFarmSortKey,
    setShowAllFarms,
    farmRowsToRender,
    displayPrice,
    openFarmDialog,
    prefetchFarmImage,
  }: {
    showAllFarms: boolean;
    farmSortKey: "latest" | "lifetime" | "credits";
    setFarmSortKey: (key: "latest" | "lifetime" | "credits") => void;
    setShowAllFarms: (show: boolean) => void;
    farmRowsToRender: FarmRow[];
    displayPrice: number;
    openFarmDialog: (farm: FarmRow) => void;
    prefetchFarmImage: (farm: FarmRow) => void;
  }) {
    const p = usePolCopy();

    return (
      <section className="flex flex-col gap-6 pt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader title={p.solarFarmEconomics} />

          <div className="flex items-center justify-end gap-3">
            {showAllFarms ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                  {p.sortBy}
                </span>
                <select
                  value={farmSortKey}
                  onChange={(e) =>
                    setFarmSortKey(
                      e.target.value as "latest" | "lifetime" | "credits",
                    )
                  }
                  className="rounded-lg border border-border/40 bg-background px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:border-border/60 transition-colors"
                >
                  <option value="latest">{p.latest}</option>
                  <option value="lifetime">{p.lifetime}</option>
                  <option value="credits">{p.ccPerWeek}</option>
                </select>
              </div>
            ) : null}

            {!showAllFarms ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllFarms(true)}
              >
                {p.seeAll}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {farmRowsToRender.map((farm) => {
            const lifetimeLq =
              farm.lifetimeLq !== null && displayPrice > 0
                ? {
                    value: formatLiquidityCompact(farm.lifetimeLq),
                    breakdown: getBreakdownFromLq(farm.lifetimeLq, displayPrice)
                      .breakdown,
                  }
                : { value: "—", breakdown: "—" };
            const lifetimeProgress =
              farm.lifetimeWeeksElapsed !== null
                ? `${farm.lifetimeWeeksElapsed} / ${farm.lifetimeWeeksTarget} wks`
                : "—";
            return (
              <Card
                key={farm.key}
                role="button"
                tabIndex={0}
                aria-label={p.openFarmDetails(farm.name)}
                onClick={() => openFarmDialog(farm)}
                onMouseEnter={() => prefetchFarmImage(farm)}
                onFocus={() => prefetchFarmImage(farm)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openFarmDialog(farm);
                  }
                }}
                className={cn(
                  "!gap-0 !py-0 group overflow-hidden transition-all duration-200",
                  "hover:border-border/60 dark:hover:border-border/80 cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <CardContent className="p-0">
                  {/* Farm image header */}
                  <div className="relative h-48 w-full overflow-hidden bg-muted/30">
                    {farm.imageUrl ? (
                      <FallbackImage
                        src={farm.imageUrl}
                        widthForProxy={600}
                        quality={80}
                        alt={farm.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted/40 via-muted/20 to-muted/40 flex items-center justify-center">
                        <span className="text-3xl opacity-30">&#9728;</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                      <h3 className="font-bold text-white text-sm leading-tight truncate">
                        {farm.name}
                      </h3>
                    </div>
                    <div className="absolute top-3 right-3 z-10 rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-white/80">
                      {p.open}
                    </div>
                  </div>
                  <div className="px-5 pt-4 pb-0">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono uppercase tracking-widest">
                        {farm.region}
                      </span>
                    </div>
                  </div>
                  {/* Revenue metrics */}
                  <div className="px-5 pt-5 pb-5 grid grid-cols-2 gap-5">
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                        {p.generatedRevenue}
                      </div>
                      <div className="text-xl font-semibold font-mono tabular-nums tracking-tight">
                        {lifetimeLq.value}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        ({lifetimeLq.breakdown})
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                        {p.lifetimeProgress}
                      </div>
                      <div className="text-xl font-semibold font-mono tabular-nums tracking-tight">
                        {lifetimeProgress}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    );
  },
);

SolarFarmEconomicsSection.displayName = "SolarFarmEconomicsSection";

const LiquidityGctlWalletsSection = React.memo(
  function LiquidityGctlWalletsSection({
    totalPolLq,
    totalPolBreakdown,
    polApyDisplay,
    ninetyDayApy,
    polExitabilityDisplay,
    polLiquidityIsLive,
    polLiquidityChartData,
    isGctlLoading,
    gctlTotalSupply,
    gctlPriceNumber,
    gctlTotalStaked,
    gctlUnstaked,
    gctlRegionChartConfigLive,
    gctlRegionPieData,
    isWalletStatsLoading,
    walletStats,
    hasWalletBreakdown,
    isWalletGrowthMock,
    walletGrowthLive,
    resetModalBlog,
    setIsPolLiquidityDialogOpen,
    setIsGctlDialogOpen,
    setIsWalletStatsDialogOpen,
  }: {
    totalPolLq: number | null;
    totalPolBreakdown: PolBreakdownSummary;
    polApyDisplay: string;
    ninetyDayApy: number | null;
    polExitabilityDisplay: string;
    polLiquidityIsLive: boolean;
    polLiquidityChartData: PolLiquidityChartDatum[];
    isGctlLoading: boolean;
    gctlTotalSupply: number;
    gctlPriceNumber: number;
    gctlTotalStaked: number;
    gctlUnstaked: number;
    gctlRegionChartConfigLive: ChartConfig;
    gctlRegionPieData: GctlRegionSlice[];
    isWalletStatsLoading: boolean;
    walletStats: WalletStatsSummary;
    hasWalletBreakdown: boolean;
    isWalletGrowthMock: boolean;
    walletGrowthLive: WalletGrowthDatum[] | null;
    resetModalBlog: (modal: ModalBlogKey, next?: MiniBlogId) => void;
    setIsPolLiquidityDialogOpen: (open: boolean) => void;
    setIsGctlDialogOpen: (open: boolean) => void;
    setIsWalletStatsDialogOpen: (open: boolean) => void;
  }) {
    const p = usePolCopy();
    const walletBreakdownRows = React.useMemo(
      () =>
        walletStats.breakdown.filter(
          (row) => !/non-?participants?/i.test(row.label),
        ),
      [walletStats.breakdown],
    );

    const walletBreakdownMaxPct = React.useMemo(
      () =>
        walletBreakdownRows.reduce(
          (maxPct, row) => Math.max(maxPct, row.pct),
          0,
        ),
      [walletBreakdownRows],
    );

    return (
      <section className="flex flex-col gap-6 pt-16">
        <SectionHeader title={p.embeddedLiquidityGctlWallets} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Protocol Liquidity ── */}
          <Card
            className={cn(
              "!gap-6 h-full transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            role="button"
            tabIndex={0}
            aria-label={p.openProtocolLiquidityNotes}
            onClick={() => {
              resetModalBlog("polLiquidity");
              setIsPolLiquidityDialogOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                resetModalBlog("polLiquidity");
                setIsPolLiquidityDialogOpen(true);
              }
            }}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{p.liquidity}</div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  {p.clickForNotes}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 h-full">
              <div className="grid grid-cols-2 gap-6">
                <MetricCard
                  label={p.embeddedLiquidity}
                  value={
                    totalPolLq !== null
                      ? formatLiquidityCompact(totalPolLq)
                      : "—"
                  }
                  helper={
                    totalPolBreakdown?.breakdown
                      ? `(${totalPolBreakdown.breakdown})`
                      : p.liveUnavailable
                  }
                  valueClassName="text-2xl sm:text-4xl"
                />
                <MetricCard
                  label={p.apy}
                  value={polApyDisplay}
                  helper={
                    ninetyDayApy !== null ? undefined : p.liveUnavailable
                  }
                  valueClassName="text-2xl sm:text-4xl"
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <MiniStat
                  label={p.marketCapExitable}
                  value={polExitabilityDisplay}
                  valueClassName="text-base sm:text-lg tracking-tight"
                />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                  {p.embeddedLiquidity}
                  {polLiquidityIsLive ? "" : ` · ${p.liveUnavailable}`}
                </div>
                <ChartContainer
                  config={polLiquidityChartConfig}
                  className="min-h-[200px] flex-1 w-full"
                >
                  <AreaChart data={polLiquidityChartData}>
                    <XAxis
                      dataKey="week"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <ChartTooltip content={<PolLiquidityTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="liquidity"
                      stroke="var(--color-liquidity)"
                      fill="var(--color-liquidity)"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {/* ── GCTL ── */}
          <Card
            className={cn(
              "!gap-6 transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            role="button"
            tabIndex={0}
            aria-label={p.openGctlNotes}
            onClick={() => {
              resetModalBlog("gctl");
              setIsGctlDialogOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                resetModalBlog("gctl");
                setIsGctlDialogOpen(true);
              }
            }}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">GCTL</div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  {p.clickForNotes}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-6">
                <MetricCard
                  label={p.totalGctl}
                  value={
                    isGctlLoading
                      ? "..."
                      : formatCompactNumberPrecise(gctlTotalSupply)
                  }
                  valueClassName="text-2xl sm:text-4xl"
                />
                <MetricCard
                  label={p.mintPrice}
                  value={
                    isGctlLoading ? "..." : `$${gctlPriceNumber.toFixed(2)}`
                  }
                  valueClassName="text-2xl sm:text-4xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MiniStat
                  label={p.staked}
                  value={
                    isGctlLoading
                      ? "..."
                      : formatCompactNumberPrecise(gctlTotalStaked)
                  }
                  valueClassName="text-base sm:text-lg tracking-tight"
                />
                <MiniStat
                  label={p.unstaked}
                  value={
                    isGctlLoading
                      ? "..."
                      : formatCompactNumberPrecise(gctlUnstaked)
                  }
                  valueClassName="text-base sm:text-lg tracking-tight"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                  {p.stakingByRegion}
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-6 pt-4 pb-2">
                  <ChartContainer
                    config={gctlRegionChartConfigLive}
                    className="h-40 w-40 shrink-0"
                  >
                    <PieChart>
                      <Pie
                        data={gctlRegionPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={70}
                        strokeWidth={2}
                        stroke="var(--color-card)"
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => {
                              const region = gctlRegionPieData.find(
                                (r) => r.name === name,
                              );
                              return `${formatCompactNumberPrecise(
                                Number(value),
                              )} (${region?.pct ?? 0}%)`;
                            }}
                          />
                        }
                      />
                    </PieChart>
                  </ChartContainer>
                </div>
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 pt-2">
                  {gctlRegionPieData.map((region) => (
                    <div
                      key={region.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: region.fill }}
                        />
                        <span className="truncate">{region.name}</span>
                      </span>
                      <span className="font-mono tabular-nums text-foreground shrink-0">
                        {formatCompactNumberPrecise(region.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Wallet Stats ── */}
          <Card
            className={cn(
              "!gap-6 transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            role="button"
            tabIndex={0}
            aria-label={p.openWalletStatsNotes}
            onClick={() => {
              resetModalBlog("walletStats");
              setIsWalletStatsDialogOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                resetModalBlog("walletStats");
                setIsWalletStatsDialogOpen(true);
              }
            }}
          >
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{p.walletStats}</div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  {p.clickForNotes}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <MiniStat
                  label={p.glwHolders}
                  value={
                    isWalletStatsLoading
                      ? "..."
                      : formatNumber(walletStats.glwHolders)
                  }
                  valueClassName="text-xl sm:text-2xl tracking-tight"
                />
                <MiniStat
                  label={p.protocolParticipants}
                  value={
                    isWalletStatsLoading
                      ? "..."
                      : formatNumber(walletStats.protocolParticipants)
                  }
                  valueClassName="text-xl sm:text-2xl tracking-tight"
                />
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                  {p.newWalletsPerWeek}
                  {isWalletGrowthMock ? ` · ${p.liveUnavailable}` : ""}
                </div>
                <ChartContainer
                  config={walletGrowthChartConfig}
                  className="h-32 w-full"
                >
                  <BarChart data={walletGrowthLive ?? []} barGap={2}>
                    <XAxis
                      dataKey="week"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <ChartTooltip content={<WalletGrowthTooltip />} />
                    <Bar
                      dataKey="newWallets"
                      fill="var(--color-newWallets)"
                      radius={[3, 3, 0, 0]}
                      fillOpacity={0.7}
                    />
                  </BarChart>
                </ChartContainer>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                  {p.walletBreakdown}
                  {hasWalletBreakdown ? "" : ` · ${p.liveUnavailable}`}
                </div>
                <div className="flex flex-col gap-3">
                  {hasWalletBreakdown && walletBreakdownRows.length > 0 ? (
                    walletBreakdownRows.map((row) => (
                      <div key={row.label} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: row.color }}
                              />
                              <span className="text-muted-foreground">
                                {p.walletBreakdownLabels[row.label] ?? row.label}
                              </span>
                            </span>
                            <span className="font-mono tabular-nums text-foreground">
                              {row.count.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-3 w-full rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${
                                  walletBreakdownMaxPct > 0
                                    ? (row.pct / walletBreakdownMaxPct) * 100
                                    : 0
                                }%`,
                                backgroundColor: row.color,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60 dark:text-muted-foreground/80 w-10 text-right shrink-0">
                          {row.pct}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      {p.liveUnavailable}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  },
);

LiquidityGctlWalletsSection.displayName = "LiquidityGctlWalletsSection";

const DelegationRegionsAndImpactSection = React.memo(
  function DelegationRegionsAndImpactSection({
    delegatedDisplay,
    hasDelegationData,
    delegatorsDisplay,
    delegatorsCount,
    averageApyDisplay,
    averageDelegatorApy,
    delegationTrendLive,
    delegationTrendTicks,
    delegationCurrentTickValue,
    delegationRatioWidth,
    delegationRatioPct,
    delegationRatioDetail,
    regionsRowsForRender,
    displayPrice,
    impactTotals,
    resetModalBlog,
    setIsDelegationDialogOpen,
    setIsRegionsDialogOpen,
    setIsNetworkImpactDialogOpen,
  }: {
    delegatedDisplay: string;
    hasDelegationData: boolean;
    delegatorsDisplay: string;
    delegatorsCount: number | null;
    averageApyDisplay: string;
    averageDelegatorApy: number | null;
    delegationTrendLive: DelegationTrendDatum[] | null;
    delegationTrendTicks: number[];
    delegationCurrentTickValue: number | null;
    delegationRatioWidth: number;
    delegationRatioPct: number | null;
    delegationRatioDetail: string;
    regionsRowsForRender: RegionsRow[];
    displayPrice: number;
    impactTotals: ImpactTotals;
    resetModalBlog: (modal: ModalBlogKey, next?: MiniBlogId) => void;
    setIsDelegationDialogOpen: (open: boolean) => void;
    setIsRegionsDialogOpen: (open: boolean) => void;
    setIsNetworkImpactDialogOpen: (open: boolean) => void;
  }) {
    const p = usePolCopy();

    return (
      <>
        <section className="flex flex-col gap-6 pt-16">
          <SectionHeader title={p.delegationRegions} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
            <Card
              className={cn(
                "!gap-6 flex flex-col transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              role="button"
              tabIndex={0}
              aria-label={p.openDelegationNotes}
              onClick={() => {
                resetModalBlog("delegation");
                setIsDelegationDialogOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  resetModalBlog("delegation");
                  setIsDelegationDialogOpen(true);
                }
              }}
            >
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    {p.delegationMetrics}
                  </div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                    {p.clickForNotes}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 h-full">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <MiniStat
                    label={p.glwDelegated}
                    value={delegatedDisplay}
                    helper={
                      hasDelegationData ? undefined : p.liveUnavailable
                    }
                    valueClassName="text-lg sm:text-2xl tracking-tight"
                  />
                  <MiniStat
                    label={p.delegators}
                    value={delegatorsDisplay}
                    helper={
                      delegatorsCount !== null
                        ? undefined
                        : p.liveUnavailable
                    }
                    valueClassName="text-lg sm:text-2xl tracking-tight"
                  />
                  <MiniStat
                    label={p.estimatedApy}
                    value={averageApyDisplay}
                    helper={
                      averageDelegatorApy !== null
                        ? undefined
                        : p.liveUnavailable
                    }
                    valueClassName="text-lg sm:text-2xl tracking-tight"
                  />
                </div>

                <div className="flex flex-col">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-3">
                    {p.delegationGrowth}
                  </div>
                  <ChartContainer
                    config={delegationTrendChartConfig}
                    className="h-36 sm:h-40 w-full"
                  >
                    <AreaChart data={delegationTrendLive ?? []}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="weekEndMs"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        ticks={delegationTrendTicks}
                        tickFormatter={(value) => {
                          const n = Number(value);
                          if (
                            delegationCurrentTickValue !== null &&
                            n === delegationCurrentTickValue
                          ) {
                            return p.current;
                          }
                          return formatMonthAxisUtc(new Date(n - 1));
                        }}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 9 }}
                        interval={0}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        tick={{ fontSize: 9 }}
                        tickFormatter={(v) => `${v}M`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(label, payload) => {
                              const datum = (payload?.[0] as any)?.payload as
                                | DelegationTrendDatum
                                | undefined;
                              const weekStart = datum?.weekStartMs
                                ? new Date(datum.weekStartMs)
                                : null;
                              const weekEnd = datum?.weekEndMs
                                ? new Date(datum.weekEndMs - 1)
                                : null;

                              if (datum?.isCurrent) {
                                return p.current;
                              }

                              if (weekStart && weekEnd) {
                                return `${formatDateShortUtc(
                                  weekStart,
                                )} - ${formatDateShortUtc(weekEnd)} UTC`;
                              }

                              if (typeof label === "number") {
                                return formatDateAxisUtc(
                                  new Date(Number(label) - 1),
                                );
                              }
                              return String(label ?? "");
                            }}
                            formatter={(value) => {
                              const numeric =
                                typeof value === "number"
                                  ? value
                                  : Number(value);
                              const formatted = Number.isFinite(numeric)
                                ? numeric.toFixed(3)
                                : value;
                              return [`${formatted}M GLW`, p.delegated];
                            }}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="delegated"
                        stroke="var(--color-delegated)"
                        fill="var(--color-delegated)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
                    {p.delegationRatio}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${delegationRatioWidth.toFixed(1)}%`,
                          background:
                            "linear-gradient(90deg, hsl(270, 70%, 60%), hsl(270, 70%, 50%))",
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono tabular-nums text-foreground">
                      {delegationRatioPct !== null
                        ? `${delegationRatioPct.toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80 mt-1">
                    {delegationRatioDetail}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "!gap-6 transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              role="button"
              tabIndex={0}
              aria-label={p.openRegionRevenueNotes}
              onClick={() => {
                resetModalBlog("regions");
                setIsRegionsDialogOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  resetModalBlog("regions");
                  setIsRegionsDialogOpen(true);
                }
              }}
            >
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    {p.perRegionRevenue}
                  </div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                    {p.clickForNotes}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-border/20 dark:border-border/40">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 dark:bg-background/40">
                      <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                        <th className="px-3 sm:px-4 py-3">{p.region}</th>
                        <th className="px-3 sm:px-4 py-3">{p.lifetime}</th>
                        <th className="px-3 sm:px-4 py-3">{p.threeMonth}</th>
                        <th className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                          {p.farms}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {regionsRowsForRender.map((region) => {
                        const lifetimeLiquidity =
                          region.lifetimeLq !== null && displayPrice > 0
                            ? {
                                value: formatLiquidityCompact(
                                  region.lifetimeLq,
                                ),
                                breakdown: getBreakdownFromLq(
                                  region.lifetimeLq,
                                  displayPrice,
                                ).breakdown,
                              }
                            : { value: "—", breakdown: "—" };
                        const ninetyDayLiquidity =
                          region.ninetyDayLq !== null && displayPrice > 0
                            ? {
                                value: formatLiquidityCompact(
                                  region.ninetyDayLq,
                                ),
                                breakdown: getBreakdownFromLq(
                                  region.ninetyDayLq,
                                  displayPrice,
                                ).breakdown,
                              }
                            : { value: "—", breakdown: "—" };

                        return (
                          <tr
                            key={region.region}
                            className="border-t border-border/10 dark:border-border/20 hover:bg-muted/40 dark:hover:bg-background/60 transition-colors"
                          >
                            <td className="px-3 sm:px-4 py-3">
                              <div className="font-semibold text-xs sm:text-sm">
                                {region.region}
                              </div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                {region.stakedGctl !== null
                                  ? `${formatNumber(
                                      region.stakedGctl,
                                    )} ${p.gctlStakedSuffix}`
                                  : "—"}
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <div className="font-mono tabular-nums text-xs sm:text-sm">
                                {lifetimeLiquidity.value}
                              </div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                ({lifetimeLiquidity.breakdown})
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <div className="font-mono tabular-nums text-xs sm:text-sm">
                                {ninetyDayLiquidity.value}
                              </div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                ({ninetyDayLiquidity.breakdown})
                              </div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                {region.ccPerWeek !== null
                                  ? `${region.ccPerWeek.toFixed(1)} cc/wk`
                                  : "—"}
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-3 font-mono tabular-nums hidden sm:table-cell">
                              {region.farms}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <NetworkImpactSection
          impactTotals={impactTotals}
          onOpenDialog={() => {
            resetModalBlog("networkImpact");
            setIsNetworkImpactDialogOpen(true);
          }}
        />
      </>
    );
  },
);

DelegationRegionsAndImpactSection.displayName =
  "DelegationRegionsAndImpactSection";

const TokenEmissionsSection = React.memo(function TokenEmissionsSection({
  vestingCategorySeries,
  vestingSeries,
  vestingBreakdown,
  fdvUsd,
  hasLivePrice,
  priceDetail,
  polGlwInPol,
  onOpenFdvDialog,
}: {
  vestingCategorySeries: any[] | null;
  vestingSeries: Array<{ year: string; unlocked: number }>;
  vestingBreakdown: {
    total: number;
    categories: Record<string, number>;
  } | null;
  fdvUsd: number | null;
  hasLivePrice: boolean;
  priceDetail: string;
  polGlwInPol: number | null;
  onOpenFdvDialog: () => void;
}) {
  const p = usePolCopy();

  return (
    <section className="flex flex-col gap-6 pt-16">
      <SectionHeader title={p.tokenEmissions} />
      <Card
        className={cn(
          "!gap-6 transition-colors cursor-pointer hover:border-border/60 dark:hover:border-border/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        role="button"
        tabIndex={0}
        aria-label={p.tokenEmissions}
        onClick={onOpenFdvDialog}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenFdvDialog();
          }
        }}
      >
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              {p.tokenEmissions}
            </div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {p.clickToExplore}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-8 xl:grid-cols-12">
          <div className="xl:col-span-7">
            {vestingCategorySeries ? (
              <ChartContainer
                config={vestingCategoryChartConfig}
                className="!aspect-auto h-full min-h-[120px] w-full pb-2 pl-2 pr-3 [&_.recharts-yAxis]:translate-x-0"
              >
                <AreaChart
                  data={vestingCategorySeries}
                  margin={{ top: 8, right: 10, bottom: 10, left: 0 }}
                  stackOffset="none"
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 9,
                      fill: "var(--muted-foreground)",
                    }}
                    tickMargin={10}
                    interval="preserveStartEnd"
                    minTickGap={40}
                    padding={{ left: 4, right: 4 }}
                    tickFormatter={(v) => {
                      if (typeof v === "string" && /^\d{4}-\d{2}$/.test(v)) {
                        const [y, m] = v.split("-");
                        const month = new Date(
                          Number(y),
                          Number(m) - 1,
                        ).toLocaleString("en-US", { month: "short" });
                        return `${month} ${y!.slice(2)}`;
                      }
                      return String(v);
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                    }}
                    tickMargin={8}
                    tickFormatter={(value) => `${Math.round(Number(value))}M`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) => {
                          if (
                            typeof label === "string" &&
                            /^\d{4}-\d{2}$/.test(label)
                          ) {
                            const [y, m] = label.split("-");
                            const month = new Date(
                              Number(y),
                              Number(m) - 1,
                            ).toLocaleString("en-US", { month: "long" });
                            return `${month} ${y}`;
                          }
                          return `Year ${label}`;
                        }}
                        formatter={(value, name, item) => {
                          const n =
                            typeof value === "number" ? value : Number(value);
                          const color =
                            item?.color ||
                            (item?.payload as Record<string, unknown>)?.fill;
                          return (
                            <>
                              <div
                                className="shrink-0 h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor: color as string,
                                }}
                              />
                              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                                <span className="text-muted-foreground">
                                  {name}
                                </span>
                                <span className="font-mono font-medium tabular-nums text-foreground">
                                  {Math.round(n)}M GLW
                                </span>
                              </div>
                            </>
                          );
                        }}
                      />
                    }
                  />
                  {[...VESTING_CATEGORIES].reverse().map((c) => (
                    <Area
                      key={c.key}
                      type="monotone"
                      dataKey={c.key}
                      name={p.tokenCategoryLabels[c.key]}
                      stackId="1"
                      stroke={c.color}
                      strokeWidth={1}
                      fill={c.color}
                      fillOpacity={0.2}
                      dot={false}
                      activeDot={false}
                    />
                  ))}
                </AreaChart>
              </ChartContainer>
            ) : (
              <ChartContainer
                config={vestingChartConfig}
                className="!aspect-auto h-full min-h-[120px] w-full pb-2 pl-2 pr-3 [&_.recharts-yAxis]:translate-x-0"
              >
                <AreaChart
                  data={vestingSeries}
                  margin={{ top: 8, right: 10, bottom: 10, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="vestingGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-glow-orange)"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-glow-orange)"
                        stopOpacity={0.2}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                    }}
                    tickMargin={10}
                    padding={{ left: 8, right: 8 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                    }}
                    tickMargin={8}
                    tickFormatter={(value) => `${Math.round(Number(value))}M`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                    labelFormatter={(label) => `Year ${label}`}
                        formatter={(value) => {
                          const n =
                            typeof value === "number" ? value : Number(value);
                    return `${Math.round(n)}M GLW unlocked`;
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="unlocked"
                    stroke="var(--color-glow-orange)"
                    strokeWidth={2.5}
                    fill="url(#vestingGradient)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "var(--color-glow-orange)",
                      stroke: "var(--card)",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>
          <div className="xl:col-span-5">
            <div className="grid gap-4">
              <MetricCard
                label="FDV"
                value={fdvUsd !== null ? formatUsdCompactPrecise(fdvUsd) : "—"}
                helper={
                  fdvUsd !== null && hasLivePrice
                    ? `${formatCompactNumberPrecise(
                        FDV_TOTAL_TOKENS_GLW - (polGlwInPol ?? 0),
                      )} GLW ${p.fdvHelperAt} $${priceDetail}`
                    : p.liveUnavailable
                }
              />
              <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-background/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                    {p.tokenBreakdown}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                    {vestingBreakdown
                      ? `${formatCompactNumberPrecise(
                          vestingBreakdown.total,
                        )} ${p.glwTotal}`
                      : `${formatCompactNumberPrecise(
                          FDV_TOTAL_TOKENS_GLW,
                        )} ${p.glwTotal}`}
                  </div>
                </div>

                {vestingBreakdown ? (
                  (() => {
                    const total = Math.max(1, vestingBreakdown.total);
                    const rows = VESTING_CATEGORIES.map((c) => ({
                      key: c.key,
                      label: p.tokenCategoryLabels[c.key],
                      color: c.color,
                      value: vestingBreakdown.categories[c.key],
                    })).filter((r) => Number.isFinite(r.value) && r.value > 0);

                    const pct = (value: number) =>
                      Math.max(0, (value / total) * 100);

                    return (
                      <div className="mt-4">
                        <div className="h-2.5 rounded-full bg-muted/50 dark:bg-background/40 overflow-hidden flex">
                          {rows.map((r) => (
                            <div
                              key={r.key}
                              className="h-full"
                              style={{
                                width: `${pct(r.value)}%`,
                                background: r.color,
                              }}
                            />
                          ))}
                        </div>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {rows.map((r) => (
                            <div
                              key={r.key}
                              className="flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ background: r.color }}
                                />
                                <span className="text-xs text-muted-foreground truncate">
                                  {r.label}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-2 shrink-0">
                                <span className="text-xs font-mono tabular-nums text-foreground">
                                  {formatCompactNumberPrecise(r.value)} GLW
                                </span>
                                <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70">
                                  {pct(r.value).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">
                    {p.liveBreakdownUnavailable}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
});

TokenEmissionsSection.displayName = "TokenEmissionsSection";

export function PolDashboardView() {
  const p = usePolCopy();
  const [isBannerBlogOpen, setIsBannerBlogOpen] = React.useState(false);
  const [isSupplyDialogOpen, setIsSupplyDialogOpen] = React.useState(false);
  const [isFarmDialogOpen, setIsFarmDialogOpen] = React.useState(false);
  const [isGrowthCardsDialogOpen, setIsGrowthCardsDialogOpen] =
    React.useState(false);
  const [selectedGrowthCard, setSelectedGrowthCard] =
    React.useState<GrowthCardKey>("installations");
  const [isPolLiquidityDialogOpen, setIsPolLiquidityDialogOpen] =
    React.useState(false);
  const [isGctlDialogOpen, setIsGctlDialogOpen] = React.useState(false);
  const [isWalletStatsDialogOpen, setIsWalletStatsDialogOpen] =
    React.useState(false);
  const [isDelegationDialogOpen, setIsDelegationDialogOpen] =
    React.useState(false);
  const [isRegionsDialogOpen, setIsRegionsDialogOpen] = React.useState(false);
  const [isNetworkImpactDialogOpen, setIsNetworkImpactDialogOpen] =
    React.useState(false);
  const [isTokenEmissionsDialogOpen, setIsTokenEmissionsDialogOpen] =
    React.useState(false);
  const [selectedFarmId, setSelectedFarmId] = React.useState<string | null>(
    null,
  );
  const [selectedRegionPrimary, setSelectedRegionPrimary] =
    React.useState<string>("");
  const [selectedRegionSecondary, setSelectedRegionSecondary] =
    React.useState<string>("");
  const [showAllFarms, setShowAllFarms] = React.useState(false);
  const [farmSortKey, setFarmSortKey] = React.useState<
    "latest" | "lifetime" | "credits"
  >("latest");
  const [modalBlogs, setModalBlogs] = React.useState<
    Record<ModalBlogKey, ModalBlogState>
  >(() => ({
    overview: { current: INITIAL_MODAL_BLOGS.overview, history: [] },
    growthCards: { current: INITIAL_MODAL_BLOGS.growthCards, history: [] },
    supply: { current: INITIAL_MODAL_BLOGS.supply, history: [] },
    farm: { current: INITIAL_MODAL_BLOGS.farm, history: [] },
    polLiquidity: { current: INITIAL_MODAL_BLOGS.polLiquidity, history: [] },
    gctl: { current: INITIAL_MODAL_BLOGS.gctl, history: [] },
    walletStats: { current: INITIAL_MODAL_BLOGS.walletStats, history: [] },
    delegation: { current: INITIAL_MODAL_BLOGS.delegation, history: [] },
    regions: { current: INITIAL_MODAL_BLOGS.regions, history: [] },
    networkImpact: { current: INITIAL_MODAL_BLOGS.networkImpact, history: [] },
    tokenEmissions: {
      current: INITIAL_MODAL_BLOGS.tokenEmissions,
      history: [],
    },
  }));

  const navigateModalBlog = React.useCallback(
    (modal: ModalBlogKey, next: MiniBlogId) => {
      setModalBlogs((prev) => {
        const current = prev[modal];
        if (current.current === next) return prev;
        return {
          ...prev,
          [modal]: {
            current: next,
            history: [...current.history, current.current],
          },
        };
      });
    },
    [],
  );

  const goBackModalBlog = React.useCallback((modal: ModalBlogKey) => {
    setModalBlogs((prev) => {
      const current = prev[modal];
      if (current.history.length === 0) return prev;
      const nextHistory = current.history.slice(0, -1);
      const nextCurrent = current.history[current.history.length - 1]!;
      return {
        ...prev,
        [modal]: { current: nextCurrent, history: nextHistory },
      };
    });
  }, []);

  const resetModalBlog = React.useCallback(
    (modal: ModalBlogKey, next?: MiniBlogId) => {
      const defaultBlog = next ?? INITIAL_MODAL_BLOGS[modal];
      setModalBlogs((prev) => ({
        ...prev,
        [modal]: { current: defaultBlog, history: [] },
      }));
    },
    [],
  );

  const { poolReserves, priceRatio: poolSpotPrice } = usePoolInfo();

  const { circulatingSupply, totalSupply, marketCap, glowPrice } =
    useGlowCirculatingSupply();

  const { data: polSummary } = usePolSummary();
  const ponderSpotPrice = polSummary?.spotPrice
    ? Number(polSummary.spotPrice)
    : null;

  const livePrice =
    ponderSpotPrice && Number.isFinite(ponderSpotPrice) && ponderSpotPrice > 0
      ? ponderSpotPrice
      : poolSpotPrice > 0
        ? poolSpotPrice
        : glowPrice;

  const hasLivePrice = livePrice > 0;
  const currentPrice = hasLivePrice ? livePrice : 0;
  const hasLiveSupply = circulatingSupply > 0 && totalSupply > 0;
  const currentCirculating = hasLiveSupply ? circulatingSupply : 0;
  const supplyTotal = hasLiveSupply ? totalSupply : 0;
  const hasLiveMarketCap = marketCap > 0 && hasLivePrice && hasLiveSupply;
  const currentMarketCap = hasLiveMarketCap ? marketCap : 0;

  const displayPrice = hasLivePrice ? livePrice : 0;

  const marketCapDisplay = hasLiveMarketCap
    ? formatUsdWhole(currentMarketCap)
    : "—";
  const priceDisplay = hasLivePrice ? `$${currentPrice.toFixed(4)}` : "—";
  const liquidityUnitValueDisplay = hasLivePrice
    ? `$${(2 * Math.sqrt(currentPrice)).toFixed(currentPrice < 1 ? 3 : 2)}`
    : "—";
  const priceDetail = hasLivePrice ? currentPrice.toFixed(4) : "—";

  // ── GCTL live data ──
  const {
    gctlPriceNumber,
    gctlCirculatingSupplyNumber,
    isGctlPriceLoading,
    isGctlCirculatingSupplyLoading,
  } = useGctlApi();

  const { data: activeRegionsSummary, isLoading: isRegionsSummaryLoading } =
    useActiveRegionsSummary();

  const isGctlLoading =
    isGctlPriceLoading ||
    isGctlCirculatingSupplyLoading ||
    isRegionsSummaryLoading;

  const regionNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    const regions = activeRegionsSummary?.regions ?? [];
    for (const r of regions) map.set(r.id, r.name);
    return map;
  }, [activeRegionsSummary]);

  const resolveRegionName = React.useCallback(
    (zoneId: number | string | null | undefined): string => {
      if (zoneId === null || zoneId === undefined) return "—";
      const id = typeof zoneId === "string" ? Number(zoneId) : zoneId;
      if (!Number.isFinite(id)) return "—";
      return regionNameById.get(id) ?? `Zone ${id}`;
    },
    [regionNameById],
  );

  const gctlTotalSupply =
    gctlCirculatingSupplyNumber > 0 ? gctlCirculatingSupplyNumber : 350_000;
  const gctlTotalStaked = activeRegionsSummary?.totalGctlStaked ?? 0;
  const gctlUnstaked = Math.max(0, gctlTotalSupply - gctlTotalStaked);

  const gctlRegionPieData = React.useMemo(() => {
    if (!activeRegionsSummary?.regions?.length) return GCTL_REGION_PIE_DATA;
    return activeRegionsSummary.regions.map((r) => ({
      name: r.name,
      value: Math.round(r.stakedGctl),
      fill: REGION_COLORS[r.name] ?? DEFAULT_REGION_COLOR,
      pct:
        gctlTotalStaked > 0
          ? Math.round((r.stakedGctl / gctlTotalStaked) * 100)
          : 0,
    }));
  }, [activeRegionsSummary, gctlTotalStaked]);

  const gctlRegionChartConfigLive = React.useMemo(() => {
    if (!activeRegionsSummary?.regions?.length) return gctlRegionChartConfig;
    return Object.fromEntries(
      activeRegionsSummary.regions.map((r) => [
        r.name,
        { label: r.name, color: REGION_COLORS[r.name] ?? DEFAULT_REGION_COLOR },
      ]),
    ) as Record<string, { label: string; color: string }>;
  }, [activeRegionsSummary]);

  // ── Wallet Stats live data ──
  const { data: impactWalletStats, isLoading: isWalletStatsLoadingApi } =
    useImpactWalletStats();

  const { data: impactMetrics } = useImpactMetrics();

  const { holdersCount: gctlHoldersCount, isLoading: isGctlHoldersLoading } =
    useGctlHoldersCount();

  const walletStats = React.useMemo(() => {
    const totalWallets = impactWalletStats?.totalWallets ?? 0;
    const glwHoldersRaw =
      toFiniteNumber((impactWalletStats as any)?.glwHolders) ??
      toFiniteNumber((impactWalletStats as any)?.glw_holders) ??
      toFiniteNumber((impactWalletStats as any)?.holders) ??
      toFiniteNumber((impactWalletStats as any)?.holdersCount) ??
      null;
    const glwHolders =
      glwHoldersRaw !== null
        ? Math.max(0, Math.min(Math.round(glwHoldersRaw), totalWallets))
        : totalWallets;
    const delegatorCount = impactWalletStats?.delegators ?? 0;
    const minerCount = impactWalletStats?.miners ?? 0;
    const gctlCount =
      gctlHoldersCount > 0 ? Math.min(gctlHoldersCount, totalWallets) : 0;
    const protocolParticipantsRaw =
      toFiniteNumber((impactWalletStats as any)?.protocolParticipants) ??
      toFiniteNumber((impactWalletStats as any)?.protocol_participants) ??
      toFiniteNumber((impactWalletStats as any)?.participantWallets) ??
      toFiniteNumber((impactWalletStats as any)?.participant_wallets) ??
      toFiniteNumber((impactWalletStats as any)?.activeWallets) ??
      toFiniteNumber((impactWalletStats as any)?.active_wallets) ??
      null;
    const protocolParticipants =
      protocolParticipantsRaw !== null
        ? Math.max(
            0,
            Math.min(Math.round(protocolParticipantsRaw), totalWallets),
          )
        : Math.max(delegatorCount, minerCount, gctlCount);
    const nonParticipants = Math.max(0, totalWallets - protocolParticipants);
    const total = totalWallets || 1; // avoid division by zero
    return {
      totalWallets,
      glwHolders,
      protocolParticipants,
      delegatorCount,
      minerCount,
      gctlCount,
      nonParticipants,
      breakdown: [
        {
          label: "Delegators",
          count: delegatorCount,
          pct: Math.round((delegatorCount / total) * 1000) / 10,
          color: "#a855f7",
        },
        {
          label: "Miners",
          count: minerCount,
          pct: Math.round((minerCount / total) * 1000) / 10,
          color: "#2081e2",
        },
        {
          label: "GCTL holders",
          count: gctlCount,
          pct: Math.round((gctlCount / total) * 1000) / 10,
          color: "#22d3ee",
        },
        {
          label: "Non-Participants",
          count: nonParticipants,
          pct: Math.round((nonParticipants / total) * 1000) / 10,
          color: "#4ade80",
        },
      ],
    };
  }, [impactWalletStats, gctlHoldersCount]);

  const isWalletStatsLoading = isWalletStatsLoadingApi || isGctlHoldersLoading;

  const impactTotals = React.useMemo(() => {
    if (!impactMetrics) return null;
    const totalWatts = impactMetrics.totalWatts;
    const capacityMw =
      Number.isFinite(totalWatts) && totalWatts > 0
        ? totalWatts / 1_000_000
        : null;
    return {
      panels: impactMetrics.solarPanelsInstalled ?? null,
      totalFarms: impactMetrics.totalFarms ?? null,
      capacityMw,
      homesPowered: impactMetrics.homesPowered ?? null,
      trees: impactMetrics.adultTreesEquivalent ?? null,
    };
  }, [impactMetrics]);

  // ── Wallet growth chart (new wallets per week) ──
  const currentEpoch = React.useMemo(() => getCurrentEpoch(), []);
  const newWalletsEndWeek = Math.max(97, currentEpoch - 1);
  const newWalletsStartWeek = Math.max(97, newWalletsEndWeek - 11);
  const { data: newWalletsByWeekData } = useImpactNewWalletsByWeek({
    startWeek: newWalletsStartWeek,
    endWeek: newWalletsEndWeek,
  });
  const { data: totalActivelyDelegatedData } = useTotalActivelyDelegated({
    includeApy: true,
  });
  // Pull full V2 history for the delegation chart, while growth KPIs still read
  // the exact weeks they need from this shared payload.
  const supplyGrowthEndWeek = Math.max(97, currentEpoch - 1);
  const supplyGrowthStartWeek = Math.max(97, supplyGrowthEndWeek - 13);
  // "Today vs 3 months ago" should anchor on the current week, not the last completed week.
  const trailing3MonthStartWeek = Math.max(97, currentEpoch - 13);
  const { data: activelyDelegatedByWeekData } = useActivelyDelegatedByWeek({
    startWeek: POL_LIQUIDITY_V2_START_WEEK,
    endWeek: supplyGrowthEndWeek,
  });
  const { data: polLiquiditySnapshot } = usePolLiquiditySnapshot({
    range: "13w",
  });
  const { data: glowCirculatingSnapshot } = useGlowCirculatingSnapshot({
    range: "20w",
    includePartialWeek: true,
  });

  const vaultedGlw = React.useMemo(() => {
    const raw = totalActivelyDelegatedData?.totalGlwDelegatedWei;
    if (raw === null || raw === undefined) return null;
    try {
      return Number(formatUnits(BigInt(raw), 18));
    } catch {
      return null;
    }
  }, [totalActivelyDelegatedData]);

  const polWalletGlw = React.useMemo(() => {
    const raw = polSummary?.total?.breakdown?.glw;
    if (raw === null || raw === undefined) return null;
    try {
      return Number(formatUnits(BigInt(raw), 18));
    } catch {
      return null;
    }
  }, [polSummary]);

  const polGlwInPol = React.useMemo(() => {
    const endowmentGlw = polSummary?.endowment?.glw ?? null;
    const botActiveGlw = polSummary?.botActive?.glw ?? null;
    if (endowmentGlw === null || botActiveGlw === null) return null;
    try {
      const sum = BigInt(endowmentGlw) + BigInt(botActiveGlw);
      return Number(formatUnits(sum, 18));
    } catch {
      return null;
    }
  }, [polSummary]);

  const totalPolLq = React.useMemo(() => {
    const raw = polSummary?.total?.lq;
    if (raw === null || raw === undefined) return null;
    return parseLqUnits(raw);
  }, [polSummary]);

  const walletGrowthLive = React.useMemo(() => {
    const byWeek = newWalletsByWeekData?.byWeek;
    if (!byWeek || Object.keys(byWeek).length < 3) return null;

    const weeks = Object.keys(byWeek)
      .map(Number)
      .sort((a, b) => a - b);

    // Take last 12 weeks of counts (last completed weeks)
    const tail = weeks.slice(-12);
    if (tail.length < 2) return null;

    const result: WalletGrowthDatum[] = [];
    for (let i = 0; i < tail.length; i++) {
      const weekNumber = tail[i];
      const count = byWeek[weekNumber] || 0;
      const weekStartMs = getWeekStartMs(weekNumber);
      const weekEndMs = getWeekEndMs(weekNumber);
      const label = formatDateAxisUtc(new Date(weekEndMs - 1));
      result.push({
        week: label,
        newWallets: Math.max(0, count),
        weekNumber,
        weekStartMs,
        weekEndMs,
      });
    }
    return result;
  }, [newWalletsByWeekData]);

  const isWalletGrowthMock = !walletGrowthLive;
  const hasWalletBreakdown = walletStats.totalWallets > 0;

  const totalDelegatedGlw = React.useMemo(() => {
    const raw = totalActivelyDelegatedData?.totalGlwDelegatedWei;
    if (raw === null || raw === undefined) return null;
    try {
      const value = Number(formatUnits(BigInt(raw), 18));
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }, [totalActivelyDelegatedData]);

  const hasDelegationData = totalDelegatedGlw !== null;
  const delegatorsCount = totalActivelyDelegatedData?.totalWallets ?? null;
  const delegatorsDisplay =
    delegatorsCount !== null && Number.isFinite(delegatorsCount)
      ? formatCompactNumberPrecise(delegatorsCount)
      : "—";
  const averageDelegatorApy = React.useMemo(() => {
    const raw = totalActivelyDelegatedData?.averageDelegatorApy;
    if (raw === null || raw === undefined) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }, [totalActivelyDelegatedData]);
  const averageApyDisplay = React.useMemo(() => {
    if (averageDelegatorApy === null) return "—";
    const pct =
      averageDelegatorApy > 0 && averageDelegatorApy < 2
        ? averageDelegatorApy * 100
        : averageDelegatorApy;
    return formatPercent(pct);
  }, [averageDelegatorApy]);
  const delegatedDisplay =
    totalDelegatedGlw !== null
      ? formatCompactNumberTwoDecimals(totalDelegatedGlw)
      : "—";
  const delegationRatioPct =
    totalDelegatedGlw !== null && currentCirculating > 0
      ? (totalDelegatedGlw / currentCirculating) * 100
      : null;
  const delegationRatioWidth = delegationRatioPct
    ? Math.min(100, Math.max(0, delegationRatioPct))
    : 0;
  const delegationRatioDetail =
    totalDelegatedGlw !== null && currentCirculating > 0
      ? `${formatCompactNumberTwoDecimals(
          totalDelegatedGlw,
        )} / ${formatCompactNumberTwoDecimals(
          currentCirculating,
        )} ${p.circulating} GLW ${p.delegated}`
      : p.liveUnavailable;

  const delegationTrendLive = React.useMemo(() => {
    const byWeek = activelyDelegatedByWeekData?.byWeek;
    if (!byWeek || Object.keys(byWeek).length < 2) return null;
    const weeks = Object.keys(byWeek)
      .map(Number)
      .filter((week) => week >= POL_LIQUIDITY_V2_START_WEEK)
      .sort((a, b) => a - b);
    if (!weeks.length) return null;
    const historical: DelegationTrendDatum[] = weeks.map((week) => {
      const raw = byWeek[week] ?? "0";
      const weekStartMs = getWeekStartMs(week);
      const weekEndMs = getWeekEndMs(week);
      const label = formatMonthAxisUtc(new Date(weekEndMs - 1));

      let glw = 0;
      try {
        glw = Number(formatUnits(BigInt(raw), 18));
      } catch {
        glw = 0;
      }
      const delegatedM = Number.isFinite(glw) ? glw / 1_000_000 : 0;
      return {
        week: label,
        delegated: delegatedM,
        weekNumber: week,
        weekStartMs,
        weekEndMs,
      } satisfies DelegationTrendDatum;
    });

    // Omit the current (incomplete) week to avoid a misleading flattening
    // effect at the end of the chart while the farm is still being delegated.
    return historical;
  }, [activelyDelegatedByWeekData]);

  const delegationCurrentTickValue = React.useMemo(() => {
    if (!delegationTrendLive || delegationTrendLive.length === 0) return null;
    const last = delegationTrendLive[delegationTrendLive.length - 1];
    return last?.isCurrent ? last.weekEndMs : null;
  }, [delegationTrendLive]);

  const delegationTrendTicks = React.useMemo(() => {
    if (!delegationTrendLive || delegationTrendLive.length === 0) return [];
    const ticks: number[] = [];
    const seenMonths = new Set<string>();

    for (const row of delegationTrendLive) {
      const d = new Date(row.weekEndMs - 1);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      if (!seenMonths.has(key)) {
        seenMonths.add(key);
        ticks.push(row.weekEndMs);
      }
    }

    const lastTick =
      delegationTrendLive[delegationTrendLive.length - 1]?.weekEndMs;
    if (
      typeof lastTick === "number" &&
      Number.isFinite(lastTick) &&
      ticks[ticks.length - 1] !== lastTick
    ) {
      ticks.push(lastTick);
    }
    return ticks;
  }, [delegationTrendLive]);

  const polModelInputs = React.useMemo(() => {
    if (!hasLiveSupply) return null;

    const polUsdgMicroRaw = polSummary?.total?.breakdown?.usdg ?? null;
    const polGlwWeiRaw = polSummary?.total?.breakdown?.glw ?? null;
    if (polUsdgMicroRaw === null || polGlwWeiRaw === null) return null;

    const polUsdg = Number(formatUnits(BigInt(polUsdgMicroRaw), 6));
    const polGlw = Number(formatUnits(BigInt(polGlwWeiRaw), 18));
    if (
      !Number.isFinite(polUsdg) ||
      !Number.isFinite(polGlw) ||
      polUsdg <= 0 ||
      polGlw <= 0
    ) {
      return null;
    }

    const k = polUsdg * polGlw;
    if (!Number.isFinite(k) || k <= 0) return null;

    return {
      k,
      polNow: Math.max(0, polWalletGlw ?? 0),
      maxPolGlw: Math.max(0, currentCirculating + Math.max(0, polWalletGlw ?? 0)),
    };
  }, [currentCirculating, hasLiveSupply, polSummary, polWalletGlw]);

  const supplyPriceRangeMin = React.useMemo(() => {
    if (polModelInputs === null) return PRICE_RANGE.min;

    const denominator = polModelInputs.maxPolGlw ** 2;
    if (!Number.isFinite(denominator) || denominator <= 0) {
      return PRICE_RANGE.min;
    }

    const zeroSupplyPrice =
      (polModelInputs.k / denominator) * ZERO_SUPPLY_PRICE_EPSILON;
    return Math.max(
      PRICE_RANGE.min,
      resolvePriceRangeMin(zeroSupplyPrice),
    );
  }, [polModelInputs]);

  // ── Supply model slider ──
  const [price, setPrice] = React.useState(displayPrice);
  const [hasAdjustedSlider, setHasAdjustedSlider] = React.useState(false);
  const [sliderValue, setSliderValue] = React.useState(() =>
    priceToLogSlider(displayPrice, PRICE_RANGE.min),
  );
  const resetSupplyModel = React.useCallback(() => {
    if (!hasLivePrice || livePrice <= 0) return;
    setPrice(livePrice);
    setSliderValue(priceToLogSlider(livePrice, supplyPriceRangeMin));
    setHasAdjustedSlider(false);
  }, [hasLivePrice, livePrice, supplyPriceRangeMin]);

  React.useEffect(() => {
    if (!hasAdjustedSlider && livePrice > 0) {
      setPrice(livePrice);
      setSliderValue(priceToLogSlider(livePrice, supplyPriceRangeMin));
    }
  }, [hasAdjustedSlider, livePrice, supplyPriceRangeMin]);

  React.useEffect(() => {
    if (!Number.isFinite(price) || price <= 0) return;
    setSliderValue(priceToLogSlider(price, supplyPriceRangeMin));
  }, [price, supplyPriceRangeMin]);

  const isAtLivePrice = React.useMemo(() => {
    if (!hasLivePrice || displayPrice <= 0 || !Number.isFinite(displayPrice))
      return false;
    if (!Number.isFinite(price) || price <= 0) return false;
    // Slider is log-scale; treat "same price" with a small tolerance.
    return Math.abs(price - displayPrice) / displayPrice < 0.0005; // 0.05%
  }, [displayPrice, hasLivePrice, price]);

  const supplyModel = React.useMemo(() => {
    const poolUsdg = poolReserves?.usdg ?? 0;
    const poolGlw = poolReserves?.glw ?? 0;

    // xy = k with x=USDG, y=GLW, price = USDG/GLW
    // This gives USDG side scaling with sqrt(price), and implies GLW side scales with 1/sqrt(price).
    // IMPORTANT: `usePoolInfo` already reads the full Uniswap reserves. Do NOT
    // add protocol totals from `/pol/summary`, or we'd double-count.
    const k = poolUsdg > 0 && poolGlw > 0 ? poolUsdg * poolGlw : 0;
    const effectivePrice = isAtLivePrice ? displayPrice : price;

    // At the default dialog state (current price), the model should equal live data.
    const modeledUsdg =
      isAtLivePrice && poolUsdg > 0
        ? poolUsdg
        : k > 0 && effectivePrice > 0
          ? Math.sqrt(k * effectivePrice)
          : null;
    const modeledGlw =
      isAtLivePrice && poolGlw > 0
        ? poolGlw
        : k > 0 && effectivePrice > 0
          ? Math.sqrt(k / effectivePrice)
          : null;

    const poolDepthUsd =
      modeledUsdg !== null && modeledGlw !== null && effectivePrice > 0
        ? modeledUsdg + modeledGlw * effectivePrice
        : null;

    return {
      total: supplyTotal,
      modeledPoolUsdg: modeledUsdg,
      modeledPoolGlw: modeledGlw,
      modeledPoolDepthUsd: poolDepthUsd,
    };
  }, [poolReserves, displayPrice, isAtLivePrice, price, supplyTotal]);

  const liquidCirculatingNow = React.useMemo(() => {
    if (!hasLiveSupply) return null;
    // `currentCirculating` is the canonical circulating supply. It excludes:
    // - Vaulted GLW (delegated)
    // - PoL GLW in protocol-owned positions
    return currentCirculating;
  }, [currentCirculating, hasLiveSupply]);

  const modeledPolGlw = React.useMemo(() => {
    if (!hasLiveSupply) return null;

    // Model protocol-owned reserves directly (endowment LP position + trading bot active),
    // per spec: k = Total_USDG_Reserves_current * Total_GLW_Reserves_current.
    const effectivePrice = Number.isFinite(price) && price > 0 ? price : null;

    if (polModelInputs === null || effectivePrice === null) {
      // Best-effort: fall back to current PoL GLW (so UI doesn't show nonsense).
      return polWalletGlw !== null && Number.isFinite(polWalletGlw)
        ? Math.max(0, polWalletGlw)
        : null;
    }

    // At the live price (default), this equals `polGlw` by construction.
    const raw = Math.sqrt(polModelInputs.k / effectivePrice);
    // PoL can only absorb from circulating (not from vaulted/other). Since
    // `currentCirculating` already excludes current PoL GLW, the max PoL GLW
    // is (current PoL GLW + current circulating).
    return Math.min(polModelInputs.maxPolGlw, Math.max(0, raw));
  }, [hasLiveSupply, polModelInputs, polWalletGlw, price]);

  const modeledPolUsdg = React.useMemo(() => {
    if (!hasLiveSupply) return null;

    const polUsdgMicroRaw = polSummary?.total?.breakdown?.usdg ?? null;
    const polGlwWeiRaw = polSummary?.total?.breakdown?.glw ?? null;
    const effectivePrice = Number.isFinite(price) && price > 0 ? price : null;

    if (
      polUsdgMicroRaw === null ||
      polGlwWeiRaw === null ||
      effectivePrice === null
    ) {
      try {
        const fallbackRaw = polSummary?.total?.breakdown?.usdg ?? null;
        if (fallbackRaw === null || fallbackRaw === undefined) return null;
        const fallback = Number(formatUnits(BigInt(fallbackRaw), 6));
        return Number.isFinite(fallback) ? Math.max(0, fallback) : null;
      } catch {
        return null;
      }
    }

    const polUsdg = Number(formatUnits(BigInt(polUsdgMicroRaw), 6));
    const polGlw = Number(formatUnits(BigInt(polGlwWeiRaw), 18));
    if (
      !Number.isFinite(polUsdg) ||
      !Number.isFinite(polGlw) ||
      polUsdg <= 0 ||
      polGlw <= 0
    )
      return null;

    const k = polUsdg * polGlw;
    if (!Number.isFinite(k) || k <= 0) return null;
    const modeled = Math.sqrt(k * effectivePrice);
    return Number.isFinite(modeled) ? Math.max(0, modeled) : null;
  }, [hasLiveSupply, polSummary, price]);

  const liquidCirculatingModeled = React.useMemo(() => {
    if (!hasLiveSupply || modeledPolGlw === null) return null;
    const polNow = polWalletGlw;
    if (polNow === null || polNow === undefined) return null;
    // If PoL GLW increases by Δ, circulating decreases by Δ (and vice versa).
    const deltaPol = modeledPolGlw - polNow;
    return Math.max(0, currentCirculating - deltaPol);
  }, [currentCirculating, hasLiveSupply, modeledPolGlw, polWalletGlw]);

  const supplyDelta = React.useMemo(() => {
    if (liquidCirculatingModeled === null || liquidCirculatingNow === null)
      return null;
    return liquidCirculatingModeled - liquidCirculatingNow;
  }, [liquidCirculatingModeled, liquidCirculatingNow]);

  const { data: polRevenueAggregate } = usePolRevenueAggregate();
  const { data: polRevenueFarms } = usePolRevenueFarms();
  const { data: polRevenueRegions } = usePolRevenueRegions();
  // Pulled for per-farm nameplate capacity (`systemWattageOutput`). The
  // /pol/revenue/farms endpoint only exposes `panels` count, which would
  // force a hardcoded W/panel assumption; joining with completed-applications
  // lets us use the authoritative kW DC rating reported by the installer.
  const { farms: completedFarmApplications } = useCompletedFarms({
    includeFractions: true,
  });

  const ninetyDayApy = React.useMemo(() => {
    const raw = polRevenueAggregate?.ninety_day_apy;
    if (raw === null || raw === undefined) return null;
    const value = typeof raw === "string" ? Number(raw) : raw;
    return Number.isFinite(value) ? value : null;
  }, [polRevenueAggregate]);

  const polApyDisplay = React.useMemo(() => {
    if (ninetyDayApy === null) return "—";
    const pct =
      ninetyDayApy > 0 && ninetyDayApy < 2 ? ninetyDayApy * 100 : ninetyDayApy;
    return formatPercent(pct);
  }, [ninetyDayApy]);

  // Monthly Solar Construction = average kW of new solar brought online per
  // 4-week month, computed over the trailing 13-week window.
  //
  // Data sources:
  // - `polRevenueFarms` gives each farm's `audit_week` (the first protocol
  //   week the farm is active and earning GLW).
  // - `completedFarmApplications` gives each farm's `systemWattageOutput`
  //   (authoritative nameplate kW DC as reported by the installer).
  //
  // Farms are joined by `farm_id`. If a farm is missing from the completed-
  // applications feed or its wattage string can't be parsed, we fall back to
  // a panels × 400 W estimate, which is close for residential installs but
  // under-counts modern high-efficiency commercial modules.
  const monthlySolarConstructionKw = React.useMemo(() => {
    const farms = polRevenueFarms?.farms ?? [];
    if (farms.length === 0) return null;

    const WATTS_PER_PANEL_FALLBACK = 400;
    const WINDOW_WEEKS = 13;
    const WEEKS_PER_MONTH = 4;
    // Anchor to the same start-of-window week as the adjacent
    // trailing-3-month POL growth KPI so "13 weeks" is consistent across
    // the Overview row. Farms whose first active week is strictly after the
    // snapshot week are considered "new" within the window.
    const windowStartWeek = trailing3MonthStartWeek;

    const wattsByFarmId = new Map<string, number>();
    for (const app of completedFarmApplications) {
      const farmId = app.farm?.id;
      if (!farmId) continue;
      const kw = parseSystemWattageOutputKw(app.systemWattageOutput);
      if (kw === null) continue;
      wattsByFarmId.set(farmId, kw * 1000);
    }

    let wattsInWindow = 0;
    for (const farm of farms) {
      const raw =
        (farm as any).audit_week ?? (farm as any).auditWeek ?? null;
      const firstActiveWeek =
        typeof raw === "string"
          ? Number(raw)
          : typeof raw === "number"
            ? raw
            : null;
      if (firstActiveWeek === null || !Number.isFinite(firstActiveWeek)) {
        continue;
      }
      if (firstActiveWeek <= windowStartWeek) continue;

      const farmId =
        (farm as any).farm_id ?? (farm as any).farmId ?? null;
      const nameplateWatts =
        typeof farmId === "string" ? wattsByFarmId.get(farmId) : undefined;

      if (nameplateWatts !== undefined && nameplateWatts > 0) {
        wattsInWindow += nameplateWatts;
      } else {
        const panels = Number(farm.panels) || 0;
        if (panels <= 0) continue;
        wattsInWindow += panels * WATTS_PER_PANEL_FALLBACK;
      }
    }

    if (wattsInWindow <= 0) return null;
    const kwPerMonth =
      (wattsInWindow * WEEKS_PER_MONTH) / WINDOW_WEEKS / 1000;
    return Number.isFinite(kwPerMonth) ? kwPerMonth : null;
  }, [
    completedFarmApplications,
    polRevenueFarms,
    trailing3MonthStartWeek,
  ]);

  // 3 Month Trailing PoL Growth (headline KPI) is defined as the delta in total PoL
  // liquidity between now and ~3 months ago (13 weeks), not the CRM-recognized contribution flow.
  const polLqThirteenWeeksAgo = React.useMemo(() => {
    const series = polLiquiditySnapshot?.series ?? null;
    if (!series || series.length === 0) return null;
    const row = series.find((r) => r.week === trailing3MonthStartWeek) ?? null;
    if (!row) return null;
    return parseLqUnits(row.pol_lq ?? null);
  }, [polLiquiditySnapshot, trailing3MonthStartWeek]);

  const polTrailingPolGrowthLq = React.useMemo(() => {
    if (totalPolLq === null || polLqThirteenWeeksAgo === null) return null;
    const delta = totalPolLq - polLqThirteenWeeksAgo;
    return Number.isFinite(delta) ? delta : null;
  }, [polLqThirteenWeeksAgo, totalPolLq]);

  const polTrailingPolGrowthDisplay =
    polTrailingPolGrowthLq !== null
      ? {
          lq: formatLiquidityCompact(polTrailingPolGrowthLq),
          breakdown:
            displayPrice > 0
              ? getBreakdownFromLq(polTrailingPolGrowthLq, displayPrice)
                  .breakdown
              : null,
        }
      : null;

  const farmRowsAll = React.useMemo(() => {
    const farms = polRevenueFarms?.farms ?? [];
    return farms
      .map((farm, index) => {
        const farmId =
          (farm as any).farm_id ??
          (farm as any).farmId ??
          (farm as any).id ??
          null;
        const name =
          (farm as any).farm_name ?? (farm as any).name ?? `Farm ${index + 1}`;
        const region =
          resolveRegionName((farm as any).zone_id ?? null) ??
          (farm as any).region ??
          "—";
        const panels = farm.panels ?? 0;
        const lifetime = parseLqUnits(farm.lifetime_lq ?? null);
        const creditsTotalRaw =
          (farm as any).credits_total ?? (farm as any).cc_lifetime ?? 0;
        const ccLifetime = Number(creditsTotalRaw) || 0;
        const ccPerWeekRaw = (farm as any).cc_per_week ?? 0;
        const ccPerWeek = Number(ccPerWeekRaw) || 0;
        const creditType =
          (farm as any).credit_type ??
          (farm as any).creditType ??
          (farm as any).credits_type ??
          "Carbon Credits";
        const imageUrl = pickSolarPanelsImageUrl([
          (farm as any).image_url ?? null,
          ...(Array.isArray((farm as any).images) ? (farm as any).images : []),
        ]);

        const auditWeekRaw =
          (farm as any).audit_week ?? (farm as any).auditWeek ?? null;
        const auditWeek =
          typeof auditWeekRaw === "string"
            ? Number(auditWeekRaw)
            : typeof auditWeekRaw === "number"
              ? auditWeekRaw
              : null;
        const lifetimeWeeksTargetRaw =
          toFiniteNumber((farm as any).lifetime_weeks) ??
          toFiniteNumber((farm as any).projected_lifetime_weeks) ??
          toFiniteNumber((farm as any).lifetimeWeeks) ??
          toFiniteNumber((farm as any).projectedLifetimeWeeks) ??
          100;
        const lifetimeWeeksTarget = Math.max(
          1,
          Math.round(lifetimeWeeksTargetRaw),
        );
        const lifetimeWeeksElapsed =
          auditWeek !== null && Number.isFinite(auditWeek)
            ? Math.min(
                lifetimeWeeksTarget,
                Math.max(0, Math.floor(currentEpoch - auditWeek)),
              )
            : null;
        const projectedLifetimeCreditsRaw =
          toFiniteNumber((farm as any).projected_lifetime_credits) ??
          toFiniteNumber((farm as any).projected_credits_total) ??
          toFiniteNumber((farm as any).projectedCreditsLifetime) ??
          toFiniteNumber((farm as any).credits_projection_total) ??
          null;
        const projectedLifetimeCredits =
          projectedLifetimeCreditsRaw !== null
            ? Math.max(0, projectedLifetimeCreditsRaw)
            : ccPerWeek > 0
              ? ccPerWeek * lifetimeWeeksTarget
              : null;

        const recencyKey = (() => {
          // Prefer protocol week (monotonic) when available.
          if (auditWeek !== null && Number.isFinite(auditWeek))
            return auditWeek;

          const rawDate =
            (farm as any).installFinishedDate ??
            (farm as any).install_finished_date ??
            (farm as any).createdAt ??
            (farm as any).created_at ??
            null;
          if (typeof rawDate === "string") {
            const ms = Date.parse(rawDate);
            if (Number.isFinite(ms)) return ms;
          }
          if (typeof farmId === "string") {
            const n = Number(farmId);
            if (Number.isFinite(n)) return n;
          }
          return index;
        })();

        return {
          key: farmId ? String(farmId) : `${name}-${index}`,
          farmId: farmId ? String(farmId) : null,
          name,
          region,
          panels,
          lifetimeLq: lifetime,
          ccLifetime,
          ccPerWeek,
          projectedLifetimeCredits,
          creditType,
          lifetimeWeeksElapsed,
          lifetimeWeeksTarget,
          imageUrl,
          auditWeek: auditWeek ?? null,
          recencyKey,
        };
      })
      .filter((row) => {
        if (!row.name) return false;

        // Exclude farms that have no realized revenue yet (e.g., first week at 0).
        if (row.lifetimeLq !== null && row.lifetimeLq <= 0) return false;

        // Exclude low-signal rows from the Solar Farm Economics cards.
        if (
          row.lifetimeLq !== null &&
          row.lifetimeLq < MIN_LIFETIME_REVENUE_LQ
        ) {
          return false;
        }

        return true;
      });
  }, [currentEpoch, polRevenueFarms, resolveRegionName]);

  const selectedFarm = React.useMemo(() => {
    if (!selectedFarmId) return null;
    return (
      farmRowsAll.find((f: any) => f.farmId === selectedFarmId) ??
      farmRowsAll.find((f: any) => f.key === selectedFarmId) ??
      null
    );
  }, [farmRowsAll, selectedFarmId]);

  const prefetchedFarmImageUrlsRef = React.useRef<Set<string>>(new Set());

  const prefetchFarmImage = React.useCallback((farm: FarmRow) => {
    if (typeof window === "undefined") return;
    const imageUrl = farm.imageUrl;
    if (!imageUrl) return;

    const proxyUrl = buildImageProxyUrl(
      imageUrl,
      FARM_IMAGE_MODAL_WIDTH,
      FARM_IMAGE_MODAL_QUALITY,
    );
    if (!proxyUrl || prefetchedFarmImageUrlsRef.current.has(proxyUrl)) return;

    const image = new Image();
    image.decoding = "async";
    image.src = proxyUrl;
    prefetchedFarmImageUrlsRef.current.add(proxyUrl);
  }, []);

  const openFarmDialog = React.useCallback(
    (farm: FarmRow) => {
      if (!farm || farm.name === "—") return;
      const id = farm.farmId ?? farm.key ?? null;
      if (!id) return;
      prefetchFarmImage(farm);
      setSelectedFarmId(String(id));
      resetModalBlog("farm");
      setIsFarmDialogOpen(true);
    },
    [prefetchFarmImage, resetModalBlog],
  );

  const sortedFarmRows = React.useMemo(() => {
    const rows = [...farmRowsAll];
    rows.sort((a, b) => {
      if (farmSortKey === "latest")
        return (b.recencyKey ?? 0) - (a.recencyKey ?? 0);
      if (farmSortKey === "credits")
        return (b.ccPerWeek ?? 0) - (a.ccPerWeek ?? 0);
      return (b.lifetimeLq ?? 0) - (a.lifetimeLq ?? 0);
    });
    return rows;
  }, [farmRowsAll, farmSortKey]);

  const farmRowsForRender = React.useMemo(() => {
    if (sortedFarmRows.length > 0) return sortedFarmRows;
    return Array.from({ length: 6 }).map((_, index) => ({
      key: `farm-placeholder-${index}`,
      farmId: null as string | null,
      name: "—",
      region: "—",
      panels: 0,
      lifetimeLq: null as number | null,
      ccLifetime: 0,
      ccPerWeek: 0,
      projectedLifetimeCredits: null as number | null,
      creditType: "Carbon Credits",
      lifetimeWeeksElapsed: null as number | null,
      lifetimeWeeksTarget: 100,
      imageUrl: null as string | null,
    }));
  }, [sortedFarmRows]);

  // Randomize teaser order on every page load.
  const teaserSeed = React.useMemo(
    () => Math.floor(Math.random() * 2147483647),
    [],
  );

  const farmRowsTeaser = React.useMemo(() => {
    const base =
      farmRowsAll.length > 0
        ? shuffleWithSeed(farmRowsAll, teaserSeed)
        : Array.from({ length: 6 }).map((_, index) => ({
            key: `farm-placeholder-teaser-${index}`,
            farmId: null as string | null,
            name: "—",
            region: "—",
            panels: 0,
            lifetimeLq: null as number | null,
            ccLifetime: 0,
            ccPerWeek: 0,
            projectedLifetimeCredits: null as number | null,
            creditType: "Carbon Credits",
            lifetimeWeeksElapsed: null as number | null,
            lifetimeWeeksTarget: 100,
            imageUrl: null as string | null,
            recencyKey: 0,
          }));
    return base.slice(0, 6);
  }, [farmRowsAll, teaserSeed]);

  const farmRowsToRender = showAllFarms ? farmRowsForRender : farmRowsTeaser;

  const circulatingSupplyForSupplyCard = React.useMemo(() => {
    if (!hasLiveSupply) return currentCirculating;
    // Circulating supply is the canonical value from `getGlowMarketCap`.
    // It now excludes PoL GLW inside protocol-owned positions, so it should
    // match the top banner circulating number.
    return currentCirculating;
  }, [hasLiveSupply, currentCirculating]);

  const circulationPercent = hasLiveSupply
    ? Math.min(100, (circulatingSupplyForSupplyCard / supplyTotal) * 100)
    : 0;
  const vaultedWidth =
    hasLiveSupply && vaultedGlw !== null && vaultedGlw > 0
      ? (vaultedGlw / supplyTotal) * 100
      : 0;

  const liquidityWidth =
    hasLiveSupply && polGlwInPol !== null && polGlwInPol > 0
      ? (polGlwInPol / supplyTotal) * 100
      : 0;

  const polLiquidityRange = React.useMemo(() => {
    const currentWeek = getCurrentWeekNumber(Date.now());
    const weeks = Math.max(1, currentWeek - POL_LIQUIDITY_V2_START_WEEK + 1);
    return `${weeks}w`;
  }, []);
  const { data: polLiquiditySeries } = usePolLiquidity({
    range: polLiquidityRange,
  });

  const supplyGrowthTrailing = React.useMemo(() => {
    if (!hasLiveSupply) return null;
    const series = glowCirculatingSnapshot?.series ?? null;
    if (!series || series.length === 0) return null;

    const byWeek = activelyDelegatedByWeekData?.byWeek ?? null;
    if (!byWeek) return null;

    // For a trailing 3-month KPI, use strictly completed weeks so the number doesn't
    // drift mid-week.
    const endRow = series.find((r) => r.week === supplyGrowthEndWeek) ?? null;
    if (!endRow) return null;

    const endWeek = supplyGrowthEndWeek;
    const startWeek = Math.max(97, endWeek - 13); // 13 elapsed weeks

    const startRow = series.find((r) => r.week === startWeek) ?? null;
    if (!startRow) return null;
    const elapsedWeeks = Math.max(0, endWeek - startWeek);
    const vetoUnchanged =
      startRow.breakdown.veto_council_wei === endRow.breakdown.veto_council_wei;
    const syntheticVetoAccrualGlw = vetoUnchanged
      ? VETO_COUNCIL_INFLATION_PER_WEEK_GLW * elapsedWeeks
      : 0;

    const vaultedStartWei = byWeek[startWeek];
    if (vaultedStartWei === undefined) return null;

    const vaultedEndWei = byWeek[endWeek];
    if (vaultedEndWei === undefined) return null;

    let onchainStart: number;
    let onchainEnd: number;
    let vaultedStart: number;
    let vaultedEnd: number;
    let totalSupplyStart: number;
    let totalSupplyEnd: number;
    try {
      onchainStart = Number(formatUnits(BigInt(startRow.circulating_wei), 18));
      onchainEnd = Number(formatUnits(BigInt(endRow.circulating_wei), 18));
      vaultedStart = Number(formatUnits(BigInt(vaultedStartWei), 18));
      vaultedEnd = Number(formatUnits(BigInt(vaultedEndWei), 18));
      totalSupplyStart = Number(
        formatUnits(BigInt(startRow.breakdown.total_supply_wei), 18),
      );
      totalSupplyEnd = Number(
        formatUnits(BigInt(endRow.breakdown.total_supply_wei), 18),
      );
    } catch {
      return null;
    }
    if (
      !Number.isFinite(onchainStart) ||
      !Number.isFinite(onchainEnd) ||
      !Number.isFinite(vaultedStart) ||
      !Number.isFinite(vaultedEnd) ||
      !Number.isFinite(totalSupplyStart) ||
      !Number.isFinite(totalSupplyEnd)
    )
      return null;

    // Ponder circulating excludes the off-chain "vaulted/actively delegated" term.
    // Build a canonical weekly series point by subtracting the vaulted GLW for that week.
    const canonicalStartRaw = onchainStart - vaultedStart;
    const canonicalEnd = onchainEnd - vaultedEnd - syntheticVetoAccrualGlw;
    // Normalize miner inflation in-window to exactly 175k/week by assigning any
    // observed mint residual to the starting baseline (carryover from prior weeks).
    const observedTotalSupplyDelta = totalSupplyEnd - totalSupplyStart;
    const expectedMinerInflationDelta =
      MINER_INFLATION_PER_WEEK_GLW * elapsedWeeks;
    const mintResidualCarryover =
      observedTotalSupplyDelta - expectedMinerInflationDelta;
    const canonicalStart = canonicalStartRaw + mintResidualCarryover;
    if (
      !Number.isFinite(canonicalStart) ||
      !Number.isFinite(canonicalEnd) ||
      canonicalStart <= 0 ||
      canonicalEnd <= 0
    )
      return null;

    const ratio = canonicalEnd / canonicalStart;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;

    const trailing = ratio - 1;
    return Number.isFinite(trailing) ? trailing : null;
  }, [
    activelyDelegatedByWeekData,
    glowCirculatingSnapshot,
    hasLiveSupply,
    supplyGrowthEndWeek,
  ]);

  const supplyGrowthAnnual = React.useMemo(() => {
    if (supplyGrowthTrailing === null) return null;
    const ratio = 1 + supplyGrowthTrailing;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const annualized = Math.pow(ratio, 52 / 13) - 1;
    return Number.isFinite(annualized) ? annualized : null;
  }, [supplyGrowthTrailing]);

  const supplyGrowthAnnualDisplay =
    supplyGrowthAnnual !== null ? formatPercent(supplyGrowthAnnual * 100) : "—";

  const polGrowthMoM = React.useMemo(() => {
    const series = polLiquiditySnapshot?.series ?? null;
    if (!series || series.length < 5) return null;

    const sorted = [...series].sort((a, b) => a.week - b.week);

    // Parse L[t] = end-of-week pol_lq level for each week.
    const levels: number[] = [];
    for (const row of sorted) {
      const lq = parseLqUnits(row.pol_lq ?? null);
      if (lq !== null && Number.isFinite(lq)) levels.push(lq);
    }
    if (levels.length < 5) return null;

    // Step 1: MoM[t] = (L[t] - L[t-4]) / L[t-4] for each t >= 4.
    let sum = 0;
    let observations = 0;
    for (let t = 4; t < levels.length; t++) {
      const base = levels[t - 4];
      if (base === 0) continue;
      const mom = (levels[t] - base) / base;
      if (!Number.isFinite(mom)) continue;
      sum += mom;
      observations++;
    }

    if (observations === 0) return null;

    // Step 2: average of all valid MoM observations.
    const avg = sum / observations;
    return Number.isFinite(avg) ? avg : null;
  }, [polLiquiditySnapshot]);

  const polGrowthMoMDisplay =
    polGrowthMoM !== null ? formatPercent(polGrowthMoM * 100) : "—";
  const polGrowthHelper =
    polGrowthMoM !== null
      ? "Avg monthly growth (4-week rolling) from PoL liquidity snapshots (Ⱡ)"
      : "Requires PoL liquidity snapshots";

  const poolUsdg = poolReserves?.usdg ?? 0;
  const poolGlw = poolReserves?.glw ?? 0;
  const hasPoolReserves = poolUsdg > 0 && poolGlw > 0;
  const poolLiquidityBreakdown = hasPoolReserves
    ? getLiquidityFromReserves(poolUsdg, poolGlw)
    : { liquidity: 0, value: "—", breakdown: "—" };
  const poolDepthDisplay = poolLiquidityBreakdown.value;
  const poolDepthHelper = hasPoolReserves
    ? `(${poolLiquidityBreakdown.breakdown})`
    : p.liveUnavailable;

  // What % of the market cap can be exited through PoL?
  // Model: dump the full circulating supply into the PoL constant-product invariant.
  // x=USDG, y=GLW, k=x*y. Add S to y, solve x' = k/(y+S), dollars out = x - x'.
  const polExitabilityPct = React.useMemo(() => {
    if (!hasLiveMarketCap || currentMarketCap <= 0) return null;
    if (!hasLiveSupply || currentCirculating <= 0) return null;

    const usdgMicroRaw = polSummary?.total?.breakdown?.usdg ?? null;
    const glwWeiRaw = polSummary?.total?.breakdown?.glw ?? null;
    if (usdgMicroRaw === null || glwWeiRaw === null) return null;

    const x = Number(formatUnits(BigInt(usdgMicroRaw), 6));
    const y = Number(formatUnits(BigInt(glwWeiRaw), 18));
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0)
      return null;

    const k = x * y;
    if (!Number.isFinite(k) || k <= 0) return null;

    const yAfter = y + currentCirculating;
    if (!Number.isFinite(yAfter) || yAfter <= 0) return null;

    const xAfter = k / yAfter;
    const usdOut = Math.max(0, Math.min(x, x - xAfter));
    const ratio = usdOut / currentMarketCap;
    if (!Number.isFinite(ratio) || ratio < 0) return null;
    return Math.min(1, ratio) * 100;
  }, [
    currentCirculating,
    currentMarketCap,
    hasLiveMarketCap,
    hasLiveSupply,
    polSummary,
  ]);

  const polExitabilityDisplay =
    polExitabilityPct !== null ? formatPercent(polExitabilityPct) : "—";

  const totalPolBreakdown = React.useMemo(() => {
    if (!polSummary || !displayPrice || displayPrice <= 0) return null;
    const usdMicroRaw = polSummary?.total?.usd ?? null;
    const usdgMicroRaw = polSummary?.total?.breakdown?.usdg ?? null;
    const glwWeiRaw = polSummary?.total?.breakdown?.glw ?? null;
    if (usdMicroRaw === null || usdgMicroRaw === null || glwWeiRaw === null)
      return null;

    const usd = Number(formatUnits(BigInt(usdMicroRaw), 6));
    const usdg = Number(formatUnits(BigInt(usdgMicroRaw), 6));
    const glw = Number(formatUnits(BigInt(glwWeiRaw), 18));
    const lq = totalPolLq ?? null;
    return {
      lq,
      usd,
      breakdown: `$${formatCompactNumber(usdg)} / ${formatCompactNumber(
        glw,
      )} GLW`,
    };
  }, [polSummary, displayPrice, totalPolLq]);

  const fdvUsd = React.useMemo(() => {
    if (!hasLivePrice) return null;
    const effectiveSupply = FDV_TOTAL_TOKENS_GLW - (polGlwInPol ?? 0);
    return effectiveSupply * currentPrice;
  }, [hasLivePrice, currentPrice, polGlwInPol]);

  const polLiquidityTrend = React.useMemo(() => {
    const series = polLiquiditySeries?.series;
    if (!series || series.length < 2) return null;
    const sorted = series.slice().sort((a, b) => a.weekNumber - b.weekNumber);
    const completed = sorted.length > 1 ? sorted.slice(0, -1) : sorted;
    const windowed = completed.filter(
      (row) => row.weekNumber >= POL_LIQUIDITY_V2_START_WEEK,
    );
    if (windowed.length < 2) return null;

    return windowed.map((row) => {
      const liquidity = parseLqUnits(row.totalLq) ?? 0;
      const endowmentLiquidity = parseLqUnits(row.endowmentLq) ?? 0;
      const botActiveLiquidity = parseLqUnits(row.botActiveLq) ?? 0;
      const weekEndMs =
        row.asOfTimestamp && Number.isFinite(row.asOfTimestamp)
          ? row.asOfTimestamp * 1000
          : getWeekEndMs(row.weekNumber);
      const weekStartMs = Math.max(0, weekEndMs - SECONDS_PER_WEEK * 1000);
      const epochEndMs = getWeekEndMs(row.weekNumber);

      return {
        week: formatDateAxisUtc(new Date(epochEndMs - 1)),
        weekStartMs,
        weekEndMs,
        liquidity,
        endowmentLiquidity,
        botActiveLiquidity,
      };
    });
  }, [polLiquiditySeries]);
  const polLiquidityChartData = polLiquidityTrend ?? [];
  const polLiquidityIsLive = Boolean(polLiquidityTrend);
  const regionsTableRows = React.useMemo(() => {
    const rows = polRevenueRegions?.regions ?? [];
    const summaryRegions = activeRegionsSummary?.regions ?? [];
    const parseMetricNumber = (value: unknown) => {
      if (value === null || value === undefined) return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const parsed = rows.map((r, idx) => {
      const stakedGctl = (() => {
        const raw = (r as any).staked_gctl ?? (r as any).gctl_staked ?? null;
        if (raw === null || raw === undefined) return null;
        try {
          // GCTL is 6 decimals (atomic USDC6-style).
          return Number(formatUnits(BigInt(raw), 6));
        } catch {
          if (typeof raw === "string" && raw.includes(".")) {
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
          }
          const n = Number(raw);
          return Number.isFinite(n) ? n / 1e6 : null;
        }
      })();
      const regionName =
        resolveRegionName((r as any).zone_id ?? null) ??
        (r as any).region ??
        `Region ${idx + 1}`;

      // Enrich with activeRegionsSummary data for PDs
      const summaryMatch = summaryRegions.find((s) => s.name === regionName);
      const totalPds =
        parseMetricNumber((r as any).total_pds) ??
        parseMetricNumber((r as any).totalPds) ??
        parseMetricNumber((r as any).pd_total) ??
        parseMetricNumber((r as any).total_pd_count) ??
        (summaryMatch && summaryMatch.totalProtocolDepositsUsd > 0
          ? summaryMatch.totalProtocolDepositsUsd
          : null);

      return {
        region: regionName,
        lifetimeLq: resolveDisplayLifetimeLq(r),
        ninetyDayLq: parseLqUnits(r.ninety_day_lq ?? null),
        farms:
          (r as any).farm_count ??
          (r as any).farms ??
          summaryMatch?.solarFarmCount ??
          0,
        ccPerWeek:
          (r as any).cc_per_week !== null &&
          (r as any).cc_per_week !== undefined
            ? Number((r as any).cc_per_week)
            : null,
        glwPerWeek:
          parseMetricNumber((r as any).glw_per_week) ??
          parseMetricNumber((r as any).weekly_glw) ??
          parseMetricNumber((r as any).glwWeek) ??
          (summaryMatch && summaryMatch.glwPerWeek > 0
            ? summaryMatch.glwPerWeek
            : null),
        stakedGctl:
          stakedGctl ??
          (summaryMatch && summaryMatch.stakedGctl > 0
            ? summaryMatch.stakedGctl
            : null),
        totalPds,
      };
    });
    const totalStakedAcrossRegions = parsed.reduce(
      (sum, row) => sum + (row.stakedGctl ?? 0),
      0,
    );
    return parsed.map((row) => ({
      ...row,
      shareOfTotal:
        totalStakedAcrossRegions > 0 && row.stakedGctl !== null
          ? (row.stakedGctl / totalStakedAcrossRegions) * 100
          : null,
      gctlPerPd:
        row.stakedGctl !== null && row.totalPds !== null && row.totalPds > 0
          ? row.stakedGctl / row.totalPds
          : null,
    }));
  }, [polRevenueRegions, resolveRegionName, activeRegionsSummary]);

  const regionsRowsForRender = React.useMemo(() => {
    if (regionsTableRows.length > 0) return regionsTableRows;
    return Array.from({ length: 5 }).map((_, index) => ({
      region: `—${index ? ` ${index + 1}` : ""}`,
      lifetimeLq: null as number | null,
      ninetyDayLq: null as number | null,
      farms: 0,
      ccPerWeek: null as number | null,
      stakedGctl: null as number | null,
      glwPerWeek: null as number | null,
      totalPds: null as number | null,
      shareOfTotal: null as number | null,
      gctlPerPd: null as number | null,
    }));
  }, [regionsTableRows]);

  React.useEffect(() => {
    if (!regionsTableRows.length) {
      setSelectedRegionPrimary("");
      setSelectedRegionSecondary("");
      return;
    }
    const hasPrimary = regionsTableRows.some(
      (r) => r.region === selectedRegionPrimary,
    );
    if (!hasPrimary) {
      setSelectedRegionPrimary(regionsTableRows[0]!.region);
    }
    if (
      selectedRegionSecondary &&
      !regionsTableRows.some((r) => r.region === selectedRegionSecondary)
    ) {
      setSelectedRegionSecondary("");
    }
  }, [regionsTableRows, selectedRegionPrimary, selectedRegionSecondary]);

  const openGrowthCardsDialog = React.useCallback(
    (card: GrowthCardKey) => {
      setSelectedGrowthCard(card);
      resetModalBlog("growthCards", GROWTH_CARD_BLOG[card]);
      setIsGrowthCardsDialogOpen(true);
    },
    [resetModalBlog],
  );

  const { data: vestingSchedule } = useGlwVestingSchedule();
  const vestingSeries = vestingSchedule?.points ?? VESTING_SCHEDULE;
  const vestingCategorySeries = vestingSchedule?.categoryPoints ?? null;
  const vestingBreakdown = vestingSchedule?.breakdown ?? null;
  const growthCardsModalItems = React.useMemo(
    () => [
      {
        key: "installations" as const,
        label: p.monthlySolarConstruction,
        value:
          monthlySolarConstructionKw !== null
            ? `${formatNumber(Math.round(monthlySolarConstructionKw))} kW`
            : "—",
      },
      {
        key: "liquidityGrowth" as const,
        label: p.embeddedLiquidityGrowth3m,
        value: polTrailingPolGrowthDisplay?.lq ?? "—",
      },
      {
        key: "circulatingGrowth" as const,
        label: p.annualizedCirculatingGrowth,
        value: supplyGrowthAnnualDisplay,
      },
      {
        key: "embeddedGrowth" as const,
        label: (
          <>
            {p.embeddedLiquidityGrowthMom} (
            <span className="normal-case">{p.mom}</span>)
          </>
        ),
        value: polGrowthMoMDisplay,
      },
    ],
    [
      polGrowthMoMDisplay,
      polTrailingPolGrowthDisplay?.lq,
      supplyGrowthAnnualDisplay,
      monthlySolarConstructionKw,
      p.annualizedCirculatingGrowth,
      p.embeddedLiquidityGrowth3m,
      p.embeddedLiquidityGrowthMom,
      p.mom,
      p.monthlySolarConstruction,
    ],
  );

  const primaryRegionRow = React.useMemo(() => {
    if (!regionsTableRows.length) return null;
    return (
      regionsTableRows.find((r) => r.region === selectedRegionPrimary) ??
      regionsTableRows[0] ??
      null
    );
  }, [regionsTableRows, selectedRegionPrimary]);

  const secondaryRegionRow = React.useMemo(() => {
    if (!selectedRegionSecondary) return null;
    return (
      regionsTableRows.find((r) => r.region === selectedRegionSecondary) ?? null
    );
  }, [regionsTableRows, selectedRegionSecondary]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-8">
        <div className="flex flex-col gap-8">
          <OverviewSection
            marketCapDisplay={marketCapDisplay}
            priceDisplay={priceDisplay}
            totalPolLq={totalPolLq}
            totalPolBreakdown={totalPolBreakdown}
            monthlySolarConstructionKw={monthlySolarConstructionKw}
            polTrailingPolGrowthDisplay={polTrailingPolGrowthDisplay}
            liquidityUnitValueDisplay={liquidityUnitValueDisplay}
            supplyGrowthAnnualDisplay={supplyGrowthAnnualDisplay}
            polGrowthMoMDisplay={polGrowthMoMDisplay}
            hasLiveSupply={hasLiveSupply}
            circulatingSupplyForSupplyCard={circulatingSupplyForSupplyCard}
            vaultedGlw={vaultedGlw}
            polGlwInPol={polGlwInPol}
            openGrowthCardsDialog={openGrowthCardsDialog}
            resetModalBlog={resetModalBlog}
            setIsBannerBlogOpen={setIsBannerBlogOpen}
            setIsSupplyDialogOpen={setIsSupplyDialogOpen}
          />

          <SolarFarmEconomicsSection
            showAllFarms={showAllFarms}
            farmSortKey={farmSortKey}
            setFarmSortKey={setFarmSortKey}
            setShowAllFarms={setShowAllFarms}
            farmRowsToRender={farmRowsToRender}
            displayPrice={displayPrice}
            openFarmDialog={openFarmDialog}
            prefetchFarmImage={prefetchFarmImage}
          />

          <LiquidityGctlWalletsSection
            totalPolLq={totalPolLq}
            totalPolBreakdown={totalPolBreakdown}
            polApyDisplay={polApyDisplay}
            ninetyDayApy={ninetyDayApy}
            polExitabilityDisplay={polExitabilityDisplay}
            polLiquidityIsLive={polLiquidityIsLive}
            polLiquidityChartData={polLiquidityChartData}
            isGctlLoading={isGctlLoading}
            gctlTotalSupply={gctlTotalSupply}
            gctlPriceNumber={gctlPriceNumber}
            gctlTotalStaked={gctlTotalStaked}
            gctlUnstaked={gctlUnstaked}
            gctlRegionChartConfigLive={gctlRegionChartConfigLive}
            gctlRegionPieData={gctlRegionPieData}
            isWalletStatsLoading={isWalletStatsLoading}
            walletStats={walletStats}
            hasWalletBreakdown={hasWalletBreakdown}
            isWalletGrowthMock={isWalletGrowthMock}
            walletGrowthLive={walletGrowthLive}
            resetModalBlog={resetModalBlog}
            setIsPolLiquidityDialogOpen={setIsPolLiquidityDialogOpen}
            setIsGctlDialogOpen={setIsGctlDialogOpen}
            setIsWalletStatsDialogOpen={setIsWalletStatsDialogOpen}
          />

          <DelegationRegionsAndImpactSection
            delegatedDisplay={delegatedDisplay}
            hasDelegationData={hasDelegationData}
            delegatorsDisplay={delegatorsDisplay}
            delegatorsCount={delegatorsCount}
            averageApyDisplay={averageApyDisplay}
            averageDelegatorApy={averageDelegatorApy}
            delegationTrendLive={delegationTrendLive}
            delegationTrendTicks={delegationTrendTicks}
            delegationCurrentTickValue={delegationCurrentTickValue}
            delegationRatioWidth={delegationRatioWidth}
            delegationRatioPct={delegationRatioPct}
            delegationRatioDetail={delegationRatioDetail}
            regionsRowsForRender={regionsRowsForRender}
            displayPrice={displayPrice}
            impactTotals={impactTotals}
            resetModalBlog={resetModalBlog}
            setIsDelegationDialogOpen={setIsDelegationDialogOpen}
            setIsRegionsDialogOpen={setIsRegionsDialogOpen}
            setIsNetworkImpactDialogOpen={setIsNetworkImpactDialogOpen}
          />

          {/* FMI temporarily hidden (extracted to app/internal/pol/fmi-widget.tsx). */}

          <TokenEmissionsSection
            vestingCategorySeries={vestingCategorySeries}
            vestingSeries={vestingSeries}
            vestingBreakdown={vestingBreakdown}
            fdvUsd={fdvUsd}
            hasLivePrice={hasLivePrice}
            priceDetail={priceDetail}
            polGlwInPol={polGlwInPol}
            onOpenFdvDialog={() => {
              resetModalBlog("tokenEmissions");
              setIsTokenEmissionsDialogOpen(true);
            }}
          />
        </div>
      </section>

      <Dialog
        open={isSupplyDialogOpen}
        onOpenChange={(open) => {
          setIsSupplyDialogOpen(open);
          if (!open) resetModalBlog("supply");
        }}
      >
        <DialogContent className="sm:max-w-[920px] p-0 pt-4 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{p.exploreSupplyModel}</DialogTitle>
            <DialogDescription>
              Interactive supply model for circulating and embedded liquidity.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="min-w-0">
                <MetricCard
                  label={p.circulatingSupply}
                  value={
                    liquidCirculatingModeled !== null
                      ? `${formatCompactNumberPrecise(
                          liquidCirculatingModeled,
                        )} GLW`
                      : "—"
                  }
                  valueClassName="break-words font-bold leading-tight !text-[clamp(1.2rem,5vw,1.9rem)] md:!text-[clamp(1.3rem,2.6vw,2rem)]"
                />
              </div>
              <div className="min-w-0">
                <MetricCard
                  label={p.embeddedGlw}
                  value={
                    modeledPolGlw !== null
                      ? `${formatCompactNumberPrecise(modeledPolGlw)} GLW`
                      : "—"
                  }
                  valueClassName="break-words font-bold leading-tight !text-[clamp(1.2rem,5vw,1.9rem)] md:!text-[clamp(1.3rem,2.6vw,2rem)]"
                />
              </div>
              <div className="min-w-0">
                <MetricCard
                  label={p.embeddedUsdc}
                  value={
                    modeledPolUsdg !== null
                      ? formatUsdCompactHero(modeledPolUsdg)
                      : "—"
                  }
                  valueClassName="break-words font-bold leading-tight !text-[clamp(1.2rem,5vw,1.9rem)] md:!text-[clamp(1.3rem,2.6vw,2rem)]"
                />
              </div>
            </div>

            <div>
              {(() => {
                const vaulted = vaultedGlw ?? 0;
                const polNow = polWalletGlw ?? 0;
                const pol = modeledPolGlw ?? 0;
                const deltaPol = pol - polNow;
                const circulating = hasLiveSupply
                  ? Math.max(0, currentCirculating - deltaPol)
                  : 0;
                const trackedTotal = Math.max(circulating + pol + vaulted, 1);

                const circulatingPct = (circulating / trackedTotal) * 100;
                const polPct = (pol / trackedTotal) * 100;
                const vaultedPct = (vaulted / trackedTotal) * 100;
                return (
                  <>
                    <div className="h-6 rounded-full bg-muted/50 overflow-hidden flex">
                      <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                          width: `${circulatingPct}%`,
                          background: "hsl(142, 71%, 45%)",
                        }}
                      />
                      <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                          width: `${polPct}%`,
                          background: "hsl(29, 90%, 60%)",
                        }}
                      />
                      <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                          width: `${vaultedPct}%`,
                          background: "hsl(270, 70%, 60%)",
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 mt-3 text-xs sm:grid-cols-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(142, 71%, 45%)" }}
                        />
                        <span className="text-muted-foreground">
                          {p.circulating}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(29, 90%, 60%)" }}
                        />
                        <span className="text-muted-foreground">
                          {p.embeddedGlw}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ background: "hsl(270, 70%, 60%)" }}
                        />
                        <span className="text-muted-foreground">
                          {p.vaulted}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 font-semibold">
                  {p.glwPriceLower}
                </div>
                <div className="text-lg font-semibold font-mono tabular-nums">
                  ${price.toFixed(price < 0.01 ? 4 : price < 1 ? 3 : 2)}
                </div>
              </div>
              <Slider
                min={0}
                max={100}
                step={0.1}
                value={[sliderValue]}
                onValueChange={(value) => {
                  const sv = value[0] ?? sliderValue;
                  setSliderValue(sv);
                  setPrice(logSliderToPrice(sv, supplyPriceRangeMin));
                  setHasAdjustedSlider(true);
                }}
                className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-2"
              />
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                <span>${formatSliderBoundaryPrice(supplyPriceRangeMin)}</span>
                <span>${PRICE_RANGE.max}</span>
              </div>
            </div>

            <MiniBlogPanel
              blogId={modalBlogs.supply.current}
              onSelectBlog={(blogId) => navigateModalBlog("supply", blogId)}
              onBack={() => goBackModalBlog("supply")}
              canGoBack={modalBlogs.supply.history.length > 0}
              parentBlogId={modalBlogs.supply.history.at(-1)}
            />

            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={resetSupplyModel}
                disabled={!hasAdjustedSlider}
              >
                {p.reset}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FarmDetailsDialog
        open={isFarmDialogOpen}
        onOpenChange={(open) => {
          setIsFarmDialogOpen(open);
          if (!open) {
            setSelectedFarmId(null);
            resetModalBlog("farm");
          }
        }}
        selectedFarm={selectedFarm}
        displayPrice={displayPrice}
        blogId={modalBlogs.farm.current}
        onSelectBlog={(blogId) => navigateModalBlog("farm", blogId)}
        onBackBlog={() => goBackModalBlog("farm")}
        canGoBack={modalBlogs.farm.history.length > 0}
        parentBlogId={modalBlogs.farm.history.at(-1)}
      />

      <Dialog
        open={isBannerBlogOpen}
        onOpenChange={(open) => {
          setIsBannerBlogOpen(open);
          if (!open) resetModalBlog("overview");
        }}
      >
        <DialogContent className="sm:max-w-[860px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{p.openGlowEconomy}</DialogTitle>
            <DialogDescription>
              Glow economy overview and learn-more mini blog.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <div className="absolute inset-0">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: "url('/images/pol-banner-crop.jpg')",
                }}
              />
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/30 to-black/45" />
            </div>
            <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12">
              <div className="flex justify-end">
                <Link
                  href={DEFINED_FI_GLOW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono uppercase tracking-widest text-white/80 hover:text-white"
                >
                  {p.priceHistory}
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-8">
                <div className="space-y-1.5 sm:col-span-3 sm:justify-self-center sm:text-center">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/70">
                    {p.marketCap}
                  </div>
                  <div className="text-5xl sm:text-6xl font-bold font-mono tabular-nums tracking-tight leading-none text-white">
                    {marketCapDisplay}
                  </div>
                </div>
                <div className="space-y-1.5 sm:justify-self-start sm:text-center">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/70">
                    {p.glwPrice}
                  </div>
                  <div className="text-3xl sm:text-4xl font-semibold font-mono tabular-nums tracking-tight leading-none text-white">
                    {priceDisplay}
                  </div>
                </div>
                <div className="space-y-1.5 sm:justify-self-center sm:text-center">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/70">
                    {p.embeddedLiquidity}
                  </div>
                  <div className="text-3xl sm:text-4xl font-semibold font-mono tabular-nums tracking-tight leading-none text-white">
                    {totalPolLq !== null
                      ? formatLiquidityCompact(totalPolLq)
                      : "—"}
                  </div>
                </div>
                <div className="space-y-1.5 sm:justify-self-end sm:text-center">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/70">
                    {p.liquidityUnitValue}
                  </div>
                  <div className="text-3xl sm:text-4xl font-semibold font-mono tabular-nums tracking-tight leading-none text-white">
                    {liquidityUnitValueDisplay}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <MiniBlogPanel
              blogId={modalBlogs.overview.current}
              onSelectBlog={(blogId) => navigateModalBlog("overview", blogId)}
              onBack={() => goBackModalBlog("overview")}
              canGoBack={modalBlogs.overview.history.length > 0}
              parentBlogId={modalBlogs.overview.history.at(-1)}
              className="bg-transparent border-transparent p-0"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGrowthCardsDialogOpen}
        onOpenChange={(open) => {
          setIsGrowthCardsDialogOpen(open);
          if (!open) resetModalBlog("growthCards");
        }}
      >
        <DialogContent className="sm:max-w-[920px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              {p.coreMetrics}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {p.growthDetailsDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {growthCardsModalItems.map((item) => {
                const isActive = selectedGrowthCard === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all duration-200",
                      isActive
                        ? "border-glow-orange/40 bg-glow-orange/5 ring-1 ring-glow-orange/20"
                        : "border-border/20 bg-card hover:border-border/40",
                    )}
                    onClick={() => {
                      setSelectedGrowthCard(item.key);
                      resetModalBlog("growthCards", GROWTH_CARD_BLOG[item.key]);
                    }}
                  >
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                      {item.label}
                    </div>
                    <div className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight font-mono tabular-nums">
                      {item.value}
                    </div>
                  </button>
                );
              })}
            </div>
            <MiniBlogPanel
              blogId={modalBlogs.growthCards.current}
              onSelectBlog={(blogId) =>
                navigateModalBlog("growthCards", blogId)
              }
              onBack={() => goBackModalBlog("growthCards")}
              canGoBack={modalBlogs.growthCards.history.length > 0}
              parentBlogId={modalBlogs.growthCards.history.at(-1)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPolLiquidityDialogOpen}
        onOpenChange={(open) => {
          setIsPolLiquidityDialogOpen(open);
          if (!open) resetModalBlog("polLiquidity");
        }}
      >
        <DialogContent className="sm:max-w-[1060px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{p.protocolLiquidity}</DialogTitle>
            <DialogDescription>
              Embedded liquidity and trend chart.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row">
            {/* Left: KPIs + chart */}
            <div className="sm:w-[520px] shrink-0 border-b sm:border-b-0 sm:border-r border-border/20 dark:border-border/40 p-6 flex flex-col gap-6">
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                  {p.embeddedLiquidity}
                </div>
                <div className="text-5xl font-mono font-semibold text-foreground tracking-tighter">
                  {totalPolLq !== null
                    ? formatLiquidityCompact(totalPolLq)
                    : "—"}
                </div>
                {totalPolBreakdown?.breakdown && (
                  <div className="text-xs text-muted-foreground/60 dark:text-muted-foreground/80 font-mono">
                    ({totalPolBreakdown.breakdown})
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MiniStat
                  label={p.apy}
                  value={polApyDisplay}
                  helper={
                    ninetyDayApy !== null ? undefined : p.liveUnavailable
                  }
                  valueClassName="text-2xl sm:text-3xl tracking-tight"
                />
                <MiniStat
                  label={p.marketCapExitable}
                  value={polExitabilityDisplay}
                  valueClassName="text-2xl sm:text-3xl tracking-tight"
                />
              </div>
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 flex-1 flex flex-col min-h-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-2">
                  {p.embeddedLiquidity}
                  {polLiquidityIsLive ? "" : ` · ${p.liveUnavailable}`}
                </div>
                <ChartContainer
                  config={polLiquidityChartConfig}
                  className="min-h-[160px] flex-1 w-full"
                >
                  <AreaChart data={polLiquidityChartData}>
                    <XAxis
                      dataKey="week"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <ChartTooltip content={<PolLiquidityTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="liquidity"
                      stroke="var(--color-liquidity)"
                      fill="var(--color-liquidity)"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>
            {/* Right: blog text */}
            <div className="flex-1 min-w-0 p-6">
              <MiniBlogPanel
                blogId={modalBlogs.polLiquidity.current}
                onSelectBlog={(blogId) =>
                  navigateModalBlog("polLiquidity", blogId)
                }
                onBack={() => goBackModalBlog("polLiquidity")}
                canGoBack={modalBlogs.polLiquidity.history.length > 0}
                parentBlogId={modalBlogs.polLiquidity.history.at(-1)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGctlDialogOpen}
        onOpenChange={(open) => {
          setIsGctlDialogOpen(open);
          if (!open) resetModalBlog("gctl");
        }}
      >
        <DialogContent className="sm:max-w-[1060px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>GCTL</DialogTitle>
            <DialogDescription>
              GCTL total and staking distribution.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row">
            {/* Left: KPI + chart */}
            <div className="sm:w-[520px] shrink-0 border-b sm:border-b-0 sm:border-r border-border/20 dark:border-border/40 p-6 flex flex-col gap-6">
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                  {p.totalGctl}
                </div>
                <div className="text-5xl font-mono font-semibold text-foreground tracking-tighter">
                  {isGctlLoading
                    ? "..."
                    : formatCompactNumberPrecise(gctlTotalSupply)}
                </div>
              </div>
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 flex-1 flex flex-col min-h-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-3">
                  {p.stakingByRegion}
                </div>
                <div className="flex flex-col items-center gap-4">
                  <ChartContainer
                    config={gctlRegionChartConfigLive}
                    className="h-40 w-40 shrink-0"
                  >
                    <PieChart>
                      <Pie
                        data={gctlRegionPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={32}
                        outerRadius={68}
                        strokeWidth={2}
                        stroke="var(--color-card)"
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => {
                              const region = gctlRegionPieData.find(
                                (r) => r.name === name,
                              );
                              return `${formatCompactNumberPrecise(
                                Number(value),
                              )} (${region?.pct ?? 0}%)`;
                            }}
                          />
                        }
                      />
                    </PieChart>
                  </ChartContainer>
                  <div className="w-full grid grid-cols-1 gap-y-2">
                    {gctlRegionPieData.map((region) => (
                      <div
                        key={`dialog-${region.name}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: region.fill }}
                          />
                          <span className="truncate">{region.name}</span>
                        </span>
                        <span className="font-mono tabular-nums text-foreground shrink-0">
                          {formatCompactNumberPrecise(region.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Right: blog text */}
            <div className="flex-1 min-w-0 p-6">
              <MiniBlogPanel
                blogId={modalBlogs.gctl.current}
                onSelectBlog={(blogId) => navigateModalBlog("gctl", blogId)}
                onBack={() => goBackModalBlog("gctl")}
                canGoBack={modalBlogs.gctl.history.length > 0}
                parentBlogId={modalBlogs.gctl.history.at(-1)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isWalletStatsDialogOpen}
        onOpenChange={(open) => {
          setIsWalletStatsDialogOpen(open);
          if (!open) resetModalBlog("walletStats");
        }}
      >
        <DialogContent className="sm:max-w-[1060px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{p.walletStats}</DialogTitle>
            <DialogDescription>
              Protocol participants and new wallet growth.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row">
            {/* Left: KPI + chart */}
            <div className="sm:w-[520px] shrink-0 border-b sm:border-b-0 sm:border-r border-border/20 dark:border-border/40 p-6 flex flex-col gap-6">
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                  {p.protocolParticipants}
                </div>
                <div className="text-5xl font-mono font-semibold text-foreground tracking-tighter">
                  {isWalletStatsLoading
                    ? "..."
                    : formatNumber(walletStats.protocolParticipants)}
                </div>
              </div>
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 flex-1 flex flex-col min-h-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-2">
                  {p.newWalletsPerWeek}
                  {isWalletGrowthMock ? ` · ${p.liveUnavailable}` : ""}
                </div>
                <ChartContainer
                  config={walletGrowthChartConfig}
                  className="min-h-44 flex-1 w-full"
                >
                  <BarChart data={walletGrowthLive ?? []} barGap={2}>
                    <XAxis
                      dataKey="week"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <ChartTooltip content={<WalletGrowthTooltip />} />
                    <Bar
                      dataKey="newWallets"
                      fill="var(--color-newWallets)"
                      radius={[3, 3, 0, 0]}
                      fillOpacity={0.7}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
            {/* Right: blog text */}
            <div className="flex-1 min-w-0 p-6">
              <MiniBlogPanel
                blogId={modalBlogs.walletStats.current}
                onSelectBlog={(blogId) =>
                  navigateModalBlog("walletStats", blogId)
                }
                onBack={() => goBackModalBlog("walletStats")}
                canGoBack={modalBlogs.walletStats.history.length > 0}
                parentBlogId={modalBlogs.walletStats.history.at(-1)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDelegationDialogOpen}
        onOpenChange={(open) => {
          setIsDelegationDialogOpen(open);
          if (!open) resetModalBlog("delegation");
        }}
      >
        <DialogContent className="sm:max-w-[1060px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{p.delegationMetrics}</DialogTitle>
            <DialogDescription>
              Delegated GLW and delegation trend.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row">
            {/* Left: KPI + chart */}
            <div className="sm:w-[520px] shrink-0 border-b sm:border-b-0 sm:border-r border-border/20 dark:border-border/40 p-6 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                    {p.glwDelegated}
                  </div>
                  <div className="text-4xl sm:text-5xl font-mono font-semibold text-foreground tracking-tighter">
                    {delegatedDisplay}
                  </div>
                  {!hasDelegationData && (
                    <div className="text-xs text-muted-foreground/60 dark:text-muted-foreground/80 font-mono">
                      {p.liveUnavailable}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                    {p.delegators}
                  </div>
                  <div className="text-4xl sm:text-5xl font-mono font-semibold text-foreground tracking-tighter">
                    {delegatorsDisplay}
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 flex-1 flex flex-col min-h-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-2">
                  {p.delegationGrowth}
                </div>
                <ChartContainer
                  config={delegationTrendChartConfig}
                  className="min-h-[120px] flex-1 w-full"
                >
                  <AreaChart data={delegationTrendLive ?? []}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="weekEndMs"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      ticks={delegationTrendTicks}
                      tickFormatter={(value) => {
                        const n = Number(value);
                        if (
                          delegationCurrentTickValue !== null &&
                          n === delegationCurrentTickValue
                        ) {
                          return p.current;
                        }
                        return formatMonthAxisUtc(new Date(n - 1));
                      }}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9 }}
                      interval={0}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={36}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => `${v}M`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label, payload) => {
                            const datum = (payload?.[0] as any)?.payload as
                              | DelegationTrendDatum
                              | undefined;
                            const weekStart = datum?.weekStartMs
                              ? new Date(datum.weekStartMs)
                              : null;
                            const weekEnd = datum?.weekEndMs
                              ? new Date(datum.weekEndMs - 1)
                              : null;

                            if (datum?.isCurrent) return p.current;

                            if (weekStart && weekEnd) {
                              return `${formatDateShortUtc(
                                weekStart,
                              )} - ${formatDateShortUtc(weekEnd)} UTC`;
                            }

                            if (typeof label === "number") {
                              return formatDateAxisUtc(
                                new Date(Number(label) - 1),
                              );
                            }
                            return String(label ?? "");
                          }}
                          formatter={(value) => {
                            const numeric =
                              typeof value === "number" ? value : Number(value);
                            const formatted = Number.isFinite(numeric)
                              ? numeric.toFixed(3)
                              : value;
                            return [`${formatted}M GLW`, p.delegated];
                          }}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="delegated"
                      stroke="var(--color-delegated)"
                      fill="var(--color-delegated)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>
            {/* Right: blog text */}
            <div className="flex-1 min-w-0 p-6">
              <MiniBlogPanel
                blogId={modalBlogs.delegation.current}
                onSelectBlog={(blogId) =>
                  navigateModalBlog("delegation", blogId)
                }
                onBack={() => goBackModalBlog("delegation")}
                canGoBack={modalBlogs.delegation.history.length > 0}
                parentBlogId={modalBlogs.delegation.history.at(-1)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRegionsDialogOpen}
        onOpenChange={(open) => {
          setIsRegionsDialogOpen(open);
          if (!open) resetModalBlog("regions");
        }}
      >
        <DialogContent className="sm:max-w-[1060px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{p.perRegionRevenue}</DialogTitle>
            <DialogDescription>
              Region comparison for weekly GLW, staked GCTL, share, PDs, and
              GCTL per PD.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row">
            {/* Left: tabs + region stats */}
            <div className="sm:w-[520px] shrink-0 border-b sm:border-b-0 sm:border-r border-border/20 dark:border-border/40 p-6 flex flex-col gap-5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {p.perRegionRevenue}
              </div>
              {/* Region tabs */}
              <div className="flex flex-wrap gap-1.5">
                {regionsTableRows.map((row) => (
                  <button
                    key={`region-tab-${row.region}`}
                    type="button"
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-mono transition-colors",
                      selectedRegionPrimary === row.region
                        ? "bg-foreground text-background"
                        : "bg-muted/30 dark:bg-muted/50 text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/70",
                    )}
                    onClick={() => setSelectedRegionPrimary(row.region)}
                  >
                    {row.region}
                  </button>
                ))}
              </div>
              {/* Active region stats */}
              {primaryRegionRow ? (
                <div className="flex-1 flex flex-col gap-5 min-h-0">
                  <div className="text-2xl font-semibold tracking-tight">
                    {primaryRegionRow.region}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat
                      label="GLW / Week"
                      value={
                        primaryRegionRow.glwPerWeek !== null
                          ? formatCompactNumberPrecise(
                              primaryRegionRow.glwPerWeek,
                            )
                          : primaryRegionRow.ccPerWeek !== null
                            ? formatCompactNumberPrecise(
                                primaryRegionRow.ccPerWeek,
                              )
                            : "—"
                      }
                      valueClassName="text-lg sm:text-xl tracking-tight"
                    />
                    <MiniStat
                      label={`${p.staked} GCTL`}
                      value={
                        primaryRegionRow.stakedGctl !== null
                          ? formatCompactNumberPrecise(
                              primaryRegionRow.stakedGctl,
                            )
                          : "—"
                      }
                      valueClassName="text-lg sm:text-xl tracking-tight"
                    />
                    <MiniStat
                      label={p.shareOfTotal}
                      value={
                        primaryRegionRow.shareOfTotal !== null
                          ? `${primaryRegionRow.shareOfTotal.toFixed(1)}%`
                          : "—"
                      }
                      valueClassName="text-lg sm:text-xl tracking-tight"
                    />
                    <MiniStat
                      label={p.totalPds}
                      value={
                        primaryRegionRow.totalPds !== null
                          ? `$${formatCompactNumberPrecise(
                              primaryRegionRow.totalPds,
                            )}`
                          : "—"
                      }
                      valueClassName="text-lg sm:text-xl tracking-tight"
                    />
                    <MiniStat
                      label="GCTL / PD"
                      value={
                        primaryRegionRow.gctlPerPd !== null
                          ? formatCompactNumberTwoDecimals(
                              primaryRegionRow.gctlPerPd * 1000,
                            )
                          : "—"
                      }
                      valueClassName="text-lg sm:text-xl tracking-tight"
                    />
                    <MiniStat
                      label={p.farms}
                      value={
                        primaryRegionRow.farms > 0
                          ? String(primaryRegionRow.farms)
                          : "—"
                      }
                      valueClassName="text-lg sm:text-xl tracking-tight"
                    />
                  </div>
                  {/* Revenue breakdown */}
                  <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-6 flex-1 flex flex-col justify-center">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-4">
                      Revenue contribution
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          {p.lifetime}
                        </div>
                        <div className="mt-2 text-4xl sm:text-5xl font-mono font-semibold tabular-nums text-foreground tracking-tighter">
                          {primaryRegionRow.lifetimeLq !== null
                            ? formatLiquidityCompact(
                                primaryRegionRow.lifetimeLq,
                              )
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                          Last 90 days
                        </div>
                        <div className="mt-2 text-4xl sm:text-5xl font-mono font-semibold tabular-nums text-foreground tracking-tighter">
                          {primaryRegionRow.ninetyDayLq !== null
                            ? formatLiquidityCompact(
                                primaryRegionRow.ninetyDayLq,
                              )
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-6">
                  {p.noRegionData}
                </div>
              )}
            </div>
            {/* Right: blog text */}
            <div className="flex-1 min-w-0 p-6">
              <MiniBlogPanel
                blogId={modalBlogs.regions.current}
                onSelectBlog={(blogId) => navigateModalBlog("regions", blogId)}
                onBack={() => goBackModalBlog("regions")}
                canGoBack={modalBlogs.regions.history.length > 0}
                parentBlogId={modalBlogs.regions.history.at(-1)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isNetworkImpactDialogOpen}
        onOpenChange={(open) => {
          setIsNetworkImpactDialogOpen(open);
          if (!open) resetModalBlog("networkImpact");
        }}
      >
        <DialogContent className="sm:max-w-[760px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40">
          <div className="border-b border-border/20 dark:border-border/40 pb-6 pt-8 px-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <DialogHeader className="p-0">
                <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                  {p.networkImpact}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {p.networkImpactDesc}
                </DialogDescription>
              </DialogHeader>
              <div className="text-6xl font-mono font-semibold text-foreground tracking-tighter">
                {impactTotals?.homesPowered != null
                  ? formatNumber(impactTotals.homesPowered)
                  : "—"}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider mt-2">
                {p.homesPoweredByCleanEnergy}
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="min-w-0 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-3 sm:p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                  {p.totalPanels}
                </div>
                <div className="mt-2 text-xl sm:text-3xl font-semibold font-mono tabular-nums">
                  {impactTotals?.panels != null
                    ? formatNumber(impactTotals.panels)
                    : "—"}
                </div>
              </div>
              <div className="min-w-0 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-3 sm:p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                  {p.installedCapacity}
                </div>
                <div className="mt-2 text-xl sm:text-3xl font-semibold font-mono tabular-nums">
                  {impactTotals?.capacityMw != null
                    ? `${impactTotals.capacityMw.toFixed(1)}`
                    : "—"}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider mt-1">
                  MW
                </div>
              </div>
              <div className="min-w-0 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-3 sm:p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                  {p.treesEquivalent}
                </div>
                <div className="mt-2 text-xl sm:text-3xl font-semibold font-mono tabular-nums">
                  {impactTotals?.trees != null
                    ? formatCompactNumberPrecise(impactTotals.trees)
                    : "—"}
                </div>
              </div>
            </div>
            <MiniBlogPanel
              blogId={modalBlogs.networkImpact.current}
              onSelectBlog={(blogId) =>
                navigateModalBlog("networkImpact", blogId)
              }
              onBack={() => goBackModalBlog("networkImpact")}
              canGoBack={modalBlogs.networkImpact.history.length > 0}
              parentBlogId={modalBlogs.networkImpact.history.at(-1)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTokenEmissionsDialogOpen}
        onOpenChange={(open) => {
          setIsTokenEmissionsDialogOpen(open);
          if (!open) resetModalBlog("tokenEmissions");
        }}
      >
        <DialogContent className="sm:max-w-[760px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-[24px] bg-card border border-border/40">
          <div className="border-b border-border/20 dark:border-border/40 pb-6 pt-8 px-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <DialogHeader className="p-0">
                <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                  Fully Diluted Valuation
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Token FDV excluding embedded liquidity GLW.
                </DialogDescription>
              </DialogHeader>
              <div className="text-6xl font-mono font-semibold text-foreground tracking-tighter">
                {fdvUsd !== null ? formatUsdCompactPrecise(fdvUsd) : "—"}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider mt-2">
                {fdvUsd !== null && hasLivePrice
                  ? `${formatCompactNumberPrecise(
                      FDV_TOTAL_TOKENS_GLW - (polGlwInPol ?? 0),
                    )} GLW ${p.fdvHelperAt} $${priceDetail}`
                  : p.liveUnavailable}
              </div>
            </div>
          </div>
          <div className="p-6">
            <MiniBlogPanel
              blogId={modalBlogs.tokenEmissions.current}
              onSelectBlog={(blogId) =>
                navigateModalBlog("tokenEmissions", blogId)
              }
              onBack={() => goBackModalBlog("tokenEmissions")}
              canGoBack={modalBlogs.tokenEmissions.history.length > 0}
              parentBlogId={modalBlogs.tokenEmissions.history.at(-1)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
