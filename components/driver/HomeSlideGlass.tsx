"use client";

import LiquidGlass from "./vendor/liquid-glass";

/** A visual layer only: the original semantic button owns all pointer/keyboard handling. */
export default function HomeSlideGlass({ thumb = false }: { thumb?: boolean }) {
  return <LiquidGlass
    displacementScale={thumb ? 28 : 12}
    blurAmount={0.045}
    saturation={110}
    aberrationIntensity={0.35}
    elasticity={0}
    cornerRadius={thumb ? 24 : 30}
    padding="0"
    mode="standard"
    style={{ position: "absolute", top: "50%", left: "50%", width: "100%", height: "100%" }}
    className="home-slide-glass"
  ><span aria-hidden="true" /></LiquidGlass>;
}
