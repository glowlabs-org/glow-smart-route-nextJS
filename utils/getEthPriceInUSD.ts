export async function getEthPriceInUSD(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      "https://price-oracle-backend-production.up.railway.app/specialized-prices/0x2170ed0880ac9a755fd29b2688956bd959f933f8",
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || !data[0]?.price) {
      throw new Error("Invalid response format");
    }

    const ethPriceInUSD = parseFloat(data[0].price);
    return ethPriceInUSD;
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    return null;
  }
}
