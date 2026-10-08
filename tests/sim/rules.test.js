// Determinism rule (CLAUDE.md, docs/ARCHITEKTUR.md): simulation, computer opponent and script VM use only
// operations that every browser engine rounds the same way. Math.hypot, Math.pow, sin/cos/exp/log and
// friends are only "implementation-approximated" by the spec, so two clients in lockstep could disagree.
// Allowed: + − * / and Math.sqrt (exactly rounded per IEEE 754), `** 2`, BigInt powers.
// A line may opt out with the marker `rules-ok:` and a reason.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const DIRS = ['src/sim', 'src/ai', 'src/script'];
const FORBIDDEN = [
  [/\bMath\.(hypot|pow|sin|cos|tan|asin|acos|atan2?|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|cbrt|fround|random)\b/, 'Math function without exact rounding (or Math.random)'],
  [/\bDate\b|\bperformance\.now\b/, 'wall clock'],
  [/\blocaleCompare\b|\btoLocale\w*|\bIntl\./, 'locale-dependent comparison or formatting'],
  [/\*\*(?!\s*2(?![\d.]))/, 'exponent other than ** 2 (use x * x, isqrt or a BigInt power)'],
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (name.endsWith('.js')) yield p;
  }
}

/** Source without comments and string contents (line structure kept). */
export function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""').replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('determinism rule', () => {
  it('strips comments and strings before checking', () => {
    const out = codeOnly("const a = '**'; // Math.pow\n/* Math.hypot */ x ** 3");
    expect(out).not.toMatch(/Math|'\*\*'/);
    expect(out.split('\n')[1].trim()).toBe('x ** 3');
  });

  it('src/sim, src/ai and src/script use only exactly rounded operations', () => {
    const hits = [];
    for (const dir of DIRS) {
      for (const file of files(join(ROOT, dir))) {
        const src = readFileSync(file, 'utf8');
        const raw = src.split('\n');
        codeOnly(src).split('\n').forEach((line, i) => {
          if (raw[i].includes('rules-ok:')) return;
          for (const [re, why] of FORBIDDEN) if (re.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1} ${why}: ${raw[i].trim()}`);
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
