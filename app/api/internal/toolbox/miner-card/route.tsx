import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { isReferralDashboardRequestAuthorized } from "@/lib/referral-dashboard-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1240;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const RESIZED_IMAGE_WIDTH = 1400;

interface MinerCardData {
  farmName: string;
  zoneName: string;
  minersCount: string | null;
  perMinerUsd: string;
  glwPerWeek: string;
  farmImageUrl: string | null;
}

function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;
}

function formatGlw(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const hasFraction = Math.abs(value - Math.trunc(value)) > 0.0001;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: hasFraction ? 1 : 0,
  }).format(value);
}

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

function StatCard({ children }: { children: React.ReactNode }) {
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

function renderCard(data: MinerCardData) {
  const backgroundImage =
    "linear-gradient(100deg, #d9cbff 0%, #e7dffa 38%, #f5edbf 100%)";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Söhne",
        color: "#050505",
        backgroundImage,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "42px 42px 30px 42px",
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
          <div style={{ display: "flex", width: "72px", height: "72px" }}>
            {GLOW_STARBURST_SVG}
          </div>
        </div>

        {/* Stats: optional wide top card + two-column bottom row */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "64px",
          }}
        >
          {data.minersCount ? (
            <div style={{ display: "flex", height: "224px" }}>
              <StatCard>
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "132px",
                    fontWeight: 400,
                    lineHeight: 0.9,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {data.minersCount} Miners
                </div>
              </StatCard>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "10px", height: "230px" }}>
            <StatCard>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "132px",
                  fontWeight: 400,
                  lineHeight: 0.9,
                  letterSpacing: "-0.05em",
                }}
              >
                {data.perMinerUsd}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "14px",
                  fontSize: "24px",
                  fontWeight: 400,
                  color: "rgba(5,5,5,0.5)",
                  lineHeight: 1.2,
                }}
              >
                Per Miner
              </div>
            </StatCard>

            <StatCard>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "132px",
                  fontWeight: 400,
                  lineHeight: 0.9,
                  letterSpacing: "-0.05em",
                }}
              >
                {data.glwPerWeek}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "14px",
                  fontSize: "24px",
                  fontWeight: 400,
                  color: "rgba(5,5,5,0.5)",
                  lineHeight: 1.2,
                }}
              >
                GLW p/w
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

function extractFirstString(
  formData: FormData,
  key: string,
  fallback = "",
): string {
  const value = formData.get(key);
  if (typeof value === "string") return value.trim();
  return fallback;
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,_\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function normalizeImageBuffer(input: Buffer): Promise<string> {
  const resized = await sharp(input)
    .rotate()
    .resize({ width: RESIZED_IMAGE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}

async function fileToDataUrl(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 32MB.`,
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return normalizeImageBuffer(buffer);
}

async function remoteImageToDataUrl(url: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Remote image too large (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB). Max 32MB.`,
    );
  }
  return normalizeImageBuffer(Buffer.from(arrayBuffer));
}

export async function POST(request: NextRequest) {
  if (!isReferralDashboardRequestAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized internal toolbox access" },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();

    const farmName = extractFirstString(formData, "farmName");
    const zoneName = extractFirstString(formData, "zoneName");
    const minersCountRaw = extractFirstString(formData, "minersCount");
    const perMinerUsdRaw = extractFirstString(formData, "perMinerUsd");
    const glwPerWeekRaw = extractFirstString(formData, "glwPerWeek");

    if (!farmName) {
      return NextResponse.json({ error: "farmName is required" }, { status: 400 });
    }
    const minersCount = minersCountRaw ? parseNumber(minersCountRaw) : null;
    const perMinerUsd = parseNumber(perMinerUsdRaw);
    const glwPerWeek = parseNumber(glwPerWeekRaw);
    if (perMinerUsd == null || glwPerWeek == null) {
      return NextResponse.json(
        { error: "perMinerUsd and glwPerWeek must be numbers" },
        { status: 400 },
      );
    }
    if (minersCountRaw && minersCount == null) {
      return NextResponse.json(
        { error: "minersCount must be a number if provided" },
        { status: 400 },
      );
    }

    const imageFile = formData.get("image");
    const imageUrl = extractFirstString(formData, "imageUrl");
    let farmImageUrl: string | null = null;
    if (imageFile instanceof File && imageFile.size > 0) {
      farmImageUrl = await fileToDataUrl(imageFile);
    } else if (imageUrl) {
      farmImageUrl = await remoteImageToDataUrl(imageUrl);
    }

    const data: MinerCardData = {
      farmName,
      zoneName,
      minersCount: minersCount != null ? formatNumber(minersCount, 0) : null,
      perMinerUsd: formatUsd(perMinerUsd),
      glwPerWeek: formatGlw(glwPerWeek),
      farmImageUrl,
    };

    const fonts = await loadFonts();
    const response = new ImageResponse(renderCard(data), {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("[internal/toolbox/miner-card] failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "miner-card render failed",
      },
      { status: 500 },
    );
  }
}
