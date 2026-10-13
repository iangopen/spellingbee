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

  // ---- the bee: round body, two navy bands, big friendly eyes, two wings.
  // `acc` adds the per-avatar accessory; `slim` is the wasp's build.
  function beeSvg({ acc = "", slim = false, eyes = 1, cls = "" } = {}) {
    const bodyRx = slim ? 13 : 17, bodyRy = slim ? 19 : 17;
    const id = `bb${++uid}`;
    return `<svg class="${cls}" viewBox="12 4 76 90" aria-hidden="true">
      <g fill="var(--bee-wing)" stroke="var(--bee-line)" stroke-width="2.4">
        <ellipse cx="33" cy="${slim ? 40 : 38}" rx="${slim ? 15 : 14}" ry="${slim ? 8 : 10}" transform="rotate(-${slim ? 38 : 28} 33 38)"/>
        <ellipse cx="67" cy="${slim ? 40 : 38}" rx="${slim ? 15 : 14}" ry="${slim ? 8 : 10}" transform="rotate(${slim ? 38 : 28} 67 38)"/>
      </g>
      <g stroke="var(--bee-line)" stroke-width="2.4" stroke-linecap="round" fill="none">
        ${slim
          ? `<path d="M44 26 38 13M56 26 62 13"/>`
          : `<path d="M44 27c-2-8-7-12-11-11M56 27c2-8 7-12 11-11"/><circle cx="32.5" cy="16" r="2.4" fill="var(--bee-line)"/><circle cx="67.5" cy="16" r="2.4" fill="var(--bee-line)"/>`}
      </g>
      <ellipse cx="50" cy="${slim ? 64 : 62}" rx="${bodyRx}" ry="${bodyRy}" fill="var(--bee-body)" stroke="var(--bee-line)" stroke-width="2.6"/>
      <clipPath id="${id}"><ellipse cx="50" cy="${slim ? 64 : 62}" rx="${bodyRx}" ry="${bodyRy}"/></clipPath>
      <g clip-path="url(#${id})" fill="var(--bee-stripe)">
        <rect x="20" y="${slim ? 60 : 58}" width="60" height="${slim ? 6 : 7}"/><rect x="20" y="${slim ? 71 : 70}" width="60" height="${slim ? 6 : 7}"/>
      </g>
      <circle cx="50" cy="36" r="${slim ? 12 : 14}" fill="var(--bee-body)" stroke="var(--bee-line)" stroke-width="2.6"/>
      <g fill="#fff" stroke="var(--bee-line)" stroke-width="1.6">
        <circle cx="${45 - eyes}" cy="35" r="${3.6 * eyes}"/><circle cx="${55 + eyes}" cy="35" r="${3.6 * eyes}"/>
      </g>
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
  const beeFor = (key, cls = "") =>
    key === "wasp" ? beeSvg({ slim: true, cls })
      : key === "drone" ? beeSvg({ eyes: 1.45, cls })
      : beeSvg({ acc: ACC[key] ?? "", cls });

  // ---- rosette: petal ring + ribbon tails; centre = bee or tick.
  function rosette(cls) {
    const petals = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return `<circle cx="${(50 + Math.cos(a) * 30).toFixed(2)}" cy="${(44 + Math.sin(a) * 30).toFixed(2)}" r="9.5"/>`;
    }).join("");
    const centre = bee
      ? `<svg x="24" y="18" width="52" height="52" viewBox="0 0 100 100">${beeSvg().replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>`
      : `<path d="M38 45l8 8 17-18" fill="none" stroke="var(--mark)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<svg class="mark-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M36 62 26 96l12-7 8 10 6-35z" fill="var(--mark-2)"/>
      <path d="M64 62l10 34-12-7-8 10-6-35z" fill="var(--mark-2)" opacity=".78"/>
      <g fill="var(--mark)">${petals}</g>
      <circle cx="50" cy="44" r="27" fill="var(--panel-solid)" stroke="var(--mark-ring)" stroke-width="3"/>
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
