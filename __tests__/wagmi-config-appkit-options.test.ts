import fs from "node:fs";
import path from "node:path";

describe("wagmi AppKit options", () => {
  it("disables AppKit auto-added generic injected connector", () => {
    const sourcePath = path.join(process.cwd(), "lib", "wagmi-config.ts");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain("enableInjected: false");
    expect(source).not.toContain("enableCoinbase: false");
  });

  it("keeps WalletConnect enabled for QR codes and mobile deep links", () => {
    const sourcePath = path.join(process.cwd(), "lib", "wagmi-config.ts");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("enableWalletConnect: false");
  });
});
