import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Glow Mining";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundImage:
            "linear-gradient(135deg, #f7fcc4 0%, #e8f5d6 25%, #dcc4ff 100%)",
          color: "#000000",
          padding: "60px",
        }}
      >
        {/* Top row: Badge and Symbol */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          {/* GLOW MINING pill badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "16px 32px",
              borderRadius: "999px",
              border: "2px solid #000000",
              fontSize: "24px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            GLOW MINING
          </div>

          {/* Glow Symbol - simplified star pattern */}
          <div
            style={{
              width: "80px",
              height: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
            }}
          >
            ✦
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: "96px",
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            Sponsor
            <br />
            solar farms
          </div>
          <div
            style={{
              fontSize: "32px",
              fontWeight: 500,
              color: "#3f3f46",
              lineHeight: 1.4,
              maxWidth: "700px",
            }}
          >
            Earn GLW rewards while funding
            <br />
            renewable infrastructure.
          </div>
        </div>
      </div>
    ),
    size
  );
}
