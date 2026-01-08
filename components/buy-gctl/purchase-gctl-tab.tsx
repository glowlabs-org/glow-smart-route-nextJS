// "use client";
// import React, { useEffect, useState, useRef } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Skeleton } from "@/components/ui/skeleton";
// import { Badge } from "@/components/ui/badge";
// import { useAccount, usePublicClient } from "wagmi";
// import { parseUnits, formatUnits } from "viem";
// import { toast } from "sonner";
// import { Label } from "@/components/ui/label";
// import {
//   Loader2,
//   ArrowDownUp,
//   Info,
//   HelpCircle,
//   Sparkles,
//   Plus,
// } from "lucide-react";
// import { ERC20_ABI } from "@/web3/web3/abis/erc20.abi";
// import { DECIMALS_BY_TOKEN, useForwarder } from "@glowlabs-org/utils/browser";

// import { useGctlApi } from "@/hooks/useGctlApi";
// import { ConnectButton } from "@/components/connect-button";
// import { RegionSelectionModal } from "@/components/buy-gctl/region-selection-modal";
// import { useEthersSigner } from "@/hooks/useEthersSigner";
// import { CHAIN_ID } from "@/web3/constants";

// interface PurchaseGctlTabProps {
//   gctlBalance: string;
//   gctlPrice: number;
//   gctlDataLoading: boolean;
//   onTransactionStart: (txHash: string) => void;
//   fetchPendingTransfers: () => Promise<any>;
//   fetchMintedEvents: () => Promise<any>;
// }

// // Helper function to format large numbers
// const formatLargeNumber = (value: number, decimals: number = 2): string => {
//   if (value >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
//   if (value >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
//   if (value >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`;
//   return value.toFixed(decimals);
// };

// // Helper function to format currency input
// const formatCurrencyInput = (value: string): string => {
//   if (!value) return "";
//   // Remove non-numeric characters except decimal point
//   let cleaned = value.replace(/[^0-9.]/g, "");
//   // Ensure only one decimal point
//   const parts = cleaned.split(".");
//   if (parts.length > 2) {
//     cleaned = parts[0] + "." + parts.slice(1).join("");
//   }
//   // Limit decimal places to 6
//   if (parts[1] && parts[1].length > 6) {
//     cleaned = parts[0] + "." + parts[1].substring(0, 6);
//   }
//   return cleaned;
// };

// export function PurchaseGctlTab({
//   gctlBalance,
//   gctlPrice,
//   gctlDataLoading,
//   onTransactionStart,
//   fetchPendingTransfers,
//   fetchMintedEvents,
// }: PurchaseGctlTabProps) {
//   const { signer } = useEthersSigner();
//   const { address, isConnected } = useAccount();
//   const publicClient = usePublicClient();
//   const chainId = parseInt(CHAIN_ID);
//   const isOnSepolia = chainId === 11155111;

//   // Use the forwarder hook
//   const {
//     mintGCTL,
//     mintGCTLAndStake,
//     checkTokenAllowance,
//     checkTokenBalance,
//     mintTestUSDC,
//     isProcessing,
//     addresses,
//   } = useForwarder(signer as Signer, chainId);

//   // Use GCTL API hook for regions
//   const { regions, isRegionsLoading } = useGctlApi(address);

//   const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
//   const [inputAmount, setInputAmount] = useState<string>("");
//   const [outputAmount, setOutputAmount] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(false);
//   const [usdcBalanceLoading, setUsdcBalanceLoading] = useState<boolean>(true);
//   const [needsApproval, setNeedsApproval] = useState<boolean>(false);
//   const [inputError, setInputError] = useState<string>("");
//   const [showDetails, setShowDetails] = useState<boolean>(false);

//   // Region selection modal state
//   const [showRegionModal, setShowRegionModal] = useState<boolean>(false);
//   const [pendingPurchase, setPendingPurchase] = useState<{
//     usdcAmount: string;
//     gctlAmount: string;
//   } | null>(null);
//   const [isProcessingTransaction, setIsProcessingTransaction] =
//     useState<boolean>(false);

//   const inputRef = useRef<HTMLInputElement>(null);

//   // Fetch USDC balance
//   useEffect(() => {
//     const fetchBalance = async () => {
//       if (!address || !signer) {
//         setUsdcBalanceLoading(false);
//         return;
//       }
//       setUsdcBalanceLoading(true);
//       try {
//         const bal = await checkTokenBalance(address, "USDC");

