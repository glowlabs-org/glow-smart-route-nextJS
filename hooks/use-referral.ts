"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  useConnectorClient,
  useSignTypedData,
  useSwitchChain,
} from "wagmi";
import { hubGet, hubPost } from "@/lib/api/hub-client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/telemetry";
import { parseReferralError } from "@/lib/referral-errors";
import { resolveWalletChainId } from "@/lib/tos-chain";
import * as Sentry from "@sentry/nextjs";
import {
  clearStoredReferralAttribution,
  REFERRAL_AUTO_LINK_EVENT,
} from "@/lib/referral-attribution";

// ============================================
// EIP-712 Definitions (Must match backend)
// ============================================

export const referralEIP712Domain = (chainId: number) => ({
  name: "GlowReferral",
  version: "1",
  chainId,
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
});

export const linkReferralEIP712Types = {
  LinkReferral: [
    { name: "nonce", type: "uint256" },
    { name: "referralCode", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const changeReferrerEIP712Types = {
  ChangeReferrer: [
    { name: "nonce", type: "uint256" },
    { name: "newReferralCode", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

// ============================================
// Types
// ============================================

export interface ValidateCodeResult {
  valid: boolean;
  referralCode?: string;
  referrerWallet?: string;
  referrerEns?: string;
  message?: string;
}

type ReferralAutoLinkEventDetail = {
  wallet?: string | null;
  referralCode?: string | null;
};

// ============================================
// Hook
// ============================================

export function useReferral() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: connectorClient } = useConnectorClient();
  const { switchChainAsync } = useSwitchChain();
  const [autoLinkSucceeded, setAutoLinkSucceeded] = React.useState(false);
  // Backend verifies signatures against process.env.CHAIN_ID. The frontend MUST
  // sign with the same value, regardless of which chain the wallet thinks it's
  // on, otherwise the backend rejects with domain_chain_mismatch.
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1;

  // Mobile in-wallet browsers (Coinbase WebView, Privy useActiveWallet) often
  // expose a different active chain than wagmi reports. viem's signTypedData
  // pre-checks domain.chainId against the wallet's actual chain and throws
  // InvalidParamsRpcError on mismatch — so we resolve the real chain first and
  // ask the wallet to switch before signing.
  const ensureCorrectChain = React.useCallback(async () => {
    const walletChainId = await resolveWalletChainId({
      connectorClient: connectorClient as
        | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
        | undefined,
      fallbackChainId: chainId,
    });

    if (walletChainId === chainId) return;

    await switchChainAsync({ chainId });

    const switchedChainId = await resolveWalletChainId({
      connectorClient: connectorClient as
        | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
        | undefined,
      fallbackChainId: chainId,
    });

    if (switchedChainId !== chainId) {
      throw new Error(
        `Please switch your wallet to chain ${chainId} and try again.`
      );
    }
  }, [chainId, connectorClient, switchChainAsync]);

  React.useEffect(() => {
    setAutoLinkSucceeded(false);
  }, [address]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAutoLink = (event: Event) => {
      const customEvent = event as CustomEvent<ReferralAutoLinkEventDetail>;
      if (!address) return;
      if (customEvent.detail?.wallet?.toLowerCase() !== address.toLowerCase()) {
        return;
      }

      setAutoLinkSucceeded(true);
      trackEvent("referral_auto_link_success", {
        referralCode: customEvent.detail?.referralCode ?? null,
        wallet: address,
      });
    };

    window.addEventListener(REFERRAL_AUTO_LINK_EVENT, handleAutoLink);
    return () => {
      window.removeEventListener(REFERRAL_AUTO_LINK_EVENT, handleAutoLink);
    };
  }, [address]);

  // 1. Referral Status & Nonce
  const statusQuery = useQuery({
    queryKey: ["referral-status", address],
    queryFn: () => hubGet<any>("/referral/status", {
      params: { walletAddress: address! },
    }),
    enabled: !!address,
  });

  // 2. Validate Code (before signing)
  const validateCode = async (code: string): Promise<ValidateCodeResult> => {
    try {
      const result = await hubGet<ValidateCodeResult>(`/referral/validate/${encodeURIComponent(code)}`);
      return result;
    } catch {
      return { valid: false, message: "Failed to validate code" };
    }
  };

  // 3. Link Referrer Mutation (validates first, then signs)
  const linkMutation = useMutation({
    mutationFn: async (referralCode: string) => {
      const walletAddress = address;
      if (!walletAddress) throw new Error("Wallet not connected");

      // Validate code before asking for signature
      const validation = await validateCode(referralCode);
      if (!validation.valid) {
        throw new Error(validation.message || "Invalid referral code");
      }

      // Self-referral check
      if (validation.referrerWallet?.toLowerCase() === walletAddress.toLowerCase()) {
        throw new Error("You cannot refer yourself");
      }
      
      const status = await queryClient.fetchQuery({
        queryKey: ["referral-status", walletAddress],
        queryFn: () => hubGet<any>("/referral/status", {
          params: { walletAddress },
        }),
      });

      // An auto-link triggered by ToS acceptance (POST /referral/auto-link with
      // bypassNonceCheck) can land before the user clicks Claim Bonus. If the
      // backend already shows this referee linked to the same code, short-
      // circuit as success instead of prompting a redundant signature and
      // racing the nonce.
      if (
        status?.referral &&
        typeof status.referral.referralCode === "string" &&
        status.referral.referralCode.toLowerCase() === referralCode.toLowerCase()
      ) {
        return status.referral;
      }

      const deadline = Math.floor(Date.now() / 1000 + 3600); // 1 hour
      const nonce = status.nonce;

      await ensureCorrectChain();

      const signature = await signTypedDataAsync({
        account: walletAddress,
        domain: referralEIP712Domain(chainId),
        types: linkReferralEIP712Types,
        primaryType: "LinkReferral",
        message: {
          nonce: BigInt(nonce),
          referralCode,
          deadline: BigInt(deadline),
        },
      });

      try {
        return await hubPost<any>("/referral/link", {
          wallet: walletAddress,
          signature,
          nonce: nonce.toString(),
          referralCode,
          deadline: deadline.toString(),
        });
      } catch (error) {
        // If an auto-link raced us between fetchQuery and POST, the backend
        // nonce will have advanced and the POST fails with "Invalid nonce".
        // Re-fetch status once — if the referee is now linked to the same
        // code, the race already gave us the outcome we wanted.
        const message = error instanceof Error ? error.message : String(error);
        if (/Invalid nonce/i.test(message)) {
          const freshStatus = await queryClient.fetchQuery({
            queryKey: ["referral-status", walletAddress],
            queryFn: () => hubGet<any>("/referral/status", {
              params: { walletAddress },
            }),
          });
          if (
            freshStatus?.referral &&
            typeof freshStatus.referral.referralCode === "string" &&
            freshStatus.referral.referralCode.toLowerCase() ===
              referralCode.toLowerCase()
          ) {
            return freshStatus.referral;
          }
        }
        throw error;
      }
    },
    onSuccess: (_, referralCode) => {
      clearStoredReferralAttribution();
      queryClient.invalidateQueries({ queryKey: ["referral-status", address] });
      queryClient.invalidateQueries({ queryKey: ["impact-glow-score", address] });
      trackEvent("referral_link_success", { referralCode, wallet: address });
      // Success is handled by the calling component (modal shows success state)
    },
    onError: (error: any, referralCode) => {
      const parsed = parseReferralError(error);
      trackEvent("referral_link_error", {
        referralCode,
        wallet: address,
        error: parsed.message,
        errorType: parsed.type,
      });

      if (parsed.isUserRejection || parsed.isValidationError) {
        toast.error(parsed.message || "Failed to link referrer");
        return;
      }
      const normalizedError =
        error instanceof Error ? error : new Error(String(error?.message || error));
      Sentry.captureException(normalizedError, {
        tags: { referralStage: "link", referralErrorType: parsed.type },
        extra: { referralCode, walletAddress: address, parsedMessage: parsed.message },
      });
      toast.error(parsed.message || "Failed to link referrer");
    },
  });

  // 4. Change Referrer Mutation (validates first, then signs)
  const changeMutation = useMutation({
    mutationFn: async (newReferralCode: string) => {
      const walletAddress = address;
      if (!walletAddress) throw new Error("Wallet not connected");

      // Validate code before asking for signature
      const validation = await validateCode(newReferralCode);
      if (!validation.valid) {
        throw new Error(validation.message || "Invalid referral code");
      }

      // Self-referral check
      if (validation.referrerWallet?.toLowerCase() === walletAddress.toLowerCase()) {
        throw new Error("You cannot refer yourself");
      }

      const status = await queryClient.fetchQuery({
        queryKey: ["referral-status", walletAddress],
        queryFn: () => hubGet<any>("/referral/status", {
          params: { walletAddress },
        }),
      });

      if (
        status?.referral &&
        typeof status.referral.referralCode === "string" &&
        status.referral.referralCode.toLowerCase() ===
          newReferralCode.toLowerCase()
      ) {
        return status.referral;
      }

      const deadline = Math.floor(Date.now() / 1000 + 3600);
      const nonce = status.nonce;

      await ensureCorrectChain();

      const signature = await signTypedDataAsync({
        account: walletAddress,
        domain: referralEIP712Domain(chainId),
        types: changeReferrerEIP712Types,
        primaryType: "ChangeReferrer",
        message: {
          nonce: BigInt(nonce),
          newReferralCode,
          deadline: BigInt(deadline),
        },
      });

      try {
        return await hubPost<any>("/referral/change", {
          wallet: walletAddress,
          signature,
          nonce: nonce.toString(),
          newReferralCode,
          deadline: deadline.toString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/Invalid nonce/i.test(message)) {
          const freshStatus = await queryClient.fetchQuery({
            queryKey: ["referral-status", walletAddress],
            queryFn: () => hubGet<any>("/referral/status", {
              params: { walletAddress },
            }),
          });
          if (
            freshStatus?.referral &&
            typeof freshStatus.referral.referralCode === "string" &&
            freshStatus.referral.referralCode.toLowerCase() ===
              newReferralCode.toLowerCase()
          ) {
            return freshStatus.referral;
          }
        }
        throw error;
      }
    },
    onSuccess: (_, newReferralCode) => {
      clearStoredReferralAttribution();
      queryClient.invalidateQueries({ queryKey: ["referral-status", address] });
      queryClient.invalidateQueries({ queryKey: ["impact-glow-score", address] });
      trackEvent("referral_change_success", { newReferralCode, wallet: address });
      toast.success("Referrer changed successfully!");
    },
    onError: (error: any, newReferralCode) => {
      const parsed = parseReferralError(error);
      trackEvent("referral_change_error", {
        newReferralCode,
        wallet: address,
        error: parsed.message,
        errorType: parsed.type,
      });

      if (parsed.isUserRejection || parsed.isValidationError) {
        toast.error(parsed.message || "Failed to change referrer");
        return;
      }
      const normalizedError =
        error instanceof Error ? error : new Error(String(error?.message || error));
      Sentry.captureException(normalizedError, {
        tags: { referralStage: "change", referralErrorType: parsed.type },
        extra: {
          newReferralCode,
          walletAddress: address,
          parsedMessage: parsed.message,
        },
      });
      toast.error(parsed.message || "Failed to change referrer");
    },
  });

  return {
    status: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    validateCode,
    linkReferrer: linkMutation.mutateAsync,
    isLinking: linkMutation.isPending,
    linkError: linkMutation.error,
    changeReferrer: changeMutation.mutateAsync,
    isChanging: changeMutation.isPending,
    changeError: changeMutation.error,
    isAutoLinking: false,
    autoLinkSucceeded,
  };
}
