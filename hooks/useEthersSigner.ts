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
  const walletClientAddress = walletClient?.account?.address;
  const walletClientChainId = (walletClient as any)?.chain?.id;
  const walletClientTransportKey = (walletClient as any)?.transport?.config?.key;
  const walletClientTransportName = (walletClient as any)?.transport?.config?.name;
  const walletClientTransportType = (walletClient as any)?.transport?.config?.type;
  const [signer, setSigner] = React.useState<JsonRpcSigner | undefined>(
    undefined
  );
  const [signerAddress, setSignerAddress] = React.useState<string | undefined>(
    undefined
  );
  const [isSignerLoading, setIsSignerLoading] = React.useState(true);
  const expectedAddress = walletClientAddress?.toLowerCase();

  React.useEffect(() => {
    let isMounted = true;
    async function computeSigner() {
      if (!walletClient || !expectedAddress) {
        if (isMounted) {
          setSigner(undefined);
          setSignerAddress(undefined);
          setIsSignerLoading(false);
        }
        return;
      }

      setIsSignerLoading(true);
      // Clear stale signer immediately so callers cannot sign with a previous account.
      setSigner(undefined);
      setSignerAddress(undefined);
      try {
        const s = await walletClientToSigner(walletClient as WalletClient);
        const resolvedAddress = (await s.getAddress()).toLowerCase();
        if (isMounted) {
          setSigner(s);
          setSignerAddress(resolvedAddress);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setSigner(undefined);
          setSignerAddress(undefined);
        }
      } finally {
        if (isMounted) setIsSignerLoading(false);
      }
    }
    computeSigner();
    return () => {
      isMounted = false;
    };
  }, [
    walletClient,
    walletClientChainId,
    walletClientAddress,
    walletClientTransportKey,
    walletClientTransportName,
    walletClientTransportType,
    expectedAddress,
  ]);

  const isSignerSyncedWithWallet =
    !!signer && !!expectedAddress && signerAddress === expectedAddress;

  return {
    signer: isSignerSyncedWithWallet ? signer : undefined,
    isLoading:
      isWalletClientLoading ||
      isSignerLoading ||
      (!!walletClient && !!expectedAddress && !isSignerSyncedWithWallet),
  };
}
