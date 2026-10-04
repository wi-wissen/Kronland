// Image crop for preview images (purely computational, without DOM – testable).

/**
 * Square crop (tiles) around all explored tiles of the fog layer, with margin, at least 24 tiles.
 * @param {{ w:number, h:number, data: Uint8ClampedArray }} f
 * @returns {{ x:number, y:number, s:number }}
 */
export function exploredBox(f) {
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (f.data[(y * f.w + x) * 4 + 3] === 255) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { x: 0, y: 0, s: Math.max(f.w, f.h) };
  const side = Math.min(Math.max(f.w, f.h), Math.max(24, x1 - x0 + 5, y1 - y0 + 5));
  const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
  const x = Math.max(0, Math.min(f.w - side, Math.round(cx - side / 2)));
  const y = Math.max(0, Math.min(f.h - side, Math.round(cy - side / 2)));
  return { x, y, s: side };
}
