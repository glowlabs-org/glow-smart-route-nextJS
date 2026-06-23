"use client";

import { useEffect, useState } from "react";

// Bump this string on every deploy that touches the viewport fix so we can tell,
// from a single on-device screenshot, whether the wallet WebView is running the
// latest build or serving a stale cache.
const BUILD_TAG = "vpdebug-build-4 (dff136d+clamp)";

export default function VpDebugPage() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const vv = window.visualViewport;
      const appVw =
        getComputedStyle(root).getPropertyValue("--app-vw").trim() || "(unset)";
      setLines([
        `BUILD                 ${BUILD_TAG}`,
        `innerWidth            ${window.innerWidth}`,
        `clientWidth           ${root.clientWidth}`,
        `visualViewport.width  ${Math.round(vv?.width ?? 0)}`,
        `screen.width          ${window.screen?.width ?? 0}`,
        `screen.height         ${window.screen?.height ?? 0}`,
        `devicePixelRatio      ${window.devicePixelRatio}`,
        `--app-vw (clamped)    ${appVw}`,
        `vv.offsetLeft         ${Math.round(vv?.offsetLeft ?? 0)}`,
        `scrollWidth           ${root.scrollWidth}`,
      ]);
    };
    read();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", read);
    vv?.addEventListener("scroll", read);
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      vv?.removeEventListener("resize", read);
      vv?.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  return (
    <div
      style={{
        padding: 16,
        font: "15px/1.7 monospace",
        color: "#000",
        background: "#fff",
        minHeight: "100vh",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Viewport diagnostic
      </div>
      <div style={{ marginBottom: 12 }}>
        Screenshot this whole screen and send it.
      </div>

      {/* The red bar below is exactly 100vw wide. If it runs OFF the right edge
          of your screen, the browser's viewport is inflated (the root cause). If
          it ends exactly at the right edge, the viewport is honest. */}
      <div
        style={{
          position: "relative",
          height: 28,
          marginBottom: 6,
          background: "#eee",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: 28,
            width: "100vw",
            background: "rgba(244,63,94,0.55)",
          }}
        />
      </div>
      <div style={{ fontSize: 12, marginBottom: 16, color: "#555" }}>
        ↑ red bar = 100vw. It should end exactly at the right screen edge.
      </div>

      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
        {lines.join("\n")}
      </pre>
    </div>
  );
}
