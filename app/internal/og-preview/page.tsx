"use client";

import React from "react";

const OG_IMAGES = [
  { name: "Main", path: "/opengraph-image" },
  { name: "Impact Leaderboard", path: "/leaderboard/opengraph-image" },
  { name: "Referral (test123)", path: "/r/test123/opengraph-image" },
];

// Inline preview component that matches the OG image style
function OGPreview({
  title,
  subtitle,
  badge = "GLOW MINING",
}: {
  title: React.ReactNode;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, #f7fcc4 0%, #e8f5d6 25%, #dcc4ff 100%)",
        color: "#000000",
        padding: "60px",
        fontFamily: "system-ui, sans-serif",
        borderRadius: "12px",
        border: "1px solid #e4e4e7",
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
          {badge}
        </div>

        {/* Glow Symbol */}
        <svg width="80" height="80" viewBox="0 0 237 239" fill="none">
          <path
            d="M75.3805 0L63.6266 59.9862L102.965 86.2833L114.719 26.2971L75.3805 0Z"
            fill="#000000"
          />
          <path
            d="M172.625 6.85553L121.898 40.9609L130.935 86.4428L181.663 52.3399L172.625 6.85553Z"
            fill="#000000"
          />
          <path
            d="M236.181 80.1185L176.197 68.3622L150.952 106.128L210.935 117.882L236.181 80.1185Z"
            fill="#000000"
          />
          <path
            d="M228.455 176.248L194.35 125.521L150.722 134.189L184.828 184.916L228.455 176.248Z"
            fill="#000000"
          />
          <path
            d="M131.043 153.862L119.29 213.849L155.481 238.043L167.235 178.056L131.043 153.862Z"
            fill="#000000"
          />
          <path
            d="M102.84 154.032L52.1126 188.138L60.4102 229.908L111.14 195.803L102.84 154.032Z"
            fill="#000000"
          />
          <path
            d="M83.1263 134.28L23.1426 122.524L0 157.142L59.9862 168.896L83.1263 134.28Z"
            fill="#000000"
          />
          <path
            d="M9.2948 63.4374L43.4002 114.165L83.3131 106.235L49.2101 55.5074L9.2948 63.4374Z"
            fill="#000000"
          />
        </svg>
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
          {title}
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
          {subtitle}
        </div>
      </div>
    </div>
  );
}

export default function OGPreviewPage() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-8">
      <div className="max-w-[1300px] mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">OpenGraph Image Preview</h1>
          <p className="text-muted-foreground">
            Preview how OG images will look when shared on social media (1200×630)
          </p>
        </div>

        {/* Main OG */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Main (/) </h2>
          <div className="overflow-x-auto">
            <OGPreview
              title={
                <>
                  Sponsor
                  <br />
                  solar farms
                </>
              }
              subtitle="Earn GLW rewards while funding renewable infrastructure."
            />
          </div>
        </section>

        {/* Impact Leaderboard OG */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Impact Leaderboard (/leaderboard)</h2>
          <div className="overflow-x-auto">
            <OGPreview
              title={
                <>
                  Impact
                  <br />
                  Leaderboard
                </>
              }
              subtitle="Track top wallets by impact score and Glow rewards."
            />
          </div>
        </section>

        {/* Referral OG */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Referral (/r/[code])</h2>
          <div className="overflow-x-auto">
            <div
              style={{
                width: "1200px",
                height: "630px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background:
                  "linear-gradient(135deg, #f7fcc4 0%, #e8f5d6 25%, #dcc4ff 100%)",
                color: "#000000",
                padding: "60px",
                fontFamily: "system-ui, sans-serif",
                borderRadius: "12px",
                border: "1px solid #e4e4e7",
              }}
            >
              {/* Top row */}
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
                    textTransform: "uppercase",
                  }}
                >
                  GLOW MINING
                </div>
                <svg width="80" height="80" viewBox="0 0 237 239" fill="none">
                  <path d="M75.3805 0L63.6266 59.9862L102.965 86.2833L114.719 26.2971L75.3805 0Z" fill="#000000" />
                  <path d="M172.625 6.85553L121.898 40.9609L130.935 86.4428L181.663 52.3399L172.625 6.85553Z" fill="#000000" />
                  <path d="M236.181 80.1185L176.197 68.3622L150.952 106.128L210.935 117.882L236.181 80.1185Z" fill="#000000" />
                  <path d="M228.455 176.248L194.35 125.521L150.722 134.189L184.828 184.916L228.455 176.248Z" fill="#000000" />
                  <path d="M131.043 153.862L119.29 213.849L155.481 238.043L167.235 178.056L131.043 153.862Z" fill="#000000" />
                  <path d="M102.84 154.032L52.1126 188.138L60.4102 229.908L111.14 195.803L102.84 154.032Z" fill="#000000" />
                  <path d="M83.1263 134.28L23.1426 122.524L0 157.142L59.9862 168.896L83.1263 134.28Z" fill="#000000" />
                  <path d="M9.2948 63.4374L43.4002 114.165L83.3131 106.235L49.2101 55.5074L9.2948 63.4374Z" fill="#000000" />
                </svg>
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
                  Join Glow
                </div>
                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: 600,
                    color: "#000000",
                    letterSpacing: "0.05em",
                    padding: "12px 0",
                  }}
                >
                  Invited by alice.eth
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
                  Earn bonus Impact Points when you sign up with this referral link.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
