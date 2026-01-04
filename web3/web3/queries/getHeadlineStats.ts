export async function getHeadlineStats() {
  try {
    const res = await fetch("/api/headline-stats");
    if (!res.ok) throw new Error("No data returned from API", { cause: res });
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== "object")
      throw new Error("Invalid data returned from API");
    return data as any;
  } catch (error) {
    console.error("Error fetching headline stats", error);
    throw error;
  }
}
