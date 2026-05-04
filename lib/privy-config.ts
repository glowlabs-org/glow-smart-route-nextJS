"use client";

import type { PrivyClientConfig } from "@privy-io/react-auth";
import { mainnet, sepolia } from "wagmi/chains";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_ID ?? "";

if (!PRIVY_APP_ID) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set");

export { PRIVY_APP_ID };

const activeChain = process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? mainnet : sepolia;

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["wallet"],
  embeddedWallets: {
    ethereum: {
      createOnLogin: "off",
    },
    showWalletUIs: false,
  },
  appearance: {
    theme: "dark",
    walletList: [
      "metamask",
      "rabby_wallet",
      "phantom",
      "coinbase_wallet",
      "wallet_connect",
    ],
    showWalletLoginFirst: true,
  },
  externalWallets: {
    walletConnect: {
      enabled: true,
    },
  },
  walletConnectCloudProjectId: WALLET_CONNECT_PROJECT_ID,
  defaultChain: activeChain,
  supportedChains: [activeChain],
};
