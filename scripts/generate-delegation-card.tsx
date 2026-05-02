/**
 * Generate a delegation (Launchpad) marketing card PNG locally — mirrors
 * /api/internal/toolbox/marketing-card without calling the hub or
 * reward-score backend. You supply every displayed number directly.
 *
 * Run from glow-smart-route-nextJS/ with:
 *   npx tsx scripts/generate-delegation-card.tsx \
 *     --variant sgctl \
 *     --farmName "Garnet Outpost" \
 *     --zoneName "MO" \
 *     --unitsAvailable 100 \
 *     --unitSize 25 \
 *     --unitUsd 20 \
 *     --glwPerWeek 0.42 \
 *     --pdPerWeek 1.20 \
 *     --image https://... \
 *     --out ./out/garnet-outpost-sgctl.png
 *
 * --variant: "sgctl" (presale) or "glw" (launch). Drives subtitles and
 *   currency labels: sGCTL vs GLW, "sGCTL/wk" vs "GLW/wk".
 * --unitUsd and --image are optional.
 */

import { ImageResponse } from "next/og";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import React from "react";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1240;
const RESIZED_IMAGE_WIDTH = 1400;

type Variant = "sgctl" | "glw";

interface CardData {
  farmName: string;
  zoneName: string;
  unitsAvailable: number;
  unitSize: string;
  unitCurrencyLabel: string;
  unitUsdApprox: string | null;
  unitsSubtitle: string;
  unitSizeSubtitle: string;
  glwEmissionValue: string;
  glwEmissionUnitLabel: string;
  pdRewardsValue: string;
  pdRewardsUnitLabel: string;
  farmImageUrl: string | null;
}

interface CliArgs {
  variant: Variant;
  farmName: string;
  zoneName: string;
  unitsAvailable: number;
  unitSize: string;
  unitUsd: string | null;
  glwPerWeek: string;
  pdPerWeek: string;
  image: string | null;
  out: string;
}

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      map.set(key, "true");
    } else {
      map.set(key, next);
      i++;
    }
  }
  const required = [
    "variant",
    "farmName",
    "unitsAvailable",
    "unitSize",
    "glwPerWeek",
    "pdPerWeek",
    "out",
  ] as const;
  for (const k of required) {
    if (!map.get(k)) {
      throw new Error(`Missing required --${k}`);
    }
  }
  const variant = map.get("variant")!.toLowerCase();
  if (variant !== "sgctl" && variant !== "glw") {
    throw new Error(`--variant must be "sgctl" or "glw"`);
  }
  const unitsAvailable = Number(map.get("unitsAvailable"));
  if (!Number.isFinite(unitsAvailable) || unitsAvailable < 0) {
    throw new Error(`--unitsAvailable must be a non-negative number`);
  }
  return {
    variant,
    farmName: map.get("farmName")!,
    zoneName: map.get("zoneName") ?? "",
    unitsAvailable,
    unitSize: map.get("unitSize")!,
    unitUsd: map.get("unitUsd") ?? null,
    glwPerWeek: map.get("glwPerWeek")!,
    pdPerWeek: map.get("pdPerWeek")!,
    image: map.get("image") ?? null,
    out: map.get("out")!,
  };
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return new Intl.NumberFormat("en-US").format(Math.floor(value));
}

function formatUsdApprox(raw: string): string {
  const cleaned = raw.replace(/[,_\s$]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return `approx. ${raw}`;
  if (n < 1) return `approx. $${n.toFixed(2)}`;
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 0.005) return `approx. $${rounded}`;
  if (n < 100) return `approx. $${n.toFixed(2)}`;
  return `approx. $${rounded}`;
}

const GLOW_STARBURST_SVG = (
  <svg width="72" height="72" viewBox="0 0 237 239" xmlns="http://www.w3.org/2000/svg">
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

async function loadFonts(repoRoot: string) {
  const fontsDir = path.join(repoRoot, "public", "fonts");
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

function computeHeaderFontSize(farmName: string, zoneName: string): number {
  const title = zoneName ? `${farmName} ${zoneName}` : farmName;
  const charCount = Math.max(1, title.length);
  const availableWidth = 1080 - 84 - 72 - 16;
  const widthPerEm = 0.55;
  const ideal = availableWidth / (charCount * widthPerEm);
  return Math.round(Math.max(40, Math.min(72, ideal)));
}

function renderCard(data: CardData) {
  const backgroundImage =
    "linear-gradient(100deg, #c8f8ce 0%, #dff4d7 38%, #d9cbff 100%)";
  const headerFontSize = computeHeaderFontSize(data.farmName, data.zoneName);
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
        letterSpacing: "-0.02em",
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
              flexWrap: "nowrap",
              alignItems: "baseline",
              flex: 1,
              minWidth: 0,
              marginRight: "16px",
              fontSize: `${headerFontSize}px`,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
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
              flexShrink: 0,
            }}
          >
            {GLOW_STARBURST_SVG}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "64px",
          }}
        >
          <div style={{ display: "flex", gap: "12px", height: "224px" }}>
            <StatCard>
              <div
                style={{
                  display: "flex",
                  fontSize: "132px",
                  fontWeight: 400,
                  lineHeight: 0.9,
                  letterSpacing: "-0.02em",
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
                    letterSpacing: "-0.02em",
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

          <div style={{ display: "flex", gap: "12px", height: "230px" }}>
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
                    letterSpacing: "-0.02em",
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
                    letterSpacing: "-0.02em",
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "42px",
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

async function normalizeImageBuffer(input: Buffer): Promise<string> {
  const resized = await sharp(input)
    .rotate()
    .resize({ width: RESIZED_IMAGE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}

async function loadImage(input: string): Promise<string> {
  if (/^https?:\/\//i.test(input)) {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }
    return normalizeImageBuffer(Buffer.from(await response.arrayBuffer()));
  }
  return normalizeImageBuffer(await fs.readFile(input));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");

  const farmImageUrl = args.image ? await loadImage(args.image) : null;

  const data: CardData = {
    farmName: args.farmName,
    zoneName: args.zoneName,
    unitsAvailable: args.unitsAvailable,
    unitSize: args.unitSize,
    unitCurrencyLabel: args.variant === "sgctl" ? "sGCTL" : "GLW",
    unitUsdApprox: args.unitUsd ? formatUsdApprox(args.unitUsd) : null,
    unitsSubtitle:
      args.variant === "sgctl"
        ? "units available for GCTL delegation"
        : "units available for GLW delegation",
    unitSizeSubtitle:
      args.variant === "sgctl"
        ? "can be delegated per unit"
        : "GLW can be delegated per unit",
    glwEmissionValue: args.glwPerWeek,
    glwEmissionUnitLabel: "GLW p/w",
    pdRewardsValue: args.pdPerWeek,
    pdRewardsUnitLabel: args.variant === "sgctl" ? "sGCTL/wk" : "GLW/wk",
    farmImageUrl,
  };

  const fonts = await loadFonts(repoRoot);
  const response = new ImageResponse(renderCard(data), {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts,
  });

  const png = new Uint8Array(await response.arrayBuffer());
  const outPath = path.resolve(process.cwd(), args.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, png);
  console.log(`Wrote ${outPath} (${png.length.toLocaleString()} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
