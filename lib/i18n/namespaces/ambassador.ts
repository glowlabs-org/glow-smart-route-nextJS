import type { Lang } from "../config";

export interface AmbassadorStrings {
  pageTitle: string;
  subtitlePrefix: string;
  allTime: string;

  connectPrompt: string;
  accessDeniedTitle: string;
  accessDeniedPrefix: string;
  accessDeniedSuffix: string;
  signPromptPrefix: string;
  signPromptSuffix: string;
  verifyButton: string;
  signing: string;

  sales: string;
  volume: string;
  payback: string;
  rolling30dDelegated: string;
  paybackRate: string;

  delegators: (n: number) => string;
  saleAttributionHint: (direct: number, second: number) => string;
  weekRangeHint: (start: number, end: number) => string;
  baseCommissionHint: (pct: number) => string;
  delegationBonus: (pct: string) => string;
  uncertaintyBonus: (pct: string) => string;

  networkBonus: string;
  networkBonusHeadline: (pct: number) => string;
  networkBonusDescription: (date: string, weekNumber: number) => string;
  yourBase: string;
  bonus: string;
  total: string;

  minerSales: string;
  minerSalesLegend: string;
  delegated30D: string;
  delegated30DLegend: string;

  weeklyBreakdown: string;
  weekColumn: string;
  salesColumn: string;
  volumeColumn: string;
  paybackColumn: string;
  delegated30DColumn: string;
  weekLabel: (n: number) => string;
  inProgress: string;
  salesCount: (n: number) => string;
  inclBonus: (amount: string) => string;

  typeHeader: string;
  buyerHeader: string;
  farmHeader: string;
  amountHeader: string;
  paybackHeader: string;
  dateHeader: string;
  stepsCount: (n: number) => string;
  direct: string;
  secondDeg: string;

  refreshing: string;
  unableToLoad: string;
  retry: string;
  noData: string;

  walletCopied: string;
  signFailed: string;
  adminAccess: string;
  adminPasswordPrompt: string;
  adminPasswordPlaceholder: string;
  invalidPassword: string;
  continue: string;
  back: string;
  admin: string;
  selectAmbassador: string;
  selectAmbassadorPrompt: string;
  viewDashboard: string;
}

const en: AmbassadorStrings = {
  pageTitle: "Ambassador Dashboard",
  subtitlePrefix: "Commission tracking for",
  allTime: "All Time",

  connectPrompt: "Connect your ambassador wallet to see your dashboard.",
  accessDeniedTitle: "Access Denied",
  accessDeniedPrefix: "The connected wallet ",
  accessDeniedSuffix:
    " is not registered as an ambassador. Please connect with your approved wallet.",
  signPromptPrefix: "Sign a message to verify ownership of ",
  signPromptSuffix: " and access your dashboard.",
  verifyButton: "Verify Identity",
  signing: "Signing...",

  sales: "Sales",
  volume: "Volume",
  payback: "Payback",
  rolling30dDelegated: "Rolling 30D Delegated",
  paybackRate: "Payback Rate",

  delegators: (n) => `${n} delegators`,
  saleAttributionHint: (direct, second) =>
    `${direct} direct, ${second} 2nd-degree`,
  weekRangeHint: (start, end) => `Week ${start} - ${end}`,
  baseCommissionHint: (pct) => `${pct}% base commission`,
  delegationBonus: (pct) => `+${pct} delegation bonus`,
  uncertaintyBonus: (pct) => `+${pct} uncertainty bonus`,

  networkBonus: "Network Bonus",
  networkBonusHeadline: (pct) => `+${pct}% of every ambassador you recruited`,
  networkBonusDescription: (date, weekNumber) =>
    `Active since ${date} (week ${weekNumber}). Paid on top of your own commission, the ambassadors you recruited still receive their full payback.`,
  yourBase: "Your payback",
  bonus: "Bonus",
  total: "Total",

  minerSales: "Miner Sales",
  minerSalesLegend: "Miner Sales ($)",
  delegated30D: "30D Delegated (USD)",
  delegated30DLegend: "30D Delegated ($, GLW + sGCTL)",

  weeklyBreakdown: "Weekly Breakdown",
  weekColumn: "Week",
  salesColumn: "Sales",
  volumeColumn: "Volume",
  paybackColumn: "Payback",
  delegated30DColumn: "30D Delegated ($)",
  weekLabel: (n) => `Week ${n}`,
  inProgress: "In progress",
  salesCount: (n) => `${n} ${n === 1 ? "sale" : "sales"}`,
  inclBonus: (amount) => `incl ${amount} bonus`,

  typeHeader: "Type",
  buyerHeader: "Buyer",
  farmHeader: "Farm",
  amountHeader: "Amount",
  paybackHeader: "Payback",
  dateHeader: "Date",
  stepsCount: (n) => `${n} steps`,
  direct: "direct",
  secondDeg: "2nd deg",

  refreshing: "Refreshing...",
  unableToLoad: "Unable to load dashboard data.",
  retry: "Retry",
  noData: "No data found for your wallet in this period.",

  walletCopied: "Wallet address copied",
  signFailed: "Signing failed. Please try again.",
  adminAccess: "Admin Access",
  adminPasswordPrompt: "Enter the admin password to continue.",
  adminPasswordPlaceholder: "Admin password",
  invalidPassword: "Invalid password",
  continue: "Continue",
  back: "Back",
  admin: "Admin",
  selectAmbassador: "Select Ambassador",
  selectAmbassadorPrompt:
    "Choose an ambassador wallet to view their dashboard.",
  viewDashboard: "View Dashboard",
};

