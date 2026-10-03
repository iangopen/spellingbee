// Homemade layer, runtime half. Runs after honeycomb.js (which builds .bg).
//  1. adds the paper-grain layer to the fixed, aria-hidden, pointer-events-none
//     .bg container (grain never goes on a scrolling container, so it is
//     rasterised once)
//  2. adds two SVG filters that give outlines and icons a hand-drawn wobble
// Both are decoration only: nothing here touches text, focus or the answer logic.
(function () {
  const bg = document.querySelector(".bg");
  if (bg) { const g = document.createElement("div"); g.className = "bg-grain"; bg.append(g); }
  const wob = (id, freq, scale, seed) =>
    `<filter id="${id}" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
       <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}" result="n"/>
       <feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  const s = document.createElement("div");
  s.setAttribute("aria-hidden", "true");
  s.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  // hm-wobble: panel outlines in "more" (a slow, long wobble). hm-wobble-s: a
  // gentler, finer one for light's outlines and for icons.
  s.innerHTML = `<svg width="0" height="0" focusable="false"><defs>${wob("hm-wobble", "0.018", 5, 4)}${wob("hm-wobble-s", "0.045", 2.4, 9)}</defs></svg>`;
  document.body.append(s);
})();
