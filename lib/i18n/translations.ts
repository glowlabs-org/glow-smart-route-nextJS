import { SUPPORTED_LANGS, type Lang } from "./config";
import {
  ambassadorTranslations,
  type AmbassadorStrings,
} from "./namespaces/ambassador";
import {
  bigDialogsTranslations,
  type BigDialogsStrings,
} from "./namespaces/big-dialogs";
import { buyGlowTranslations, type BuyGlowStrings } from "./namespaces/buy-glow";
import { claimsTranslations, type ClaimsStrings } from "./namespaces/claims";
import { commonTranslations, type CommonStrings } from "./namespaces/common";
import { dialogsTranslations, type DialogsStrings } from "./namespaces/dialogs";
import { footerTranslations, type FooterStrings } from "./namespaces/footer";
import { headerTranslations, type HeaderStrings } from "./namespaces/header";
import {
  referralLandingTranslations,
  type ReferralLandingStrings,
} from "./namespaces/referral-landing";
import { homeTranslations, type HomeStrings } from "./namespaces/home";
import {
  onboardingTranslations,
  type OnboardingStrings,
} from "./namespaces/onboarding";
import { routesTranslations, type RoutesStrings } from "./namespaces/routes";
import { swapTranslations, type SwapStrings } from "./namespaces/swap";
import {
  transactionDialogTranslations,
  type TransactionDialogStrings,
} from "./namespaces/transaction-dialog";
import { tosTranslations, type TosStrings } from "./namespaces/tos";
import { walletTranslations, type WalletStrings } from "./namespaces/wallet";
import {
  walletViewTranslations,
  type WalletViewStrings,
} from "./namespaces/wallet-view";
import { widgetsTranslations, type WidgetStrings } from "./namespaces/widgets";

export interface Strings {
  common: CommonStrings;
  ambassador: AmbassadorStrings;
  bigDialogs: BigDialogsStrings;
  buyGlow: BuyGlowStrings;
  claims: ClaimsStrings;
  dialogs: DialogsStrings;
  footer: FooterStrings;
  header: HeaderStrings;
  referralLanding: ReferralLandingStrings;
  home: HomeStrings;
  onboarding: OnboardingStrings;
  routes: RoutesStrings;
  swap: SwapStrings;
  transactionDialog: TransactionDialogStrings;
  wallet: WalletStrings;
  walletView: WalletViewStrings;
  tos: TosStrings;
  widgets: WidgetStrings;
}

// Compose all namespaces into one translations record keyed by language.
// Adding a new namespace: import it here and add the entry below. TypeScript
// enforces every language has every namespace.
export const TRANSLATIONS: Record<Lang, Strings> = SUPPORTED_LANGS.reduce(
  (acc, lang) => {
    acc[lang] = {
      common: commonTranslations[lang],
      ambassador: ambassadorTranslations[lang],
      bigDialogs: bigDialogsTranslations[lang],
      buyGlow: buyGlowTranslations[lang],
      claims: claimsTranslations[lang],
      dialogs: dialogsTranslations[lang],
      footer: footerTranslations[lang],
      header: headerTranslations[lang],
      referralLanding: referralLandingTranslations[lang],
      home: homeTranslations[lang],
      onboarding: onboardingTranslations[lang],
      routes: routesTranslations[lang],
      swap: swapTranslations[lang],
      transactionDialog: transactionDialogTranslations[lang],
      wallet: walletTranslations[lang],
      walletView: walletViewTranslations[lang],
      tos: tosTranslations[lang],
      widgets: widgetsTranslations[lang],
    };
    return acc;
  },
  {} as Record<Lang, Strings>,
);
