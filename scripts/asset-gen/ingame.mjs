// Screenshots of new characters in the running game (desktop 1440×900 and phone), serfs at work,
// at several zoom levels.
//
//   node scripts/asset-gen/ingame.mjs [output-folder=review] [--stops closest:3,close:6,medium:12,game:28,far:50,farthest:75]
//                                     [--root <other checkout>] [--focus tree|site] [--pitch 0.95] [--yaw 0.7] [--query nature=off]
//                                     [--weather winter|rain] (switch the rendering's weather, wait for winter models)
//                                     [--lineup [--heroes nelia,orrin,taran,malvor]] (size comparison, heroes next to serfs)
//
// Starts Vite (port 4391 or PREVIEW_PORT) with the checkout `--root` (default: this repo), a game with
// ?quality=high (GLB characters even without a real GPU), sends serfs to the nearest tree and to a construction site,
// fast-forwards the simulation and photographs each zoom level – with the game's pitch and rotated so that no
// building or tree stands in front of the workers. Alongside, meta.json with figure height (px) and a
// crop around the figures near the image centre.

import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';
import { createServer } from 'vite';
import { ROOT } from './lib.mjs';

import { BUILDINGS } from '../../src/sim/data/buildings.js';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const root = path.resolve(opt('--root', ROOT));
const stops = opt('--stops', 'closest:3,close:6,medium:12,game:28,far:50,farthest:75').split(',').map((s) => { const [name, d] = s.split(':'); return { name, dist: Number(d) }; });
const focus = opt('--focus', 'tree');
const buildType = opt('--build'); // building test: place finished buildings of this type next to the castle (3× blue, 1× red)
const buildLevels = Number(opt('--levels', 3));
const lineup = args.includes('--lineup') && (args.splice(args.indexOf('--lineup'), 1), true); // size comparison: hero, serfs, captain side by side at the village centre
const march = args.includes('--march') && (args.splice(args.indexOf('--march'), 1), true); // squads set off (walking/riding motion), camera follows the blue captain
const heroes = opt('--heroes'); // lineup with several heroes, e.g. nelia,orrin,taran,malvor (hero comparison)
const army = opt('--army'); // character test: captain with a squad of this unit (e.g. sword1) in blue and red next to the castle // blue in level 1 … levels (upgrade levels side by side)
const hpPercent = opt('--hp'); // building test: hit points of the levels in percent, e.g. 40,20 (smoke, fire)
const query = opt('--query', ''); // further URL parameters, e.g. nature=off
const weather = opt('--weather'); // e.g. winter: snow, bare deciduous trees (rendering only)
const pitchOpt = opt('--pitch');
const pitch = pitchOpt === undefined ? null : Number(pitchOpt); // without argument: pitch as in the game
const yawOpt = opt('--yaw');
const yaw = yawOpt === undefined ? null : Number(yawOpt); // without argument: clear view of the workers
const out = path.resolve(args[0] ?? path.join(ROOT, 'review'));
fs.mkdirSync(out, { recursive: true });

