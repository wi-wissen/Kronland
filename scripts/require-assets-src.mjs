// Guard for the asset pipeline scripts: the raw files (assets-src/) are not part of the repository, the
// maintainer keeps them locally. Without them a script stops with a clear message
// instead of failing with ENOENT somewhere in the middle.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/**
 * Path of assets-src/<parts…>; exits the process with a hint if it does not exist.
 * @param {...string} parts
 */
export function requireAssetsSrc(...parts) {
  const p = path.join(ROOT, 'assets-src', ...parts);
  if (fs.existsSync(p)) return p;
  console.error(`Missing ${path.relative(ROOT, p)}: the raw files of the asset pipeline (assets-src/) are not part of the `
    + 'repository, they are kept locally by the maintainer.');
  process.exit(1);
}
