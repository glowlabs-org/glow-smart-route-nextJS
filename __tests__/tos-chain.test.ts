import { normalizeChainId, resolveWalletChainId } from "../lib/tos-chain";

describe("tos chain helpers", () => {
  describe("normalizeChainId", () => {
    it("normalizes number, bigint, decimal, and hex chain IDs", () => {
      expect(normalizeChainId(1)).toBe(1);
      expect(normalizeChainId(11155111n)).toBe(11155111);
      expect(normalizeChainId("8453")).toBe(8453);
      expect(normalizeChainId("0x279f")).toBe(10143);
    });

    it("returns undefined for invalid values", () => {
      expect(normalizeChainId(undefined)).toBeUndefined();
      expect(normalizeChainId(null)).toBeUndefined();
      expect(normalizeChainId(0)).toBeUndefined();
      expect(normalizeChainId(-1)).toBeUndefined();
      expect(normalizeChainId(" ")).toBeUndefined();
      expect(normalizeChainId("not-a-number")).toBeUndefined();
      expect(normalizeChainId("0x")).toBeUndefined();
    });
  });

  describe("resolveWalletChainId", () => {
    it("prefers connector eth_chainId when available", async () => {
      const request = vi.fn().mockResolvedValue("0x1");

      const resolved = await resolveWalletChainId({
        connectorClient: { request },
        signerProvider: {
          send: vi.fn().mockResolvedValue("0x279f"),
        },
        fallbackChainId: 11155111,
      });

      expect(resolved).toBe(1);
      expect(request).toHaveBeenCalledWith({ method: "eth_chainId", params: [] });
    });

    it("falls back to signer provider send when connector request fails", async () => {
      const resolved = await resolveWalletChainId({
        connectorClient: {
          request: vi.fn().mockRejectedValue(new Error("connector offline")),
        },
        signerProvider: {
          send: vi.fn().mockResolvedValue("0x279f"),
        },
      });

      expect(resolved).toBe(10143);
    });

    it("falls back to signer provider getNetwork when send is unavailable", async () => {
      const resolved = await resolveWalletChainId({
        connectorClient: {
          request: vi.fn().mockResolvedValue("invalid"),
        },
        signerProvider: {
          getNetwork: vi.fn().mockResolvedValue({ chainId: 11155111n }),
        },
      });

      expect(resolved).toBe(11155111);
    });

    it("falls back to provided fallback chain ID", async () => {
      const resolved = await resolveWalletChainId({
        connectorClient: {
          request: vi.fn().mockResolvedValue("invalid"),
        },
        signerProvider: {
          send: vi.fn().mockResolvedValue("invalid"),
          getNetwork: vi.fn().mockResolvedValue({ chainId: "invalid" }),
        },
        fallbackChainId: "0x1",
      });

      expect(resolved).toBe(1);
    });

    it("returns undefined when no source can resolve a chain ID", async () => {
      const resolved = await resolveWalletChainId({
        connectorClient: {
          request: vi.fn().mockResolvedValue("invalid"),
        },
        signerProvider: {
          send: vi.fn().mockRejectedValue(new Error("rpc unavailable")),
          getNetwork: vi.fn().mockResolvedValue({ chainId: "invalid" }),
        },
      });

      expect(resolved).toBeUndefined();
    });
  });
});
