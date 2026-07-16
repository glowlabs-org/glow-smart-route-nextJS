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
  applyBpsFloor,
  estimatePolGctlMint,
  findMintedLpAmount,
  quoteGlwForUsdg,
} from "@/lib/pol-gctl";

const TEST_WALLET = "0x6972B05A0c80064fBE8a10CBc2a2FBCF6fb47D6a";

describe("POL GCTL helpers", () => {
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

  it("estimates liquidity value and GCTL from balanced inputs", () => {
    expect(
      estimatePolGctlMint({
        glw: "10000",
        usdg: "2500",
        glwReserveRaw: 200_000n * 10n ** 18n,
        usdgReserveRaw: 50_000n * 10n ** 6n,
      }),
    ).toEqual({
      usedGlw: "10000.000000000000000000",
      usedUsdg: "2500.000000",
      liquidityUsd: "5000.000000",
      gctlPriceUsd: "0.500000000000000000",
      gctlMinted: "10000.000000",
      usesFullInput: true,
    });
  });

  it("estimates only the pool-ratio portion Uniswap will consume", () => {
    expect(
      estimatePolGctlMint({
        glw: "20000",
        usdg: "2500",
        glwReserveRaw: 200_000n * 10n ** 18n,
        usdgReserveRaw: 50_000n * 10n ** 6n,
      }),
    ).toMatchObject({
      usedGlw: "10000.000000000000000000",
      usedUsdg: "2500.000000",
      liquidityUsd: "5000.000000",
      gctlMinted: "10000.000000",
      usesFullInput: false,
    });
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
        to: TEST_WALLET,
      },
    });
    const data = encodeAbiParameters(parseAbiParameters("uint256"), [123n]);

    const amount = findMintedLpAmount({
      recipient: TEST_WALLET,
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
