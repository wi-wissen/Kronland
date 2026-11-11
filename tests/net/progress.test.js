import { describe, it, expect, vi } from 'vitest';
import { createProgress, createTracker, limitCode, MAX_CODE, loadDone, markDone, BATCH } from '../../src/net/progress.js';
import { memoryKv } from '../../src/net/kv.js';
import { ApiError } from '../../src/net/api.js';
import { NetError } from '../../src/net/errors.js';
import { FakeStorage, schemaOf } from './helpers.js';
import { validate } from '../../src/net/schema.js';

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const base = { pack: 'wi7.adventures-2', packHash: 'a'.repeat(64), level: 'r1-2', type: 'started' };

function setup({ post = async () => null, online = true } = {}) {
  const kv = memoryKv().kv;
  const sent = [];
  const api = { post: vi.fn(async (path, body) => { sent.push(...body.events); return post(path, body); }) };
  const progress = createProgress({ api, kv, canSend: () => online, uuid, now: () => new Date('2026-10-09T14:03:11.456Z') });
  return { progress, kv, api, sent };
}

describe('progress buffer', () => {
  it('events get a uuid and a time and validate against the contract', async () => {
    const { progress } = setup();
    const e = await progress.record({ ...base, attempts: 1, seconds: 0 });
    expect(e.at).toBe('2026-10-09T14:03:11Z');
    expect(validate(schemaOf('progress'), { events: [e] })).toEqual([]);
    expect(await progress.pending()).toBe(1);
  });

  it('flush sends in order and empties the buffer', async () => {
    const { progress, api, sent } = setup();
    await progress.record({ ...base, type: 'started' });
    await progress.record({ ...base, type: 'completed' });
    expect(await progress.flush()).toBe(2);
    expect(api.post).toHaveBeenCalledWith('/api/v1/progress', expect.anything());
    expect(sent.map((e) => e.type)).toEqual(['started', 'completed']);
    expect(await progress.pending()).toBe(0);
  });

  it('offline or signed out: events stay buffered; a failed send keeps them for later', async () => {
    const off = setup({ online: false });
    await off.progress.record(base);
    expect(await off.progress.flush()).toBe(0);
    expect(off.api.post).not.toHaveBeenCalled();
    expect(await off.progress.pending()).toBe(1);

    let fail = true;
    const s = setup({ post: async () => { if (fail) throw new NetError('net.err.offline'); } });
    await s.progress.record(base);
    expect(await s.progress.flush()).toBe(0);
    expect(await s.progress.pending()).toBe(1);
    fail = false;
    expect(await s.progress.flush()).toBe(1);
    expect(await s.progress.pending()).toBe(0);
  });

  it('events the server refuses (422) are dropped, server errors (5xx) are retried', async () => {
    const s = setup({ post: async () => { throw new ApiError('net.err.invalid', {}, 422); } });
    await s.progress.record(base);
    await s.progress.flush();
    expect(await s.progress.pending()).toBe(0);
    const t = setup({ post: async () => { throw new ApiError('net.err.http', { status: 503 }, 503); } });
    await t.progress.record(base);
    await t.progress.flush();
    expect(await t.progress.pending()).toBe(1);
  });

  it('batches, and sending twice is harmless because ids stay the same', async () => {
    const s = setup();
    for (let i = 0; i < BATCH + 5; i++) await s.progress.record({ ...base, attempts: i });
    await s.progress.flush();
    expect(s.api.post).toHaveBeenCalledTimes(2);
    expect(new Set(s.sent.map((e) => e.id)).size).toBe(BATCH + 5);
  });

  it('survives a reload: the buffer lives in the store', async () => {
    const kv = memoryKv().kv;
    const mk = (post) => createProgress({ api: { post }, kv, uuid });
    await mk(async () => {}).record(base);
    const sent = [];
    const second = mk(async (p, b) => { sent.push(...b.events); });
    expect(await second.pending()).toBe(1);
    await second.flush();
    expect(sent).toHaveLength(1);
  });
});

describe('code sections', () => {
  it('stay below 64 KB in total, the longest section is cut', () => {
    const out = limitCode({ player: 'x'.repeat(MAX_CODE * 2), small: 'abc' });
    expect(Object.values(out).join('').length).toBe(MAX_CODE);
    expect(out.small).toBe('abc');
    expect(limitCode({ a: 'ok' })).toEqual({ a: 'ok' });
    expect(limitCode(null)).toEqual({});
  });
});

describe('tracker', () => {
  it('turns the hooks into started / run / completed / failed with attempts, seconds and code', async () => {
    const events = [];
    let t = 0;
    const tracker = createTracker({ record: (e) => events.push(e) }, () => t);
    const ref = { id: 'wi7.adventures-2', hash: 'b'.repeat(64), level: 'r1-2' };
    tracker.start(ref);
    tracker.run({ player: 'nelia.step()' });
    t = 61_400;
    tracker.run({ player: 'for i in range(3):\n    nelia.step()\n' });
    t = 312_000;
    tracker.finish('completed', 870);
    expect(events.map((e) => e.type)).toEqual(['started', 'run', 'run', 'completed']);
    expect(events[2]).toMatchObject({ attempts: 2, seconds: 61, pack: 'wi7.adventures-2', packHash: 'b'.repeat(64), level: 'r1-2' });
    expect(events[3]).toMatchObject({ attempts: 2, seconds: 312, score: 870, code: { player: expect.stringContaining('range') } });
    // again after a failure keeps the clock and the runs of the same level
    tracker.start(ref);
    tracker.finish('failed');
    expect(events[5]).toMatchObject({ type: 'failed', attempts: 2, seconds: 312 });
    // another level starts fresh
    tracker.start({ ...ref, level: 'r1-4' });
    expect(events[6]).toMatchObject({ attempts: 1, seconds: 0, level: 'r1-4' });
    tracker.stop();
    tracker.run({ player: 'x' });
    expect(events).toHaveLength(7);
  });
});

describe('done marks', () => {
  it('remember completed levels of packs per device', () => {
    const s = new FakeStorage();
    expect(loadDone(s)).toEqual({});
    markDone({ id: 'p', level: 'a', hash: 'h' }, s);
    markDone({ id: 'p', level: 'b', hash: 'h' }, s);
    expect(Object.keys(loadDone(s))).toEqual(['p/a', 'p/b']);
  });
});
