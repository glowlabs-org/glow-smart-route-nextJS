import {
  isValidWalletAddress,
  parseStakeCapContact,
} from "../lib/stake-cap-notify";

describe("stake cap notify helpers", () => {
  it("parses email contacts", () => {
    const contact = parseStakeCapContact("user@example.com");
    expect(contact).toEqual({ type: "email", value: "user@example.com" });
  });

  it("parses telegram handles", () => {
    const contact = parseStakeCapContact("@glow_user");
    expect(contact).toEqual({ type: "telegram", value: "@glow_user" });
  });

  it("parses telegram urls", () => {
    const contact = parseStakeCapContact("https://t.me/glowuser");
    expect(contact).toEqual({ type: "telegram", value: "@glowuser" });
  });

  it("rejects invalid contacts", () => {
    expect(parseStakeCapContact("not-a-contact")).toBeNull();
  });

  it("validates wallet addresses", () => {
    expect(
      isValidWalletAddress("0x0000000000000000000000000000000000000000")
    ).toBe(true);
    expect(isValidWalletAddress("0x123")).toBe(false);
  });
});
