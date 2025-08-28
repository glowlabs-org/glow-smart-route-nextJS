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

function getAnyWalletRequest(walletClient: any) {
  const wcAny = walletClient as any;
  if (wcAny?.transport && typeof wcAny.transport.request === "function") {
    return wcAny.transport.request as (args: any) => Promise<any>;
  }
  if (typeof window !== "undefined") {
    const eth: any = (window as any).ethereum;
    if (eth && typeof eth.request === "function") {
      return eth.request.bind(eth) as (args: any) => Promise<any>;
    }
  }
  return undefined;
}

async function requestWalletCapabilities(params: {
  address?: `0x${string}`;
  request?: (args: any) => Promise<any>;
}) {
  const { address, request } = params;
  if (!request) return null;
  try {
    return await request({
      method: "wallet_getCapabilities",
      params: address ? [address] : [],
    });
  } catch {
    try {
      return await request({ method: "wallet_getCapabilities" });
    } catch {
      return null;
    }
  }
}

function includesSmartAccountHints(payload: unknown) {
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
  const request = getAnyWalletRequest(params.walletClient);
  const caps = await requestWalletCapabilities({
    address: params.address,
    request,
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
