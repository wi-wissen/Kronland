// Hints: code that is valid Python and runs, but almost never does what was meant – Nelia just stands there and
// nobody knows why. One pass over the syntax tree before the program runs; a hint never stops the program
// (amber note at the line, docs/SKRIPTE.md#hinweise). The vocabulary comes from the game API (api.js hintVocab), so the
// language core stays free of game names; without a vocabulary there are no hints.
//
//   nelia.left()              as a statement: looks, does not turn          → lookOnly (turn_left())
//   nelia.front()             as a statement: the answer is thrown away     → unusedResult
//   nelia.step                without parentheses: nothing happens          → notCalled
//   while nelia.can_step:     a method without parentheses is always true   → alwaysTrue
//   nelia.front() == "Tree"   never true: the answer is "tree"              → unknownAnswer
//   count == count + 1        as a statement: only compares                 → compareStatement
//   nelia.turnleft()          no such method on a known game object         → unknownMethod
// The busy loop (computes for ~5 s without any action) is found while running (host.js).

import { suggest } from './errors.js';

/**
 * @typedef {{ queryFunctions: Set<string>, queryMethods: Set<string>, answers: Record<string, string[]>,
 *   turns: Record<string, string>, objects: Record<string, string[]>, methods: Set<string> }} HintVocab
 * @typedef {{ code: string, params: Record<string, string>, line: number, col: number }} Hint
 */

/** Most hints per program (one mistake copied into a loop should not flood the panel). */
const MAX_HINTS = 20;

/** Child nodes of a syntax node (nested plain objects and arrays included: parameters, keywords, generators). */
function* children(node) {
  for (const [k, v] of Object.entries(node)) {
    if (k === 'type' || k === 'line' || k === 'col' || !v || typeof v !== 'object') continue;
    yield* nodesIn(v);
  }
}
function* nodesIn(v) {
  if (Array.isArray(v)) { for (const x of v) if (x && typeof x === 'object') yield* nodesIn(x); return; }
  if (typeof v.type === 'string') { yield v; return; }
  if (Object.getPrototypeOf(v) !== Object.prototype) return;
  for (const x of Object.values(v)) if (x && typeof x === 'object') yield* nodesIn(x);
}

/** Readable text of an expression for the hint: nelia.left(), count, nelia.step. */
function text(n) {
  if (!n) return '…';
  if (n.type === 'Name') return n.id;
  if (n.type === 'Attribute') return `${text(n.value)}.${n.attr}`;
  if (n.type === 'Call') return `${text(n.func)}()`;
  return '…';
}

/** Names the program binds itself (assignments, loops, functions, parameters, imports) – they hide game names. */
function boundNames(tree) {
  const out = new Set();
  const target = (t) => {
    if (!t) return;
    if (t.type === 'Name') out.add(t.id);
    else if (t.type === 'Tuple' || t.type === 'List') t.elts.forEach(target);
    else if (t.type === 'Starred') target(t.value);
  };
  const walk = (n) => {
    switch (n.type) {
      case 'Assign': n.targets.forEach(target); break;
      case 'AugAssign': target(n.target); break;
      case 'For': target(n.target); break;
      case 'FunctionDef': out.add(n.name); break;
      case 'Import': for (const x of n.names ?? []) out.add(x.asname ?? x.name); break;
      case 'ImportFrom': for (const x of n.names ?? []) out.add(x.asname ?? x.name); break;
      case 'ListComp': case 'DictComp': for (const g of n.generators) target(g.target); break;
      default: break;
    }
    if (n.type === 'FunctionDef' || n.type === 'Lambda') for (const p of n.params ?? []) if (p?.name) out.add(p.name);
    for (const c of children(n)) walk(c);
  };
  walk(tree);
  return out;
}

/**
 * Hints for a parsed program.
 * @param {any} tree Module from parse()
 * @param {HintVocab|null|undefined} vocab
 * @returns {Hint[]}
 */
