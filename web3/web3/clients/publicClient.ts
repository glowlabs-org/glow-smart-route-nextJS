import { createPublicClient } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { instrumentedHttp } from "@/lib/viem-rpc-logging";

const isSepolia = process.env.NEXT_PUBLIC_CHAIN_ID === "11155111";
const chain = isSepolia ? sepolia : mainnet;

const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const mainnetRpcUrl = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;

const customUrl = isSepolia ? sepoliaRpcUrl : mainnetRpcUrl;

export const publicClient = createPublicClient({
  chain,
  transport: customUrl
    ? instrumentedHttp(customUrl, { timeout: 15_000 }, { source: "publicClient" })
    : instrumentedHttp(undefined, { timeout: 15_000 }, { source: "publicClient" }),
});

export const mainnetPublicClient = createPublicClient({
  chain: mainnet,
  transport: instrumentedHttp(mainnetRpcUrl, { timeout: 15_000 }, { source: "publicClient" }),
});
