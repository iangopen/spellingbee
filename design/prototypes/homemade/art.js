// Honey hybrid art: blue-ribbon-glow/art.js, recoloured through tokens. The
// bee is honey with cocoa bands, and the rosette uses --mark (petals),
// --mark-2 (ribbon tails) and --mark-ring (centre ring), so variant b can give
// the rosette a blue ribbon while the petals stay honey. Original geometric
// sketches, for redrawing properly in the build's assets stage.
//   <i data-mark class="…">          rosette logo: bee at the centre (bee=1) or a tick (bee=0)
//   <i data-mascot>                   the bee mascot (bee=1 only; CSS hides it otherwise)
//   <i data-contestant="key">         avatar: bee contestant (bee=1) or glyph placard (bee=0)
// Avatar keys are the EXISTING eight (the room_players.avatar CHECK); only art changes.
(function () {
  const bee = document.documentElement.dataset.bee === "1";
  let uid = 0;

  // ---- homemade: the sketchier redraw (?h=light|more; off draws the clean bee).
  // Every ellipse becomes a hand-drawn blob: points jittered around the curve,
  // joined with smooth cubic curves. light = one slightly wobbly stroke.
  // more = a bigger wobble, a second thinner pass of the outline, and the colour
  // fill nudged off the line, like a colouring-in that did not quite stay put.
  // The jitter is a fixed pseudo-random sequence seeded per avatar, so a given
  // avatar is drawn the same way on every page and in every screenshot.
  const H = document.documentElement.dataset.h || "off";
  const rough = H === "light" || H === "more";
  const AMP = H === "more" ? 1.5 : 0.8;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const f1 = (n) => n.toFixed(1);
  function blobPath(cx, cy, rx, ry) {
    const n = Math.max(8, Math.min(14, Math.round(Math.max(rx, ry) * 0.9)));
    const a = AMP * Math.min(1, Math.max(rx, ry) / 12);
    const p = Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return [cx + rx * Math.cos(t) + rnd() * a * 2, cy + ry * Math.sin(t) + rnd() * a * 2];
    });
    let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d + "Z";
  }
  // One bee shape. off: a plain <ellipse>. light/more: the sketched version.
  function shape(cx, cy, rx, ry, { fill = "none", stroke = "var(--bee-line)", sw = 2.4, tf = "" } = {}) {
    const t = tf ? ` transform="${tf}"` : "";
    if (!rough) return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${t}/>`;
    const d = blobPath(cx, cy, rx, ry);
    if (H === "light") return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw + 0.3}" stroke-linejoin="round"${t}/>`;
    const d2 = blobPath(cx, cy, rx, ry);
    return `<g${t}>${fill !== "none" ? `<path d="${d}" fill="${fill}" transform="translate(1.5 1.2)"/>` : ""}` +
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw + 0.5}" stroke-linejoin="round"/>` +
      `<path d="${d2}" fill="none" stroke="${stroke}" stroke-width="${(sw * 0.5).toFixed(1)}" opacity=".5"/></g>`;
  }

  // ---- the bee: round body, two navy bands, big friendly eyes, two wings.
  // `acc` adds the per-avatar accessory; `slim` is the wasp's build.
  function beeSvg({ acc = "", slim = false, eyes = 1, cls = "", sd = 11 } = {}) {
    seed = sd;
    const bodyRx = slim ? 13 : 17, bodyRy = slim ? 19 : 17;
    const bcy = slim ? 64 : 62;
    const id = `bb${++uid}`;
    const wingRx = slim ? 15 : 14, wingRy = slim ? 8 : 10, wingCy = slim ? 40 : 38;
    const bodyClip = rough ? `<path d="${blobPath(50, bcy, bodyRx, bodyRy)}"/>` : `<ellipse cx="50" cy="${bcy}" rx="${bodyRx}" ry="${bodyRy}"/>`;
    return `<svg class="${cls}" viewBox="12 4 76 90" aria-hidden="true">
      ${shape(33, wingCy, wingRx, wingRy, { fill: "var(--bee-wing)", tf: `rotate(-${slim ? 38 : 28} 33 38)` })}
      ${shape(67, wingCy, wingRx, wingRy, { fill: "var(--bee-wing)", tf: `rotate(${slim ? 38 : 28} 67 38)` })}
      <g stroke="var(--bee-line)" stroke-width="2.4" stroke-linecap="round" fill="none">
        ${slim
          ? `<path d="M44 26 38 13M56 26 62 13"/>`
          : `<path d="M44 27c-2-8-7-12-11-11M56 27c2-8 7-12 11-11"/><circle cx="32.5" cy="16" r="2.4" fill="var(--bee-line)"/><circle cx="67.5" cy="16" r="2.4" fill="var(--bee-line)"/>`}
      </g>
      ${shape(50, bcy, bodyRx, bodyRy, { fill: "var(--bee-body)", sw: 2.6 })}
      <clipPath id="${id}">${bodyClip}</clipPath>
      <g clip-path="url(#${id})" fill="var(--bee-stripe)">
        <rect x="20" y="${slim ? 60 : 58}" width="60" height="${slim ? 6 : 7}"/><rect x="20" y="${slim ? 71 : 70}" width="60" height="${slim ? 6 : 7}"/>
      </g>
      ${shape(50, 36, slim ? 12 : 14, slim ? 12 : 14, { fill: "var(--bee-body)", sw: 2.6 })}
      ${shape(45 - eyes, 35, 3.6 * eyes, 3.6 * eyes, { fill: "#fff", sw: 1.6 })}${shape(55 + eyes, 35, 3.6 * eyes, 3.6 * eyes, { fill: "#fff", sw: 1.6 })}
      <g fill="var(--bee-line)"><circle cx="${45.6 - eyes}" cy="35.6" r="${1.8 * eyes}"/><circle cx="${55.6 + eyes}" cy="35.6" r="${1.8 * eyes}"/></g>
      <path d="M45.5 42.5q4.5 3.6 9 0" fill="none" stroke="var(--bee-line)" stroke-width="2" stroke-linecap="round"/>
      ${slim ? "" : `<circle cx="40.5" cy="41" r="2.2" fill="var(--bee-cheek, #ff9fb2)" opacity=".7"/><circle cx="59.5" cy="41" r="2.2" fill="var(--bee-cheek, #ff9fb2)" opacity=".7"/>`}
      ${acc}
    </svg>`;
  }
  const ACC = {
    bee: "",
    queen: `<path d="M40 22 42 13l5 5 3-7 3 7 5-5 2 9z" fill="var(--mark)" stroke="var(--bee-line)" stroke-width="2" stroke-linejoin="round"/>`,
    drone: "",
    hive: `<g stroke="var(--bee-line)" stroke-width="2" fill="var(--panel-solid)"><path d="M70 92c0-14 4-22 10-22s10 8 10 22z"/><path d="M71 84h18M73 77h14" fill="none"/></g>`,
    honey: `<path d="M24 66s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12z" fill="var(--mark)" stroke="var(--bee-line)" stroke-width="2"/>`,
    blossom: `<g stroke="var(--bee-line)" stroke-width="1.6" fill="#fff">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${68 + 5 * Math.cos((a * Math.PI) / 180)}" cy="${12 + 5 * Math.sin((a * Math.PI) / 180)}" r="3.4"/>`).join("")}<circle cx="68" cy="12" r="2.6" fill="var(--mark)"/></g>`,
    clover: `<g stroke="var(--bee-line)" stroke-width="1.6" fill="#6fd49e"><circle cx="30" cy="9" r="4"/><circle cx="25" cy="15" r="4"/><circle cx="35" cy="15" r="4"/></g>`,
  };
  const hash = (k) => [...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
  const beeFor = (key, cls = "") =>
    key === "wasp" ? beeSvg({ slim: true, cls, sd: hash(key) })
      : key === "drone" ? beeSvg({ eyes: 1.45, cls, sd: hash(key) })
      : beeSvg({ acc: ACC[key] ?? "", cls, sd: hash(key) });

  // ---- rosette: petal ring + ribbon tails; centre = bee or tick.
  function rosette(cls) {
    seed = 5;
    const petals = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const x = +(50 + Math.cos(a) * 30).toFixed(2), y = +(44 + Math.sin(a) * 30).toFixed(2);
      return rough ? `<path d="${blobPath(x, y, 9.5, 9.5)}"/>` : `<circle cx="${x}" cy="${y}" r="9.5"/>`;
    }).join("");
    const ring = rough
      ? `<path d="${blobPath(50, 44, 27, 27)}" fill="var(--panel-solid)" stroke="var(--mark-ring)" stroke-width="3"/>`
      : `<circle cx="50" cy="44" r="27" fill="var(--panel-solid)" stroke="var(--mark-ring)" stroke-width="3"/>`;
    const centre = bee
      ? `<svg x="24" y="18" width="52" height="52" viewBox="0 0 100 100">${beeSvg().replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>`
      : `<path d="M38 45l8 8 17-18" fill="none" stroke="var(--mark)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<svg class="mark-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M36 62 26 96l12-7 8 10 6-35z" fill="var(--mark-2)"/>
      <path d="M64 62l10 34-12-7-8 10-6-35z" fill="var(--mark-2)" opacity=".78"/>
      <g fill="var(--mark)">${petals}</g>
      ${ring}
      ${centre}
    </svg>`;
  }

  document.querySelectorAll("i[data-mark]").forEach((el) => (el.outerHTML = rosette(el.className)));
  document.querySelectorAll("i[data-mascot]").forEach((el) => (el.outerHTML = beeFor("bee")));
  document.querySelectorAll("i[data-contestant]").forEach((el) => {
    const key = el.dataset.contestant;
    el.outerHTML = bee ? beeFor(key) : `<i data-avatar="${key}"></i>`;
  });
})();
