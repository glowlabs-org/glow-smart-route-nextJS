import fs from "node:fs";
import path from "node:path";

describe("wagmi AppKit options", () => {
  it("disables AppKit auto-added wallet connectors", () => {
    const sourcePath = path.join(process.cwd(), "lib", "wagmi-config.ts");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain("enableCoinbase: false");
    expect(source).toContain("enableInjected: false");
    expect(source).toContain("enableWalletConnect: false");
  });
});
