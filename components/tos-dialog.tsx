import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  useChainId,
  useConnectorClient,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Loader2, ChevronDown, AlertCircle, RefreshCw, Wallet, Info } from "lucide-react";
import { toast } from "sonner";
import { keccak256, toHex } from "viem";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useGctlApi } from "@/hooks";
import { resolveWalletChainId } from "@/lib/tos-chain";
import {
  parseTosApiError,
  shouldRetryTosWithPersonalSign,
  type TosError,
} from "@/lib/tos-signature-errors";
import { WalletsRouter } from "@glowlabs-org/utils/browser";
import * as Sentry from "@sentry/nextjs";
import { REFERRAL_AUTO_LINK_EVENT } from "@/lib/referral-attribution";

// Helper to get signature debugging info
function getSignatureDebugInfo(signature: string | undefined) {
  if (!signature) return { signatureLength: 0, signatureType: "none", signaturePreview: "none" };

  const hexLength = signature.length - 2; // Remove 0x prefix
  const byteLength = hexLength / 2;

  let signatureType: string;
  if (byteLength === 64) {
    signatureType = "eip2098_compact";
  } else if (byteLength === 65) {
    signatureType = "ecdsa_standard";
  } else if (byteLength > 65) {
    signatureType = "erc1271_or_eip6492";
  } else {
    signatureType = "invalid_too_short";
  }

  // Truncate signature for logging (first 20 chars + last 20 chars)
  const signaturePreview = signature.length > 44
    ? `${signature.slice(0, 22)}...${signature.slice(-20)}`
    : signature;

  return {
    signatureLength: byteLength,
    signatureType,
    signaturePreview,
  };
}

function toPlainObject(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(value)) {
    output[key] = (value as Record<string, unknown>)[key];
  }
  return output;
}

function safeJsonStringify(value: unknown) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (key, val) => {
      if (val instanceof Error) {
        return toPlainObject(val);
      }
      if (typeof val === "bigint") {
        return val.toString();
      }
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    },
    2
  );
}

