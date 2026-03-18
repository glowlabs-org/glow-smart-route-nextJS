"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId, useSignTypedData } from "wagmi";
import { hubGet, hubPost } from "@/lib/api/hub-client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/telemetry";
import { parseReferralError } from "@/lib/referral-errors";
import * as Sentry from "@sentry/nextjs";

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
  referrerWallet?: string;
  referrerEns?: string;
  message?: string;
}

// ============================================
// Hook
// ============================================

export function useReferral() {
  const { address } = useAccount();
  const connectedChainId = useChainId();
  const queryClient = useQueryClient();
  const { signTypedDataAsync } = useSignTypedData();
  // Use the connected wallet's chain, falling back to mainnet
  const chainId = connectedChainId || 1;

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

      const deadline = Math.floor(Date.now() / 1000 + 3600); // 1 hour
      const nonce = status.nonce;

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

      return await hubPost<any>("/referral/link", {
        wallet: walletAddress,
        signature,
        nonce: nonce.toString(),
        referralCode,
        deadline: deadline.toString(),
      });
    },
    onSuccess: (_, referralCode) => {
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

      if (parsed.isUserRejection) {
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

      const deadline = Math.floor(Date.now() / 1000 + 3600);
      const nonce = status.nonce;

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

      return await hubPost<any>("/referral/change", {
        wallet: walletAddress,
        signature,
        nonce: nonce.toString(),
        newReferralCode,
        deadline: deadline.toString(),
      });
    },
    onSuccess: (_, newReferralCode) => {
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

      if (parsed.isUserRejection) {
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
  };
}
