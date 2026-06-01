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
import { chainIdToName, resolveWalletChainId } from "@/lib/tos-chain";
import * as Sentry from "@sentry/nextjs";

// ============================================
// EIP-712 Definitions (must match the backend signature-schema/raffle.ts)
// ============================================

export const raffleEIP712Domain = (chainId: number) => ({
  name: "GlowRaffle",
  version: "1",
  chainId,
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
});

export const raffleEntryEIP712Types = {
  RaffleEntry: [
    { name: "nonce", type: "uint256" },
    { name: "raffleSlug", type: "string" },
    { name: "discordId", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

// ============================================
// Types (mirror GET /raffle/status)
// ============================================

export type EligibilityAsset = "GLW" | "SGCTL";
export type RaffleLifecycle = "not_started" | "open" | "closed";
export type RaffleEntryStatus =
  | "not_started"
  | "closed"
  | "ineligible"
  | "missing_discord"
  | "eligible_to_enter"
  | "entered";

export interface PublicRaffle {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  allowedChainIds: number[];
  // Optional: backend may not send this yet; the page falls back to a per-slug image.
  imageUrl?: string | null;
}

export interface RaffleWalletStatus {
  address: string;
  chainId: number;
  nonce: string;
  eligible: boolean;
  eligibilityAssets: EligibilityAsset[];
  discordLinked: boolean;
  alreadyEntered: boolean;
  entry: {
    id: string;
    eligibilityAssets: string;
    enteredAt: string;
  } | null;
  entryStatus: RaffleEntryStatus;
}

export interface RaffleStatus {
  raffle: PublicRaffle | null;
  status: RaffleLifecycle | null;
  wallet: RaffleWalletStatus | null;
}

// Backend error bodies are plain strings; hub-client wraps them as
// "Hub POST /raffle/enter failed: 403 - <message>". Strip the prefix for display.
function extractHubMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const match = raw.match(/failed:\s*\d+\s*-\s*([\s\S]+)$/);
  return (match ? match[1] : raw).trim();
}

function isUserRejection(message: string): boolean {
  return /user rejected|user denied|rejected the request|request rejected/i.test(
    message
  );
}

// The dl link token is base64url(JSON({ wallet, discordId, exp })).hmac — decode
// the payload to recover the discordId to sign over. The backend re-verifies the
// token's HMAC and that the signed discordId matches, so this is convenience only.
function discordIdFromLinkToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    let b64 = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const payload = JSON.parse(atob(b64));
    return typeof payload?.discordId === "string" ? payload.discordId : null;
  } catch {
    return null;
  }
}

// ============================================
// Hook
// ============================================

export function useRaffle({
  slug,
  discordLinkToken,
}: {
  slug?: string;
  discordLinkToken?: string | null;
} = {}) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: connectorClient } = useConnectorClient();
  const { switchChainAsync } = useSwitchChain();
  // Backend verifies signatures against process.env.CHAIN_ID. The frontend MUST
  // sign with the same value regardless of which chain the wallet reports, or
  // the backend rejects with domain_chain_mismatch.
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1;

  // Mobile in-wallet browsers expose a different active chain than wagmi; the
  // wallet's eth_signTypedData_v4 pre-check rejects on a domain.chainId mismatch.
  // Resolve the real chain and switch first. (Copied from use-referral.ts.)
  const ensureCorrectChain = React.useCallback(async () => {
    const connector = connectorClient as
      | {
          request?: (args: {
            method: string;
            params?: unknown[];
          }) => Promise<unknown>;
        }
      | undefined;
    const provider =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              ethereum?: {
                request?: (args: {
                  method: string;
                  params?: unknown[];
                }) => Promise<unknown>;
              };
            }
          ).ethereum
        : undefined;

    const targetName = chainIdToName(chainId);

    const readChain = () =>
      resolveWalletChainId({
        connectorClient: connector,
        signerProvider: provider?.request
          ? {
              send: (method, params) =>
                provider.request!({ method, params: params ?? [] }),
            }
          : undefined,
      });

    const reported = await readChain();
    if (reported === chainId) return;

    try {
      await switchChainAsync({ chainId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/user rejected|user denied|rejected the request/i.test(message)) {
        throw err;
      }
      throw new Error(
        `Please switch your wallet to ${targetName} and try again.`
      );
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      const confirmed = await readChain();
      if (confirmed === chainId) return;
      await new Promise((r) => setTimeout(r, 250));
    }

    throw new Error(`Please switch your wallet to ${targetName} and try again.`);
  }, [chainId, connectorClient, switchChainAsync]);

  // Raffle metadata + (when connected) per-wallet entry status + nonce.
  const statusQuery = useQuery({
    queryKey: ["raffle-status", slug ?? null, address ?? null],
    queryFn: () =>
      hubGet<RaffleStatus>("/raffle/status", {
        params: { slug, walletAddress: address ?? undefined },
      }),
  });

  const enterMutation = useMutation({
    mutationFn: async () => {
      const walletAddress = address;
      if (!walletAddress) throw new Error("Wallet not connected");
      if (!discordLinkToken) {
        throw new Error("Connect Discord before entering");
      }

      // Re-fetch the freshest nonce/eligibility right before signing.
      const status = await queryClient.fetchQuery({
        queryKey: ["raffle-status", slug ?? null, walletAddress],
        queryFn: () =>
          hubGet<RaffleStatus>("/raffle/status", {
            params: { slug, walletAddress },
          }),
      });

      if (!status.raffle) throw new Error("No active raffle");
      if (status.status !== "open") throw new Error("Raffle is not open");
      const w = status.wallet;
      if (!w) throw new Error("Wallet status unavailable");
      if (w.alreadyEntered) return status.wallet?.entry;
      if (!w.eligible) {
        throw new Error("Wallet has not delegated GLW or sGCTL");
      }
      const discordId = discordIdFromLinkToken(discordLinkToken);
      if (!discordId) throw new Error("Connect Discord before entering");

      const deadline = Math.floor(Date.now() / 1000 + 600); // 10 minutes
      const nonce = w.nonce;
      const raffleSlug = status.raffle.slug;

      await ensureCorrectChain();

      const signature = await signTypedDataAsync({
        account: walletAddress,
        domain: raffleEIP712Domain(chainId),
        types: raffleEntryEIP712Types,
        primaryType: "RaffleEntry",
        message: {
          nonce: BigInt(nonce),
          raffleSlug,
          discordId,
          deadline: BigInt(deadline),
        },
      });

      return await hubPost<{ success: boolean; entry: unknown }>(
        "/raffle/enter",
        {
          wallet: walletAddress,
          signature,
          nonce: nonce.toString(),
          raffleSlug,
          discordId,
          deadline: deadline.toString(),
          discordLinkToken,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raffle-status"] });
      trackEvent("raffle_enter_success", { wallet: address });
      toast.success("You're entered!");
    },
    onError: (error: unknown) => {
      const message = extractHubMessage(error);
      trackEvent("raffle_enter_error", { wallet: address, error: message });
      if (isUserRejection(message)) {
        toast.error("Signature rejected");
        return;
      }
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      Sentry.captureException(normalizedError, {
        tags: { raffleStage: "enter" },
        extra: { walletAddress: address, parsedMessage: message },
      });
      toast.error(message || "Failed to enter the raffle");
    },
  });

  return {
    status: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    isStatusError: statusQuery.isError,
    refetchStatus: statusQuery.refetch,
    enter: enterMutation.mutateAsync,
    isEntering: enterMutation.isPending,
    enterError: enterMutation.error,
  };
}
