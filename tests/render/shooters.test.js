// Shooters: shot loop in time with the arrows, archers turned towards the target, riders aim forward from a seat
// beside the horse (legs outside the barrel). Files: public/models/characters (manifest `shots`, *.lod1.glb clips).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { syncShot, aimYaw, Variant } from '../../src/render/characters.js';
import { shotCycle } from '../../src/render/Renderer.js';
import { threeOf, pose, skinnedPoints, idleHeight, worldPos, worldQuat } from '../../scripts/asset-gen/rig3.mjs';
import { barrel, heldAxis, riderRole, PAD, RIDE_SHOT_RELEASE } from '../../scripts/asset-gen/ride-clips.mjs';
import { SHOOTER_ROLES, shootAnim } from '../../scripts/asset-gen/shots.mjs';

const DIR = new URL('../../public/models/characters/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', DIR), 'utf8'));
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const load = async (m) => threeOf(io, await io.read(new URL(`${m}.lod1.glb`, DIR).pathname));
const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

describe('Shot loop', () => {
  const clip = { duration: 5, shot: { release: 0.8 } };
  it('one clip cycle per shot interval, release on the shot', () => {
    const r = { clipT0: 0 };
    syncShot(r, clip, 10, 2);
    expect(r.shotRate).toBeCloseTo(2.5, 6);
    // phase at the shot = release
    expect((((10 - r.clipT0) * r.shotRate) / clip.duration) % 1).toBeCloseTo(0.8, 6);
    // the same shot again changes nothing; the next shot one cycle later needs no jump
    const t0 = r.clipT0;
    syncShot(r, clip, 10, 2);
    expect(r.clipT0).toBe(t0);
    syncShot(r, clip, 12, 2);
    expect(r.clipT0).toBeCloseTo(t0 + 2, 6);
  });
  it('rate stays in bounds, clips without release keep their start', () => {
    const r = { clipT0: 3 };
    syncShot(r, { duration: 1, shot: null }, 5, 100);
    expect(r.shotRate).toBe(0.5);
    expect(r.clipT0).toBe(3);
  });
  it('interval: measured gap, otherwise the cooldown', () => {
    expect(shotCycle({ at: 1, gap: 0 }, 18)).toBeCloseTo(1.8, 6);
    expect(shotCycle({ at: 1, gap: 0.9 }, 18)).toBeCloseTo(0.9, 6);
  });
  it('body turn of the shot clip, cross-faded', () => {
    const clips = { __bind: { start: 0, frames: 1, duration: 0 }, attack: { start: 1, frames: 4, duration: 1 }, idle: { start: 5, frames: 4, duration: 1 } };
    const v = new Variant('soldier.bow', [], { clips }, null, null, { attack: 'attack', idle: 'idle' }, { shots: { attack: { release: 0.8, yaw: -1.6 } } });
    expect(aimYaw(v, { clip: 'shoot', fadeT0: -1 }, 0)).toBeCloseTo(-1.6, 6);
    expect(aimYaw(v, { clip: 'idle', fadeT0: -1 }, 0)).toBe(0);
    expect(aimYaw(v, { clip: 'idle', prevClip: 'shoot', fadeT0: 1 }, 1.11)).toBeCloseTo(-0.8, 6);
  });
});

// shooter models and the animation they shoot with
const shooters = new Map();
for (const [k, r] of Object.entries(manifest.roles)) {
  if (!SHOOTER_ROLES.test(k)) continue;
  for (const m of [r.model, ...(r.variants ?? []).map((v) => v.model)].filter(Boolean)) shooters.set(m, shootAnim(manifest.models[m], r));
}

