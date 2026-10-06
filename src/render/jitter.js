// Rendering offset: figures that stand on the same point in the simulation (serfs on a path,
// soldiers in a crowd) are drawn shifted by a small, per-figure fixed offset. Rendering only –
// the simulation stays untouched. Where the exact position matters (work at a building, tree or stone,
// workers at the fire or in the house, heroes and figures in cutscenes), the offset is dropped; the
// transition is faded in smoothly (weight 0…1 per figure in the renderer).

/** Maximum offset in tiles (radius). */
export const JITTER_TILES = 0.16;
/** Fade-in speed of the offset (weight per second). */
export const JITTER_FADE = 3;

/** Integer hash of an ID (evenly distributed, deterministic). */
function hashId(id) {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Fixed offset of a figure in tiles; magnitude at most JITTER_TILES, at least a third of it
 * (so two figures on the same point are visibly apart).
 * @param {number} id
 * @returns {{dx:number, dz:number}}
 */
export function jitterOffset(id) {
  const h = hashId(id);
  const a = ((h & 0xffff) / 0x10000) * Math.PI * 2;
  const r = JITTER_TILES * (0.35 + 0.65 * Math.sqrt((h >>> 16) / 0x10000));
  return { dx: Math.cos(a) * r, dz: Math.sin(a) * r };
}

/**
 * Should this figure currently be drawn offset? 1 = yes, 0 = exact position.
 * @param {object} e entity (read only)
 * @param {boolean} moving has moved since the last tick
 */
export function jitterTarget(e, moving) {
  switch (e.kind) {
    case 'leader': case 'soldier': return 1;
    // Serfs: not while working (building, felling, mining, delivering at the target)
    case 'unit': return !moving && e.job && !e.path?.length && !e.militia ? 0 : 1;
    // Workers: only on the way or while waiting outside, not at the workplace, in the house or at the fire
    case 'worker': return !e.inside && (e.state === 'walk' || e.state === 'waiting') ? 1 : 0;
    // Heroes (cutscenes, script steps), NPCs, traps, siege weapons: exact
    default: return 0;
  }
}
