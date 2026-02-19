import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Glow Economic Dashboard";
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
        {/* Top row: Badge */}
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
              alignItems: "center",
              padding: "16px 32px",
              borderRadius: "999px",
              border: "2px solid #000000",
              fontSize: "24px",
              fontWeight: 600,
              letterSpacing: "0.1em",
            }}
          >
            GLOW MINING
          </div>

          {/* Glow Symbol - colored dots */}
          <div style={{ display: "flex", gap: "8px" }}>
            {["#ffb472", "#f7fcc4", "#ccffd4", "#dcc4ff"].map((color) => (
              <div
                key={color}
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "999px",
                  backgroundColor: color,
                  border: "2px solid #000000",
                }}
              />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "96px",
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            <span>Economic</span>
            <span>Dashboard</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "32px",
              fontWeight: 500,
              color: "#3f3f46",
              lineHeight: 1.4,
              maxWidth: "700px",
            }}
          >
            <span>Liquidity, emissions, GCTL staking,</span>
            <span>and solar impact in real time.</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
