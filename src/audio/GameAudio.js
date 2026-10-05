// GameAudio: bridge between Engine (simulation + camera) and AudioEngine.
// - translates simulation events (sim.events) into sounds,
// - derives work sounds from the state (serfs chopping/building, workers in workshops),
//   only near the camera and throttled – the simulation stays untouched,
// - keeps listener (camera), combat intensity, water proximity, music theme and ambience up to date.

import { getAudio } from './AudioEngine.js';
import { audibleRadius, viewRadius, zoomGain } from './spatial.js';
import { BattleMeter } from './battle.js';
import { BarkGate, barkRole } from './barks.js';
import { voiceFile } from './voiceLines.js';
import { speaking } from './speech.js';
import { pickVariant } from '../render/variants.js';
import { characterManifest } from '../render/characters.js';
import { UNITS } from '../sim/data/units.js';
import { currentLang } from '../i18n/index.js';

const UNIT = 1000;
const WATER = 1;

/** Workshop → work sound of the workers inside. */
export const WORKSHOP_SOUND = {
  sawmill: 'saw', smithy: 'anvil', stonemason: 'chisel', brickworks: 'hammer', alchemist: 'bubble',
  clayMine: 'pickaxe', stoneMine: 'pickaxe', ironMine: 'pickaxe', sulfurMine: 'pickaxe',
};

/** Hero ability → sound. */
export const ABILITY_SOUND = { shieldBash: 'whirl', courage: 'might', salve: 'heal', caltrops: 'trap', fieldGun: 'turret', intimidate: 'might', bribe: 'heal', farsight: 'might' };

/** Voice per bark role while the figure manifest is missing */
const DEFAULT_VOICE = { sword: 'sword', spear: 'sword', bow: 'soldierF', cavalry: 'sword', cannon: 'cannon' };

/** Unit kinds that make a sound when they fall. */
const MORTAL = new Set(['soldier', 'leader', 'unit', 'worker', 'hero']);

/** Music theme from combat mode and weather: in winter its own peace theme. */
export const musicTheme = (mode, weather) => (mode === 'build' && weather === 'winter' ? 'winter' : mode);

export class GameAudio {
  /** @param {import('../game/Engine.js').Engine} engine */
  constructor(engine) {
    this.engine = engine;
    this.audio = getAudio();
    this.battle = new BattleMeter();
    this.sceneTimer = 0;
    this.waterLevel = 0;
    this.lastWaterProbe = null;
    this.audio.setAmbient(true);
    this.audio.ambient.setWeather(engine.sim.weather?.state ?? 'summer');
    this.audio.music.setTheme(musicTheme('build', this.audio.ambient.weather));
    this.ended = false;
  }

  get player() { return this.engine.player; }

  /** Tile position of an entity (also one just removed, via prev). */
  posOf(id, prev) {
    const e = this.engine.sim.entities.get(id);
    if (e) {
      if (e.kind === 'building') return { x: e.x + e.w / 2, z: e.y + e.h / 2 };
      if (e.px !== undefined) return { x: e.px / UNIT, z: e.py / UNIT };
      if (e.x !== undefined) return { x: e.x + 0.5, z: e.y + 0.5 };
    }
    const p = prev?.get(id);
    return p ? { x: p.px / UNIT, z: p.py / UNIT } : null;
  }

  /**
   * Is the position in the fog of war (not visible to the player)? Own things are always visible,
   * so the tile suffices. Never without fog.
   */
  hidden(pos) {
    const e = this.engine;
    return !!pos && typeof e.tileVisible === 'function' && !e.tileVisible(pos.x, pos.z);
  }

  /** Combat activity for music and battle noise (only what the player can see). */
  heat(pos, w) { if (pos && !this.hidden(pos)) this.battle.add(pos, w); }

  /** Play spatially; important own events outside hearing range quietly global. Silent in fog. */
  at(name, pos, o = {}) {
    if (this.hidden(pos)) return false;
    if (!pos) return o.important ? this.audio.play(name, { gain: 0.35 * (o.gain ?? 1) }) : false;
    const ok = this.audio.play(name, { x: pos.x, z: pos.z, gain: o.gain, delay: o.delay });
    if (!ok && o.important && !this.inRange(pos)) return this.audio.play(name, { gain: 0.35 * (o.gain ?? 1), delay: o.delay });
    return ok;
  }

