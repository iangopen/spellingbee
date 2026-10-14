// Avatar maker prototype behaviour (2026-10-13). Plain script, opens from disk.
// URL parameters (for screenshots and links): ?theme=light|dark, ?set=playful|spelling,
// ?color=0-7, ?cosmetic=0-7, ?motion=reduce, ?name=...
(function () {
  "use strict";
  const { COLORS, SETS, makerSvg, describe, CLIP_ID } = window.BeeMaker;
  const N = 8;
  const q = new URLSearchParams(location.search);
  const clampIndex = (v) => { const n = Number.parseInt(v ?? "", 10); return Number.isInteger(n) && n >= 0 && n < N ? n : 0; };
  const state = {
    color: clampIndex(q.get("color")),
    cosmetic: clampIndex(q.get("cosmetic")),
    set: q.get("set") === "spelling" ? "spelling" : "playful",
    name: q.get("name") || "Sam",
  };
  const root = document.documentElement;
  if (q.get("theme") === "light") root.dataset.theme = "light";
  if (q.get("motion") === "reduce") root.dataset.reduceMotion = "true";

  // The other players in the token mock-ups (index pairs, so they work with either set).
  const OTHERS = [
    { name: "Ana", color: 1, cosmetic: 6 },
    { name: "Kofi", color: 6, cosmetic: 5 },
    { name: "Lee", color: 2, cosmetic: 3 },
    { name: "Priya", color: 7, cosmetic: 2 },
  ];

  let uid = 0;
  /** An avatar box as the app's AvatarArt draws it: decoration, aria-hidden, unique clip id. */
  function art(color, cosmetic, set, size) {
    const box = document.createElement("span");
    box.className = "art-box halo";
    if (size) { box.style.width = size + "px"; box.style.height = size + "px"; }
    const inner = document.createElement("span");
    inner.className = "art";
    inner.setAttribute("aria-hidden", "true");
    inner.innerHTML = makerSvg(color, cosmetic, set).split(CLIP_ID).join("clip-" + uid++);
    box.append(inner);
    return box;
  }

  const rows = {
    color: { el: document.querySelector('[data-row="color"]'), noun: "bee colour", list: () => COLORS.map((c) => c.name) },
    cosmetic: { el: document.querySelector('[data-row="cosmetic"]'), noun: "cosmetic", list: () => SETS[state.set].items.map((c) => c.name) },
  };

  function renderMaker({ hop = false } = {}) {
    const preview = document.getElementById("preview");
    preview.replaceChildren(art(state.color, state.cosmetic, state.set));
    if (hop) { preview.classList.remove("hop"); void preview.offsetWidth; preview.classList.add("hop"); }
    // The live region: one short phrase per step, never per frame.
    document.getElementById("desc").textContent = describe(state.color, state.cosmetic, state.set);
    for (const [key, row] of Object.entries(rows)) {
      const i = state[key], names = row.list(), pos = `${i + 1} of ${N}`;
      row.el.querySelector("[data-value]").textContent = names[i];
      row.el.querySelector("[data-count]").textContent = pos;
      const [prev, next] = row.el.querySelectorAll(".arrow");
      prev.setAttribute("aria-label", `Previous ${row.noun}, ${pos}`);
      next.setAttribute("aria-label", `Next ${row.noun}, ${pos}`);
    }
  }

  function renderTokens() {
    const me = { name: state.name.trim() || "Sam", color: state.color, cosmetic: state.cosmetic, you: true };
    const desc = (p) => describe(p.color, p.cosmetic, state.set).toLowerCase();
    // lobby
    for (const el of document.querySelectorAll("[data-you-art]")) el.replaceChildren(art(me.color, me.cosmetic, state.set, +el.dataset.youArt));
    for (const el of document.querySelectorAll("[data-you-name]")) el.textContent = me.name;
    // waiting room: "Sam, host, blue bee wearing a crown" is the row's spoken text (spec 2.5)
    const players = [{ ...me, host: true }, ...OTHERS];
    const roster = document.getElementById("roster");
    roster.replaceChildren(...players.map((p) => {
      const li = document.createElement("li");
      li.className = "player-row";
      const badge = art(p.color, p.cosmetic, state.set, 30);
      const name = Object.assign(document.createElement("span"), { className: "player-name", textContent: p.name });
      const sr = Object.assign(document.createElement("span"), { className: "sr-only", textContent: `, ${desc(p)}` });
      name.append(sr);
      const tags = Object.assign(document.createElement("span"), { className: "player-tags" });
      if (p.host) tags.append(Object.assign(document.createElement("span"), { className: "tag", textContent: "host" }));
      if (p.you) tags.append(Object.assign(document.createElement("span"), { className: "tag tag-you", textContent: "you" }));
      li.append(badge, name, tags);
      return li;
    }));
    // scoreboard: race lanes (name only in-game, spec 2.5) and turn tokens
    const scores = [[OTHERS[0], 180], [me, 165], [OTHERS[1], 120], [OTHERS[2], 60]];
    const lanes = document.getElementById("lanes");
    lanes.replaceChildren(...scores.map(([p, pts], i) => {
      const li = document.createElement("li");
      li.className = `lane${i === 0 ? " p1" : ""}`;
      li.innerHTML = `<span class="pos">${i + 1}</span><span class="name"><b></b>${p.you ? "<span>you</span>" : ""}</span><span class="track" aria-hidden="true"><span class="token"></span></span><span class="pts">${pts}<span class="sr-only"> points</span></span>`;
      li.querySelector("b").textContent = p.name;
      const token = li.querySelector(".token");
      token.style.left = `calc((100% - 66px) * ${pts / 180})`;
      token.append(art(p.color, p.cosmetic, state.set, 46));
      return li;
    }));
    const ptokens = document.getElementById("ptokens");
    ptokens.replaceChildren(...[OTHERS[1], me, OTHERS[0], OTHERS[3]].map((p, i) => {
      const li = document.createElement("li");
      li.className = `ptoken${i === 1 ? " active" : ""}${p.you ? " you" : ""}`;
      const disc = Object.assign(document.createElement("span"), { className: "ptoken-disc" });
      disc.append(art(p.color, p.cosmetic, state.set, 34));
      const nm = Object.assign(document.createElement("span"), { className: "ptoken-name", textContent: p.name });
      li.append(disc, nm);
      return li;
    }));
  }

  function renderSheets() {
    const cell = (color, cosmetic, set, title, sub) => {
      const li = document.createElement("li");
      const c = Object.assign(document.createElement("span"), { className: "cell" });
      c.append(art(color, cosmetic, set));
      const cap = Object.assign(document.createElement("span"), { className: "cap", textContent: title });
      cap.append(Object.assign(document.createElement("small"), { textContent: sub }));
      li.append(c, cap);
      return li;
    };
    document.getElementById("color-sheet").replaceChildren(...COLORS.map((c, i) => cell(i, state.cosmetic, state.set, c.name, `${i + 1} of 8`)));
    for (const ul of document.querySelectorAll("[data-sheet]")) {
      const set = ul.dataset.sheet;
      ul.replaceChildren(...SETS[set].items.map((it, i) => cell(state.color, i, set, it.name, `${i + 1} of 8`)));
    }
  }

  function renderAll(opts) { renderMaker(opts); renderTokens(); renderSheets(); }

  function step(key, to, { hop = true } = {}) {
    state[key] = ((to % N) + N) % N; // wraps at both ends (8 -> 1, 1 -> 8)
    renderAll({ hop });
  }

  for (const [key, row] of Object.entries(rows)) {
    for (const btn of row.el.querySelectorAll(".arrow")) btn.addEventListener("click", () => step(key, state[key] + Number(btn.dataset.dir)));
    // Left/Right step while either button in the row has focus, and focus stays put;
    // Home/End go to the first and last item. No Up/Down, so scrolling is never trapped.
    row.el.addEventListener("keydown", (e) => {
      if (!(e.target instanceof HTMLButtonElement)) return;
      const to = { ArrowLeft: state[key] - 1, ArrowRight: state[key] + 1, Home: 0, End: N - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      step(key, to);
    });
  }

  document.getElementById("surprise").addEventListener("click", () => {
    let c, k;
    do { c = Math.floor(Math.random() * N); k = Math.floor(Math.random() * N); } while (c === state.color && k === state.cosmetic);
    state.color = c; state.cosmetic = k;
    renderAll({ hop: true });
  });

  const nameInput = document.getElementById("name");
  nameInput.value = state.name;
  nameInput.addEventListener("input", () => { state.name = nameInput.value; renderTokens(); });

  // prototype controls
  for (const r of document.querySelectorAll('input[name="theme"]')) {
    r.checked = (root.dataset.theme || "dark") === r.value;
    r.addEventListener("change", () => { if (r.value === "light") root.dataset.theme = "light"; else delete root.dataset.theme; });
  }
  for (const r of document.querySelectorAll('input[name="set"]')) {
    r.checked = state.set === r.value;
    r.addEventListener("change", () => { state.set = r.value; renderAll(); });
  }
  const reduce = document.getElementById("reduce");
  reduce.checked = root.dataset.reduceMotion === "true";
  reduce.addEventListener("change", () => { if (reduce.checked) root.dataset.reduceMotion = "true"; else delete root.dataset.reduceMotion; });

  renderAll();
})();
