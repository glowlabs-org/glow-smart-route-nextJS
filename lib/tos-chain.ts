export type WalletChainRequestClient = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export type WalletChainProvider = {
  send?: (method: string, params: unknown[]) => Promise<unknown>;
  getNetwork?: () => Promise<{ chainId?: unknown }>;
};

export function normalizeChainId(value: unknown): number | undefined {
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && value > 0) return value;
    return undefined;
  }

  if (typeof value === "bigint") {
    if (value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = trimmed.startsWith("0x")
      ? Number.parseInt(trimmed, 16)
      : Number.parseInt(trimmed, 10);

    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }

  return undefined;
}

export async function resolveWalletChainId({
  connectorClient,
  signerProvider,
  fallbackChainId,
}: {
  connectorClient?: WalletChainRequestClient | null;
  signerProvider?: WalletChainProvider | null;
  fallbackChainId?: unknown;
}): Promise<number | undefined> {
  if (connectorClient?.request) {
    try {
      const fromConnector = normalizeChainId(
        await connectorClient.request({ method: "eth_chainId", params: [] })
      );
      if (fromConnector) return fromConnector;
    } catch {
      // Ignore connector RPC issues and continue with other sources.
    }
  }

  if (signerProvider?.send) {
    try {
      const fromSignerSend = normalizeChainId(
        await signerProvider.send("eth_chainId", [])
      );
      if (fromSignerSend) return fromSignerSend;
    } catch {
      // Ignore signer provider send failures and continue.
    }
  }

  if (signerProvider?.getNetwork) {
    try {
      const network = await signerProvider.getNetwork();
      const fromSignerNetwork = normalizeChainId(network?.chainId);
      if (fromSignerNetwork) return fromSignerNetwork;
    } catch {
      // Ignore signer provider network failures and continue.
    }
  }

  return normalizeChainId(fallbackChainId);
}
