// Figure info for developer mode: state of the "state machine", goal, job, hit points.
// The simulation stores no uniform state per figure; it is derived here from the fields
// (read only). States: idle, walk, work, fight, carry, eat, sleep, rest, wait, down.

import { UNIT } from '../sim/fixed.js';
import { maxHp } from '../sim/systems/military.js';

/** Figure kinds with a position. */
export const FIGURE_KINDS = new Set(['unit', 'worker', 'leader', 'soldier', 'hero']);

/** Map the state of a worker (workers.js) to the shared names. */
const WORKER_STATE = { walk: 'walk', working: 'work', eating: 'eat', sleeping: 'sleep', camping: 'rest', waiting: 'wait', idle: 'idle' };

/**
 * @param {import('../sim/sim.js').Sim} sim @param {any} e
 * @returns {null | { id:number, kind:string, state:string, raw:string, goal:{x:number,y:number}|null,
 *   job:string|null, target:number, hp:number, maxHp:number, pathLen:number, owner:number, tile:{x:number,y:number} }}
 */
export function figureInfo(sim, e) {
  if (!e || !FIGURE_KINDS.has(e.kind) || e.px === undefined) return null;
  const W = sim.map.width;
  const path = e.path ?? [];
  const last = path.length ? path[path.length - 1] : -1;
  let goal = last >= 0 ? { x: last % W, y: (last / W) | 0 } : null;
  let state = 'idle', raw = '', job = null, target = 0;
  if (e.kind === 'worker') {
    raw = e.state ?? '';
    state = WORKER_STATE[raw] ?? raw ?? 'idle';
    if (e.inside && state === 'walk') state = 'work';
    job = e.intent || null;
    target = e.target ?? 0;
  } else if (e.kind === 'unit') {
    if (e.militia) { raw = e.order?.type ?? 'idle'; job = 'militia'; }
    if (e.job) {
      job = e.job.kind + (e.job.res ? ':' + e.job.res : '');
      target = e.job.target;
    }
    raw ||= e.job ? (path.length ? 'toJob' : 'atJob') : e.goal !== undefined ? 'move' : 'idle';
    state = e.targetId ? 'fight' : path.length ? (e.carry ? 'carry' : 'walk') : e.job ? 'work' : 'idle';
    if (!goal && e.goal !== undefined) goal = { x: e.goal % W, y: (e.goal / W) | 0 };
  } else {
    // captains, soldiers, heroes
    raw = e.kind === 'soldier' ? (e.targetId ? 'attack' : 'follow') : e.order?.type ?? 'idle';
    target = e.targetId ?? 0;
    state = e.down ? 'down' : e.targetId ? 'fight' : path.length ? 'walk' : 'idle';
    if (!goal && e.order && e.order.x !== undefined) goal = { x: Math.floor(e.order.x / UNIT), y: Math.floor(e.order.y / UNIT) };
  }
  const mh = maxHp(sim, e);
  return {
    id: e.id, kind: e.kind, owner: e.owner ?? -1, state, raw, goal, job, target,
    hp: e.hp ?? mh, maxHp: mh, pathLen: path.length,
    tile: { x: Math.floor(e.px / UNIT), y: Math.floor(e.py / UNIT) },
  };
}

/**
 * Figure that developer mode looks at: first selected figure (captain instead of soldier).
 * @param {import('../sim/sim.js').Sim} sim @param {Iterable<number>} selected
 */
export function focusFigure(sim, selected) {
  for (const id of selected) {
    let e = sim.entities.get(id);
    if (e?.kind === 'soldier') e = sim.entities.get(e.leader);
    if (e && FIGURE_KINDS.has(e.kind) && e.px !== undefined) return e;
  }
  return null;
}
