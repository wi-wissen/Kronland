// Sky, fog, light and tone mapping. Tuned to the bright KayKit models.

import * as THREE from 'three';

/** Weather-dependent mood: sky top/horizon, fog, light. */
export const MOODS = {
  summer: {
    zenith: 0x4f8fd6, horizon: 0xcfe3ef, ground: 0xb9cdb0, fog: 0xc6dbe6, fogNear: 95, fogFar: 230,
    hemiSky: 0xdcebff, hemiGround: 0x7a6440, hemi: 1.05, sun: 0xfff1d8, sunI: 2.6, exposure: 1.0,
  },
  rain: {
    zenith: 0x6a7c8c, horizon: 0xa9b4bc, ground: 0x8e989c, fog: 0x9eaab2, fogNear: 60, fogFar: 170,
    hemiSky: 0xc4ccd4, hemiGround: 0x5a5448, hemi: 1.15, sun: 0xd8dde4, sunI: 1.25, exposure: 0.95,
  },
  winter: {
    zenith: 0x7da6cf, horizon: 0xe4edf4, ground: 0xd6dee6, fog: 0xdbe5ee, fogNear: 85, fogFar: 210,
    hemiSky: 0xe8f0ff, hemiGround: 0x8c8a90, hemi: 1.1, sun: 0xfff6ea, sunI: 2.1, exposure: 0.95,
  },
};

/** Direction to the sun (afternoon, from the south-west). */
export const SUN_DIR = new THREE.Vector3(0.55, 0.72, 0.42).normalize();

export class Environment {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {import('./quality.js').QualitySettings} quality
   */
  constructor(renderer, scene, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.q = quality;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Sky dome with gradient and soft sun aura
    this.skyUniforms = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
      uSunDir: { value: SUN_DIR.clone() }, uSun: { value: new THREE.Color(0xfff1d8) },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(380, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: `varying vec3 vDir;
void main() { vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
        fragmentShader: `uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSun;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 c = h > 0.0 ? mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(uHorizon, uGround, smoothstep(0.0, -0.25, h));
  float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  c += uSun * (pow(s, 12.0) * 0.18 + pow(s, 400.0) * 0.9);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    sky.name = 'sky';
    this.sky = sky;
    scene.add(sky);
    scene.background = null;
    scene.fog = new THREE.Fog(0xffffff, 90, 220);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    const sm = quality.shadowMapSize;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = quality.shadowRadius;
    scene.add(this.sun, this.sun.target);
    renderer.shadowMap.enabled = quality.shadows !== false;
    this.sun.castShadow = quality.shadows !== false;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    this.envTarget = null;
    this.envDirty = false;
    this.setMood('summer');
  }

  /**
   * Create ambient light afterwards (not in the constructor: rendering the cube map
   * otherwise blocks the game start). On the low level entirely without – saves a lot of computation time.
   */
  tick() {
    if (!this.envDirty) return;
    if ((this.wait = (this.wait ?? 3) - 1) > 0) return;
    this.envDirty = false;
    this.updateEnvMap();
  }

  /** @param {'summer'|'winter'|'rain'} state */
  setMood(state) {
    const m = MOODS[state] ?? MOODS.summer;
    this.mood = m;
    const u = this.skyUniforms;
    u.uZenith.value.setHex(m.zenith); u.uHorizon.value.setHex(m.horizon); u.uGround.value.setHex(m.ground);
    u.uSun.value.setHex(m.sun).multiplyScalar(state === 'rain' ? 0.2 : 1);
    this.scene.fog.color.setHex(m.fog);
    this.scene.fog.near = m.fogNear; this.scene.fog.far = m.fogFar;
    this.hemi.color.setHex(m.hemiSky); this.hemi.groundColor.setHex(m.hemiGround); this.hemi.intensity = m.hemi;
    this.sun.color.setHex(m.sun); this.sun.intensity = m.sunI;
    this.renderer.toneMappingExposure = m.exposure;
    if (this.q.tier !== 'low') { this.envDirty = true; this.wait = this.envTarget ? 1 : 3; }
    // without an environment map somewhat more base light so shadow sides do not go black
    else this.hemi.intensity = m.hemi * 1.25;
  }

  /** Create ambient light for reflections (water, smooth materials) from the sky. */
  updateEnvMap() {
    const pm = new THREE.PMREMGenerator(this.renderer);
    const s = new THREE.Scene();
    const sky = this.sky.clone();
    sky.material = this.sky.material.clone();
    sky.material.uniforms = THREE.UniformsUtils.clone(this.skyUniforms);
    s.add(sky);
    const rt = pm.fromScene(s, 0, 0.1, 1000);
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.35;
    sky.material.dispose();
    pm.dispose();
  }

  /**
   * Graphics level in the running game: shadows on/off, size and softness of the shadow map.
   * @param {import('./quality.js').QualitySettings} quality
   * @returns {boolean} true if shadows were switched on or off (recompile materials)
   */
  setQuality(quality) {
    const was = this.renderer.shadowMap.enabled;
    const on = quality.shadows !== false;
    this.q = quality;
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    const sm = quality.shadowMapSize, sh = this.sun.shadow;
    if (sh.mapSize.x !== sm) {
      sh.mapSize.set(sm, sm);
      // new shadow map in a suitable size at the next frame
      sh.map?.dispose();
      sh.map = null;
    }
    sh.radius = quality.shadowRadius;
    this.renderer.shadowMap.needsUpdate = true;
    return was !== on;
  }

  /**
   * Move sun and shadow camera along with the viewpoint.
   * @param {THREE.Vector3} target @param {number} dist camera distance
   */
  follow(target, dist) {
    const r = Math.max(22, dist * 1.05);
    const sun = this.sun;
    // Snap the shadow section to texels so shadows do not flicker when moving
    const texel = (2 * r) / this.q.shadowMapSize;
    const snap = (v) => Math.round(v / texel) * texel;
    const tx = snap(target.x), tz = snap(target.z);
    sun.position.set(tx + SUN_DIR.x * 80, target.y + SUN_DIR.y * 80, tz + SUN_DIR.z * 80);
    sun.target.position.set(tx, target.y, tz);
    const cam = sun.shadow.camera;
    if (cam.right !== r) {
      Object.assign(cam, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 200 });
      cam.updateProjectionMatrix();
    }
    this.sky.position.copy(target);
  }

  dispose() {
    this.envTarget?.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
  }
}
