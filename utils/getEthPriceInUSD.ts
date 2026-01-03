export async function getEthPriceInUSD(): Promise<number | null> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const data = await response.json();
    const ethPriceInUSD = data.ethereum.usd;
    return ethPriceInUSD;
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    return null;
  }
}
