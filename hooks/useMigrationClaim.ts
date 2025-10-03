"use client";

import { useCallback } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ControlRouter,
  buildVerifyUserMessage,
  verifyUserEIP712Types,
  stakeControlEIP712Domain,
  type VerifyUserSignatureRequest,
} from "@glowlabs-org/utils/browser";
import { useEthersSigner } from "@/hooks/useEthersSigner";

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL;

if (!CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const control = ControlRouter(CONTROL_API_URL);

// Query Keys
const QUERY_KEYS = {
  latestNonce: (wallet?: string) => ["latest-nonce", wallet],
  migrationAmount: (wallet?: string) => ["migration-amount", wallet],
  gctlBalance: (wallet?: string) => ["gctl-balance", wallet],
} as const;

export function useMigrationClaim() {
  const { address, isConnected } = useAccount();
  const { signer } = useEthersSigner();
  const queryClient = useQueryClient();

  // Get latest nonce from API
  const { data: latestNonce, refetch: refetchNonce } = useQuery({
    queryKey: QUERY_KEYS.latestNonce(address),
    queryFn: () => control.fetchLastNonce(address!),
    enabled: isConnected && Boolean(address),
    staleTime: 0, // Always fetch fresh nonce for security
  });

  // Migration claim mutation
  const migrationClaimMutation = useMutation({
    mutationFn: async (): Promise<{ success: boolean }> => {
      if (!isConnected || !address || !signer) {
        throw new Error("Wallet not connected");
      }

      // 1. Get latest nonce
      await refetchNonce();
      if (!latestNonce) {
        throw new Error("Failed to fetch account nonce");
      }

      const nonce = (Number(latestNonce) + 1).toString();
      const deadline = Math.floor(Date.now() / 1000 + 3600).toString(); // 1 hour from now

      // 2. Build EIP-712 message
      const signatureMessage = buildVerifyUserMessage({
        nonce,
        deadline,
      });

      // 3. Sign the message
      const eip712Types = verifyUserEIP712Types as unknown as Record<
        string,
        any[]
      >;
      const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "1");

      const signature: VerifyUserSignatureRequest["signature"] =
        await signer.signTypedData(
          stakeControlEIP712Domain(chainId),
          eip712Types,
          signatureMessage
        );

      if (!signature) {
        throw new Error("Failed to sign verification message");
      }

      // 4. Submit migration request
      const result = await control.migrateUser({
        wallet: address,
        signature,
        nonce,
        deadline,
      });

      if (!result.success) {
        throw new Error("Migration claim failed");
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate all relevant queries after successful migration
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.migrationAmount(address),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.gctlBalance(address),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.latestNonce(address),
      });
      // Invalidate wallet details from useWallets hook
      queryClient.invalidateQueries({ queryKey: ["wallet-details", address] });
      // Invalidate ERC20 balances
      queryClient.invalidateQueries({ queryKey: ["erc20-balances"] });

      toast.success(
        "Migration claimed successfully! Your GCTL has been transferred to your wallet."
      );
    },
    onError: (error: any) => {
      console.error("Migration claim error:", error);

      // Handle specific error cases
      const errorMessage = error?.message || error?.error || "Unknown error";

      if (errorMessage.includes("already claimed")) {
        toast.error("This migration has already been claimed");
      } else if (
        errorMessage.includes("not found") ||
        errorMessage.includes("not eligible")
      ) {
        toast.error("No migration amount available for this wallet");
      } else if (errorMessage.includes("deadline_expired")) {
        toast.error("Signature expired. Please try again");
      } else if (errorMessage.includes("signature_failed")) {
        toast.error("Invalid signature. Please try again");
      } else if (errorMessage.includes("signer_mismatch")) {
        toast.error("Signature does not match wallet address");
      } else if (errorMessage.includes("already used")) {
        toast.error(
          "Transaction nonce already used. Please refresh and try again"
        );
      } else if (errorMessage.includes("temporarily disabled")) {
        toast.error(
          "Migration is temporarily disabled due to system maintenance"
        );
      } else {
        toast.error(`Migration failed: ${errorMessage}`);
      }
    },
  });

  const executeMigrationClaim = useCallback(async (): Promise<boolean> => {
    try {
      await migrationClaimMutation.mutateAsync();
      return true;
    } catch (error) {
      return false;
    }
  }, [migrationClaimMutation]);

  return {
    executeMigrationClaim,
    isClaimingMigration: migrationClaimMutation.isPending,
    isSuccess: migrationClaimMutation.isSuccess,
    isError: migrationClaimMutation.isError,
    error: migrationClaimMutation.error,
    reset: migrationClaimMutation.reset,
  };
}
