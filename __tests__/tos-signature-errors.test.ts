import {
  parseTosApiError,
  shouldRetryTosWithPersonalSign,
} from "../lib/tos-signature-errors";

describe("tos signature error helpers", () => {
  describe("parseTosApiError", () => {
    it("maps backend wallet mismatch text to signature_mismatch", () => {
      const parsed = parseTosApiError(
        new Error("Invalid signature: Signature does not match the wallet address.")
      );

      expect(parsed.type).toBe("signature_mismatch");
      expect(parsed.canRetry).toBe(true);
    });

    it("maps ERC-1271 errors to smart_wallet", () => {
      const parsed = parseTosApiError(
        new Error("Smart wallet signature verification failed (erc-1271)")
      );

      expect(parsed.type).toBe("smart_wallet");
    });

    it("maps wallet rejection errors to signature_rejected", () => {
      const parsed = parseTosApiError(new Error("User rejected the request"));

      expect(parsed.type).toBe("signature_rejected");
      expect(parsed.title).toBe("Signature Rejected");
    });
  });

  describe("shouldRetryTosWithPersonalSign", () => {
    it("retries for eip712 smart wallet failures", () => {
      expect(shouldRetryTosWithPersonalSign("eip712", "smart_wallet")).toBe(true);
    });

    it("retries for eip712 signer mismatch failures", () => {
      expect(shouldRetryTosWithPersonalSign("eip712", "signature_mismatch")).toBe(
        true
      );
    });

    it("does not retry for personal_sign or unrelated error types", () => {
      expect(
        shouldRetryTosWithPersonalSign("personal_sign", "smart_wallet")
      ).toBe(false);
      expect(
        shouldRetryTosWithPersonalSign("eip712", "network_error")
      ).toBe(false);
    });
  });
});
