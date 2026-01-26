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
              fontSize: "72px",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            Sponsor solar farms
          </div>
          <div
            style={{
              fontSize: "32px",
              fontWeight: 500,
              color: "#a1a1aa",
              lineHeight: 1.3,
              maxWidth: "900px",
            }}
          >
            Earn GLW rewards while funding renewable infrastructure.
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