const server = await createServer({ root, configFile: path.join(root, 'vite.config.js'), server: { port: Number(process.env.PREVIEW_PORT || 4391) }, logLevel: 'error' });
await server.listen();
// The game lives under play/ (older versions without a website: at the root)
const url = server.resolvedUrls.local[0] + (fs.existsSync(path.join(root, 'play', 'index.html')) ? 'play/' : '');
const exe = process.env.PW_CHROMIUM ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const SETUP = () => {
  const e = window.__kronland, s = e.sim;
  const hq = s.findBuilding(0, 'headquarters');
  const serfs = [...s.entities.values()].filter((x) => x.kind === 'unit' && x.owner === 0 && !x.militia);
  const cx = hq.x + hq.w / 2, cy = hq.y + hq.h / 2;
  const trees = [...s.entities.values()].filter((x) => x.kind === 'tree').sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  const p = s.findPlacement(0, 'residence', hq.x + 2, hq.y + 6);
  e.issue({ type: 'placeBuilding', building: 'residence', x: p.x, y: p.y });
  const half = Math.ceil(serfs.length / 2);
  e.issue({ type: 'assignWork', units: serfs.slice(0, half).map((u) => u.id), target: trees[0].id });
  e.stepOnce();
  const site = [...s.entities.values()].find((x) => x.kind === 'building' && x.owner === 0 && !x.done);
  if (site) e.issue({ type: 'assignWork', units: serfs.slice(half).map((u) => u.id), target: site.id });
  // fast-forward the simulation directly (software WebGL draws too slowly for real time): walk there, start working
  for (let i = 0; i < 160; i++) e.stepOnce();
  e.paused = true; // hold the position, animations keep running
  // View onto the middle of the workers, camera rotated the way a player would rotate it: the game's camera logic
  // lifts the camera over slopes and roofs – the chosen rotation is the one where, up close, it is lifted least
  // and no building or tree stands in front of the workers (on a tie close to the default rotation)
  const rig = e.renderer.rig;
  const blds = [...s.entities.values()].filter((x) => x.kind === 'building');
  const occluded = (x, y) => (blds.some((b) => x >= b.x - 0.5 && x <= b.x + b.w + 0.5 && y >= b.y - 0.5 && y <= b.y + b.h + 0.5) ? 2 : 0)
    + (trees.some((t) => Math.hypot(t.x + 0.5 - x, t.y + 0.5 - y) < 1.2) ? 1 : 0);
  const lifted = (x, y, yaw, dist) => {
    rig.yaw = yaw; rig.dist = dist; rig.lookAt(x, y); rig.update(0);
    return Math.max(0, rig.camera.position.y - (rig.aim.y + Math.sin(rig.shownPitch) * dist));
  };
  const view = (units, fx, fy) => {
    const near = units.map((u) => [u.px / 1000, u.py / 1000]).filter(([x, y]) => Math.hypot(x - fx, y - fy) < 3.5);
    const lx = near.length ? near.reduce((a, q) => a + q[0], 0) / near.length : fx;
    const ly = near.length ? near.reduce((a, q) => a + q[1], 0) / near.length : fy;
    let yaw = 0.7, best = Infinity;
    for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8]) {
      const a = 0.7 + (k * Math.PI) / 8;
      let cost = lifted(lx, ly, a, 3) + lifted(lx, ly, a, 6);
      for (let d = 0.75; d <= 6; d += 0.25) cost += (occluded(lx + Math.sin(a) * d, ly + Math.cos(a) * d) / d) * 0.25;
      if (cost < best - 1e-6) { best = cost; yaw = a; }
    }
    return { x: lx, y: ly, yaw };
  };
  return {
    site: view(serfs.slice(half), p.x + 1.5, p.y + 1.5),
    tree: view(serfs.slice(0, half), trees[0].x + 0.5, trees[0].y + 0.5),
  };
};

/** Figures near the image centre: screen position and height (CSS pixels), from that a crop. */
const MEASURE = () => {
  const e = window.__kronland, r = e.renderer;
  const W = innerWidth, H = innerHeight;
  const figs = [];
  for (const x of e.sim.entities.values()) {
    if (x.kind !== 'unit' || x.owner !== 0) continue;
    const px = x.px / 1000, pz = x.py / 1000, y = r.terrain.heightAt(px, pz);
    const a = r.project(px, y, pz), b = r.project(px, y + 0.95, pz);
    if (!a || a.x < 0 || a.y < 0 || a.x > W || a.y > H) continue;
    figs.push({ x: a.x, y: a.y, h: Math.abs(a.y - b.y), d: Math.hypot(a.x - W / 2, a.y - H / 2) });
  }
  figs.sort((p, q) => p.d - q.d);
  if (!figs.length) return { figs: 0, crop: null };
  // crop around the figure near the image centre: about four times the figure height, at least 90 px
  const f = figs[0];
  const size = Math.max(90, f.h * 4);
  const cx = f.x, cy = f.y - f.h / 2;
  const x0 = Math.max(0, cx - size / 2), y0 = Math.max(0, cy - size * 0.4);
  const crop = { x: Math.round(x0), y: Math.round(y0), w: Math.round(Math.min(W - x0, size)), h: Math.round(Math.min(H - y0, size * 0.8)) };
  return { figs: figs.length, figurePx: Math.round(f.h), crop, levels: r.chars.stats.levels, positions: figs.slice(0, 8) };
};

