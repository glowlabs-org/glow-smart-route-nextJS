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
    "Your boost stays on its original schedule. The +100 bonus points will unlock after you reach 100 points.",
  newSuccessBody:
    "Your 12-week boost starts now. Earn 10% more points each week, and unlock +100 bonus points after you reach 100 points.",
  startYourOwnNetwork: "Start your own network",
  inviteFriendsBody:
    "Invite friends and earn up to 20% of their Impact Points. They'll get the same bonuses you just unlocked.",
  copied: "Copied!",
  copyYourLink: "Copy Your Link",
  toastReferralLinkCopied: "Your referral link copied!",
  startEarningPoints: "Start earning points to unlock your activation bonus.",
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
  claimBonus: "Claim Bonus",
  verifying: "Verifying...",

  connectWalletToVerify: "Connect wallet to verify eligibility",
  checkingEligibility: "Checking eligibility...",
  linkingStored: "Linking your stored referral automatically...",
  notEligible: "You're not eligible to claim right now.",
  unableToVerify: "Unable to verify this referral right now.",
  canSwitchPending: "You can switch referrers while your referral is pending.",

  badgeActiveNow: "Active Now",
  badgePending: "Pending",
  badgeBoostingPoints1: "Boosting your points",
  badgeBoostingPoints2: "for 12 weeks",
  badgeBoostingPointsMobile: "12 weeks",
  badgeUnlocksAfter1: "Unlocks after your first",
  badgeUnlocksAfter2: "100 points",
  badgeAt100PtsMobile: "At 100 pts",
  badgeImpactPointsBonus: "Impact Points Bonus",
  badgeAddedToBase1: "Added to your base points",
  badgeAddedToBase2: "for 12 weeks",
  badgeBonusPoints: "Bonus Points",
  badgeAt100Points: "At 100 points",
};

const ko: ReferralLandingStrings = {
  programLaunchingSoon: "추천 프로그램이 곧 시작됩니다",
  referralsOpenOn: (date) => `추천은 ${date}에 시작됩니다.`,
  goToDashboard: "대시보드로 이동",

  youreIn: "참여 완료",
  referralLinkedTo: "다음 추천인에 연결됨:",
  changeSuccessBody:
    "부스트는 원래 일정대로 유지됩니다. +100 보너스 포인트는 100포인트에 도달한 후 해제됩니다.",
  newSuccessBody:
    "12주 부스트가 지금 시작됩니다. 매주 10% 더 많은 포인트를 적립하고, 100포인트에 도달하면 +100 보너스 포인트를 해제합니다.",
  startYourOwnNetwork: "내 네트워크 시작하기",
  inviteFriendsBody:
    "친구를 초대하고 그들의 임팩트 포인트의 최대 20%를 적립하세요. 친구들은 방금 해제하신 것과 동일한 보너스를 받습니다.",
  copied: "복사됨!",
  copyYourLink: "내 링크 복사",
  toastReferralLinkCopied: "추천 링크가 복사되었습니다!",
  startEarningPoints:
    "활성화 보너스를 해제하려면 포인트 적립을 시작하세요.",
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
  claimBonus: "보너스 청구",
  verifying: "확인 중...",

  connectWalletToVerify: "자격 확인을 위해 지갑을 연결하세요",
  checkingEligibility: "자격 확인 중...",
  linkingStored: "저장된 추천을 자동으로 연결하는 중...",
  notEligible: "지금은 청구 자격이 없습니다.",
  unableToVerify: "이 추천을 지금 확인할 수 없습니다.",
  canSwitchPending: "추천이 대기 중인 동안 추천인을 변경할 수 있습니다.",

  badgeActiveNow: "지금 활성",
  badgePending: "대기 중",
  badgeBoostingPoints1: "12주 동안",
  badgeBoostingPoints2: "포인트 부스트 중",
  badgeBoostingPointsMobile: "12주",
  badgeUnlocksAfter1: "첫 100포인트",
  badgeUnlocksAfter2: "후 해제",
  badgeAt100PtsMobile: "100포인트에서",
  badgeImpactPointsBonus: "임팩트 포인트 보너스",
  badgeAddedToBase1: "기본 포인트에 추가",
  badgeAddedToBase2: "12주 동안",
  badgeBonusPoints: "보너스 포인트",
  badgeAt100Points: "100포인트에서",
};

export const referralLandingTranslations: Record<Lang, ReferralLandingStrings> =
  {
    en,
    ko,
  };
