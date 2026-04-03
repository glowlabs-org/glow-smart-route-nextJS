import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const AUDIT_GENERATED_OFFSET_MS = 4 * DAY_MS;
const AUDIT_POSTED_OFFSET_MS = 5 * DAY_MS;
const FINALIZATION_WINDOW_MS = 3 * WEEK_MS;

export type PendingRewardPipelinePhase =
  | "epoch"
  | "audit"
  | "finalization"
  | "claimable";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toMs(
  value: string | number | Date | null | undefined
): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  return null;
}

export function getEpochStartMs(epoch: number) {
  return GENESIS_TIMESTAMP * 1000 + epoch * WEEK_MS;
}

export function getEpochEndMs(epoch: number) {
  return getEpochStartMs(epoch + 1);
}

export function formatRewardPipelineDate(
  timestampMs: number,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  }
) {
  return new Date(timestampMs).toLocaleDateString("en-US", options);
}

export function buildPendingRewardTimeline(params: {
  purchaseDate: string | number | Date | null | undefined;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const purchaseMs = toMs(params.purchaseDate) ?? nowMs;
  const purchaseEpoch = getCurrentEpoch(purchaseMs / 1000);
  const epochEndsAtMs = getEpochEndMs(purchaseEpoch);
  const auditGeneratedAtMs = epochEndsAtMs + AUDIT_GENERATED_OFFSET_MS;
  const auditPostedAtMs = epochEndsAtMs + AUDIT_POSTED_OFFSET_MS;
  const claimableAtMs = auditPostedAtMs + FINALIZATION_WINDOW_MS;

  let phase: PendingRewardPipelinePhase = "claimable";
  if (nowMs < epochEndsAtMs) {
    phase = "epoch";
  } else if (nowMs < auditPostedAtMs) {
    phase = "audit";
  } else if (nowMs < claimableAtMs) {
    phase = "finalization";
  }

  const durationMs = Math.max(claimableAtMs - purchaseMs, DAY_MS);
  const elapsedMs = clamp(nowMs - purchaseMs, 0, durationMs);
  const progressPercent = clamp((elapsedMs / durationMs) * 100, 6, 100);

  return {
    purchaseMs,
    purchaseEpoch,
    epochEndsAtMs,
    auditGeneratedAtMs,
    auditPostedAtMs,
    claimableAtMs,
    phase,
    progressPercent,
  };
}
