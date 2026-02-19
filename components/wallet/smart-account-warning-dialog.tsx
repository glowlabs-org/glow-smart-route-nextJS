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
        title: "Incompatible wallet detected",
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
          "Disconnect your Safe/contract wallet detected.",
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px] md:max-w-[600px] lg:max-w-[680px] max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-[24px] bg-card border border-border/30 dark:border-border/40">
        {/* Header with Warning Accent */}
        <div className="bg-amber-500/10 dark:bg-amber-500/5 border-b border-amber-500/20 dark:border-amber-500/30 px-6 py-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-amber-900 dark:text-amber-100">
                  {content.title}
                </DialogTitle>
                <DialogDescription className="text-amber-800/80 dark:text-amber-200/80 mt-1">
                  {content.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">
          <div className="px-6 py-6 space-y-8">
            {/* Why Section */}
            {content.why && content.why.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                  Why is this happening?
                </h4>
                <ul className="grid gap-2">
                  {content.why.map((reason, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex gap-2.5 items-start bg-muted/40 dark:bg-muted/50 p-1 rounded-md"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      <span className="leading-relaxed">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resolution Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                Resolution Steps
              </h4>

              {showMetaMaskPath ? (
                <div className="rounded-xl border border-border/30 dark:border-border/40 bg-card overflow-hidden">
                  <div className="p-5 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h4 className="text-base font-medium text-foreground mb-4">
                          Disable Smart Account in MetaMask
                        </h4>
                        <ol className="space-y-4">
                          {content.directivesMetaMask.map((step, i) => (
                            <li
                              key={i}
                              className="flex gap-3 text-sm text-muted-foreground"
                            >
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                                {i + 1}
                              </span>
                              <span className="pt-0.5 leading-relaxed">
                                {step}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="outline"
                        size="default"
                        className="flex-1"
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
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/30 dark:border-border/40 bg-card p-5">
                  <ol className="space-y-4">
                    {content.directivesGeneric.map((step, i) => (
                      <li
                        key={i}
                        className="flex gap-3 text-sm text-muted-foreground"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                          {i + 1}
                        </span>
                        <span className="pt-0.5 leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-border/30 dark:border-border/40 bg-muted/30 dark:bg-muted/20 gap-3 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={isRechecking}
            className="sm:mr-auto text-muted-foreground hover:text-foreground"
          >
            I'll do this later
          </Button>

          <Button
            variant="default"
            onClick={recheckNow}
            disabled={isRechecking}
            className="min-w-[140px] bg-glow-orange hover:bg-glow-orange/90 text-white"
          >
            {isRechecking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Recheck Wallet
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
