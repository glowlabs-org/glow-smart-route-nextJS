"use client";
import { useState, useCallback } from "react";
import { Result, Ok, Err } from "ts-results";

// ---- Types ---------------------------------------------------------------
export interface MintedEvent {
  txId: string;
  epoch: number;
  wallet: string;
  amountWei: string; // Updated from amountUsdcWei
  currency: string; // New field
  gctlMinted: string;
  ts: string; // ISO date string
}

export interface PendingTransfer {
  txId: string;
  wallet: string;
  amountWei: string; // Updated from amountUsdcWei
  type: string; // New field
  currency: string; // New field
  status: string;
  ts: string; // ISO date string
  applicationId?: string;
  farmId?: string; // New field
  regionId?: number;
}

export interface FailedOperation {
  id: string;
  txId: string;
  operation: string;
  failureType: string;
  errorMessage: string;
  errorDetails?: string;
  isRetryable: string;
  retryCount: number;
  lastRetryAt?: string; // ISO date string
  resolvedAt?: string; // ISO date string
  wallet?: string;
  amountWei?: string; // Updated from amountUsdcWei
  currency?: string; // New field
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface GctlPrice {
  currentPriceUsdc: number;
}

// --------------------------------------------------------------------------
const BASE_URL = "/api"; // Use local API routes instead of external API

/**
 * Extract a useful error message from an unknown error value.
 */
function parseApiError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  const possible: any = error;
  return possible?.error?.message ?? possible?.message ?? "Unknown error";
}

export function useGctlApi(walletAddress?: string) {
  // ------------------------- State ---------------------------------------
  const [gctlBalance, setGctlBalance] = useState<string>("0");
  const [gctlPrice, setGctlPrice] = useState<number>(0);
  const [mintedEvents, setMintedEvents] = useState<MintedEvent[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>(
    []
  );
  const [failedOperations, setFailedOperations] = useState<FailedOperation[]>(
    []
  );

  // ----------------------- API helpers -----------------------------------
  const fetchGctlBalance = useCallback(async (): Promise<
    Result<string, string>
  > => {
    if (!walletAddress) return new Err("Wallet address not provided");

    try {
      const res = await fetch(`${BASE_URL}/balance/${walletAddress}`);
      if (!res.ok) throw new Error("Failed to fetch GCTL balance");
      const data = await res.json();

      const balance = (data?.gctl_balance ?? "0").toString();
      setGctlBalance(balance);
      return new Ok(balance);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, [walletAddress]);

  const fetchGctlPrice = useCallback(async (): Promise<
    Result<number, string>
  > => {
    try {
      const res = await fetch(`${BASE_URL}/price`);
      if (!res.ok) throw new Error("Failed to fetch GCTL price");
      const data: GctlPrice = await res.json();
      setGctlPrice(data.currentPriceUsdc);
      return new Ok(data.currentPriceUsdc);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, []);

  const fetchMintedEvents = useCallback(async (): Promise<
    Result<MintedEvent[], string>
  > => {
    try {
      const res = await fetch(`${BASE_URL}/events/minted?page=1&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch minted events");
      const data = await res.json();
      setMintedEvents(data.events ?? []);
      return new Ok(data.events ?? []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, []);

  const fetchPendingTransfers = useCallback(async (): Promise<
    Result<PendingTransfer[], string>
  > => {
    try {
      const res = await fetch(`${BASE_URL}/transfers/pending?page=1&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch pending transfers");
      const data = await res.json();
      setPendingTransfers(data.transfers ?? []);
      return new Ok(data.transfers ?? []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, []);

  const fetchFailedOperations = useCallback(async (): Promise<
    Result<FailedOperation[], string>
  > => {
    try {
      const res = await fetch(`${BASE_URL}/operations/failed?page=1&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch failed operations");
      const data = await res.json();
      setFailedOperations(data.operations ?? []);
      return new Ok(data.operations ?? []);
    } catch (error) {
      return new Err(parseApiError(error));
    }
  }, []);

  // --------------------------- Exports -----------------------------------
  return {
    gctlBalance,
    gctlPrice,
    mintedEvents,
    pendingTransfers,
    failedOperations,
    fetchGctlBalance,
    fetchGctlPrice,
    fetchMintedEvents,
    fetchPendingTransfers,
    fetchFailedOperations,
  } as const;
}
