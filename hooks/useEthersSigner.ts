import { useWalletClient } from "wagmi";
import React from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import type { WalletClient } from "viem";

async function walletClientToSigner(
  walletClient: WalletClient
): Promise<JsonRpcSigner> {
  const { account, chain, transport } = walletClient as unknown as any;
  const provider = new BrowserProvider(transport as any);
  return provider.getSigner(account?.address);
}

/** Hook to convert a viem Wallet Client to an ethers v6 Signer. */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: walletClient, isLoading: isWalletClientLoading } =
    useWalletClient({ chainId });
  const [signer, setSigner] = React.useState<JsonRpcSigner | undefined>(
    undefined
  );
  const [isSignerLoading, setIsSignerLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    async function computeSigner() {
      if (!walletClient) {
        if (isMounted) {
          setSigner(undefined);
          setIsSignerLoading(false);
        }
        return;
      }

      setIsSignerLoading(true);
      try {
        const s = await walletClientToSigner(walletClient as WalletClient);
        if (isMounted) setSigner(s);
      } catch (err) {
        console.error(err);
        if (isMounted) setSigner(undefined);
      } finally {
        if (isMounted) setIsSignerLoading(false);
      }
    }
    computeSigner();
    return () => {
      isMounted = false;
    };
  }, [
    (walletClient as any)?.chain?.id,
    walletClient?.account?.address,
    (walletClient as any)?.transport?.config?.key,
    (walletClient as any)?.transport?.config?.name,
    (walletClient as any)?.transport?.config?.type,
  ]);

  return {
    signer,
    isLoading: isWalletClientLoading || isSignerLoading,
  };
}
