import { describe, it, expect } from "vitest";

import {
  parseSwapInputValue,
  toUnitsDecimal,
} from "@/utils/swap-input";

describe("parseSwapInputValue", () => {
  it("passes valid integer input through", () => {
    expect(parseSwapInputValue("2")).toBe("2");
    expect(parseSwapInputValue("100")).toBe("100");
  });

  it("passes valid decimal input through", () => {
    expect(parseSwapInputValue("0.5")).toBe("0.5");
    expect(parseSwapInputValue("1.234567")).toBe("1.234567");
  });

  it("treats comma as decimal separator for EU locales", () => {
    expect(parseSwapInputValue("1,5")).toBe("1.5");
    expect(parseSwapInputValue("0,0001")).toBe("0.0001");
  });

  it("allows an empty string to clear the input", () => {
    expect(parseSwapInputValue("")).toBe("");
  });

  it("allows leading decimal point while typing", () => {
    expect(parseSwapInputValue(".5")).toBe(".5");
  });

  it("allows trailing decimal point while typing", () => {
    expect(parseSwapInputValue("1.")).toBe("1.");
  });

  it("rejects alpha/symbol characters (returns null so state stays as-is)", () => {
    expect(parseSwapInputValue("abc")).toBeNull();
    expect(parseSwapInputValue("1e5")).toBeNull();
    expect(parseSwapInputValue("1+1")).toBeNull();
    expect(parseSwapInputValue("$5")).toBeNull();
  });

  it("rejects negative-signed input (the leading '-' fails the digit-only regex)", () => {
    // Unreachable in practice because the regex gate strips '-' first, but
    // the numeric check is kept as a defense-in-depth layer for future
    // looser regexes. Both "-1" and "-0.5" are ignored (returns null).
    expect(parseSwapInputValue("-1")).toBeNull();
    expect(parseSwapInputValue("-0.5")).toBeNull();
  });

  it("does not crash on whitespace-only input", () => {
    // whitespace fails the regex (non-digits) -> null
    expect(parseSwapInputValue("   ")).toBeNull();
  });
});

describe("toUnitsDecimal", () => {
  it("converts decimal strings to bigint atomic units", () => {
    expect(toUnitsDecimal("1", 6)).toBe(1_000_000n);
    expect(toUnitsDecimal("2.5", 6)).toBe(2_500_000n);
    expect(toUnitsDecimal("0.123456", 6)).toBe(123_456n);
  });

  it("truncates beyond the configured decimals (never rounds up)", () => {
    expect(toUnitsDecimal("0.1234567", 6)).toBe(123_456n);
    expect(toUnitsDecimal("0.9999999", 6)).toBe(999_999n);
  });

  it("handles 18-decimal tokens", () => {
    expect(toUnitsDecimal("1", 18)).toBe(10n ** 18n);
    expect(toUnitsDecimal("0.5", 18)).toBe(5n * 10n ** 17n);
  });

  it("returns 0 for empty / zero / non-positive inputs", () => {
    expect(toUnitsDecimal("", 6)).toBe(0n);
    expect(toUnitsDecimal("0", 6)).toBe(0n);
    expect(toUnitsDecimal("0.000000", 6)).toBe(0n);
    expect(toUnitsDecimal("-5", 6)).toBe(0n);
  });

  it("returns 0 rather than throwing on malformed input", () => {
    expect(toUnitsDecimal("abc", 6)).toBe(0n);
    expect(toUnitsDecimal("1.2.3", 6)).toBe(0n);
    expect(toUnitsDecimal("NaN", 6)).toBe(0n);
  });

  it("survives very large inputs without precision loss", () => {
    // 1,000,000,000 USDC = 1e9 * 1e6 = 1e15 atomic
    expect(toUnitsDecimal("1000000000", 6)).toBe(1_000_000_000_000_000n);
    // 1e18 GLW (1B tokens at 18 decimals) — well past JS Number safe range
    expect(toUnitsDecimal("1000000000", 18)).toBe(10n ** 27n);
  });
});
