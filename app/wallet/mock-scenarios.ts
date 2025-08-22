export type ScenarioType =
  | "full"
  | "glow-only"
  | "usdc-only"
  | "glow-and-usdc"
  | "gctl-staker"
  | "new-user"
  | "no-activity"
  | "no-farms"
  | "impact-holder"
  | "unstaking-user";

export const scenarios = {
  full: {
    name: "Full Dashboard (All Features)",
    balances: {
      usdc: "10,234.56",
      usdg: "8,456.23",
      glow: "45,678.90",
      gctl: "1,234.00",
      gctlStaked: "5,000.00",
      gctlUnstaking: "250.00",
    },
    claimable: {
      usdg: "125.45",
      glow: "890.12",
      impactVested: "45",
    },
    impactCertificates: {
      UT: 120,
      WI: 30,
      CA: 85,
      TX: 200,
    },
    regionYields: [
      {
        region: "UT",
        yield: "245.67",
        unretiredCredits: "1,234",
        purchasePrice: "$1.23",
        userStake: "1,000",
      },
      {
        region: "WI",
        yield: "189.45",
        unretiredCredits: "987",
        purchasePrice: "$1.45",
        userStake: "500",
      },
      {
        region: "CA",
        yield: "312.89",
        unretiredCredits: "2,456",
        purchasePrice: "$0.98",
        userStake: "2,000",
      },
      {
        region: "TX",
        yield: "167.23",
        unretiredCredits: "567",
        purchasePrice: "$1.67",
        userStake: "0",
      },
      {
        region: "FL",
        yield: "298.45",
        unretiredCredits: "1,890",
        purchasePrice: "$1.12",
        userStake: "1,500",
      },
    ],
    purchasedFarms: [
      {
        farm: "Dazzling Fjord #234",
        region: "UT",
        currency: "USDC",
        split: "25%",
        weeklyGlow: "125.45",
        otherRewards: "USDG",
        otherRewardsAmount: "300.00",
      },
      {
        farm: "Sapphire Overlook #567",
        region: "WI",
        currency: "GLOW",
        split: "15%",
        weeklyGlow: "89.23",
        otherRewards: "GCTL",
        otherRewardsAmount: "100.00",
      },
      {
        farm: "Jade Hollow #890",
        region: "CA",
        currency: "USDG",
        split: "40%",
        weeklyGlow: "234.56",
        otherRewards: "GLW",
        otherRewardsAmount: "200.00",
      },
    ],
    recentActivity: [
      {
        type: "swap",
        time: "2 hours ago",
        from: "GLOW",
        to: "USDC",
        amount: "500",
        received: "412.50",
      },
      {
        type: "claim",
        time: "5 hours ago",
        token: "GLOW",
        amount: "890.12",
        region: "UT",
      },
      { type: "stake", time: "1 day ago", amount: "500", region: "CA" },
      {
        type: "send",
        time: "2 days ago",
        token: "USDC",
        to: "0x742d...5678",
        amount: "1,000",
      },
      { type: "unstake", time: "3 days ago", amount: "250", region: "WI" },
      {
        type: "impact-redemption",
        time: "4 days ago",
        region: "UT",
        amount: "50",
        received: "125 USDC",
      },
    ],
  },
  "glow-only": {
    name: "GLOW Holder Only",
    balances: {
      usdc: "0",
      usdg: "0",
      glow: "125,000.00",
      gctl: "0",
      gctlStaked: "0",
      gctlUnstaking: "0",
    },
    claimable: {
      usdg: "0",
      glow: "0",
      impactVested: "0",
    },
    impactCertificates: {},
    regionYields: [],
    purchasedFarms: [],
    recentActivity: [
      {
        type: "swap",
        time: "1 day ago",
        from: "USDC",
        to: "GLOW",
        amount: "5,000",
        received: "6,125.00",
      },
      {
        type: "swap",
        time: "3 days ago",
        from: "USDC",
        to: "GLOW",
        amount: "10,000",
        received: "12,500.00",
      },
    ],
  },
  "usdc-only": {
    name: "USDC Holder Only",
    balances: {
      usdc: "50,000.00",
      usdg: "0",
      glow: "0",
      gctl: "0",
      gctlStaked: "0",
      gctlUnstaking: "0",
    },
    claimable: {
      usdg: "0",
      glow: "0",
      impactVested: "0",
    },
    impactCertificates: {},
    regionYields: [],
    purchasedFarms: [],
    recentActivity: [
      {
        type: "send",
        time: "4 hours ago",
        token: "USDC",
        to: "0x123d...9876",
        amount: "500",
      },
    ],
  },
  "glow-and-usdc": {
    name: "GLOW & USDC Holder",
    balances: {
      usdc: "15,000.00",
      usdg: "0",
      glow: "75,000.00",
      gctl: "0",
      gctlStaked: "0",
      gctlUnstaking: "0",
    },
    claimable: {
      usdg: "0",
      glow: "250.00",
      impactVested: "0",
    },
    impactCertificates: {},
    regionYields: [],
    purchasedFarms: [],
    recentActivity: [
      {
        type: "swap",
        time: "1 hour ago",
        from: "GLOW",
        to: "USDC",
        amount: "1,000",
        received: "825.00",
      },
      {
        type: "swap",
        time: "6 hours ago",
        from: "USDC",
        to: "GLOW",
        amount: "2,000",
        received: "2,440.00",
      },
    ],
  },
  "gctl-staker": {
    name: "Active GCTL Staker",
    balances: {
      usdc: "5,000.00",
      usdg: "3,000.00",
      glow: "10,000.00",
      gctl: "500.00",
      gctlStaked: "15,000.00",
      gctlUnstaking: "1,000.00",
    },
    claimable: {
      usdg: "450.00",
      glow: "1,250.00",
      impactVested: "0",
    },
    impactCertificates: {},
    regionYields: [
      {
        region: "UT",
        yield: "245.67",
        unretiredCredits: "1,234",
        purchasePrice: "$1.23",
        userStake: "5,000",
      },
      {
        region: "WI",
        yield: "189.45",
        unretiredCredits: "987",
        purchasePrice: "$1.45",
        userStake: "3,000",
      },
      {
        region: "CA",
        yield: "312.89",
        unretiredCredits: "2,456",
        purchasePrice: "$0.98",
        userStake: "7,000",
      },
    ],
    purchasedFarms: [],
    recentActivity: [
      { type: "stake", time: "3 hours ago", amount: "2,000", region: "UT" },
      {
        type: "claim",
        time: "1 day ago",
        token: "GLOW",
        amount: "1,250.00",
        region: "UT",
      },
      { type: "unstake", time: "2 days ago", amount: "1,000", region: "WI" },
    ],
  },
  "new-user": {
    name: "New User (Empty)",
    balances: {
      usdc: "0",
      usdg: "0",
      glow: "0",
      gctl: "0",
      gctlStaked: "0",
      gctlUnstaking: "0",
    },
    claimable: {
      usdg: "0",
      glow: "0",
      impactVested: "0",
    },
    impactCertificates: {},
    regionYields: [],
    purchasedFarms: [],
    recentActivity: [],
  },
  "no-activity": {
    name: "No Recent Activity",
    balances: {
      usdc: "25,000.00",
      usdg: "10,000.00",
      glow: "50,000.00",
      gctl: "2,000.00",
      gctlStaked: "8,000.00",
      gctlUnstaking: "0",
    },
    claimable: {
      usdg: "0",
      glow: "0",
      impactVested: "0",
    },
    impactCertificates: {
      UT: 50,
      CA: 75,
    },
    regionYields: [
      {
        region: "UT",
        yield: "245.67",
        unretiredCredits: "1,234",
        purchasePrice: "$1.23",
        userStake: "4,000",
      },
      {
        region: "CA",
        yield: "312.89",
        unretiredCredits: "2,456",
        purchasePrice: "$0.98",
        userStake: "4,000",
      },
    ],
    purchasedFarms: [
      {
        farm: "Dazzling Fjord #234",
        region: "UT",
        currency: "USDC",
        split: "25%",
        weeklyGlow: "125.45",
        otherRewards: "USDG",
        otherRewardsAmount: "125.45",
      },
    ],
    recentActivity: [],
  },
  "no-farms": {
    name: "No Purchased Farms",
    balances: {
      usdc: "12,000.00",
      usdg: "6,000.00",
      glow: "30,000.00",
      gctl: "1,000.00",
      gctlStaked: "3,000.00",
      gctlUnstaking: "200.00",
    },
    claimable: {
      usdg: "75.00",
      glow: "450.00",
      impactVested: "20",
    },
    impactCertificates: {
      WI: 40,
      TX: 60,
    },
    regionYields: [
      {
        region: "WI",
        yield: "189.45",
        unretiredCredits: "987",
        purchasePrice: "$1.45",
        userStake: "1,500",
      },
      {
        region: "TX",
        yield: "167.23",
        unretiredCredits: "567",
        purchasePrice: "$1.67",
        userStake: "1,500",
      },
    ],
    purchasedFarms: [],
    recentActivity: [
      {
        type: "swap",
        time: "4 hours ago",
        from: "USDC",
        to: "GLOW",
        amount: "1,000",
        received: "1,220.00",
      },
      { type: "stake", time: "1 day ago", amount: "500", region: "WI" },
    ],
  },

  "impact-holder": {
    name: "Impact Certificate Holder",
    balances: {
      usdc: "8,000.00",
      usdg: "4,000.00",
      glow: "20,000.00",
      gctl: "0",
      gctlStaked: "0",
      gctlUnstaking: "0",
    },
    claimable: {
      usdg: "0",
      glow: "0",
      impactVested: "250",
    },
    impactCertificates: {
      UT: 500,
      WI: 250,
      CA: 750,
      TX: 400,
      FL: 300,
    },
    regionYields: [],
    purchasedFarms: [],
    recentActivity: [
      {
        type: "impact-redemption",
        time: "2 hours ago",
        region: "UT",
        amount: "100",
        received: "250 USDC",
      },
      {
        type: "impact-redemption",
        time: "1 day ago",
        region: "CA",
        amount: "50",
        received: "125 USDC",
      },
      {
        type: "impact-redemption",
        time: "3 days ago",
        region: "WI",
        amount: "75",
        received: "187.50 USDC",
      },
    ],
  },
  "unstaking-user": {
    name: "Unstaking in Progress",
    balances: {
      usdc: "6,000.00",
      usdg: "3,000.00",
      glow: "15,000.00",
      gctl: "2,000.00",
      gctlStaked: "5,000.00",
      gctlUnstaking: "3,000.00",
    },
    claimable: {
      usdg: "150.00",
      glow: "500.00",
      impactVested: "30",
    },
    impactCertificates: {
      UT: 60,
      CA: 40,
    },
    regionYields: [
      {
        region: "UT",
        yield: "245.67",
        unretiredCredits: "1,234",
        purchasePrice: "$1.23",
        userStake: "2,500",
      },
      {
        region: "CA",
        yield: "312.89",
        unretiredCredits: "2,456",
        purchasePrice: "$0.98",
        userStake: "2,500",
      },
    ],
    purchasedFarms: [
      {
        farm: "Sapphire Overlook #567",
        region: "WI",
        currency: "GLOW",
        split: "10%",
        weeklyGlow: "45.00",
        otherRewards: "GCTL",
        otherRewardsAmount: "100.00",
      },
    ],
    recentActivity: [
      { type: "unstake", time: "1 hour ago", amount: "1,000", region: "UT" },
      { type: "unstake", time: "1 day ago", amount: "1,000", region: "CA" },
      { type: "unstake", time: "3 days ago", amount: "1,000", region: "UT" },
    ],
  },
};

export function getScenarioData(scenario: ScenarioType) {
  return scenarios[scenario];
}
