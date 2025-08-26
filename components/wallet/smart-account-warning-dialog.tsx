"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

function getDismissStorageKey(address?: string, chainId?: number) {
  const addr = address?.toLowerCase() ?? "unknown";
  const chain = chainId ?? 0;
  return `smart-account-warning-dismissed:${addr}:${chain}`;
}

function wasDismissed(address?: string, chainId?: number) {
  if (typeof window === "undefined") return false;
  const key = getDismissStorageKey(address, chainId);
  return window.sessionStorage.getItem(key) === "true";
}

function setDismissed(address?: string, chainId?: number) {
  if (typeof window === "undefined") return;
  const key = getDismissStorageKey(address, chainId);
  window.sessionStorage.setItem(key, "true");
}

function stringifySafe(value: unknown) {
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return "";
  }
}

function includesSmartAccountHints(payload: unknown) {
  console.log("payload", payload);
  const str = stringifySafe(payload);
  if (!str) return false;
  // Broad hints across MetaMask EIP-7702 / Delegator and EIP-5792 batching
  return (
    str.includes("smart account") ||
    str.includes("smartaccount") ||
    str.includes("eip-7702") ||
    str.includes("7702") ||
    str.includes("delegator") ||
    // Capabilities often list wallet_sendcalls when AA is enabled in MetaMask
    str.includes("wallet_sendcalls")
  );
}

async function requestWalletCapabilities(params: {
  address?: `0x${string}`;
  request?: (args: any) => Promise<any>;
}) {
  const { address, request } = params;
  if (!request) return null;

  // Try address-scoped first, then global
  try {
    return await request({
      method: "wallet_getCapabilities",
      params: address ? [address] : [],
    });
  } catch {
    try {
      return await request({ method: "wallet_getCapabilities" });
    } catch {
      return null;
    }
  }
}

function getAnyWalletRequest(
  walletClient: ReturnType<typeof useWalletClient>["data"]
) {
  const wcAny = walletClient as any;
  if (wcAny?.transport && typeof wcAny.transport.request === "function") {
    return wcAny.transport.request as (args: any) => Promise<any>;
  }
  if (typeof window !== "undefined") {
    const eth: any = (window as any).ethereum;
    if (eth && typeof eth.request === "function" && eth.isMetaMask) {
      return eth.request.bind(eth) as (args: any) => Promise<any>;
    }
  }
  return undefined;
}

async function isContractWallet(
  address?: `0x${string}`,
  getBytecode?: (args: {
    address: `0x${string}`;
  }) => Promise<`0x${string}` | null | undefined>
) {
  if (!address || !getBytecode) return false;
  try {
    const bytecode = await getBytecode({ address });
    return Boolean(bytecode && bytecode !== "0x");
  } catch {
    return false;
  }
}

// export async function get7702Delegation(
//   address: `0x${string}`
// ): Promise<
//   | { kind: "none" }
//   | { kind: "eip7702"; implementation: `0x${string}` }
//   | { kind: "contract" }
// > {
//   const code = await client.getBytecode({ address });
//   if (!code || code === "0x") return { kind: "none" };

//   // 7702 designator is: 0xef0100 || <20-byte implementation address>
//   const prefix = code.slice(0, 8).toLowerCase(); // "0x" + "ef0100" = 8 chars
//   if (prefix === "0xef0100") {
//     const implHex = "0x" + code.slice(8, 8 + 40); // next 20 bytes
//     if (isHex(implHex) && implHex.length === 42) {
//       return {
//         kind: "eip7702",
//         implementation: getAddress(implHex as `0x${string}`),
//       };
//     }
//   }
//   return { kind: "contract" };
// }

export function SmartAccountWarningDialog() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [open, setOpen] = useState(false);
  const hasToastedErrorRef = useRef(false);

  const docsUrl = useMemo(
    () =>
      "https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/",
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!isConnected || !address) {
        setOpen(false);
        return;
      }

      if (wasDismissed(address, chainId)) {
        setOpen(false);
        return;
      }

      try {
        const request = getAnyWalletRequest(walletClient);
        const caps = request
          ? await requestWalletCapabilities({
              address: address as `0x${string}`,
              request,
            })
          : null;

        const smartByCapabilities = includesSmartAccountHints(caps);
        const smartByBytecode = await isContractWallet(
          address as `0x${string}`,
          publicClient?.getBytecode
        );
        console.log("smartByCapabilities", smartByCapabilities);
        console.log("smartByBytecode", smartByBytecode);

        if (!cancelled)
          setOpen(Boolean(smartByCapabilities || smartByBytecode));
      } catch (error: any) {
        if (!hasToastedErrorRef.current) {
          hasToastedErrorRef.current = true;
          toast({
            title: "Wallet capability check failed",
            description:
              error?.message ||
              "We couldn't verify MetaMask smart account status. If trading fails, try disabling Smart Account.",
            variant: "destructive",
          });
        }
        if (!cancelled) setOpen(false);
      }
    }

    detect();

    return () => {
      cancelled = true;
    };
  }, [address, chainId, isConnected, walletClient]);

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) setDismissed(address, chainId);
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>MetaMask Smart Account detected</DialogTitle>
          <DialogDescription>
            To trade Glow assets on this app, please disable MetaMask Smart
            Account (EIP-7702) for the current network.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          You can revert to a standard account in MetaMask settings. Follow the
          official guide below.
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            type="button"
          >
            Dismiss
          </Button>
          <Button
            onClick={() => {
              window.open(docsUrl, "_blank", "noopener,noreferrer");
            }}
            type="button"
          >
            Open MetaMask guide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
