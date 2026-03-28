export interface DetectedWallet {
  name: string;
  provider: any;
  isRabby: boolean;
  isMetaMask: boolean;
  isTrustWallet: boolean;
  isPhantom: boolean;
  isCoinbase: boolean;
  isBase: boolean;
}

export function detectWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];

  const wallets: DetectedWallet[] = [];
  const ethereum = (window as any).ethereum;

  if (!ethereum) return [];

  const providers = Array.isArray(ethereum.providers)
    ? ethereum.providers
    : [ethereum];

  providers.forEach((provider: any) => {
    const isRabby = provider.isRabby === true;
    const isMetaMask = provider.isMetaMask === true;
    const isTrustWallet =
      provider.isTrust === true ||
      provider.isTrustWallet === true ||
      provider.isImToken === true;
    const isPhantom = provider.isPhantom === true;
    const isCoinbase = provider.isCoinbaseWallet === true;
    const isBase = provider.isBase === true;

    let name = "Browser Wallet";
    if (isRabby) name = "Rabby";
    else if (isMetaMask) name = "MetaMask";
    else if (isTrustWallet) name = "Trust Wallet";
    else if (isPhantom) name = "Phantom";
    else if (isCoinbase) name = "Coinbase Wallet";
    else if (isBase) name = "Base Wallet";
    else if (provider.info?.name) name = provider.info.name;
    else if (provider.name) name = provider.name;

    wallets.push({
      name,
      provider,
      isRabby,
      isMetaMask,
      isTrustWallet,
      isPhantom,
      isCoinbase,
      isBase,
    });
  });

  return wallets;
}

export function detectWalletFromProvider(provider: any): DetectedWallet | null {
  if (!provider) return null;

  const isRabby = provider.isRabby === true;
  const isMetaMask = provider.isMetaMask === true;
  const isTrustWallet =
    provider.isTrust === true ||
    provider.isTrustWallet === true ||
    provider.isImToken === true;
  const isPhantom = provider.isPhantom === true;
  const isCoinbase = provider.isCoinbaseWallet === true;
  const isBase = provider.isBase === true;

  let name = "Browser Wallet";
  if (isRabby) name = "Rabby";
  else if (isMetaMask) name = "MetaMask";
  else if (isTrustWallet) name = "Trust Wallet";
  else if (isPhantom) name = "Phantom";
  else if (isCoinbase) name = "Coinbase Wallet";
  else if (isBase) name = "Base Wallet";
  else if (provider.info?.name) name = provider.info.name;
  else if (provider.name) name = provider.name;

  return {
    name,
    provider,
    isRabby,
    isMetaMask,
    isTrustWallet,
    isPhantom,
    isCoinbase,
    isBase,
  };
}
