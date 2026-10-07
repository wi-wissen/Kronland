// GameAudio: bridge between Engine (simulation + camera) and AudioEngine.
// - translates simulation events (sim.events) into sounds,
// - derives work sounds from the state (serfs chopping/building, workers in workshops),
//   only near the camera, in time with the animation and distributed through a shared gate (workbeat.js) –
//   the simulation stays untouched,
// - keeps listener (camera), combat intensity, water proximity, music theme and ambience up to date.

import { getAudio } from './AudioEngine.js';
import { audibleRadius, viewRadius, zoomGain, spatialize } from './spatial.js';
import { StrikeGate, strikeIn, strikePhase, CLIP_SOUND, STRIKE_PERIOD } from './workbeat.js';
import { BattleMeter } from './battle.js';
import { BarkGate, barkRole, alarmRole, alarmVoices, chooseBark, BARKS, ALARM_REST, ALARM_DELAY, ALARM_WAIT } from './barks.js';
import { voiceFile } from './voiceLines.js';
import { NotifyGate } from './notify.js';
import { speaking, holdSpeech } from './speech.js';
import { shouldHold } from './hold.js';
import { figureRole, figureVariant, figureSex } from '../render/variants.js';
import { characterManifest } from '../render/characters.js';
import { UNITS } from '../sim/data/units.js';
import { currentLang } from '../i18n/index.js';

const UNIT = 1000;
const WATER = 1, CLIFF = 8;

/** Phase offset of a figure (like CharacterSystem), as a fallback without figure data. */
const idPhase = (id) => ((id * 2654435761) >>> 0) / 4294967296;

