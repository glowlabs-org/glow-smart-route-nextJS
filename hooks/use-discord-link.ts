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

// ============================================
// EIP-712 (must match backend signature-schemas/discord-link.ts)
// ============================================

export const discordLinkEIP712Domain = (chainId: number) => ({
  name: "GlowDiscordLink",
  version: "1",
  chainId,
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
});

export const discordLinkEIP712Types = {
  DiscordLink: [
    { name: "nonce", type: "uint256" },
    { name: "discordId", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export interface DiscordLinkStatus {
  linked: boolean;
  verified: boolean;
  nonce: string;
}

// dl token = base64url(JSON({ wallet, discordId, exp })).hmac — decode the
// payload to recover the discordId to sign. The backend re-verifies the HMAC +
// that the signed discordId matches, so this is convenience only.
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

export function useDiscordLink({
  discordLinkToken,
}: {
  discordLinkToken?: string | null;
} = {}) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: connectorClient } = useConnectorClient();
  const { switchChainAsync } = useSwitchChain();
  // Backend verifies against process.env.CHAIN_ID — sign with the same value.
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1;

  // Mobile in-wallet browsers expose a different active chain than wagmi; switch
  // first so the wallet's eth_signTypedData_v4 domain.chainId pre-check passes.
  const ensureCorrectChain = React.useCallback(async () => {
    const connector = connectorClient as
      | { request?: (a: { method: string; params?: unknown[] }) => Promise<unknown> }
      | undefined;
    const provider =
      typeof window !== "undefined"
        ? (window as unknown as {
            ethereum?: {
              request?: (a: {
                method: string;
                params?: unknown[];
              }) => Promise<unknown>;
            };
          }).ethereum
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
      if (/user rejected|user denied|rejected the request/i.test(message)) throw err;
      throw new Error(`Please switch your wallet to ${targetName} and try again.`);
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      if ((await readChain()) === chainId) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Please switch your wallet to ${targetName} and try again.`);
  }, [chainId, connectorClient, switchChainAsync]);

  const statusQuery = useQuery({
    queryKey: ["discord-link-status", address ?? null],
    queryFn: () =>
      hubGet<DiscordLinkStatus>("/discord/link-status", {
        params: { walletAddress: address ?? undefined },
      }),
    enabled: Boolean(address),
  });

  // Kick off the Discord OAuth round-trip, returning to /connect.
  const connectDiscord = React.useCallback(() => {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    const hubUrl = (process.env.NEXT_PUBLIC_HUB_URL || "").replace(/\/$/, "");
    const params = new URLSearchParams({
      walletAddress: address,
      returnPath: "/connect",
    });
    trackEvent("discord_connect_start", { wallet: address });
    window.location.href = `${hubUrl}/discord/authorize?${params.toString()}`;
  }, [address]);

  // Sign-to-bind: prove wallet ownership of the OAuth'd discordId.
  const bindMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Wallet not connected");
      const discordId = discordIdFromLinkToken(discordLinkToken);
      if (!discordLinkToken || !discordId) {
        throw new Error("Connect your Discord first");
      }

      // Freshest nonce right before signing.
      const status = await queryClient.fetchQuery({
        queryKey: ["discord-link-status", address],
        queryFn: () =>
          hubGet<DiscordLinkStatus>("/discord/link-status", {
            params: { walletAddress: address },
          }),
      });
      const nonce = status.nonce;
      const deadline = Math.floor(Date.now() / 1000 + 600); // 10 minutes

      await ensureCorrectChain();

      const signature = await signTypedDataAsync({
        account: address,
        domain: discordLinkEIP712Domain(chainId),
        types: discordLinkEIP712Types,
        primaryType: "DiscordLink",
        message: {
          nonce: BigInt(nonce),
          discordId,
          deadline: BigInt(deadline),
        },
      });

      return await hubPost<{ verified: boolean }>("/discord/link", {
        wallet: address,
        signature,
        nonce: nonce.toString(),
        discordId,
        deadline: deadline.toString(),
        discordLinkToken,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discord-link-status"] });
      trackEvent("discord_link_success", { wallet: address });
      toast.success("Discord linked to your wallet");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (/user rejected|user denied|rejected the request/i.test(message)) {
        toast.error("Signature rejected");
        return;
      }
      trackEvent("discord_link_error", { wallet: address, error: message });
      toast.error(message || "Failed to link Discord");
    },
  });

  return {
    status: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    refetchStatus: statusQuery.refetch,
    connectDiscord,
    bind: bindMutation.mutateAsync,
    isBinding: bindMutation.isPending,
  };
}

export type FlexMetric = "vault" | "watts" | "carbon";

export interface FlexPreviewStats {
  /** Whether the wallet belongs to a verified Discord group (vs. just itself). */
  linked: boolean;
  /** Number of wallets aggregated (the Discord group size, or 1 if unlinked). */
  walletCount: number;
  vaultedGlwWei: string;
  totalWatts: string;
  totalCarbonCredits: string;
  /** Best of the entity's three grouped leaderboard ranks, or null if unranked. */
  bestRank: { rank: number; metric: FlexMetric } | null;
}

/**
 * The exact figures `!flex` shows — vault / power / carbon + best rank —
 * aggregated across the user's whole Discord group, for the /connect preview.
 * Hits the keyless GET /discord/flex-preview, which reuses the same grouped
 * build as the bot's /discord/flex (so the preview matches what Luna prints).
 */
export function useFlexPreview({
  wallet,
  enabled = true,
}: {
  wallet?: string | null;
  enabled?: boolean;
}) {
  return useQuery<FlexPreviewStats>({
    queryKey: ["discord-flex-preview", wallet?.toLowerCase() ?? null],
    enabled: Boolean(enabled && wallet),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: () =>
      hubGet<FlexPreviewStats>("/discord/flex-preview", {
        params: { walletAddress: wallet! },
      }),
  });
}

export interface LeaderboardPreviewRow {
  rank: number;
  name: string;
  nameKind: "discord" | "ens" | "address";
  vaultedGlwWei: string;
  totalWatts: string;
  totalCarbonCredits: string;
  isYou: boolean;
}

export interface LeaderboardPreviewResponse {
  metric: FlexMetric;
  totalEntities: number;
  you: { rank: number } | null;
  rows: LeaderboardPreviewRow[];
}

/**
 * Top-10 grouped leaderboard for a metric, with the user's own row flagged —
 * what `!leaderboard` prints. Keyless GET /discord/leaderboard-preview (same
 * grouped/ranked data as the bot's x-api-key /discord/leaderboard).
 */
export function useLeaderboardPreview({
  wallet,
  metric,
  enabled = true,
}: {
  wallet?: string | null;
  metric: FlexMetric;
  enabled?: boolean;
}) {
  return useQuery<LeaderboardPreviewResponse>({
    queryKey: ["discord-leaderboard-preview", wallet?.toLowerCase() ?? null, metric],
    enabled: Boolean(enabled && wallet),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    queryFn: () =>
      hubGet<LeaderboardPreviewResponse>("/discord/leaderboard-preview", {
        params: { walletAddress: wallet!, metric },
      }),
  });
}
