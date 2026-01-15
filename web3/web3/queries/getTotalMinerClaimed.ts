interface TotalMinerClaimedResponse {
  data: {
    totalGlowPayouts: {
      totalGlowPayouts: string;
    };
  };
}

export async function getTotalMinerClaimed(): Promise<TotalMinerClaimedResponse> {
  let response: Response;
  try {
    response = await fetch("/api/miner-claimed");
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  try {
    return (await response.json()) as TotalMinerClaimedResponse;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}
