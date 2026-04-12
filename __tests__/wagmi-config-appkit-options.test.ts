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

  it("registers existing wagmi connectors with Reown on startup", () => {
    const sourcePath = path.join(process.cwd(), "lib", "wagmi-config.ts");
    const source = fs.readFileSync(sourcePath, "utf8");

    expect(source).toContain("INITIAL_CONNECTOR_SYNC_READY_KEY");
    expect(source).toContain("connectors.map((connector: any) =>");
    expect(source).toContain("addWagmiConnector(connector, {})");
  });
});
