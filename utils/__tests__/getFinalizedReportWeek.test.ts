import { describe, expect, it } from "vitest";
import { getFinalizedReportWeek } from "../getFinalizedReportWeek";

describe("getFinalizedReportWeek", () => {
  it("stays one week behind before the Thursday publish buffer", () => {
    expect(getFinalizedReportWeek(new Date("2026-03-26T00:30:00.000Z"))).toBe(
      120,
    );
  });

  it("advances after the Thursday publish buffer", () => {
    expect(getFinalizedReportWeek(new Date("2026-03-26T01:30:00.000Z"))).toBe(
      121,
    );
  });

  it("keeps the published week stable later in the protocol week", () => {
    expect(getFinalizedReportWeek(new Date("2026-03-29T09:00:00.028Z"))).toBe(
      121,
    );
  });
});
