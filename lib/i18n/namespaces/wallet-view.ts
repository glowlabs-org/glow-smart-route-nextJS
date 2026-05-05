import type { Lang } from "../config";

export interface WalletViewStrings {
  // Getting Started zero-state
  gettingStarted: string;
  gettingStartedBody1: string;
  gettingStartedBody2: string;
  launchpad: string;
  glowSwap: string;

  buyGlow: string;
  buyGlowBlurb: string;
  buyGlowImageAlt: string;
  fundSolar: string;
  fundSolarBlurb: string;
  fundSolarImageAlt: string;

  quoteText: string;
  quoteAuthor: string;
  joinDiscord: string;

  faqsHeading: string;
  faqQ1: string;
  faqA1: string;
  faqQ2: string;
  faqA2: string;
  faqQ3: string;
  faqA3: string;
  faqQ4: string;
  faqA4: string;

  newsletterHeading: string;
  newsletterSub: string;
  newsletterPlaceholder: string;
  newsletterSubscribed: string;
  newsletterSigningUp: string;
  newsletterChecking: string;
  newsletterSignUp: string;

  // Toast messages
  toastSubscribed: string;
  toastEnterValidEmail: string;
  toastAlreadySubscribed: string;
  toastSubscribeFailed: string;
  toastSubscribeError: string;
  toastEnterValidAmount: string;
  toastNoUsdc: string;
  toastAmountExceedsUsdc: string;
  toastUsdcToUsdgFailed: string;
  toastPriceUnavailable: string;

  // Connected wallet page
  powerWallet: string;
  powerWalletSub: string;
  networkIssue: string;
  retry: string;
  send: string;
  convertToUsdg: string;
  estWeeklyRewards: string;
  claims: string;
  gctlStakingBreakdown: string;
  checking: string;
}

const en: WalletViewStrings = {
  gettingStarted: "Getting started",
  gettingStartedBody1:
    "Build real-world solar. Earn onchain rewards. Make an impact where it matters.",
  gettingStartedBody2: "Let's get you started.",
  launchpad: "Launchpad",
  glowSwap: "Glow Swap",

  buyGlow: "Buy Glow",
  buyGlowBlurb:
    "GLW is the fuel of the Glow ecosystem; it powers new solar farms, drives weekly rewards, and represents your contribution to clean energy.",
  buyGlowImageAlt: "Buy Glow",
  fundSolar: "Fund Solar",
  fundSolarBlurb:
    "Delegate your GLW to fund new solar farms and earn GLW weekly. Or purchase a pre-packaged mining position with USDC and earn GLW weekly.",
  fundSolarImageAlt: "Fund Solar",

  quoteText:
    "If everyone in the world owned $20 of GLW, we could eliminate fossil fuels by 2030.",
  quoteAuthor: "David Vorick, CEO of Glow",
  joinDiscord: "Join us on Discord",

  faqsHeading: "FAQs",
  faqQ1: "What is Glow?",
  faqA1:
    "Glow is a crypto-powered protocol that helps fund the construction of real world solar farms. Glow specifically identifies solar opportunities that create the greatest impact per dollar of funding.",
  faqQ2: "What is GLW and why does it matter?",
  faqA2:
    "GLW is the core token of the Glow ecosystem. It's the token that solar farms earn as they produce clean energy, and it's also the token that gets used to select which farms get supported by the Glow protocol.",
  faqQ3: 'What does "delegating GLW to solar farms" mean?',
  faqA3:
    "To participate in the Glow protocol, a solar farm needs to demonstrate that it can make efficient use of the funding provided by Glow. GLW holders can vouch for the efficiency of a solar farm by delegating their tokens to it. The delegators earn extra GLW tokens for picking efficient farms, but may forfeit tokens if they pick inefficient solar farms. The delegation process is what allows Glow to ensure all of its funding goes to the best possible solar farms.",
  faqQ4: 'What is a "Glow miner"?',
  faqA4:
    "A Glow miner works much like a Bitcoin miner. It is part of a Glow solar farm that earns tokens every week as the solar farm produces electricity. A Glow miner can be purchased for USDC, and will produce GLW tokens every week for 99 weeks.",

  newsletterHeading: "Be the first to hear about Glow news.",
  newsletterSub: "Product updates, launches, and impact wins.",
  newsletterPlaceholder: "you@example.com",
  newsletterSubscribed: "✓ Subscribed",
  newsletterSigningUp: "Signing up...",
  newsletterChecking: "Checking...",
  newsletterSignUp: "Sign up",

  toastSubscribed: "Successfully subscribed to newsletter",
  toastEnterValidEmail: "Please enter a valid email.",
  toastAlreadySubscribed: "You're already subscribed!",
  toastSubscribeFailed: "Failed to subscribe to newsletter",
  toastSubscribeError: "Failed to subscribe. Please try again.",
  toastEnterValidAmount: "Please enter a valid amount",
  toastNoUsdc: "No USDC available to swap",
  toastAmountExceedsUsdc: "Amount exceeds USDC balance",
  toastUsdcToUsdgFailed: "Failed to prepare USDC to USDG swap",
  toastPriceUnavailable: "Price unavailable",

  powerWallet: "Power Wallet",
  powerWalletSub: "Your all-in-one wallet for Glow",
  networkIssue: "Network Issue",
  retry: "Retry",
  send: "Send",
  convertToUsdg: "Convert to USDG",
  estWeeklyRewards: "Est. Weekly Rewards",
  claims: "Claims",
  gctlStakingBreakdown: "GCTL Staking Breakdown by Region",
  checking: "Checking...",
};

