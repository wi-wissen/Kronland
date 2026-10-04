// Performance display for developers (?debug=1): frames/s, draw calls, triangles, LOD levels per group.
// A plain DOM element above the game; only reads counters from the renderer.

/** Is the display switched on via the address? */
export function debugEnabled() {
  try { return new URLSearchParams(globalThis.location?.search ?? '').get('debug') === '1'; } catch { return false; }
}

export class DebugOverlay {
  constructor() {
    const el = document.createElement('div');
    el.dataset.testid = 'debug-overlay';
    Object.assign(el.style, {
      position: 'fixed', left: '8px', bottom: '8px', zIndex: 9999, pointerEvents: 'none',
      font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace', color: '#e8f4e0',
      background: 'rgba(12, 16, 14, 0.78)', padding: '6px 8px', borderRadius: '6px', whiteSpace: 'pre',
      boxShadow: '0 1px 6px rgba(0,0,0,0.35)', maxWidth: '96vw',
    });
    document.body.appendChild(el);
    this.el = el;
    this.frames = 0; this.t0 = performance.now(); this.fps = 0; this.ms = 0; this.worst = 0;
    this.last = this.t0;
  }

  /** Pro Bild aufrufen. @param {() => Record<string, any>} read */
  tick(read) {
    const now = performance.now();
    const dt = now - this.last; this.last = now;
    this.worst = Math.max(this.worst, dt);
    this.frames++;
    if (now - this.t0 < 500) return;
    this.fps = (this.frames * 1000) / (now - this.t0);
    this.ms = (now - this.t0) / this.frames;
    const s = read();
    const lod = Object.entries(s.lod ?? {}).map(([k, v]) => `${k.padEnd(10)} ${v.map((n) => String(n).padStart(5)).join(' ')}`).join('\n');
    this.el.textContent = `${this.fps.toFixed(1)} fps  ${this.ms.toFixed(1)} ms (max ${this.worst.toFixed(0)})  Stufe ${s.tier}
Aufrufe ${s.calls}   Dreiecke ${fmt(s.triangles)}   Geometrien ${s.geometries}
Figuren ${s.chars.drawn} gezeichnet, ${s.chars.culled} verworfen, ${s.chars.meshes} Netze, ${s.chars.variants} Varianten
Partikel ${s.particles}   Geschosse ${s.projectiles}
LOD        ${'  0     1     2     3'}
${lod}`;
    this.frames = 0; this.t0 = now; this.worst = 0;
  }

  dispose() { this.el.remove(); }
}

const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' k' : String(n));
