import { getAddress, type Address, type WalletClient } from "viem";
import { mainnet, sepolia } from "viem/chains";

export function getExpectedChainId(): number {
  return Number(process.env.NEXT_PUBLIC_CHAIN_ID) || mainnet.id;
}

export function getExpectedChain() {
  return getExpectedChainId() === sepolia.id ? sepolia : mainnet;
}

export function assertWalletClientOnExpectedChain(
  walletClient: WalletClient,
): void {
  const expectedChainId = getExpectedChainId();
  const walletChainId = walletClient.chain?.id;

  if (walletChainId !== expectedChainId) {
    const connectedLabel = walletChainId ? `chain ${walletChainId}` : "an unknown chain";
    throw new Error(
      `Wrong network: wallet is connected to ${connectedLabel}; expected chain ${expectedChainId}.`,
    );
  }
}

export function assertWalletClientAccount(
  walletClient: WalletClient,
  expectedAccount: Address,
): void {
  const walletAccount = walletClient.account?.address;
  if (
    !walletAccount ||
    getAddress(walletAccount) !== getAddress(expectedAccount)
  ) {
    throw new Error(
      `Wallet account changed during this order. Expected ${getAddress(expectedAccount)}.`,
    );
  }
}

export async function assertWalletClientForOrder(
  walletClient: WalletClient,
  expectedAccount?: Address,
): Promise<void> {
  assertWalletClientOnExpectedChain(walletClient);
  if (expectedAccount) {
    assertWalletClientAccount(walletClient, expectedAccount);
  }

  const [activeChainId, activeAddresses] = await Promise.all([
    walletClient.getChainId(),
    expectedAccount ? walletClient.getAddresses() : Promise.resolve(undefined),
  ]);
  const expectedChainId = getExpectedChainId();
  if (activeChainId !== expectedChainId) {
    throw new Error(
      `Wrong network: wallet is connected to chain ${activeChainId}; expected chain ${expectedChainId}.`,
    );
  }

  if (expectedAccount) {
    const activeAccount = activeAddresses?.[0];
    if (
      !activeAccount ||
      getAddress(activeAccount) !== getAddress(expectedAccount)
    ) {
      throw new Error(
        `Wallet account changed during this order. Expected ${getAddress(expectedAccount)}.`,
      );
    }
  }
}
