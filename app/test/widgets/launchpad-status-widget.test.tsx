import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseGlowLaunchpad,
  mockUseMiningCenter,
  mockUseRewardScore,
  mockUseMiningScore,
  mockUseSgctlEligibility,
  mockUseAccount,
} = vi.hoisted(() => ({
  mockUseGlowLaunchpad: vi.fn(),
  mockUseMiningCenter: vi.fn(),
  mockUseRewardScore: vi.fn(),
  mockUseMiningScore: vi.fn(),
  mockUseSgctlEligibility: vi.fn(),
  mockUseAccount: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    refetchQueries: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("a", null, children),
}));

vi.mock("wagmi", () => ({
  useAccount: mockUseAccount,
}));

vi.mock("lucide-react", () => {
  const Icon = () => null;
  return new Proxy(
    {},
    {
      get: () => Icon,
    }
  );
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  CardContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  CardHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  CardTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => null,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  TabsList: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  TabsTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", null, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", null, children),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/components/ui/fallback-image", () => ({
  FallbackImage: () => null,
}));

vi.mock("@/components/dialogs/buy-glow-dialog", () => ({
  BuyGlowDialog: () => null,
}));

vi.mock("@/app/marketplace/sponsored-farms-activity", () => ({
  SponsoredFarmsActivity: () => null,
}));

vi.mock("@/app/marketplace/launchpad-stats-dialog", () => ({
  LaunchpadStatsDialog: () => null,
}));

vi.mock("@/app/marketplace/mining-stats-dialog", () => ({
  MiningStatsDialog: () => null,
}));

vi.mock("@/app/marketplace/launchpad-view", () => ({
  LaunchpadView: () => null,
}));

vi.mock("@/components/glow-symbol", () => ({
  GlowSymbol: () => null,
}));

