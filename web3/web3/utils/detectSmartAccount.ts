import { isHex, getAddress, numberToHex, type Address } from "viem";

export interface SmartAccountDetectionParams {
  address?: `0x${string}`;
  chainId?: number;
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

export interface SmartAccountPreflight {
  address: Address;
  chainId?: number;
  checkedAt: number;
  status: SmartAccountStatus;
}

export const SMART_ACCOUNT_PREFLIGHT_MAX_AGE_MS = 60_000;

export const SMART_ACCOUNT_UNSUPPORTED_MESSAGE =
  "Smart account mode is enabled for this wallet. This swap flow requires a regular account (EOA). Disable Smart Account in MetaMask and try again.";

function getWalletRequest(walletClient: any) {
  const wcAny = walletClient as any;
  if (wcAny?.transport && typeof wcAny.transport.request === "function") {
    return wcAny.transport.request.bind(wcAny.transport) as (
      args: any,
    ) => Promise<any>;
  }
  if (typeof window !== "undefined") {
    const eth: any = (window as any).ethereum;
    if (eth && typeof eth.request === "function") {
      return eth.request.bind(eth) as (args: any) => Promise<any>;
    }
  }
  return null;
}

async function requestWalletCapabilities(params: {
  address?: `0x${string}`;
  chainId?: number;
  request: ((args: any) => Promise<any>) | null;
}) {
  const { address, chainId, request } = params;
  if (!request) return null;

  try {
    const capabilityParams = address
      ? chainId === undefined
        ? [address]
        : [address, [numberToHex(chainId)]]
      : [];
    return await request({
      method: "wallet_getCapabilities",
      params: capabilityParams,
    });
  } catch {
    // Capability discovery is a best-effort guard. Do not fan out duplicate
    // requests to the same injected provider when a wallet does not support it.
    return null;
  }
}

const CHAIN_ID_KEY_PATTERN = /^(0x[0-9a-f]+|\d+)$/i;
const SMART_ACCOUNT_KEY_HINTS = [
  "smartaccount",
  "accountabstraction",
  "walletsendcalls",
  "sendcalls",
  "paymaster",
  "bundler",
  "sponsor",
  "eip5792",
  "eip7702",
  "atomic",
] as const;
const EXPLICITLY_ENABLED_STATUSES = new Set([
  "enabled",
  "active",
  "required",
  "enforced",
  "on",
  "true",
]);

function normalizeStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

function parseChainIdKey(value: string): number | null {
  if (!CHAIN_ID_KEY_PATTERN.test(value)) return null;
  const parsed = value.startsWith("0x")
    ? Number.parseInt(value, 16)
    : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickCapabilityScopes(payload: unknown, chainId?: number): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const chainScopes = Object.entries(root).filter(
    ([key, value]) =>
      parseChainIdKey(key) !== null &&
      Boolean(value) &&
      typeof value === "object"
  );

  if (!chainScopes.length) return [payload];
  if (chainId === undefined) return chainScopes.map(([, value]) => value);

  return chainScopes
    .filter(([key]) => parseChainIdKey(key) === chainId)
    .map(([, value]) => value);
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSmartAccountHintKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SMART_ACCOUNT_KEY_HINTS.some((hint) => normalized.includes(hint));
}

function hasExplicitEnabledSignal(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object" || depth > 3) return false;
  const record = value as Record<string, unknown>;

  const booleanEnableKeys = [
    "enabled",
    "isEnabled",
    "active",
    "isActive",
    "required",
    "enforced",
    "atomicRequired",
  ];
  for (const key of booleanEnableKeys) {
    if (record[key] === true) return true;
  }

  const statusKeys = ["status", "state", "mode"];
  for (const key of statusKeys) {
    const status = normalizeStatus(record[key]);
    if (status && EXPLICITLY_ENABLED_STATUSES.has(status)) {
      return true;
    }
  }

  for (const nestedValue of Object.values(record)) {
    if (hasExplicitEnabledSignal(nestedValue, depth + 1)) return true;
  }

  return false;
}

function shouldTrustPrimitiveEnabledSignal(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    normalized.includes("enabled") ||
    normalized.includes("active") ||
    normalized.includes("required") ||
    normalized.includes("enforced")
  );
}

function hasSmartCapabilitySignals(payload: unknown, chainId?: number): boolean {
  const scopes = pickCapabilityScopes(payload, chainId);
  if (!scopes.length) return false;

  for (const scope of scopes) {
    if (!scope || typeof scope !== "object") continue;
    const seen = new Set<object>();
    const stack: Array<{ key: string; value: unknown }> = Object.entries(
      scope as Record<string, unknown>
    ).map(([key, value]) => ({ key, value }));

    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;

      const { key, value } = current;
      if (isSmartAccountHintKey(key)) {
        if (
          shouldTrustPrimitiveEnabledSignal(key) &&
          (value === true || normalizeStatus(value) === "true")
        ) {
          return true;
        }
        if (hasExplicitEnabledSignal(value)) return true;
      }

      if (!value || typeof value !== "object") continue;
      const valueObj = value as object;
      if (seen.has(valueObj)) continue;
      seen.add(valueObj);

      for (const [nestedKey, nestedValue] of Object.entries(
        value as Record<string, unknown>
      )) {
        stack.push({
          key: `${key}.${nestedKey}`,
          value: nestedValue,
        });
      }
    }
  }

  return false;
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
  const request = getWalletRequest(params.walletClient);
  const capabilitiesPromise = requestWalletCapabilities({
    address: params.address,
    chainId: params.chainId,
    request,
  });
  const bytecodePromise = (async () => {
    try {
      return params.address && params.getBytecode
        ? await params.getBytecode({ address: params.address })
        : undefined;
    } catch {
      return undefined;
    }
  })();

  const [caps, bytecode] = await Promise.all([
    capabilitiesPromise,
    bytecodePromise,
  ]);
  const hasWalletAABatching = hasSmartCapabilitySignals(caps, params.chainId);

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

export async function getSmartAccountPreflight(
  params: SmartAccountDetectionParams & { address: Address },
): Promise<SmartAccountPreflight> {
  const address = getAddress(params.address);
  const status = await getSmartAccountStatus({ ...params, address });
  return {
    address,
    chainId: params.chainId,
    checkedAt: Date.now(),
    status,
  };
}

export function isSmartAccountPreflightReusable(params: {
  preflight?: SmartAccountPreflight | null;
  address: Address;
  chainId?: number;
  now?: number;
  maxAgeMs?: number;
}): boolean {
  const {
    preflight,
    address,
    chainId,
    now = Date.now(),
    maxAgeMs = SMART_ACCOUNT_PREFLIGHT_MAX_AGE_MS,
  } = params;
  if (!preflight) return false;

  return (
    getAddress(preflight.address) === getAddress(address) &&
    preflight.chainId === chainId &&
    now >= preflight.checkedAt &&
    now - preflight.checkedAt <= maxAgeMs
  );
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
