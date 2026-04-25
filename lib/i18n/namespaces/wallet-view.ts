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

export const walletViewTranslations: Record<Lang, WalletViewStrings> = {
  en,
  ko,
};
