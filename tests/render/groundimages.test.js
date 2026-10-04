// Painted ground textures: loading before game start, fallback to the textures painted in code.
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });

describe('loadGroundImages', () => {
  it('loads the file per kind matching the texture size (mobile: 512 version)', async () => {
    const urls = [];
    vi.stubGlobal('fetch', async (u) => { urls.push(u); return { ok: true, blob: async () => ({}) }; });
    vi.stubGlobal('createImageBitmap', async () => ({ width: 512, height: 512 }));
    const t = await import('../../src/render/textures.js');
    let ticks = 0;
    expect(await t.loadGroundImages('x/', 512, () => ticks++)).toBe(t.GROUND_IMAGE_KINDS.length);
    expect(ticks).toBe(t.GROUND_IMAGE_KINDS.length);
    expect(urls).toContain('x/grass-512.webp');
    expect(urls.every((u) => u.endsWith('-512.webp'))).toBe(true);
    expect(t.groundImageKinds(512)).toEqual(t.GROUND_IMAGE_KINDS);
    expect(t.groundImageName('rock', 1024)).toBe('rock');
    expect(t.groundImageName('rock', 256)).toBe('rock-512');
  });

  it('missing files are not fatal: the kind stays painted in code', async () => {
    vi.stubGlobal('fetch', async (u) => ({ ok: !u.includes('snow'), status: 404, blob: async () => ({}) }));
    vi.stubGlobal('createImageBitmap', async () => ({}));
    const t = await import('../../src/render/textures.js');
    let ticks = 0;
    expect(await t.loadGroundImages('x/', 1024, () => ticks++)).toBe(t.GROUND_IMAGE_KINDS.length - 1);
    expect(ticks).toBe(t.GROUND_IMAGE_KINDS.length);
    expect(t.groundImageKinds(1024)).not.toContain('snow');
  });

  it('without network: nothing loaded, no error', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    const t = await import('../../src/render/textures.js');
    expect(await t.loadGroundImages('x/', 1024)).toBe(0);
    expect(t.groundImageKinds(1024)).toEqual([]);
  });
});
