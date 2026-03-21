import { describe, expect, it } from "vitest";
import {
  INVALID_WALLET_TX_RESPONSE_MESSAGE,
  normalizeTxHash,
} from "../normalize-tx-hash";

const TX_HASH = `0x${"a".repeat(64)}` as const;
const BLOCK_HASH = `0x${"b".repeat(64)}` as const;

describe("normalizeTxHash", () => {
  it("returns a raw transaction hash unchanged", () => {
    expect(normalizeTxHash(TX_HASH)).toBe(TX_HASH);
  });

  it("extracts nested transaction hashes from wallet response envelopes", () => {
    const response = {
      jsonrpc: "2.0",
      result: {
        receipt: {
          transactionHash: TX_HASH,
        },
      },
    };

    expect(normalizeTxHash(response)).toBe(TX_HASH);
  });

  it("searches recursively through maps and arrays returned by wallet adapters", () => {
    const response = new Map<string, unknown>([
      [
        "result",
        [
          {
            receipt: new Map<string, unknown>([["transactionHash", TX_HASH]]),
          },
        ],
      ],
    ]);

    expect(normalizeTxHash(response)).toBe(TX_HASH);
  });

  it("prefers transaction hash fields over unrelated hashes elsewhere in the payload", () => {
    const response = {
      meta: {
        blockHash: BLOCK_HASH,
      },
      receipt: {
        transactionHash: TX_HASH,
      },
    };

    expect(normalizeTxHash(response)).toBe(TX_HASH);
  });

  it("falls back to any nested 32-byte hash when wallets use an unknown response shape", () => {
    const response = {
      payload: {
        values: [
          {
            tx: {
              id: TX_HASH,
            },
          },
        ],
      },
    };

    expect(normalizeTxHash(response)).toBe(TX_HASH);
  });

  it("throws the wallet response error when no transaction hash is present", () => {
    expect(() =>
      normalizeTxHash({
        result: {
          value: "not-a-hash",
        },
      })
    ).toThrow(INVALID_WALLET_TX_RESPONSE_MESSAGE);
  });
});
