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
import {
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Wallet,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  getSmartAccountStatus,
  SmartAccountStatus,
} from "@/web3/web3/utils/detectSmartAccount";
import { cn } from "@/lib/utils";

function detectWalletBrand(
  walletClient: ReturnType<typeof useWalletClient>["data"]
):
  | { brand: "metamask"; isMetaMask: true }
  | { brand: "unknown"; isMetaMask: false } {
  // Try to infer brand from provider flags
  const eth =
    typeof window !== "undefined" ? (window as any).ethereum : undefined;
  if (
    eth?.isMetaMask ||
    (walletClient as any)?.transport?.name?.toLowerCase?.().includes("metamask")
  ) {
    return { brand: "metamask", isMetaMask: true };
  }
  return { brand: "unknown", isMetaMask: false };
}

// ---------- props ----------
interface SmartAccountWarningDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerCheck?: boolean;
}

// ---------- component ----------
export function SmartAccountWarningDialog({
  open: controlledOpen,
  onOpenChange,
  triggerCheck = false,
}: SmartAccountWarningDialogProps = {}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [internalOpen, setInternalOpen] = useState(false);
  const [smartAccountStatus, setSmartAccountStatus] =
    useState<SmartAccountStatus | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);

  const hasToastedErrorRef = useRef(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const walletBrand = detectWalletBrand(walletClient);

  // Official MetaMask guide for 7702 “revert to EOAs”
  const metamaskDocsUrl = useMemo(
    () =>
      "https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/",
    []
  );

  // ---------- effects ----------
  useEffect(() => {
    if (!isConnected || !address || !chainId) return;

    let cancelled = false;
    (async () => {
      try {
        const status = await getSmartAccountStatus({
          address,
          walletClient,
          getBytecode: publicClient?.getBytecode,
        });
        if (cancelled) return;
        setSmartAccountStatus(status);

        const isSmartish =
          status.isEip7702Delegated ||
          status.hasWalletAABatching ||
          status.isContractWallet;

        if (triggerCheck && isSmartish) setOpen(true);
      } catch (err) {
        if (!hasToastedErrorRef.current) {
          toast({
            title: "Smart account check failed",
            description:
              "We couldn’t verify your account type. You may experience errors when trading.",
            variant: "destructive",
          });
          hasToastedErrorRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCheck, isConnected, address, chainId]);

  // ---------- derived content ----------
  function getDialogContent() {
    if (smartAccountStatus?.isEip7702Delegated) {
      return {
        title: "EIP-7702 Delegation Detected",
        description:
          "Delegated (smart) accounts cannot interact with Glow contracts.",
        why: [
          "Delegation changes how transactions are authorized and can break on-chain assumptions.",
          "Some calls require a plain EOA signer; delegation introduces a contract-based dispatcher.",
        ],
        directivesMetaMask: [
          "Open MetaMask → Account Details.",
          "Select your delegated account.",
          "Toggle off `Enable smart contract account`.",
          "wait for the transaction to be confirmed",
          "Return here and press “Recheck now”.",
        ],
        directivesGeneric: [
          "Open your wallet settings.",
          "Disable the smart/delegated account mode for this address.",
          "Reconnect as a plain EOA.",
          "Return here and press “Recheck now”.",
        ],
      };
    }
    if (smartAccountStatus?.hasWalletAABatching) {
      return {
        title: "Account Abstraction / Batching Enabled",
        description:
          "Bundled or sponsored transactions (AA) are not supported by Glow for this flow.",
        why: [
          "Bundlers alter nonce/fee semantics and can reorder calls.",
          "Some contract calls require user-paid, non-batched txs.",
        ],
        directivesMetaMask: [
          "Open MetaMask → Settings.",
          "Disable any Smart Account or batching features for this account.",
          "Reconnect as a plain EOA.",
          "Return here and press “Recheck now”.",
        ],
        directivesGeneric: [
          "Open your wallet settings (Rabby/OKX/etc.).",
          "Disable account abstraction / batching / sponsored tx features.",
          "Reconnect with a plain EOA (no bundler).",
          "Return here and press “Recheck now”.",
        ],
      };
    }
    if (smartAccountStatus?.isContractWallet) {
      return {
        title: "Contract Wallet Detected",
        description:
          "Contract wallets (e.g., Safe and Coinbase) are not compatible with this action.",
        why: [
          "Some calls require an EOA signer and predictable nonce handling.",
          "Multisig or module-based execution can block required call patterns.",
        ],
        directivesMetaMask: [
          "Disconnect the Safe/contract account in your wallet.",
          "Select a personal account (EOA).",
          "Reconnect to Glow.",
        ],
        directivesGeneric: [
          "Disconnect your Safe/contract wallet.",
          "Connect with a personal EOA (regular wallet address).",
          "Reconnect to Glow.",
          "Return here and press “Recheck now”.",
        ],
      };
    }
    // Fallback when we know it’s “smart” but not which flavor
    return {
      title: "Smart Account Features Detected",
      description:
        "Smart/delegated modes are not supported for this action. Use a plain EOA.",
      why: [
        "Smart routing can change transaction semantics.",
        "We require direct EOA signing for some calls.",
      ],
      directivesMetaMask: [
        "Open MetaMask settings.",
        "Disable Smart Account features or revert to EOA.",
        "Reconnect to Glow.",
        "Return here and press “Recheck now”.",
      ],
      directivesGeneric: [
        "Open your wallet settings.",
        "Disable smart/delegated/AA features.",
        "Reconnect as a plain EOA.",
        "Return here and press “Recheck now”.",
      ],
    };
  }

  const content = getDialogContent();

  // ---------- actions ----------
  async function recheckNow() {
    if (!address) return;
    setIsRechecking(true);
    try {
      const status = await getSmartAccountStatus({
        address,
        walletClient,
        getBytecode: publicClient?.getBytecode,
      });
      console.log("status", status);
      setSmartAccountStatus(status);
      const stillBlocked =
        status.isEip7702Delegated ||
        status.hasWalletAABatching ||
        status.isContractWallet;
      if (!stillBlocked) {
        toast({
          title: "All set",
          description: "We no longer detect smart account features.",
        });
        handleClose(false);
      } else {
        toast({
          title: "Still blocked",
          description:
            "Smart account features are still detected. Follow the steps and try again.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Recheck failed",
        description: "Could not verify your account status.",
        variant: "destructive",
      });
    } finally {
      setIsRechecking(false);
    }
  }

  function handleClose(next: boolean) {
    setOpen(next);
  }

  if (!open) return null;

  const showMetaMaskPath = walletBrand.isMetaMask;

  const issues = [
    smartAccountStatus?.isEip7702Delegated && "EIP-7702 delegation active",
    smartAccountStatus?.hasWalletAABatching && "AA / batching enabled",
    smartAccountStatus?.isContractWallet && "Contract wallet in use",
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="p-2 bg-destructive/10 rounded-full flex-shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-destructive text-lg sm:text-xl font-semibold leading-tight">
                {content.title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm sm:text-base text-left">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Detected issues */}
          {issues.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">
                Detected issues
              </div>
              <div className="grid gap-2">
                {issues.map((label, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 border border-border rounded-lg"
                  >
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-foreground font-medium">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action blocks */}
          <div className="space-y-4">
            {/* MetaMask path (smart account on MetaMask) */}
            {showMetaMaskPath && (
              <div className="rounded-xl border p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 flex-shrink-0" />
                  <div className="text-sm font-semibold">MetaMask steps</div>
                </div>
                <ol className="text-xs sm:text-sm text-muted-foreground list-decimal ml-4 sm:ml-5 space-y-1 sm:space-y-2">
                  {content.directivesMetaMask.map((s, i) => (
                    <li key={i} className="leading-relaxed">
                      {s}
                    </li>
                  ))}
                </ol>

                <div className="flex flex-col sm:flex-row gap-2 mt-3 sm:mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      window.open(
                        metamaskDocsUrl,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    MetaMask Guide
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={recheckNow}
                    disabled={isRechecking}
                  >
                    <RefreshCw
                      className={cn(
                        "w-3 h-3 sm:w-4 sm:h-4 mr-2",
                        isRechecking && "animate-spin"
                      )}
                    />
                    Recheck now
                  </Button>
                </div>
              </div>
            )}

            {/* Generic path (other wallets / connectors) */}
            {!showMetaMaskPath && (
              <div className="rounded-xl border p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 flex-shrink-0" />
                  <div className="text-sm font-semibold">Other wallets</div>
                </div>
                <ol className="text-xs sm:text-sm text-muted-foreground list-decimal ml-4 sm:ml-5 space-y-1 sm:space-y-2">
                  {content.directivesGeneric.map((s, i) => (
                    <li key={i} className="leading-relaxed">
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-col sm:flex-row gap-2 mt-3 sm:mt-4">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={recheckNow}
                    disabled={isRechecking}
                  >
                    <RefreshCw
                      className={cn(
                        "w-3 h-3 sm:w-4 sm:h-4 mr-2",
                        isRechecking && "animate-spin"
                      )}
                    />
                    Recheck now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      // If you have a wallet modal, trigger it here instead:
                      // openConnectModal?.()
                      toast({
                        title: "Tip",
                        description:
                          "If you're using a contract/AA wallet, switch to a regular personal account (EOA).",
                      });
                    }}
                  >
                    Switch wallet
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-3 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
            type="button"
            disabled={isDeactivating || isRechecking}
            className="w-full sm:w-auto"
          >
            Dismiss
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.open(
                "https://glow.org/blog/glow-guarded-launch",
                "_blank"
              );
            }}
            type="button"
            className="w-full sm:w-auto"
          >
            <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            Learn more
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
