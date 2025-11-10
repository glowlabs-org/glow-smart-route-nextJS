import { useQuery } from "@tanstack/react-query";

const PONDER_GRAPHQL_URL =
  "https://glow-ponder-listener-2-production.up.railway.app/graphql";

interface GlowBalancesResponse {
  data: {
    glowBalancess: {
      totalCount: number;
    };
  };
}

async function fetchGlowHolderCount(): Promise<number> {
  try {
    const response = await fetch(PONDER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: '{ glowBalancess(where: { balance_gt: "0" }) { totalCount } }',
      }),
    });

    if (!response.ok) {
      console.error("Failed to fetch Glow holder count:", response.statusText);
      return 0;
    }

    const data: GlowBalancesResponse = await response.json();

    if (data?.data?.glowBalancess?.totalCount) {
      const count = parseInt(String(data.data.glowBalancess.totalCount), 10);
      return Number.isNaN(count) ? 0 : count;
    }

    console.error("Unexpected response fetching Glow holder count:", data);
    return 0;
  } catch (error) {
    console.error("Error fetching Glow holder count:", error);
    return 0;
  }
}

interface UseGlowHolderCountOptions {
  enabled?: boolean;
}

export function useGlowHolderCount(
  options: UseGlowHolderCountOptions = {}
) {
  const { enabled = true } = options;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["glowHolderCount"],
    queryFn: fetchGlowHolderCount,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  return {
    holderCount: data ?? 0,
    isLoading,
    isFetching,
    isError,
  };
}

