import type { Lang } from "../config";

/**
 * Logged-out onboarding surface: the five-step "get started" carousel
 * (app/test/widgets/onboarding-flow.tsx) and the live solar farms grid
 * (app/test/widgets/live-solar-farms-grid.tsx).
 */
export interface OnboardingStrings {
  stepper: {
    stepOf: (current: number, total: number) => string;
  };
  steps: {
    buy: string;
    delegate: string;
    earn: string;
    mine: string;
    learn: string;
  };
  buy: {
    kicker: string;
    title: string;
    body: string;
    priceLabel: string;
    priceChart: string;
    priceSource: string;
    cta: string;
  };
  delegate: {
    kicker: string;
    title: string;
    body: string;
    rewardScore: string;
    estWeekly: string;
    forWeeks: string;
    cta: string;
  };
  countdown: {
    nextWindow: string;
    opens: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    note: string;
    cta: string;
  };
  earn: {
    kicker: string;
    title: string;
    body: string;
    shopTitle: string;
    shopDesc: string;
    shopCta: string;
    leaderboardTitle: string;
    leaderboardDesc: string;
    leaderboardCta: string;
  };
  miner: {
    kicker: string;
    title: string;
    body: string;
    price: string;
    estWeekly: string;
    forWeeks: (weeks: number) => string;
    cta: string;
    emptyTitle: string;
    emptyBody: string;
  };
  learn: {
    kicker: string;
    title: string;
    body: string;
    glwPrice: string;
    glwPriceSub: string;
    marketCap: string;
    marketCapSub: string;
    delegated: string;
    delegatedSub: string;
    exploreLabel: string;
    viewAllStats: string;
    viewAllStatsSub: string;
  };
  liveFarms: {
    countLine: (count: number) => string;
    installed: string;
    offset: string;
    live: string;
    liveSince: (date: string) => string;
    showing: (shown: number, total: number) => string;
    empty: string;
  };
}

const en: OnboardingStrings = {
  stepper: {
    stepOf: (current, total) => `Step ${current} of ${total}`,
  },
  steps: {
    buy: "Buy GLW",
    delegate: "Delegate",
    earn: "Earn",
    mine: "Mine",
    learn: "Learn",
  },
  buy: {
    kicker: "The token",
    title: "Buy GLW, the fuel of the Glow economy.",
    body: "Glow runs on the GLW token, which is used to advocate for solar farms using a process called delegation.",
    priceLabel: "GLW price",
    priceChart: "Price chart",
    priceSource: "Live spot price, sourced on-chain.",
    cta: "Buy GLW",
  },
  delegate: {
    kicker: "Delegation",
    title: "Delegate GLW to Solar Farms",
    body: "Each solar farm produces a variable amount of rewards based on how competitive it is. By delegating GLW to a farm you endorse its participation in Glow, and you earn rewards (or penalties) based on how competitive that farm is.",
    rewardScore: "Reward Score",
    estWeekly: "Est. weekly",
    forWeeks: "for 100 weeks",
    cta: "Delegate GLW",
  },
  countdown: {
    nextWindow: "Next listing window",
    opens: "Opens Tue · 9AM ET",
    days: "Days",
    hours: "Hrs",
    minutes: "Min",
    seconds: "Sec",
    note: "New solar farms open for delegation every Tuesday. Hold GLW now so you’re ready the moment they go live.",
    cta: "Buy GLW to get ready",
  },
  earn: {
    kicker: "Rewards",
    title: "Earn Points, and Impact",
    body: "Delegating GLW earns you points that can be redeemed in the points shop. You also receive impact: the ‘watts’ you earn represent real-world energy production, and ‘tons of CO₂’ represent real emissions eliminated by the farm you powered up.",
    shopTitle: "Points Shop",
    shopDesc: "Redeem the points you earn for real rewards.",
    shopCta: "Open shop",
    leaderboardTitle: "Impact Leaderboard",
    leaderboardDesc: "See top wallets ranked by watts & tons of CO₂.",
    leaderboardCta: "View leaderboard",
  },
  miner: {
    kicker: "Mining",
    title: "Become a GLW Miner",
    body: "The fastest way to earn GLW is to buy it on the market. However, you can also earn GLW weekly by purchasing a miner. Each miner is connected to a single real-world solar farm, and collects some of the GLW rewards that are produced by that solar farm.",
    price: "Price",
    estWeekly: "Est. weekly",
    forWeeks: (weeks) => `for ${weeks} week${weeks === 1 ? "" : "s"}`,
    cta: "Buy miner",
    emptyTitle: "Miners are restocking",
    emptyBody: "A starter miner is always on the way — check back shortly.",
  },
  learn: {
    kicker: "Learn more",
    title: "Go deeper on the protocol",
    body: "The numbers behind Glow, and the latest from the team.",
    glwPrice: "GLW Price",
    glwPriceSub: "Current spot price",
    marketCap: "Market Cap",
    marketCapSub: "Circulating supply",
    delegated: "GLW Delegated",
    delegatedSub: "of circulating supply",
    exploreLabel: "Explore",
    viewAllStats: "View all stats",
    viewAllStatsSub: "Deep dive into protocol metrics.",
  },
  liveFarms: {
    countLine: (count) => `${count} farms live across the network`,
    installed: "installed",
    offset: "offset",
    live: "Live",
    liveSince: (date) => `Live since ${date}`,
    showing: (shown, total) => `Showing ${shown} of ${total}`,
    empty: "No live farms to show yet.",
  },
};

