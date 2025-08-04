"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  CreditCard,
  Info,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAccount, usePublicClient, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { DECIMALS_BY_TOKEN, useForwarder } from "@glowlabs-org/utils/browser";

import { BigNumber } from "ethers";
import { ConnectButton } from "@/components/connect-button";
import { ERC20_ABI } from "@/web3/web3/abis/erc20.abi";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { CHAIN_ID } from "@/web3/constants";

// Constants
const HUB_URL = "https://gca-crm-backend-staging.up.railway.app";

const USDC_DECIMALS = DECIMALS_BY_TOKEN.USDC;
const VALIDATION_DEBOUNCE_MS = 500;

// Types
interface ProtocolFeeTabProps {}

interface Zone {
  id: number;
  name: string;
  createdAt: Date;
  requirementSetId: number;
  requirementSet: {
    id: number;
    name: string;
    createdAt: Date;
    code: string;
  };
}

interface ApplicationData {
  finalProtocolFee: string;
  status: string;
  currentStep: number;
  isCancelled: boolean;
  createdAt: string;
  zone: Zone;
  walletAddress: string;
  gcaAddress: string;
}

interface FormState {
  applicationId: string;
  amount: string;
  regionId: string;
  mintAndStake: boolean;
}

interface ValidationState {
  isValidatingApp: boolean;
  applicationData: ApplicationData | null;
  applicationError: string;
  amountError: string;
}

interface BalanceState {
  usdcBalance: bigint;
  usdcBalanceLoading: boolean;
  needsApproval: boolean;
}

// Custom hooks
const useApplicationValidation = () => {
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidatingApp: false,
    applicationData: null,
    applicationError: "",
    amountError: "",
  });

  const validateApplication = useCallback(async (appId: string) => {
    if (!appId.trim()) {
      setValidationState((prev) => ({
        ...prev,
        applicationData: null,
        applicationError: "",
      }));
      return null;
    }

    setValidationState((prev) => ({
      ...prev,
      isValidatingApp: true,
      applicationError: "",
    }));

    try {
      const requestUrl = `${HUB_URL}/applications/by-application-id/?applicationId=${appId}`;
      const response = await fetch(requestUrl);

      if (response.ok) {
        const data: ApplicationData = await response.json();
        setValidationState((prev) => ({
          ...prev,
          isValidatingApp: false,
          applicationData: data,
          applicationError: "",
        }));
        return data;
      } else if (response.status === 404) {
        setValidationState((prev) => ({
          ...prev,
          isValidatingApp: false,
          applicationData: null,
          applicationError: "Application not found",
        }));
        return null;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Network error while validating application";

      setValidationState((prev) => ({
        ...prev,
        isValidatingApp: false,
        applicationData: null,
        applicationError: errorMessage,
      }));
      console.error("Application validation error:", error);
      return null;
    }
  }, []);

  const clearValidation = useCallback(() => {
    setValidationState({
      isValidatingApp: false,
      applicationData: null,
      applicationError: "",
      amountError: "",
    });
  }, []);

  const setAmountError = useCallback((error: string) => {
    setValidationState((prev) => ({ ...prev, amountError: error }));
  }, []);

  return {
    ...validationState,
    validateApplication,
    clearValidation,
    setAmountError,
  };
};

