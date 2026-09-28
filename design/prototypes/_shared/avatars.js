// Prototype avatar glyphs: original sketches, one per EXISTING avatar key
// (bee, queen, drone, hive, honey, blossom, clover, wasp). The keys are fixed
// by the room_players.avatar CHECK; only the art is being redesigned. These
// are direction sketches to be redrawn properly in the build's assets stage.
// Replaces every <i data-avatar="key"></i> with the inline glyph.
const A = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const AVATARS = {
  bee: A('<ellipse cx="12" cy="14.5" rx="5" ry="6.5"/><path d="M7.4 12.5h9.2M7.2 16h9.6"/><ellipse cx="8" cy="7" rx="3.3" ry="2.1" transform="rotate(-28 8 7)"/><ellipse cx="16" cy="7" rx="3.3" ry="2.1" transform="rotate(28 16 7)"/>'),
  queen: A('<ellipse cx="12" cy="15.5" rx="4.6" ry="6"/><path d="M7.6 14h8.8M7.5 17.3h9"/><path d="M8 7.5 9 3.5l3 2.6 3-2.6 1 4z"/>'),
  drone: A('<ellipse cx="12" cy="15" rx="5.4" ry="6"/><path d="M6.8 15h10.4"/><circle cx="9.3" cy="6.6" r="2.4"/><circle cx="14.7" cy="6.6" r="2.4"/>'),
  hive: A('<path d="M4.5 20h15"/><path d="M6 20c0-9 2.7-14 6-14s6 5 6 14"/><path d="M6.4 16h11.2M7.3 12.4h9.4M9 9h6"/><path d="M10.5 20a1.5 1.6 0 0 1 3 0"/>'),
  honey: A('<path d="M12 3.2S5.4 10.8 5.4 15a6.6 6.6 0 0 0 13.2 0C18.6 10.8 12 3.2 12 3.2z"/><path d="M9 15.4a3 3 0 0 0 2.6 2.9"/>'),
  blossom: A('<circle cx="12" cy="6.6" r="3"/><circle cx="17.1" cy="10.3" r="3"/><circle cx="15.2" cy="16.3" r="3"/><circle cx="8.8" cy="16.3" r="3"/><circle cx="6.9" cy="10.3" r="3"/><circle cx="12" cy="11.8" r="1.6"/>'),
  clover: A('<circle cx="12" cy="7" r="3.4"/><circle cx="7.6" cy="12.2" r="3.4"/><circle cx="16.4" cy="12.2" r="3.4"/><path d="M12 12.5c0 4 .8 6.6 3 8.5"/>'),
  wasp: A('<circle cx="12" cy="6.8" r="2.8"/><path d="M12 9.6v1.2"/><path d="M12 10.8c-3.2 0-4.3 3.4-4.3 5.2S9.5 21.2 12 21.2s4.3-3.4 4.3-5.2-1.1-5.2-4.3-5.2z"/><path d="M7.9 14.6h8.2M8.3 17.6h7.4"/><path d="M9.6 9 4.2 6.8M14.4 9l5.4-2.2"/>'),
};
document.querySelectorAll("i[data-avatar]").forEach((el) => {
  el.outerHTML = AVATARS[el.dataset.avatar] ?? AVATARS.bee;
});
