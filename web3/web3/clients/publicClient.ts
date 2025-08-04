import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";
let chain;
if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") {
  chain = sepolia;
} else {
  chain = mainnet;
}

export const publicClient = createPublicClient({
  chain: chain,
  transport: http(),
});
