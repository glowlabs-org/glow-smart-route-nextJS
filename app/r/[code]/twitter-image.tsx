import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Glow Referral";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const rawCode = safeDecode(code ?? "");
  const displayCode = rawCode.slice(0, 12).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#09090b",
          color: "#ffffff",
          padding: "64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "28px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#e4e4e7",
          }}
        >
          Glow Mining
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              fontSize: "64px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Referral Code
          </div>
          <div
            style={{
              fontSize: "36px",
              fontWeight: 600,
              color: "#ffb472",
              letterSpacing: "0.2em",
            }}
          >
            {displayCode}
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 500,
              color: "#a1a1aa",
              lineHeight: 1.3,
              maxWidth: "900px",
            }}
          >
            Join Glow and start earning rewards.
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px" }}>
          {[
            "#ffb472",
            "#f7fcc4",
            "#ccffd4",
            "#dcc4ff",
          ].map((color) => (
            <div
              key={color}
              style={{
                width: "120px",
                height: "12px",
                borderRadius: "999px",
                backgroundColor: color,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size
  );
}
