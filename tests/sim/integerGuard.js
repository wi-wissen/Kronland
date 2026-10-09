// Test helper: the simulation holds only whole numbers (CLAUDE.md, tests/sim/integers.test.js).

/** Paths of all numbers in a JSON value that are not safe integers (fractions, NaN, Infinity, too large). */
export function nonIntegers(value, path = '$', out = []) {
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) out.push(`${path} = ${value}`); }
  else if (Array.isArray(value)) value.forEach((v, i) => nonIntegers(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) nonIntegers(v, `${path}.${k}`, out);
  return out;
}
