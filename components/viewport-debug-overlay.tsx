"use client";

import { useEffect, useState } from "react";

/**
 * On-device viewport diagnostic. Enable with `?vpdebug=1` in the URL (or
 * `localStorage.vpdebug = "1"`). Renders fixed bars from the left screen edge,
 * one per width signal. The bar whose RIGHT edge lands exactly on the visible
 * screen edge is the true visible width; any bar that runs off the right edge is
 * an INFLATED (layout-viewport) measurement. Used to confirm which API to trust
 * in wallet in-app browsers. Renders nothing unless explicitly enabled.
 */

interface Row {
  label: string;
  value: number;
  color: string;
}

export function ViewportDebugOverlay() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState("");

  useEffect(() => {
    let enabled = false;
    try {
      enabled =
        new URLSearchParams(window.location.search).has("vpdebug") ||
        window.localStorage.getItem("vpdebug") === "1";
    } catch {
      enabled = false;
    }
    if (!enabled) return;

    const root = document.documentElement;
    const read = () => {
      const vv = window.visualViewport;
      const appVw =
        parseFloat(getComputedStyle(root).getPropertyValue("--app-vw")) || 0;
      setRows([
        { label: "innerWidth", value: window.innerWidth, color: "#22d3ee" },
        { label: "clientWidth", value: root.clientWidth, color: "#f59e0b" },
        { label: "visualVP", value: Math.round(vv?.width ?? 0), color: "#a78bfa" },
        { label: "screen", value: window.screen?.width ?? 0, color: "#4ade80" },
        { label: "--app-vw", value: Math.round(appVw), color: "#f43f5e" },
      ]);
      setMeta(
        `dpr ${window.devicePixelRatio} · vvLeft ${Math.round(
          vv?.offsetLeft ?? 0,
        )} · scrollW ${root.scrollWidth}`,
      );
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

  if (!rows) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 2147483647,
        pointerEvents: "none",
        font: "11px/1.4 monospace",
        color: "#fff",
      }}
    >
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: `${r.value}px`,
              height: 10,
              background: r.color,
              flex: "0 0 auto",
            }}
          />
          <span style={{ background: "rgba(0,0,0,0.8)", padding: "0 4px" }}>
            {r.label} {r.value}
          </span>
        </div>
      ))}
      <div style={{ background: "rgba(0,0,0,0.8)", padding: "0 4px", display: "inline-block" }}>
        {meta}
      </div>
    </div>
  );
}
