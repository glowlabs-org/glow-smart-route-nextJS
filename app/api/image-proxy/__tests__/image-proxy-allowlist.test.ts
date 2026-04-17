import { describe, expect, it } from "vitest";

import { isAllowedRemoteImageUrl } from "@/app/api/image-proxy/image-proxy-allowlist";

describe("isAllowedRemoteImageUrl", () => {
  it("allows approved remote image hosts", () => {
    expect(
      isAllowedRemoteImageUrl(
        "https://pub-e71c2d06062242109db2bdd6b0bb5ee0.r2.dev/example.jpg",
      ),
    ).toBe(true);
    expect(
      isAllowedRemoteImageUrl(
        "https://lh3.googleusercontent.com/d/1kdmO2yfSrE38Vqf90LBdhH-4LNEmYnx2=w1600",
      ),
    ).toBe(true);
    expect(
      isAllowedRemoteImageUrl(
        "https://images.unsplash.com/photo-123?fit=crop&w=1200&q=80",
      ),
    ).toBe(true);
    expect(
      isAllowedRemoteImageUrl(
        "https://foo.mypinata.cloud/ipfs/bar.png",
      ),
    ).toBe(true);
  });

  it("rejects non-https or unapproved hosts", () => {
    expect(
      isAllowedRemoteImageUrl(
        "http://lh3.googleusercontent.com/d/1kdmO2yfSrE38Vqf90LBdhH-4LNEmYnx2=w1600",
      ),
    ).toBe(false);
    expect(
      isAllowedRemoteImageUrl(
        "https://example.com/image.jpg",
      ),
    ).toBe(false);
    expect(
      isAllowedRemoteImageUrl(
        "not-a-url",
      ),
    ).toBe(false);
  });
});
