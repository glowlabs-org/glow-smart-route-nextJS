"use client";

import { useEffect } from "react";

/**
 * Publishes the browser's *visual* viewport as CSS variables on <html>:
 *   --vvw  visual viewport width   (px)
 *   --vvl  visual viewport left    (offset within the layout viewport, px)
 *   --vvh  visual viewport height  (px)
 *   --vvt  visual viewport top     (offset within the layout viewport, px)
 *
 * Why this exists: some in-app wallet browsers (Base Wallet, Rabby, etc.)
 * render the *layout* viewport wider than the *visual* screen. CSS `100%` /
 * `vw` units and `left: 50%` resolve against the inflated layout viewport, so
 * a fixed, centered modal ends up wider than — and shifted off — the visible
 * screen, clipping its right edge. `overflow-x: hidden` doesn't fix this
 * because the inflation isn't from page scroll. The only reliable source of the
 * true visual dimensions is the visualViewport API, which we mirror into CSS so
 * `DialogContent` can size and center against the visible area instead.
 *
 * Falls back to `100vw` / `0px` (current behaviour) until the effect runs and
 * on browsers without visualViewport support.
 */
export function VisualViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--vvw", `${vv.width}px`);
      root.style.setProperty("--vvl", `${vv.offsetLeft}px`);
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvt", `${vv.offsetTop}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return null;
}
