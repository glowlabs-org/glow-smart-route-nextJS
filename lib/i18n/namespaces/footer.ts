import type { Lang } from "../config";

export interface FooterStrings {
  tagline: string;
  audits: string;
  branding: string;
  press: string;
  blog: string;
  impactSubscription: string;
  partnerships: string;
  copyright: string;
  privacyNotice: string;
  cookiePolicy: string;
  termsOfUse: string;
}

const en: FooterStrings = {
  tagline:
    "A community working together to build a more sustainable energy grid",
  audits: "Audits",
  branding: "Branding",
  press: "Press",
  blog: "Blog",
  impactSubscription: "Impact Subscription",
  partnerships: "Partnerships",
  copyright: "©2025 Glow. All rights reserved.",
  privacyNotice: "Privacy Notice",
  cookiePolicy: "Cookie Policy",
  termsOfUse: "Terms of Use",
};

const ko: FooterStrings = {
  tagline: "더 지속 가능한 에너지 그리드를 함께 구축하는 커뮤니티",
  audits: "감사",
  branding: "브랜딩",
  press: "보도자료",
  blog: "블로그",
  impactSubscription: "임팩트 구독",
  partnerships: "파트너십",
  copyright: "©2025 Glow. 모든 권리 보유.",
  privacyNotice: "개인정보 고지",
  cookiePolicy: "쿠키 정책",
  termsOfUse: "이용 약관",
};

const zh: FooterStrings = {
  tagline: "携手共建更可持续能源电网的社区",
  audits: "审计",
  branding: "品牌",
  press: "媒体",
  blog: "博客",
  impactSubscription: "影响力订阅",
  partnerships: "合作伙伴",
  copyright: "©2025 Glow。保留所有权利。",
  privacyNotice: "隐私声明",
  cookiePolicy: "Cookie 政策",
  termsOfUse: "使用条款",
};

export const footerTranslations: Record<Lang, FooterStrings> = {
  en,
  ko,
  zh,
};
