// Small preview image of a save game: the minimap (terrain, fog, buildings) as a 96×96 image.
// Not a screenshot of the 3D scene: that would need preserveDrawingBuffer (costs performance) and would be
// less informative at the same size. Result ~3–8 kB as data: URL (WebP, otherwise PNG).

import { playerColor } from '../plugin.js';
import { Engine } from '../../game/Engine.js';
import { loadGame } from '../../sim/serialize.js';
import { exploredBox } from './crop.js';

export const THUMB_SIZE = 96;


/**
 * @param {any} engine engine (reads only minimapTerrain/minimapFog/minimapDynamic)
 * @returns {string|null}
 */
export function makeThumb(engine, size = THUMB_SIZE) {
  try {
    if (typeof document === 'undefined' || !engine?.sim) return null;
    const t = engine.minimapTerrain();
    const src = document.createElement('canvas');
    src.width = t.w; src.height = t.h;
    src.getContext('2d').putImageData(new ImageData(t.data, t.w, t.h), 0, 0);
    const f = engine.minimapFog?.();
    // With fog: zoom to the explored area (otherwise the image is almost entirely black)
    const crop = f ? exploredBox(f) : { x: 0, y: 0, s: t.w };
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#0a0b10';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(src, crop.x, crop.y, crop.s, crop.s, 0, 0, size, size);
    if (f) {
      const fc = document.createElement('canvas');
      fc.width = f.w; fc.height = f.h;
      fc.getContext('2d').putImageData(new ImageData(f.data, f.w, f.h), 0, 0);
      ctx.drawImage(fc, crop.x, crop.y, crop.s, crop.s, 0, 0, size, size);
    }
    const d = engine.minimapDynamic();
    const s = size / crop.s;
    for (const b of d.buildings) {
      ctx.globalAlpha = b.ghost ? 0.55 : 1;
      ctx.fillStyle = playerColor(b.owner);
      ctx.fillRect((b.x - crop.x) * s, (b.y - crop.y) * s, Math.max(2, b.w * s), Math.max(2, b.h * s));
    }
    ctx.globalAlpha = 1;
    const webp = out.toDataURL('image/webp', 0.75);
    return webp.startsWith('data:image/webp') ? webp : out.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Preview image without a running game (e.g. for imported files): trial-load the simulation and
 * produce the same minimap images of the engine (vision of player 0; foreign buildings only without fog).
 * @param {any} state simulation state (saveGame())
 * @returns {string|null}
 */
export function thumbFromState(state, size = THUMB_SIZE) {
  try {
    const sim = loadGame(state);
    const P = Engine.prototype;
    const view = { sim, player: 0, fogLifted: P.fogLifted };
    view.minimapTerrain = P.minimapTerrain.bind(view);
    view.minimapFog = P.minimapFog.bind(view);
    view.minimapDynamic = () => {
      const all = view.fogLifted();
      const buildings = [];
      for (const e of sim.entities.values()) {
        if (e.kind === 'building' && (all || e.owner === 0)) buildings.push({ x: e.x, y: e.y, w: e.w, h: e.h, owner: e.owner });
      }
      return { w: sim.map.width, h: sim.map.height, buildings };
    };
    return makeThumb(view, size);
  } catch {
    return null;
  }
}
