import { describe, expect, it } from "vitest";
import {
  encodeEventTopics,
  encodeAbiParameters,
  parseAbiParameters,
  type Hex,
} from "viem";
import {
  POL_GCTL_ENDOWMENT_WALLET,
  POL_GCTL_LP_TOKEN,
  POL_GCTL_MINTER_WALLET,
  applyBpsFloor,
  findMintedLpAmount,
  isPolGctlMinterWallet,
  quoteGlwForUsdg,
} from "@/lib/pol-gctl";

describe("POL GCTL helpers", () => {
  it("matches only David's configured minter wallet", () => {
    expect(isPolGctlMinterWallet(POL_GCTL_MINTER_WALLET.toLowerCase())).toBe(
      true,
    );
    expect(
      isPolGctlMinterWallet("0x1111111111111111111111111111111111111111"),
    ).toBe(false);
  });

  it("quotes the matching GLW amount without using floating point", () => {
    expect(
      quoteGlwForUsdg({
        usdg: "2500",
        glwReserveRaw: 200_000n * 10n ** 18n,
        usdgReserveRaw: 50_000n * 10n ** 6n,
      }),
    ).toBe("10000");
  });

  it("applies slippage with bigint flooring", () => {
    expect(applyBpsFloor(1_000_001n, 100)).toBe(990_000n);
  });

  it("extracts only zero-address LP mints to the connected wallet", () => {
    const topics = encodeEventTopics({
      abi: [
        {
          type: "event",
          name: "Transfer",
          inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: false, name: "value", type: "uint256" },
          ],
        },
      ],
      eventName: "Transfer",
      args: {
        from: "0x0000000000000000000000000000000000000000",
        to: POL_GCTL_MINTER_WALLET,
      },
    });
    const data = encodeAbiParameters(parseAbiParameters("uint256"), [123n]);

    const amount = findMintedLpAmount({
      recipient: POL_GCTL_MINTER_WALLET,
      logs: [
        {
          address: POL_GCTL_LP_TOKEN,
          blockHash: null,
          blockNumber: null,
          data,
          logIndex: null,
          removed: false,
          topics: topics as [Hex, ...Hex[]],
          transactionHash: null,
          transactionIndex: null,
        },
        {
          address: POL_GCTL_LP_TOKEN,
          blockHash: null,
          blockNumber: null,
          data,
          logIndex: null,
          removed: false,
          topics: encodeEventTopics({
            abi: [
              {
                type: "event",
                name: "Transfer",
                inputs: [
                  { indexed: true, name: "from", type: "address" },
                  { indexed: true, name: "to", type: "address" },
                  { indexed: false, name: "value", type: "uint256" },
                ],
              },
            ],
            eventName: "Transfer",
            args: {
              from: "0x0000000000000000000000000000000000000000",
              to: POL_GCTL_ENDOWMENT_WALLET,
            },
          }) as [Hex, ...Hex[]],
          transactionHash: null,
          transactionIndex: null,
        },
      ],
    });

    expect(amount).toBe(123n);
  });
});
