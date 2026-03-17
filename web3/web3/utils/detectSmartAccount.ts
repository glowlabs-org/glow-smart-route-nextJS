import { isHex, getAddress } from "viem";

export interface SmartAccountDetectionParams {
  address?: `0x${string}`;
  walletClient?: any;
  getBytecode?: (args: {
    address: `0x${string}`;
  }) => Promise<`0x${string}` | null | undefined>;
}

export interface SmartAccountStatus {
  isContractWallet: boolean;
  isEip7702Delegated: boolean;
  hasWalletAABatching: boolean;
  rawCapabilities?: unknown;
  eip7702Implementation?: `0x${string}`;
}

export const SMART_ACCOUNT_UNSUPPORTED_MESSAGE =
  "Smart account mode is enabled for this wallet. Glow swaps require a regular account (EOA). Disable Smart Account in MetaMask and try again.";

function getWalletRequests(walletClient: any) {
  const requests: Array<(args: any) => Promise<any>> = [];
  const wcAny = walletClient as any;
  if (wcAny?.transport && typeof wcAny.transport.request === "function") {
    requests.push(wcAny.transport.request as (args: any) => Promise<any>);
  }
  if (typeof window !== "undefined") {
    const eth: any = (window as any).ethereum;
    if (eth && typeof eth.request === "function") {
      requests.push(eth.request.bind(eth) as (args: any) => Promise<any>);
    }
  }
  return requests;
}

async function requestWalletCapabilities(params: {
  address?: `0x${string}`;
  requests: Array<(args: any) => Promise<any>>;
}) {
  const { address, requests } = params;
  if (!requests.length) return null;

  for (const request of requests) {
    try {
      return await request({
        method: "wallet_getCapabilities",
        params: address ? [address] : [],
      });
    } catch {
      try {
        return await request({ method: "wallet_getCapabilities" });
      } catch {
        continue;
      }
    }
  }
  return null;
}

function hasSmartCapabilitySignals(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;

  const stack: unknown[] = [payload];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;

    const entries = Object.entries(current as Record<string, unknown>);
    for (const [rawKey, rawValue] of entries) {
      const key = rawKey.toLowerCase();
      const value = rawValue as any;

      if (key === "atomic") {
        const status = String(value?.status ?? "").toLowerCase();
        if (value?.supported === true) return true;
        if (status === "ready" || status === "supported" || status === "available") {
          return true;
        }
      }

      if (key === "eip7702auth" || key === "eip-7702auth") {
        const status = String(value?.status ?? "").toLowerCase();
        if (value?.supported === true) return true;
        if (status === "ready" || status === "supported" || status === "available") {
          return true;
        }
      }

      if (key === "wallet_sendcalls" || key === "wallet_sendcalls_batch") {
        if (value !== false) return true;
      }

      if (typeof value === "object" && value !== null) {
        stack.push(value);
      }
    }
  }

  return false;
}

function includesSmartAccountHints(payload: unknown) {
  if (hasSmartCapabilitySignals(payload)) return true;
  try {
    const str = JSON.stringify(payload).toLowerCase();
    if (!str) return false;
    return (
      str.includes("smart account") ||
      str.includes("smartaccount") ||
      str.includes("eip-7702") ||
      str.includes("7702") ||
      str.includes("delegator") ||
      str.includes("wallet_sendcalls") ||
      str.includes("wallet_sendcalls") ||
      str.includes("wallet_sendcalls_batch") ||
      str.includes("eip7702auth") ||
      str.includes("eip-5792")
    );
  } catch {
    return false;
  }
}

function parseEip7702Delegation(code?: `0x${string}` | null) {
  if (!code || code === "0x") return { isEip7702Delegated: false as const };
  const prefix = code.slice(0, 8).toLowerCase();
  if (prefix === "0xef0100") {
    const implHex = ("0x" + code.slice(8, 8 + 40)) as `0x${string}`;
    if (isHex(implHex) && implHex.length === 42) {
      return {
        isEip7702Delegated: true as const,
        implementation: getAddress(implHex),
      };
    }
    return { isEip7702Delegated: true as const };
  }
  return { isEip7702Delegated: false as const };
}

export async function getSmartAccountStatus(
  params: SmartAccountDetectionParams
): Promise<SmartAccountStatus> {
  const requests = getWalletRequests(params.walletClient);
  const caps = await requestWalletCapabilities({
    address: params.address,
    requests,
  });
  const hasWalletAABatching = includesSmartAccountHints(caps);

  let bytecode: `0x${string}` | null | undefined = undefined;
  try {
    bytecode =
      params.address && params.getBytecode
        ? await params.getBytecode({ address: params.address })
        : undefined;
  } catch {
    bytecode = undefined;
  }

  const isContractWallet = Boolean(bytecode && bytecode !== "0x");
  const parsed = parseEip7702Delegation(bytecode as `0x${string}` | null);

  return {
    isContractWallet,
    isEip7702Delegated: parsed.isEip7702Delegated,
    hasWalletAABatching,
    rawCapabilities: caps ?? undefined,
    eip7702Implementation: (parsed as any).implementation,
  };
}

export function isSmartAccountBlocked(
  status: SmartAccountStatus | null | undefined
): boolean {
  if (!status) return false;
  return (
    status.isContractWallet ||
    status.isEip7702Delegated ||
    status.hasWalletAABatching
  );
}
