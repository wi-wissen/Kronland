// 3D hint marker for tutorial and missions: pulsing ring on the ground plus a floating arrow
// above an entity or region. Only reads the hint from the engine, changes nothing in the game.

import * as THREE from 'three';

const GOLD = 0xffcf4a;

export class HintMarker {
  /** @param {THREE.Scene} scene @param {{ heightAt: (x:number, z:number) => number }} terrain */
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 20;
    const ringMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), ringMat);
    this.ring2 = new THREE.Mesh(this.ring.geometry, ringMat.clone());
    const arrowMat = new THREE.MeshBasicMaterial({ color: GOLD, depthTest: false, transparent: true, opacity: 0.95 });
    this.arrow = new THREE.Group();
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 4), arrowMat);
    head.rotation.x = Math.PI; // tip pointing down
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), arrowMat);
    shaft.position.y = 0.55;
    this.arrow.add(head, shaft);
    this.arrow.renderOrder = 21;
    head.renderOrder = shaft.renderOrder = 21;
    this.group.add(this.ring, this.ring2, this.arrow);
    scene.add(this.group);
    this.t = 0;
  }

  /**
   * @param {null|{entity?:{x:number,y:number,size:number}, area?:{x:number,y:number,r:number}}} hint
   * @param {number} dt
   */
  update(hint, dt) {
    const target = hint?.entity ?? hint?.area ?? null;
    this.group.visible = !!target;
    if (!target) return;
    this.t += dt;
    const r = hint.entity ? Math.max(0.8, target.size + 0.4) : target.r;
    const y = this.terrain.heightAt(target.x, target.y);
    this.group.position.set(target.x, y + 0.08, target.y);
    const pulse = (this.t * 0.8) % 1;
    this.ring.scale.setScalar(r);
    this.ring2.scale.setScalar(r * (1 + pulse * 0.5));
    this.ring2.material.opacity = 0.7 * (1 - pulse);
    this.arrow.position.y = (hint.entity ? 2.4 + target.size : 2.2) + Math.sin(this.t * 4) * 0.25;
    this.arrow.rotation.y = this.t * 1.5;
  }
}

/**
 * Exclamation mark above conversation figures of the mission (as in the original): a hero who walks up speaks to them.
 * Only reads the figures that the renderer frame currently shows.
 */
export class NpcMarks {
  /** @param {THREE.Scene} scene @param {{ heightAt: (x:number, z:number) => number }} terrain */
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.mat = new THREE.MeshBasicMaterial({ color: GOLD, depthTest: false, transparent: true, opacity: 0.95 });
    this.bar = new THREE.CylinderGeometry(0.09, 0.05, 0.5, 6);
    this.dot = new THREE.SphereGeometry(0.09, 8, 6);
    this.marks = [];
    this.t = 0;
  }

  /** @param {{px:number, py:number}[]} npcs positions in milli-tiles @param {number} dt */
  update(npcs, dt) {
    this.t += dt;
    while (this.marks.length < npcs.length) {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(this.bar, this.mat); bar.position.y = 0.4;
      const dot = new THREE.Mesh(this.dot, this.mat);
      bar.renderOrder = dot.renderOrder = 21;
      g.add(bar, dot);
      this.scene.add(g);
      this.marks.push(g);
    }
    this.marks.forEach((g, i) => {
      const e = npcs[i];
      g.visible = !!e;
      if (!e) return;
      const x = e.px / 1000, z = e.py / 1000;
      g.position.set(x, this.terrain.heightAt(x, z) + 1.9 + Math.sin(this.t * 3 + i) * 0.12, z);
    });
  }
}
