import { toast } from "sonner";
import type { Connector } from "wagmi";

export async function forceDisconnect(
  disconnect: () => void,
  connectors: readonly Connector[],
  activeConnector?: Connector
) {
  try {
    // 1) Ask wagmi to disconnect
    disconnect();

    // 2) Attempt to directly disconnect all known connectors (WalletConnect, Injected, etc.)
    await Promise.all(
      connectors.map(async (c) => {
        try {
          // wagmi connector disconnect (if available)
          // @ts-ignore - not all connectors expose this
          if (typeof (c as any).disconnect === "function") {
            await (c as any).disconnect();
          }

          // Provider-level disconnect (WalletConnect, etc.)
          const provider = await c.getProvider().catch(() => null);
          if (provider && typeof (provider as any).disconnect === "function") {
            await (provider as any).disconnect();
          }
        } catch {
          // ignore per-connector errors
        }
      })
    );

    // 3) Clear persisted sessions (WalletConnect/wagmi) and set one-shot flag to disable autoConnect on next load
    try {
      if (typeof localStorage !== "undefined") {
        // prevent wagmi from auto-connecting immediately after reload (one time)
        localStorage.setItem("wagmi_disable_auto_connect_once", "1");
        Object.keys(localStorage).forEach((key) => {
          const k = key.toLowerCase();
          if (
            k.includes("walletconnect") ||
            k.startsWith("wc@") ||
            k.includes("wagmi")
          ) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch {}

    // 4) Clear wagmi cookie (if present) and set one-shot cookie flag
    try {
      if (typeof document !== "undefined") {
        const cookies = document.cookie ? document.cookie.split(";") : [];
        cookies
          .map((entry) => entry.trim())
          .filter((entry) => entry.toLowerCase().startsWith("wagmi."))
          .forEach((entry) => {
            const key = entry.split("=")[0];
            document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax`;
          });

        // Set short-lived cookie to disable autoConnect on next page load (in case SSR runs before localStorage is available)
        const secure =
          typeof window !== "undefined" && window.location.protocol === "https:"
            ? "; Secure"
            : "";
        document.cookie = `wagmi_disable_auto_connect_once=1; Max-Age=30; Path=/; SameSite=Lax${secure}`;
      }
    } catch {}
  } catch {
    toast.error("Failed to disconnect. Please refresh the page.");
  }
}
