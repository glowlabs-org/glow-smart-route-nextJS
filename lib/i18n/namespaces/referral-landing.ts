import type { Lang } from "../config";

export interface ReferralLandingStrings {
  programLaunchingSoon: string;
  referralsOpenOn: (date: string) => string;
  goToDashboard: string;

  youreIn: string;
  referralLinkedTo: string;
  changeSuccessBody: string;
  newSuccessBody: string;
  startYourOwnNetwork: string;
  inviteFriendsBody: string;
  copied: string;
  copyYourLink: string;
  toastReferralLinkCopied: string;
  startEarningPoints: string;
  heroAlt: string;

  personalInvitation: string;
  joinPrefix: string;
  inviterMessage: string;
  learnHowItWorks: string;

  checkingLink: string;
  retryVerification: string;
  invalidLink: string;
  switchToThisReferrer: string;
  changing: string;
  linking: string;
  goToDashboardSuccess: string;
  tryDifferentWallet: string;
  walletAlreadyLinked: string;
  claimBonus: string;
  verifying: string;

  connectWalletToVerify: string;
  checkingEligibility: string;
  linkingStored: string;
  notEligible: string;
  unableToVerify: string;
  canSwitchPending: string;

  // Hero badges
  badgeActiveNow: string;
  badgePending: string;
  badgeBoostingPoints1: string;
  badgeBoostingPoints2: string;
  badgeBoostingPointsMobile: string;
  badgeUnlocksAfter1: string;
  badgeUnlocksAfter2: string;
  badgeAt100PtsMobile: string;
  badgeImpactPointsBonus: string;
  badgeAddedToBase1: string;
  badgeAddedToBase2: string;
  badgeBonusPoints: string;
  badgeAt100Points: string;
}

const en: ReferralLandingStrings = {
  programLaunchingSoon: "Referral Program Launching Soon",
  referralsOpenOn: (date) => `Referrals open on ${date}.`,
  goToDashboard: "Go to Dashboard",

  youreIn: "You're In",
  referralLinkedTo: "Referral Linked to",
  changeSuccessBody:
    "You're now linked to this referrer. You earn at the standard rates and your points always stay yours. They start earning a share of your points (at no cost to you) once you reach 100 points.",
  newSuccessBody:
    "You earn at the standard rates and your points always stay yours. Your referrer earns a share of your points (at no cost to you) once you reach 100 points.",
  startYourOwnNetwork: "Start your own network",
  inviteFriendsBody:
    "Invite friends and earn 5 to 20% of their points, at no cost to them. They earn at the standard rates and keep all of their own points.",
  copied: "Copied!",
  copyYourLink: "Copy Your Link",
  toastReferralLinkCopied: "Your referral link copied!",
  startEarningPoints:
    "Earn at the standard rates and keep all of your points. Reach 100 points and your referrer starts earning a share, at no cost to you.",
  heroAlt: "Solar panels with worker",

  personalInvitation: "Personal Invitation",
  joinPrefix: "Join",
  inviterMessage:
    "I'm supporting scaling solar where it's needed most and earning rewards for doing so, and now you can too. Sign up below and let's build a brighter future together.",
  learnHowItWorks: "Learn how it works",

  checkingLink: "Checking link...",
  retryVerification: "Retry Verification",
  invalidLink: "Invalid Link",
  switchToThisReferrer: "Switch to This Referrer",
  changing: "Changing...",
  linking: "Linking...",
  goToDashboardSuccess: "Go to Dashboard",
  tryDifferentWallet: "Try Different Wallet",
  walletAlreadyLinked: "This wallet is already linked to a referrer",
  claimBonus: "Link Referral",
  verifying: "Verifying...",

  connectWalletToVerify: "Connect wallet to verify eligibility",
  checkingEligibility: "Checking eligibility...",
  linkingStored: "Linking your stored referral automatically...",
  notEligible: "You're not eligible to claim right now.",
  unableToVerify: "Unable to verify this referral right now.",
  canSwitchPending: "You can switch referrers while your referral is pending.",

  badgeActiveNow: "Standard rates",
  badgePending: "5 to 20% share",
  badgeBoostingPoints1: "You keep all of",
  badgeBoostingPoints2: "your own points",
  badgeBoostingPointsMobile: "Your points stay yours",
  badgeUnlocksAfter1: "Your referrer earns a share,",
  badgeUnlocksAfter2: "at no cost to you",
  badgeAt100PtsMobile: "At no cost to you",
  badgeImpactPointsBonus: "Standard rates",
  badgeAddedToBase1: "You keep all of",
  badgeAddedToBase2: "your own points",
  badgeBonusPoints: "5 to 20% share",
  badgeAt100Points: "At no cost to you",
};

