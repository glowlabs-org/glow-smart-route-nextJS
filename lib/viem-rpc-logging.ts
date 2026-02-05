import * as Sentry from "@sentry/nextjs";
import { http } from "viem";

type InstrumentedOptions = {
  source: string;
};

const MAX_SERIALIZED_LENGTH = 2000;

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
    return parsed.toString();
  } catch (error) {
    return url;
  }
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

  const extra = {
    rpc_method: context.method,
    rpc_params: safeSerialize(context.params),
    rpc_chain_id: context.chainId ?? null,
    rpc_url: maskRpcUrl(context.url),
    rpc_source: context.source ?? null,
    error_name: errorAny?.name ?? errorObject.name,
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
