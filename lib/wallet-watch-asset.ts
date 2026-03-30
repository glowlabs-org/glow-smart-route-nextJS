import { SDKAddresses } from "@/web3/constants/addresses";

export interface WalletWatchAssetOptions {
  address: `0x${string}`;
  decimals: number;
  image?: string;
  symbol: string;
}

interface WalletWatchAssetProvider {
  request(args: {
    method: "wallet_watchAsset";
    params: {
      options: WalletWatchAssetOptions;
      type: "ERC20";
    };
  }): Promise<boolean>;
}

export const GLW_WALLET_ASSET: WalletWatchAssetOptions = {
  address: SDKAddresses.GLW,
  decimals: 18,
  // MetaMask validates the requested symbol against the ERC-20 contract symbol.
  symbol: "GLW-BETA",
};

export function getGlwWalletAssetImageUrl(origin: string) {
  return new URL("/Chrome_192x192.png", origin).toString();
}

export function buildGlwWalletWatchAssetParams(image?: string) {
  return {
    type: "ERC20" as const,
    options: {
      ...GLW_WALLET_ASSET,
      ...(image ? { image } : {}),
    },
  };
}

function getWalletWatchAssetProvider(): WalletWatchAssetProvider | null {
  if (typeof window === "undefined") return null;

  const candidate = (
    window as Window & { ethereum?: WalletWatchAssetProvider }
  ).ethereum;

  if (!candidate || typeof candidate.request !== "function") {
    return null;
  }

  return candidate;
}

export async function addGlwToWallet() {
  const provider = getWalletWatchAssetProvider();

  if (!provider) {
    throw new Error("No compatible wallet was detected.");
  }

  const image =
    typeof window === "undefined"
      ? undefined
      : getGlwWalletAssetImageUrl(window.location.origin);

  return provider.request({
    method: "wallet_watchAsset",
    params: buildGlwWalletWatchAssetParams(image),
  });
}
