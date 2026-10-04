// UI of the expansion content (specialists, tavern, bridges, notices).
// Like Engine.uiState: only IDs, numbers and i18n codes; texts are made by src/ui (keys 'addon.*').
// The engine calls these functions in a few places (selection, context command, notices, build menu).

import { SPECIALISTS, STEAL_FROM } from '../sim/data/addon.js';
import { checkRecruitSpecial, checkSpecialAction, countSpecialists } from '../sim/systems/addon.js';
import { UNIT } from '../sim/fixed.js';

/** Additional entries in the build menu and their tabs. */
export const ADDON_BUILD_MENU = ['tavern', 'gunsmith', 'bridge', 'fountain', 'statue'];
export const ADDON_BUILD_CATEGORY = { tavern: 'home', gunsmith: 'military', bridge: 'admin', fountain: 'admin', statue: 'admin' };

/** Actions that first need a target (click on building or ground). */
const TARGETED = new Set(['steal', 'sabotage', 'torch']);

/** Own selected specialists. */
export function ownSpecialistIds(engine) {
  const out = [];
  for (const id of engine.selected) {
    const e = engine.sim.entities.get(id);
    if (e?.kind === 'specialist' && e.owner === engine.player) out.push(id);
  }
  return out;
}

/**
 * Section in the tavern's building panel: recruit thief and scout.
 * @param {import('./Engine.js').Engine} engine @param {any} b
 */
export function tavernSection(engine, b) {
  const sim = engine.sim;
  if (b.type !== 'tavern' || !b.done || !sim.addon) return null;
  return {
    id: 'tavern', title: 'addon.section.tavern', icon: 'b-tavern',
    actions: Object.values(SPECIALISTS).map((d) => ({
      id: d.id, label: `addon.recruit.${d.id}`, icon: `sp-${d.id}`, tip: `addon.specDesc.${d.id}`,
      cost: Object.entries(d.cost), reason: checkRecruitSpecial(sim, engine.player, b, d.id),
      count: countSpecialists(sim, engine.player, d.id), max: d.max,
      cmd: { type: 'recruitSpecial', building: b.id, spec: d.id },
    })),
  };
}

/** Selection data for selected own specialists. */
export function specialistSelection(engine) {
  const sim = engine.sim;
  const units = ownSpecialistIds(engine).map((id) => {
    const e = sim.entities.get(id);
    const def = SPECIALISTS[e.spec];
    return {
      id, spec: e.spec, hp: e.hp, maxHp: def.hp, hidden: !!e.hidden, order: e.order?.type ?? 'idle',
      carry: e.carry ? { ...e.carry } : null,
      abilities: Object.entries(def.abilities).map(([a, ab]) => {
        const left = Math.max(0, (e.ready[a] ?? 0) - sim.tick);
        return { id: a, readyIn: Math.ceil(left / 10), frac: ab.cooldown ? Math.min(1, left / ab.cooldown) : 0, reason: checkSpecialAction(sim, e, a), targeted: TARGETED.has(a) };
      }),
    };
  });
  return { kind: 'specialists', units, mode: engine.specialMode ?? null };
}

/**
 * Button in the specialist panel: actions with a target toggle target mode, the others go out immediately.
 * @param {import('./Engine.js').Engine} engine @param {string} action
 */
export function specialAction(engine, action) {
  const ids = ownSpecialistIds(engine);
  if (!ids.length) return;
  if (TARGETED.has(action)) { engine.specialMode = engine.specialMode === action ? null : action; engine.emitUi(); return; }
  const fit = ids.filter((id) => action === 'stop' || Object.hasOwn(SPECIALISTS[engine.sim.entities.get(id).spec].abilities, action));
  if (fit.length) engine.issue({ type: 'special', units: fit, action });
}

/**
 * Context command (right-click/tap) for selected specialists.
 * @returns {null|'mode'|true} null: no specialists, 'mode': target mode handled (click consumed), true: command given
 */