  inRange(pos) {
    const l = this.audio.listener;
    return !!l && Math.hypot(pos.x - l.x, pos.z - l.z) < audibleRadius(l.dist);
  }

  /** Events of one tick. @param {any[]} events @param {Map<number,{px:number,py:number}>} prev */
  onEvents(events, prev) {
    const a = this.audio, me = this.player, sim = this.engine.sim;
    for (const ev of events) {
      const own = ev.player === me;
      switch (ev.type) {
        case 'buildingDone': if (own) a.play('buildingDone'); break;
        case 'buildingPlaced': if (own) a.play('place'); break;
        case 'upgradeStarted': case 'lineUpgraded': if (own) a.play('upgrade'); break;
        case 'payday': if (own) a.play('coin'); break;
        case 'researchDone': if (own) a.play('research'); break;
        case 'workerArrived': if (own) a.play('workerArrived'); break;
        case 'serfBought': if (own) a.play('serfBought'); break;
        case 'recruited': if (own) a.play('recruited'); break;
        case 'blessed': if (own) a.play('blessing'); break;
        case 'rejected': if (own) a.play('error'); break;
        case 'heroRevived': if (ev.owner === me) a.play('notify'); break;
        case 'objective': if (ev.status === 'done' || ev.status === 'failed') a.play(ev.status === 'done' ? 'research' : 'error'); break;
        case 'wave': a.play('notify'); break;
        case 'dialog': a.play('open'); break;
        case 'shot': {
          const from = { x: ev.from.x / UNIT, z: ev.from.y / UNIT }, to = { x: ev.to.x / UNIT, z: ev.to.y / UNIT };
          this.heat(from, 1);
          const flight = Math.max(0.15, Math.hypot(to.x - from.x, to.z - from.z) / 22);
          if (ev.kind === 'ball') { this.at('cannon', from); this.at('arrowHit', to, { delay: flight, gain: 1.2 }); }
          else if (ev.kind === 'bolt') { this.at('ballista', from); this.at('arrowHit', to, { delay: flight }); }
          else { this.at('arrowShot', from, { gain: 0.8 }); this.at('arrowHit', to, { delay: flight, gain: 0.7 }); }
          break;
        }
        case 'hit': {
          const p = this.posOf(ev.by, prev);
          if (p) { this.heat(p, 1); this.at('clash', p, { gain: 0.75 }); }
          break;
        }
        case 'killed': {
          const p = this.posOf(ev.id, prev);
          this.heat(p, 2);
          if (ev.kind === 'hero' && ev.owner === me) a.play('heroDown');
          else if (MORTAL.has(ev.kind)) this.at('death', p);
          break;
        }
        case 'buildingDestroyed': {
          const p = this.posOf(ev.building, prev);
          this.at('buildingCrash', p, { important: ev.owner === me });
          break;
        }
        case 'explosion': {
          const p = { x: ev.x / UNIT, z: ev.y / UNIT };
          this.heat(p, 3);
          this.at('explosion', p, { important: true });
          break;
        }
        case 'ability': {
          const name = ABILITY_SOUND[ev.ability];
          const p = ev.x !== undefined ? { x: ev.x / UNIT, z: ev.y / UNIT } : this.posOf(ev.hero, prev);
          if (name) this.at(name, p, { important: ev.owner === me });
          break;
        }
        case 'weather': a.ambient.setWeather(ev.state); break;
        // game systems: fire, repair, ruins, market, building research, weather machine, experience
        case 'buildingBurning': if (own) this.at('notify', this.posOf(ev.building, prev), { important: true }); break;
        case 'buildingExtinguished': if (own) this.at('confirm', this.posOf(ev.building, prev)); break;
        case 'repaired': if (own) this.at('buildingDone', this.posOf(ev.building, prev), { gain: 0.7 }); break;
        case 'ruinCleared': this.at('buildingCrash', this.posOf(ev.ruin, prev), { gain: 0.4 }); break;
        case 'tradeStarted': if (own) a.play('coin', { gain: 0.6 }); break;
        case 'tradeDone': if (own) a.play('coin'); break;
        case 'weatherChanged': a.play('thunder', { gain: own ? 1 : 0.6 }); break;
        case 'promoted': if (own) this.at('upgrade', this.posOf(ev.leader, prev), { important: true }); break;
        case 'victory': {
          const won = sim.players[me]?.team === ev.team;
          this.end(won ? 'victory' : 'defeat');
          break;
        }
        case 'defeated': if (ev.player === me) this.end('defeat'); break;
        case 'missionWon': this.end('victory'); break;
        case 'missionLost': this.end('defeat'); break;
        default: break;
      }
    }
  }

