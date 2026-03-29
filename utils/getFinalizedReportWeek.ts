import { GENESIS_TIMESTAMP } from "@/utils/getCurrentEpoch";

const REPORT_PUBLISH_BUFFER_HOURS = 1;

export function getFinalizedReportWeek(now = new Date()): number {
  const currentDayOfWeek = now.getUTCDay();
  const currentHour = now.getUTCHours();

  let daysToGoBack: number;
  if (
    currentDayOfWeek === 4 &&
    currentHour >= REPORT_PUBLISH_BUFFER_HOURS
  ) {
    daysToGoBack = 0;
  } else if (currentDayOfWeek === 0) {
    daysToGoBack = 3;
  } else if (currentDayOfWeek > 4) {
    daysToGoBack = currentDayOfWeek - 4;
  } else {
    daysToGoBack = currentDayOfWeek + 3;
  }

  const lastThursday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysToGoBack,
      0,
      0,
      0,
      0,
    ),
  );

  const weeksSinceGenesis = Math.floor(
    (Math.floor(lastThursday.getTime() / 1000) - GENESIS_TIMESTAMP) / 604800,
  );

  return weeksSinceGenesis - 1;
}
