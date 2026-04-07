import {
  buildReferralWrongChainError,
  getReferralChainLabel,
  getReferralExpectedChainId,
  isReferralWrongChain,
} from "../lib/referral-chain";

const originalChainId = process.env.NEXT_PUBLIC_CHAIN_ID;

describe("referral chain helpers", () => {
  afterEach(() => {
    if (originalChainId === undefined) {
      delete process.env.NEXT_PUBLIC_CHAIN_ID;
      return;
    }

    process.env.NEXT_PUBLIC_CHAIN_ID = originalChainId;
  });

  it("falls back to mainnet when NEXT_PUBLIC_CHAIN_ID is unset", () => {
    delete process.env.NEXT_PUBLIC_CHAIN_ID;

    expect(getReferralExpectedChainId()).toBe(1);
    expect(getReferralChainLabel()).toBe("Mainnet");
  });

  it("reads the configured referral chain id", () => {
    process.env.NEXT_PUBLIC_CHAIN_ID = "11155111";

    expect(getReferralExpectedChainId()).toBe(11155111);
    expect(getReferralChainLabel()).toBe("Sepolia");
  });

  it("detects referral wrong-chain states", () => {
    process.env.NEXT_PUBLIC_CHAIN_ID = "1";

    expect(isReferralWrongChain(8453)).toBe(true);
    expect(isReferralWrongChain(1)).toBe(false);
    expect(isReferralWrongChain(undefined)).toBe(false);
  });

  it("builds a domain_chain_mismatch error message", () => {
    process.env.NEXT_PUBLIC_CHAIN_ID = "1";

    expect(buildReferralWrongChainError(8453).message).toContain(
      "domain_chain_mismatch"
    );
    expect(buildReferralWrongChainError(8453).message).toContain(
      "connected_chain=8453"
    );
  });
});
