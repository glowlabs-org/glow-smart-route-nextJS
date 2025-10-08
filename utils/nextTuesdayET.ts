// Computes the next Tuesday at 1:00 PM America/New_York (ET), from the current moment.
// If today is Tuesday but past 1:00 PM ET, it returns next week's Tuesday.
export function getNextTuesdayAt1pmET(fromDate: Date = new Date()): Date {
  // Work with the local time initially
  const now = new Date(fromDate.getTime());

  // We will compute the next Tuesday in ET by iterating days, then set time to 13:00 ET and convert to UTC Date
  const msPerDay = 24 * 60 * 60 * 1000;
  // Start from today in ET by using the ET components
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  function getETParts(d: Date) {
    const parts = formatter.formatToParts(d);
    const lookup: Record<string, number> = {} as any;
    for (const p of parts) {
      if (p.type !== "literal") {
        lookup[p.type] = Number(p.value);
      }
    }
    // month is 1-based in parts
    return {
      year: lookup.year,
      month: lookup.month,
      day: lookup.day,
      hour: lookup.hour,
      minute: lookup.minute,
      second: lookup.second,
      // 0=Sunday..6=Saturday in ET for given instant:
      weekday: new Date(
        Date.UTC(
          lookup.year,
          lookup.month - 1,
          lookup.day,
          lookup.hour,
          lookup.minute,
          lookup.second
        )
      ).getUTCDay(),
    };
  }

  // Find how many days to add to reach Tuesday (2)
  // Determine the ET weekday for 'now'
  const etNow = getETParts(now);
  const TUESDAY = 2; // 0=Sun
  let addDays = (TUESDAY - etNow.weekday + 7) % 7;

  // Construct target ET date at 13:00:00 on that Tuesday
  // If today is Tuesday and time already >= 13:00 ET, move to next week
  if (addDays === 0) {
    const isPastOnePm =
      etNow.hour > 13 ||
      (etNow.hour === 13 && (etNow.minute > 0 || etNow.second > 0));
    if (isPastOnePm) addDays = 7;
  }

  const candidate = new Date(now.getTime() + addDays * msPerDay);
  const etCandidate = getETParts(candidate);

  // Build a string representing 13:00:00 ET on the candidate's ET date
  const etString = `${etCandidate.year}-${String(etCandidate.month).padStart(
    2,
    "0"
  )}-${String(etCandidate.day).padStart(2, "0")}T13:00:00`;

  // Parse that as if it's in ET by using Date with timeZone via toLocaleString workaround:
  // Create a Date corresponding to that ET wall time by first interpreting it as UTC, then adjust using offset difference between ET and UTC at that date.
  // Compute offset by formatting that intended ET time in UTC and ET to get the difference.

  // First, create a UTC date from the string (treating as UTC temporarily)
  const tempUtc = new Date(etString + "Z");

  // Get the ET components for the intended wall time (13:00 ET)
  const intendedET = getETParts(tempUtc);

  // Build a UTC date that has the same ET wall components but treated as UTC
  const utcFromETWall = Date.UTC(
    intendedET.year,
    intendedET.month - 1,
    intendedET.day,
    13,
    0,
    0
  );

  // Determine the actual instant that corresponds to 13:00 ET by finding the offset between ET and UTC at that date
  // Offset (in minutes) between ET and UTC at that instant
  const etDateForOffset = new Date(utcFromETWall);
  const offsetMinutes = Math.round(
    (Date.UTC(
      getETParts(etDateForOffset).year,
      getETParts(etDateForOffset).month - 1,
      getETParts(etDateForOffset).day,
      getETParts(etDateForOffset).hour,
      getETParts(etDateForOffset).minute,
      getETParts(etDateForOffset).second
    ) -
      etDateForOffset.getTime()) /
      60000
  );

  // Apply the offset to reach the correct UTC instant for 13:00 ET
  const finalUtcMs = utcFromETWall - offsetMinutes * 60000;
  return new Date(finalUtcMs);
}