const ko: ReferralLandingStrings = {
  programLaunchingSoon: "추천 프로그램이 곧 시작됩니다",
  referralsOpenOn: (date) => `추천은 ${date}에 시작됩니다.`,
  goToDashboard: "대시보드로 이동",

  youreIn: "참여 완료",
  referralLinkedTo: "다음 추천인에 연결됨:",
  changeSuccessBody:
    "이제 이 추천인에 연결되었습니다. 표준 적립률로 포인트를 적립하며, 포인트는 항상 본인의 것입니다. 100포인트에 도달하면 추천인이 회원님의 포인트 일부를 적립하기 시작합니다 (회원님께는 비용이 없습니다).",
  newSuccessBody:
    "표준 적립률로 포인트를 적립하며, 포인트는 항상 본인의 것입니다. 100포인트에 도달하면 추천인이 회원님의 포인트 일부를 적립합니다 (회원님께는 비용이 없습니다).",
  startYourOwnNetwork: "내 네트워크 시작하기",
  inviteFriendsBody:
    "친구를 초대하고 그들의 포인트의 5~20%를 적립하세요. 친구에게는 비용이 없습니다. 친구는 표준 적립률로 포인트를 적립하고 자신의 포인트를 모두 유지합니다.",
  copied: "복사됨!",
  copyYourLink: "내 링크 복사",
  toastReferralLinkCopied: "추천 링크가 복사되었습니다!",
  startEarningPoints:
    "표준 적립률로 포인트를 적립하고 포인트를 모두 유지하세요. 100포인트에 도달하면 추천인이 일부를 적립하기 시작합니다. 회원님께는 비용이 없습니다.",
  heroAlt: "작업자와 태양광 패널",

  personalInvitation: "개인 초대",
  joinPrefix: "함께하기:",
  inviterMessage:
    "저는 가장 필요한 곳에 솔라 확장을 지원하고 그에 따른 리워드를 적립하고 있으며, 이제 여러분도 가능합니다. 아래에서 가입하고 더 밝은 미래를 함께 만들어요.",
  learnHowItWorks: "작동 방식 알아보기",

  checkingLink: "링크 확인 중...",
  retryVerification: "확인 재시도",
  invalidLink: "유효하지 않은 링크",
  switchToThisReferrer: "이 추천인으로 변경",
  changing: "변경 중...",
  linking: "연결 중...",
  goToDashboardSuccess: "대시보드로 이동",
  tryDifferentWallet: "다른 지갑 사용",
  walletAlreadyLinked: "이 지갑은 이미 추천인에 연결되어 있습니다",
  claimBonus: "추천 연결",
  verifying: "확인 중...",

  connectWalletToVerify: "자격 확인을 위해 지갑을 연결하세요",
  checkingEligibility: "자격 확인 중...",
  linkingStored: "저장된 추천을 자동으로 연결하는 중...",
  notEligible: "지금은 청구 자격이 없습니다.",
  unableToVerify: "이 추천을 지금 확인할 수 없습니다.",
  canSwitchPending: "추천이 대기 중인 동안 추천인을 변경할 수 있습니다.",

  badgeActiveNow: "표준 적립률",
  badgePending: "5~20% 분배",
  badgeBoostingPoints1: "본인의 포인트는",
  badgeBoostingPoints2: "모두 본인의 것",
  badgeBoostingPointsMobile: "포인트는 본인의 것",
  badgeUnlocksAfter1: "추천인이 일부를 적립,",
  badgeUnlocksAfter2: "회원님께는 비용 없음",
  badgeAt100PtsMobile: "회원님께 비용 없음",
  badgeImpactPointsBonus: "표준 적립률",
  badgeAddedToBase1: "본인의 포인트는",
  badgeAddedToBase2: "모두 본인의 것",
  badgeBonusPoints: "5~20% 분배",
  badgeAt100Points: "회원님께 비용 없음",
};