//         setUsdcBalance(bal);
//       } catch (error) {
//         console.error("Error fetching USDC balance:", error);
//         toast.error("Failed to fetch USDC balance");
//       } finally {
//         setUsdcBalanceLoading(false);
//       }
//     };
//     if (isConnected) fetchBalance();
//     else setUsdcBalanceLoading(false);
//   }, [address, isConnected, signer]);

//   // Check approval status
//   useEffect(() => {
//     const checkApprovalStatus = async () => {
//       if (!address || !inputAmount) return;
//       try {
//         const amount = BigInt(parseUnits(inputAmount, 6).toString());
//         const allowance = await checkTokenAllowance(address);

//         // If current allowance is lower than the required amount we need to ask for approval
//         setNeedsApproval(allowance < amount);
//       } catch (error) {
//         console.error("Error checking approval:", error);
//       }
//     };
//     if (isConnected && inputAmount) checkApprovalStatus();
//   }, [address, inputAmount, isConnected, checkTokenAllowance]);

//   // Validate input and set errors
//   const validateInput = (value: string): string => {
//     if (!value) return "";
//     const numValue = parseFloat(value);
//     if (isNaN(numValue)) return "Please enter a valid number";
//     if (numValue < 1) return "Minimum purchase is 1 USDC";
//     if (numValue > parseFloat(formatUnits(usdcBalance, 6)))
//       return "Insufficient USDC balance";
//     return "";
//   };

//   // Handle input change with dynamic pricing
//   const handleInputChange = (value: string) => {
//     const formatted = formatCurrencyInput(value);
//     setInputAmount(formatted);

//     const error = validateInput(formatted);
//     setInputError(error);

//     if (!formatted || error) {
//       setOutputAmount("");
//       return;
//     }

//     const usdc = parseFloat(formatted);
//     if (isNaN(usdc) || gctlPrice <= 0) {
//       setOutputAmount("");
//       return;
//     }

//     const gctl = usdc / gctlPrice;
//     setOutputAmount(gctl.toFixed(6));
//   };

//   // Handle percentage buttons
//   const handlePercentage = (percentage: number) => {
//     if (usdcBalance === BigInt(0)) return;
//     const balanceInUsdc = parseFloat(formatUnits(usdcBalance, 6));
//     const amount = ((balanceInUsdc * percentage) / 100).toFixed(6);
//     handleInputChange(amount);
//   };

//   // Handle balance click
//   const handleBalanceClick = () => {
//     if (usdcBalance === BigInt(0)) return;
//     const balanceInUsdc = formatUnits(usdcBalance, 6);
//     handleInputChange(balanceInUsdc);
//   };

//   // Handle keyboard events
//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (
//       e.key === "Enter" &&
//       !loading &&
//       !isProcessing &&
//       inputAmount &&
//       !inputError
//     ) {
//       handleBuy();
//     }
//   };

//   // Handle buy button click - now shows region selection modal
//   const handleBuy = async () => {
//     if (!inputAmount || !address || inputError) return;

//     // Store pending purchase data
//     setPendingPurchase({
//       usdcAmount: inputAmount,
//       gctlAmount: outputAmount,
//     });

//     // Show region selection modal
//     setShowRegionModal(true);
//   };

//   // Handle region selection for mint and stake
//   const handleRegionSelection = async (regionId: number) => {
//     if (!pendingPurchase || !address) return;

//     setIsProcessingTransaction(true);
//     setLoading(true);

//     try {
//       const amount = BigInt(
//         parseUnits(pendingPurchase.usdcAmount, 6).toString()
//       );

//       const txHash = await mintGCTLAndStake(amount, address, regionId, "USDC");

//       // Notify parent component about transaction start
//       onTransactionStart(txHash);

//       // Clear form and state after a delay to allow processing modal to show
//       setTimeout(() => {
//         setInputAmount("");
//         setOutputAmount("");
//         setInputError("");
//         setPendingPurchase(null);
//         setShowRegionModal(false);
//         setIsProcessingTransaction(false);
//       }, 1000);

//       // Refresh USDC balance after successful mint
//       if (publicClient) {
//         const bal = (await publicClient.readContract({
//           address: addresses.USDC,
//           abi: ERC20_ABI,
//           functionName: "balanceOf",
//           args: [address],
//         })) as bigint;
//         setUsdcBalance(bal);
//       }

