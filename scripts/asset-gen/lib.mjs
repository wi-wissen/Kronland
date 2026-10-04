// Shared helpers of the character pipeline (scripts/asset-gen): API access (Meshy, OpenRouter),
// job file per character, credit budget.
//
// Keys: MESHY_API_KEY / OPENROUTER_API_KEY from the environment. If missing, requests are sent without a header
// (e.g. behind a proxy that adds the authentication). Keys are never printed.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const SRC_DIR = path.join(ROOT, 'assets-src/characters');
export const OUT_DIR = path.join(ROOT, 'public/models/characters');
const LEDGER = path.join(ROOT, 'assets-src/credits.json');

/**
 * Node only uses HTTPS_PROXY with NODE_USE_ENV_PROXY=1. If that is missing, the script restarts itself with it.
 * Call at the very top of the script: `if (reexecWithProxy()) process.exit(0)` – blocks until the child process ends.
 */
export function reexecWithProxy() {
  if (!(process.env.HTTPS_PROXY || process.env.https_proxy) || process.env.NODE_USE_ENV_PROXY) return false;
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status ?? 1);
}

// ---------- Meshy ----------

const MESHY = 'https://api.meshy.ai/openapi';

function meshyHeaders(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (process.env.MESHY_API_KEY) h.Authorization = `Bearer ${process.env.MESHY_API_KEY}`;
  return h;
}

/** @param {string} p e.g. 'v1/rigging' @param {any} [body] */
export async function meshy(p, body) {
  const r = await fetch(`${MESHY}/${p}`, {
    method: body ? 'POST' : 'GET', headers: meshyHeaders(!!body), body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Meshy ${p}: ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

export const meshyBalance = async () => (await meshy('v1/balance')).balance;

/**
 * Wait for a Meshy task.
 * @param {string} kind e.g. 'v1/multi-image-to-3d' @param {string} id
 */
export async function meshyWait(kind, id, { every = 10000, label = kind } = {}) {
  for (;;) {
    const t = await meshy(`${kind}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') {
      throw new Error(`${label} ${id}: ${t.status} ${JSON.stringify(t.task_error ?? {})}`);
    }
    process.stdout.write(`\r${label} ${id.slice(0, 8)}… ${t.status} ${t.progress ?? 0}%   `);
    await new Promise((res) => setTimeout(res, every));
  }
}

// ---------- OpenRouter ----------

export async function openrouter(body) {
  const h = { 'Content-Type': 'application/json', 'X-Title': 'Kronland asset-gen' };
  if (process.env.OPENROUTER_API_KEY) h.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: h, body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenRouter: ${r.status} ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

// ---------- Files ----------

export async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download ${r.status}: ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

export function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/** Job file of a character: assets-src/characters/<id>/job.json (task IDs, parameters, results). */
export function loadJob(id) {
  const f = path.join(SRC_DIR, id, 'job.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { id };
}
export function saveJob(job) {
  const f = path.join(SRC_DIR, job.id, 'job.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(job, null, 2) + '\n');
}

// ---------- Budget ----------

/** Credit limit: environment ASSET_CREDIT_LIMIT, otherwise assets-src/credits.json → limit. */
export function creditLedger() {
  const l = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { limit: 400, spent: 0, log: [] };
  if (process.env.ASSET_CREDIT_LIMIT) l.limit = Number(process.env.ASSET_CREDIT_LIMIT);
  return l;
}

/** Before a paid job: aborts if the limit would be exceeded. */
export function spend(estimate, what) {
  const l = creditLedger();
  if (l.spent + estimate > l.limit) {
    throw new Error(`Budget: ${what} (~${estimate} credits) exceeds the limit (${l.spent}/${l.limit}). ` +
      'Raise the limit in assets-src/credits.json or ASSET_CREDIT_LIMIT.');
  }
  l.spent += estimate;
  l.log.push({ what, credits: estimate });
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n');
}
