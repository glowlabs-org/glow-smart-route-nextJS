export function getReferralExpectedChainId(): number {
  const rawChainId = process.env.NEXT_PUBLIC_CHAIN_ID?.trim();
  if (!rawChainId) return 1;

  const parsed = Number.parseInt(rawChainId, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return 1;

  return parsed;
}

export function isReferralWrongChain(chainId: number | undefined | null): boolean {
  return typeof chainId === "number" && chainId !== getReferralExpectedChainId();
}

export function getReferralChainLabel(chainId = getReferralExpectedChainId()): string {
  if (chainId === 1) return "Mainnet";
  if (chainId === 11155111) return "Sepolia";
  return `Chain ${chainId}`;
}

export function buildReferralWrongChainError(
  connectedChainId: number | undefined | null
): Error {
  return new Error(
    `domain_chain_mismatch: connected_chain=${connectedChainId ?? "unknown"} expected_chain=${getReferralExpectedChainId()}`
  );
}