const useBalanceState = (
  address: `0x${string}` | undefined,
  usdcAddress: `0x${string}`,
  isConnected: boolean
) => {
  const publicClient = usePublicClient();
  const [balanceState, setBalanceState] = useState<BalanceState>({
    usdcBalance: BigInt(0),
    usdcBalanceLoading: true,
    needsApproval: false,
  });

  const fetchBalance = useCallback(async () => {
    if (!address || !publicClient) {
      setBalanceState((prev) => ({ ...prev, usdcBalanceLoading: false }));
      return;
    }

    setBalanceState((prev) => ({ ...prev, usdcBalanceLoading: true }));

    try {
      const balance = (await publicClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      setBalanceState((prev) => ({
        ...prev,
        usdcBalance: balance,
        usdcBalanceLoading: false,
      }));
    } catch (error) {
      console.error("Failed to fetch USDC balance:", error);
      toast.error("Failed to fetch USDC balance");
      setBalanceState((prev) => ({ ...prev, usdcBalanceLoading: false }));
    }
  }, [address, publicClient, usdcAddress]);

  useEffect(() => {
    if (isConnected) {
      fetchBalance();
    } else {
      setBalanceState((prev) => ({ ...prev, usdcBalanceLoading: false }));
    }
  }, [isConnected, fetchBalance]);

  const setNeedsApproval = useCallback((needs: boolean) => {
    setBalanceState((prev) => ({ ...prev, needsApproval: needs }));
  }, []);

  return {
    ...balanceState,
    fetchBalance,
    setNeedsApproval,
  };
};

// Sub-components
interface PaymentTypeSwitchProps {
  mintAndStake: boolean;
  onToggle: (value: boolean) => void;
}

function PaymentTypeSwitch({ mintAndStake, onToggle }: PaymentTypeSwitchProps) {
  const paymentOptions = [
    {
      id: "protocol-fee",
      value: false,
      title: "Protocol Fee Only",
      description: "Pay USDC directly as protocol fee",
      icon: "💳",
    },
    {
      id: "mint-gctl",
      value: true,
      title: "Pay with GCTL",
      description: "Pay USDC, mint GCTL, and stake to region",
      icon: "🚀",
    },
  ];

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-muted-foreground">
        Payment Method
      </Label>
      <div className="grid grid-cols-2 gap-3">
        {paymentOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-left ${
              mintAndStake === option.value
                ? "border-purple-500 bg-purple-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {/* Selection indicator */}
            <div className="absolute top-3 right-3">
              <div
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  mintAndStake === option.value
                    ? "border-purple-500 bg-purple-500"
                    : "border-gray-300 bg-white"
                }`}
              >
                {mintAndStake === option.value && (
                  <div className="w-full h-full rounded-full bg-white scale-[0.4]" />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="pr-8">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">{option.icon}</span>
                <h3
                  className={`font-medium text-sm ${
                    mintAndStake === option.value
                      ? "text-purple-900"
                      : "text-gray-900"
                  }`}
                >
                  {option.title}
                </h3>
              </div>
              <p
                className={`text-xs leading-relaxed ${
                  mintAndStake === option.value
                    ? "text-purple-700"
                    : "text-gray-600"
                }`}
              >
                {option.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ApplicationInputProps {
  applicationId: string;
  onApplicationIdChange: (value: string) => void;
  isValidating: boolean;
  applicationData: ApplicationData | null;
  applicationError: string;
}

function ApplicationInput({
  applicationId,
  onApplicationIdChange,
  isValidating,
  applicationData,
  applicationError,
}: ApplicationInputProps) {
  const getInputClassName = () => {
    const baseClass =
      "h-12 border-2 focus:border-primary transition-all duration-200 bg-background/50";
    if (applicationError)
      return `${baseClass} border-red-500 focus:border-red-500`;
    if (applicationData)
      return `${baseClass} border-green-500 focus:border-green-500`;
    return baseClass;
  };

  const renderStatusIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (applicationData) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (applicationError) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-muted-foreground">
        Application ID *
      </Label>
      <div className="relative">
        <Input
          type="text"
          placeholder="Enter application ID..."
          value={applicationId}
          onChange={(e) => onApplicationIdChange(e.target.value)}
          className={getInputClassName()}
          disabled={isValidating}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {renderStatusIcon()}
        </div>
      </div>

      {/* Application validation feedback */}
      {applicationData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-900">
              Application found: {applicationData.zone.name} (Zone{" "}
              {applicationData.zone.id})
            </span>
          </div>
          <div className="text-xs text-green-700 mt-1 space-y-1">
            <p>Status: {applicationData.status}</p>
            <p>
              Protocol Fee:{" "}
              {formatUnits(
                BigInt(applicationData.finalProtocolFee),
                USDC_DECIMALS
              )}{" "}
              USDC
            </p>
            <p>
              Created:{" "}
              {new Date(applicationData.createdAt).toLocaleDateString()}
            </p>
            {applicationData.isCancelled && (
              <p className="text-red-600 font-medium">
                ⚠️ Application is cancelled
              </p>
            )}
            {applicationData.status === "payment-confirmed" && (
              <p className="text-orange-600 font-medium">
                ✅ Protocol fees have already been paid
              </p>
            )}
            {applicationData.status !== "waiting-for-payment" &&
              applicationData.status !== "payment-confirmed" &&
              !applicationData.isCancelled && (
                <p className="text-yellow-600 font-medium">
                  ⏳ Application not ready for payment (status:{" "}
                  {applicationData.status})
                </p>
              )}
          </div>
        </div>
      )}

      {applicationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">{applicationError}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface AmountInputProps {
  amount: string;
  amountError: string;
  usdcBalance: bigint;
  usdcBalanceLoading: boolean;
  isConnected: boolean;
  applicationData: ApplicationData | null;
  applicationId: string;
  isValidatingApp: boolean;
}

function AmountInput({
  amount,
  amountError,
  usdcBalance,
  usdcBalanceLoading,
  isConnected,
  applicationData,
  applicationId,
  isValidatingApp,
}: AmountInputProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium text-muted-foreground">
          Protocol Fee Amount (USDC) *
        </Label>
        {isConnected && (
          <div className="text-sm text-muted-foreground">
            {usdcBalanceLoading ? (
              <div className="flex items-center space-x-1">
                <span>Balance:</span>
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            ) : (
              <span>
                Balance: {formatUnits(usdcBalance, USDC_DECIMALS)} USDC
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <Input
          type="text"
          placeholder="Select application to see fee"
          value={amount}
          className={`h-12 text-lg font-medium pr-16 border-2 bg-muted/30 cursor-not-allowed transition-all duration-200 ${
            amountError ? "border-red-500" : "border-muted"
          }`}
          readOnly
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="text-sm font-medium text-muted-foreground">
            USDC
          </span>
        </div>
      </div>

      {!applicationData && applicationId && !isValidatingApp && (
        <p className="text-xs text-muted-foreground">
          Amount will be auto-filled based on the application&apos;s protocol
          fee
        </p>
      )}

      {amountError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">{amountError}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface NetworkWarningProps {
  isOnSepolia: boolean;
}

function NetworkWarning({ isOnSepolia }: NetworkWarningProps) {
  if (isOnSepolia) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center space-x-2 text-red-700 font-medium text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>Please switch to Sepolia Testnet to pay protocol fees</span>
      </div>
    </div>
  );
}

// Main component
export function ProtocolFeeTab({}: ProtocolFeeTabProps) {
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner();
  const chainId = parseInt(CHAIN_ID);
  const isOnSepolia = chainId === 11155111;

  const {
    payProtocolFee,
    payProtocolFeeAndMintGCTLAndStake,
    checkTokenAllowance,
    isProcessing,
    addresses,
  } = useForwarder(signer ?? undefined, chainId);

  // Form state
  const [formState, setFormState] = useState<FormState>({
    applicationId: "",
    amount: "",
    regionId: "",
    mintAndStake: false,
  });

  // Custom hooks
  const {
    isValidatingApp,
    applicationData,
    applicationError,
    amountError,
    validateApplication,
    clearValidation,
    setAmountError,
  } = useApplicationValidation();

  const {
    usdcBalance,
    usdcBalanceLoading,
    needsApproval,
    fetchBalance,
    setNeedsApproval,
  } = useBalanceState(address, addresses.USDC, isConnected);

  // Debounced application validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formState.applicationId) {
        validateApplication(formState.applicationId);
      } else {
        clearValidation();
      }
    }, VALIDATION_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [formState.applicationId, validateApplication, clearValidation]);

  // Auto-fill form when application data changes
  useEffect(() => {
    if (applicationData) {
      setFormState((prev) => ({
        ...prev,
        amount: applicationData.finalProtocolFee
          ? formatUnits(BigInt(applicationData.finalProtocolFee), USDC_DECIMALS)
          : "",
        regionId: applicationData.zone?.id
          ? applicationData.zone.id.toString()
          : "",
      }));
      setAmountError(""); // Clear any previous amount errors
    } else {
      setFormState((prev) => ({
        ...prev,
        amount: "",
        regionId: "",
      }));
    }
  }, [applicationData, setAmountError]);

  // Validate amount
  const validateAmount = useCallback(
    (value: string): string => {
      if (!value) return "";
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return "Please enter a valid number";
      if (numValue <= 0) return "Amount must be greater than 0";
      if (numValue > parseFloat(formatUnits(usdcBalance, USDC_DECIMALS))) {
        return "Insufficient USDC balance";
      }
      return "";
    },
    [usdcBalance]
  );

  // Auto-validate amount when it changes
  useEffect(() => {
    if (formState.amount) {
      const error = validateAmount(formState.amount);
      setAmountError(error);
    }
  }, [formState.amount, validateAmount, setAmountError]);

  // Check approval status
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!address || !formState.amount) return;

      try {
        const amountBN = BigNumber.from(
          parseUnits(formState.amount, USDC_DECIMALS).toString()
        );
        const allowance = await checkTokenAllowance(address);

        // If allowance is less than required payment amount we need to ask for approval
        setNeedsApproval(allowance.lt(amountBN));
      } catch (error) {
        console.error("Error checking approval:", error);
      }
    };

    if (isConnected && formState.amount) {
      checkApprovalStatus();
    }
  }, [
    address,
    formState.amount,
    isConnected,
    checkTokenAllowance,
    setNeedsApproval,
  ]);

  const isFormValid = useMemo(
    () =>
      formState.applicationId &&
      formState.amount &&
      applicationData &&
      !applicationError &&
      !amountError &&
      !applicationData.isCancelled &&
      applicationData.status === "waiting-for-payment",
    [
      formState.applicationId,
      formState.amount,
      applicationData,
      applicationError,
      amountError,
    ]
  );

  const clearForm = useCallback(() => {
    setFormState({
      applicationId: "",
      amount: "",
      regionId: "",
      mintAndStake: false,
    });
    clearValidation();
  }, [clearValidation]);

  const handlePayment = async () => {
    if (
      !formState.applicationId ||
      !formState.amount ||
      !address ||
      applicationError ||
      amountError
    ) {
      return;
    }

    try {
      const amountBN = BigNumber.from(
        parseUnits(formState.amount, USDC_DECIMALS).toString()
      );

      if (formState.mintAndStake) {
        const regionIdNum = formState.regionId
          ? parseInt(formState.regionId)
          : undefined;
        await payProtocolFeeAndMintGCTLAndStake(
          amountBN,
          address,
          formState.applicationId,
          regionIdNum
        );
      } else {
        await payProtocolFee(amountBN, address, formState.applicationId);
      }

      toast.success(
        `Protocol fee payment ${
          formState.mintAndStake ? "with GCTL minting and staking " : ""
        }initiated!`
      );

      clearForm();
      await fetchBalance();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(
        `Payment failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const getButtonText = () => {
    if (isProcessing) {
      return needsApproval ? "Approving & Paying..." : "Processing Payment...";
    }
    if (!isOnSepolia) return "Switch to Sepolia";
    if (isValidatingApp) return "Validating Application...";

    // More specific validation messages
    if (applicationData?.isCancelled) return "Application is Cancelled";
    if (applicationData?.status === "payment-confirmed")
      return "Fees Already Paid";
    if (applicationData && applicationData.status !== "waiting-for-payment") {
      return "Application Not Ready for Payment";
    }
    if (!isFormValid) return "Complete Form to Continue";

    return `Pay ${formState.amount || "0"} USDC${
      formState.mintAndStake ? " using GCTL" : ""
    }`;
  };

  const getButtonIcon = () => {
    if (isProcessing || isValidatingApp) {
      return <Loader2 className="mr-3 h-5 w-5 animate-spin" />;
    }
    return null;
  };

  return (
    <Card className="border border-border bg-white/95 backdrop-blur-sm w-full">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-xl font-semibold text-foreground flex items-center">
          <div className="w-6 h-6 bg-purple-500 rounded-lg mr-3 flex items-center justify-center">
            <CreditCard className="w-3 h-3 text-white" />
          </div>
          Pay Protocol Fee
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <PaymentTypeSwitch
          mintAndStake={formState.mintAndStake}
          onToggle={(value) =>
            setFormState((prev) => ({ ...prev, mintAndStake: value }))
          }
        />

        <ApplicationInput
          applicationId={formState.applicationId}
          onApplicationIdChange={(value) =>
            setFormState((prev) => ({ ...prev, applicationId: value }))
          }
          isValidating={isValidatingApp}
          applicationData={applicationData}
          applicationError={applicationError}
        />

        <AmountInput
          amount={formState.amount}
          amountError={amountError}
          usdcBalance={usdcBalance}
          usdcBalanceLoading={usdcBalanceLoading}
          isConnected={isConnected}
          applicationData={applicationData}
          applicationId={formState.applicationId}
          isValidatingApp={isValidatingApp}
        />

        {/* Payment Button */}
        {!isConnected ? (
          <ConnectButton
            variant="default"
            size="large"
            className="w-full rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          />
        ) : (
          <Button
            className="w-full h-14 text-base font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={handlePayment}
            disabled={
              !isOnSepolia || !isFormValid || isProcessing || isValidatingApp
            }
          >
            {getButtonIcon()}
            {getButtonText()}
          </Button>
        )}

        <NetworkWarning isOnSepolia={isOnSepolia} />
      </CardContent>
    </Card>
  );
}
