import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";

const isSepolia = process.env.NEXT_PUBLIC_CHAIN_ID === "11155111";
const chain = isSepolia ? sepolia : mainnet;

const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const mainnetRpcUrl = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;

const customUrl = isSepolia ? sepoliaRpcUrl : mainnetRpcUrl;

export const publicClient = createPublicClient({
  chain,
  transport: customUrl
    ? http(customUrl, { timeout: 15_000 })
    : http(undefined, { timeout: 15_000 }),
});