const meta = {};
for (const [name, ctx] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { ...devices['Pixel 7'] }]]) {
  const page = await browser.newPage(ctx);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?seed=42&quality=high&fog=off${query ? '&' + query : ''}`);
  await page.waitForFunction(() => !!window.__kronland?.sim, null, { timeout: 180000 });
  const info = await page.evaluate(SETUP);
  if (buildType) {
    info.build = await page.evaluate(({ type, levels, hp, def }) => {
      const e = window.__kronland, s = e.sim;
      const hq = s.findBuilding(0, 'headquarters');
      const made = [];
      const probe = { headquarters: 'university', villageCenter: 'university' }[type] ?? type;
      // upgrade levels (blue) in a row: search a free strip for all (water, occupied, steep slope = 1 | 2 | 8)
      const cx0 = hq.x + hq.w + 2, cy0 = hq.y + hq.h + 3, W = levels * (def.w + 1) + 1, H = def.h + 2;
      let row = null;
      for (let r = 0; r <= 30 && !row; r++) for (let dy = -r; dy <= r && !row; dy++) for (let dx = -r; dx <= r && !row; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && s.map.rectFree(cx0 + dx, cy0 + dy, W, H, 1 | 2 | 8)) row = { x: cx0 + dx, y: cy0 + dy };
      }
      for (let k = 0; k < levels; k++) {
        // castle and village centre cannot be built freely: if necessary look for a spot via a free type of similar size
        const p = row ? { x: row.x + 1 + k * (def.w + 1), y: row.y + 1 } : s.findPlacement(0, probe, cx0, cy0, 25);
        if (!p) continue;
        const b = s.createBuilding(0, type, p.x, p.y, true);
        b.level = k;
        if (hp.length) b.hp = Math.max(1, Math.round((b.hp * hp[k % hp.length]) / 100));
        made.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, owner: 0 });
      }
      // red (level 1) for colour comparison
      const p = s.findPlacement(0, probe, cx0, cy0 + def.h + 3, 25);
      if (p) { const b = s.createBuilding(1, type, p.x, p.y, true); made.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, owner: 1 }); }
      e.stepOnce();
      // view onto the upgrade levels (blue); red only stands next to them for colour comparison
      const blue = made.filter((m) => m.owner === 0);
      const cx = blue.reduce((a, m) => a + m.x, 0) / blue.length, cy = blue.reduce((a, m) => a + m.y, 0) / blue.length;
      return { x: cx, y: cy, yaw: 0.7, n: made.length, made };
    }, { type: buildType, levels: buildLevels, hp: hpPercent ? hpPercent.split(',').map(Number) : [], def: { w: BUILDINGS[buildType].w, h: BUILDINGS[buildType].h } });
  }
  if (army) {
    info.army = await page.evaluate(({ defId, march }) => {
      const e = window.__kronland, s = e.sim;
      const hq = s.findBuilding(0, 'headquarters');
      const x = hq.x + hq.w + 3, y = hq.y + 1;
      const a = s.spawnLeader(0, defId, x, y);
      s.spawnLeader(1, defId, x + 3, y + 2);
      for (let k = 0; k < 5; k++) e.stepOnce();
      if (march) {
        // blue walks far away (on the move during all shots), red stays put
        const goal = [[x + 30, y], [x - 30, y], [x, y + 30], [x, y - 30], [x + 20, y + 20], [x - 20, y - 20]]
          .map(([gx, gy]) => [Math.max(2, Math.min(s.map.width - 3, gx)), Math.max(2, Math.min(s.map.height - 3, gy))])
          .find(([gx, gy]) => s.map.walkable(gx, gy));
        if (goal) e.issue({ type: 'order', order: 'move', units: [a.id], x: goal[0], y: goal[1] });
        for (let k = 0; k < 20; k++) e.stepOnce();
        e.paused = false; // simulation keeps running so the squad stays in motion
        window.__marchLeader = a.id;
      }
      return { x: x + 1.5, y: y + 1.5, yaw: 0.7 };
    }, { defId: army, march });
  }
  if (lineup) {
    info.army = await page.evaluate(({ LINE_YAW, heroes }) => {
      const e = window.__kronland, s = e.sim, U = 1000;
      const hq = s.findBuilding(0, 'headquarters');
      const p = s.findPlacement(0, 'university', hq.x + hq.w + 2, hq.y + hq.h + 3, 25);
      const vc = s.createBuilding(0, 'villageCenter', p.x, p.y, true);
      const want = heroes ? heroes.split(',') : ['nelia'];
      for (const id of want) if (![...s.entities.values()].some((x) => x.kind === 'hero' && x.owner === 0 && x.hero === id)) s.spawnHero(0, id);
      s.spawnLeader(0, 'sword1', vc.x, vc.y + vc.h + 3, 0);
      e.stepOnce();
      const heroList = want.map((id) => [...s.entities.values()].find((x) => x.kind === 'hero' && x.owner === 0 && x.hero === id));
      const serfs = [...s.entities.values()].filter((x) => x.kind === 'unit' && x.owner === 0).slice(0, 2);
      const leader = [...s.entities.values()].filter((x) => x.kind === 'leader' && x.owner === 0).pop();
      // in a row across the viewing direction (same distance to the camera, sizes directly comparable)
      const ox = vc.x + 2, oy = vc.y + vc.h + 1.2, dx = Math.cos(LINE_YAW), dy = -Math.sin(LINE_YAW);
      // trees between camera and row removed (otherwise they hide the figures)
      for (const t of [...s.entities.values()]) if (t.kind === 'tree' && Math.hypot(t.x + 0.5 - ox, t.y + 0.5 - oy) < 9) s.entities.delete(t.id);
      e.renderer.natureDirty = true;
      // hide decoration bushes and rocks around the row (otherwise they hid figures at the edge)
      e.renderer.hideScatter(Math.floor(ox) - 6, Math.floor(oy) - 6, 12, 12);
      const row = [heroList[0], ...serfs, ...heroList.slice(1), leader].filter(Boolean);
      row.forEach((u, i) => {
        const k = (i - (row.length - 1) / 2) * 0.85;
        u.px = Math.round((ox + dx * k) * U); u.py = Math.round((oy + dy * k) * U); u.path = null; u.target = null; u.state = 'idle';
      });
      e.paused = true;
      return { x: ox, y: oy, yaw: LINE_YAW };
    }, { LINE_YAW: Number(opt('--line-yaw', 0.7)), heroes });
  }
  if (weather) {
    await page.evaluate((w) => window.__kronland.renderer.applyWeather(w), weather);
    // winter versions of the trees are loaded on the first winter; ambient light a few frames later
    await page.waitForFunction(() => !window.__kronland.renderer.env.envDirty, null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(6000);
  }
  // own building models are loaded later
  if (buildType || army) await page.waitForTimeout(8000);
  meta[`view-${name}`] = info;
  const at = army || lineup ? info.army : buildType ? info.build : focus === 'site' ? info.site : info.tree;
  for (const s of stops) {
    await page.evaluate(({ at, dist, pitch, yaw }) => {
      const r = window.__kronland.renderer.rig;
      // marching squad: camera on the captain
      const L = window.__marchLeader && window.__kronland.sim.entities.get(window.__marchLeader);
      if (L) at = { ...at, x: L.px / 1000, y: L.py / 1000 };
      r.dist = dist; r.yaw = yaw ?? at.yaw;
      if (pitch !== null) r.pitch = pitch;
      r.lookAt(at.x, at.y); r.update(0);
      // redetermine levels of detail (without hysteresis of the previous level): the image does not depend on the zoom direction
      for (const rec of window.__kronland.renderer.chars.records.values()) if (rec.lod) rec.lod.level = -1;
    }, { at, dist: s.dist, pitch, yaw });
    // First let it redraw (software graphics: few frames/s), then wait for the cross-fade between near and
    // game model, then one more frame
    const frames = (n) => page.evaluate((n) => new Promise((res) => {
      const c = window.__kronland.renderer.chars, f0 = c.frameNo;
      const tick = () => (c.frameNo >= f0 + n ? res() : requestAnimationFrame(tick));
      tick();
    }), n);
    await frames(2);
    await page.waitForFunction(() => [...window.__kronland.renderer.chars.records.values()].every((r) => r.lodFrom === undefined), null, { timeout: 60000 }).catch(() => {});
    await frames(1);
    const file = `${s.name}-${name}.png`;
    await page.screenshot({ path: path.join(out, file), timeout: Number(process.env.SHOT_TIMEOUT || 180000) }); // longer under load (software graphics): SHOT_TIMEOUT=600000
    meta[file] = { ...(await page.evaluate(MEASURE)), dist: s.dist, scale: ctx.deviceScaleFactor ?? 1 };
    if (lineup) meta[file].variants = await page.evaluate(() => {
      const c = window.__kronland.renderer.chars, o = {};
      return import('/src/render/characters.js').then(({ posedBounds }) => {
        for (const [k, v] of c.variants) if (v && !v.procedural) {
          const f = (fr) => { const b = posedBounds(v.levels[0], v.bake, fr); return [+b.min.y.toFixed(3), +b.max.y.toFixed(3)]; };
          const idle = v.clip('idle'), walk = v.clip('walk');
          o[k] = { scale: +v.scale.toFixed(3), f0: f(0), idle: f(idle.start), walk: f(walk.start), idleKey: idle.key, walkDur: walk.duration, natWalk: v.groundSpeed('walk'), natCarry: v.groundSpeed('carry'), natRun: v.groundSpeed('run') };
        }
        return o;
      });
    });
  }
  console.log(name, errors.length ? 'Errors: ' + errors.join(' | ') : 'ok');
  await page.close();
}
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));
await browser.close();
await server.close();
