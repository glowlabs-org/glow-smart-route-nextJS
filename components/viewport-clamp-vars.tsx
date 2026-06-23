"use client";

import { useEffect } from "react";

/**
 * Publishes a best-effort *true visible* viewport to CSS variables on <html>:
 *   --app-vw  usable visible width  (px)
 *   --app-vl  visible-region left offset within the layout viewport (px)
 *   --app-vh  visible height (px)
 *   --app-vt  visible-region top offset (px)
 *
 * Why this exists: some in-app wallet browsers (Base/Coinbase WebView, Rabby,
 * MetaMask, Trust) lay the page out at a viewport WIDER than the visible screen.
 * In those WebViews `100%`, `vw`, `documentElement.clientWidth`, `innerWidth`
 * AND even `visualViewport.width` can all report that inflated layout width, so
 * a fixed/centered modal sized against any of them renders wider than — and
 * shifted off — the visible screen, clipping its right edge.
 *
 * The fix: never trust a single measurement. Clamp the usable width to the
 * MINIMUM of every signal, including `screen.width`, which is the one value NOT
 * derived from the (inflatable) layout viewport. If any signal reports the real
 * width, the min picks it up. Falls back to `100vw`/`0px` (the original
 * behavior) until the effect runs and on browsers without the APIs.
 *
 * If even `screen.width` is inflated on a device, no web-side fix is possible
 * (the WebView is clipping outside anything the page can observe) — that's a
 * native wallet bug. Use ViewportDebugOverlay (`?vpdebug=1`) to tell them apart.
 */

const isPositive = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * The device screen width in CSS px for the current orientation. `screen.width`
 * is normally CSS px on iOS; some Android WebViews report physical px, so divide
 * by devicePixelRatio when the raw value looks like physical pixels.
 */
function screenCssWidth(): number | undefined {
  const sw = window.screen?.width;
  const sh = window.screen?.height;
  if (!isPositive(sw)) return undefined;

  const portrait = window.innerHeight >= window.innerWidth;
  const shortSide = isPositive(sh) ? Math.min(sw, sh) : sw;
  const longSide = isPositive(sh) ? Math.max(sw, sh) : sw;

  const dpr = window.devicePixelRatio || 1;
  if (dpr > 1 && shortSide > 700) {
    const cssShort = shortSide / dpr;
    const cssLong = longSide / dpr;
    if (cssShort >= 280 && cssShort <= 520) {
      return portrait ? cssShort : cssLong;
    }
  }

  return portrait ? shortSide : longSide;
}

export function ViewportClampVars() {
  useEffect(() => {
    const root = document.documentElement;

    const update = () => {
      const vv = window.visualViewport;
      const candidates = [
        vv?.width,
        root.clientWidth,
        window.innerWidth,
        screenCssWidth(),
      ].filter(isPositive);
      const width = candidates.length
        ? Math.floor(Math.min(...candidates))
        : window.innerWidth;

      root.style.setProperty("--app-vw", `${width}px`);
      root.style.setProperty("--app-vl", `${Math.max(0, vv?.offsetLeft ?? 0)}px`);
      root.style.setProperty(
        "--app-vh",
        `${Math.floor(vv?.height ?? window.innerHeight)}px`,
      );
      root.style.setProperty("--app-vt", `${Math.max(0, vv?.offsetTop ?? 0)}px`);
    };

    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    // Re-read after the WebView's initial-scale / viewport settles.
    const settle = window.setTimeout(update, 300);

    return () => {
      window.clearTimeout(settle);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return null;
}
