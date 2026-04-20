import { createPublicClient } from "viem";
import { mainnet, sepolia } from "viem/chains";
import {
  instrumentedFallback,
  instrumentedHttp,
} from "@/lib/viem-rpc-logging";

const isSepolia = process.env.NEXT_PUBLIC_CHAIN_ID === "11155111";
const chain = isSepolia ? sepolia : mainnet;

const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const mainnetRpcUrl = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
const mainnetRpcFallbackUrl =
  process.env.NEXT_PUBLIC_MAINNET_RPC_FALLBACK_URL ?? "";
const mainnetRpcBackupUrls = (
  process.env.NEXT_PUBLIC_MAINNET_RPC_BACKUP_URLS ?? ""
)
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const mainnetRpcUrls = [
  mainnetRpcUrl ?? "",
  mainnetRpcFallbackUrl,
  ...mainnetRpcBackupUrls,
].filter(Boolean);

const mainnetFallbackTransport = () =>
  instrumentedFallback(
    mainnetRpcUrls,
    { timeout: 15_000 },
    { source: "publicClient" }
  );

export const publicClient = createPublicClient({
  chain,
  transport: isSepolia
    ? instrumentedHttp(
        sepoliaRpcUrl,
        { timeout: 15_000 },
        { source: "publicClient" }
      )
    : mainnetFallbackTransport(),
});

export const mainnetPublicClient = createPublicClient({
  chain: mainnet,
  transport: mainnetFallbackTransport(),
});
