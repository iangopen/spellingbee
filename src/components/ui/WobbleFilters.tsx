import { useState } from "react";

// The one SVG filter the hand-drawn look needs, mounted once in Shell. It
// displaces a panel's outline so the line wobbles like a pen. It draws nothing
// by itself (0x0, aria-hidden). Only the outline pseudo-element uses it, never
// text.
//
// How far the line wanders is the --hm-roughness token in index.css (a filter's
// scale is an SVG attribute, which CSS cannot set, so it is read once here). The
// fallback is the same value, for a test DOM with no stylesheet.
const LIGHT_ROUGHNESS = 2.4;

function readRoughness(): number {
  if (typeof document === "undefined") return LIGHT_ROUGHNESS;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hm-roughness"));
  return Number.isFinite(v) && v >= 0 ? v : LIGHT_ROUGHNESS;
}

export function WobbleFilters() {
  const [scale] = useState(readRoughness);
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        <filter id="hm-wobble-s" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
