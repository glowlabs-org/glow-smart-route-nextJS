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
