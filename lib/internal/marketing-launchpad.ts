export interface MarketingLaunchpadActiveFraction {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  expirationAt: string | null;
  isCommittedOnChain: boolean;
  isFilled: boolean;
  sponsorSplitPercent: number;
  totalSteps: number;
  splitsSold: number;
  remainingSteps: number;
  step: string | null;
  stepPrice: string | null;
  sgctlStepAtomic: string | null;
  currentStepUsd6: string | null;
  sgctlVisibleAt: string;
  sgctlEndsAt: string;
  glwVisibleAt: string;
}

export interface MarketingLaunchpadApplication {
  id: string;
  farmId: string | null;
  farmName: string | null;
  zone: { id: number; name: string | null } | null;
  finalProtocolFee: string | null;
  auditFields: { netCarbonCreditEarningWeekly: number | null };
  applicationPriceQuotes: Array<{
    prices: Record<string, string>;
    createdAt: string;
  }>;
  afterInstallPictures: Array<{ id: number; name: string; url: string }>;
  activeFraction: MarketingLaunchpadActiveFraction;
  sponsorSplitPercent: number;
}

export interface MarketingMinerApplication {
  id: string;
  farmId: string | null;
  farmName: string | null;
  zone: { id: number; name: string | null } | null;
  afterInstallPictures: Array<{ id: number; name: string; url: string }>;
  foundationGlowSplitPercent: number;
}