  end(result) {
    if (this.ended) return;
    this.ended = true;
    this.audio.music.jingle(result);
  }

  /**
   * After every tick: derive work sounds from the state (only within hearing range). The strikes of a tick
   * are played in order of closeness to the screen centre: once the voice count per sound kind is used up,
   * the far ones stay silent, not the near ones.
   */
  onTick() {
    const l = this.audio.listener;
    const a = this.audio;
    if (!l || !a.ctx || a.ctx.state !== 'running') return;
    const sim = this.engine.sim, tick = sim.tick;
    const R = audibleRadius(l.dist), R2 = R * R;
    /** @type {{ snd: string, x: number, z: number, gain: number, d2: number }[]} */
    const hits = [];
    const add = (snd, x, z, gain) => {
      const dx = x - l.x, dz = z - l.z, d2 = dx * dx + dz * dz;
      if (d2 <= R2 && !this.hidden({ x, z })) hits.push({ snd, x, z, gain, d2 });
    };
    for (const e of sim.entities.values()) {
      if (e.kind === 'unit') {
        const job = e.job;
        if (!job || e.path?.length) continue;
        if (job.kind === 'gather') {
          // one strike every 10 ticks (1 s), offset per serf
          if (e.timer > 0 && (e.timer + e.id) % 10 === 0) add(job.res === 'wood' ? 'chop' : 'pickaxe', e.px / UNIT, e.py / UNIT, 0.7);
        } else if (job.kind === 'build' && (tick + e.id * 3) % 7 === 0) {
          const site = sim.entities.get(job.target);
          if (site && !site.done) add('hammer', e.px / UNIT, e.py / UNIT, 0.6);
        }
      } else if (e.kind === 'worker' && e.state === 'working' && (tick + e.id * 7) % 23 === 0) {
        const wp = sim.entities.get(e.workplace);
        const snd = wp && WORKSHOP_SOUND[wp.type];
        if (snd) add(snd, wp.x + wp.w / 2, wp.y + wp.h / 2, 0.5);
      }
    }
    hits.sort((p, q) => p.d2 - q.d2);
    for (const h of hits) a.play(h.snd, { x: h.x, z: h.z, gain: h.gain });
  }

  /** Per frame: listener, combat intensity, music theme, ambience. */
  frame(dt) {
    const rig = this.engine.renderer?.rig;
    if (!rig) return;
    const l = { x: rig.target.x, z: rig.target.z, dist: rig.dist, yaw: rig.yaw };
    this.audio.listener = l;
    // while a dialogue speaks, music and ambience step back
    const talk = speaking();
    if (talk !== !!this.audio.ducked) this.audio.duck(talk);
    this.battle.decay(dt);
    this.sceneTimer -= dt;
    if (this.sceneTimer > 0) return;
    this.sceneTimer = 0.25;
    const intensity = this.battle.intensity(l);
    if (!this.ended) {
      const mode = this.battle.theme(intensity, performance.now() / 1000);
      this.audio.music.setTheme(musicTheme(mode, this.audio.ambient.weather));
    }
    this.audio.ambient.setScene(this.waterNear(l), intensity, zoomGain(l.dist));
    this.audio.ambient.tick();
  }

  // ---------- Barks (voiced) ----------

