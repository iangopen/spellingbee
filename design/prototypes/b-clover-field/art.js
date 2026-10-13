// Direction B art: original geometric sketches, coloured by tokens.
// - [data-mark]: the brand mark, a clover head with a bee's looping flight.
// - [data-plant="0..7"]: one plant per tier, seed (0) to full bloom (7).
(function () {
  const clover = (cx, cy, r) =>
    [[0, 0], [-1, 0.35], [1, 0.35], [-0.55, -0.55], [0.55, -0.55], [0, -1.05], [-1.02, -0.62], [1.02, -0.62]]
      .map(([x, y]) => `<circle cx="${cx + x * r}" cy="${cy + y * r}" r="${r * 0.62}"/>`)
      .join("");
  const mark = `<svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M18 44c0-9 1-14 2-18" fill="none" stroke="var(--leaf)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M19.6 36c-5-1-8-4-8.5-8 4 .3 7.5 2.8 8.5 8z" fill="var(--leaf)"/>
    <g fill="var(--accent)">${clover(20, 20, 6)}</g>
    <path d="M28 12c5-7 13-5 12 1-1 5-7 4-7 0" fill="none" stroke="var(--text)" stroke-width="1.6" stroke-dasharray="1.5 3" stroke-linecap="round"/>
    <g transform="translate(34 10) rotate(-20)" fill="none" stroke="var(--text)" stroke-width="1.6" stroke-linecap="round">
      <ellipse cx="0" cy="0" rx="4.2" ry="3"/><path d="M-1.2 -2.6v5.2M1.4 -2.6v5.2"/>
      <ellipse cx="-1" cy="-4.8" rx="2.4" ry="1.5" fill="var(--surface)"/>
    </g>
  </svg>`;
  document.querySelectorAll("i[data-mark]").forEach((el) => (el.outerHTML = mark));

  function plant(stage, played) {
    const h = 60 + stage * 22; // stem height grows with the tier
    const top = 240 - h;
    const head = stage === 0
      ? `<ellipse cx="30" cy="${top}" rx="5" ry="3.5" fill="var(--muted)"/>`
      : stage < 3
        ? `<path d="M30 ${top + 2}c-9-4-10-12-8-16 5 1 8 7 8 16zm0 0c9-4 10-12 8-16-5 1-8 7-8 16z" fill="var(--leaf)"/>`
        : stage < 5
          ? `<ellipse cx="30" cy="${top - 4}" rx="${4 + stage}" ry="${6 + stage}" fill="${played ? "var(--accent)" : "none"}" stroke="var(--accent)" stroke-width="2"/>`
          : `<g fill="${played ? "var(--accent)" : "none"}" stroke="var(--accent)" stroke-width="1.6">${clover(30, top - 6, 3.2 + (stage - 4) * 1.4)}</g>`;
    const leaf = stage > 1 ? `<path d="M30 ${top + h * 0.55}c-8-1-12-5-12-10 6 0 11 4 12 10z" fill="var(--leaf)" opacity=".85"/>` : "";
    return `<svg viewBox="0 0 60 244" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <path d="M30 240V${top + 2}" stroke="var(--leaf)" stroke-width="3" stroke-linecap="round"/>${leaf}${head}
      <path d="M8 241h44" stroke="var(--edge)" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  document.querySelectorAll("i[data-plant]").forEach((el) => {
    el.outerHTML = plant(Number(el.dataset.plant), el.dataset.played === "1");
  });
})();
