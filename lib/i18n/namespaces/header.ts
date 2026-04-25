import type { Lang } from "../config";

export interface HeaderStrings {
  // Top-level nav groups (also used as mobile drawer section headers)
  sections: {
    app: string;
    impact: string;
    resources: string;
    audits: string;
    data: string;
  };

  // Aria labels
  openMenu: string;
  closeMenu: string;
  navigationMenuTitle: string;
  navigationMenuDescription: string;

  // App section
  home: { title: string; description: string };
  swap: { title: string; description: string };
  leaderboard: { title: string; description: string };
  protocolStats: { title: string; description: string };
  ambassadorDashboard: { title: string; description: string };

  // Impact section
  infrastructureProjects: { title: string; description: string };

  // Resources section
  blog: { title: string; description: string };
  press: { title: string; description: string };
  branding: { title: string; description: string };

  // Audits section
  solarFarmsMap: { title: string; description: string };
  solarFarmsList: { title: string; description: string };
  gves: { title: string; description: string };

  // Data section
  archives: { title: string; description: string };
  weeklyReports: { title: string; description: string };
  rewards: { title: string; description: string };
}

const en: HeaderStrings = {
  sections: {
    app: "App",
    impact: "Impact",
    resources: "Resources",
    audits: "Audits",
    data: "Data",
  },

  openMenu: "Open menu",
  closeMenu: "Close menu",
  navigationMenuTitle: "Navigation Menu",
  navigationMenuDescription:
    "Main navigation menu with links to different sections of the website.",

  home: { title: "Home", description: "Back to the dashboard" },
  swap: {
    title: "Swap",
    description: "Buy or swap tokens without leaving the app",
  },
  leaderboard: {
    title: "Glow Leaderboard",
    description: "View top wallets and rewards leaderboard",
  },
  protocolStats: {
    title: "Protocol Stats",
    description: "Real-time protocol metrics and market data",
  },
  ambassadorDashboard: {
    title: "Ambassador Dashboard",
    description: "Commission tracking and performance",
  },

  infrastructureProjects: {
    title: "Infrastructure projects",
    description: "See the list of infrastructure projects",
  },

  blog: { title: "Blog", description: "Latest news and insights" },
  press: { title: "Press", description: "Press releases and media coverage" },
  branding: { title: "Branding", description: "Brand assets and guidelines" },

  solarFarmsMap: {
    title: "Solar Farms Map",
    description: "Solar Farms Map",
  },
  solarFarmsList: {
    title: "Solar Farms List",
    description: "Solar Farms List",
  },
  gves: {
    title: "GVEs",
    description: "Glow Verification Entities",
  },

  archives: {
    title: "Archives",
    description: "Access historical data and records",
  },
  weeklyReports: {
    title: "Weekly Reports",
    description: "View detailed weekly performance reports",
  },
  rewards: {
    title: "Rewards",
    description: "View Farm Rewards",
  },
};

const ko: HeaderStrings = {
  sections: {
    app: "앱",
    impact: "임팩트",
    resources: "리소스",
    audits: "감사",
    data: "데이터",
  },

  openMenu: "메뉴 열기",
  closeMenu: "메뉴 닫기",
  navigationMenuTitle: "내비게이션 메뉴",
  navigationMenuDescription:
    "웹사이트의 각 섹션으로 이동할 수 있는 메인 내비게이션 메뉴입니다.",

  home: { title: "홈", description: "대시보드로 돌아가기" },
  swap: {
    title: "스왑",
    description: "앱을 떠나지 않고 토큰을 구매하거나 교환하세요",
  },
  leaderboard: {
    title: "Glow 리더보드",
    description: "상위 지갑과 리워드 리더보드 보기",
  },
  protocolStats: {
    title: "프로토콜 통계",
    description: "실시간 프로토콜 지표와 마켓 데이터",
  },
  ambassadorDashboard: {
    title: "앰배서더 대시보드",
    description: "커미션 추적 및 실적",
  },

  infrastructureProjects: {
    title: "인프라 프로젝트",
    description: "인프라 프로젝트 목록 보기",
  },

  blog: { title: "블로그", description: "최신 소식과 인사이트" },
  press: { title: "프레스", description: "보도자료 및 언론 보도" },
  branding: { title: "브랜딩", description: "브랜드 자산과 가이드라인" },

  solarFarmsMap: {
    title: "태양광 발전소 지도",
    description: "태양광 발전소 지도",
  },
  solarFarmsList: {
    title: "태양광 발전소 목록",
    description: "태양광 발전소 목록",
  },
  gves: {
    title: "GVE",
    description: "Glow 검증 기관",
  },

  archives: {
    title: "아카이브",
    description: "과거 데이터와 기록 보기",
  },
  weeklyReports: {
    title: "주간 리포트",
    description: "주간 실적 상세 리포트 보기",
  },
  rewards: {
    title: "리워드",
    description: "발전소 리워드 보기",
  },
};

export const headerTranslations: Record<Lang, HeaderStrings> = {
  en,
  ko,
};
