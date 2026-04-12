import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("wagmi Coinbase connector id", () => {
  it("uses the Coinbase extension rdns so AppKit can resolve the selected wallet", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/wagmi-config.ts"),
      "utf8"
    );

    expect(source).toContain('id: "com.coinbase.wallet"');
    expect(source).not.toContain('id: "coinbaseWallet"');
  });

  it("uses the Phantom extension rdns so AppKit can resolve the selected wallet", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/wagmi-config.ts"),
      "utf8"
    );

    expect(source).toContain('id: "app.phantom"');
    expect(source).not.toContain('id: "phantom"');
  });
});
