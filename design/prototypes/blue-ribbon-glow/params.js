// Runs in <head>, before first paint: turns URL parameters into <html> data
// attributes, so one set of pages can show every variant.
//   ?bg=static|shimmer|reactive   background variant (default: shimmer, Ian's pick)
//   ?bee=0|1                      no bee / bee mascot + bee contestants (default: 1, Ian's pick)
//   ?theme=light|dark             theme (default: dark, unless a player chose light)
//   ?state=correct|incorrect      round page: show an answer outcome
//   ?peak=1                       contrast testing: light up EVERY cell at the
//                                 variant's brightest, so text is measured
//                                 against the worst case anywhere on screen
(function () {
  const p = new URLSearchParams(location.search);
  const root = document.documentElement;
  const pick = (k, allowed, d) => (allowed.includes(p.get(k)) ? p.get(k) : d);
  root.dataset.bg = pick("bg", ["static", "shimmer", "reactive"], "shimmer");
  root.dataset.bee = pick("bee", ["0", "1"], "1");
  root.dataset.theme = pick("theme", ["light", "dark"], "dark");
  const state = pick("state", ["correct", "incorrect"], "");
  if (state) root.dataset.state = state;
  if (p.get("peak") === "1") root.dataset.peak = "1";
  // Keep the variant when moving between the three prototype pages.
  window.withParams = (href) => href + location.search;
})();
