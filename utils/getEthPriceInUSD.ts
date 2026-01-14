const ETH_PRICE_CACHE_TTL_MS = 30_000;
const ETH_PRICE_STALE_TTL_MS = 30 * 60_000;

let lastKnownEthPriceUsd:
  | {
      priceUsd: number;
      updatedAtMs: number;
      source: string;
    }
  | null = null;

let inFlight: Promise<number | null> | null = null;

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryFetchEthPriceFromInternalApi(): Promise<number | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetchWithTimeout(
      "/api/eth-price",
      { method: "GET", headers: { Accept: "application/json" } },
      2500
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ethPriceUsd?: unknown };
    const price = Number(json?.ethPriceUsd);
    if (!isFinitePositiveNumber(price)) return null;
    return price;
  } catch {
    return null;
  }
}

async function tryFetchEthPriceFromChainlink(): Promise<number | null> {
  if (typeof window !== "undefined") return null;
  if (!process.env.MAINNET_RPC_URL) return null;

  try {
    const mod = (await import("@/web3/web3/queries/getETHPrice")) as {
      currentEthPriceFloat?: () => Promise<number>;
    };
    if (!mod.currentEthPriceFloat) return null;
    const price = await mod.currentEthPriceFloat();
    if (!isFinitePositiveNumber(price)) return null;
    return price;
  } catch {
    return null;
  }
}

async function tryFetchEthPriceFromRailwayOracle(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      "https://price-oracle-backend-production.up.railway.app/specialized-prices/0x2170ed0880ac9a755fd29b2688956bd959f933f8",
      { method: "GET", headers: { Accept: "application/json" } },
      4000
    );
    if (!res.ok) return null;

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;
    const priceRaw = (data[0] as any)?.price;
    const price = typeof priceRaw === "string" ? Number(priceRaw) : Number(priceRaw);
    if (!isFinitePositiveNumber(price)) return null;
    return price;
  } catch {
    return null;
  }
}

async function tryFetchEthPriceFromCoingecko(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      4000
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ethereum?: { usd?: unknown } };
    const price = Number(json?.ethereum?.usd);
    if (!isFinitePositiveNumber(price)) return null;
    return price;
  } catch {
    return null;
  }
}

async function tryFetchEthPriceFromCoinbase(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.coinbase.com/v2/prices/ETH-USD/spot",
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      4000
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { amount?: unknown } };
    const price = Number(json?.data?.amount);
    if (!isFinitePositiveNumber(price)) return null;
    return price;
  } catch {
    return null;
  }
}

export async function getEthPriceInUSD(): Promise<number | null> {
  const now = Date.now();
  if (
    lastKnownEthPriceUsd &&
    now - lastKnownEthPriceUsd.updatedAtMs <= ETH_PRICE_CACHE_TTL_MS
  )
    return lastKnownEthPriceUsd.priceUsd;

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const cached =
      lastKnownEthPriceUsd &&
      now - lastKnownEthPriceUsd.updatedAtMs <= ETH_PRICE_STALE_TTL_MS
        ? lastKnownEthPriceUsd
        : null;

    // Client: same-origin API first (avoids third-party CORS/outages impacting UI)
    const internal = await tryFetchEthPriceFromInternalApi();
    if (isFinitePositiveNumber(internal)) {
      lastKnownEthPriceUsd = {
        priceUsd: internal,
        updatedAtMs: Date.now(),
        source: "internal-api",
      };
      return internal;
    }

    // Server: on-chain Chainlink is the most robust when RPC is configured.
    const chainlink = await tryFetchEthPriceFromChainlink();
    if (isFinitePositiveNumber(chainlink)) {
      lastKnownEthPriceUsd = {
        priceUsd: chainlink,
        updatedAtMs: Date.now(),
        source: "chainlink",
      };
      return chainlink;
    }

    const railway = await tryFetchEthPriceFromRailwayOracle();
    if (isFinitePositiveNumber(railway)) {
      lastKnownEthPriceUsd = {
        priceUsd: railway,
        updatedAtMs: Date.now(),
        source: "railway-oracle",
      };
      return railway;
    }

    const coingecko = await tryFetchEthPriceFromCoingecko();
    if (isFinitePositiveNumber(coingecko)) {
      lastKnownEthPriceUsd = {
        priceUsd: coingecko,
        updatedAtMs: Date.now(),
        source: "coingecko",
      };
      return coingecko;
    }

    const coinbase = await tryFetchEthPriceFromCoinbase();
    if (isFinitePositiveNumber(coinbase)) {
      lastKnownEthPriceUsd = {
        priceUsd: coinbase,
        updatedAtMs: Date.now(),
        source: "coinbase",
      };
      return coinbase;
    }

    if (cached) return cached.priceUsd;

    console.error(
      "Error fetching ETH price: all providers failed (railway/coingecko/coinbase/chainlink)"
    );
    return null;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
