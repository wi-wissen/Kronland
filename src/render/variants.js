// Variants of a figure role (e.g. serf male/female): pure functions without Three.js, so that
// rendering, selection panel (title, portrait) and sound (voice matching the look) make the same choice.
// See docs/MODELLE.md#varianten-und-geschlecht.

/**
 * Choose a variant for a unit: weighted, stable via the unit ID (looks random, but stays the same
 * across loading and replays). Rendering only – the simulation knows no variants.
 * @param {{weight?: number}[]} variants @param {number} id
 * @returns {number} index
 */
export function pickVariant(variants, id) {
  if (!variants?.length) return 0;
  let total = 0;
  for (const v of variants) total += Math.max(0, v.weight ?? 1);
  if (!(total > 0)) return 0;
  // Integer hash (murmur3 finalizer), independent of the phase offset of the animations
  let h = (id | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  let x = (h / 4294967296) * total;
  for (let i = 0; i < variants.length; i++) {
    x -= Math.max(0, variants[i].weight ?? 1);
    if (x < 0) return i;
  }
  return variants.length - 1;
}

/**
 * Variant list of the role that a key yields (or null): 'soldier.sword.leader' has its own model
 * (no variants), 'worker.farmer' its own variants, unknown roles fall back to the parent role.
 * @param {{roles?: Record<string, any>}|null|undefined} manifest @param {string} key
 * @returns {any[]|null}
 */
export function roleVariants(manifest, key) {
  const roles = manifest?.roles ?? {};
  const seen = new Set();
  let k = key;
  while (k && !seen.has(k)) {
    seen.add(k);
    const role = roles[k];
    if (role) {
      if (role.variants?.length) return role.variants;
      if (role.model || (role.procedural && !role.fallback)) return null;
      if (role.fallback) { k = role.fallback; continue; }
    }
    const dot = k.lastIndexOf('.');
    k = dot > 0 ? k.slice(0, dot) : null;
  }
  return null;
}

/**
 * Role of a figure in the figure manifest (serf, worker per profession, soldier per class, hero …).
 * @param {any} e entity @param {any[]} [players] sim.players (bandits: own look, except with soldierLook)
 * @param {Record<string, {line?: string}>} [units] UNITS (class per troop type)
 * @returns {string}
 */
export function figureRole(e, players = [], units = {}) {
  if (e.kind === 'unit') return e.militia ? 'soldier.spear' : 'serf';
  if (e.kind === 'npc') return e.look ?? 'serf';
  if (e.kind === 'worker') return `worker.${e.prof}`; // own model per profession, otherwise role 'worker'
  if (e.kind === 'hero') return `hero.${e.hero}`;
  const line = units[e.def]?.line ?? 'sword';
  if (players[e.owner]?.neutral && !players[e.owner].soldierLook) return line === 'bow' ? 'bandit.bow' : 'bandit';
  return `soldier.${line}${e.kind === 'leader' ? '.leader' : ''}`;
}

/**
 * Chosen variant of a figure – the same choice as the rendering (key '<role>#<index>').
 * @param {any} manifest @param {string} roleKey @param {number} id entity ID
 * @returns {{ index: number, variant: any }|null} null = role without variants
 */
export function figureVariant(manifest, roleKey, id) {
  const list = roleVariants(manifest, roleKey);
  if (!list) return null;
  const index = pickVariant(list, id);
  return { index, variant: list[index] };
}

/**
 * Sex of a figure as it is drawn: field `sex` of the variant (or of the role, e.g. heroine Nelia)
 * in the figure manifest, otherwise 'm'. One source for rendering, selection panel (title, portrait) and voice.
 * Rendering only – the simulation knows no sex.
 * @param {any} manifest @param {string} roleKey @param {number} id
 * @returns {'m'|'f'}
 */
export function figureSex(manifest, roleKey, id) {
  const v = figureVariant(manifest, roleKey, id);
  const sex = v ? v.variant.sex : manifest?.roles?.[roleKey]?.sex;
  return sex === 'f' ? 'f' : 'm';
}
