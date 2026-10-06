import { useEffect } from "react";

// The honeycomb behind every screen. Pure decoration: aria-hidden, no text, no
// focusable element, pointer-events none (honeycomb.css). Mounted once, in Shell.
//
// The only behaviour is pausing the shimmer while the tab is hidden, by setting
// data-paused on <html>; the stylesheet does the rest. Reduced motion (OS and
// the in-app override) is handled in CSS, so the still page is the static glow.
export function HoneycombBackground() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      if (document.visibilityState === "hidden") root.setAttribute("data-paused", "");
      else root.removeAttribute("data-paused");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      root.removeAttribute("data-paused");
    };
  }, []);

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-base" />
      <div className="bg-fade">
        <div className="bg-cells-glow" />
        <div className="bg-cells" />
      </div>
      <div className="bg-light">
        <div className="lit lit-glow" />
        <div className="lit" />
      </div>
      <div className="bg-depth" />
      {/* The grain is the TOP layer, as in the prototype: under the calm header band
          and the vignette it vanished from the top of the page and faded at the edges. */}
      <div className="bg-grain" />
    </div>
  );
}
