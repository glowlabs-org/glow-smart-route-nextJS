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
import { toast } from "sonner";
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
import {
  encodeFunctionData,
  type Hex,
  parseTransaction,
  serializeTransaction,
} from "viem";

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
          toast.error("Smart account check failed", {
            description:
              "We couldn't verify your account type. You may experience errors when trading.",
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
        title: "Imcompatible wallet detected",
        description:
          "Delegated (smart) accounts cannot interact with Glow contracts.",
        why: [
          "Delegation changes how transactions are authorized and can break on-chain assumptions.",
          "Some calls require a plain EOA signer; delegation introduces a contract-based dispatcher.",
        ],
        directivesMetaMask: [
          "Open MetaMask and click on your account name",
          "Select 'Account details' from the 3 dots dropdown",
          "Find 'Enable smart contract account' and toggle it OFF",
          "Confirm the transaction and wait for it to complete",
          "Return here and click 'Recheck Now' to verify",
        ],
        directivesGeneric: [
          "Open your wallet settings",
          "Look for smart account, AA, or delegation features",
          "Disable these features for your current address",
          "Save the changes and reconnect your wallet",
          "Return here and click 'Recheck Now' to verify",
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
        toast.success("All set!", {
          description: "We no longer detect smart account features.",
        });
        handleClose(false);
      } else {
        toast.warning("Still blocked", {
          description:
            "Smart account features are still detected. Follow the steps and try again.",
        });
      }
    } catch (e) {
      toast.error("Recheck failed", {
        description: "Could not verify your account status.",
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
      <DialogContent className="sm:max-w-[540px] md:max-w-[600px] lg:max-w-[680px] max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="space-y-3 pb-4 px-4 sm:px-6 pt-6 border-b">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-accent text-left text-base sm:text-lg md:text-xl font-semibold leading-tight mb-2">
                {content.title}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm md:text-base text-left text-muted-foreground">
                {content.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 md:space-y-5">
          {/* Action blocks */}
          <div className="space-y-4">
            {/* MetaMask path (smart account on MetaMask) */}
            {showMetaMaskPath && (
              <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                <div className="p-4 space-y-4">
                  <div className="bg-accent/5 rounded-lg p-4 border border-accent/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          How to Disable Smart Account in MetaMask
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Follow these steps to revert to a standard account:
                        </p>
                        <ol className="text-xs sm:text-sm text-muted-foreground list-decimal ml-5 space-y-2.5">
                          {content.directivesMetaMask.map((s, i) => (
                            <li key={i} className="leading-relaxed pl-1">
                              {s}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full sm:flex-1"
                      onClick={() =>
                        window.open(
                          metamaskDocsUrl,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open MetaMask Guide
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:flex-1"
                      onClick={recheckNow}
                      disabled={isRechecking}
                    >
                      <RefreshCw
                        className={cn(
                          "w-4 h-4 mr-2",
                          isRechecking && "animate-spin"
                        )}
                      />
                      {isRechecking ? "Checking..." : "Recheck Now"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Generic path (other wallets / connectors) */}
            {!showMetaMaskPath && (
              <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                <div className="bg-muted/40 px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Resolution Steps
                    </h3>
                  </div>
                </div>
                <div className="p-4">
                  <ol className="text-xs sm:text-sm text-muted-foreground list-decimal ml-5 space-y-2.5">
                    {content.directivesGeneric.map((s, i) => (
                      <li key={i} className="leading-relaxed pl-1">
                        {s}
                      </li>
                    ))}
                  </ol>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full sm:flex-1"
                      onClick={recheckNow}
                      disabled={isRechecking}
                    >
                      <RefreshCw
                        className={cn(
                          "w-4 h-4 mr-2",
                          isRechecking && "animate-spin"
                        )}
                      />
                      {isRechecking ? "Checking..." : "Recheck Now"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:flex-1"
                      onClick={() => {
                        // If you have a wallet modal, trigger it here instead:
                        // openConnectModal?.()
                        toast.info("Tip", {
                          description:
                            "If you're using a contract/AA wallet, switch to a regular personal account (EOA).",
                        });
                      }}
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Switch Wallet
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 px-4 sm:px-6 py-4 border-t bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleClose(false)}
            type="button"
            disabled={isRechecking}
            className="w-full sm:w-auto"
          >
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