const ko: WalletViewStrings = {
  gettingStarted: "시작하기",
  gettingStartedBody1:
    "실제 태양광을 구축하고, 온체인 리워드를 받으며, 의미 있는 임팩트를 만드세요.",
  gettingStartedBody2: "지금 시작해보세요.",
  launchpad: "런치패드",
  glowSwap: "Glow 스왑",

  buyGlow: "Glow 구매",
  buyGlowBlurb:
    "GLW는 Glow 생태계의 연료입니다. 새로운 태양광 발전소에 동력을 공급하고, 주간 리워드를 이끌며, 청정 에너지에 대한 여러분의 기여를 나타냅니다.",
  buyGlowImageAlt: "Glow 구매",
  fundSolar: "태양광 펀딩",
  fundSolarBlurb:
    "GLW를 위임하여 새로운 태양광 발전소를 펀딩하고 매주 GLW를 획득하세요. 또는 USDC로 미리 준비된 마이닝 포지션을 구매하고 매주 GLW를 획득하세요.",
  fundSolarImageAlt: "태양광 펀딩",

  quoteText:
    "세상 모든 사람이 $20의 GLW를 소유한다면, 2030년까지 화석 연료를 없앨 수 있습니다.",
  quoteAuthor: "데이비드 보릭, Glow CEO",
  joinDiscord: "Discord에 참여하세요",

  faqsHeading: "자주 묻는 질문",
  faqQ1: "Glow란 무엇인가요?",
  faqA1:
    "Glow는 실제 태양광 발전소 건설 펀딩을 돕는 암호화폐 기반 프로토콜입니다. Glow는 특히 펀딩 달러당 최대의 임팩트를 창출하는 태양광 기회를 찾습니다.",
  faqQ2: "GLW는 무엇이며 왜 중요한가요?",
  faqA2:
    "GLW는 Glow 생태계의 핵심 토큰입니다. 태양광 발전소가 청정 에너지를 생산할 때 획득하는 토큰이며, Glow 프로토콜이 지원할 발전소를 선택하는 데도 사용됩니다.",
  faqQ3: "태양광 발전소에 GLW를 위임한다는 것은 무엇을 의미하나요?",
  faqA3:
    "Glow 프로토콜에 참여하려면 태양광 발전소가 Glow가 제공하는 펀딩을 효율적으로 사용할 수 있다는 것을 입증해야 합니다. GLW 보유자는 토큰을 위임하여 발전소의 효율성을 보증할 수 있습니다. 위임자는 효율적인 발전소를 선택한 경우 추가 GLW 토큰을 획득하지만, 비효율적인 발전소를 선택한 경우 토큰을 잃을 수 있습니다. 이 위임 과정을 통해 Glow는 모든 펀딩이 최고의 태양광 발전소로 가도록 보장합니다.",
  faqQ4: "Glow 마이너란 무엇인가요?",
  faqA4:
    "Glow 마이너는 비트코인 마이너와 유사하게 작동합니다. Glow 태양광 발전소의 일부로, 발전소가 전기를 생산하면서 매주 토큰을 획득합니다. Glow 마이너는 USDC로 구매할 수 있으며, 99주 동안 매주 GLW 토큰을 생산합니다.",

  newsletterHeading: "Glow 소식을 가장 먼저 받아보세요.",
  newsletterSub: "제품 업데이트, 출시 소식, 임팩트 성과를 전해드립니다.",
  newsletterPlaceholder: "you@example.com",
  newsletterSubscribed: "✓ 구독 완료",
  newsletterSigningUp: "가입 중...",
  newsletterChecking: "확인 중...",
  newsletterSignUp: "가입",

  toastSubscribed: "뉴스레터 구독이 완료되었습니다",
  toastEnterValidEmail: "유효한 이메일을 입력해주세요.",
  toastAlreadySubscribed: "이미 구독 중이세요!",
  toastSubscribeFailed: "뉴스레터 구독에 실패했습니다",
  toastSubscribeError: "구독에 실패했습니다. 다시 시도해주세요.",
  toastEnterValidAmount: "유효한 금액을 입력해주세요",
  toastNoUsdc: "스왑할 수 있는 USDC가 없습니다",
  toastAmountExceedsUsdc: "금액이 USDC 잔액을 초과합니다",
  toastUsdcToUsdgFailed: "USDC → USDG 스왑 준비에 실패했습니다",
  toastPriceUnavailable: "가격을 확인할 수 없습니다",

  powerWallet: "파워 지갑",
  powerWalletSub: "Glow를 위한 올인원 지갑",
  networkIssue: "네트워크 문제",
  retry: "다시 시도",
  send: "전송",
  convertToUsdg: "USDG로 변환",
  estWeeklyRewards: "예상 주간 리워드",
  claims: "클레임",
  gctlStakingBreakdown: "지역별 GCTL 스테이킹 내역",
  checking: "확인 중...",
};

