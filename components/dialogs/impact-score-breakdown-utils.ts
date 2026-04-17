import type { ImpactGlowScoreResponse } from "@/hooks";

function safePointsNumber(value?: string): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getImpactScoreDialogTotalPoints(
  impactScore: Pick<ImpactGlowScoreResponse, "totals"> | null | undefined,
): string {
  const totalPoints = impactScore?.totals?.totalPoints;
  if (totalPoints != null && totalPoints !== "") {
    const numericTotal = Number(totalPoints);
    if (Number.isFinite(numericTotal)) {
      return String(numericTotal);
    }
  }

  return String(
    safePointsNumber(impactScore?.totals?.rolloverPoints) +
      safePointsNumber(impactScore?.totals?.continuousPoints),
  );
}
