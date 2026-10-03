// Rendering: reads the state of the simulation and draws it. Never changes the game state.

import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { CameraRig } from './CameraRig.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { UNIT } from '../sim/fixed.js';
import {
  buildingModel, scaffold, serfModel, treeGeometries, pileModel, shaftModel, spotModel, mat, PROF_COLORS, campfireModel,
  unitModel, heroModel, gadgetModel, healthBar,
} from './models.js';
import { UNITS, HEROES } from '../sim/data/units.js';
import { maxHp } from '../sim/systems/military.js';

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

export class Renderer {
  /** @param {HTMLCanvasElement} canvas @param {import('../sim/sim.js').Sim} sim */
  constructor(canvas, sim) {
    this.sim = sim;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa9c8dc);
    this.scene.fog = new THREE.Fog(0xa9c8dc, 90, 170);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.3, 400);

    this.terrain = new Terrain(sim.map, sim.waterLevel);
    this.scene.add(this.terrain.mesh, this.terrain.water);
    this.rig = new CameraRig(this.camera, { w: sim.map.width, h: sim.map.height });
    this.rig.groundAt = (x, z) => this.terrain.heightAt(x, z);

    this.scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x6b5a3a, 1.1));
    this.sun = new THREE.DirectionalLight(0xfff0d4, 1.9);
    this.sun.castShadow = true;
    const sm = small ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    this.buildTrees();
    this.piles = new Map();
    this.markers = [];
    this.buildMarkers();
    /** @type {Map<number, THREE.Group>} */
    this.buildings = new Map();
    /** @type {Map<number, THREE.Group>} */
    this.units = new Map();
    this.lastPos = new Map();
    this.selectionGroup = new THREE.Group();
    this.scene.add(this.selectionGroup);
    this.ghost = null;
    this.ghostKey = '';
    this.raycaster = new THREE.Raycaster();

    const hq = sim.findBuilding(0, 'headquarters');
    if (hq) this.rig.lookAt(hq.x + hq.w / 2, hq.y + hq.h / 2 + 3);
  }

  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 55 : 40;
    this.camera.updateProjectionMatrix();
    this.viewport = { w, h };
  }

  // ---------- Static objects ----------

  buildTrees() {
    const trees = [...this.sim.entities.values()].filter((e) => e.kind === 'tree');
    const { trunk, conifer, leafy } = treeGeometries();
    const n = trees.length;
    this.trunks = new THREE.InstancedMesh(trunk, mat(0x6b4626), n);
    this.conifers = new THREE.InstancedMesh(conifer, mat(0xffffff), n);
    this.leafies = new THREE.InstancedMesh(leafy, mat(0xffffff), n);
    /** @type {Map<number, {i:number, kind:'conifer'|'leafy'}>} */
    this.treeIndex = new Map();
    const greens = [0x2f6b3a, 0x3a7a42, 0x2c6235, 0x5c9440, 0x4f8a3c, 0x6aa14a];
    const c = new THREE.Color();
    trees.forEach((t, i) => {
      const hsh = (t.id * 2654435761) >>> 0;
      const s = 0.8 + (hsh % 50) / 100;
      const x = t.x + 0.5 + ((hsh >> 8) % 30 - 15) / 100, z = t.y + 0.5 + ((hsh >> 16) % 30 - 15) / 100;
      tmpP.set(x, this.terrain.heightAt(x, z), z);
      tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (hsh % 628) / 100);
      tmpS.set(s, s, s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.trunks.setMatrixAt(i, tmpM);
      const conif = tmpP.y > 4 || hsh % 3 !== 0;
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      this.conifers.setMatrixAt(i, conif ? tmpM : zero);
      this.leafies.setMatrixAt(i, conif ? zero : tmpM);
      c.setHex(greens[(conif ? 0 : 3) + (hsh % 3)]);
      this.conifers.setColorAt(i, c);
      this.leafies.setColorAt(i, c);
      this.treeIndex.set(t.id, { i, kind: conif ? 'conifer' : 'leafy' });
    });
    for (const m of [this.trunks, this.conifers, this.leafies]) {
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  removeTree(id) {
    const t = this.treeIndex.get(id);
    if (!t) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const m of [this.trunks, this.conifers, this.leafies]) {
      m.setMatrixAt(t.i, zero);
      m.instanceMatrix.needsUpdate = true;
    }
    this.treeIndex.delete(id);
  }

  buildMarkers() {
    for (const e of this.sim.entities.values()) {
      if (e.kind !== 'pile') continue;
      const g = pileModel(e.res);
      g.position.set(e.x + 0.5, this.terrain.heightAt(e.x + 0.5, e.y + 0.5), e.y + 0.5);
      this.scene.add(g);
      this.piles.set(e.id, g);
    }
    for (const s of this.sim.shafts) {
      const g = shaftModel(s.res);
      g.position.set(s.x + 1.5, this.terrain.rectHeight(s.x, s.y, 3, 3), s.y + 1.5);
      this.scene.add(g);
      this.markers.push({ g, x: s.x, y: s.y });
    }
    for (const s of this.sim.spots) {
      const g = spotModel();
      g.position.set(s.x + 2, this.terrain.rectHeight(s.x, s.y, 4, 4), s.y + 2);
      this.scene.add(g);
      this.markers.push({ g, x: s.x, y: s.y });
    }
  }

  // ---------- Events ----------

  onEvents(events) {
    for (const ev of events) {
      if (ev.type === 'shot') this.addProjectile(ev);
      else if (ev.type === 'hit') (this.hitAt ??= new Map()).set(ev.by, this.time ?? 0);
      else if (ev.type === 'explosion') this.addExplosion(ev.x / UNIT, ev.y / UNIT);
      else if (ev.type === 'weather') this.applyWeather(ev.state);
      if (ev.type === 'nodeDepleted') {
        this.removeTree(ev.node);
        const p = this.piles.get(ev.node);
        if (p) { this.scene.remove(p); this.piles.delete(ev.node); }
      }
    }
  }

  // ---------- Per frame ----------

  /**
   * @param {number} alpha 0…1 between last and current tick
   * @param {number} dt seconds since last frame
   * @param {Map<number,{px:number,py:number}>} prev positions before the last tick
   * @param {{ selected: Set<number>, ghost: null|{type:string,x:number,y:number,valid:boolean} }} view
   */
  frame(alpha, dt, prev, view) {
    const sim = this.sim;
    this.time = (this.time ?? 0) + dt;
    const seen = new Set();

    for (const e of sim.entities.values()) {
      if (e.kind === 'building') { seen.add(e.id); this.syncBuilding(e); }
      else if (e.kind === 'unit' || e.kind === 'worker') { seen.add(e.id); this.syncUnit(e, alpha, prev.get(e.id), dt); }
      else if (e.px !== undefined) { seen.add(e.id); this.syncFighter(e, alpha, prev.get(e.id)); }
      else if (e.kind === 'pile') {
        const g = this.piles.get(e.id);
        if (g) g.scale.setScalar(0.55 + 0.45 * Math.min(1, e.amount / 400));
      }
    }
    for (const [id, g] of this.buildings) if (!seen.has(id)) { this.scene.remove(g); this.buildings.delete(id); }
    for (const [id, g] of this.units) if (!seen.has(id)) {
      this.scene.remove(g);
      if (g.userData.hb) this.scene.remove(g.userData.hb);
      this.units.delete(id);
    }

    // hide markers as soon as something is built there
    for (const m of this.markers) m.g.visible = sim.map.owner[sim.map.idx(m.x, m.y)] === 0;

    this.updateEffects(dt);
    this.syncSelection(view.selected);
    this.syncGhost(view.ghost);

    this.rig.update(dt);
    const t = this.rig.target;
    this.sun.position.set(t.x + 25, t.y + 45, t.z + 15);
    this.sun.target.position.copy(t);
    const r = Math.max(25, this.rig.dist * 1.1);
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 140 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  syncBuilding(e) {
    let g = this.buildings.get(e.id);
    const key = `${e.level}:${e.done}`;
    if (!g || g.userData.key !== key) {
      if (g) this.scene.remove(g);
      g = buildingModel(e.type, e.w, e.h, e.level, e.owner);
      g.userData.key = key;
      if (!e.done) {
        const sc = scaffold(e.w, e.h); sc.name = 'scaffold'; g.add(sc);
      }
      g.position.set(e.x + e.w / 2, this.terrain.rectHeight(e.x, e.y, e.w, e.h), e.y + e.h / 2);
      if (e.type === 'villageCenter' || e.type === 'headquarters') {
        const fire = campfireModel(); fire.position.set(-e.w / 2 - 0.2, 0, e.h / 2 + 0.6); g.add(fire);
      }
      g.traverse((m) => { m.userData.entity = e.id; });
      this.scene.add(g);
      this.buildings.set(e.id, g);
    }
    const rotor = g.getObjectByName('rotor');
    if (rotor) rotor.rotation.z = this.time * 1.5;
    const flame = g.getObjectByName('flame');
    if (flame) flame.scale.y = 0.8 + Math.sin(this.time * 12 + e.id) * 0.2;
    if (!e.done) {
      const body = g.getObjectByName('body');
      const p = e.work ? e.progress / e.work : 1;
      body.scale.y = 0.08 + 0.92 * p;
    }
  }

  syncUnit(e, alpha, prev, dt) {
    let g = this.units.get(e.id);
    if (!g) {
      g = e.kind === 'worker' ? serfModel(e.owner, PROF_COLORS[e.prof]) : serfModel(e.owner);
      if (e.kind === 'worker') g.userData.tool.visible = false;
      g.traverse((m) => { m.userData.entity = e.id; });
      this.scene.add(g);
      this.units.set(e.id, g);
    }
    const px = prev ? prev.px + (e.px - prev.px) * alpha : e.px;
    const py = prev ? prev.py + (e.py - prev.py) * alpha : e.py;
    const x = px / UNIT, z = py / UNIT;
    const moving = prev && (prev.px !== e.px || prev.py !== e.py);
    if (moving) g.rotation.y = Math.atan2(e.px - prev.px, e.py - prev.py);
    g.position.set(x, this.terrain.heightAt(x, z), z);
    const { body, legs, tool } = g.userData;
    const ph = this.time * 9 + e.id;
    legs[0].rotation.x = moving ? Math.sin(ph) * 0.6 : 0;
    legs[1].rotation.x = moving ? -Math.sin(ph) * 0.6 : 0;
    body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.03 : 0;
    if (e.kind === 'worker') {
      g.visible = !e.inside;
      if (e.state === 'camping') { body.rotation.x = 0.35; }
      else body.rotation.x = 0;
      return;
    }
    const working = !moving && e.job && e.path.length === 0;
    tool.rotation.x = working ? -Math.max(0, Math.sin(this.time * 6 + e.id)) * 1.6 : 0;
    body.rotation.x = working ? Math.max(0, Math.sin(this.time * 6 + e.id)) * 0.2 : 0;
    if (working) {
      const t = this.sim.entities.get(e.job.target);
      if (t) {
        const cx = t.kind === 'building' ? t.x + t.w / 2 : t.x + 0.5, cz = t.kind === 'building' ? t.y + t.h / 2 : t.y + 0.5;
        g.rotation.y = Math.atan2(cx - x, cz - z);
      }
    }
  }

  /** Captains, soldiers, heroes, traps and siege weapons. */
  syncFighter(e, alpha, prev) {
    let g = this.units.get(e.id);
    if (!g) {
      if (e.kind === 'hero') g = heroModel(e.hero, e.owner);
      else if (e.kind === 'leader' || e.kind === 'soldier') g = unitModel(UNITS[e.def].line, e.owner, e.kind === 'leader');
      else g = gadgetModel(e.kind, e.owner);
      g.userData.def = e.def;
      g.traverse((m) => { m.userData.entity = e.kind === 'soldier' ? e.leader : e.id; });
      if (e.kind === 'leader' || e.kind === 'hero') { const hb = healthBar(); hb.name = 'hb'; this.scene.add(hb); g.userData.hb = hb; }
      this.scene.add(g);
      this.units.set(e.id, g);
    }
    const px = prev ? prev.px + (e.px - prev.px) * alpha : e.px;
    const py = prev ? prev.py + (e.py - prev.py) * alpha : e.py;
    const x = px / UNIT, z = py / UNIT;
    const moving = prev && (prev.px !== e.px || prev.py !== e.py);
    if (moving) g.rotation.y = Math.atan2(e.px - prev.px, e.py - prev.py);
    else if (e.targetId) {
      const t = this.sim.entities.get(e.targetId);
      if (t) {
        const tx = t.kind === 'building' ? t.x + t.w / 2 : (t.px ?? t.x * UNIT) / UNIT, tz = t.kind === 'building' ? t.y + t.h / 2 : (t.py ?? t.y * UNIT) / UNIT;
        g.rotation.y = Math.atan2(tx - x, tz - z);
      }
    }
    g.position.set(x, this.terrain.heightAt(x, z), z);
    const { body, legs, arm, horse } = g.userData;
    const ph = this.time * 9 + e.id;
    if (legs) {
      legs[0] && (legs[0].rotation.x = moving ? Math.sin(ph) * 0.6 : 0);
      legs[1] && (legs[1].rotation.x = moving ? -Math.sin(ph) * 0.6 : 0);
    }
    if (horse) horse.position.y = moving ? Math.abs(Math.sin(ph)) * 0.04 : 0;
    const hit = this.hitAt?.get(e.id);
    if (arm) arm.rotation.x = hit !== undefined && this.time - hit < 0.35 ? -Math.sin(((this.time - hit) / 0.35) * Math.PI) * 1.6 : 0;
    if (body && e.kind === 'hero') body.rotation.x = e.down ? -1.4 : 0;
    const hb = g.userData.hb;
    if (hb) {
      let frac;
      if (e.kind === 'leader') {
        const d = UNITS[e.def];
        const total = d.hp + d.soldierHp * d.soldiers;
        let cur = e.hp;
        for (const id of e.soldiers) cur += this.sim.entities.get(id)?.hp ?? 0;
        frac = Math.max(0, cur / total);
      } else frac = Math.max(0, e.hp / HEROES[e.hero].hp);
      hb.position.set(x, g.position.y + (e.kind === 'hero' ? 1.45 : 1.25), z);
      hb.quaternion.copy(this.camera.quaternion);
      const fg = hb.getObjectByName('fg');
      fg.scale.x = Math.max(0.001, frac); fg.position.x = -0.3 * (1 - frac);
      fg.material.color.setHex(frac > 0.5 ? 0x6fcf7a : frac > 0.25 ? 0xe0a93b : 0xef6b6b);
    }
  }

  addProjectile(ev) {
    const from = new THREE.Vector3(ev.from.x / UNIT, 0, ev.from.y / UNIT);
    const to = new THREE.Vector3(ev.to.x / UNIT, 0, ev.to.y / UNIT);
    from.y = this.terrain.heightAt(from.x, from.z) + (ev.kind === 'bolt' ? 2.6 : 0.6);
    to.y = this.terrain.heightAt(to.x, to.z) + 0.4;
    const geo = ev.kind === 'ball' ? (this.ballGeo ??= new THREE.SphereGeometry(0.08, 6, 4)) : (this.arrowGeo ??= new THREE.BoxGeometry(0.02, 0.02, 0.4));
    const m = new THREE.Mesh(geo, mat(ev.kind === 'ball' ? 0x2a2a2e : 0x5a3b22));
    m.position.copy(from); m.lookAt(to);
    this.scene.add(m);
    (this.projectiles ??= []).push({ m, from, to, t: 0, dur: Math.max(0.15, from.distanceTo(to) / 22) });
  }

  addExplosion(x, z) {
    const m = new THREE.Mesh(this.boomGeo ??= new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.85 }));
    m.position.set(x, this.terrain.heightAt(x, z) + 0.3, z);
    this.scene.add(m);
    (this.booms ??= []).push({ m, t: 0 });
  }

  updateEffects(dt) {
    for (const p of this.projectiles ?? []) {
      p.t += dt / p.dur;
      const k = Math.min(1, p.t);
      p.m.position.lerpVectors(p.from, p.to, k);
      p.m.position.y += Math.sin(k * Math.PI) * 0.8;
      if (k >= 1) this.scene.remove(p.m);
    }
    this.projectiles = (this.projectiles ?? []).filter((p) => p.t < 1);
    for (const b of this.booms ?? []) {
      b.t += dt * 2.5;
      b.m.scale.setScalar(1 + b.t * 3);
      b.m.material.opacity = Math.max(0, 0.85 * (1 - b.t));
      if (b.t >= 1) { this.scene.remove(b.m); b.m.material.dispose(); }
    }
    this.booms = (this.booms ?? []).filter((b) => b.t < 1);
    if (this.rain) {
      const pos = this.rain.geometry.attributes.position;
      const t = this.rig.target;
      for (let i = 0; i < pos.count; i += 2) {
        let y = pos.getY(i) - dt * 18;
        if (y < t.y - 2) {
          y = t.y + 18;
          const x = t.x + (Math.random() - 0.5) * 50, z = t.z + (Math.random() - 0.5) * 50;
          pos.setX(i, x); pos.setZ(i, z); pos.setX(i + 1, x); pos.setZ(i + 1, z);
        }
        pos.setY(i, y); pos.setY(i + 1, y + 0.5);
      }
      pos.needsUpdate = true;
    }
  }

  /** Make weather visible: rain as falling streaks, winter as bright terrain and ice. */
  applyWeather(state) {
    if (this.rain) { this.scene.remove(this.rain); this.rain = null; }
    const t = this.terrain;
    if (!t.baseColors) t.baseColors = t.mesh.geometry.attributes.color.array.slice();
    const col = t.mesh.geometry.attributes.color;
    const base = t.baseColors;
    const snow = state === 'winter';
    for (let i = 0; i < col.array.length; i++) col.array[i] = snow ? base[i] * 0.35 + 0.62 : base[i];
    col.needsUpdate = true;
    t.water.material.color.setHex(snow ? 0xd8e8f0 : 0x4f8fb8);
    t.water.material.opacity = snow ? 0.95 : 0.82;
    const fogColor = state === 'rain' ? 0x8a9aa6 : snow ? 0xc8d6e0 : 0xa9c8dc;
    this.scene.background.setHex(fogColor);
    this.scene.fog.color.setHex(fogColor);
    if (state === 'rain') {
      const n = 1200, pos = new Float32Array(n * 6);
      const c = this.rig.target;
      for (let i = 0; i < n; i++) {
        const x = c.x + (Math.random() - 0.5) * 50, z = c.z + (Math.random() - 0.5) * 50, y = c.y + Math.random() * 20;
        pos.set([x, y, z, x, y + 0.5, z], i * 6);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc8d8e8, transparent: true, opacity: 0.5 }));
      this.scene.add(this.rain);
    }
  }

  syncSelection(selected) {
    const marks = (this.selMarks ??= new Map());
    for (const [id, m] of marks) {
      if (!selected.has(id) || !this.sim.entities.has(id)) {
        this.selectionGroup.remove(m);
        if (!m.userData.shared) m.geometry.dispose();
        marks.delete(id);
      }
    }
    for (const id of selected) {
      const e = this.sim.entities.get(id);
      if (!e) continue;
      let m = marks.get(id);
      if (e.kind !== 'building') {
        const u = this.units.get(id);
        if (!u) continue;
        if (!m) {
          m = new THREE.Mesh(this.ringGeo ??= new THREE.RingGeometry(0.22, 0.3, 16).rotateX(-Math.PI / 2), mat(0xfff2b0, { flatShading: false }));
          m.userData.shared = true;
          marks.set(id, m); this.selectionGroup.add(m);
        }
        m.position.copy(u.position).y += 0.04;
      } else if (e.kind === 'building' && !m) {
        const pts = [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]]
          .map(([x, z]) => new THREE.Vector3(x, this.terrain.heightAt(x, z) + 0.06, z));
        m = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xfff2b0 }));
        marks.set(id, m); this.selectionGroup.add(m);
      }
    }
  }

  syncGhost(ghost) {
    const key = ghost ? `${ghost.type}` : '';
    if (key !== this.ghostKey) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = null;
      this.ghostKey = key;
      if (ghost) {
        const def = BUILDINGS[ghost.type];
        const g = buildingModel(ghost.type, def.w, def.h, 0, 0);
        g.traverse((m) => {
          if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.55; m.castShadow = false; }
        });
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.h).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45 }));
        pad.name = 'pad'; pad.position.y = 0.08; g.add(pad);
        this.ghost = g;
        this.scene.add(g);
      }
    }
    if (ghost && this.ghost) {
      const def = BUILDINGS[ghost.type];
      this.ghost.position.set(ghost.x + def.w / 2, this.terrain.rectHeight(ghost.x, ghost.y, def.w, def.h), ghost.y + def.h / 2);
      this.ghost.getObjectByName('pad').material.color.setHex(ghost.valid ? 0x4cd964 : 0xe5484d);
    }
  }

  // ---------- Picking ----------

  /** Ground point under a screen position. @returns {{x:number,z:number}|null} */
  pickGround(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.terrain.mesh, false)[0];
    if (!hit) return null;
    return { x: hit.point.x, z: hit.point.z };
  }

  /** Entity under a screen position (units and buildings via raycast). */
  pickEntity(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const objs = [...this.units.values(), ...this.buildings.values()];
    const hit = this.raycaster.intersectObjects(objs, true)[0];
    return hit ? hit.object.userData.entity ?? null : null;
  }

  /** World point in screen coordinates. */
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height, behind: v.z > 1 };
  }
}
