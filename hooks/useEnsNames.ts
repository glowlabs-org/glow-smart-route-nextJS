import { useQuery } from "@tanstack/react-query";

async function fetchEnsNames(
  addresses: string[]
): Promise<Record<string, string | null>> {
  try {
    const response = await fetch("/api/ens-names", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addresses }),
    });

    if (!response.ok) {
      console.error("Failed to fetch ENS names:", response.statusText);
      return addresses.reduce((acc, addr) => {
        acc[addr] = null;
        return acc;
      }, {} as Record<string, string | null>);
    }

    const data = await response.json();
    return data.ensNames || {};
  } catch (error) {
    console.error("Error fetching ENS names:", error);
    return addresses.reduce((acc, addr) => {
      acc[addr] = null;
      return acc;
    }, {} as Record<string, string | null>);
  }
}

interface UseEnsNamesOptions {
  addresses: string[];
  enabled?: boolean;
}

export function useEnsNames({ addresses, enabled = true }: UseEnsNamesOptions) {
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["ensNames", addresses.sort().join(",")],
    queryFn: () => fetchEnsNames(addresses),
    enabled: enabled && addresses.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return {
    ensNames: data ?? {},
    isLoading,
    isFetching,
    isError,
  };
}
