import { describe, it, expect } from 'vitest';
import { reactive, toRaw, effect } from 'vue';
import { sameData, mergeUi } from '../../src/ui/uiMerge.js';

describe('Replace UI state only on change', () => {
  it('sameData compares deeply', () => {
    expect(sameData({ a: [1, { b: 2 }], c: null }, { a: [1, { b: 2 }], c: null })).toBe(true);
    expect(sameData({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
    expect(sameData({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameData([1], { 0: 1 })).toBe(false);
    expect(sameData(new Set([1]), new Set([1]))).toBe(false); // not plain data: counts as changed
    expect(sameData(NaN, NaN)).toBe(true);
  });

  it('triggers an update only for changed keys', () => {
    const ui = reactive({ res: { gold: 1 }, selection: { kind: 'serfs', count: 3 }, tick: 1 });
    let selRuns = 0, resRuns = 0;
    effect(() => { void ui.selection.count; selRuns++; });
    effect(() => { void ui.res.gold; resRuns++; });
    const n = mergeUi(ui, toRaw(ui), { res: { gold: 2 }, selection: { kind: 'serfs', count: 3 }, tick: 2 });
    expect(n).toBe(2);
    expect(ui.res.gold).toBe(2);
    expect(selRuns).toBe(1);
    expect(resRuns).toBe(2);
  });
});
