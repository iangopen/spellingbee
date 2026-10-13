// Direction C art: original geometric sketches, coloured by tokens.
// - [data-mark]: a striped bee body with its dotted flight line.
// - [data-flight]: the wide "bee line" flourish under the home wordmark.
(function () {
  const mark = `<svg viewBox="0 0 64 28" aria-hidden="true">
    <path d="M2 20c6-10 10 6 16-4s8 4 12-2" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-dasharray="2 3.4" stroke-linecap="round"/>
    <ellipse cx="41" cy="7.5" rx="6" ry="4" fill="none" stroke="var(--text)" stroke-width="2" transform="rotate(-18 41 7.5)"/>
    <ellipse cx="50" cy="6.5" rx="5.5" ry="3.6" fill="none" stroke="var(--text)" stroke-width="2" transform="rotate(20 50 6.5)"/>
    <clipPath id="body"><rect x="34" y="11" width="28" height="15" rx="7.5"/></clipPath>
    <g clip-path="url(#body)">
      <rect x="34" y="11" width="28" height="15" fill="var(--stripe-a)"/>
      <rect x="40" y="11" width="5" height="15" fill="var(--stripe-b)"/>
      <rect x="49.5" y="11" width="5" height="15" fill="var(--stripe-b)"/>
    </g>
    <rect x="34" y="11" width="28" height="15" rx="7.5" fill="none" stroke="var(--text)" stroke-width="2"/>
  </svg>`;
  document.querySelectorAll("i[data-mark]").forEach((el) => (el.outerHTML = mark));
  const flight = `<svg class="flight" viewBox="0 0 1000 70" preserveAspectRatio="none" aria-hidden="true">
    <path d="M4 52C90 8 150 66 240 34S380 6 470 40s150 22 230-6 170-26 296 4" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 10" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
  document.querySelectorAll("i[data-flight]").forEach((el) => (el.outerHTML = flight));
})();
