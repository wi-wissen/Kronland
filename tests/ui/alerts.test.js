// Attack spots on the minimap (src/game/alerts.js).

import { describe, it, expect } from 'vitest';
import { noteAlert, activeAlerts, ALERT_MS, ALERT_RADIUS } from '../../src/game/alerts.js';

describe('Attack spots', () => {
  it('merges nearby hits and refreshes them', () => {
    let l = noteAlert([], { x: 10, y: 10 }, 0);
    l = noteAlert(l, { x: 12, y: 11 }, 1000);
    expect(l).toEqual([{ x: 10, y: 10, last: 1000 }]);
    l = noteAlert(l, { x: 10 + ALERT_RADIUS + 1, y: 10 }, 1500);
    expect(l).toHaveLength(2);
  });

  it('lets spots without new hits disappear after ALERT_MS', () => {
    const l = noteAlert([], { x: 5, y: 5 }, 0);
    expect(activeAlerts(l, ALERT_MS - 1)).toHaveLength(1);
    expect(activeAlerts(l, ALERT_MS)).toHaveLength(0);
    expect(noteAlert(l, { x: 50, y: 50 }, ALERT_MS + 5)).toEqual([{ x: 50, y: 50, last: ALERT_MS + 5 }]);
  });
});
