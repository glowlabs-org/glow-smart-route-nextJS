import { parseReferralError } from "../lib/referral-errors";

describe("referral error helpers", () => {
  it("classifies wallet rejection errors", () => {
    const parsed = parseReferralError(new Error("User rejected the request"));

    expect(parsed.type).toBe("signature_rejected");
    expect(parsed.isUserRejection).toBe(true);
  });

  it("classifies signer mismatch errors from backend text", () => {
    const parsed = parseReferralError(
      new Error("Invalid signature: Signature does not match the wallet address.")
    );

    expect(parsed.type).toBe("signature_mismatch");
    expect(parsed.isUserRejection).toBe(false);
    expect(parsed.message).toContain("reconnect");
  });

  it("classifies domain chain mismatch errors", () => {
    const parsed = parseReferralError(
      new Error("Hub POST /referral/link failed: 401 - domain_chain_mismatch")
    );

    expect(parsed.type).toBe("wrong_chain");
    expect(parsed.isUserRejection).toBe(false);
    expect(parsed.message.toLowerCase()).toContain("network");
  });

  it("classifies viem InvalidParamsRpcError thrown when wallet is on the wrong chain", () => {
    const parsed = parseReferralError(
      new Error(
        "Invalid parameters were provided to the RPC method.\nDouble check you have provided the correct parameters.\n\nDetails: Invalid parameters: active chainId is different than the one provided.\nVersion: viem@2.47.12"
      )
    );

    expect(parsed.type).toBe("wrong_chain");
    expect(parsed.isUserRejection).toBe(false);
  });

  it("classifies the manual switch-required error thrown by ensureCorrectChain", () => {
    const parsed = parseReferralError(
      new Error("Please switch your wallet to Ethereum Mainnet and try again.")
    );

    expect(parsed.type).toBe("wrong_chain");
    expect(parsed.isUserRejection).toBe(false);
  });

  it("classifies wallet-side chain mismatch errors (MetaMask / viem wrapper)", () => {
    const parsed = parseReferralError(
      new Error(
        'Provided chainId "1" must match the active chainId "8453"\nVersion: viem@2.47.12'
      )
    );

    expect(parsed.type).toBe("wrong_chain");
    expect(parsed.isUserRejection).toBe(false);
    expect(parsed.message.toLowerCase()).toContain("network");
  });

  it("classifies deadline expiration errors", () => {
    const parsed = parseReferralError(new Error("Signature deadline has expired."));

    expect(parsed.type).toBe("signature_expired");
    expect(parsed.isUserRejection).toBe(false);
  });

  it("falls back to unknown for unrecognized errors", () => {
    const parsed = parseReferralError(new Error("Custom backend error"));

    expect(parsed.type).toBe("unknown");
    expect(parsed.message).toBe("Custom backend error");
  });
});
