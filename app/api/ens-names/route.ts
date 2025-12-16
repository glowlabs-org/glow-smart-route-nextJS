import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, namehash, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { trackServerEvent } from "@/lib/telemetry-server";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.MAINNET_RPC_URL),
});

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

interface CacheEntry {
  name: string | null;
  timestamp: number;
}

const ensCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

const ENS_REGISTRY_ABI = [
  {
    inputs: [{ name: "node", type: "bytes32" }],
    name: "resolver",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const RESOLVER_ABI = [
  {
    inputs: [{ name: "node", type: "bytes32" }],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function getCachedEnsName(address: string): string | null | undefined {
  const cached = ensCache.get(address.toLowerCase());
  if (!cached) return undefined;

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
  if (isExpired) {
    ensCache.delete(address.toLowerCase());
    return undefined;
  }

  return cached.name;
}

function setCachedEnsName(address: string, name: string | null): void {
  ensCache.set(address.toLowerCase(), {
    name,
    timestamp: Date.now(),
  });
}

async function batchLookupWithMulticall(addresses: string[]) {
  const results: Record<string, string | null> = {};
  const uncachedAddresses: string[] = [];

  for (const addr of addresses) {
    if (
      !isAddress(addr) ||
      addr === "0x0000000000000000000000000000000000000000"
    ) {
      results[addr] = null;
      continue;
    }

    const cached = getCachedEnsName(addr);
    if (cached !== undefined) {
      results[addr] = cached;
    } else {
      uncachedAddresses.push(addr);
    }
  }

  if (uncachedAddresses.length === 0) {
    return results;
  }

  const nodes = uncachedAddresses.map((addr) => {
    const reverse = `${addr.toLowerCase().replace(/^0x/, "")}.addr.reverse`;
    return namehash(reverse);
  });

  const resolverCalls = nodes.map((node) => ({
    address: ENS_REGISTRY as `0x${string}`,
    abi: ENS_REGISTRY_ABI,
    functionName: "resolver" as const,
    args: [node],
  }));

  const resolverAddresses = await publicClient.multicall({
    contracts: resolverCalls,
    allowFailure: true,
  });

  const nameCalls = resolverAddresses.map((result, i) => {
    if (
      result.status === "success" &&
      result.result &&
      result.result !== "0x0000000000000000000000000000000000000000"
    ) {
      return {
        address: result.result as `0x${string}`,
        abi: RESOLVER_ABI,
        functionName: "name" as const,
        args: [nodes[i]],
      };
    }
    return null;
  });

  const nameResults = await publicClient.multicall({
    contracts: nameCalls.map((call) =>
      call
        ? call
        : {
            address:
              "0x0000000000000000000000000000000000000000" as `0x${string}`,
            abi: RESOLVER_ABI,
            functionName: "name" as const,
            args: [
              "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
            ],
          }
    ),
    allowFailure: true,
  });

  const verifiedNames = await Promise.all(
    uncachedAddresses.map(async (addr, i) => {
      const nameResult = nameResults[i];
      if (
        !nameCalls[i] ||
        nameResult.status === "failure" ||
        !nameResult.result
      ) {
        return null;
      }

      const name = nameResult.result as string;
      if (!name) return null;

      try {
        const resolved = await publicClient.getEnsAddress({ name });
        if (resolved && resolved.toLowerCase() === addr.toLowerCase()) {
          return name;
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  uncachedAddresses.forEach((addr, i) => {
    const name = verifiedNames[i];
    setCachedEnsName(addr, name);
    results[addr] = name;
  });

  return results;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const { addresses } = body;

    if (!addresses || !Array.isArray(addresses)) {
      await trackServerEvent("api_ens_names_invalid", {
        duration_ms: Date.now() - startedAt,
        reason: "addresses_array_required",
      });
      return NextResponse.json(
        { error: "Invalid request, addresses array required" },
        { status: 400 }
      );
    }

    if (addresses.length === 0) {
      await trackServerEvent("api_ens_names_success", {
        duration_ms: Date.now() - startedAt,
        addresses_count: 0,
        ens_found_count: 0,
      });
      return NextResponse.json({ ensNames: {} });
    }

    await trackServerEvent("api_ens_names_request", {
      addresses_count: addresses.length,
    });
    const ensNames = await batchLookupWithMulticall(addresses);
    const ensFoundCount = Object.values(ensNames).filter(Boolean).length;

    await trackServerEvent("api_ens_names_success", {
      duration_ms: Date.now() - startedAt,
      addresses_count: addresses.length,
      ens_found_count: ensFoundCount,
    });

    return NextResponse.json({ ensNames });
  } catch (error) {
    console.error("Error in ENS API route:", error);
    await trackServerEvent("api_ens_names_error", {
      duration_ms: Date.now() - startedAt,
      error_name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to fetch ENS names" },
      { status: 500 }
    );
  }
}
