"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignTypedData } from "wagmi";
import { hubGet, hubPost } from "@/lib/api/hub-client";
import { trackEvent } from "@/lib/telemetry";
import { toast } from "sonner";
import * as Sentry from "@sentry/nextjs";

// ============================================
// EIP-712 (must match gca-crm-backend/src/signature-schemas/replycorp.ts)
// ============================================

export const replycorpEIP712Domain = (chainId: number) => ({
  name: "GlowReplyCorp",
  version: "1",
  chainId,
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
});

export const linkTwitterEIP712Types = {
  LinkTwitter: [
    { name: "twitterId", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

// ============================================
// Types
// ============================================

export interface ReplycorpStatus {
  linked: boolean;
  twitterId?: string;
  twitterHandle?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  linkedAt?: string;
}

export interface ReplycorpConnectedEventDetail {
  twitterId: string;
  handle: string;
  name: string;
  avatarUrl: string;
}

export interface LinkPayload {
  twitterId: string;
  twitterHandle: string;
  displayName?: string;
  avatarUrl?: string;
}

// ============================================
// Hook
// ============================================

export function useReplycorp() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { signTypedDataAsync } = useSignTypedData();
  // Backend verifies signatures against process.env.CHAIN_ID. Frontend must
  // use the same value (NEXT_PUBLIC_CHAIN_ID) regardless of wallet chain.
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1;

  const statusQuery = useQuery<ReplycorpStatus>({
    queryKey: ["replycorp-status", address],
    queryFn: () =>
      hubGet<ReplycorpStatus>("/replycorp/status", {
        params: { walletAddress: address! },
        notFound: { linked: false } as ReplycorpStatus,
      }),
    enabled: !!address,
    staleTime: 60_000,
  });

  const linkMutation = useMutation({
    mutationFn: async (payload: LinkPayload) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }
      const walletAddress = address.toLowerCase();
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      const signature = await signTypedDataAsync({
        account: address,
        domain: replycorpEIP712Domain(chainId),
        types: linkTwitterEIP712Types,
        primaryType: "LinkTwitter",
        message: {
          twitterId: payload.twitterId,
          deadline: BigInt(deadline),
        },
      });

      return await hubPost<{ success: boolean; link: any }>(
        "/replycorp/link",
        {
          wallet: walletAddress,
          signature,
          twitterId: payload.twitterId,
          twitterHandle: payload.twitterHandle,
          displayName: payload.displayName,
          avatarUrl: payload.avatarUrl,
          deadline: deadline.toString(),
        }
      );
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({
        queryKey: ["replycorp-status", address],
      });
      trackEvent("replycorp_link_success", {
        wallet: address,
        twitterId: payload.twitterId,
      });
      toast.success(`Connected as @${payload.twitterHandle}`);
    },
    onError: (error: unknown, payload) => {
      const message =
        error instanceof Error ? error.message : "Failed to link X account";
      const lower = message.toLowerCase();
      const isUserRejection =
        lower.includes("user rejected") ||
        lower.includes("user denied") ||
        lower.includes("rejected by the user");

      trackEvent("replycorp_link_failed", {
        wallet: address,
        twitterId: payload?.twitterId,
        error: message,
      });

      if (!isUserRejection) {
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          {
            tags: { replycorpStage: "link" },
            extra: {
              wallet: address,
              twitterId: payload?.twitterId,
            },
          }
        );
      }
      toast.error(message);
    },
  });

  return {
    status: statusQuery.data,
    isStatusLoading: statusQuery.isLoading,
    statusError: statusQuery.error,
    refetchStatus: statusQuery.refetch,
    linkMutation,
  };
}