const ko: AmbassadorStrings = {
  pageTitle: "앰배서더 대시보드",
  subtitlePrefix: "커미션 추적:",
  allTime: "전체 기간",

  connectPrompt: "대시보드를 보려면 앰배서더 지갑을 연결해 주세요.",
  accessDeniedTitle: "접근 거부됨",
  accessDeniedPrefix: "연결된 지갑 ",
  accessDeniedSuffix:
    "은(는) 앰배서더로 등록되지 않았습니다. 승인된 지갑으로 연결해 주세요.",
  signPromptPrefix: "지갑 ",
  signPromptSuffix:
    "의 소유권을 확인하고 대시보드에 접속하려면 메시지에 서명해 주세요.",
  verifyButton: "본인 인증",
  signing: "서명 중...",

  sales: "판매",
  volume: "거래량",
  payback: "페이백",
  rolling30dDelegated: "30일 누적 위임",
  paybackRate: "페이백 비율",

  delegators: (n) => `위임자 ${n}명`,
  saleAttributionHint: (direct, second) =>
    `직접 ${direct}건, 2단계 ${second}건`,
  weekRangeHint: (start, end) => `${start}주 - ${end}주`,
  baseCommissionHint: (pct) => `기본 커미션 ${pct}%`,
  delegationBonus: (pct) => `위임 보너스 +${pct}`,
  uncertaintyBonus: (pct) => `불확실성 보너스 +${pct}`,

  networkBonus: "네트워크 보너스",
  networkBonusHeadline: (pct) => `추천하신 모든 앰배서더 페이백의 +${pct}%`,
  networkBonusDescription: (date, weekNumber) =>
    `${date}(${weekNumber}주)부터 적용됩니다. 본인의 커미션에 추가로 지급되며, 추천하신 앰배서더들도 전액 페이백을 받습니다.`,
  yourBase: "본인 페이백",
  bonus: "보너스",
  total: "총액",

  minerSales: "마이너 판매",
  minerSalesLegend: "마이너 판매 ($)",
  delegated30D: "30일 위임 (USD)",
  delegated30DLegend: "30일 위임 ($, GLW + sGCTL)",

  weeklyBreakdown: "주간 상세",
  weekColumn: "주차",
  salesColumn: "판매",
  volumeColumn: "거래량",
  paybackColumn: "페이백",
  delegated30DColumn: "30일 위임 ($)",
  weekLabel: (n) => `${n}주`,
  inProgress: "진행 중",
  salesCount: (n) => `${n}건`,
  inclBonus: (amount) => `보너스 ${amount} 포함`,

  typeHeader: "유형",
  buyerHeader: "구매자",
  farmHeader: "팜",
  amountHeader: "금액",
  paybackHeader: "페이백",
  dateHeader: "날짜",
  stepsCount: (n) => `${n} 스텝`,
  direct: "직접",
  secondDeg: "2단계",

  refreshing: "새로고침 중...",
  unableToLoad: "대시보드 데이터를 불러올 수 없습니다.",
  retry: "다시 시도",
  noData: "이 기간에는 지갑에 대한 데이터가 없습니다.",

  walletCopied: "지갑 주소가 복사되었습니다",
  signFailed: "서명에 실패했습니다. 다시 시도해 주세요.",
  adminAccess: "관리자 접근",
  adminPasswordPrompt: "계속하려면 관리자 비밀번호를 입력하세요.",
  adminPasswordPlaceholder: "관리자 비밀번호",
  invalidPassword: "비밀번호가 올바르지 않습니다",
  continue: "계속",
  back: "뒤로",
  admin: "관리자",
  selectAmbassador: "앰배서더 선택",
  selectAmbassadorPrompt: "대시보드를 볼 앰배서더 지갑을 선택하세요.",
  viewDashboard: "대시보드 보기",
};