const ko: OnboardingStrings = {
  stepper: {
    stepOf: (current, total) => `${total}단계 중 ${current}단계`,
  },
  steps: {
    buy: "GLW 구매",
    delegate: "위임",
    earn: "획득",
    mine: "마이닝",
    learn: "알아보기",
  },
  buy: {
    kicker: "토큰",
    title: "Glow 경제의 연료, GLW를 구매하세요.",
    body: "Glow는 GLW 토큰으로 작동하며, GLW는 위임(delegation)이라는 과정을 통해 태양광 발전소를 지지하는 데 사용됩니다.",
    priceLabel: "GLW 가격",
    priceChart: "가격 차트",
    priceSource: "온체인에서 가져온 실시간 시세입니다.",
    cta: "GLW 구매",
  },
  delegate: {
    kicker: "위임",
    title: "태양광 발전소에 GLW 위임하기",
    body: "각 태양광 발전소는 경쟁력에 따라 변동하는 리워드를 생성합니다. 발전소에 GLW를 위임하면 해당 발전소의 Glow 참여를 지지하게 되며, 발전소의 경쟁력에 따라 리워드(또는 페널티)를 받게 됩니다.",
    rewardScore: "리워드 점수",
    estWeekly: "주간 예상",
    forWeeks: "100주 동안",
    cta: "GLW 위임",
  },
  countdown: {
    nextWindow: "다음 상장 시점",
    opens: "매주 화요일 오전 9시(ET) 오픈",
    days: "일",
    hours: "시간",
    minutes: "분",
    seconds: "초",
    note: "새로운 태양광 발전소는 매주 화요일에 위임용으로 공개됩니다. 지금 GLW를 보유해 두면 오픈 순간 바로 참여할 수 있습니다.",
    cta: "GLW 구매하고 준비하기",
  },
  earn: {
    kicker: "리워드",
    title: "포인트와 임팩트를 획득하세요",
    body: "GLW를 위임하면 포인트 상점에서 사용할 수 있는 포인트를 획득합니다. 또한 임팩트도 받게 됩니다. 획득한 ‘와트’는 실제 에너지 생산량을, ‘CO₂ 톤’은 당신이 가동시킨 발전소가 제거한 실제 배출량을 나타냅니다.",
    shopTitle: "포인트 상점",
    shopDesc: "획득한 포인트를 실제 보상으로 교환하세요.",
    shopCta: "상점 열기",
    leaderboardTitle: "임팩트 리더보드",
    leaderboardDesc: "와트와 CO₂ 톤 기준 상위 지갑을 확인하세요.",
    leaderboardCta: "리더보드 보기",
  },
  miner: {
    kicker: "마이닝",
    title: "GLW 마이너 되기",
    body: "GLW를 얻는 가장 빠른 방법은 시장에서 구매하는 것입니다. 하지만 마이너를 구매해 매주 GLW를 획득할 수도 있습니다. 각 마이너는 실제 태양광 발전소 하나에 연결되어 그 발전소가 생산하는 GLW 리워드의 일부를 수집합니다.",
    price: "가격",
    estWeekly: "주간 예상",
    forWeeks: (weeks) => `${weeks}주 동안`,
    cta: "마이너 구매",
    emptyTitle: "마이너 재입고 중",
    emptyBody: "스타터 마이너는 곧 다시 입고됩니다 — 잠시 후 확인해 주세요.",
  },
  learn: {
    kicker: "더 알아보기",
    title: "프로토콜 더 깊이 살펴보기",
    body: "Glow의 핵심 지표와 팀의 최신 소식입니다.",
    glwPrice: "GLW 가격",
    glwPriceSub: "현재 시세",
    marketCap: "시가총액",
    marketCapSub: "유통 공급량",
    delegated: "위임된 GLW",
    delegatedSub: "유통 공급량 대비",
    exploreLabel: "둘러보기",
    viewAllStats: "전체 지표 보기",
    viewAllStatsSub: "프로토콜 지표 자세히 보기.",
  },
  liveFarms: {
    countLine: (count) => `네트워크에 ${count}개 발전소 가동 중`,
    installed: "설치 용량",
    offset: "상쇄량",
    live: "가동 중",
    liveSince: (date) => `${date}부터 가동`,
    showing: (shown, total) => `${total}개 중 ${shown}개 표시`,
    empty: "아직 표시할 가동 중인 발전소가 없습니다.",
  },
};

