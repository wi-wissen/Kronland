// Input: mouse, keyboard, touch. Translates gestures into camera and game actions of the Engine.
// The camera follows the hand directly as in a map application (model: three.js MapControls, gestures as
// in MapLibre): the ground itself is dragged, zoom goes to the pointer, nothing glides on afterwards.
//
// Desktop:  left click = select (Shift/Ctrl/Cmd adds or removes), double click on own figure = all visible of
//           the same kind,
//           left drag = selection box, right click = command,
//           right drag = rotate (sideways) and tilt (up/down), middle button drag = grab
//           the map, wheel = zoom to the mouse pointer (tilt follows), Shift+wheel = tilt,
//           WASD/arrows = pan, Q/E or Ins/Del = rotate, R/F or Home/End = tilt.
// Touch:    1 finger drag = grab the map, tap = select or command, double tap on own
//           figure = all visible of the same kind,
//           2 fingers = zoom to the finger centre and pan, twist fingers = rotate (above a threshold),
//           2 fingers parallel up/down = tilt.

import { get as setting } from '../ui/settings.js';
import { pinchMode, twistUnlocked, wrapAngle } from './gestures.js';
import { isDoubleClick } from './sameType.js';
import { dragRect } from './boxSelect.js';
import { edgeScrollDir, nextArmed } from './edgeScroll.js';

const DRAG_PX = 8;

/**
 * Take the keyboard focus away from a field (code editor, input) as a click on the page would, so the
 * map shortcuts work again after a click on the map whose mousedown was cancelled.
 * @param {Document} doc
 */
export function releaseFocus(doc) {
  const el = /** @type {HTMLElement|null} */ (doc.activeElement);
  if (el && el !== doc.body && typeof el.blur === 'function') el.blur();
}

export class Input {
  /** @param {import('./Engine.js').Engine} engine @param {HTMLCanvasElement} canvas */
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.rig = engine.renderer.rig;
    /** @type {Map<number, {x:number,y:number,sx:number,sy:number,button:number,type:string}>} */
    this.pointers = new Map();
    this.gesture = null;
    // Selection box: one element that stays in the page with its own compositor layer (style.css .selbox);
    // dragging only moves it (transform) and resizes it, showing and hiding toggles a class – no element or
    // layer is created or removed at the start of a drag.
    this.box = document.createElement('div');
    this.box.className = 'selbox';
    this.box.setAttribute('aria-hidden', 'true');
    canvas.parentElement.appendChild(this.box);

