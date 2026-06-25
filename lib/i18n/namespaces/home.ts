import type { Lang } from "../config";

export interface HomeStrings {
  // Section headers
  sections: {
    launchpadOpeningSoon: string;
    launchpadLive: string;
    overview: string;
    readOnlyDashboard: (displayName: string) => string;
    miningAndRewards: string;
    growYourImpact: string;
    myImpact: string;
    yourJourney: string;
    myFarms: string;
    getStarted: string;
    communityAndLeaderboard: string;
    protocolMetrics: string;
    education: string;
    stayConnected: string;
    networkSolarFootprint: string;
    liveSolarFarms: string;
  };

  // Deferred analytics placeholders (shown briefly during launchpad traffic)
  deferred: {
    impactScore: { title: string; description: string };
    glowWorth: { title: string; description: string };
    rewards: { title: string; description: string };
    weeklyStreak: { title: string; description: string };
    miningSummary: { title: string; description: string };
  };

  // Connecting skeleton
  connecting: {
    kicker: string;
    title: string;
    description: string;
  };

  // Toasts
  toasts: {
    migrationTitle: string;
    migrationDescription: (amount: string) => string;
    migrationAction: string;
    refundsTitle: string;
    refundsDescription: (listings: number, amountGlw: string) => string;
    refundsAction: string;
  };

  // Points balance + shop CTA inside the top launchpad widget
  topPoints: {
    label: string;
    unit: string;
    shopCta: string;
  };
}

const en: HomeStrings = {
  sections: {
    launchpadOpeningSoon: "Launchpad Opening Soon",
    launchpadLive: "Launchpad Live",
    overview: "Overview",
    readOnlyDashboard: (displayName) => `${displayName}'s Dashboard`,
    miningAndRewards: "Mining & Rewards",
    growYourImpact: "Grow Your Impact",
    myImpact: "My Impact",
    yourJourney: "Your Journey",
    myFarms: "My Farms",
    getStarted: "Get Started",
    communityAndLeaderboard: "Community & Leaderboard",
    protocolMetrics: "Protocol Metrics",
    education: "Education",
    stayConnected: "Stay Connected",
    networkSolarFootprint: "Network Solar Footprint",
    liveSolarFarms: "Live Solar Farms",
  },

  deferred: {
    impactScore: {
      title: "Points",
      description:
        "Impact analytics load a few seconds after launch traffic settles.",
    },
    glowWorth: {
      title: "Glow Worth",
      description:
        "Wallet worth and chart history load after the launchpad shell is stable.",
    },
    rewards: {
      title: "Rewards",
      description:
        "Claims and reward analytics are staggered during launch windows.",
    },
    weeklyStreak: {
      title: "Weekly Streak",
      description:
        "Streak and multiplier analytics load after launch traffic subsides.",
    },
    miningSummary: {
      title: "Mining Summary",
      description:
        "Portfolio rollups are queued behind launchpad traffic during live windows.",
    },
  },

  connecting: {
    kicker: "Wallet Handshake",
    title: "Connecting your wallet",
    description:
      "Approve or reject the request in your wallet extension to continue",
  },

  toasts: {
    migrationTitle: "GCTL allocation available",
    migrationDescription: (amount) => `${amount} GCTL available to claim`,
    migrationAction: "Claim GCTL",
    refundsTitle: "You have refunds available",
    refundsDescription: (listings, amountGlw) =>
      `${listings} listings · ${amountGlw} GLW`,
    refundsAction: "Claim refunds",
  },

  topPoints: {
    label: "Your points",
    unit: "pts",
    shopCta: "Points Shop",
  },
};