const zh: ReferralLandingStrings = {
  programLaunchingSoon: "推荐计划即将上线",
  referralsOpenOn: (date) => `推荐计划将于 ${date} 开放。`,
  goToDashboard: "前往控制台",

  youreIn: "您已加入",
  referralLinkedTo: "推荐已关联至",
  changeSuccessBody:
    "您现已关联至此推荐人。您按标准费率赚取积分,积分始终归您所有。当您达到 100 分后,推荐人将开始赚取您积分的一部分(您无需承担任何费用)。",
  newSuccessBody:
    "您按标准费率赚取积分,积分始终归您所有。当您达到 100 分后,推荐人将赚取您积分的一部分(您无需承担任何费用)。",
  startYourOwnNetwork: "开启您自己的网络",
  inviteFriendsBody:
    "邀请好友,赚取他们积分的 5 至 20%,好友无需承担任何费用。他们按标准费率赚取积分,并保留自己的全部积分。",
  copied: "已复制!",
  copyYourLink: "复制您的链接",
  toastReferralLinkCopied: "推荐链接已复制!",
  startEarningPoints:
    "按标准费率赚取积分并保留全部积分。达到 100 分后,推荐人将开始赚取一部分,您无需承担任何费用。",
  heroAlt: "工作人员与太阳能板",

  personalInvitation: "专属邀请",
  joinPrefix: "加入",
  inviterMessage:
    "我正在支持太阳能在最需要的地区扩展,并因此获得回报,现在您也可以加入。立即注册,让我们一起共建更光明的未来。",
  learnHowItWorks: "了解运作方式",

  checkingLink: "正在检查链接...",
  retryVerification: "重新验证",
  invalidLink: "链接无效",
  switchToThisReferrer: "切换至此推荐人",
  changing: "切换中...",
  linking: "关联中...",
  goToDashboardSuccess: "前往控制台",
  tryDifferentWallet: "尝试其他钱包",
  walletAlreadyLinked: "此钱包已关联推荐人",
  claimBonus: "关联推荐",
  verifying: "验证中...",

  connectWalletToVerify: "请连接钱包以验证资格",
  checkingEligibility: "正在检查资格...",
  linkingStored: "正在自动关联已保存的推荐...",
  notEligible: "您目前不符合领取资格。",
  unableToVerify: "暂时无法验证此推荐。",
  canSwitchPending: "在推荐处于待处理状态时,您可以更换推荐人。",

  badgeActiveNow: "标准费率",
  badgePending: "5 至 20% 分成",
  badgeBoostingPoints1: "您的积分",
  badgeBoostingPoints2: "始终归您所有",
  badgeBoostingPointsMobile: "积分归您所有",
  badgeUnlocksAfter1: "推荐人赚取一部分,",
  badgeUnlocksAfter2: "您无需承担费用",
  badgeAt100PtsMobile: "您无需承担费用",
  badgeImpactPointsBonus: "标准费率",
  badgeAddedToBase1: "您的积分",
  badgeAddedToBase2: "始终归您所有",
  badgeBonusPoints: "5 至 20% 分成",
  badgeAt100Points: "您无需承担费用",
};

export const referralLandingTranslations: Record<Lang, ReferralLandingStrings> =
  {
    en,
    ko,
    zh,
  };