//       // Initial fetch to update pending transfers and minted events
//       setTimeout(() => {
//         fetchPendingTransfers();
//         fetchMintedEvents();
//       }, 5000);
//     } catch (error) {
//       console.error("Mint and stake error:", error);
//       toast.error(
//         `Mint and stake failed: ${
//           error instanceof Error ? error.message : String(error)
//         }`
//       );
//       setIsProcessingTransaction(false);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle skip staking - just mint GCTL
//   const handleSkipStaking = async () => {
//     if (!pendingPurchase || !address) return;

//     setIsProcessingTransaction(true);
//     setLoading(true);

//     try {
//       const amount = BigInt(
//         parseUnits(pendingPurchase.usdcAmount, 6).toString()
//       );
//       const txHash = await mintGCTL(amount, address, "USDC");

//       // Notify parent component about transaction start
//       onTransactionStart(txHash);

//       // Clear form and state after a delay to allow processing modal to show
//       setTimeout(() => {
//         setInputAmount("");
//         setOutputAmount("");
//         setInputError("");
//         setPendingPurchase(null);
//         setShowRegionModal(false);
//         setIsProcessingTransaction(false);
//       }, 1000);

//       // Refresh balance
//       if (publicClient) {
//         const bal = (await publicClient.readContract({
//           address: addresses.USDC,
//           abi: ERC20_ABI,
//           functionName: "balanceOf",
//           args: [address],
//         })) as bigint;
//         setUsdcBalance(bal);
//       }

//       // Initial fetch to check if transaction appears quickly
//       setTimeout(() => {
//         fetchPendingTransfers();
//         fetchMintedEvents();
//       }, 5000);
//     } catch (error) {
//       toast.error(
//         `Transaction failed: ${
//           error instanceof Error ? error.message : String(error)
//         }`
//       );
//       setIsProcessingTransaction(false);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle modal close
//   const handleModalClose = () => {
//     if (!isProcessingTransaction) {
//       setShowRegionModal(false);
//       setPendingPurchase(null);
//     }
//   };

//   // Handle minting test USDC
//   const handleMintTestUSDC = async () => {
//     if (!address) return;

//     try {
//       // Mint 100000 USDC for testing
//       const amount = BigInt(parseUnits("100000", 6).toString());
//       await mintTestUSDC(amount, address);

//       toast.success("Successfully minted 100000 test USDC!");

//       // Refresh USDC balance
//       if (publicClient) {
//         const bal = await checkTokenBalance(address, "USDC");
//         setUsdcBalance(bal);
//       }
//     } catch (error) {
//       console.error("Failed to mint test USDC:", error);
//       toast.error(
//         `Failed to mint test USDC: ${
//           error instanceof Error ? error.message : String(error)
//         }`
//       );
//     }
//   };

//   const usdcBalanceFormatted = parseFloat(
//     formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC)
//   );
//   const gctlBalanceFormatted = parseFloat(
//     formatUnits(BigInt(gctlBalance), DECIMALS_BY_TOKEN.GCTL)
//   );
//   const dynamicButtonText = inputAmount
//     ? `Buy ${outputAmount || "0"} GCTL for ${inputAmount} USDC`
//     : "Enter Amount to Buy GCTL";

//   return (
//     <>
//       {/* Region Selection Modal */}
//       <RegionSelectionModal
//         isOpen={showRegionModal}
//         onClose={handleModalClose}
//         onSelectRegion={handleRegionSelection}
//         onSkipStaking={handleSkipStaking}
//         regions={regions}
//         isRegionsLoading={isRegionsLoading}
//         usdcAmount={pendingPurchase?.usdcAmount || ""}
//         gctlAmount={pendingPurchase?.gctlAmount || ""}
//         isProcessing={isProcessingTransaction}
//       />

