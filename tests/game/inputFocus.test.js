import { describe, it, expect, vi } from 'vitest';
import { releaseFocus } from '../../src/game/Input.js';

// The map cancels the primary mousedown (no Firefox drag/selection tracking), so it hands the focus back itself.
describe('releaseFocus', () => {
  it('blurs a focused field', () => {
    const body = {}, field = { blur: vi.fn() };
    releaseFocus(/** @type {any} */ ({ body, activeElement: field }));
    expect(field.blur).toHaveBeenCalledOnce();
  });
  it('leaves the body and an empty focus alone', () => {
    const body = { blur: vi.fn() };
    releaseFocus(/** @type {any} */ ({ body, activeElement: body }));
    releaseFocus(/** @type {any} */ ({ body, activeElement: null }));
    expect(body.blur).not.toHaveBeenCalled();
  });
});
