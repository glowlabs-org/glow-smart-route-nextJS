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

const zh: HeaderStrings = {
  sections: {
    app: "应用",
    impact: "影响力",
    resources: "资源",
    audits: "审计",
    data: "数据",
  },

  openMenu: "打开菜单",
  closeMenu: "关闭菜单",
  navigationMenuTitle: "导航菜单",
  navigationMenuDescription: "主导航菜单,可访问网站的各个板块。",

  home: { title: "首页", description: "返回仪表板" },
  swap: {
    title: "兑换",
    description: "无需离开应用即可购买或兑换代币",
  },
  leaderboard: {
    title: "Glow 排行榜",
    description: "查看顶级钱包及奖励排行榜",
  },
  protocolStats: {
    title: "协议数据",
    description: "实时协议指标与市场数据",
  },
  ambassadorDashboard: {
    title: "大使仪表板",
    description: "佣金追踪与业绩表现",
  },

  infrastructureProjects: {
    title: "基础设施项目",
    description: "查看基础设施项目列表",
  },

  blog: { title: "博客", description: "最新资讯与深度洞察" },
  press: { title: "新闻", description: "新闻稿与媒体报道" },
  branding: { title: "品牌资源", description: "品牌素材与使用规范" },

  solarFarmsMap: {
    title: "太阳能电站地图",
    description: "太阳能电站地图",
  },
  solarFarmsList: {
    title: "太阳能电站列表",
    description: "太阳能电站列表",
  },
  gves: {
    title: "GVE",
    description: "Glow 验证机构",
  },

  archives: {
    title: "档案",
    description: "查阅历史数据与记录",
  },
  weeklyReports: {
    title: "周报",
    description: "查看每周详细业绩报告",
  },
  rewards: {
    title: "奖励",
    description: "查看电站奖励",
  },
};

export const headerTranslations: Record<Lang, HeaderStrings> = {
  en,
  ko,
  zh,
};