//       <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border overflow-hidden w-full">
//         <div className="p-6 sm:p-8">
//           {/* Header Section */}
//           <div className="flex items-center justify-between mb-6">
//             <div className="flex items-center gap-3">
//               <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
//                 <Sparkles className="w-5 h-5 text-white" />
//               </div>
//               <div>
//                 <h2 className="text-2xl font-bold text-foreground">Buy GCTL</h2>
//                 <div className="text-sm text-muted-foreground">
//                   {gctlDataLoading ? (
//                     <Skeleton className="h-4 w-32 mt-1" />
//                   ) : gctlPrice > 0 ? (
//                     <span>1 USDC = {(1 / gctlPrice).toFixed(4)} GCTL</span>
//                   ) : null}
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="space-y-5">
//             {/* User GCTL Balance Display */}
//             {isConnected && (
//               <div className="bg-gradient-to-r from-muted/30 to-muted/20 rounded-2xl p-5 border border-border/50">
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center gap-3">
//                     <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
//                       <span className="text-white font-bold text-lg">G</span>
//                     </div>
//                     <div>
//                       <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
//                         Your Balance
//                       </div>
//                       {gctlDataLoading ? (
//                         <Skeleton className="h-7 w-32" />
//                       ) : (
//                         <div className="text-2xl font-bold text-foreground">
//                           {gctlBalanceFormatted > 999999
//                             ? formatLargeNumber(gctlBalanceFormatted)
//                             : gctlBalanceFormatted.toLocaleString(undefined, {
//                                 maximumFractionDigits: 2,
//                               })}{" "}
//                           <span className="text-sm font-medium text-muted-foreground">
//                             GCTL
//                           </span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                   {!gctlDataLoading && gctlBalanceFormatted > 0 && (
//                     <div className="text-right">
//                       <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
//                         Value
//                       </div>
//                       <div className="text-lg font-semibold text-foreground">
//                         $
//                         {(gctlBalanceFormatted * gctlPrice).toLocaleString(
//                           undefined,
//                           {
//                             minimumFractionDigits: 2,
//                             maximumFractionDigits: 2,
//                           }
//                         )}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}

//             {/* Input Sections Container */}
//             <div className="relative gap-2 flex flex-col">
//               {/* From Section - USDC */}
//               <div className="group relative bg-muted/30 rounded-2xl p-4 lg:p-6 border border-border hover:border-border/60 transition-all duration-300">
//                 <div className="flex items-center justify-between mb-3">
//                   <span className="text-xs lg:text-sm font-medium text-muted-foreground">
//                     You pay
//                   </span>
//                   {isConnected && (
//                     <span className="text-xs lg:text-sm text-muted-foreground">
//                       Balance:{" "}
//                       {usdcBalanceLoading ? (
//                         <Skeleton className="w-16 h-4 inline-block" />
//                       ) : (
//                         <button
//                           onClick={handleBalanceClick}
//                           className="font-medium hover:text-foreground transition-colors"
//                           disabled={usdcBalance === BigInt(0)}
//                         >
//                           {usdcBalanceFormatted > 999999
//                             ? formatLargeNumber(usdcBalanceFormatted)
//                             : usdcBalanceFormatted.toLocaleString(undefined, {
//                                 maximumFractionDigits: 2,
//                               })}
//                         </button>
//                       )}
//                     </span>
//                   )}
//                 </div>

//                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
//                   <div className="flex-1 min-w-0">
//                     <Input
//                       ref={inputRef}
//                       type="text"
//                       placeholder="0.00"
//                       value={inputAmount}
//                       onChange={(e) => handleInputChange(e.target.value)}
//                       onKeyDown={handleKeyDown}
//                       className={`text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full ${
//                         inputError ? "text-red-500" : ""
//                       }`}
//                       disabled={gctlDataLoading || gctlPrice <= 0}
//                       aria-label="USDC amount to spend"
//                     />
//                   </div>

//                   <div className="flex items-center justify-center sm:justify-end">
//                     <div className="flex items-center gap-2 bg-background px-4 py-2.5 rounded-xl border border-border">
//                       <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
//                         <span className="text-xs font-bold text-white">$</span>
//                       </div>
//                       <span className="text-sm font-semibold">USDC</span>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Percentage Buttons */}
//                 {isConnected &&
//                   usdcBalance > BigInt(0) &&
//                   !usdcBalanceLoading && (
//                     <div className="flex gap-2 mt-3">
//                       {[25, 50, 75].map((percentage) => (
//                         <Button
//                           key={percentage}
//                           variant="outline"
//                           size="sm"
//                           onClick={() => handlePercentage(percentage)}
//                           className="h-8 px-3 text-xs hover:bg-muted/50 hover:border-primary transition-all"
//                           disabled={gctlDataLoading || gctlPrice <= 0}
//                         >
//                           {percentage}%
//                         </Button>
//                       ))}
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => handlePercentage(100)}
//                         className="h-8 px-3 text-xs font-medium hover:bg-muted/50 hover:border-primary transition-all"
//                         disabled={gctlDataLoading || gctlPrice <= 0}
//                       >
//                         MAX
//                       </Button>
//                     </div>
//                   )}

