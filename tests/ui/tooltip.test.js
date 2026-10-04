import { describe, it, expect, vi } from 'vitest';
import { createLongPress, LONG_PRESS_MS } from '../../src/ui/tooltip.js';
import { techUnlocks } from '../../src/ui/techUnlocks.js';
import { TECHS } from '../../src/sim/data/technologies.js';
import de from '../../src/i18n/de.js';
import en from '../../src/i18n/en.js';

describe('Long press', () => {
  const make = () => {
    vi.useFakeTimers();
    const onFire = vi.fn();
    return { lp: createLongPress({ onFire }), onFire };
  };

  it('triggers after the hold time and discards the following click once', () => {
    const { lp, onFire } = make();
    lp.down({ x: 10, y: 10 });
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(onFire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledOnce();
    lp.up();
    expect(lp.consumeClick()).toBe(true);
    expect(lp.consumeClick()).toBe(false);
    vi.useRealTimers();
  });

  it('short tap does not trigger and lets the click through', () => {
    const { lp, onFire } = make();
    lp.down({ x: 0, y: 0 });
    vi.advanceTimersByTime(100);
    lp.up();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).not.toHaveBeenCalled();
    expect(lp.consumeClick()).toBe(false);
    vi.useRealTimers();
  });

  it('swiping aborts, small trembling does not', () => {
    const { lp, onFire } = make();
    lp.down({ x: 0, y: 0 });
    lp.move({ x: 3, y: 4 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).toHaveBeenCalledOnce();
    lp.down({ x: 0, y: 0 });
    lp.move({ x: 0, y: 30 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('a new press resets an unconsumed long press', () => {
    const { lp } = make();
    lp.down({ x: 0, y: 0 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    lp.down({ x: 0, y: 0 });
    lp.up();
    expect(lp.consumeClick()).toBe(false);
    vi.useRealTimers();
  });
});

describe('Research unlocks', () => {
  it('reads buildings and upgrade levels from the game data', () => {
    expect(techUnlocks('conscription').build).toContain('barracks');
    expect(techUnlocks('education').build).toEqual(expect.arrayContaining(['chapel', 'storehouse']));
    expect(techUnlocks('education').extra).toEqual(['bld.techTax']);
    expect(techUnlocks('printing').upgrade).toContainEqual(['headquarters', 2]);
  });

  it('every university research unlocks something (no empty tooltip)', () => {
    for (const id of Object.keys(TECHS)) {
      const u = techUnlocks(id);
      expect(u.build.length + u.upgrade.length + u.extra.length, id).toBeGreaterThan(0);
      for (const k of u.extra) { expect(de[k], k).toBeTruthy(); expect(en[k], k).toBeTruthy(); }
    }
  });
});
