import type { Hash, WalletClient } from "viem";
import { writeContract } from "viem/actions";

export const WALLET_RESPONSE_TIMEOUT_MS = 45_000;

const WALLET_SEND_METHODS = new Set([
  "eth_sendTransaction",
  "wallet_sendTransaction",
]);

export type WalletRequestLifecyclePhase =
  | "dispatched"
  | "resolved"
  | "rejected"
  | "timed_out";

export interface WalletRequestLifecycleEvent {
  phase: WalletRequestLifecyclePhase;
  method: string;
  requestId: string;
  action?: string;
  at: number;
  elapsedMs: number;
}

export interface WalletRequestObserver {
  onEvent?: (event: WalletRequestLifecycleEvent) => void;
  timeoutMs?: number;
}

export interface WalletWriteInstrumentation extends WalletRequestObserver {
  action: string;
}

export interface WalletProviderRequest {
  method: string;
  params?: unknown;
}

export type WalletProviderRequestFn = (
  request: WalletProviderRequest,
  options?: { retryCount?: number },
) => Promise<unknown>;

let nextWalletRequestId = 0;

function createWalletRequestId(): string {
  nextWalletRequestId = (nextWalletRequestId + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${nextWalletRequestId.toString(36)}`;
}

function isWalletSendMethod(method: string): boolean {
  return WALLET_SEND_METHODS.has(method);
}

export class WalletResponseTimeoutError extends Error {
  readonly code = "WALLET_RESPONSE_TIMEOUT";
  readonly method: string;
  readonly requestId: string;

  constructor(method: string, requestId: string) {
    super(
      "Wallet response timed out. The request may still be queued in your wallet.",
    );
    this.name = "WalletResponseTimeoutError";
    this.method = method;
    this.requestId = requestId;
  }
}

/**
 * Observes the exact provider boundary for wallet transaction requests.
 * Timing out only stops this app from waiting; it cannot cancel a request that
 * MetaMask has already queued, so this helper deliberately never retries it.
 */
export async function requestWithWalletLifecycle(
  request: WalletProviderRequestFn,
  args: WalletProviderRequest,
  instrumentation?: WalletWriteInstrumentation,
): Promise<unknown> {
  if (!isWalletSendMethod(args.method)) {
    return request(args);
  }

  const requestId = createWalletRequestId();
  const startedAt = Date.now();
  const emit = (phase: WalletRequestLifecyclePhase) => {
    instrumentation?.onEvent?.({
      phase,
      method: args.method,
      requestId,
      action: instrumentation.action,
      at: Date.now(),
      elapsedMs: Date.now() - startedAt,
    });
  };

  // This event is intentionally emitted immediately before the provider call.
  // If an operation guard throws here, the wallet request is not dispatched.
  emit("dispatched");

  const timeoutMs =
    instrumentation?.timeoutMs ?? WALLET_RESPONSE_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (
      phase: Exclude<WalletRequestLifecyclePhase, "dispatched">,
      callback: () => void,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        emit(phase);
        callback();
      } catch (error) {
        reject(error);
      }
    };

    const timeout = setTimeout(() => {
      finish("timed_out", () => {
        reject(new WalletResponseTimeoutError(args.method, requestId));
      });
    }, timeoutMs);

    // retryCount: 0 prevents the RPC transport from ever replaying a wallet
    // send after the provider has received it.
    try {
      void request(args, { retryCount: 0 }).then(
        (result) => finish("resolved", () => resolve(result)),
        (error) => finish("rejected", () => reject(error)),
      );
    } catch (error) {
      finish("rejected", () => reject(error));
    }
  });
}

export function withWalletRequestAction(
  observer: WalletRequestObserver | undefined,
  action: string,
): WalletWriteInstrumentation {
  return {
    action,
    onEvent: observer?.onEvent,
    timeoutMs: observer?.timeoutMs,
  };
}

/**
 * Runs viem's write action against a client whose request method is observed.
 * The wrapper is local to this write and does not mutate the shared wagmi
 * client or expose transaction parameters to telemetry.
 */
export async function writeContractWithWalletLifecycle(
  walletClient: WalletClient,
  parameters: any,
  instrumentation: WalletWriteInstrumentation,
): Promise<Hash> {
  if (typeof walletClient.request !== "function") {
    const fallbackWrite = walletClient.writeContract?.bind(walletClient);
    if (!fallbackWrite) throw new Error("Wallet client cannot send transactions");
    return (await requestWithWalletLifecycle(
      () => fallbackWrite(parameters),
      { method: "eth_sendTransaction" },
      instrumentation,
    )) as Hash;
  }

  const originalRequest = walletClient.request.bind(walletClient) as unknown as
    WalletProviderRequestFn;
  const instrumentedClient = new Proxy(walletClient, {
    get(target, property, receiver) {
      if (property === "request") {
        return (args: WalletProviderRequest) =>
          requestWithWalletLifecycle(
            originalRequest,
            args,
            instrumentation,
          );
      }
      // writeContract's tree-shakable action otherwise discovers the wallet
      // client's pre-bound sendTransaction method, whose closure references the
      // original client and would bypass the request proxy above.
      if (property === "sendTransaction") return undefined;
      return Reflect.get(target, property, receiver);
    },
  });

  return (await writeContract(
    instrumentedClient as WalletClient,
    parameters,
  )) as Hash;
}