//                 {/* Input Error */}
//                 {inputError && (
//                   <div
//                     className="mt-3 text-sm text-red-600 flex items-center gap-2 bg-red-50/50 border border-red-200/50 rounded-xl p-3"
//                     role="alert"
//                   >
//                     <span className="text-red-500">⚠</span>
//                     <span>{inputError}</span>
//                   </div>
//                 )}
//               </div>

//               {/* Enhanced Swap Direction */}
//               <div className="relative py-2">
//                 <div className="absolute inset-0 flex items-center justify-center">
//                   <button
//                     className="bg-background border-4 border-border rounded-full p-2 lg:p-3 hover:bg-muted/30 transition-all duration-200 z-50 opacity-50 cursor-not-allowed"
//                     title="GCTL redemptions disabled in v1.5"
//                     disabled
//                   >
//                     <ArrowDownUp className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
//                   </button>
//                 </div>
//               </div>

//               {/* To Section - GCTL */}
//               <div className="group relative bg-muted/30 rounded-2xl p-4 lg:p-6 border border-border hover:border-border/60 transition-all duration-300">
//                 <div className="flex items-center justify-between mb-3">
//                   <span className="text-xs lg:text-sm font-medium text-muted-foreground">
//                     You receive
//                   </span>
//                   {outputAmount && (
//                     <div className="text-xs text-muted-foreground flex items-center gap-1">
//                       <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
//                       Calculating...
//                     </div>
//                   )}
//                 </div>

//                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
//                   <div className="flex-1 min-w-0">
//                     <Input
//                       type="text"
//                       value={outputAmount || "0.00"}
//                       readOnly
//                       placeholder="0.00"
//                       className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
//                       aria-label="GCTL amount you'll receive"
//                     />
//                   </div>

//                   <div className="flex items-center justify-center sm:justify-end">
//                     <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2.5 rounded-xl border border-green-200/50">
//                       <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
//                         <span className="text-xs font-bold text-white">G</span>
//                       </div>
//                       <span className="text-sm font-semibold text-green-700">
//                         GCTL
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* Exchange Rate Summary */}
//             {inputAmount && outputAmount && !gctlDataLoading && (
//               <div className="bg-gradient-to-r from-muted/10 to-muted/5 rounded-2xl p-4 lg:p-5 border border-border/20">
//                 <div className="flex items-center gap-2 mb-2">
//                   <Info className="w-4 h-4 text-muted-foreground" />
//                   <span className="text-xs lg:text-sm font-medium text-muted-foreground">
//                     Transaction Details
//                   </span>
//                 </div>
//                 <div className="text-sm text-muted-foreground">
//                   You'll receive approximately{" "}
//                   <span className="text-foreground font-semibold">
//                     {parseFloat(outputAmount).toLocaleString(undefined, {
//                       maximumFractionDigits: 6,
//                     })}{" "}
//                     GCTL
//                   </span>
//                 </div>
//               </div>
//             )}

//             {/* Always visible Test USDC Section on Sepolia */}
//             {isConnected && isOnSepolia && (
//               <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-2xl p-5 border border-border/50">
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center gap-3">
//                     <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
//                       <Plus className="w-5 h-5 text-white" />
//                     </div>
//                     <div>
//                       <div className="text-sm font-semibold text-foreground">
//                         Test USDC Faucet
//                       </div>
//                       <div className="text-xs text-muted-foreground">
//                         Get free test USDC for testing
//                       </div>
//                     </div>
//                   </div>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={handleMintTestUSDC}
//                     disabled={isProcessing}
//                     className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-200 hover:from-blue-500/20 hover:to-purple-500/20 transition-all"
//                   >
//                     {isProcessing ? (
//                       <>
//                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                         Minting...
//                       </>
//                     ) : (
//                       <>
//                         <Sparkles className="mr-2 h-4 w-4" />
//                         Mint 10,000 USDC
//                       </>
//                     )}
//                   </Button>
//                 </div>
//               </div>
//             )}

