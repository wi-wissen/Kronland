// Setting "tracks" (off / fading / permanent): validated and saved like the other settings; in a running game the
// engine sends it as the command setTracks (never a direct write) unless the level fixes the mode.

import { describe, it, expect } from 'vitest';
import { set, get, DEFAULTS, TRACK_OPTIONS } from '../../src/ui/settings.js';
import { Engine } from '../../src/game/Engine.js';
import { BALANCE } from '../../src/sim/data/balance.js';

describe('Setting "tracks"', () => {
  it('three modes, default fading, invalid values fall back', () => {
    expect(TRACK_OPTIONS).toEqual(['off', 'fading', 'permanent']);
    expect(TRACK_OPTIONS).toEqual(BALANCE.ground.tracks.modes);
    expect(DEFAULTS.tracks).toBe('fading');
    set('tracks', 'permanent');
    expect(get('tracks')).toBe('permanent');
    set('tracks', 'sometimes');
    expect(get('tracks')).toBe('fading');
  });

  it('the engine sends a differing setting as a command, not when the level fixes the mode', () => {
    const fake = (sim) => ({ sim, queue: [], issue(cmd) { this.queue.push(cmd); } });
    set('tracks', 'off');
    const free = fake({ trackMode: 'fading', trackModeFixed: false });
    Engine.prototype.syncTracks.call(free);
    expect(free.queue).toEqual([{ type: 'setTracks', mode: 'off' }]);
    expect(free.sim.trackMode).toBe('fading'); // the simulation changes only with the command
    const same = fake({ trackMode: 'off', trackModeFixed: false });
    Engine.prototype.syncTracks.call(same);
    expect(same.queue).toEqual([]);
    const fixed = fake({ trackMode: 'permanent', trackModeFixed: true });
    Engine.prototype.syncTracks.call(fixed);
    expect(fixed.queue).toEqual([]);
    set('tracks', DEFAULTS.tracks);
  });
});