const ko: HomeStrings = {
  sections: {
    launchpadOpeningSoon: "런치패드 오픈 임박",
    launchpadLive: "런치패드 진행 중",
    overview: "개요",
    readOnlyDashboard: (displayName) => `${displayName}님의 대시보드`,
    miningAndRewards: "마이닝 및 리워드",
    growYourImpact: "임팩트 확장하기",
    myImpact: "내 임팩트",
    yourJourney: "나의 여정",
    myFarms: "내 발전소",
    getStarted: "시작하기",
    communityAndLeaderboard: "커뮤니티 및 리더보드",
    protocolMetrics: "프로토콜 지표",
    education: "학습 자료",
    stayConnected: "함께하기",
    networkSolarFootprint: "네트워크 태양광 발자국",
    liveSolarFarms: "가동 중인 태양광 발전소",
  },

  deferred: {
    impactScore: {
      title: "포인트",
      description:
        "런치패드 트래픽이 안정화된 후 임팩트 분석이 로드됩니다.",
    },
    glowWorth: {
      title: "Glow 자산",
      description:
        "런치패드 화면이 안정된 후 지갑 자산과 차트 기록이 로드됩니다.",
    },
    rewards: {
      title: "리워드",
      description:
        "런치 기간 동안 클레임과 리워드 분석은 순차적으로 제공됩니다.",
    },
    weeklyStreak: {
      title: "주간 연속 기록",
      description:
        "런치패드 트래픽이 잦아든 후 연속 기록과 배수 분석이 로드됩니다.",
    },
    miningSummary: {
      title: "마이닝 요약",
      description:
        "라이브 윈도우 중에는 포트폴리오 요약이 런치패드 트래픽 이후에 처리됩니다.",
    },
  },

  connecting: {
    kicker: "지갑 연결 중",
    title: "지갑을 연결하고 있습니다",
    description: "계속하려면 지갑 확장 프로그램에서 요청을 승인하거나 거부해 주세요",
  },

  toasts: {
    migrationTitle: "GCTL 할당이 가능합니다",
    migrationDescription: (amount) => `${amount} GCTL을 클레임할 수 있습니다`,
    migrationAction: "GCTL 클레임",
    refundsTitle: "환불 가능한 항목이 있습니다",
    refundsDescription: (listings, amountGlw) =>
      `${listings}건 · ${amountGlw} GLW`,
    refundsAction: "환불 클레임",
  },

  topPoints: {
    label: "내 포인트",
    unit: "pts",
    shopCta: "포인트 샵",
  },
};

const zh: HomeStrings = {
  sections: {
    launchpadOpeningSoon: "Launchpad 即将开启",
    launchpadLive: "Launchpad 进行中",
    overview: "总览",
    readOnlyDashboard: (displayName) => `${displayName} 的仪表盘`,
    miningAndRewards: "挖矿与奖励",
    growYourImpact: "扩大你的影响力",
    myImpact: "我的影响力",
    yourJourney: "你的旅程",
    myFarms: "我的电站",
    getStarted: "开始使用",
    communityAndLeaderboard: "社区与排行榜",
    protocolMetrics: "协议数据",
    education: "学习中心",
    stayConnected: "保持联系",
    networkSolarFootprint: "全网太阳能足迹",
    liveSolarFarms: "运行中的太阳能电站",
  },

  deferred: {
    impactScore: {
      title: "积分",
      description:
        "影响力分析将在 Launchpad 流量平稳后几秒内加载。",
    },
    glowWorth: {
      title: "Glow 净值",
      description:
        "钱包净值与图表历史将在 Launchpad 界面稳定后加载。",
    },
    rewards: {
      title: "奖励",
      description:
        "在发布期间,领取与奖励分析将分批加载。",
    },
    weeklyStreak: {
      title: "周连续记录",
      description:
        "连续记录与倍数分析将在 Launchpad 流量回落后加载。",
    },
    miningSummary: {
      title: "挖矿概览",
      description:
        "在直播窗口期间,投资组合汇总将在 Launchpad 流量之后处理。",
    },
  },

  connecting: {
    kicker: "钱包握手中",
    title: "正在连接你的钱包",
    description:
      "请在钱包扩展中批准或拒绝该请求以继续",
  },

  toasts: {
    migrationTitle: "GCTL 配额可领取",
    migrationDescription: (amount) => `${amount} GCTL 可供领取`,
    migrationAction: "领取 GCTL",
    refundsTitle: "你有可领取的退款",
    refundsDescription: (listings, amountGlw) =>
      `${listings} 项 · ${amountGlw} GLW`,
    refundsAction: "领取退款",
  },

  topPoints: {
    label: "我的积分",
    unit: "pts",
    shopCta: "积分商店",
  },
};

export const homeTranslations: Record<Lang, HomeStrings> = { en, ko, zh };