const zh: WalletViewStrings = {
  gettingStarted: "开始使用",
  gettingStartedBody1:
    "建设真实世界的太阳能项目，赚取链上奖励，在重要之处创造影响力。",
  gettingStartedBody2: "让我们开始吧。",
  launchpad: "Launchpad",
  glowSwap: "Glow 兑换",

  buyGlow: "购买 Glow",
  buyGlowBlurb:
    "GLW 是 Glow 生态系统的燃料，为新建太阳能电站提供动力，驱动每周奖励，并代表您对清洁能源的贡献。",
  buyGlowImageAlt: "购买 Glow",
  fundSolar: "资助太阳能",
  fundSolarBlurb:
    "委托您的 GLW 资助新建太阳能电站，每周获得 GLW 奖励。或使用 USDC 购买预设的矿工头寸，每周赚取 GLW。",
  fundSolarImageAlt: "资助太阳能",

  quoteText:
    "如果世界上每个人都拥有 20 美元的 GLW，我们就能在 2030 年前淘汰化石燃料。",
  quoteAuthor: "David Vorick，Glow 首席执行官",
  joinDiscord: "加入我们的 Discord",

  faqsHeading: "常见问题",
  faqQ1: "什么是 Glow？",
  faqA1:
    "Glow 是一个由加密技术驱动的协议，旨在帮助资助现实世界中太阳能电站的建设。Glow 专门寻找每一美元资金都能创造最大影响力的太阳能项目。",
  faqQ2: "什么是 GLW？为什么它很重要？",
  faqA2:
    "GLW 是 Glow 生态系统的核心代币。太阳能电站在生产清洁能源时会获得这种代币，同时它也是用于决定 Glow 协议支持哪些电站的代币。",
  faqQ3: "“将 GLW 委托给太阳能电站”是什么意思？",
  faqA3:
    "要参与 Glow 协议，太阳能电站需要证明自己能够高效利用 Glow 提供的资金。GLW 持有者可以通过将代币委托给某个电站来为其效率背书。委托者会因选中高效电站而获得额外的 GLW 代币奖励，但若选中低效电站则可能损失部分代币。这一委托机制确保了 Glow 的所有资金都能流向最优秀的太阳能项目。",
  faqQ4: "什么是“Glow 矿工”？",
  faqA4:
    "Glow 矿工的工作方式与比特币矿工类似。它是 Glow 太阳能电站的一部分，电站每发电一周便会赚取代币。Glow 矿工可用 USDC 购买，并将在 99 周内每周产出 GLW 代币。",

  newsletterHeading: "第一时间了解 Glow 的最新动态。",
  newsletterSub: "产品更新、新品发布与影响力成果，尽在掌握。",
  newsletterPlaceholder: "you@example.com",
  newsletterSubscribed: "✓ 已订阅",
  newsletterSigningUp: "正在订阅……",
  newsletterChecking: "检查中……",
  newsletterSignUp: "订阅",

  toastSubscribed: "已成功订阅时事通讯",
  toastEnterValidEmail: "请输入有效的电子邮箱。",
  toastAlreadySubscribed: "您已订阅！",
  toastSubscribeFailed: "订阅时事通讯失败",
  toastSubscribeError: "订阅失败，请重试。",
  toastEnterValidAmount: "请输入有效金额",
  toastNoUsdc: "没有可用于兑换的 USDC",
  toastAmountExceedsUsdc: "金额超出 USDC 余额",
  toastUsdcToUsdgFailed: "准备 USDC 兑换 USDG 失败",
  toastPriceUnavailable: "价格暂时不可用",

  powerWallet: "Power 钱包",
  powerWalletSub: "您的 Glow 一站式钱包",
  networkIssue: "网络异常",
  retry: "重试",
  send: "发送",
  convertToUsdg: "兑换为 USDG",
  estWeeklyRewards: "预计每周奖励",
  claims: "领取",
  gctlStakingBreakdown: "按地区划分的 GCTL 质押明细",
  checking: "检查中……",
};

export const walletViewTranslations: Record<Lang, WalletViewStrings> = {
  en,
  ko,
  zh,
};