describe('Shots point at the target', () => {
  it('every shooter has its shot in the manifest', () => {
    expect(shooters.size).toBeGreaterThanOrEqual(6);
    for (const [m, anim] of shooters) {
      const s = manifest.models[m].shots?.[anim];
      expect(s, `${m} ${anim}`).toBeTruthy();
      expect(s.release, m).toBeGreaterThan(0.1);
      expect(s.release, m).toBeLessThan(0.95);
    }
  });
  for (const [m, anim] of shooters) {
    it(`${m}: ${anim} at the release aims forward`, async () => {
      const g = await load(m);
      const shot = manifest.models[m].shots[anim];
      const clip = g.animations.find((a) => a.name === anim);
      pose(g, anim, clip.duration * shot.release);
      const bone = (n) => g.scene.getObjectByName(n);
      let dir;
      if (anim === 'rideShoot') {
        expect(shot.release).toBe(RIDE_SHOT_RELEASE);
        // crossbow axis in the world: axis in the hand frame measured in the riding pose
        const g0 = await load(m);
        pose(g0, 'ride', 0);
        const ax = heldAxis(g0, 'RightHand');
        dir = ax.stock.clone().applyQuaternion(worldQuat(bone('RightHand')));
        // weapon at head height in front of the chest
        const h = worldPos(bone('RightHand')), head = worldPos(bone('Head')), chest = worldPos(bone('Spine02'));
        expect(h.z).toBeGreaterThan(chest.z);
        expect(head.y - h.y).toBeLessThan(0.25 * idleHeight(g0));
      } else {
        // bow: draw hand → bow hand
        dir = worldPos(bone('LeftHand')).sub(worldPos(bone('RightHand')));
      }
      const yaw = wrap(Math.atan2(dir.x, dir.z) + (shot.yaw ?? 0));
      expect(Math.abs(deg(yaw)), `${m}: shot goes ${deg(yaw).toFixed(0)}° beside the target`).toBeLessThan(15);
      expect(Math.abs(deg(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)))), `${m}: elevation`).toBeLessThan(25);
    });
  }
});

describe('Riders sit beside the horse, not in it', () => {
  const riders = Object.keys(manifest.models).filter((k) => manifest.models[k].clips?.ride);
  for (const m of riders) {
    it(m, async () => {
      const role = riderRole(manifest, m);
      const horse = await load('Horse'), rider = await load(m);
      const hdef = manifest.models.Horse;
      const hs = (hdef.height / idleHeight(horse)) * (role.mount.scale ?? 1), rs = manifest.models[m].height / idleHeight(rider);
      const off = new THREE.Vector3(...role.mount.offset);
      pose(horse, 'idle', 0);
      const body = barrel(skinnedPoints(horse).map((v) => ({ p: v.p.multiplyScalar(hs).add(off) })));
      const saddleY = hdef.saddle.at[1] * hs + off.y, seat = saddleY + role.seatOffset;
      const toWorld = (p) => p.clone().multiplyScalar(rs).add(new THREE.Vector3(0, seat, 0));
      for (const clip of ['ride', 'rideAttack', 'rideShoot']) {
        if (!rider.animations.some((a) => a.name === clip)) continue;
        pose(rider, clip, 0);
        const hips = ['LeftUpLeg', 'RightUpLeg'].map((n) => toWorld(worldPos(rider.scene.getObjectByName(n))));
        // centred over the saddle, hip joints just above it
        expect(Math.abs(hips[0].x + hips[1].x) / 2, `${m} ${clip}: hips centred`).toBeLessThan(0.01);
        expect((hips[0].y + hips[1].y) / 2 - saddleY, `${m} ${clip}: seat height`).toBeGreaterThan(0);
        expect((hips[0].y + hips[1].y) / 2 - saddleY, `${m} ${clip}: seat height`).toBeLessThan(0.05);
        // legs below the saddle pad: (almost) no vertex in the horse
        const d = skinnedPoints(rider).filter((v) => /Leg|Foot|Toe/.test(v.bone)).map((v) => toWorld(v.p)).filter((p) => p.y < saddleY - PAD).map((p) => body.depth(p, 0));
        d.sort((a, b) => a - b);
        expect(d[Math.floor(d.length * 0.97)], `${m} ${clip}: legs in the horse`).toBeLessThan(0.005);
      }
    }, 30000);
  }
});
