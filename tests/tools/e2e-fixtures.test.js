// Every Playwright spec takes `test` from e2e/fixtures.js (mouse parked off the edge-scroll strip, docs/TESTS.md).

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '../../e2e');
const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.js'));

describe('e2e specs', () => {
  it('import test from the shared fixtures, not from @playwright/test', () => {
    expect(specs.length).toBeGreaterThan(0);
    const wrong = specs.filter((f) => {
      const src = readFileSync(join(dir, f), 'utf8');
      return /from '@playwright\/test'/.test(src) || !/import \{[^}]*\btest\b[^}]*\} from '\.\/fixtures\.js'/.test(src);
    });
    expect(wrong).toEqual([]);
  });
});
