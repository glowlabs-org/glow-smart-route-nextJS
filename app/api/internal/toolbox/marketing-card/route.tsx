import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import {
  REWARD_SCORE_FALLBACK_USER_ID,
  type ApplicationRewardScore,
} from "@/lib/reward-score";
import { getCachedRewardScoresBatch } from "@/lib/server/reward-scores";
import { isReferralDashboardRequestAuthorized } from "@/lib/referral-dashboard-auth";
import { buildForwardHeaders } from "@/app/api/_shared/forward-headers";
import type { MarketingLaunchpadApplication } from "@/lib/internal/marketing-launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1240;

type Variant = "sgctl" | "glw";

interface CardData {
  farmName: string;
  zoneName: string;
  unitsAvailable: number;
  unitSize: string; // e.g. "25" or "800.38"
  unitCurrencyLabel: string; // e.g. "sGCTL" or "GLW"
  unitUsdApprox: string | null; // e.g. "approx. $20"
  unitsSubtitle: string; // e.g. "units available for GCTL delegation"
  unitSizeSubtitle: string; // e.g. "can be delegated per unit"
  glwEmissionValue: string;
  glwEmissionUnitLabel: string;
  pdRewardsValue: string;
  pdRewardsUnitLabel: string;
  farmImageUrl: string | null;
}

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  return value;
}

async function fetchApplication(
  request: NextRequest,
  applicationId: string,
): Promise<MarketingLaunchpadApplication | null> {
  const url = new URL(`${getHubUrl()}/applications/marketing-launchpad`);
  url.searchParams.set("applicationId", applicationId);
  const response = await fetch(url.toString(), {
    headers: buildForwardHeaders(request),
    next: { revalidate: 60, tags: [`marketing-launchpad:${applicationId}`] },
  });
  if (!response.ok) {
    throw new Error(`hub responded ${response.status}`);
  }
  const payload = (await response.json()) as MarketingLaunchpadApplication[];
  if (!Array.isArray(payload)) return null;
  return payload.find((app) => app.id === applicationId) ?? payload[0] ?? null;
}

