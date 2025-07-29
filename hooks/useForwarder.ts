import { useEthersSigner } from "./useEthersSigner";
import { BigNumber, ethers } from "ethers";
import { Result, Ok, Err } from "ts-results";
import { useState } from "react";
import { FORWARDER_ABI } from "@/web3/web3/abis/forwarder.abi";
import { ERC20_ABI } from "@/web3/web3/abis/erc20.abi";

// Addresses - for sepolia
const ADDRESSES = {
  USDC: "0x93c898be98cd2618ba84a6dccf5003d3bbe40356" as `0x${string}`,
  FORWARDER: "0x9c1d61303D46BFAb1eC5F25c12A1Bf4cB3d06416" as `0x${string}`,
  FOUNDATION_WALLET:
    "0x5e230FED487c86B90f6508104149F087d9B1B0A7" as `0x${string}`,
};

// Addresses - for mainnet
// TODO: update addresses

export enum ForwarderError {
  CONTRACT_NOT_AVAILABLE = "Contract not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
  UNKNOWN_ERROR = "Unknown error",
  INVALID_FORWARD_TYPE = "Invalid forward type",
  MISSING_REQUIRED_PARAMS = "Missing required parameters",
}

// Forward types based on API router documentation
export type ForwardType =
  | "PayProtocolFeeAndMintGCTLAndStake"
  | "PayProtocolFee"
  | "MintGCTLAndStake"
  | "MintGCTL"
  | "BuySolarFarm";

// Currency types
export type Currency = "USDC";

// Forward parameters interface
export interface ForwardParams {
  amount: BigNumber;
  userAddress: string;
  type: ForwardType;
  currency?: Currency;
  applicationId?: string;
  farmId?: string;
  regionId?: number;
}

// Utility to extract the most useful revert reason from an ethers error object
function parseEthersError(error: unknown): string {
  if (!error) return "Unknown error";
  const possibleError: any = error;

  // If the error originates from a callStatic it will often be found at `error?.error?.body`
  if (possibleError?.error?.body) {
    try {
      const body = JSON.parse(possibleError.error.body);
      // Hardhat style errors
      if (body?.error?.message) return body.error.message as string;
    } catch {}
  }

  // Found on MetaMask/Alchemy shape errors
  if (possibleError?.data?.message) return possibleError.data.message as string;
  if (possibleError?.error?.message)
    return possibleError.error.message as string;

  // Standard ethers v5 message
  if (possibleError?.reason) return possibleError.reason as string;
  if (possibleError?.message) return possibleError.message as string;

  return ForwarderError.UNKNOWN_ERROR;
}

