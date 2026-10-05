import { describe, it, expect } from 'vitest';
import { figureSync } from '../../src/render/Renderer.js';

describe('figureSync', () => {
  it('serfs, workers and conversation figures only via syncUnit', () => {
    for (const k of ['unit', 'worker', 'npc']) expect(figureSync(k)).toBe('unit');
  });
  it('fighters, heroes and traps via syncFighter', () => {
    for (const k of ['leader', 'soldier', 'hero', 'trap', 'bomb']) expect(figureSync(k)).toBe('fighter');
  });
});
