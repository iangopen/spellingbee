// The one SVG filter the hand-drawn look needs, mounted once in Shell. It
// displaces a panel's outline by about 2px so the line wobbles like a pen. It
// draws nothing by itself (0x0, aria-hidden). Only the outline pseudo-element
// uses it, never text.
export function WobbleFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        <filter id="hm-wobble-s" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
