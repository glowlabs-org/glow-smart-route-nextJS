import type { WalletRewardClaimRow } from "@/lib/api/wallet-reward-claims-index";
import type { WalletSgctlClaimSettlementRow } from "@/hooks/useWalletSgctlClaimSettlements";

export interface ClaimActivityEntry {
  groupKey: string;
  txHash: `0x${string}`;
  logIndex: number;
  timestampMs: number;
  source: WalletRewardClaimRow["source"];
  nonce?: string | null;
  subIndex: number;
  tokenSymbol: string;
  amount: number;
}

export interface ClaimActivityGroup {
  id: string;
  txHash: `0x${string}`;
  logIndex: number;
  timestampMs: number;
  source: WalletRewardClaimRow["source"];
  nonce?: string | null;
  tokenEntries: Array<[string, number]>;
}

export function normalizeClaimActivityKey(
  txHash: string,
  logIndex: number
): string {
  return `${txHash.toLowerCase()}:${logIndex}`;
}

export function buildSgctlClaimActivityEntries(
  settlements: WalletSgctlClaimSettlementRow[],
  amountParser: (rawAmount: string) => number
): ClaimActivityEntry[] {
  const entries: Array<ClaimActivityEntry | null> = settlements.map((settlement) => {
      const timestampMs = new Date(settlement.settledAt).getTime();
      if (!Number.isFinite(timestampMs)) return null;

      const amount = amountParser(settlement.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;

      return {
        groupKey: normalizeClaimActivityKey(
          settlement.txHash,
          settlement.logIndex
        ),
        txHash: settlement.txHash,
        logIndex: settlement.logIndex,
        timestampMs,
        source: "rewardsKernel" as const,
        nonce: settlement.nonce,
        subIndex: Number.MAX_SAFE_INTEGER,
        tokenSymbol: "SGCTL",
        amount,
      } satisfies ClaimActivityEntry;
    });

  return entries.filter(
    (entry): entry is ClaimActivityEntry => entry !== null
  );
}

export function groupClaimActivityEntries(
  entries: ClaimActivityEntry[]
): ClaimActivityGroup[] {
  const groups = new Map<string, ClaimActivityGroup>();

  const sortedEntries = [...entries].sort((a, b) => {
    const timeDiff = b.timestampMs - a.timestampMs;
    if (timeDiff !== 0) return timeDiff;
    return a.subIndex - b.subIndex;
  });

  for (const entry of sortedEntries) {
    const current =
      groups.get(entry.groupKey) ??
      ({
        id: `claim-${entry.txHash}-${entry.logIndex}`,
        txHash: entry.txHash,
        logIndex: entry.logIndex,
        timestampMs: entry.timestampMs,
        source: entry.source,
        nonce: entry.nonce ?? null,
        tokenEntries: [],
      } satisfies ClaimActivityGroup);

    const tokenTotals = new Map(current.tokenEntries);
    tokenTotals.set(
      entry.tokenSymbol,
      (tokenTotals.get(entry.tokenSymbol) ?? 0) + entry.amount
    );

    current.timestampMs = Math.max(current.timestampMs, entry.timestampMs);
    if (current.nonce == null && entry.nonce != null) {
      current.nonce = entry.nonce;
    }
    current.tokenEntries = Array.from(tokenTotals.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    groups.set(entry.groupKey, current);
  }

  return Array.from(groups.values()).sort((a, b) => {
    const timeDiff = b.timestampMs - a.timestampMs;
    if (timeDiff !== 0) return timeDiff;
    return b.logIndex - a.logIndex;
  });
}