function parseBigIntSafe(value: string | null | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function computeSgctlUnitCount(app: MarketingLaunchpadApplication): number {
  const targetUsd6 = parseBigIntSafe(app.finalProtocolFee);
  const perStepUsd6 = parseBigIntSafe(app.activeFraction?.currentStepUsd6);
  const fallback = app.activeFraction?.totalSteps ?? 0;
  if (!targetUsd6 || !perStepUsd6 || perStepUsd6 <= 0n) return fallback;
  const count = (targetUsd6 + perStepUsd6 - 1n) / perStepUsd6;
  return Number(count);
}

async function estimateRewardScore(
  app: MarketingLaunchpadApplication,
  variant: Variant,
): Promise<ApplicationRewardScore | null> {
  const fraction = app.activeFraction;
  if (!fraction) return null;
  const carbon = app.auditFields?.netCarbonCreditEarningWeekly;
  if (!carbon || carbon <= 0) return null;

  const targetUsd6 = app.finalProtocolFee;
  if (!targetUsd6) return null;

  const protocolDepositAmount =
    variant === "sgctl"
      ? (() => {
          const unitCount = computeSgctlUnitCount(app);
          const atomic = parseBigIntSafe(fraction.sgctlStepAtomic ?? null);
          if (!atomic || unitCount <= 0) return null;
          return (atomic * BigInt(unitCount)).toString();
        })()
      : (() => {
          const step = parseBigIntSafe(fraction.step ?? fraction.stepPrice);
          const steps = fraction.totalSteps ?? 0;
          if (!step || steps <= 0) return null;
          return (step * BigInt(steps)).toString();
        })();
  if (!protocolDepositAmount) return null;

  const paymentCurrencyPriceUsd6 =
    variant === "sgctl"
      ? app.applicationPriceQuotes?.[0]?.prices?.GCTL ?? undefined
      : app.applicationPriceQuotes?.[0]?.prices?.GLW ?? undefined;

  if (!app.zone) return null;
  try {
    const batch = await getCachedRewardScoresBatch([
      {
        userId: REWARD_SCORE_FALLBACK_USER_ID,
        sponsorSplitPercent: app.sponsorSplitPercent,
        protocolDepositAmount,
        protocolDepositUsd6: targetUsd6,
        paymentCurrencyPriceUsd6,
        paymentCurrency: variant === "sgctl" ? "SGCTL" : "GLW",
        expectedWeeklyCarbonCredits: carbon,
        regionId: app.zone.id,
      },
    ]);
    const first = batch.results?.[0];
    if (!first || !first.success) return null;
    return { applicationId: app.id, ...first.data };
  } catch (error) {
    console.warn(
      "[internal/toolbox/marketing-card] reward-score estimate failed",
      error,
    );
    return null;
  }
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return new Intl.NumberFormat("en-US").format(Math.floor(value));
}

function formatPerUnit(value: string, decimals: number, fractionDigits: number): string {
  try {
    const dec = new Decimal(value).div(new Decimal(10).pow(decimals));
    if (!dec.isFinite()) return "—";
    return dec.toFixed(fractionDigits);
  } catch {
    return "—";
  }
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1) return `$${value.toFixed(2)}`;
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.005) return `$${rounded}`;
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${rounded}`;
}

async function buildCardData(
  app: MarketingLaunchpadApplication,
  variant: Variant,
): Promise<CardData> {
  const farmName = app.farmName?.trim() || "Solar Farm";
  const zoneName = app.zone?.name?.trim() || "";

  const totalStepsGlw = app.activeFraction?.totalSteps ?? 0;
  const sgctlUnitCount = computeSgctlUnitCount(app);

  const estimate = await estimateRewardScore(app, variant);
  const unitCount = variant === "sgctl" ? sgctlUnitCount : totalStepsGlw;
  const denom = unitCount > 0 ? unitCount : 1;

  let glwPerUnit = "0";
  let pdPerUnit = "0";
  if (estimate) {
    const glwTotalWei = new Decimal(estimate.userWeeklyGlwRewards || "0");
    const glwPerUnitWei = glwTotalWei.div(denom).toFixed(0, Decimal.ROUND_DOWN);
    glwPerUnit = formatPerUnit(glwPerUnitWei, 18, variant === "sgctl" ? 2 : 2);

    const pdDecimals = variant === "sgctl" ? 6 : 18;
    const pdTotalAtomic = new Decimal(estimate.userWeeklyPdRewards || "0");
    const pdPerUnitAtomic = pdTotalAtomic
      .div(denom)
      .toFixed(0, Decimal.ROUND_DOWN);
    pdPerUnit = formatPerUnit(pdPerUnitAtomic, pdDecimals, 2);
  }

  let unitSize = "—";
  let unitUsdApprox: string | null = null;
  if (variant === "sgctl") {
    const atomic = parseBigIntSafe(app.activeFraction?.sgctlStepAtomic ?? null);
    if (atomic != null) {
      unitSize = new Decimal(atomic.toString())
        .div(new Decimal(10).pow(6))
        .toFixed(0);
    }
    const stepUsd6 = parseBigIntSafe(app.activeFraction?.currentStepUsd6);
    if (stepUsd6 != null) {
      unitUsdApprox = `approx. ${formatUsd(Number(stepUsd6) / 1_000_000)}`;
    }
  } else {
    const step = parseBigIntSafe(app.activeFraction?.step ?? app.activeFraction?.stepPrice);
    if (step != null) {
      unitSize = new Decimal(step.toString())
        .div(new Decimal(10).pow(18))
        .toFixed(0, Decimal.ROUND_DOWN);
    }
    const glwPriceUsd6 = parseBigIntSafe(app.applicationPriceQuotes?.[0]?.prices?.GLW ?? null);
    if (step != null && glwPriceUsd6 != null) {
      const glwAmount = new Decimal(step.toString()).div(new Decimal(10).pow(18));
      const usd = glwAmount.mul(new Decimal(glwPriceUsd6.toString()).div(1_000_000));
      unitUsdApprox = `approx. ${formatUsd(usd.toNumber())}`;
    }
  }

  return {
    farmName,
    zoneName,
    unitsAvailable: unitCount,
    unitSize,
    unitCurrencyLabel: variant === "sgctl" ? "sGCTL" : "GLW",
    unitUsdApprox,
    unitsSubtitle:
      variant === "sgctl"
        ? "units available for GCTL delegation"
        : "units available for GLW delegation",
    unitSizeSubtitle:
      variant === "sgctl"
        ? "can be delegated per unit"
        : "GLW can be delegated per unit",
    glwEmissionValue: glwPerUnit,
    glwEmissionUnitLabel: "GLW p/w",
    pdRewardsValue: pdPerUnit,
    pdRewardsUnitLabel: variant === "sgctl" ? "sGCTL/wk" : "GLW/wk",
    farmImageUrl:
      process.env.DISABLE_MARKETING_CARD_IMAGE === "1"
        ? null
        : await loadFarmImageDataUrl(
            app.afterInstallPictures?.[0]?.url ?? null,
          ),
  };
}

async function loadFarmImageDataUrl(
  url: string | null,
): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      next: { revalidate: 3600, tags: ["marketing-card-image"] },
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const maxBytes = 6_000_000;
    if (buffer.byteLength > maxBytes) {
      console.warn(
        "[internal/toolbox/marketing-card] image too large, skipping",
        { url, bytes: buffer.byteLength },
      );
      return null;
    }
    const contentType = (() => {
      const header = response.headers.get("content-type");
      if (header && header.startsWith("image/")) return header;
      const lower = url.toLowerCase();
      if (lower.endsWith(".png")) return "image/png";
      if (lower.endsWith(".webp")) return "image/webp";
      return "image/jpeg";
    })();
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn("[internal/toolbox/marketing-card] image fetch failed", error);
    return null;
  }
}

// Trimmed Glow starburst (see components/glow-symbol.tsx)
const GLOW_STARBURST_SVG = (
  <svg
    width="72"
    height="72"
    viewBox="0 0 237 239"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M75.3805 0L63.6266 59.9862L102.965 86.2833L114.719 26.2971L75.3805 0Z" fill="#050505" />
    <path d="M172.625 6.85553L121.898 40.9609L130.935 86.4428L181.663 52.3399L172.625 6.85553Z" fill="#050505" />
    <path d="M236.181 80.1185L176.197 68.3622L150.952 106.128L210.935 117.882L236.181 80.1185Z" fill="#050505" />
    <path d="M228.455 176.248L194.35 125.521L150.722 134.189L184.828 184.916L228.455 176.248Z" fill="#050505" />
    <path d="M131.043 153.862L119.29 213.849L155.481 238.043L167.235 178.056L131.043 153.862Z" fill="#050505" />
    <path d="M102.84 154.032L52.1126 188.138L60.4102 229.908L111.14 195.803L102.84 154.032Z" fill="#050505" />
    <path d="M83.1263 134.28L23.1426 122.524L0 157.142L59.9862 168.896L83.1263 134.28Z" fill="#050505" />
    <path d="M9.2948 63.4374L43.4002 114.165L83.3131 106.235L49.2101 55.5074L9.2948 63.4374Z" fill="#050505" />
  </svg>
);

async function readFontByPattern(
  fontsDir: string,
  files: string[],
  includes: string,
): Promise<Buffer> {
  const match = files.find((name) => name.includes(includes) && name.endsWith(".otf"));
  if (!match) {
    throw new Error(`Missing font matching "${includes}" in ${fontsDir}`);
  }
  return fs.readFile(path.join(fontsDir, match));
}

let cachedFontsPromise: Promise<
  Array<{
    name: string;
    data: Buffer;
    weight: 400 | 500 | 600 | 700;
    style: "normal";
  }>
> | null = null;

async function loadFonts() {
  if (!cachedFontsPromise) {
    cachedFontsPromise = (async () => {
      const fontsDir = path.join(process.cwd(), "public", "fonts");
      const files = await fs.readdir(fontsDir);
      const [buch, kraftig, halbfett, dreiviertelfett] = await Promise.all([
        readFontByPattern(fontsDir, files, "hne-Buch"),
        readFontByPattern(fontsDir, files, "hne-Kr"),
        readFontByPattern(fontsDir, files, "hne-Halb"),
        readFontByPattern(fontsDir, files, "hne-Dreiviertelfett"),
      ]);
      return [
        { name: "Söhne", data: buch, weight: 400 as const, style: "normal" as const },
        { name: "Söhne", data: kraftig, weight: 500 as const, style: "normal" as const },
        { name: "Söhne", data: halbfett, weight: 600 as const, style: "normal" as const },
        { name: "Söhne", data: dreiviertelfett, weight: 700 as const, style: "normal" as const },
      ];
    })().catch((error) => {
      cachedFontsPromise = null;
      throw error;
    });
  }
  return cachedFontsPromise;
}

function StatCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "26px 28px 24px 28px",
        borderRadius: "26px",
        background: "rgba(255, 255, 255, 0.16)",
        border: "1px solid rgba(255, 255, 255, 0.72)",
      }}
    >
      {children}
    </div>
  );
}

function renderCard(data: CardData) {
  const backgroundImage =
    "linear-gradient(100deg, #c8f8ce 0%, #dff4d7 38%, #d9cbff 100%)";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Söhne",
        color: "#050505",
        padding: "12px",
        background: "#f3f3f3",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundImage,
          padding: "30px 30px 18px 30px",
          borderRadius: "24px",
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              fontSize: "72px",
              letterSpacing: "-0.042em",
              lineHeight: 1,
            }}
          >
            <span style={{ fontWeight: 700 }}>{data.farmName}</span>
            {data.zoneName ? (
              <span style={{ fontWeight: 400, marginLeft: "10px" }}>
                {data.zoneName}
              </span>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              width: "72px",
              height: "72px",
            }}
          >
            {GLOW_STARBURST_SVG}
          </div>
        </div>

        {/* Stats grid — flex rows/cols because Satori doesn't support CSS grid */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "64px",
          }}
        >
          <div style={{ display: "flex", gap: "10px", height: "224px" }}>
            <StatCard>
              <div
                style={{
                  display: "flex",
                  fontSize: "132px",
                  fontWeight: 400,
                  lineHeight: 0.9,
                  letterSpacing: "-0.05em",
                }}
              >
                {formatCount(data.unitsAvailable)}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: "14px",
                  fontSize: "24px",
                  fontWeight: 400,
                  color: "rgba(5,5,5,0.5)",
                  lineHeight: 1.2,
                }}
              >
                {data.unitsSubtitle}
              </div>
            </StatCard>

            <StatCard>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  lineHeight: 0.9,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: data.unitSize.length >= 5 ? "114px" : "132px",
                    fontWeight: 400,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {data.unitSize}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    paddingTop: "12px",
                  }}
                >
                  {data.unitUsdApprox ? (
                    <div
                      style={{
                        display: "flex",
                        fontSize: "20px",
                        fontWeight: 400,
                        color: "rgba(5,5,5,0.5)",
                      }}
                    >
                      {data.unitUsdApprox}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      fontSize: "32px",
                      fontWeight: 600,
                      marginTop: "8px",
                    }}
                  >
                    {data.unitCurrencyLabel}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: "14px",
                  fontSize: "24px",
                  fontWeight: 400,
                  color: "rgba(5,5,5,0.5)",
                  lineHeight: 1.2,
                }}
              >
                {data.unitSizeSubtitle}
              </div>
            </StatCard>
          </div>

          <div style={{ display: "flex", gap: "10px", height: "230px" }}>
            <StatCard>
              <div
                style={{
                  display: "flex",
                  fontSize: "23px",
                  fontWeight: 500,
                  color: "rgba(5,5,5,0.5)",
                  marginBottom: "56px",
                }}
              >
                GLW Emission Rewards
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  marginTop: "6px",
                  lineHeight: 0.9,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "118px",
                    fontWeight: 400,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {data.glwEmissionValue}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    paddingTop: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: "20px",
                      color: "rgba(5,5,5,0.5)",
                    }}
                  >
                    currently earning
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "24px",
                      fontWeight: 600,
                      marginTop: "6px",
                    }}
                  >
                    {data.glwEmissionUnitLabel}
                  </div>
                </div>
              </div>
            </StatCard>

            <StatCard>
              <div
                style={{
                  display: "flex",
                  fontSize: "23px",
                  fontWeight: 500,
                  color: "rgba(5,5,5,0.5)",
                  marginBottom: "56px",
                }}
              >
                Protocol Deposit Rewards
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  marginTop: "6px",
                  lineHeight: 0.9,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "118px",
                    fontWeight: 400,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {data.pdRewardsValue}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    paddingTop: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: "20px",
                      color: "rgba(5,5,5,0.5)",
                    }}
                  >
                    currently earning
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: "24px",
                      fontWeight: 600,
                      marginTop: "6px",
                    }}
                  >
                    {data.pdRewardsUnitLabel}
                  </div>
                </div>
              </div>
            </StatCard>
          </div>
        </div>

        {/* Farm image + disclaimer */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "28px",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              width: "100%",
              minHeight: "340px",
              borderRadius: "24px",
              overflow: "hidden",
              backgroundColor: "#d9d9d9",
            }}
          >
            {data.farmImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img
                src={data.farmImageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 58%",
                }}
              />
            ) : (
              <div style={{ display: "flex", width: "100%", height: "100%" }} />
            )}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "14px",
              fontSize: "20px",
              fontWeight: 400,
              color: "rgba(5,5,5,0.48)",
            }}
          >
            Weekly earnings are subject to change relative to a farm&apos;s
            competitiveness.
          </div>
        </div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  if (!isReferralDashboardRequestAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized internal toolbox access" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId");
  const variantParam = (searchParams.get("variant") ?? "sgctl").toLowerCase();
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }
  if (variantParam !== "sgctl" && variantParam !== "glw") {
    return NextResponse.json({ error: "variant must be sgctl or glw" }, { status: 400 });
  }

  try {
    const application = await fetchApplication(request, applicationId);
    if (!application) {
      return NextResponse.json({ error: "application not found" }, { status: 404 });
    }
    const data = await buildCardData(application, variantParam as Variant);
    const fonts = await loadFonts();
    const response = new ImageResponse(renderCard(data), {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
    });
    response.headers.set(
      "Cache-Control",
      "private, max-age=30, stale-while-revalidate=300",
    );
    return response;
  } catch (error) {
    console.error("[internal/toolbox/marketing-card] failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "marketing-card render failed",
      },
      { status: 500 },
    );
  }
}