vi.mock("@/components/impact-icons", () => ({
  CashMinerIcon: () => null,
  DelegationIcon: () => null,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useLaunchpadStatus", () => ({
  useLaunchpadStatus: () => ({
    isLive: true,
    nextBatchAtMs: Date.now(),
    nextMinerBatchAtMs: Date.now(),
    nextDelegationBatchAtMs: Date.now(),
    refreshNextBatchAtMs: vi.fn(),
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useGlowSpotPriceSummary", () => ({
  useGlowSpotPriceSummary: () => ({
    spotPriceUsd: 0.4,
  }),
}));

vi.mock("@/hooks/useWalletTokenBalances", () => ({
  useWalletTokenBalances: () => ({
    usdcBalance: null,
  }),
}));

vi.mock("@/hooks/use-sgctl-eligibility", () => ({
  useSgctlEligibility: mockUseSgctlEligibility,
}));

vi.mock("@/app/components/animated-countdown", () => ({
  AnimatedCountdownDhms: () => null,
  useCountdownTo: () => ({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isComplete: false,
  }),
}));

vi.mock("@/hooks", () => ({
  useGlowLaunchpad: mockUseGlowLaunchpad,
  useMiningCenter: mockUseMiningCenter,
  useRewardScore: mockUseRewardScore,
  useMiningScore: mockUseMiningScore,
  getRewardScoreForApplication: vi.fn(() => null),
  getMiningScoreForApplication: vi.fn(() => null),
  isFractionOpenForMarketplace: vi.fn((fraction) => {
    const remaining = fraction?.remainingSteps ?? 0;
    return remaining > 0;
  }),
  isFractionPubliclyVisible: vi.fn(() => true),
}));

import LaunchpadStatusWidget from "@/app/test/widgets/launchpad-status-widget";

function createLaunchpadApplication(id: string) {
  return {
    id,
    zone: { id: 9, name: "Idaho" },
    userId: "0x2b57E1bF5071c6579F2145b367EEC34f8729AA9C",
    farmId: null,
    farmName: "ClearSky Vale",
    finalProtocolFee: "37777180000",
    auditFields: {
      netCarbonCreditEarningWeekly: 0.1333,
    },
    applicationPriceQuotes: [
      {
        prices: {
          GLW: "396750",
          USDC: "1000000",
        },
      },
    ],
    activeFraction: {
      id: "launchpad-fraction",
      totalSteps: 120,
      remainingSteps: 120,
      sponsorSplitPercent: 19,
      stepPrice: "793472333064062171812",
      marketplaceVisibleAt: "2026-03-24T17:00:00.000Z",
    },
  } as any;
}

function createLaunchpadApplicationWithSgctl(id: string) {
  const application = createLaunchpadApplication(id);
  application.activeFraction = {
    ...application.activeFraction,
    glw: {
      remainingSteps: 120,
    },
    sgctl: {
      unitAtomic: "1000000",
      remainingUnits: 6,
    },
  };
  return application;
}

function createMinerApplication(id: string) {
  return {
    id,
    zone: { id: 9, name: "Idaho" },
    userId: "0x2b57E1bF5071c6579F2145b367EEC34f8729AA9C",
    farmId: "dee7ba67-e284-4aba-8758-a22f55e4b888",
    farmName: "Vivid Canopy",
    activeFraction: {
      id: "miner-fraction",
      totalSteps: 57,
      remainingSteps: 9,
      sponsorSplitPercent: 71,
      stepPrice: "499000000",
      totalAmountNeeded: "28443000000",
    },
  } as any;
}

describe("LaunchpadStatusWidget", () => {
  beforeEach(() => {
    mockUseGlowLaunchpad.mockReset();
    mockUseMiningCenter.mockReset();
    mockUseRewardScore.mockReset();
    mockUseMiningScore.mockReset();
    mockUseSgctlEligibility.mockReset();
    mockUseAccount.mockReset();

    mockUseAccount.mockReturnValue({
      address: null,
      isConnected: false,
    });

    mockUseGlowLaunchpad.mockReturnValue({
      applications: [createLaunchpadApplication("launchpad-app")],
      isLoading: false,
    });
    mockUseMiningCenter.mockReturnValue({
      applications: [createMinerApplication("miner-app")],
      isLoading: false,
    });
    mockUseRewardScore.mockReturnValue({
      rewardScoreMap: new Map(),
      isLoading: false,
    });
    mockUseMiningScore.mockReturnValue({
      miningScoreMap: new Map(),
      isLoading: false,
    });
    mockUseSgctlEligibility.mockReturnValue({
      eligibilityByApplicationId: new Map(),
      isEligibilityLoading: false,
      isEligibilityFetching: false,
      isSgctlEligible: () => false,
    });
  });

  it("passes visible launchpad applications into mining score estimation", () => {
    renderToStaticMarkup(
      React.createElement(LaunchpadStatusWidget, { variant: "full-row" })
    );

    expect(mockUseMiningScore).toHaveBeenCalledWith(
      expect.objectContaining({
        applications: [expect.objectContaining({ id: "miner-app" })],
        extraLiveApplications: [
          expect.objectContaining({ id: "launchpad-app" }),
        ],
        enabled: true,
      })
    );
  });

  it("waits for connected-wallet sGCTL eligibility before rendering cards", () => {
    mockUseAccount.mockReturnValue({
      address: "0x0000000000000000000000000000000000000001",
      isConnected: true,
    });
    mockUseGlowLaunchpad.mockReturnValue({
      applications: [createLaunchpadApplicationWithSgctl("launchpad-app")],
      isLoading: false,
    });
    mockUseMiningCenter.mockReturnValue({
      applications: [],
      isLoading: false,
    });
    mockUseSgctlEligibility.mockReturnValue({
      eligibilityByApplicationId: new Map(),
      isEligibilityLoading: true,
      isEligibilityFetching: true,
      isSgctlEligible: () => false,
    });

    const html = renderToStaticMarkup(
      React.createElement(LaunchpadStatusWidget, { variant: "full-row" })
    );

    expect(html).not.toContain("ClearSky Vale");
  });

  it("shows an asset filter when the wallet can see GLW and sGCTL tiles", () => {
    mockUseAccount.mockReturnValue({
      address: "0x0000000000000000000000000000000000000001",
      isConnected: true,
    });
    mockUseGlowLaunchpad.mockReturnValue({
      applications: [createLaunchpadApplicationWithSgctl("launchpad-app")],
      isLoading: false,
    });
    mockUseMiningCenter.mockReturnValue({
      applications: [],
      isLoading: false,
    });
    mockUseSgctlEligibility.mockReturnValue({
      eligibilityByApplicationId: new Map([["launchpad-app", true]]),
      isEligibilityLoading: false,
      isEligibilityFetching: false,
      isSgctlEligible: (applicationId: string) => applicationId === "launchpad-app",
    });

    const html = renderToStaticMarkup(
      React.createElement(LaunchpadStatusWidget, { variant: "full-row" })
    );

    expect(html).toContain("All assets");
    expect(html).toContain("GLW");
    expect(html).toContain("sGCTL");
  });
});
