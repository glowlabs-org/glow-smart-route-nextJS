import * as Sentry from "@sentry/nextjs";
import { fallback, http } from "viem";

type InstrumentedOptions = {
  source: string;
};

const MAX_SERIALIZED_LENGTH = 2000;
const DEDUP_WINDOW_MS = 20_000;
const DEDUP_MAX_ENTRIES = 200;
const dedupCache = new Map<string, number>();

const safeSerialize = (value: unknown) => {
  if (value == null) return null;
  try {
    const json = JSON.stringify(
      value,
      (_key, val) => (typeof val === "bigint" ? val.toString() : val),
      0
    );
    if (json.length <= MAX_SERIALIZED_LENGTH) return json;
    return `${json.slice(0, MAX_SERIALIZED_LENGTH)}... (truncated)`;
  } catch (error) {
    const fallback = String(value);
    if (fallback.length <= MAX_SERIALIZED_LENGTH) return fallback;
    return `${fallback.slice(0, MAX_SERIALIZED_LENGTH)}... (truncated)`;
  }
};

const maskRpcUrl = (url?: string) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const maskedParts = parts.map((part, index) => {
      if (index === parts.length - 1 && part.length > 8) {
        return `${part.slice(0, 4)}...${part.slice(-4)}`;
      }
      return part;
    });
    parsed.pathname = `/${maskedParts.join("/")}`;
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch (error) {
    return url;
  }
};

const shouldReportRpcError = (error: unknown, source?: string): boolean => {
  const errorAny = error as any;
  const name = errorAny?.name ?? "";
  const causeName = errorAny?.cause?.name ?? "";
  const details = typeof errorAny?.details === "string" ? errorAny.details : "";

  if (name === "AbortError" || causeName === "AbortError") return false;
  if (details.includes("Fetch is aborted")) return false;

  // publicClient is background read-only polling that callers already
  // retry/swallow. Per-visitor network blips would just create noise.
  if (
    source === "publicClient" &&
    (name === "TimeoutError" || causeName === "TimeoutError")
  ) {
    return false;
  }

  return true;
};

const shouldReportOnce = (method: string, errorName: string): boolean => {
  const now = Date.now();
  const key = `${method}:${errorName}`;
  const lastReportedAt = dedupCache.get(key);
  if (lastReportedAt && now - lastReportedAt < DEDUP_WINDOW_MS) {
    return false;
  }
  dedupCache.set(key, now);
  if (dedupCache.size > DEDUP_MAX_ENTRIES) {
    for (const [cacheKey, timestamp] of dedupCache.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS * 2) {
        dedupCache.delete(cacheKey);
      }
    }
  }
  return true;
};

const captureRpcError = (error: unknown, context: {
  method: string;
  params?: unknown;
  chainId?: number;
  url?: string;
  source?: string;
}) => {
  const errorObject = error instanceof Error ? error : new Error(String(error));
  const errorAny = error as any;

  if (!shouldReportRpcError(error, context.source)) return;

  const errorName = errorAny?.name ?? errorObject.name ?? "Error";
  if (!shouldReportOnce(context.method, errorName)) return;

  const extra = {
    rpc_method: context.method,
    rpc_params: safeSerialize(context.params),
    rpc_chain_id: context.chainId ?? null,
    rpc_url: maskRpcUrl(context.url),
    rpc_source: context.source ?? null,
    error_name: errorName,
    error_message: errorAny?.message ?? errorObject.message,
    error_code: errorAny?.code ?? null,
    error_status: errorAny?.status ?? null,
    error_details: errorAny?.details ?? null,
    error_meta: safeSerialize(errorAny?.metaMessages),
    error_cause: safeSerialize(errorAny?.cause),
  };

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[rpc] request failed", extra);
  }

  Sentry.captureException(errorObject, {
    tags: {
      rpc_method: context.method,
      rpc_chain_id: context.chainId ? String(context.chainId) : "unknown",
      rpc_source: context.source ?? "unknown",
    },
    extra,
  });
};

type HttpUrl = Parameters<typeof http>[0];
type HttpConfig = Parameters<typeof http>[1];

export const instrumentedHttp = (
  url?: HttpUrl,
  config?: HttpConfig,
  options?: InstrumentedOptions
) => {
  const base = http(url, config);
  return (params: Parameters<typeof base>[0]) => {
    const transport = base(params);
    const chainId = params.chain?.id;
    const rpcUrl = transport.value?.url ?? url;

    // Use try/catch to preserve the generic return type of transport.request.
    const request: typeof transport.request = async (
      requestParams,
      requestOptions
    ) => {
      try {
        return await transport.request(requestParams, requestOptions);
      } catch (error) {
        captureRpcError(error, {
          method: requestParams.method,
          params: requestParams.params,
          chainId,
          url: typeof rpcUrl === "string" ? rpcUrl : undefined,
          source: options?.source,
        });
        throw error;
      }
    };

    return {
      ...transport,
      request,
    };
  };
};

export const instrumentedFallback = (
  urls: string[],
  config?: HttpConfig,
  options?: InstrumentedOptions
) => {
  const validUrls = urls.filter(u => typeof u === "string" && u.length > 0);
  if (validUrls.length === 0) {
    throw new Error("instrumentedFallback requires at least one URL");
  }

  const base = fallback(validUrls.map(url => http(url, config)));

  return (params: Parameters<typeof base>[0]) => {
    const transport = base(params);
    const chainId = params.chain?.id;

    const request: typeof transport.request = async (
      requestParams,
      requestOptions
    ) => {
      try {
        return await transport.request(requestParams, requestOptions);
      } catch (error) {
        captureRpcError(error, {
          method: requestParams.method,
          params: requestParams.params,
          chainId,
          url: validUrls[0],
          source: options?.source,
        });
        throw error;
      }
    };

    return {
      ...transport,
      request,
    };
  };
};
