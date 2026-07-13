import { describe, expect, it } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  type Address,
  type TransactionReceipt,
} from "viem";

import { sumErc20TransfersTo } from "@/lib/transaction-receipts";

const token = "0x0000000000000000000000000000000000000010" as Address;
const otherToken = "0x0000000000000000000000000000000000000020" as Address;
const sender = "0x0000000000000000000000000000000000000030" as Address;
const recipient = "0x0000000000000000000000000000000000000040" as Address;
const otherRecipient =
  "0x0000000000000000000000000000000000000050" as Address;

function transferLog({
  address,
  to,
  value,
}: {
  address: Address;
  to: Address;
  value: bigint;
}): TransactionReceipt["logs"][number] {
  return {
    address,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: "Transfer",
      args: { from: sender, to },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  } as unknown as TransactionReceipt["logs"][number];
}

describe("sumErc20TransfersTo", () => {
  it("sums only confirmed transfers from the requested token to the recipient", () => {
    const logs = [
      {
        address: token,
        topics: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ],
        data: "0x",
      } as unknown as TransactionReceipt["logs"][number],
      transferLog({ address: token, to: recipient, value: 20n }),
      transferLog({ address: token, to: recipient, value: 30n }),
      transferLog({ address: token, to: otherRecipient, value: 40n }),
      transferLog({ address: otherToken, to: recipient, value: 50n }),
    ];

    expect(sumErc20TransfersTo({ logs, token, recipient })).toBe(50n);
  });
});
