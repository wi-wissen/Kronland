// Input: mouse, keyboard, touch. Translates gestures into camera and game actions of the Engine.
//
// Desktop:  left click = select, left drag = selection box, right click = command,
//           right drag = rotate, middle button drag = pan, wheel = zoom,
//           WASD/arrows = pan, Q/E or Ins/Del = rotate.
// Touch:    1 finger drag = pan, tap = select or command,
//           2 fingers = zoom and rotate.

import { get as setting } from '../ui/settings.js';

const DRAG_PX = 8;
/** Width of the edge strip (px) in which the mouse pushes the camera */
const EDGE_PX = 6;

export class Input {
  /** @param {import('./Engine.js').Engine} engine @param {HTMLCanvasElement} canvas */
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.rig = engine.renderer.rig;
    /** @type {Map<number, {x:number,y:number,sx:number,sy:number,button:number,type:string}>} */
    this.pointers = new Map();
    this.gesture = null;
    this.box = document.createElement('div');
    this.box.className = 'selbox';
    this.box.hidden = true;
    canvas.parentElement.appendChild(this.box);

    this.on(canvas, 'pointerdown', this.down);
    this.on(window, 'pointermove', this.move);
    this.on(window, 'pointerup', this.up);
    this.on(window, 'pointercancel', this.up);
    this.on(canvas, 'wheel', this.wheel, { passive: false });
    this.on(canvas, 'contextmenu', (e) => e.preventDefault());
    this.on(window, 'keydown', this.keydown);
    this.on(window, 'keyup', (e) => this.rig.keys.delete(e.key.toLowerCase()));
    this.on(window, 'blur', () => { this.rig.keys.clear(); this.mouse = null; });
    // Edge scrolling: remember the last mouse position; if the mouse leaves the window, it ends
    this.on(window, 'mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY, buttons: e.buttons }; });
    this.on(document, 'mouseleave', () => { this.mouse = null; });
  }

  on(target, type, fn, opts) {
    const bound = fn.bind(this);
    target.addEventListener(type, bound, opts);
    (this.off ??= []).push(() => target.removeEventListener(type, bound, opts));
  }

  /**
   * Push the camera when the mouse is at the screen edge (setting "Randscrollen").
   * Called by the Engine every frame.
   * @param {number} dt seconds
   */
  edgeScroll(dt) {
    const m = this.mouse;
    if (!m || m.buttons || this.engine.touch || !setting('edgeScroll')) return;
    if (typeof document !== 'undefined' && !document.hasFocus()) return;
    const W = window.innerWidth, H = window.innerHeight;
    let dx = 0, dy = 0;
    if (m.x <= EDGE_PX) dx = 1; else if (m.x >= W - 1 - EDGE_PX) dx = -1;
    if (m.y <= EDGE_PX) dy = 1; else if (m.y >= H - 1 - EDGE_PX) dy = -1;
    if (!dx && !dy) return;
    const speed = 900 * dt;
    this.rig.pan(dx * speed, dy * speed, this.canvas.clientHeight || H);
  }

  dispose() { for (const f of this.off ?? []) f(); this.box.remove(); }

  down(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType });
    if (e.pointerType === 'touch' && this.pointers.size === 2) this.startPinch();
    this.engine.touch = e.pointerType === 'touch';
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.gesture = {
      kind: 'pinch',
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      // build preview only over the map, not over controls
      if (e.pointerType === 'mouse' && e.target === this.canvas) this.engine.hover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const moved = Math.hypot(p.x - p.sx, p.y - p.sy) > DRAG_PX;
    const H = this.canvas.clientHeight || 600;

    if (p.type === 'touch') {
      if (this.pointers.size >= 2 && this.gesture?.kind === 'pinch') {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.rig.zoom(this.gesture.dist / Math.max(1, dist));
        this.rig.rotate(angle - this.gesture.angle, (mid.y - this.gesture.mid.y) * 0.004);
        this.gesture.dist = dist; this.gesture.angle = angle; this.gesture.mid = mid;
        p.sx = -1e9; // never count as a tap any more
        return;
      }
      if (moved) { this.rig.pan(dx, dy, H); this.gesture = { kind: 'pan' }; }
      if (this.engine.placing) this.engine.hover(e.clientX, e.clientY);
      return;
    }

    // mouse
    if (p.button === 2 && moved) { this.rig.rotate(-dx * 0.006, dy * 0.004); this.gesture = { kind: 'rotate' }; }
    else if (p.button === 1) { this.rig.pan(dx, dy, H); this.gesture = { kind: 'pan' }; }
    else if (p.button === 0 && moved && !this.engine.placing) {
      this.gesture = { kind: 'box' };
      const x = Math.min(p.sx, p.x), y = Math.min(p.sy, p.y);
      Object.assign(this.box.style, { left: x + 'px', top: y + 'px', width: Math.abs(p.x - p.sx) + 'px', height: Math.abs(p.y - p.sy) + 'px' });
      this.box.hidden = false;
    }
    this.engine.hover(e.clientX, e.clientY);
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > DRAG_PX;

    if (p.type === 'touch') {
      if (this.pointers.size === 0) {
        if (!moved && this.gesture?.kind !== 'pinch') this.engine.tap(e.clientX, e.clientY);
        this.gesture = null;
      }
      return;
    }

    if (p.button === 0) {
      if (this.gesture?.kind === 'box') {
        this.box.hidden = true;
        this.engine.selectBox(p.sx, p.sy, e.clientX, e.clientY, e.shiftKey);
      } else if (!moved) {
        if (this.engine.placing) this.engine.confirmPlacement(e.shiftKey);
        else if (this.engine.attackMode) this.engine.commandAt(e.clientX, e.clientY, true);
        else this.engine.selectAt(e.clientX, e.clientY, e.shiftKey);
      }
    } else if (p.button === 2 && !moved) {
      if (this.engine.placing) this.engine.cancelPlacement();
      else this.engine.commandAt(e.clientX, e.clientY, e.ctrlKey);
    }
    this.gesture = null;
  }

  wheel(e) {
    e.preventDefault();
    this.rig.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1);
  }

  keydown(e) {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { this.engine.cancelPlacement(); this.engine.clearSelection(); return; }
    if (k === ' ') { e.preventDefault(); this.engine.togglePause(); return; }
    if (k === '.') { this.engine.selectIdleSerfs(); return; }
    this.rig.keys.add(k);
  }
}