  /** Voice of a figure to match its look: variant or role in the figure manifest (field voice). */
  voiceOf(e, textRole) {
    const roles = characterManifest()?.roles ?? {};
    if (e.kind === 'hero') return e.hero;
    if (e.kind === 'unit') {
      const v = roles.serf?.variants;
      return v?.length ? v[pickVariant(v, e.id)].voice ?? 'serf' : 'serf';
    }
    const line = UNITS[e.def]?.line;
    return roles[`soldier.${line}.leader`]?.voice ?? roles[`soldier.${line}`]?.voice ?? DEFAULT_VOICE[textRole] ?? 'sword';
  }

  /**
   * Play a short bark of the figure (selection or command) – only sometimes (setting "Sprüche der Figuren",
   * BARK_RULES), never over a running bark, then quiet; while a dialogue is read aloud, the
   * figures stay silent.
   * @param {any} e @param {'select'|'move'|'build'|'gather'|'attack'} event
   */
  bark(e, event) {
    if (!e || e.owner !== this.player) return;
    const now = performance.now() / 1000;
    const gate = (this.barks ??= new BarkGate());
    const nth = gate.touch(e.id, now);
    const role = barkRole(e, UNITS[e.def]?.line, (u) => this.voiceOf(u));
    if (!role) return;
    const mode = this.audio.settings?.barks ?? 'rare';
    const l = gate.choose({ mode, role, event, hero: e.kind === 'hero', nth, now, rnd: this.audio.rnd, busy: speaking() });
    const lang = currentLang();
    const url = l && voiceFile(this.voiceOf(e, role), lang, l[lang] ?? l.de);
    if (!url) return;
    gate.spoke(now, 4, mode); // provisional until the recording length is known
    this.audio.playFile(url, { gain: 0.9 }).then((dur) => gate.spoke(now, dur || 0, mode));
  }

  /** Speaker of a selection: hero before captain before serf. */
  speakerOf(ids) {
    const sim = this.engine.sim;
    let best = null, rank = 0;
    for (const id of ids) {
      const e = sim.entities.get(id);
      const r = !e || e.owner !== this.player ? 0 : e.kind === 'hero' ? 3 : e.kind === 'leader' ? 2 : e.kind === 'unit' ? 1 : 0;
      if (r > rank) { rank = r; best = e; }
    }
    return best;
  }

  /** Selection changed (Engine). */
  onSelect(ids) { this.bark(this.speakerOf(ids), 'select'); }

  /** Player command (Engine.issue): matching bark of the command recipients. */
  onCommand(cmd) {
    const ids = cmd.units ?? (cmd.unit ? [cmd.unit] : []);
    if (!ids.length) return;
    let event = 'move';
    if (cmd.type === 'order' && (cmd.order === 'attack' || cmd.order === 'attackMove')) event = 'attack';
    else if (cmd.type === 'placeBuilding') event = 'build';
    else if (cmd.type === 'assignWork') event = this.engine.sim.entities.get(cmd.target)?.kind === 'building' ? 'build' : 'gather';
    this.bark(this.speakerOf(ids), event);
  }

  /** Share of water tiles around the camera target (sampled coarsely, only recomputed on movement). */
  waterNear(l) {
    const m = this.engine.sim.map;
    const key = `${Math.round(l.x / 2)},${Math.round(l.z / 2)},${Math.round(l.dist / 8)}`;
    if (key === this.lastWaterProbe) return this.waterLevel;
    this.lastWaterProbe = key;
    const r = Math.min(16, viewRadius(l.dist) * 0.5);
    let n = 0, w = 0;
    for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) {
      const x = Math.floor(l.x + dx), y = Math.floor(l.z + dz);
      if (!m.inBounds(x, y)) continue;
      n++;
      if (m.flags[m.idx(x, y)] & WATER) w++;
    }
    // even little water in view is audible: 15 % water area = full volume
    this.waterLevel = n ? Math.min(1, (w / n) / 0.15) : 0;
    return this.waterLevel;
  }

  dispose() {
    this.audio.setAmbient(false);
    this.audio.listener = null;
  }
}