export function specialCommandAt(engine, cx, cy) {
  const ids = ownSpecialistIds(engine);
  if (!ids.length) return null;
  const sim = engine.sim, mode = engine.specialMode;
  engine.specialMode = null;
  const hit = engine.selectable(engine.renderer.pickEntity(cx, cy));
  const g = engine.renderer.pickGround(cx, cy);
  const of = (spec) => ids.filter((id) => sim.entities.get(id)?.spec === spec);
  const enemyBuilding = hit?.kind === 'building' && hit.owner !== engine.player && hit.owner >= 0 && !sim.allied(hit.owner, engine.player);
  if (mode === 'steal' || mode === 'sabotage') {
    if (enemyBuilding && of('thief').length) engine.issue({ type: 'special', units: of('thief'), action: mode, target: hit.id });
    else engine.toast('err.badTarget', null, { icon: 'warning', tone: 'warn', ttl: 2500 });
    engine.emitUi();
    return 'mode';
  }
  if (mode === 'torch') {
    if (g && of('scout').length) engine.issue({ type: 'special', units: of('scout'), action: 'torch', x: Math.floor(g.x), y: Math.floor(g.z) });
    engine.emitUi();
    return 'mode';
  }
  // Without a mode: thieves steal from enemy castles/camps, otherwise everyone walks
  if (enemyBuilding && STEAL_FROM.includes(hit.type) && of('thief').length) {
    engine.issue({ type: 'special', units: of('thief'), action: 'steal', target: hit.id });
    const rest = ids.filter((id) => sim.entities.get(id)?.spec !== 'thief');
    if (rest.length && g) engine.issue({ type: 'special', units: rest, action: 'move', x: Math.floor(g.x), y: Math.floor(g.z) });
    return true;
  }
  if (!g) return null;
  engine.issue({ type: 'special', units: ids, action: 'move', x: Math.floor(g.x), y: Math.floor(g.z) });
  return true;
}

/** Notices for expansion events. */
export function addonToasts(engine, ev) {
  const sim = engine.sim, me = engine.player;
  const at = (x, y) => (x === undefined ? null : { x: x / UNIT, y: y / UNIT });
  switch (ev.type) {
    case 'specialistRecruited':
      if (ev.player === me) engine.toast('addon.toast.recruited', { name: `addon.spec.${ev.spec}` }, { icon: `sp-${ev.spec}`, tone: 'good', pos: engine.entityPos(sim.entities.get(ev.unit)) });
      break;
    case 'stolen':
      if (ev.player === me) engine.toast('addon.toast.stolen', { gold: ev.gold, amount: ev.amount, res: ev.res ?? 'gold' }, { icon: 'ab-steal', tone: 'good', pos: at(ev.x, ev.y) });
      else if (ev.victim === me) engine.toast('addon.toast.robbed', { gold: ev.gold, amount: ev.amount, res: ev.res ?? 'gold' }, { icon: 'ab-steal', tone: 'bad', pos: engine.entityPos(sim.entities.get(ev.building)), ttl: 8000 });
      break;
    case 'lootDelivered':
      if (ev.player === me) engine.toast('addon.toast.lootDelivered', { gold: ev.gold, amount: ev.amount, res: ev.res ?? 'gold' }, { icon: 'gold', tone: 'good' });
      break;
    case 'chargePlaced':
      if (ev.player === me) engine.toast('addon.toast.chargePlaced', null, { icon: 'ab-sabotage', tone: 'good', pos: at(ev.x, ev.y) });
      // The victim only learns of it if it sees the spot
      else if (ev.victim === me && engine.tileVisible(ev.x / UNIT, ev.y / UNIT)) engine.toast('addon.toast.chargeEnemy', null, { icon: 'ab-sabotage', tone: 'bad', pos: at(ev.x, ev.y), ttl: 8000 });
      break;
    case 'bridgeBuilt':
      if (ev.player === me) engine.toast('addon.toast.bridgeBuilt', null, { icon: 'b-bridge', tone: 'good', pos: { x: ev.x + ev.w / 2, y: ev.y + ev.h / 2 } });
      break;
    case 'bridgeCollapsed':
      if (engine.tileVisible(ev.x + ev.w / 2, ev.y + ev.h / 2)) engine.toast('addon.toast.bridgeCollapsed', null, { icon: 'b-bridge', tone: 'warn', pos: { x: ev.x + ev.w / 2, y: ev.y + ev.h / 2 } });
      break;
    case 'resourcesFound':
      if (ev.player === me) {
        if (ev.count) engine.toast('addon.toast.found', { n: ev.count }, { icon: 'ab-findResources', tone: 'good', pos: ev.found[0] ? { x: ev.found[0].x + 0.5, y: ev.found[0].y + 0.5 } : null });
        else engine.toast('addon.toast.foundNone', null, { icon: 'ab-findResources', ttl: 3000 });
      }
      break;
    default: break;
  }
}

/**
 * Has an enemy thief just become visible (discovered by towers/scouts)? Notice, throttled.
 * Called per tick from the engine.
 */
export function watchThieves(engine) {
  const sim = engine.sim;
  if (!sim.addon || sim.tick % 10 !== 0) return;
  const before = engine.thievesSeen ?? new Set();
  // rebuild every time: fallen thieves do not stay in memory
  const seen = new Set();
  for (const e of sim.entities.values()) {
    if (e.kind !== 'specialist' || e.spec !== 'thief' || e.owner === engine.player || sim.allied(e.owner, engine.player)) continue;
    if (e.hidden || !engine.canSee(e)) continue;
    seen.add(e.id);
    if (!before.has(e.id)) engine.toast('addon.toast.thiefSeen', null, { icon: 'sp-thief', tone: 'bad', pos: engine.entityPos(e), ttl: 6000 });
  }
  engine.thievesSeen = seen;
}
