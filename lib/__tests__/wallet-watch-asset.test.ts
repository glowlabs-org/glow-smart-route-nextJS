import { describe, expect, it } from "vitest";
import {
  GLW_WALLET_ASSET,
  buildGlwWalletWatchAssetParams,
  getGlwWalletAssetImageUrl,
} from "../wallet-watch-asset";

describe("wallet-watch-asset", () => {
  it("builds GLW watchAsset params with the expected token metadata", () => {
    expect(GLW_WALLET_ASSET.symbol).toBe("GLW-BETA");
    expect(buildGlwWalletWatchAssetParams()).toEqual({
      type: "ERC20",
      options: GLW_WALLET_ASSET,
    });
  });

  it("includes the image when one is provided", () => {
    expect(
      buildGlwWalletWatchAssetParams("https://app.glow.org/Chrome_192x192.png")
    ).toEqual({
      type: "ERC20",
      options: {
        ...GLW_WALLET_ASSET,
        image: "https://app.glow.org/Chrome_192x192.png",
      },
    });
  });

  it("builds the absolute GLW asset image URL from the site origin", () => {
    expect(getGlwWalletAssetImageUrl("https://app.glow.org")).toBe(
      "https://app.glow.org/Chrome_192x192.png"
    );
  });
});
