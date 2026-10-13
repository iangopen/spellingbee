// Direction A mark: a 1st-place rosette with a bee at its centre. Original
// geometric sketch (circles and two ribbon tails), coloured by tokens.
(function () {
  const petals = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return `<circle cx="${(50 + Math.cos(a) * 30).toFixed(2)}" cy="${(44 + Math.sin(a) * 30).toFixed(2)}" r="9.5"/>`;
  }).join("");
  const svg = `<svg class="mark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M36 62 26 96l12-7 8 10 6-35z" fill="var(--accent)"/>
    <path d="M64 62l10 34-12-7-8 10-6-35z" fill="var(--accent)" opacity=".78"/>
    <g fill="var(--accent)">${petals}</g>
    <circle cx="50" cy="44" r="27" fill="var(--surface)" stroke="var(--accent)" stroke-width="3"/>
    <g fill="none" stroke="var(--text)" stroke-width="3.2" stroke-linecap="round">
      <ellipse cx="50" cy="48" rx="8" ry="10.5"/>
      <path d="M42.6 45h14.8M42.4 51h15.2"/>
      <ellipse cx="42" cy="35.5" rx="6" ry="3.8" transform="rotate(-28 42 35.5)"/>
      <ellipse cx="58" cy="35.5" rx="6" ry="3.8" transform="rotate(28 58 35.5)"/>
    </g>
  </svg>`;
  document.querySelectorAll("i[data-mark]").forEach((el) => {
    const cls = el.className;
    el.outerHTML = svg.replace('class="mark-svg"', `class="mark-svg ${cls}"`);
  });
})();
