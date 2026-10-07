import { describe, it, expect } from 'vitest';
import { CATEGORIES, MERGE, categoryOf, addNotice, expireNotices, pickVisible, attackInfo, attackNotices } from '../../src/game/notices.js';
import { noteAlert, activeAlerts, ALERT_MS } from '../../src/game/alerts.js';
import de from '../../src/i18n/de.js';
import en from '../../src/i18n/en.js';

let id = 0;
const n = (key, params = null, extra = {}) => ({ id: ++id, key, params, icon: 'info', tone: 'info', pos: null, at: 0, ttl: 5000, ...extra });

describe('Notices: categories', () => {
  it('classifies keys', () => {
    expect(categoryOf('toast.attackBuilding')).toBe('alarm');
    expect(categoryOf('toast.buildingBurning')).toBe('fire');
    expect(categoryOf('toast.promoted')).toBe('military');
    expect(categoryOf('toast.buildingDone')).toBe('build');
    expect(categoryOf('toast.notify')).toBe('script');
    expect(categoryOf('err.popLimit')).toBe('feedback');
    expect(categoryOf('saves.saved')).toBe('system');
    expect(categoryOf('whatever')).toBe('info');
    expect(CATEGORIES.alarm.prio).toBeLessThan(CATEGORIES.military.prio);
  });

  it('every bundle text exists in both languages', () => {
    for (const k of Object.values(MERGE)) { expect(de[k], k).toBeTruthy(); expect(en[k], k).toBeTruthy(); expect(de[k]).toContain('{n}'); }
  });
});

describe('Notices: queueing and bundling', () => {
  it('promotions bundle into one entry with a counter', () => {
    const list = [];
    for (let i = 0; i < 5; i++) addNotice(list, n('toast.promoted', { unit: 'sword1', rank: i, stars: i }, { pos: { x: i, y: 0 } }), 100 * i);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ count: 5, many: 'toast.promotedMany', at: 400, pos: { x: 4, y: 0 }, params: { rank: 4 } });
  });

  it('identical notices bundle, different ones do not', () => {
    const list = [];
    addNotice(list, n('err.notEnough', { res: 'gold' }), 0);
    addNotice(list, n('err.notEnough', { res: 'gold' }), 10);
    expect(list).toHaveLength(1);
    expect(list[0].count).toBe(2);
    expect(list[0].many).toBeNull();
    addNotice(list, n('toast.researchDone', { tech: 'a' }), 20);
    addNotice(list, n('toast.lineUpgraded', { line: 'sword', tier: 2 }), 30);
    // research has limit 1: the older one drops out
    expect(list.map((t) => t.key)).toEqual(['err.notEnough', 'toast.lineUpgraded']);
  });

  it('the limit per category only displaces its own category', () => {
    const list = [];
    addNotice(list, n('toast.buildingDestroyed', { building: 'farm' }), 0);
    for (let i = 0; i < 6; i++) addNotice(list, n('toast.nodeDepleted', { res: `r${i}` }), i + 1);
    expect(list.filter((t) => t.cat === 'economy')).toHaveLength(CATEGORIES.economy.limit);
    expect(list.some((t) => t.key === 'toast.buildingDestroyed')).toBe(true);
  });

  it('expires after ttl', () => {
    const list = [];
    addNotice(list, n('toast.weather', { weather: 'rain' }, { ttl: 1000 }), 0);
    expireNotices(list, 999);
    expect(list).toHaveLength(1);
    expireNotices(list, 1000);
    expect(list).toHaveLength(0);
  });
});

describe('Notices: selection of the visible ones', () => {
  const sticky = (sid, cat = 'alarm') => ({ ...n('toast.attackTroops'), id: sid, cat, sticky: true, ttl: Infinity, count: 1, many: null });

  it('in combat: attack on top, promotions bundled, finished building stays visible', () => {
    const list = [];
    for (let i = 0; i < 20; i++) addNotice(list, n('toast.promoted', { unit: 'bow1', rank: 1, stars: 1 + (i % 3) }), 1000 + i);
    addNotice(list, n('toast.buildingDone', { building: 'farm', level: 0 }), 500);
    for (let i = 0; i < 4; i++) addNotice(list, n('toast.recruited', { unit: 'sword1' }), 900 + i);
    const vis = pickVisible(list, [sticky('attack-1')], 5);
    expect(vis[0].id).toBe('attack-1');
    expect(vis.filter((t) => t.key === 'toast.promoted')).toHaveLength(1);
    expect(vis.find((t) => t.key === 'toast.promoted').count).toBe(20);
    expect(vis.some((t) => t.key === 'toast.buildingDone')).toBe(true);
  });

  it('every category gets a slot before a second notice of the same one appears', () => {
    const list = [];
    addNotice(list, n('toast.nodeDepleted', { res: 'stone' }), 1);
    addNotice(list, n('toast.noMoreNodes', { res: 'iron' }), 2);
    addNotice(list, n('toast.recruited', { unit: 'a' }), 3);
    addNotice(list, n('toast.weather', { weather: 'snow' }), 4);
    const vis = pickVisible(list, [sticky('attack-1'), sticky('attack-2'), sticky('fire', 'fire')], 4);
    // at most max − 1 sticky notices, then the most important transient category (economy before military/world)
    expect(vis.filter((t) => t.sticky)).toHaveLength(3);
    expect(vis.filter((t) => !t.sticky).map((t) => t.cat)).toEqual(['economy']);
    const wide = pickVisible(list, [sticky('attack-1')], 5);
    expect(new Set(wide.map((t) => t.cat))).toEqual(new Set(['alarm', 'economy', 'military', 'world']));
    expect(wide).toHaveLength(5);
  });

  it('without transient notices, sticky notices may take all slots', () => {
    expect(pickVisible([], [sticky('a'), sticky('b')], 2)).toHaveLength(2);
  });
});

describe('Sticky attack notice', () => {
  it('stays as long as hits keep coming and expires ALERT_MS after the last one', () => {
    const hq = { kind: 'building', type: 'headquarters', level: 0 }, soldier = { kind: 'soldier' };
    let zones = noteAlert([], { x: 10, y: 10 }, 0, attackInfo(soldier, { x: 10, y: 10 }));
    expect(attackNotices(zones)[0]).toMatchObject({ key: 'toast.attackTroops', sticky: true, cat: 'alarm' });
    // hits at the castle in the same area: higher-ranked target takes over the notice, the entry stays the same
    const before = attackNotices(zones)[0].id;
    for (let t = 1000; t <= 30000; t += 1000) zones = noteAlert(zones, { x: 12, y: 11 }, t, attackInfo(t > 5000 ? soldier : hq, { x: 12, y: 11 }));
    expect(attackNotices(zones)).toHaveLength(1);
    expect(attackNotices(zones)[0]).toMatchObject({ id: before, key: 'toast.attackBuilding', params: { building: 'headquarters' } });
    expect(attackNotices(activeAlerts(zones, 30000 + ALERT_MS - 1))).toHaveLength(1);
    expect(attackNotices(activeAlerts(zones, 30000 + ALERT_MS))).toHaveLength(0);
  });

  it('a dismissed spot stays gone, a new spot reports again', () => {
    let zones = noteAlert([], { x: 0, y: 0 }, 0, attackInfo({ kind: 'unit' }, { x: 0, y: 0 }));
    zones[0].muted = true;
    expect(attackNotices(zones)).toHaveLength(0);
    zones = noteAlert(zones, { x: 50, y: 50 }, 10, attackInfo({ kind: 'unit' }, { x: 50, y: 50 }));
    expect(attackNotices(zones)).toHaveLength(1);
  });
});