//             {/* Zero Balance State */}
//             {isConnected &&
//               usdcBalance === BigInt(0) &&
//               !usdcBalanceLoading &&
//               !isOnSepolia && (
//                 <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-5 text-center">
//                   <div className="text-amber-800 mb-2 font-semibold">
//                     No USDC Balance Found
//                   </div>
//                   <div className="text-amber-700 text-sm mb-4">
//                     You need USDC to purchase GCTL. Switch to Sepolia testnet to
//                     get test USDC.
//                   </div>
//                 </div>
//               )}

//             {/* Buy Button */}
//             <div className="pt-4">
//               {!isConnected ? (
//                 <ConnectButton
//                   variant="default"
//                   className="w-full h-12 lg:h-16"
//                 />
//               ) : (
//                 <Button
//                   className="w-full h-12 lg:h-16 text-lg font-semibold"
//                   onClick={handleBuy}
//                   disabled={
//                     !isOnSepolia ||
//                     !inputAmount ||
//                     !!inputError ||
//                     loading ||
//                     isProcessing ||
//                     gctlDataLoading ||
//                     gctlPrice <= 0
//                   }
//                 >
//                   {loading || isProcessing ? (
//                     <>
//                       <div className="mr-3">
//                         <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
//                       </div>
//                       {needsApproval
//                         ? "Approving & Purchasing..."
//                         : "Processing..."}
//                     </>
//                   ) : !isOnSepolia ? (
//                     "Switch to Sepolia"
//                   ) : gctlDataLoading ? (
//                     <>
//                       <div className="mr-3">
//                         <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
//                       </div>
//                       Loading Data...
//                     </>
//                   ) : gctlPrice <= 0 ? (
//                     <>
//                       <div className="mr-3">
//                         <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
//                       </div>
//                       Loading Price...
//                     </>
//                   ) : inputError ? (
//                     "Fix Errors Above"
//                   ) : !inputAmount ? (
//                     "Enter Amount"
//                   ) : (
//                     dynamicButtonText
//                   )}
//                 </Button>
//               )}
//             </div>

//             {/* Network Warning */}
//             {isConnected && !isOnSepolia && (
//               <div className="bg-red-50/50 border border-red-200/50 rounded-2xl p-4">
//                 <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
//                   <span className="text-red-500">⚠</span>
//                   <span>Please switch to Sepolia Testnet to purchase GCTL</span>
//                 </div>
//               </div>
//             )}

//             {/* Enhanced Info Section */}
//             <div className="border-t border-border/50 pt-6">
//               <button
//                 onClick={() => setShowDetails(!showDetails)}
//                 className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors p-4 rounded-2xl hover:bg-muted/30"
//               >
//                 <div className="flex items-center gap-2">
//                   <Info className="w-4 h-4" />
//                   <span className="font-medium">How GCTL Works</span>
//                 </div>
//                 <svg
//                   className={`w-4 h-4 transition-transform ${
//                     showDetails ? "rotate-180" : ""
//                   }`}
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M19 9l-7 7-7-7"
//                   />
//                 </svg>
//               </button>

//               {showDetails && (
//                 <div className="mt-4 bg-gradient-to-r from-muted/10 to-muted/5 rounded-2xl p-5 space-y-4 text-sm border border-border/20">
//                   <div className="flex items-start gap-3">
//                     <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-foreground mb-1">
//                         Flexible Purchase Options
//                       </p>
//                       <p className="text-muted-foreground">
//                         Choose to mint GCTL only, or mint and stake to a region
//                         for rewards
//                       </p>
//                     </div>
//                   </div>

//                   <div className="flex items-start gap-3">
//                     <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-foreground mb-1">
//                         Off-chain Processing
//                       </p>
//                       <p className="text-muted-foreground">
//                         No gas fees required. GCTL is credited to your account
//                         database instantly
//                       </p>
//                     </div>
//                   </div>

//                   <div className="flex items-start gap-3">
//                     <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-foreground mb-1">
//                         Fast Processing
//                       </p>
//                       <p className="text-muted-foreground">
//                         GCTL is credited within ~1 minute of your transaction
//                         confirmation
//                       </p>
//                     </div>
//                   </div>

//                   <div className="flex items-start gap-3">
//                     <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-foreground mb-1">
//                         Staking Rewards
//                       </p>
//                       <p className="text-muted-foreground">
//                         Stakes are locked for ~2 years but earn rewards based on
//                         your selected region
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }
