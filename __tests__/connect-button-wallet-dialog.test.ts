import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("connect button wallet dialog", () => {
  it("uses the local wallet options dialog instead of the AppKit connect view", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/connect-button.tsx"),
      "utf8"
    );

    expect(source).toContain("WalletOptions");
    expect(source).toContain("<Dialog");
    expect(source).not.toContain('open({ view: "Connect", namespace: "eip155" })');
  });
});
