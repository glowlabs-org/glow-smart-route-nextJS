/**
 * Points-shop restock timing helpers.
 *
 * The V2 points shop restocks every Tuesday at 9:00 AM America/New_York,
 * following Eastern Time including daylight saving. These helpers drive
 * the `s-maxage` on `/api/points-shop/current` so the cached inventory
 * revalidates right around the restock boundary, and the countdown
 * shown on the shop home page.
 */

const MS_PER_SECOND = 1_000;

/** Eastern Time UTC offset in hours for a given instant: 4 (EDT) or 5 (EST). */
function easternOffsetHours(at: Date): number {
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  // EDT = UTC-4, EST = UTC-5. Default to EST if the lookup is unexpected.
  return tzName === "EDT" ? 4 : 5;
}

/**
 * The next Tuesday 9:00 AM America/New_York at or after `from`, as a Date
 * (UTC instant). If `from` is exactly a restock moment, returns the
 * following week's restock.
 */
export function nextShopRestock(from: Date = new Date()): Date {
  // Walk up to 8 candidate days; for each, build the UTC instant that
  // corresponds to 9:00 AM ET on that calendar day and pick the first
  // Tuesday strictly after `from`.
  for (let dayOffset = 0; dayOffset <= 8; dayOffset += 1) {
    const candidate = new Date(
      Date.UTC(
        from.getUTCFullYear(),
        from.getUTCMonth(),
        from.getUTCDate() + dayOffset,
        12, // provisional noon UTC; refined below once we know the offset
        0,
        0,
        0,
      ),
    );
    // Determine the ET calendar weekday for this candidate day.
    const etWeekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(candidate);
    if (etWeekday !== "Tue") continue;

    const offset = easternOffsetHours(candidate);
    const restock = new Date(
      Date.UTC(
        candidate.getUTCFullYear(),
        candidate.getUTCMonth(),
        candidate.getUTCDate(),
        9 + offset, // 9 AM ET expressed in UTC
        0,
        0,
        0,
      ),
    );
    if (restock.getTime() > from.getTime()) return restock;
  }
  // Unreachable in practice (a Tuesday always falls within 8 days).
  return new Date(from.getTime() + 7 * 24 * 60 * 60 * MS_PER_SECOND);
}

/**
 * Seconds from `from` until the next shop restock, clamped to >= 1.
 * Use as the `s-maxage` for the cached shop-inventory response.
 */
export function secondsUntilNextShopRestock(from: Date = new Date()): number {
  const delta = nextShopRestock(from).getTime() - from.getTime();
  return Math.max(1, Math.floor(delta / MS_PER_SECOND));
}