export function findHints(tree, vocab) {
  if (!vocab || !tree) return [];
  const out = [];
  const bound = boundNames(tree);
  const add = (code, params, node) => { if (out.length < MAX_HINTS) out.push({ code: `script.hint.${code}`, params, line: node.line ?? 0, col: node.col ?? 0 }); };
  const isMethod = (n) => n?.type === 'Attribute' && vocab.methods.has(n.attr);

  /** A figure method used without parentheses in a condition: always true. */
  const checkTest = (n) => {
    if (!n) return;
    if (isMethod(n)) add('alwaysTrue', { name: text(n), call: `${text(n)}()` }, n);
    else if (n.type === 'BoolOp') n.values.forEach(checkTest);
    else if (n.type === 'UnaryOp' && n.op === 'not') checkTest(n.operand);
  };

  /** Possible answers of a sensor or reader call (front(), tile(), weather(), facing), otherwise null. */
  const answersOf = (n) => {
    if (n?.type === 'Call' && n.func.type === 'Attribute') return vocab.answers[n.func.attr] ?? null;
    if (n?.type === 'Call' && n.func.type === 'Name' && !bound.has(n.func.id)) return vocab.answers[n.func.id] ?? null;
    if (n?.type === 'Attribute' && vocab.answers[n.attr] && !vocab.methods.has(n.attr)) return vocab.answers[n.attr];
    return null;
  };
  const strings = (n) => {
    if (n?.type === 'Const' && typeof n.value === 'string') return [n];
    if (n?.type === 'Tuple' || n?.type === 'List') return n.elts.filter((e) => e.type === 'Const' && typeof e.value === 'string');
    return [];
  };
  const checkCompare = (n) => {
    const operands = [n.left, ...n.comparators];
    n.ops.forEach((op, i) => {
      const a = operands[i], b = operands[i + 1];
      const pairs = op === '==' || op === '!=' ? [[a, b], [b, a]] : op === 'in' || op === 'not in' ? [[a, b]] : [];
      for (const [sensor, other] of pairs) {
        const answers = answersOf(sensor);
        if (!answers) continue;
        for (const c of strings(other)) {
          if (answers.includes(c.value)) continue;
          const lower = answers.find((w) => w === c.value.toLowerCase().trim());
          add('unknownAnswer', {
            call: text(sensor), value: c.value.slice(0, 40), suggestion: lower ?? suggest(c.value, answers) ?? '',
            answers: answers.map((w) => `"${w}"`).join(', '),
          }, c);
        }
      }
    });
  };

  /** An expression standing alone as a statement. */
  const checkStatement = (v, st) => {
    if (v.type === 'Call' && v.func.type === 'Attribute' && vocab.queryMethods.has(v.func.attr)) {
      const turn = vocab.turns[v.func.attr];
      if (turn) add('lookOnly', { call: text(v), turn: `${text(v.func.value)}.${turn}()` }, st);
      else add('unusedResult', { call: text(v) }, st);
    } else if (v.type === 'Call' && v.func.type === 'Name' && vocab.queryFunctions.has(v.func.id) && !bound.has(v.func.id)) {
      add('unusedResult', { call: text(v) }, st);
    } else if (isMethod(v)) {
      add('notCalled', { name: text(v), call: `${text(v)}()` }, st);
    } else if (v.type === 'Compare' && v.ops.length === 1 && v.ops[0] === '==' && ['Name', 'Attribute', 'Subscript'].includes(v.left.type)) {
      add('compareStatement', { name: v.left.type === 'Subscript' ? `${text(v.left.value)}[…]` : text(v.left) }, st);
    }
  };

  const visit = (n) => {
    switch (n.type) {
      case 'Const': return;
      case 'Expr': checkStatement(n.value, n); break;
      case 'If': case 'While': case 'IfExp': checkTest(n.test); break;
      case 'Assert': checkTest(n.test); break;
      case 'Compare': checkCompare(n); break;
      case 'ListComp': case 'DictComp': for (const g of n.generators) g.ifs.forEach(checkTest); break;
      case 'Attribute':
        if (n.value.type === 'Name' && Object.hasOwn(vocab.objects, n.value.id) && !bound.has(n.value.id)) {
          const attrs = vocab.objects[n.value.id];
          if (!attrs.includes(n.attr)) add('unknownMethod', { obj: n.value.id, name: n.attr, suggestion: suggest(n.attr, attrs) ?? '' }, n);
        }
        break;
      default: break;
    }
    for (const c of children(n)) visit(c);
  };
  visit(tree);
  // One hint per kind and line
  const seen = new Set();
  return out.filter((h) => { const k = `${h.code}:${h.line}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.line - b.line || a.col - b.col);
}
