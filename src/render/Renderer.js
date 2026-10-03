// Rendering: reads the state of the simulation and draws it. Never changes the game state.

import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { CameraRig } from './CameraRig.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { UNIT } from '../sim/fixed.js';
import {
  buildingModel, scaffold, serfModel, treeGeometries, pileModel, shaftModel, spotModel, mat, PROF_COLORS, campfireModel,
} from './models.js';

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
      else if (e.kind === 'pile') {
        const g = this.piles.get(e.id);
        if (g) g.scale.setScalar(0.55 + 0.45 * Math.min(1, e.amount / 400));
      }
    }
    for (const [id, g] of this.buildings) if (!seen.has(id)) { this.scene.remove(g); this.buildings.delete(id); }
    for (const [id, g] of this.units) if (!seen.has(id)) { this.scene.remove(g); this.units.delete(id); }

    // hide markers as soon as something is built there
    for (const m of this.markers) m.g.visible = sim.map.owner[sim.map.idx(m.x, m.y)] === 0;

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
      if (e.kind === 'unit') {
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
