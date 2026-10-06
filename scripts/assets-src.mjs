// Raw files of the asset pipeline (assets-src/), kept outside Git: concept images, drafts, comparison images,
// voice samples, plus their text files (spec.json, job.json, prompts, casting …). The index
// assets-src/ARCHIVE.json lists path, size, SHA-256 and part archive of each raw file; the part archives
// (one .tar per folder) can be backed up at a storage location, e.g. as attachments of a release.
// Background and workflow: docs/ROHDATEIEN.md.
//
//   node scripts/assets-src.mjs status                 # what is missing, what is new or changed
//   node scripts/assets-src.mjs fetch [part …]         # download part archives from the storage location, verify, unpack
//   node scripts/assets-src.mjs pack [--out <folder>]  # rewrite ARCHIVE.json, build part archives for upload
//   node scripts/assets-src.mjs pack --index-only # only ARCHIVE.json (without archives)
//
// Parts: buildings, characters, voices, … (first folder under assets-src/). Without argument: all.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'assets-src';
const INDEX = path.join(ROOT, 'ARCHIVE.json');
/** Raw files: images and audio. Everything else (json, md, txt) stays in Git. */
export const RAW = /\.(png|jpe?g|webp|gif|mp3|wav|ogg|flac|psd|kra)$/i;
/** Intermediate results that only exist locally and can be regenerated at any time (not in the archive, see .gitignore). */
export const LOCAL_ONLY = /(^|\/)(view-[^/]*\.png|source\.png)$|^voices\/audition\/|^music\/raw\//;
const isRaw = (f) => RAW.test(f) && !LOCAL_ONLY.test(f);

/** Part archive of a file: first folder under assets-src/ (files directly in it: "general"). */
export const partOf = (rel) => (rel.includes('/') ? rel.split('/')[0] : 'general');

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else if (e.isFile()) out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readIndex = () => (fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : { source: null, files: {} });
const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;

/** Comparison index ↔ disk. */
function status(index = readIndex()) {
  const local = new Set(walk(ROOT).filter(isRaw));
  const missing = [], changed = [], added = [];
  for (const [f, e] of Object.entries(index.files)) {
    if (!local.has(f)) missing.push(f);
    else if (fs.statSync(path.join(ROOT, f)).size !== e.size || sha256(path.join(ROOT, f)) !== e.sha256) changed.push(f);
  }
  for (const f of local) if (!index.files[f]) added.push(f);
  return { missing, changed, added };
}

function cmdStatus() {
  const index = readIndex();
  const { missing, changed, added } = status(index);
  const total = Object.values(index.files).reduce((s, e) => s + e.size, 0);
  console.log(`Index: ${Object.keys(index.files).length} raw files, ${mb(total)}; storage location: ${index.source ?? '(none yet – see docs/ROHDATEIEN.md)'}`);
  const parts = {};
  for (const [f, e] of Object.entries(index.files)) { const p = (parts[e.part] ??= { n: 0, size: 0, missing: 0 }); p.n++; p.size += e.size; }
  for (const f of missing) parts[index.files[f].part].missing++;
  for (const [p, v] of Object.entries(parts).sort()) console.log(`  ${p.padEnd(12)} ${String(v.n).padStart(4)} files ${mb(v.size).padStart(9)}${v.missing ? `  – ${v.missing} missing here (fetch ${p})` : ''}`);
  if (changed.length) console.log(`Changed (do not forget pack): ${changed.length}\n  ${changed.slice(0, 20).join('\n  ')}`);
  if (added.length) console.log(`New, not yet in the index (pack): ${added.length}\n  ${added.slice(0, 20).join('\n  ')}`);
}

/** Rewrite the index and build one .tar per part. */
function cmdPack(args) {
  const out = args[args.indexOf('--out') + 1] && args.includes('--out') ? args[args.indexOf('--out') + 1] : 'assets-src-archive';
  const old = readIndex();
  const files = {};
  for (const f of walk(ROOT).filter(isRaw)) {
    const p = path.join(ROOT, f);
    files[f] = { size: fs.statSync(p).size, sha256: sha256(p), part: partOf(f) };
  }
  // missing files (part not loaded) stay in the index – otherwise their entry would be lost
  for (const [f, e] of Object.entries(old.files)) if (!files[f] && !fs.existsSync(path.join(ROOT, f))) files[f] = e;
  const byPart = {};
  if (args.includes('--index-only')) return writeIndex(old, files);
  fs.mkdirSync(out, { recursive: true });
  for (const [f, e] of Object.entries(files)) if (fs.existsSync(path.join(ROOT, f))) (byPart[e.part] ??= []).push(f);
  for (const [part, list] of Object.entries(byPart)) {
    const tar = path.join(out, `${part}.tar`);
    const listFile = path.join(out, `${part}.list`);
    fs.writeFileSync(listFile, list.join('\n') + '\n');
    execFileSync('tar', ['-cf', tar, '-C', ROOT, '-T', path.resolve(listFile)]);
    fs.rmSync(listFile);
    console.log(`${tar}  ${list.length} files  ${mb(fs.statSync(tar).size)}`);
  }
  writeIndex(old, files);
  console.log(`Upload part archives in ${out}/ (e.g. gh release upload <tag> ${out}/*.tar).`);
}

function writeIndex(old, files) {
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
  fs.writeFileSync(INDEX, JSON.stringify({ $doc: 'Raw files of assets-src/ outside Git (see docs/ROHDATEIEN.md). Do not edit by hand: node scripts/assets-src.mjs pack.', source: old.source ?? null, files: sorted }, null, 1) + '\n');
  console.log(`${INDEX} written (${Object.keys(files).length} raw files).`);
}

/** Check a file against the index. */
function verify(index, f) {
  const e = index.files[f], p = path.join(ROOT, f);
  return fs.existsSync(p) && fs.statSync(p).size === e.size && sha256(p) === e.sha256;
}

async function cmdFetch(args) {
  const index = readIndex();
  if (!index.source) throw new Error('No storage location in assets-src/ARCHIVE.json ("source"). See docs/ROHDATEIEN.md.');
  const parts = args.length ? args : [...new Set(Object.values(index.files).map((e) => e.part))].sort();
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'kronland-'));
  for (const part of parts) {
    const url = index.source.replace(/\/?$/, '/') + `${part}.tar`;
    process.stdout.write(`${part}: ${url} … `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const tar = path.join(tmp, `${part}.tar`);
    fs.writeFileSync(tar, Buffer.from(await res.arrayBuffer()));
    execFileSync('tar', ['-xf', tar, '-C', ROOT]);
    const list = Object.keys(index.files).filter((f) => index.files[f].part === part);
    const bad = list.filter((f) => !verify(index, f));
    console.log(bad.length ? `${bad.length} files missing or differing` : `${list.length} files verified`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

const [cmd, ...rest] = process.argv.slice(2);
const run = { status: cmdStatus, pack: cmdPack, fetch: cmdFetch }[cmd];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!run) { console.log('Usage: node scripts/assets-src.mjs status | fetch [part …] | pack [--out <folder>]'); process.exit(1); }
  if (!fs.existsSync(INDEX)) {
    console.error(`Missing ${INDEX}: the raw files (assets-src/) are not part of the repository, they are kept locally by the maintainer. See docs/ROHDATEIEN.md.`);
    process.exit(1);
  }
  Promise.resolve(run(rest)).catch((e) => { console.error(e.message); process.exit(1); });
}
