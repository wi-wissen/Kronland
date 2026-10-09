// Minimal JSON Schema validator for the contract (contract/schemas/*.json), usable in the browser and in Node.
//
// Why our own: the contract uses a small, fixed subset of JSON Schema. A general validator (Ajv, ~120 KB minified)
// would be far larger than the whole network layer and compiles schemas with `new Function`, which strict
// Content-Security-Policies forbid. This one is ~80 lines.
//
// Supported keywords: type (string or list), enum, const, required, properties, patternProperties,
// additionalProperties (boolean or schema), items, minItems, maxItems, minLength, maxLength, minimum, maximum,
// pattern, anyOf, oneOf, $ref (only "#/$defs/<name>" inside the same schema). Everything else (title, description,
// $schema, $id, format, examples …) is documentation and ignored.

/**
 * @typedef {{ path: string, keyword: string, message: string }} SchemaIssue
 */

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v);
const isType = (v, t) => (t === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeOf(v) === t);
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** JSON pointer segment (RFC 6901) */
const seg = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * Validate `value` against `schema`.
 * @param {any} schema root schema (with optional $defs)
 * @param {any} value
 * @returns {SchemaIssue[]} problems, empty = valid; `path` is a JSON pointer such as "/levels/0/id"
 */
export function validate(schema, value) {
  /** @type {SchemaIssue[]} */
  const out = [];
  const resolve = (s) => {
    if (!s || typeof s.$ref !== 'string') return s;
    const m = /^#\/\$defs\/([\w-]+)$/.exec(s.$ref);
    const target = m && schema.$defs?.[m[1]];
    if (!target) throw new Error(`unsupported $ref ${s.$ref}`);
    return target;
  };
  const walk = (s, v, path, sink) => {
    s = resolve(s);
    if (s === true || s === undefined) return;
    const bad = (keyword, message) => sink.push({ path, keyword, message });
    if (s.type !== undefined) {
      const types = [].concat(s.type);
      if (!types.some((t) => isType(v, t))) { bad('type', `must be ${types.join(' or ')}`); return; }
    }
    if (s.const !== undefined && !deepEqual(s.const, v)) bad('const', `must be ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.some((e) => deepEqual(e, v))) bad('enum', `must be one of ${s.enum.join(', ')}`);
    if (s.anyOf && !s.anyOf.some((sub) => { const t = []; walk(sub, v, path, t); return !t.length; })) bad('anyOf', 'matches none of the allowed shapes');
    if (s.oneOf && s.oneOf.filter((sub) => { const t = []; walk(sub, v, path, t); return !t.length; }).length !== 1) bad('oneOf', 'must match exactly one of the allowed shapes');
    if (typeof v === 'string') {
      if (s.minLength !== undefined && v.length < s.minLength) bad('minLength', `at least ${s.minLength} characters`);
      if (s.maxLength !== undefined && v.length > s.maxLength) bad('maxLength', `at most ${s.maxLength} characters`);
      if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) bad('pattern', `must match ${s.pattern}`);
    }
    if (typeof v === 'number') {
      if (s.minimum !== undefined && v < s.minimum) bad('minimum', `at least ${s.minimum}`);
      if (s.maximum !== undefined && v > s.maximum) bad('maximum', `at most ${s.maximum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) bad('minItems', `at least ${s.minItems} items`);
      if (s.maxItems !== undefined && v.length > s.maxItems) bad('maxItems', `at most ${s.maxItems} items`);
      if (s.items) v.forEach((x, i) => walk(s.items, x, `${path}/${i}`, sink));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k of s.required ?? []) if (!Object.hasOwn(v, k)) sink.push({ path: `${path}/${seg(k)}`, keyword: 'required', message: 'is required' });
      const patterns = Object.entries(s.patternProperties ?? {}).map(([p, sub]) => [new RegExp(p, 'u'), sub]);
      for (const [k, x] of Object.entries(v)) {
        const p = `${path}/${seg(k)}`;
        let known = false;
        if (s.properties && Object.hasOwn(s.properties, k)) { known = true; walk(s.properties[k], x, p, sink); }
        for (const [re, sub] of patterns) if (re.test(k)) { known = true; walk(sub, x, p, sink); }
        if (!known && s.additionalProperties === false) sink.push({ path: p, keyword: 'additionalProperties', message: 'is not allowed' });
        else if (!known && s.additionalProperties && typeof s.additionalProperties === 'object') walk(s.additionalProperties, x, p, sink);
      }
    }
  };
  walk(schema, value, '', out);
  return out;
}

/** First problem as `{ path, detail }` for an error code (`packs.err.schema`). */
export const firstIssue = (issues) => (issues[0] ? { path: issues[0].path || '/', detail: issues[0].message } : null);

/** Validate against one definition of a schema file (`$defs/<name>`), e.g. the save entry. */
export const validateDef = (schema, name, value) => validate({ $defs: schema.$defs, $ref: `#/$defs/${name}` }, value);