const zh: AmbassadorStrings = {
  pageTitle: "大使仪表盘",
  subtitlePrefix: "佣金追踪：",
  allTime: "全部时间",

  connectPrompt: "请连接您的大使钱包以查看仪表盘。",
  accessDeniedTitle: "访问被拒绝",
  accessDeniedPrefix: "已连接的钱包 ",
  accessDeniedSuffix: " 尚未注册为大使。请使用已批准的钱包连接。",
  signPromptPrefix: "请签署一条消息以验证 ",
  signPromptSuffix: " 的所有权并访问您的仪表盘。",
  verifyButton: "验证身份",
  signing: "签名中...",

  sales: "销售",
  volume: "交易额",
  payback: "返佣",
  rolling30dDelegated: "近 30 日委托量",
  paybackRate: "返佣比率",

  delegators: (n) => `${n} 位委托人`,
  saleAttributionHint: (direct, second) =>
    `直接 ${direct} 笔，二级 ${second} 笔`,
  weekRangeHint: (start, end) => `第 ${start} 周 - 第 ${end} 周`,
  baseCommissionHint: (pct) => `${pct}% 基础佣金`,
  delegationBonus: (pct) => `+${pct} 委托奖励`,
  uncertaintyBonus: (pct) => `+${pct} 不确定性奖励`,

  networkBonus: "网络奖励",
  networkBonusHeadline: (pct) => `您招募的每位大使额外 +${pct}%`,
  networkBonusDescription: (date, weekNumber) =>
    `自 ${date}（第 ${weekNumber} 周）起生效。该奖励在您自身佣金之外额外发放，您招募的大使仍可获得全额返佣。`,
  yourBase: "您的返佣",
  bonus: "奖励",
  total: "合计",

  minerSales: "矿工销售",
  minerSalesLegend: "矿工销售 ($)",
  delegated30D: "30 日委托 (USD)",
  delegated30DLegend: "30 日委托 ($, GLW + sGCTL)",

  weeklyBreakdown: "每周明细",
  weekColumn: "周次",
  salesColumn: "销售",
  volumeColumn: "交易额",
  paybackColumn: "返佣",
  delegated30DColumn: "30 日委托 ($)",
  weekLabel: (n) => `第 ${n} 周`,
  inProgress: "进行中",
  salesCount: (n) => `${n} 笔`,
  inclBonus: (amount) => `含 ${amount} 奖励`,

  typeHeader: "类型",
  buyerHeader: "买方",
  farmHeader: "农场",
  amountHeader: "金额",
  paybackHeader: "返佣",
  dateHeader: "日期",
  stepsCount: (n) => `${n} 级`,
  direct: "直接",
  secondDeg: "二级",

  refreshing: "刷新中...",
  unableToLoad: "无法加载仪表盘数据。",
  retry: "重试",
  noData: "该时段内未找到您钱包的相关数据。",

  walletCopied: "钱包地址已复制",
  signFailed: "签名失败，请重试。",
  adminAccess: "管理员访问",
  adminPasswordPrompt: "请输入管理员密码以继续。",
  adminPasswordPlaceholder: "管理员密码",
  invalidPassword: "密码无效",
  continue: "继续",
  back: "返回",
  admin: "管理员",
  selectAmbassador: "选择大使",
  selectAmbassadorPrompt: "选择要查看仪表盘的大使钱包。",
  viewDashboard: "查看仪表盘",
};

export const ambassadorTranslations: Record<Lang, AmbassadorStrings> = {
  en,
  ko,
  zh,
};