    this.on(canvas, 'pointerdown', this.down);
    this.on(window, 'pointermove', this.move);
    this.on(window, 'pointerup', this.up);
    this.on(window, 'pointercancel', this.up);
    this.on(canvas, 'wheel', this.wheel, { passive: false });
    this.on(canvas, 'contextmenu', (e) => e.preventDefault());
    // Primary and middle button: no native default action on the map. An uncancelled primary mousedown lets
    // Firefox track a drag-and-drop/selection gesture that it evaluates after a few pixels – right when the
    // selection box starts; the middle button would start the browser's auto scrolling. Cancelling the
    // mousedown also skips the focus change, so the primary button hands the focus back itself.
    this.on(canvas, 'mousedown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      if (e.button === 0) releaseFocus(document);
    });
    this.on(canvas, 'dragstart', (e) => e.preventDefault());
    this.on(window, 'keydown', this.keydown);
    this.on(window, 'keyup', (e) => this.rig.keys.delete(e.key.toLowerCase()));
    this.on(window, 'blur', () => { this.rig.keys.clear(); this.mouse = null; });
    // Edge scrolling (edgeScroll.js): remember the last mouse position. pointermove instead of mousemove: it also
    // arrives while another element holds the pointer capture or cancelled the compatibility mouse events
    // (code panel divider), so the position is never stale. Presses that start outside the game area (divider,
    // panels) block edge scrolling until the pointer has been back on the map.
    /** Edge scrolling armed (see edgeScroll.js nextArmed) */
    this.edgeArmed = true;
    /** Pointer id of a press that started outside the game area, null = none */
    this.uiPress = null;
    this.on(window, 'pointerdown', (e) => {
      if (e.pointerType !== 'touch' && !this.inGame(e.target)) this.uiPress = e.pointerId;
      this.track(e);
    }, true);
    this.on(window, 'pointermove', this.track, true);
    const release = (e) => { if (e.pointerId === this.uiPress) this.uiPress = null; this.track(e, true); };
    this.on(window, 'pointerup', release, true);
    this.on(window, 'pointercancel', release, true);
    // If the mouse leaves the window (e.g. upwards into the browser bar), edge scrolling ends.
    // mouseleave on the document does not arrive in every browser, mouseout without a target does.
    this.on(document, 'mouseleave', () => { this.mouse = null; });
    this.on(window, 'mouseout', (e) => { if (!e.relatedTarget) this.mouse = null; });
  }

  on(target, type, fn, opts) {
    const bound = fn.bind(this);
    target.addEventListener(type, bound, opts);
    (this.off ??= []).push(() => target.removeEventListener(type, bound, opts));
  }

  /** Screen point → image coordinates −1…1 (y up). @returns {[number, number]} */
  ndc(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return [((x - r.left) / (r.width || 1)) * 2 - 1, -((y - r.top) / (r.height || 1)) * 2 + 1];
  }

  /**
   * Push the camera when the mouse is at the screen edge (setting "Randscrollen").
   * Called by the Engine every frame.
   * @param {number} dt seconds
   */
  edgeScroll(dt) {
    const W = window.innerWidth, H = window.innerHeight;
    let dx = 0, dy = 0;
    if (!this.engine.touch && setting('edgeScroll') && !(typeof document !== 'undefined' && !document.hasFocus())) {
      [dx, dy] = edgeScrollDir(this.mouse, this.edgeArmed, this.canvasRect(), W, H);
    }
    // gentle ramp-up (0.25 s) instead of full speed at once
    this.edgeT = dx || dy ? Math.min(1, (this.edgeT ?? 0) + dt * 4) : 0;
    if (!dx && !dy) return;
    const speed = 900 * dt * this.edgeT;
    this.rig.pan(dx * speed, dy * speed, this.canvas.clientHeight || H);
  }

  /** Edges of the canvas (split screen with the code panel: only the left part of the window). */
  canvasRect() {
    return this.canvas.getBoundingClientRect?.() ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  }

  /** Element inside the game area (canvas or HUD over it), not a panel beside it such as the code panel. */
  inGame(el) {
    const area = this.canvas.parentElement ?? this.canvas;
    return !!el && (el === this.canvas || !!area.contains?.(el));
  }

  /**
   * Remember the mouse position for edge scrolling and update whether it is armed.
   * @param {PointerEvent} e @param {boolean} [released] pointerup/pointercancel: no button held any more
   */
  track(e, released = false) {
    if (e.pointerType === 'touch') return;
    const prev = this.mouse ?? null;
    const cur = {
      x: e.clientX, y: e.clientY, buttons: released ? 0 : e.buttons,
      // with pointer capture the target is the capturing element (divider) wherever the pointer is
      inGame: this.inGame(e.target), uiDrag: this.uiPress != null,
    };
    this.edgeArmed = nextArmed(this.edgeArmed, prev, cur, this.canvasRect(), window.innerWidth, window.innerHeight);
    this.mouse = cur;
  }

  dispose() { for (const f of this.off ?? []) f(); this.box.remove(); }

  /** Grab the map at the screen position (x, y). */
  startPan(x, y) {
    this.gesture = { kind: 'pan', h: this.rig.grabHeight(...this.ndc(x, y)), x, y };
  }

  /** Drag the grabbed ground under (x, y). */
  panTo(x, y) {
    const g = this.gesture;
    if (x === g.x && y === g.y) return;
    this.rig.dragStep(...this.ndc(g.x, g.y), ...this.ndc(x, y), g.h);
    g.x = x; g.y = y;
  }

  down(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType };
    this.pointers.set(e.pointerId, p);
    this.engine.touch = e.pointerType === 'touch';
    if (e.pointerType === 'touch') {
      if (this.pointers.size === 2) this.startPinch();
    } else if (e.button === 1) this.startPan(p.x, p.y);
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.gesture = {
      kind: 'pinch',
      /** null = still open; 'zoom' = zoom, pan, rotate; 'tilt' = tilt */
      mode: null,
      a0: { x: a.x, y: a.y }, b0: { x: b.x, y: b.y }, dist0: dist,
      dist, angle: Math.atan2(b.y - a.y, b.x - a.x), mid,
      h: this.rig.grabHeight(...this.ndc(mid.x, mid.y)),
      twist: 0, minDist: dist, rotating: false,
    };
    for (const p of this.pointers.values()) p.sx = -1e9; // never count as a tap any more
  }

  /** Two fingers moved. The kind of gesture is fixed once (like MapLibre), then applied directly. */
  pinchMove() {
    const g = this.gesture;
    const [a, b] = [...this.pointers.values()];
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (!g.mode) {
      g.mode = pinchMode({ x: a.x - g.a0.x, y: a.y - g.a0.y }, { x: b.x - g.b0.x, y: b.y - g.b0.y }, dist - g.dist0);
      if (!g.mode) return;
    }
    if (g.mode === 'tilt') {
      this.rig.rotate(0, (mid.y - g.mid.y) * 0.004);
    } else {
      // ground under the finger centre moves along, zoom to the finger centre
      this.rig.dragStep(...this.ndc(g.mid.x, g.mid.y), ...this.ndc(mid.x, mid.y), g.h);
      this.rig.zoomAt(g.dist / dist, ...this.ndc(mid.x, mid.y));
      // rotate only above a threshold, so zooming does not rotate on the side
      let dA = wrapAngle(angle - g.angle);
      if (!g.rotating) {
        g.twist += dA;
        g.minDist = Math.min(g.minDist, dist);
        g.rotating = twistUnlocked(g.twist, g.minDist);
        dA = 0; // keep rotating from here without catching up the threshold path (no jerk)
      }
      if (dA) this.rig.rotateAt(dA, ...this.ndc(mid.x, mid.y));
    }
    g.dist = dist; g.angle = angle; g.mid = mid;
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

    if (p.type === 'touch') {
      if (this.pointers.size >= 2 && this.gesture?.kind === 'pinch') { this.pinchMove(); return; }
      if (this.gesture?.kind !== 'pan' && moved) this.startPan(p.sx, p.sy);
      if (this.gesture?.kind === 'pan') this.panTo(p.x, p.y);
      if (this.engine.placing) this.engine.hover(e.clientX, e.clientY);
      return;
    }

    // mouse
    if (p.button === 2 && moved) { this.rig.rotate(-dx * 0.006, dy * 0.004); this.gesture = { kind: 'rotate' }; }
    else if (p.button === 1 && this.gesture?.kind === 'pan') this.panTo(p.x, p.y);
    else if (p.button === 0 && moved && !this.engine.placing) {
      this.gesture = { kind: 'box' };
      this.showBox(dragRect(p.sx, p.sy, p.x, p.y));
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
        if (!moved && this.gesture?.kind !== 'pinch') {
          if (!(this.doubleClick(e) && !this.engine.placing && this.engine.selectSameTypeAt(e.clientX, e.clientY, !!this.engine.multi))) this.engine.tap(e.clientX, e.clientY);
        }
        this.gesture = null;
      } else if (this.gesture?.kind === 'pinch') {
        // one finger stays: continue dragging seamlessly with it
        const [rest] = [...this.pointers.values()];
        this.startPan(rest.x, rest.y);
      }
      return;
    }

    if (p.button === 0) {
      // Shift, Ctrl or Cmd add to the selection (click toggles a figure)
      const add = e.shiftKey || e.ctrlKey || e.metaKey;
      if (this.gesture?.kind === 'box') {
        this.hideBox();
        this.engine.selectBox(p.sx, p.sy, e.clientX, e.clientY, add);
      } else if (!moved) {
        if (this.engine.placing) this.engine.confirmPlacement(e.shiftKey);
        else if (this.engine.attackMode) this.engine.commandAt(e.clientX, e.clientY, true);
        else if (!(this.doubleClick(e) && this.engine.selectSameTypeAt(e.clientX, e.clientY, add))) {
          this.engine.selectAt(e.clientX, e.clientY, add);
        }
      }
    } else if (p.button === 2 && !moved) {
      if (this.engine.placing) this.engine.cancelPlacement();
      else this.engine.commandAt(e.clientX, e.clientY, e.ctrlKey);
    }
    this.gesture = null;
  }

  /** Draw the selection box over the rectangle (screen coordinates). */
  showBox(r) {
    const s = this.box.style;
    s.transform = `translate(${r.left}px, ${r.top}px)`;
    s.width = r.width + 'px';
    s.height = r.height + 'px';
    if (!this.boxOn) { this.boxOn = true; this.box.classList.add('on'); }
  }

  hideBox() {
    if (!this.boxOn) return;
    this.boxOn = false;
    this.box.classList.remove('on');
  }

  /** Remember click or tap; true if it is the second one of a double click. */
  doubleClick(e) {
    const cur = { x: e.clientX, y: e.clientY, at: performance.now() };
    const twice = isDoubleClick(this.lastClick, cur);
    this.lastClick = cur;
    return twice;
  }

  wheel(e) {
    e.preventDefault();
    // Strength by wheel rotation: one notch (≈ 100 px) ≈ factor 1.1; touchpad and line mode continuous
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    const d = Math.max(-300, Math.min(300, (e.shiftKey ? e.deltaY || e.deltaX : e.deltaY) * unit));
    // Shift+wheel tilts the camera (touchpad, without right mouse button), otherwise zoom to the mouse pointer.
    // Touchpad pinch comes as a wheel with Ctrl and small steps: weight more strongly.
    if (e.shiftKey) this.rig.rotate(0, -d * 0.0006);
    else this.rig.zoomAt(Math.exp(d * (e.ctrlKey && Math.abs(d) < 50 ? 0.01 : 0.001)), ...this.ndc(e.clientX, e.clientY));
  }

  keydown(e) {
    // Typing in input fields and in the code editor does not steer the camera
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target?.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { this.engine.cancelPlacement(); this.engine.clearSelection(); return; }
    if (k === ' ') { e.preventDefault(); this.engine.togglePause(); return; }
    if (k === '.') { this.engine.selectIdleSerfs(); return; }
    // Control groups: Shift/Ctrl+number remembers the selection, number recalls it (twice: camera there)
    const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code ?? '');
    if (digit) {
      const n = Number(digit[2]);
      if (e.shiftKey || e.ctrlKey || e.metaKey) { e.preventDefault(); this.engine.assignGroup(n); return; }
      if (!e.altKey && this.engine.selectGroup(n)) return;
    }
    this.rig.keys.add(k);
  }
}