export function useForwarder() {
  const signer = useEthersSigner();
  const [isProcessing, setIsProcessing] = useState(false);

  // Returns a contract instance for Forwarder
  function getForwarderContract() {
    if (!signer) return undefined;
    return new ethers.Contract(ADDRESSES.FORWARDER, FORWARDER_ABI, signer);
  }

  /**
   * Construct the message for the forward call based on type and parameters
   */
  function constructForwardMessage(
    params: ForwardParams
  ): Result<string, ForwarderError> {
    const { type, applicationId, farmId, regionId, userAddress } = params;

    switch (type) {
      case "PayProtocolFeeAndMintGCTLAndStake":
        if (!applicationId) {
          return new Err(ForwarderError.MISSING_REQUIRED_PARAMS);
        }
        return new Ok(`PayProtocolFeeAndMintGCTLAndStake::${applicationId}`);

      case "PayProtocolFee":
        if (!applicationId) {
          return new Err(ForwarderError.MISSING_REQUIRED_PARAMS);
        }
        return new Ok(`PayProtocolFee::${applicationId}`);

      case "MintGCTLAndStake":
        if (!regionId) {
          return new Err(ForwarderError.MISSING_REQUIRED_PARAMS);
        }
        return new Ok(`MintGCTLAndStake::${regionId}`);

      case "MintGCTL":
        if (!userAddress) {
          return new Err(ForwarderError.MISSING_REQUIRED_PARAMS);
        }
        return new Ok(`MintGCTL::${userAddress}`);

      case "BuySolarFarm":
        if (!farmId) {
          return new Err(ForwarderError.MISSING_REQUIRED_PARAMS);
        }
        return new Ok(`BuySolarFarm::${farmId}`);

      default:
        return new Err(ForwarderError.INVALID_FORWARD_TYPE);
    }
  }

  /**
   * Get the appropriate token contract based on currency
   */
  function getTokenContract(currency: Currency = "USDC") {
    if (!signer) return undefined;

    // For now, only USDC is supported
    let tokenAddress: string;
    switch (currency) {
      case "USDC":
        tokenAddress = ADDRESSES.USDC;
        break;
      default:
        throw new Error(
          `Currency ${currency} not yet supported. Only USDC is currently supported.`
        );
    }

    return new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  }

  /**
   * Check current token allowance for the forwarder contract
   * @param owner The wallet address to check allowance for
   * @param currency The currency to check allowance for
   */
  async function checkTokenAllowance(
    owner: string,
    currency: Currency = "USDC"
  ): Promise<Result<BigNumber, ForwarderError | string>> {
    try {
      const tokenContract = getTokenContract(currency);
      if (!tokenContract) return new Err(ForwarderError.CONTRACT_NOT_AVAILABLE);

      const allowance: BigNumber = await tokenContract.allowance(
        owner,
        ADDRESSES.FORWARDER
      );
      return new Ok(allowance);
    } catch (error) {
      return new Err(parseEthersError(error));
    }
  }

  /**
   * Approve tokens for the forwarder contract
   * @param amount Amount to approve (BigNumber)
   * @param currency The currency to approve
   */
  async function approveToken(
    amount: BigNumber,
    currency: Currency = "USDC"
  ): Promise<Result<boolean, ForwarderError | string>> {
    try {
      const tokenContract = getTokenContract(currency);
      if (!tokenContract) return new Err(ForwarderError.CONTRACT_NOT_AVAILABLE);
      if (!signer) return new Err(ForwarderError.SIGNER_NOT_AVAILABLE);

      setIsProcessing(true);

      // Use MaxUint256 for unlimited approval
      const approveTx = await tokenContract.approve(
        ADDRESSES.FORWARDER,
        ethers.constants.MaxUint256
      );
      await approveTx.wait();

      return new Ok(true);
    } catch (error) {
      return new Err(parseEthersError(error));
    } finally {
      setIsProcessing(false);
    }
  }

  /**
   * Forward tokens through the forwarder contract with type-specific handling
   * @param params Forward parameters including type, amount, and required fields
   */
  async function forwardTokens(
    params: ForwardParams
  ): Promise<Result<string, ForwarderError | string>> {
    try {
      const forwarderContract = getForwarderContract();
      if (!forwarderContract)
        return new Err(ForwarderError.CONTRACT_NOT_AVAILABLE);
      if (!signer) return new Err(ForwarderError.SIGNER_NOT_AVAILABLE);

      setIsProcessing(true);

      const { amount, currency = "USDC" } = params;
      const tokenContract = getTokenContract(currency);
      if (!tokenContract) return new Err(ForwarderError.CONTRACT_NOT_AVAILABLE);

      const owner = await signer.getAddress();

      // Construct the appropriate message for this forward type
      const messageResult = constructForwardMessage(params);
      if (messageResult.err) {
        return new Err(messageResult.val);
      }
      const message = messageResult.val;

      // Check allowance and approve if necessary
      const allowance: BigNumber = await tokenContract.allowance(
        owner,
        ADDRESSES.FORWARDER
      );

      if (allowance.lt(amount)) {
        try {
          const approveTx = await tokenContract.approve(
            ADDRESSES.FORWARDER,
            ethers.constants.MaxUint256
          );
          await approveTx.wait();
        } catch (approveError) {
          return new Err(
            parseEthersError(approveError) || "Token approval failed"
          );
        }
      }

      // only usdc is supported for now
      const tokenAddress = ADDRESSES.USDC;

      // Run a static call first to surface any revert reason
      try {
        await forwarderContract.callStatic.forward(
          tokenAddress,
          ADDRESSES.FOUNDATION_WALLET,
          amount,
          message,
          { from: owner }
        );
      } catch (staticError) {
        return new Err(parseEthersError(staticError));
      }

      // Execute the forward transaction
      const tx = await forwarderContract.forward(
        tokenAddress,
        ADDRESSES.FOUNDATION_WALLET,
        amount,
        message
      );
      await tx.wait();

      return new Ok(tx.hash);
    } catch (txError: any) {
      return new Err(parseEthersError(txError));
    } finally {
      setIsProcessing(false);
    }
  }

  /**
   * Forward USDC for protocol fee payment and GCTL minting with staking
   */
  async function payProtocolFeeAndMintGCTLAndStake(
    amount: BigNumber,
    userAddress: string,
    applicationId: string,
    regionId?: number
  ): Promise<Result<string, ForwarderError | string>> {
    return forwardTokens({
      amount,
      userAddress,
      type: "PayProtocolFeeAndMintGCTLAndStake",
      currency: "USDC",
      applicationId,
      regionId,
    });
  }

  /**
   * Forward USDC for protocol fee payment only
   */
  async function payProtocolFee(
    amount: BigNumber,
    userAddress: string,
    applicationId: string
  ): Promise<Result<string, ForwarderError | string>> {
    return forwardTokens({
      amount,
      userAddress,
      type: "PayProtocolFee",
      currency: "USDC",
      applicationId,
    });
  }

  /**
   * Forward USDC to mint GCTL and stake to a region
   */
  async function mintGCTLAndStake(
    amount: BigNumber,
    userAddress: string,
    regionId?: number
  ): Promise<Result<string, ForwarderError | string>> {
    return forwardTokens({
      amount,
      userAddress,
      type: "MintGCTLAndStake",
      currency: "USDC",
      regionId,
    });
  }

  /**
   * Forward USDC to mint GCTL (existing functionality, keeping for compatibility)
   */
  async function mintGCTL(
    amount: BigNumber,
    userAddress: string
  ): Promise<Result<string, ForwarderError | string>> {
    return forwardTokens({
      amount,
      userAddress,
      type: "MintGCTL",
      currency: "USDC",
    });
  }

  /**
   * Forward tokens to buy a solar farm
   */
  async function buySolarFarm(
    amount: BigNumber,
    userAddress: string,
    farmId: string,
    currency: Currency = "USDC"
  ): Promise<Result<string, ForwarderError | string>> {
    return forwardTokens({
      amount,
      userAddress,
      type: "BuySolarFarm",
      currency,
      farmId,
    });
  }

  /**
   * Estimate gas for forwarding with type-specific handling
   * @param params Forward parameters
   * @param ethPriceInUSD Current ETH price in USD (for cost estimation)
   */
  async function estimateGasForForward(
    params: ForwardParams,
    ethPriceInUSD: number | null
  ): Promise<Result<string, ForwarderError | string>> {
    try {
      const forwarderContract = getForwarderContract();
      if (!forwarderContract)
        return new Err(ForwarderError.CONTRACT_NOT_AVAILABLE);
      if (!signer) return new Err(ForwarderError.SIGNER_NOT_AVAILABLE);

      const { amount, currency = "USDC" } = params;

      // Construct the appropriate message for this forward type
      const messageResult = constructForwardMessage(params);
      if (messageResult.err) {
        return new Err(messageResult.val);
      }
      const message = messageResult.val;

      // Get token address
      const tokenAddress = currency === "USDC" ? ADDRESSES.USDC : currency;

      const gasPrice = await signer.getGasPrice();
      const estimatedGas = await forwarderContract.estimateGas.forward(
        tokenAddress,
        ADDRESSES.FOUNDATION_WALLET,
        amount,
        message
      );
      const estimatedCost = estimatedGas.mul(gasPrice);

      if (ethPriceInUSD) {
        const estimatedCostInEth = ethers.utils.formatEther(estimatedCost);
        const estimatedCostInUSD = (
          parseFloat(estimatedCostInEth) * ethPriceInUSD
        ).toFixed(2);
        return new Ok(estimatedCostInUSD);
      } else {
        return new Err(
          "Could not fetch the ETH price to calculate cost in USD."
        );
      }
    } catch (error: any) {
      return new Err(parseEthersError(error));
    }
  }

  /**
   * Mint test USDC (only works on testnets with mintable USDC contracts)
   * @param amount Amount of USDC to mint (BigNumber, 6 decimals)
   * @param recipient Address to mint USDC to
   */
  async function mintTestUSDC(
    amount: BigNumber,
    recipient: string
  ): Promise<Result<string, ForwarderError | string>> {
    try {
      const usdcContract = getTokenContract("USDC"); // Use getTokenContract for consistency
      if (!usdcContract) return new Err(ForwarderError.CONTRACT_NOT_AVAILABLE);
      if (!signer) return new Err(ForwarderError.SIGNER_NOT_AVAILABLE);

      setIsProcessing(true);

      // Try to call mint function (common for test tokens)
      const tx = await usdcContract.mint(recipient, amount);
      await tx.wait();

      return new Ok(tx.hash);
    } catch (error: any) {
      // If mint function doesn't exist or fails, provide helpful error
      const errorMessage = parseEthersError(error);
      if (errorMessage.includes("mint")) {
        return new Err("This USDC contract doesn't support minting");
      }
      return new Err(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }

  return {
    // New methods for different forward types
    forwardTokens,
    payProtocolFeeAndMintGCTLAndStake,
    payProtocolFee,
    mintGCTLAndStake,
    mintGCTL,
    buySolarFarm,

    // Token operations
    approveToken,
    checkTokenAllowance,

    // Utility methods
    estimateGasForForward,
    mintTestUSDC,
    constructForwardMessage,

    // State
    isProcessing,
    addresses: ADDRESSES,
  };
}
