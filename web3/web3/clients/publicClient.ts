import { createPublicClient, type PublicClient } from "viem";
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

// Receipt polling needs to round-robin across all configured RPCs because
// viem's fallback transport only advances to the next URL on error, not on
// a null `getTransactionReceipt` result. With a single fallback transport,
// if Alchemy says "no receipt yet" we never ask Infura. Per-URL clients let
// the wait helper try each one explicitly on every poll cycle.
let cachedReceiptClients: PublicClient[] | null = null;

export function getReceiptPollingClients(): PublicClient[] {
  if (cachedReceiptClients) return cachedReceiptClients;

  const urls = isSepolia
    ? [sepoliaRpcUrl].filter((u): u is string => typeof u === "string" && u.length > 0)
    : mainnetRpcUrls;

  if (urls.length === 0) {
    cachedReceiptClients = [publicClient];
    return cachedReceiptClients;
  }

  cachedReceiptClients = urls.map(url =>
    createPublicClient({
      chain,
      transport: instrumentedHttp(
        url,
        { timeout: 15_000 },
        { source: "receiptPolling" }
      ),
    })
  );
  return cachedReceiptClients;
}