function getErrorDetails(error: unknown) {
  const err = error as {
    name?: string;
    message?: string;
    code?: string | number;
    reason?: string;
    shortMessage?: string;
    data?: unknown;
    info?: unknown;
    error?: unknown;
    cause?: unknown;
    stack?: string;
  };

  return {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    reason: err?.reason,
    shortMessage: err?.shortMessage,
    data: err?.data,
    info: err?.info,
    error: err?.error,
    cause: err?.cause,
    stack: err?.stack,
    raw: safeJsonStringify(toPlainObject(error)),
  };
}
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// ToS content version and hash generation - MUST match backend exactly
const TOS_VERSION = "1.0";
const TOS_CONTENT = `Terms of Service - Version 1.0

1. Acceptance of Terms
By connecting your digital wallet to this Application (app.glow.org), you explicitly agree to these Terms of Service. If you do not agree, do not use the Application.

Eligibility: By using the Application, you represent and warrant that you are at least 18 years of age, or the age of legal majority in your jurisdiction (if higher), and possess the legal authority to agree to these Terms and use the Application lawfully.

2. User Responsibility
- The User is solely responsible for their interactions with the Application, including all associated smart contracts and blockchain transactions.
- Users acknowledge the inherent risks in blockchain technology, including but not limited to financial loss, smart contract vulnerabilities, network disruptions, and regulatory risks.

Privacy Acknowledgment: The Application does not intentionally collect personal data. However, blockchain transactions inherently expose certain transaction-related information publicly, including blockchain addresses and associated metadata. By using the Application, Users acknowledge and accept this inherent blockchain transparency.

Prohibited Activities: Users expressly agree not to engage in any unlawful or prohibited activities, including fraud, money laundering, market manipulation, sanction evasion, or any activity otherwise prohibited by applicable law or regulations when using the Application.

3. No Liability & Warranty Disclaimer
- The Application and associated smart contracts are provided on an "as-is" basis.
- The Company explicitly disclaims any responsibility for direct, indirect, incidental, special, consequential, or exemplary damages, including financial loss, arising from or relating to the use of the Application.
- The Company makes no warranties, express or implied, regarding the reliability, accuracy, completeness, or functionality of the Application or associated smart contracts.

4. Regulatory Compliance
- Users confirm they are not using the Application from any jurisdiction where its use is prohibited or restricted.
- It is the User's responsibility to comply with applicable local laws and regulations.

5. Indemnification
Users agree to indemnify and hold harmless the Company and its affiliates, officers, employees, and representatives from and against all claims, liabilities, damages, losses, or expenses arising from their use of the Application.

6. No Custody of Blockchain Assets
- The Application does not have custody, possession, or control over the User's blockchain assets at any time.
- Users interact directly with smart contracts and retain full control over their private keys and blockchain assets.

7. Modification of Terms
The Company reserves the right to modify these Terms at any time. Updates will be posted publicly on the Application at app.glow.org/tos, and Users bear the responsibility to periodically review these Terms. Continued use after changes constitutes acceptance.

8. Intellectual Property
All intellectual property associated with the Application, including trademarks and copyrights, remains the property of the Company.

User Submissions: Any feedback, suggestions, or submissions provided by Users related to the Application shall be deemed non-confidential. Users hereby grant the Company a perpetual, irrevocable, worldwide, royalty-free, and unrestricted right to use, incorporate, or otherwise exploit such submissions without restriction or compensation.

9. Arbitration and Dispute Resolution
Any dispute arising out of or in connection with these Terms or your use of the Application shall be referred to and finally resolved by arbitration administered by the Cayman International Arbitration Centre (CIAC) in accordance with the CIAC Arbitration Rules in force at the time of arbitration. The seat of arbitration shall be George Town, Cayman Islands. The arbitration proceedings shall be conducted in English. The arbitration tribunal's decision shall be final and binding upon all parties.

10. Governing Law and Jurisdiction
These Terms shall be governed by and construed in accordance with the laws of the Cayman Islands, without regard to conflicts of law principles. Users agree to submit to the exclusive jurisdiction of the courts located in George Town, Cayman Islands, for purposes of enforcing arbitration decisions or addressing claims not subject to arbitration.

11. Risk Acknowledgment
- Users acknowledge and agree they fully understand the risks associated with blockchain technology and related activities.
- Users are encouraged to perform independent research before engaging in any transactions on the Application.`;

if (!process.env.NEXT_PUBLIC_CONTROL_API_URL) {
  throw new Error("NEXT_PUBLIC_CONTROL_API_URL is not set");
}

const walletsApi = WalletsRouter(process.env.NEXT_PUBLIC_CONTROL_API_URL);

const getTosHash = () => {
  const encoder = new TextEncoder();
  const data = encoder.encode(TOS_CONTENT);
  return keccak256(toHex(data));
};

// EIP-712 domain for ToS acceptance
const tosEIP712Domain = (chainId: number) => ({
  name: "ControlManager",
  version: "1",
  chainId,
  verifyingContract:
    "0x0000000000000000000000000000000000000000" as `0x${string}`,
});

