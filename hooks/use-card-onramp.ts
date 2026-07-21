"use client";

import * as React from "react";
import { useFiatOnramp } from "@privy-io/react-auth";

// Mainnet USDC — same destination the legacy card flow funded.
const MAINNET_USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MAINNET_CAIP2 = "eip155:1";

/**
 * Card/fiat onramp for funding a wallet with mainnet USDC.
 *
 * Uses Privy's fiat-onramp flow, which routes each purchase through the
 * providers enabled in the Privy dashboard (Stripe, Meld, MoonPay, Coinbase)
 * based on availability and the user's region — unlike the legacy
 * useFundWallet card flow, which could only pin MoonPay/Coinbase and never
 * surfaces Stripe. Requires @stripe/crypto to be installed for the Stripe
 * embedded flow (US-only, excl. NY; other regions fall back automatically).
 *
 * `isCardOnrampActive` is true while the Privy funding modal is open. Radix
 * dialogs hosting the trigger MUST pass `modal={!isCardOnrampActive}`: the
 * Privy modal portals to <body>, and a modal Radix dialog's focus trap keeps
 * pulling focus back, making Privy's inputs (e.g. date of birth) untypeable.
 * The legacy flow escaped this by opening a popup window; the embedded flow
 * renders in-page.
 */
export function useCardOnramp() {
  const { fund } = useFiatOnramp();
  const [isCardOnrampActive, setIsCardOnrampActive] = React.useState(false);
  const triggerCardFund = React.useCallback(
    (target: { address: `0x${string}`; amount: string }) => {
      setIsCardOnrampActive(true);
      // fund() rejects on user exit as well as real errors; swallow so a
      // closed modal doesn't surface as an unhandled rejection.
      void fund({
        source: { defaultAsset: "usd" },
        destination: {
          asset: MAINNET_USDC_ADDRESS,
          chain: MAINNET_CAIP2,
          address: target.address,
        },
        defaultAmount: target.amount,
      })
        .catch(() => {})
        .finally(() => setIsCardOnrampActive(false));
    },
    [fund],
  );
  return { triggerCardFund, isCardOnrampActive };
}
