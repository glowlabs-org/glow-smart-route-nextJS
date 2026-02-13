import { describe, expect, it } from "vitest";
import {
  millisecondsUntilNextSundayUtc,
  secondsUntilNextSundayUtc,
} from "../lib/time/sunday-cache";

describe("sunday cache window", () => {
  it("computes remaining time to the upcoming Sunday midnight UTC", () => {
    const from = new Date("2026-02-13T19:00:00.000Z"); // Friday
    const ms = millisecondsUntilNextSundayUtc(from);

    expect(ms).toBe(29 * 60 * 60 * 1000);
    expect(secondsUntilNextSundayUtc(from)).toBe(29 * 60 * 60);
  });

  it("rolls to the next week when already on Sunday", () => {
    const from = new Date("2026-02-15T12:00:00.000Z"); // Sunday noon
    const ms = millisecondsUntilNextSundayUtc(from);

    expect(ms).toBe(6.5 * 24 * 60 * 60 * 1000);
  });

  it("returns a full week at Sunday 00:00 UTC", () => {
    const from = new Date("2026-02-15T00:00:00.000Z");
    const ms = millisecondsUntilNextSundayUtc(from);

    expect(ms).toBe(7 * 24 * 60 * 60 * 1000);
    expect(secondsUntilNextSundayUtc(from)).toBe(7 * 24 * 60 * 60);
  });
});