// EIP-712 types for ToS acceptance
const tosEIP712Types = {
  AcceptTos: [
    { name: "nonce", type: "uint256" },
    { name: "tosVersion", type: "string" },
    { name: "tosHash", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
};

export function TosDialog() {
  const { isConnected, address, connector } = useAccount();
  const queryClient = useQueryClient();
  const connectedChainId = useChainId();
  const { data: connectorClient } = useConnectorClient();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { signer, isLoading: isSignerLoading } = useEthersSigner();
  const { latestNonce } = useGctlApi(address);
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1;

  // Get connector info for debugging
  const connectorName = connector?.name || "unknown";
  const connectorId = connector?.id || "unknown";
  const [isOpen, setIsOpen] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [hasAccepted, setHasAccepted] = React.useState(false);
  const [isSigning, setIsSigning] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [error, setError] = React.useState<TosError | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [activeWalletChainId, setActiveWalletChainId] = React.useState<
    number | undefined
  >(connectedChainId);

  const getNetworkLabel = React.useCallback((id?: number) => {
    if (!id) return "Unknown Network";
    if (id === 1) return "Ethereum Mainnet";
    if (id === 11155111) return "Sepolia";
    if (id === 8453) return "Base";
    return `Chain ${id}`;
  }, []);

  const expectedNetworkLabel = getNetworkLabel(chainId);
  const effectiveConnectedChainId = activeWalletChainId ?? connectedChainId;
  const connectedNetworkLabel = getNetworkLabel(effectiveConnectedChainId);
  const isWrongNetwork =
    isConnected &&
    typeof effectiveConnectedChainId === "number" &&
    effectiveConnectedChainId !== chainId;

  const resolveActiveWalletChainId = React.useCallback(async () => {
    const resolvedChainId = await resolveWalletChainId({
      connectorClient: connectorClient as
        | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
        | undefined,
      signerProvider: signer?.provider as
        | {
            send?: (method: string, params: unknown[]) => Promise<unknown>;
            getNetwork?: () => Promise<{ chainId?: unknown }>;
          }
        | undefined,
      fallbackChainId: connectedChainId,
    });

    if (typeof resolvedChainId === "number") {
      setActiveWalletChainId(resolvedChainId);
    }

    return resolvedChainId;
  }, [connectedChainId, connectorClient, signer]);

  const buildWrongNetworkError = React.useCallback(
    (detectedChainId?: number): TosError => ({
      type: "wrong_network",
      title: "Wrong Network",
      message: `Your wallet is connected to ${getNetworkLabel(detectedChainId)}.`,
      suggestion: `Please switch to ${expectedNetworkLabel} to sign the Terms of Service.`,
      canRetry: true,
    }),
    [expectedNetworkLabel, getNetworkLabel]
  );

  const showWrongNetworkAlert =
    isWrongNetwork && (!error || error.type !== "wrong_network");

  React.useEffect(() => {
    setActiveWalletChainId(connectedChainId);
  }, [connectedChainId]);

  React.useEffect(() => {
    if (!isConnected) {
      setActiveWalletChainId(undefined);
      return;
    }

    void resolveActiveWalletChainId();
  }, [isConnected, resolveActiveWalletChainId]);

  React.useEffect(() => {
    if (!isConnected || !address) {
      setIsInitialized(true);
      setIsOpen(false);
      return;
    }

    let mounted = true;

    const checkTosAcceptance = async () => {
      if (!mounted) return;

      try {
        const status = await walletsApi.fetchTosStatus(address);

        if (!mounted) return;

        if (status.needsReAcceptance) {
          setIsOpen(true);
          setHasAccepted(false);
        } else {
          setIsOpen(false);
          setHasAccepted(true);
        }
      } catch (error) {
        console.error("Error checking ToS acceptance:", error);

        // Log ToS status check errors to Sentry
        if (typeof window !== "undefined") {
          const normalizedError =
            error instanceof Error ? error : new Error(String(error));
          Sentry.captureException(normalizedError, {
            tags: {
              tosStage: "status_check",
              walletAddress: address,
            },
            extra: {
              errorMessage: normalizedError.message,
              errorType: typeof error,
            },
          });
        }

        if (mounted) {
          setIsOpen(true);
          setHasAccepted(false);
        }
      } finally {
        if (mounted) {
          setIsInitialized(true);
        }
      }
    };

    const timer = setTimeout(checkTosAcceptance, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [isConnected, address]);

  const handleAcceptTos = async () => {
    if (!address) {
      toast.error("Please ensure your wallet is connected");
      return;
    }

    if (isSignerLoading || !signer) {
      toast.error("Wallet is initializing, please try again in a moment");
      return;
    }

    const resolvedChainId = await resolveActiveWalletChainId();
    const walletChainIdForRequest = resolvedChainId ?? effectiveConnectedChainId;
    const requestIsWrongNetwork =
      typeof walletChainIdForRequest === "number" &&
      walletChainIdForRequest !== chainId;

    if (requestIsWrongNetwork) {
      setError(buildWrongNetworkError(walletChainIdForRequest));
      setRetryCount((prev) => prev + 1);
      return;
    }

    // Clear previous error and start signing
    setError(null);
    setIsSigning(true);

    // Track signing context for error reporting
    let signingContext = {
      tosHash: "",
      nonce: "",
      deadline: "",
      signature: "",
      walletChainId:
        typeof walletChainIdForRequest === "number"
          ? String(walletChainIdForRequest)
          : "unknown",
      signingMethod: "eip712" as "eip712" | "personal_sign",
    };

    try {
      const tosHash = getTosHash();
      const nonce = (Number(latestNonce) + 1).toString();
      const deadline = Math.floor(Date.now() / 1000 + 3600).toString();

      // Store in context for error reporting
      signingContext = { ...signingContext, tosHash, nonce, deadline };

      const timestamp = new Date().toISOString();
      const message = `I accept the Glow Terms of Service at app.glow.org

By signing this message, I (${address}) confirm that I have read, understood, and agree to be bound by the Terms of Service.

Date: ${timestamp}
Application: app.glow.org
Version: ToS v${TOS_VERSION}
ToS Hash: ${tosHash}

This signature serves as my digital acknowledgment and acceptance of the terms.`;

      let signature: string;
      let signingMethod: "eip712" | "personal_sign" = "eip712";

      try {
        // Try EIP-712 typed data first (preferred method)
        const signatureMessage = {
          nonce: BigInt(nonce),
          tosVersion: TOS_VERSION,
          tosHash,
          deadline: BigInt(deadline),
        };

        signature = await signer.signTypedData(
          tosEIP712Domain(chainId),
          tosEIP712Types as unknown as Record<string, any[]>,
          signatureMessage
        );
        signingContext.signature = signature;
      } catch (typedDataError) {
        console.warn(
          "EIP-712 signing failed, falling back to personal sign:",
          typedDataError
        );

        // Log EIP-712 failure to Sentry with wallet context
        if (typeof window !== "undefined") {
          const normalizedError =
            typedDataError instanceof Error
              ? typedDataError
              : new Error(String(typedDataError));
          const errorDetails = getErrorDetails(typedDataError);
          Sentry.captureException(normalizedError, {
            tags: {
              tosStage: "eip712_signing",
              walletAddress: address,
              chainId: String(chainId),
              walletChainId: signingContext.walletChainId,
              expectedChainId: String(chainId),
              connectorName,
              connectorId,
            },
            extra: {
              tosVersion: TOS_VERSION,
              tosHash,
              nonce,
              deadline,
              deadlineHuman: new Date(Number(deadline) * 1000).toISOString(),
              errorMessage: normalizedError.message,
              errorCode: errorDetails.code,
              errorReason: errorDetails.reason,
              errorShortMessage: errorDetails.shortMessage,
              errorInfo: errorDetails.info,
              errorData: errorDetails.data,
              errorCause: errorDetails.cause,
              errorStack: errorDetails.stack,
              isWrongNetwork: requestIsWrongNetwork,
              // Include raw error for better debugging
              rawError: errorDetails.raw || String(typedDataError),
            },
          });
        }

        // Fallback to personal sign for wallets that don't support EIP-712 properly
        signingMethod = "personal_sign";
        signingContext.signingMethod = signingMethod;
        signature = await signer.signMessage(message);
        signingContext.signature = signature;
      }

      if (!signature) {
        toast.error("Failed to sign message");

        // Log signature failure to Sentry
        if (typeof window !== "undefined") {
          Sentry.captureException(new Error("Signature is empty"), {
            tags: {
              tosStage: "signature_validation",
              walletAddress: address,
              signingMethod,
            },
            extra: {
              tosVersion: TOS_VERSION,
              tosHash,
              nonce,
            },
          });
        }
        return;
      }

      let tosResponse:
        | {
            autoLink?: {
              attempted: boolean;
              linked: boolean;
              referralCode?: string;
              error?: string;
            };
          }
        | undefined;

      try {
        const response = await fetch("/api/tos/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wallet: address,
            signature,
            nonce,
            tosVersion: TOS_VERSION,
            tosHash,
            message,
            deadline,
          }),
        });

        const responseBody = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            (responseBody as { error?: string } | null)?.error ||
              "Failed to accept Terms of Service"
          );
        }

        tosResponse = responseBody as {
          autoLink?: {
            attempted: boolean;
            linked: boolean;
            referralCode?: string;
            error?: string;
          };
        };
      } catch (apiError) {
        // Log API errors to Sentry with comprehensive debugging info
        if (typeof window !== "undefined") {
          const normalizedError =
            apiError instanceof Error ? apiError : new Error(String(apiError));
          const sigDebug = getSignatureDebugInfo(signature);
          const errorDetails = getErrorDetails(apiError);

          Sentry.captureException(normalizedError, {
            tags: {
              tosStage: "api_submission",
              walletAddress: address,
              signingMethod,
              chainId: String(chainId),
              walletChainId: signingContext.walletChainId,
              expectedChainId: String(chainId),
              connectorName,
              connectorId,
              signatureType: sigDebug.signatureType,
            },
            extra: {
              tosVersion: TOS_VERSION,
              tosHash,
              nonce,
              deadline,
              deadlineHuman: new Date(Number(deadline) * 1000).toISOString(),
              signatureLength: sigDebug.signatureLength,
              signaturePreview: sigDebug.signaturePreview,
              errorMessage: normalizedError.message,
              errorCode: errorDetails.code,
              errorReason: errorDetails.reason,
              errorShortMessage: errorDetails.shortMessage,
              errorInfo: errorDetails.info,
              errorData: errorDetails.data,
              errorCause: errorDetails.cause,
              errorStack: errorDetails.stack,
              isWrongNetwork: requestIsWrongNetwork,
              // Include raw error for nested error objects
              rawError: errorDetails.raw || String(apiError),
            },
          });
        }

        // Some smart wallets produce EIP-712 signatures that fail backend verification.
        // Retry once with personal_sign before surfacing an error.
        const parsedApiError = parseTosApiError(apiError);
        if (shouldRetryTosWithPersonalSign(signingMethod, parsedApiError.type)) {
          try {
            signingMethod = "personal_sign";
            signingContext.signingMethod = signingMethod;
            signature = await signer.signMessage(message);
            signingContext.signature = signature;

            const retryResponse = await fetch("/api/tos/accept", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                wallet: address,
                signature,
                nonce,
                tosVersion: TOS_VERSION,
                tosHash,
                message,
                deadline,
              }),
            });

            const retryBody = await retryResponse.json().catch(() => null);
            if (!retryResponse.ok) {
              throw new Error(
                (retryBody as { error?: string } | null)?.error ||
                  "Failed to accept Terms of Service"
              );
            }

            tosResponse = retryBody as {
              autoLink?: {
                attempted: boolean;
                linked: boolean;
                referralCode?: string;
                error?: string;
              };
            };
          } catch (personalSignRetryError) {
            if (typeof window !== "undefined") {
              const normalizedError =
                personalSignRetryError instanceof Error
                  ? personalSignRetryError
                  : new Error(String(personalSignRetryError));
              const sigDebug = getSignatureDebugInfo(signature);
              const errorDetails = getErrorDetails(personalSignRetryError);

              Sentry.captureException(normalizedError, {
                tags: {
                  tosStage: "api_submission_personal_sign_retry",
                  walletAddress: address,
                  signingMethod: "personal_sign",
                  chainId: String(chainId),
                  walletChainId: signingContext.walletChainId,
                  expectedChainId: String(chainId),
                  connectorName,
                  connectorId,
                  signatureType: sigDebug.signatureType,
                },
                extra: {
                  tosVersion: TOS_VERSION,
                  tosHash,
                  nonce,
                  deadline,
                  deadlineHuman: new Date(Number(deadline) * 1000).toISOString(),
                  signatureLength: sigDebug.signatureLength,
                  signaturePreview: sigDebug.signaturePreview,
                  errorMessage: normalizedError.message,
                  errorCode: errorDetails.code,
                  errorReason: errorDetails.reason,
                  errorShortMessage: errorDetails.shortMessage,
                  errorInfo: errorDetails.info,
                  errorData: errorDetails.data,
                  errorCause: errorDetails.cause,
                  errorStack: errorDetails.stack,
                  isWrongNetwork: requestIsWrongNetwork,
                  rawError: errorDetails.raw || String(personalSignRetryError),
                },
              });
            }
            throw personalSignRetryError;
          }
        } else {
          throw apiError;
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tos-status", address] }),
        queryClient.invalidateQueries({ queryKey: ["referral-status", address] }),
        queryClient.invalidateQueries({ queryKey: ["impact-glow-score", address] }),
      ]);

      if (tosResponse?.autoLink?.linked && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(REFERRAL_AUTO_LINK_EVENT, {
            detail: {
              wallet: address.toLowerCase(),
              referralCode: tosResponse.autoLink.referralCode ?? null,
            },
          })
        );
      }

      setHasAccepted(true);
      setIsOpen(false);
      toast.success(
        tosResponse?.autoLink?.linked
          ? "Terms accepted and referral linked"
          : "Terms of Service accepted successfully"
      );
    } catch (error) {
      const parsedError = parseTosApiError(error);
      setError(parsedError);
      setRetryCount((prev) => prev + 1);

      // Show toast for user rejection (common case)
      if (parsedError.type === "signature_rejected") {
        toast.error("Signature required", {
          description: "Please approve the signature request in your wallet.",
        });
      } else if (parsedError.type === "smart_wallet") {
        // For smart wallet errors, show a more helpful toast
        toast.error("Smart wallet issue detected", {
          description: "See the error details below for help.",
        });
      }

      // Log non-rejection errors to Sentry with comprehensive debugging info
      if (parsedError.type !== "signature_rejected" && typeof window !== "undefined") {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        const sigDebug = getSignatureDebugInfo(signingContext.signature);
        const errorDetails = getErrorDetails(error);

        Sentry.captureException(normalizedError, {
          tags: {
            tosStage: "general_error",
            tosErrorType: parsedError.type,
            walletAddress: address,
            chainId: String(chainId),
            walletChainId: signingContext.walletChainId,
            expectedChainId: String(chainId),
            connectorName,
            connectorId,
            signingMethod: signingContext.signingMethod,
            signatureType: sigDebug.signatureType,
          },
          extra: {
            tosVersion: TOS_VERSION,
            tosHash: signingContext.tosHash || getTosHash(),
            nonce: signingContext.nonce || String(latestNonce),
            deadline: signingContext.deadline,
            deadlineHuman: signingContext.deadline
              ? new Date(Number(signingContext.deadline) * 1000).toISOString()
              : "not set",
            signatureLength: sigDebug.signatureLength,
            signaturePreview: sigDebug.signaturePreview,
            errorMessage: normalizedError.message,
            errorCode: errorDetails.code,
            errorReason: errorDetails.reason,
            errorShortMessage: errorDetails.shortMessage,
            errorInfo: errorDetails.info,
            errorData: errorDetails.data,
            errorCause: errorDetails.cause,
            errorStack: errorDetails.stack,
            errorType: typeof error,
            parsedErrorType: parsedError.type,
            parsedErrorTitle: parsedError.title,
            parsedErrorSuggestion: parsedError.suggestion,
            retryCount,
            isWrongNetwork: requestIsWrongNetwork,
            // Include raw error for nested error objects
            rawError: errorDetails.raw || String(error),
          },
        });
      }

      console.error("Error accepting ToS:", error);
    } finally {
      setIsSigning(false);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId });
      await resolveActiveWalletChainId();
      setError(null);
      toast.success(`Switched to ${expectedNetworkLabel}`);
    } catch (switchError) {
      console.error("Failed to switch network for ToS signing:", switchError);
      toast.error("Failed to switch network", {
        description: "Please switch networks in your wallet and try again.",
      });
    }
  };

  const handleDecline = () => {
    disconnect();
    setIsOpen(false);
    try {
      disconnect();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  // Don't render until initialized to prevent flash
  if (!isInitialized) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        // Completely prevent any closing via onOpenChange
        // Dialog can only be closed via Accept or Decline buttons
        return;
      }}
    >
      <DialogContent
        className="md:max-w-sm md:max-h-[90vh] p-0 z-[100]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-2 border-b-0">
          <DialogTitle className="text-xl md:text-2xl font-bold">
            Welcome to Glow
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-2 space-y-4">
          <p className="text-muted-foreground">
            In order to interact with GLW and use the Glow Application, you must
            accept our Terms of Service. This ensures a safe and compliant
            environment for all users.
          </p>

          <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full justify-between p-4 font-medium hover:bg-muted/50 h-auto"
              >
                <span>Read Full Terms of Service</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isDetailsOpen && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/30 dark:border-border/40">
                <ScrollArea className="h-[300px] px-4 py-4">
                  <div className="space-y-6 text-sm">
                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        1. Acceptance of Terms
                      </h3>
                      <p className="text-muted-foreground mb-3">
                        By connecting your digital wallet to this Application (
                        <strong>app.glow.org</strong>), you (
                        <strong>{address}</strong>) explicitly agree to these
                        Terms of Service. If you do not agree, do not use the
                        Application.
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Eligibility:</span> By
                        using the Application, you represent and warrant that
                        you are at least 18 years of age, or the age of legal
                        majority in your jurisdiction (if higher), and possess
                        the legal authority to agree to these Terms and use the
                        Application lawfully.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        2. User Responsibility
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        <li>
                          The User is solely responsible for their interactions
                          with the Application, including all associated smart
                          contracts and blockchain transactions.
                        </li>
                        <li>
                          Users acknowledge the inherent risks in blockchain
                          technology, including but not limited to financial
                          loss, smart contract vulnerabilities, network
                          disruptions, and regulatory risks.
                        </li>
                      </ul>

                      <p className="text-muted-foreground mt-3">
                        <span className="font-medium">
                          Privacy Acknowledgment:
                        </span>{" "}
                        The Application does not intentionally collect personal
                        data. However, blockchain transactions inherently expose
                        certain transaction-related information publicly,
                        including blockchain addresses and associated metadata.
                        By using the Application, Users acknowledge and accept
                        this inherent blockchain transparency.
                      </p>

                      <p className="text-muted-foreground mt-3">
                        <span className="font-medium">
                          Prohibited Activities:
                        </span>{" "}
                        Users expressly agree not to engage in any unlawful or
                        prohibited activities, including fraud, money
                        laundering, market manipulation, sanction evasion, or
                        any activity otherwise prohibited by applicable law or
                        regulations when using the Application.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        3. No Liability & Warranty Disclaimer
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        <li>
                          The Application and associated smart contracts are
                          provided on an "as-is" basis.
                        </li>
                        <li>
                          The Company explicitly disclaims any responsibility
                          for direct, indirect, incidental, special,
                          consequential, or exemplary damages, including
                          financial loss, arising from or relating to the use of
                          the Application.
                        </li>
                        <li>
                          The Company makes no warranties, express or implied,
                          regarding the reliability, accuracy, completeness, or
                          functionality of the Application or associated smart
                          contracts.
                        </li>
                      </ul>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        4. Regulatory Compliance
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        <li>
                          Users confirm they are not using the Application from
                          any jurisdiction where its use is prohibited or
                          restricted.
                        </li>
                        <li>
                          It is the User's responsibility to comply with
                          applicable local laws and regulations.
                        </li>
                      </ul>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        5. Indemnification
                      </h3>
                      <p className="text-muted-foreground">
                        Users agree to indemnify and hold harmless the Company
                        and its affiliates, officers, employees, and
                        representatives from and against all claims,
                        liabilities, damages, losses, or expenses arising from
                        their use of the Application.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        6. No Custody of Blockchain Assets
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        <li>
                          The Application does not have custody, possession, or
                          control over the User's blockchain assets at any time.
                        </li>
                        <li>
                          Users interact directly with smart contracts and
                          retain full control over their private keys and
                          blockchain assets.
                        </li>
                      </ul>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        7. Modification of Terms
                      </h3>
                      <p className="text-muted-foreground">
                        The Company reserves the right to modify these Terms at
                        any time. Updates will be posted publicly on the
                        Application at{" "}
                        <a
                          href="https://app.glow.org/tos"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          app.glow.org/tos
                        </a>
                        , and Users bear the responsibility to periodically
                        review these Terms. Continued use after changes
                        constitutes acceptance.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        8. Intellectual Property
                      </h3>
                      <p className="text-muted-foreground mb-3">
                        All intellectual property associated with the
                        Application, including trademarks and copyrights,
                        remains the property of the Company.
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium">User Submissions:</span>{" "}
                        Any feedback, suggestions, or submissions provided by
                        Users related to the Application shall be deemed
                        non-confidential. Users hereby grant the Company a
                        perpetual, irrevocable, worldwide, royalty-free, and
                        unrestricted right to use, incorporate, or otherwise
                        exploit such submissions without restriction or
                        compensation.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        9. Arbitration and Dispute Resolution
                      </h3>
                      <p className="text-muted-foreground">
                        Any dispute arising out of or in connection with these
                        Terms or your use of the Application shall be referred
                        to and finally resolved by arbitration administered by
                        the Cayman International Arbitration Centre (CIAC) in
                        accordance with the CIAC Arbitration Rules in force at
                        the time of arbitration. The seat of arbitration shall
                        be George Town, Cayman Islands. The arbitration
                        proceedings shall be conducted in English. The
                        arbitration tribunal's decision shall be final and
                        binding upon all parties.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        10. Governing Law and Jurisdiction
                      </h3>
                      <p className="text-muted-foreground">
                        These Terms shall be governed by and construed in
                        accordance with the laws of the Cayman Islands, without
                        regard to conflicts of law principles. Users agree to
                        submit to the exclusive jurisdiction of the courts
                        located in George Town, Cayman Islands, for purposes of
                        enforcing arbitration decisions or addressing claims not
                        subject to arbitration.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-base mb-2">
                        11. Risk Acknowledgment
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        <li>
                          Users acknowledge and agree they fully understand the
                          risks associated with blockchain technology and
                          related activities.
                        </li>
                        <li>
                          Users are encouraged to perform independent research
                          before engaging in any transactions on the
                          Application.
                        </li>
                      </ul>
                    </div>

                    <div className="pt-4 pb-2">
                      <p className="text-muted-foreground font-medium">
                        By proceeding, Users acknowledge they have read,
                        understood, and accepted these Terms of Service.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        These Terms of Service can be found at{" "}
                        <a
                          href="https://app.glow.org/tos"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          app.glow.org/tos
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-semibold">{error.title}</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>{error.message}</p>
                <p className="text-sm opacity-90">{error.suggestion}</p>
                {error.type === "smart_wallet" && (
                  <div className="mt-3 p-2 bg-background/50 rounded text-xs space-y-1">
                    <p className="font-medium flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      Smart Wallet Tips:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 opacity-90">
                      <li>Ensure your wallet is fully deployed on-chain</li>
                      <li>For multisig wallets, all required signers must approve</li>
                      <li>Try using the wallet's built-in browser if available</li>
                    </ul>
                  </div>
                )}
                {retryCount >= 2 && (
                  <p className="text-xs opacity-75 mt-2">
                    Still having trouble? Try disconnecting your wallet and reconnecting, or use a different wallet.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {showWrongNetworkAlert && (
            <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-semibold">Wrong Network</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>
                  Your wallet is connected to {connectedNetworkLabel}.
                </p>
                <p className="text-sm opacity-90">
                  Please switch to {expectedNetworkLabel} to continue.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="p-3 bg-muted/40 dark:bg-muted/50 rounded-lg border border-border/30 dark:border-border/40">
            <p className="text-sm text-muted-foreground">
              <strong className="text-glow-orange">
                Digital Signature Required:
              </strong>{" "}
              By clicking{" "}
              <strong className="text-glow-orange">"Sign & Accept"</strong>, you
              will be prompted to sign a message with your wallet. This
              signature serves as your legally binding acceptance of these Terms
              of Service.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 gap-2 border-t border-border/30 dark:border-border/40">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isSigning}
          >
            Decline & Disconnect
          </Button>
          <Button
            onClick={isWrongNetwork ? handleSwitchNetwork : handleAcceptTos}
            disabled={isSigning || isSignerLoading || isSwitchingChain}
            variant={error?.canRetry ? "default" : "default"}
          >
            {isSigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing...
              </>
            ) : isSwitchingChain ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Switching...
              </>
            ) : isSignerLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : isWrongNetwork ? (
              `Switch to ${expectedNetworkLabel}`
            ) : error?.canRetry ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </>
            ) : (
              "Sign & Accept"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