/** Work clip of a serf from its job (like Renderer.syncUnit). */
export function workClip(targetKind) { return targetKind === 'building' ? 'build' : targetKind === 'tree' ? 'chop' : 'mine'; }

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
    this.land = { water: 0, cliff: 0, forest: 0 };
    this.gate = new StrikeGate(this.audio.rnd);
    /** working serfs within hearing range (from onTick), strikes in time with their animation (frame) */
    this.working = [];
    /** @type {Map<number, { clip: string, t: number }>} */
    this.beats = new Map();
    this.audio.setAmbient(true);
    this.audio.ambient.setWeather(engine.sim.weather?.state ?? 'summer');
    this.audio.music.setTheme(musicTheme('build', this.audio.ambient.weather));
    this.ended = false;
    /** spoken notices (alarm calls) for checking in tests: { toast, role, voice, url, played } */
    this.announced = [];
    /** quiet periods for notice sounds from mass events (arrival, promotion) */
    this.notify = new NotifyGate();
  }

  /** Clock for combat music and alarm calls (seconds, real time). */
  now() { return performance.now() / 1000; }

  /** Is a player (or a figure with this number) the player's own? */
  mine(owner) { return owner !== undefined && owner === this.player; }

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
    const ownerOf = (id) => sim.entities.get(id)?.owner ?? prev?.get(id)?.owner;
    const now = a.ctx?.currentTime ?? 0;
    for (const ev of events) {
      // combat involving the player keeps the combat music (battle.js); otherwise it ends after the grace period
      if ((ev.type === 'hit' || ev.type === 'shot') && (this.mine(ev.owner ?? ownerOf(ev.by)) || this.mine(ownerOf(ev.target)))) this.battle.combat(this.now());
      else if (ev.type === 'killed' && MORTAL.has(ev.kind) && (ev.owner === me || ev.by === me)) this.battle.combat(this.now());
      const own = ev.player === me;
      switch (ev.type) {
        case 'buildingDone': if (own) a.play('buildingDone'); break;
        case 'buildingPlaced': if (own) a.play('place'); break;
        case 'upgradeStarted': case 'lineUpgraded': if (own) a.play('upgrade'); break;
        case 'payday': if (own) a.play('coin'); break;
        case 'researchDone': if (own) a.play('research'); break;
        case 'workerArrived': if (own) this.notify.run('workerArrived', now, () => a.play('workerArrived')); break;
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
        case 'promoted': if (own) this.notify.run('promoted', now, () => this.at('upgrade', this.posOf(ev.leader, prev), { important: true })); break;
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
    this.hold(false); // the game halts at its end, the jingle must still sound
    this.audio.music.jingle(result);
  }

  /**
   * After every tick: remember working serfs within hearing range (their strikes follow in frame() the beat of the
   * animation) and derive workshop sounds. Everything goes through the shared gate (StrikeGate): per sound kind
   * at most one strike per ~0.4 s, near strikes take priority over far ones.
   */
  onTick() {
    const l = this.audio.listener;
    const a = this.audio;
    if (!l || !a.ctx || a.ctx.state !== 'running') { this.working = []; return; }
    const sim = this.engine.sim, tick = sim.tick;
    const R = audibleRadius(l.dist), R2 = R * R;
    const near = (x, z) => { const dx = x - l.x, dz = z - l.z, d2 = dx * dx + dz * dz; return d2 <= R2 && !this.hidden({ x, z }) ? d2 : -1; };
    /** @type {{ snd: string, x: number, z: number, gain: number, d2: number }[]} */
    const hits = [];
    const working = [];
    for (const e of sim.entities.values()) {
      if (e.kind === 'unit') {
        const job = e.job;
        if (!job || e.path?.length) continue;
        const x = e.px / UNIT, z = e.py / UNIT, d2 = near(x, z);
        if (d2 < 0) continue;
        const t = sim.entities.get(job.target);
        if (t) working.push({ id: e.id, x, z, d2, clip: workClip(t.kind) });
      } else if (e.kind === 'worker' && e.state === 'working' && (tick + e.id * 7) % 23 === 0) {
        const wp = sim.entities.get(e.workplace);
        const snd = wp && WORKSHOP_SOUND[wp.type];
        if (!snd) continue;
        const x = wp.x + wp.w / 2, z = wp.y + wp.h / 2, d2 = near(x, z);
        if (d2 >= 0) hits.push({ snd, x, z, gain: 0.5, d2 });
      }
    }
    this.working = working;
    hits.sort((p, q) => p.d2 - q.d2);
    for (const h of hits) this.strike(h.snd, h.x, h.z, h.gain);
  }

  /** Send a work strike through the gate and, if allowed, play it (slightly delayed, volume spread). */
  strike(snd, x, z, gain) {
    const a = this.audio, l = a.listener;
    if (!l || !a.ctx) return false;
    const s = spatialize(x, z, l);
    if (!s) return false;
    const ok = this.gate.admit(snd, a.ctx.currentTime, gain * s.gain);
    return !!ok && a.play(snd, { x, z, gain: gain * ok.gain, delay: ok.delay });
  }

  /**
   * Per frame: strikes of working serfs exactly when their tool hits in the animation
   * (one strike per cycle; beat from CharacterSystem.beat, without rendering a fixed fallback beat).
   */
  workFrame() {
    const a = this.audio;
    if (!a.ctx || a.ctx.state !== 'running' || this.engine.paused) { this.beats.clear(); return; }
    const chars = this.engine.renderer?.chars;
    const now = a.ctx.currentTime;
    const next = new Map();
    /** @type {{ snd: string, x: number, z: number, d2: number }[]} */
    const due = [];
    for (const w of this.working) {
      let b = chars?.beat ? chars.beat(w.id) : null;
      if (!b) {
        if (chars?.beat) continue; // figure not in view
        const period = STRIKE_PERIOD[w.clip];
        b = { clip: w.clip, t: now + idPhase(w.id) * period, period, anim: 'work' };
      }
      const snd = CLIP_SOUND[b.clip];
      if (!snd) continue;
      const prev = this.beats.get(w.id);
      next.set(w.id, { clip: b.clip, t: b.t });
      if (prev && prev.clip === b.clip && b.t > prev.t && strikeIn(prev.t, b.t, b.period, strikePhase(b.anim))) due.push({ snd, x: w.x, z: w.z, d2: w.d2 });
    }
    this.beats = next;
    due.sort((p, q) => p.d2 - q.d2);
    for (const h of due) this.strike(h.snd, h.x, h.z, h.snd === 'hammer' ? 0.6 : 0.7);
  }

  /** Combat music state for the developer mode (stats): why the combat theme plays or not. */
  musicInfo() {
    const now = this.now(), m = this.audio.music;
    return { mode: this.battle.mode, intensity: this.intensity ?? 0, need: this.battle.need(now), engaged: this.battle.engaged(now), want: m.want, playing: m.track?.theme ?? null };
  }

  /**
   * Game paused (player, game menu, script debugger, error, loading screen) → hold music, ambience, game
   * sounds and voices (AudioEngine.setHold, holdSpeech); not after the game has ended.
   * @param {boolean} on
   */
  hold(on) {
    this.audio.setHold(on);
    holdSpeech('pause', on);
  }

  /** Per frame: pause hold, listener, combat intensity, music theme, ambience. */
  frame(dt) {
    const e = this.engine;
    this.hold(shouldHold({ paused: e.paused, ended: this.ended, stopped: e.stopped }));
    const rig = this.engine.renderer?.rig;
    if (!rig) return;
    const l = { x: rig.target.x, z: rig.target.z, dist: rig.dist, yaw: rig.yaw };
    this.audio.listener = l;
    this.workFrame();
    // while a dialogue speaks, music and ambience step back
    const talk = speaking();
    if (talk !== !!this.audio.ducked) this.audio.duck(talk);
    const now = this.now();
    this.battle.decay(dt, now);
    this.sceneTimer -= dt;
    if (this.sceneTimer > 0) return;
    this.sceneTimer = 0.25;
    const intensity = this.battle.intensity(l);
    this.intensity = intensity;
    if (!this.ended) {
      const mode = this.battle.theme(intensity, now);
      this.audio.music.setTheme(musicTheme(mode, this.audio.ambient.weather));
    }
    const land = this.landscape(l);
    this.audio.ambient.setScene(land.water, intensity, zoomGain(l.dist), { forest: land.forest, cliff: land.cliff, dist: l.dist });
    this.audio.ambient.tick();
  }

  // ---------- Barks (voiced) ----------

  /**
   * Voice of a figure to match its look: variant or role in the figure manifest (field voice), otherwise by
   * sex of the drawn figure (figureSex): serfs and workers serf/serfF, militia sword/soldierF.
   */
  voiceOf(e, textRole) {
    const manifest = characterManifest();
    const roles = manifest?.roles ?? {};
    if (e.kind === 'hero') return e.hero;
    if (e.kind === 'unit' || e.kind === 'worker') {
      const role = figureRole(e, [], UNITS);
      const v = figureVariant(manifest, role, e.id)?.variant;
      if (e.kind === 'unit' && !e.militia && v?.voice) return v.voice;
      const f = figureSex(manifest, role, e.id) === 'f';
      return e.militia ? (f ? 'soldierF' : 'sword') : f ? 'serfF' : 'serf';
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

  /**
   * Something of the player's own is attacked (Engine.attackToast, already throttled per region): alarm bell and an alarm call
   * of the figure hit (for buildings and workers a serf calls, soldiers call like their captain).
   * Independent of the setting "Sprüche der Figuren" – it is a notice –, but at most every ALARM_REST
   * seconds and never over a running dialogue or bark: if a bark is still running, the call waits for its end
   * (at most ALARM_WAIT s); the quiet pause after barks does not apply to alarm calls.
   * @param {any} target own object hit
   */
  alarm(target) {
    if (!target) return;
    const now = this.now();
    if (now < (this.alarmUntil ?? -Infinity)) return;
    this.alarmUntil = now + ALARM_REST;
    this.audio.play('alarm');
    const gate = (this.barks ??= new BarkGate());
    const pick = this.alarmLine(target);
    const entry = { kind: target.kind, role: pick?.role ?? null, voice: pick?.voice ?? null, url: pick?.url ?? null, played: false, skipped: null };
    this.announced.push(entry);
    if (this.announced.length > 20) this.announced.shift();
    if (!pick) { entry.skipped = 'noLine'; return; }
    const wait = Math.max(ALARM_DELAY, (gate.playingUntil ?? -Infinity) - now + 0.3);
    if (wait > ALARM_WAIT) { entry.skipped = 'busy'; return; }
    gate.lastLine.set(pick.role + ':alarm', pick.line);
    const mode = this.audio.settings?.barks ?? 'rare';
    gate.spoke(now + wait, 3, mode); // provisional until the recording length is known
    // shortly after the bell (or after the running bark), so both stay understandable
    setTimeout(() => {
      if (speaking()) { entry.skipped = 'dialog'; return; }
      this.audio.playFile(pick.url, { gain: 1 }).then((dur) => {
        entry.played = dur > 0;
        if (!entry.played) entry.skipped = 'audio';
        const at = this.now();
        gate.spoke(at, dur || 0, mode);
      });
    }, wait * 1000);
  }

  /** Voice for alarm calls: militia call as a serf of their sex (serf/serfF), otherwise voiceOf. */
  alarmVoiceOf(u) {
    const v = this.voiceOf(u, alarmRole(u, UNITS[u.def]?.line));
    return u.kind === 'unit' && u.militia ? (v === 'soldierF' || v === 'serfF' ? 'serfF' : 'serf') : v;
  }

  /**
   * Alarm call with recording in the current language: first the figure hit, otherwise a substitute caller
   * (alarmVoices). @returns {{ role: string, voice: string, line: {de:string,en:string}, url: string }|null}
   */
  alarmLine(target) {
    const lang = currentLang();
    const gate = (this.barks ??= new BarkGate());
    for (const { role, voice } of alarmVoices(target, UNITS[target.def]?.line, (u) => this.alarmVoiceOf(u))) {
      const set = BARKS[role]?.alarm?.filter((l) => voiceFile(voice, lang, l[lang] ?? l.de));
      const line = set?.length ? chooseBark({ alarm: set }, 'alarm', this.audio.rnd, false, gate.lastLine.get(role + ':alarm')) : null;
      if (line) return { role, voice, line, url: /** @type {string} */ (voiceFile(voice, lang, line[lang] ?? line.de)) };
    }
    return null;
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
    else if (cmd.type === 'assignWork') {
      const t = this.engine.sim.entities.get(cmd.target);
      event = t?.kind === 'building' ? 'build' : t?.kind === 'tree' || t?.kind === 'pile' ? 'gather' : 'attack';
    }
    this.bark(this.speakerOf(ids), event);
  }

  /**
   * Landscape around the camera target (coarsely sampled, only re-sampled on movement): water share (brook/lake),
   * steep-slope share (mountains → wind) and forest (trees near the screen centre → foliage, birds). Each 0…1.
   */
  landscape(l) {
    const sim = this.engine.sim, m = sim.map;
    const key = `${Math.round(l.x / 2)},${Math.round(l.z / 2)},${Math.round(l.dist / 8)}`;
    if (key === this.lastWaterProbe) return this.land;
    this.lastWaterProbe = key;
    const r = Math.min(16, viewRadius(l.dist) * 0.5);
    let n = 0, w = 0, c = 0;
    for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) {
      const x = Math.floor(l.x + dx), y = Math.floor(l.z + dz);
      if (!m.inBounds(x, y)) continue;
      n++;
      const f = m.flags[m.idx(x, y)];
      if (f & WATER) w++;
      if (f & CLIFF) c++;
    }
    // Forest: trees within 10 tiles around the screen centre; 12 % tree tiles = dense forest
    const fr = 10;
    let trees = 0;
    for (const e of sim.entities.values()) {
      if (e.kind !== 'tree') continue;
      const dx = e.x + 0.5 - l.x, dz = e.y + 0.5 - l.z;
      if (dx * dx + dz * dz <= fr * fr) trees++;
    }
    // even little water in view is audible: 15 % water area = full volume
    this.waterLevel = n ? Math.min(1, (w / n) / 0.15) : 0;
    this.land = { water: this.waterLevel, cliff: n ? c / n : 0, forest: Math.min(1, trees / (Math.PI * fr * fr * 0.12)) };
    return this.land;
  }

  /** Share of water around the camera target 0…1 (see landscape). */
  waterNear(l) { return this.landscape(l).water; }

  dispose() {
    this.hold(false);
    this.audio.setAmbient(false);
    this.audio.listener = null;
  }
}
