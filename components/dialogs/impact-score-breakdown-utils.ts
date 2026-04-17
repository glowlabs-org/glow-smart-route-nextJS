import type { ImpactGlowScoreResponse } from "@/hooks";

export function getImpactScoreDialogTotalPoints(
  impactScore: Pick<ImpactGlowScoreResponse, "totals"> | null | undefined,
): string {
  const totalPoints = impactScore?.totals?.totalPoints;
  if (totalPoints == null || totalPoints === "") return "0";
  const numericTotal = Number(totalPoints);
  return Number.isFinite(numericTotal) ? String(numericTotal) : "0";
}
