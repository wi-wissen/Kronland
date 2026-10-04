// Tile overlay over the terrain (developer mode): a data texture with one texel per tile, drawn
// on a copy of the terrain mesh (same geometry, so it also follows levelling). Optionally with
// tile borders. No fog: the overlays show the true state of the simulation.

import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vTile;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vTile = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
uniform sampler2D uData;
uniform vec2 uSize;
uniform float uGrid;
uniform float uOpacity;
varying vec2 vTile;
void main() {
  if (vTile.x < 0.0 || vTile.y < 0.0 || vTile.x >= uSize.x || vTile.y >= uSize.y) discard;
  vec4 c = texture2D(uData, (floor(vTile) + 0.5) / uSize);
  // Tile borders: fine dark line (width via screen-space derivative so it stays the same when zooming)
  vec2 f = fract(vTile);
  vec2 w = fwidth(vTile) * 1.2;
  float edge = uGrid * (1.0 - min(min(smoothstep(0.0, w.x, f.x), smoothstep(0.0, w.y, f.y)), min(smoothstep(0.0, w.x, 1.0 - f.x), smoothstep(0.0, w.y, 1.0 - f.y))));
  c.a *= uOpacity;
  c.rgb = mix(c.rgb, vec3(0.05), edge * 0.6);
  c.a = max(c.a, edge * 0.35);
  if (c.a < 0.01) discard;
  gl_FragColor = c;
}`;

export class TileLayer {
  /**
   * @param {import('../render/Renderer.js').Renderer} r
   * @param {{ order?: number, name?: string }} [opts]
   */
  constructor(r, opts = {}) {
    const W = r.sim.map.width, H = r.sim.map.height;
    this.W = W; this.H = H;
    this.data = new Uint8Array(W * H * 4);
    this.tex = new THREE.DataTexture(this.data, W, H, THREE.RGBAFormat);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.flipY = false;
    this.tex.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      uniforms: { uData: { value: this.tex }, uSize: { value: new THREE.Vector2(W, H) }, uGrid: { value: 1 }, uOpacity: { value: 1 } },
    });
    // One mesh with the same geometry per terrain tile chunk: drops out of view together with the terrain
    this.mesh = new THREE.Group();
    this.mesh.name = opts.name ?? 'dev-tiles';
    const src = r.terrainChunks;
    this.mesh.position.copy(src.position); this.mesh.quaternion.copy(src.quaternion); this.mesh.scale.copy(src.scale);
    for (const c of src.children) {
      if (!c.isMesh) continue;
      const m = new THREE.Mesh(c.geometry, this.material);
      m.renderOrder = opts.order ?? 5;
      m.name = this.mesh.name;
      this.mesh.add(m);
    }
    this.mesh.visible = false;
    r.scene.add(this.mesh);
    this.scene = r.scene;
    /** Key of the content shown last (rebuilds only on change) */
    this.key = '';
  }

  get visible() { return this.mesh.visible; }
  set visible(v) { this.mesh.visible = v; if (!v) this.key = ''; }

  /** Set the content (RGBA per tile). @param {Uint8Array} rgba */
  set(rgba) {
    if (rgba !== this.data) this.data.set(rgba);
    this.tex.needsUpdate = true;
  }

  grid(on) { this.material.uniforms.uGrid.value = on ? 1 : 0; }

  dispose() {
    this.scene.remove(this.mesh);
    this.material.dispose();
    this.tex.dispose();
  }
}