const zh: OnboardingStrings = {
  stepper: {
    stepOf: (current, total) => `第 ${current} 步 / 共 ${total} 步`,
  },
  steps: {
    buy: "购买 GLW",
    delegate: "委托",
    earn: "赚取",
    mine: "挖矿",
    learn: "了解",
  },
  buy: {
    kicker: "代币",
    title: "购买 GLW，Glow 经济的燃料。",
    body: "Glow 由 GLW 代币驱动，GLW 通过一个称为委托（delegation）的过程来支持太阳能电站。",
    priceLabel: "GLW 价格",
    priceChart: "价格图表",
    priceSource: "链上实时现货价格。",
    cta: "购买 GLW",
  },
  delegate: {
    kicker: "委托",
    title: "向太阳能电站委托 GLW",
    body: "每个太阳能电站根据其竞争力产生数量不等的奖励。通过向电站委托 GLW，你即表示支持其参与 Glow，并根据该电站的竞争力获得奖励（或惩罚）。",
    rewardScore: "奖励分数",
    estWeekly: "预计每周",
    forWeeks: "持续 100 周",
    cta: "委托 GLW",
  },
  countdown: {
    nextWindow: "下一个上线窗口",
    opens: "每周二美东时间上午 9 点开启",
    days: "天",
    hours: "时",
    minutes: "分",
    seconds: "秒",
    note: "新的太阳能电站每周二开放委托。现在持有 GLW，电站上线时即可立即参与。",
    cta: "购买 GLW 做好准备",
  },
  earn: {
    kicker: "奖励",
    title: "赚取积分与影响力",
    body: "委托 GLW 可赚取积分，并在积分商店中兑换。你还会获得影响力：你赚取的‘瓦特’代表真实的能源产量，‘吨 CO₂’代表你所支持的电站实际消除的排放量。",
    shopTitle: "积分商店",
    shopDesc: "将赚取的积分兑换为真实奖励。",
    shopCta: "打开商店",
    leaderboardTitle: "影响力排行榜",
    leaderboardDesc: "查看按瓦特和 CO₂ 吨数排名的顶级钱包。",
    leaderboardCta: "查看排行榜",
  },
  miner: {
    kicker: "挖矿",
    title: "成为 GLW 矿工",
    body: "赚取 GLW 最快的方式是在市场上购买。不过，你也可以通过购买矿机每周赚取 GLW。每台矿机连接到一座真实的太阳能电站，并收取该电站产生的部分 GLW 奖励。",
    price: "价格",
    estWeekly: "预计每周",
    forWeeks: (weeks) => `持续 ${weeks} 周`,
    cta: "购买矿机",
    emptyTitle: "矿机补货中",
    emptyBody: "入门矿机马上就会上架 — 请稍后再来查看。",
  },
  learn: {
    kicker: "了解更多",
    title: "深入了解协议",
    body: "Glow 背后的数据，以及团队的最新动态。",
    glwPrice: "GLW 价格",
    glwPriceSub: "当前现货价格",
    marketCap: "市值",
    marketCapSub: "流通供应量",
    delegated: "已委托 GLW",
    delegatedSub: "占流通供应量",
    exploreLabel: "探索",
    viewAllStats: "查看全部数据",
    viewAllStatsSub: "深入了解协议数据。",
  },
  liveFarms: {
    countLine: (count) => `全网 ${count} 个电站已上线`,
    installed: "已装机",
    offset: "已抵消",
    live: "运行中",
    liveSince: (date) => `${date} 起上线`,
    showing: (shown, total) => `显示 ${shown} / ${total}`,
    empty: "暂无可显示的运行中电站。",
  },
};

export const onboardingTranslations: Record<Lang, OnboardingStrings> = {
  en,
  ko,
  zh,
};
