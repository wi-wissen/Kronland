// Compendium content from the game data. Iterates generically over the data structures (BUILDINGS, UNITS, TECHS, …)
// so that new buildings, units or technologies appear without changes here. Pure functions without DOM –
// tested in tests/site/compendium.test.js.
//
// Result: { sections: Section[] }
//   Section { id, title, icon, intro (Markdown), blocks: Block[], entries: Entry[] }
//   Entry   { id, title, icon, sub, blocks: Block[] }              – subpage with anchor (#b-farm, #u-sword …)
//   Block   { type: 'table', id?, caption?, cols: Col[], rows: Row[] } | { type: 'md', text } | { type: 'facts', items: [label, Cell][] }
//   Col     { label, num? }   Row { id?, cells: Cell[] }
//   Cell    string | number | { t, href?, icon?, cls? } | { cost } | { list: Cell[] }

import { BALANCE } from '../../sim/data/balance.js';
import { BUILDINGS, UPGRADE_REQUIRES, buildingArmor } from '../../sim/data/buildings.js';
import { BUILDING_TECHS } from '../../sim/data/buildingTechs.js';

// Group building technologies directly from BUILDING_TECHS (data order)
const techsOfBuilding = (type) => Object.values(BUILDING_TECHS).filter((x) => x.building === type);
const researchBuildings = () => [...new Set(Object.values(BUILDING_TECHS).map((x) => x.building))];
import { DAMAGE_FACTORS, COMBAT, computeDamage } from '../../sim/data/combat.js';
import { EXPERIENCE, RANK_NAMES } from '../../sim/data/experience.js';
import { MARKET } from '../../sim/data/market.js';
import { PROFESSIONS, BLESSINGS, WORKER, professionFor } from '../../sim/data/professions.js';
import { RESOURCES, RESOURCE_NAMES, START_RESOURCES } from '../../sim/data/resources.js';
import { TECHS, TECH_LINES, researchPoints } from '../../sim/data/technologies.js';
import { UNITS, LINES, HEROES, LINE_UPGRADE_COST, MILITIA, SERF_COMBAT, WORKER_COMBAT, TOWER, fullCost } from '../../sim/data/units.js';
import { VISION, buildingSight } from '../../sim/data/vision.js';
import { WEATHER_CYCLE, WEATHER_CONTROL, WEATHER_NAMES, WEATHER_EFFECTS } from '../../sim/data/weather.js';
import { DAMAGE } from '../../sim/systems/damage.js';
import { createMarket, tradeCost } from '../../sim/systems/market.js';
import { DIFFICULTY, BUILD_PLAN, RESEARCH as AI_RESEARCH, BUILDING_RESEARCH as AI_BUILDING_RESEARCH } from '../../ai/AiPlayer.js';
import { MAP_SIZES, WATER_PERCENT, CLIFF_SLOPE, PEAK_HEIGHT } from '../../sim/mapgen.js';
import { TileMap } from '../../sim/map.js';
import { levelSite, padPreview } from '../../sim/systems/terrain.js';
import { t, has } from '../../i18n/index.js';
import { LABELS, KEYS, INTROS } from './texts.js';

// ---------- Names and formats ----------

/** Text from the game dictionaries, otherwise fallback value (German name from the data). */
const named = (key, fallback, lang) => (has(key) ? t(key, null, lang) : (fallback ?? key));

/** Name functions with a fixed language. */
export function namesFor(lang) {
  return {
    building: (type, lvl = 0) => named(`building.${type}.${lvl}`, BUILDINGS[type]?.levels[lvl]?.name ?? BUILDINGS[type]?.levels[0]?.name ?? type, lang),
    tech: (id) => named(`tech.${id}`, TECHS[id]?.name ?? BUILDING_TECHS[id]?.name, lang),
    techDesc: (id) => named(`tdesc.${id}`, BUILDING_TECHS[id]?.desc ?? '', lang),
    unit: (id) => named(`unit.${id}`, UNITS[id]?.name, lang),
    line: (id) => named(`line.${id}`, LINES[id]?.name ?? id, lang),
    res: (id) => named(`res.${id}`, RESOURCE_NAMES[id] ?? id, lang),
    prof: (id) => named(`prof.${id}`, PROFESSIONS[id]?.name ?? id, lang),
    weather: (id) => named(`weather.${id}`, WEATHER_NAMES[id] ?? id, lang),
    blessing: (id) => named(`blessing.${id}`, BLESSINGS[id]?.name ?? id, lang),
    hero: (id) => HEROES[id]?.name ?? id,
    heroTitle: (id) => named(`hero.${id}.title`, HEROES[id]?.title, lang),
    ability: (id, d) => named(`ability.${id}`, d?.name ?? id, lang),
    abilityDesc: (id) => (has(`adesc.${id}`) ? t(`adesc.${id}`, null, lang) : ''),
    rank: (n) => named(`rank.${n}`, RANK_NAMES[n] ?? String(n), lang),
    rankDesc: (n) => (has(`rdesc.${n}`) ? t(`rdesc.${n}`, null, lang) : ''),
    bdesc: (type) => (has(`bdesc.${type}`) ? t(`bdesc.${type}`, null, lang) : ''),
    techLine: (i) => named(`bld.techLine.${i}`, TECH_LINES[i] ?? String(i), lang),
  };
}

/** Anchor in the compendium. */
export const anchor = {
  building: (type) => `b-${type}`,
  line: (line) => `u-${line}`,
  unit: (id) => `unit-${id}`,
  hero: (id) => `h-${id}`,
  tech: (id) => `t-${id}`,
  res: (id) => `r-${id}`,
  prof: (id) => `p-${id}`,
};

const fill = (s, p) => s.replace(/\{\{?(\w+)\}?\}/g, (m, k) => (p?.[k] !== undefined ? String(p[k]) : m));

/** Missing value (e.g. a field that a new record does not have). */
const NONE = '–';
const num = (v) => typeof v === 'number' && Number.isFinite(v);

function fmtFor(lang) {
  const nf = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 2 });
  // Unknown key (new value in the data, e.g. 'atk.fire'): show the data ID instead of the key
  const L = (k, p) => fill(LABELS[lang]?.[k] ?? LABELS.de[k] ?? String(k).replace(/^[\w]+\./, ''), p);
  const unit = (key, v) => (num(v) ? L(key, { n: nf.format(v) }) : NONE);
  return {
    L,
    n: (v) => (num(v) ? nf.format(v) : (v ?? NONE)),
    s: (sec) => unit('u.s', sec),
    ticks: (tk) => unit('u.s', num(tk) ? tk / 10 : tk),
    tiles: (milli) => unit('u.tiles', num(milli) ? milli / 1000 : milli),
    tilesN: (n) => unit('u.tiles', n),
    speed: (mPerTick) => unit('u.tilesS', num(mPerTick) ? (mPerTick * 10) / 1000 : mPerTick),
    pct: (v) => unit('u.pct', v),
    /** Attack/armour type etc.: label or "–" if the field is missing */
    kind: (prefix, v) => (v == null ? NONE : L(`${prefix}.${v}`)),
    key: (k) => KEYS[lang]?.[k] ?? KEYS.de[k] ?? k,
  };
}

/** Number with sign (true minus). */
const signed = (v, unit = '') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}${unit}`;

const link = (text, href, icon) => ({ t: text, href: `#${href}`, ...(icon ? { icon } : {}) });
const costCell = (c) => ({ cost: c ?? {} });

/** Costs as text (for Markdown and search). */
export function costText(cost, names) {
  const e = Object.entries(cost ?? {}).filter(([, v]) => v);
  return e.length ? e.map(([r, v]) => `${v} ${names.res(r)}`).join(', ') : '–';
}

// ---------- Back references ----------

/** What does a technology unlock? (buildings, upgrades, building technologies) */
function unlocksOf(techId) {
  const out = [];
  for (const [type, def] of Object.entries(BUILDINGS)) if (def.requires === techId) out.push({ kind: 'building', type, level: 0 });
  for (const [type, req] of Object.entries(UPGRADE_REQUIRES)) {
    (req ?? []).forEach((r, lvl) => { if (r === techId && BUILDINGS[type]) out.push({ kind: 'upgrade', type, level: lvl }); });
  }
  for (const bt of Object.values(BUILDING_TECHS)) if (bt.unlocks && bt.id === techId) out.push({ kind: 'building', type: bt.unlocks, level: 0 });
  return out;
}

function unlockCells(techId, names, f) {
  const list = unlocksOf(techId).filter((u) => BUILDINGS[u.type]).map((u) => link(
    u.kind === 'upgrade' ? `${names.building(u.type, u.level)} (${f.L('unlock.upgrade')})` : names.building(u.type, 0),
    anchor.building(u.type),
  ));
  if (techId === 'education') list.push(f.L('unlock.tax'));
  return list.length ? { list } : f.L('none');
}

// ---------- Sections ----------

/** Builder spots that occur, ascending (e.g. "1/4/6/8"). */
function builderList() {
  return [...new Set(Object.values(BUILDINGS).map((d) => d.builders).filter(Number.isInteger))].sort((a, b) => a - b).join('/');
}

function buildingsSection(lang, names, f) {
  const types = Object.keys(BUILDINGS);
  const levelKeys = new Set();
  for (const def of Object.values(BUILDINGS)) for (const l of def.levels) for (const [k, v] of Object.entries(l)) if (typeof v === 'number' && !['buildTime', 'hp'].includes(k)) levelKeys.add(k);
  const extra = [...levelKeys];
  const extraLabel = (k) => ({ beds: lang === 'de' ? 'Betten' : 'Beds', seats: lang === 'de' ? 'Essplätze' : 'Seats', population: lang === 'de' ? 'Bevölkerung' : 'Population', workers: f.L('col.workers') }[k] ?? f.key(k));
  const reqCell = (tech) => {
    if (!tech) return f.L('none');
    if (tech === 'university4') return f.L('univ4');
    return link(names.tech(tech), anchor.tech(tech));
  };
  const placement = (def) => f.L(`place.${def.placement ?? 'free'}`) + (def.shaftResource ? ` (${names.res(def.shaftResource)})` : '');

  const overview = {
    type: 'table', id: 'buildings-table', caption: f.L('sec.buildings'),
    cols: [{ label: f.L('col.name') }, { label: f.L('col.size') }, { label: f.L('col.placement') }, { label: f.L('col.levels'), num: true },
      { label: f.L('col.requires') }, { label: f.L('col.cost') }, { label: f.L('col.buildTime'), num: true }, { label: f.L('col.builders'), num: true }, { label: f.L('col.hp'), num: true }, { label: f.L('col.workers'), num: true }],
    rows: types.map((type) => {
      const d = BUILDINGS[type], l0 = d.levels[0];
      return { id: `row-${type}`, cells: [link(names.building(type, 0), anchor.building(type), `b-${type}`), `${d.w} × ${d.h}`, placement(d), d.levels.length,
        d.buildable === false ? f.L('f.notBuildable') : reqCell(d.requires), costCell(l0.cost), f.s(l0.buildTime), d.builders ?? '–', f.n(l0.hp), l0.workers ?? 0] };
    }),
  };

  const entries = types.map((type) => {
    const d = BUILDINGS[type];
    const prof = professionFor(type);
    const facts = [
      [f.L('f.size'), `${d.w} × ${d.h}`],
      [f.L('f.placement'), placement(d)],
      [f.L('f.builders'), d.builders ?? '–'],
      [f.L('f.armor'), d.levels.map((_, i) => buildingArmor(type, i)).filter((v, i, a) => a.indexOf(v) === i).join(' / ')],
      [f.L('f.requires'), d.buildable === false ? f.L('f.notBuildable') : reqCell(d.requires)],
    ];
    if (prof) facts.push([f.L('f.profession'), link(names.prof(prof), anchor.prof(prof))]);
    if (d.motivationEffect) facts.push([f.L('f.motivationEffect'), `+${d.motivationEffect} %`]);
    const techs = techsOfBuilding(type);
    if (techs.length) facts.push([f.L('f.research'), { list: techs.map((bt) => link(names.tech(bt.id), anchor.tech(bt.id))) }]);
    const trains = Object.values(UNITS).filter((u) => u.building === type);
    const lines = [...new Set(trains.map((u) => u.line))];
    if (lines.length) facts.push([f.L('f.trains'), { list: lines.map((ln) => link(names.line(ln), anchor.line(ln), `u-${ln}`)) }]);

    const usedExtra = extra.filter((k) => d.levels.some((l) => l[k] !== undefined));
    const levelTable = {
      type: 'table',
      cols: [{ label: f.L('col.level'), num: true }, { label: f.L('col.name') }, { label: f.L('col.cost') }, { label: f.L('col.buildUpgradeTime'), num: true },
        { label: f.L('col.hp'), num: true }, ...usedExtra.map((k) => ({ label: extraLabel(k), num: true })), { label: f.L('col.sight'), num: true }, { label: f.L('col.upgradeReq') }],
      rows: d.levels.map((l, i) => ({ cells: [i + 1, names.building(type, i), costCell(l.cost), f.s(l.buildTime), f.n(l.hp),
        ...usedExtra.map((k) => (l[k] ?? '–')), buildingSight(type, i, true), i === 0 ? f.L('none') : reqCell(UPGRADE_REQUIRES[type]?.[i])] })),
    };
    const blocks = [{ type: 'facts', items: facts }, levelTable];
    if (type === 'tower') {
      blocks.push({
        type: 'table', caption: f.L('f.towerAttack'),
        cols: [{ label: f.L('col.level') }, { label: f.L('col.attack'), num: true }, { label: f.L('col.attackType') }, { label: f.L('col.range'), num: true }, { label: f.L('col.cooldown'), num: true }],
        rows: TOWER.map((tw, i) => ({ cells: [names.building(type, i), tw.attack || '–', tw.attack ? f.L(`atk.${tw.attackType}`) : '–', tw.range ? f.tiles(tw.range) : '–', tw.cooldown ? f.ticks(tw.cooldown) : '–'] })),
      });
    }
    return { id: anchor.building(type), title: names.building(type, 0), icon: `b-${type}`, sub: names.bdesc(type), blocks };
  });

  return { id: 'buildings', icon: 'b-residence', blocks: [overview], entries,
    vars: { builderList: builderList(), maxSlope: BALANCE.maxSlope, hqArmor: BUILDINGS.headquarters.levels.map((_, i) => buildingArmor('headquarters', i)).join('/') } };
}

function unitsSection(lang, names, f) {
  // Classes: known lines first, then all others from the units
  const lineIds = [...new Set([...Object.keys(LINES), ...Object.values(UNITS).map((u) => u.line)])];
  const unitRow = (u) => {
    const up = LINE_UPGRADE_COST[`${u.line}${u.tier}`];
    return { id: anchor.unit(u.id), cells: [f.n(u.tier), names.unit(u.id), f.n(u.attack), f.n(u.armor), f.n(u.hp), u.soldierHp || NONE, u.soldiers || NONE,
      f.kind('atk', u.attackType), f.kind('arm', u.armorType), f.tiles(u.range), f.ticks(u.cooldown), f.speed(u.speed), f.n(u.pop),
      costCell(u.leaderCost), u.soldiers ? costCell(u.soldierCost) : NONE, costCell(u.soldierCost ? fullCost(u) : u.leaderCost), up ? costCell(up) : NONE] };
  };
  const cols = [{ label: f.L('col.tier'), num: true }, { label: f.L('col.name') }, { label: f.L('col.attack'), num: true }, { label: f.L('col.armor'), num: true },
    { label: f.L('col.hp'), num: true }, { label: f.L('col.soldierHp'), num: true }, { label: f.L('col.soldiers'), num: true }, { label: f.L('col.attackType') },
    { label: f.L('col.armorType') }, { label: f.L('col.range'), num: true }, { label: f.L('col.cooldown'), num: true }, { label: f.L('col.speed'), num: true },
    { label: f.L('col.pop'), num: true }, { label: f.L('col.leaderCost') }, { label: f.L('col.soldierCost') }, { label: f.L('col.fullCost') }, { label: f.L('col.upgradeCost') }];

  const entries = lineIds.map((ln) => {
    const units = Object.values(UNITS).filter((u) => u.line === ln).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
    const L = LINES[ln] ?? {};
    const b = L.building ?? units[0]?.building;
    const facts = [];
    if (b) facts.push([f.L('f.building'), link(names.building(b), anchor.building(b), `b-${b}`)]);
    if (L.refiner) facts.push([f.L('f.refiner'), link(names.building(L.refiner), anchor.building(L.refiner), `b-${L.refiner}`)]);
    const vis = VISION.fighterExtra[ln];
    if (vis !== undefined) facts.push([f.L('col.sight'), f.tilesN(COMBAT.sight + vis)]);
    return { id: anchor.line(ln), title: names.line(ln), icon: `u-${ln}`, sub: '', blocks: [{ type: 'facts', items: facts }, { type: 'table', cols, rows: units.map(unitRow) }] };
  });

  const armorTypes = [...new Set(Object.values(DAMAGE_FACTORS).flatMap((r) => Object.keys(r)))];
  const factorTable = {
    type: 'table', id: 'damage-factors', caption: lang === 'de' ? 'Schadensfaktoren (Angriffsart × Rüstungsart, %)' : 'Damage factors (attack type × armour type, %)',
    cols: [{ label: f.L('col.attackType') }, ...armorTypes.map((a) => ({ label: f.L(`arm.${a}`), num: true }))],
    rows: Object.entries(DAMAGE_FACTORS).map(([atk, row]) => ({ cells: [f.L(`atk.${atk}`), ...armorTypes.map((a) => {
      const v = row[a] ?? 100;
      return { t: `${v}`, cls: v > 100 ? 'good' : v < 100 ? 'bad' : '' };
    })] })),
  };

  // Who beats whom: damage per hit (without randomness) against the tier-1 representative of each class, a building and a hero
  const defenders = lineIds.map((ln) => Object.values(UNITS).filter((u) => u.line === ln && u.armorType).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))[0]).filter(Boolean);
  const heroArmor = Math.round(Object.values(HEROES).reduce((s, h) => s + h.armor, 0) / Math.max(1, Object.keys(HEROES).length));
  const bArmor = 3;
  const matchup = {
    type: 'table', id: 'matchups',
    caption: lang === 'de' ? 'Schaden je Treffer gegen Stufe-1-Truppen (Hauptmann), ein Gebäude und einen Helden' : 'Damage per hit against tier-1 troops (captain), a building and a hero',
    cols: [{ label: f.L('col.attacker') }, ...defenders.map((d) => ({ label: `${f.L('col.vs')} ${names.line(d.line)}`, num: true })),
      { label: f.L('vs.building', { n: bArmor }), num: true }, { label: f.L('vs.hero'), num: true }],
    rows: Object.values(UNITS).map((u) => {
      // Units without an attack deal no damage
      const hit = (armorType, armor) => (u.attack && u.attackType ? computeDamage(u.attack, u.attackType, armorType, armor ?? 0) : null);
      const vals = [...defenders.map((d) => hit(d.armorType, d.armor)), hit('fortified', bArmor), hit('hero', heroArmor)];
      return { cells: [link(names.unit(u.id), anchor.unit(u.id)), ...vals.map((v) => (v === null ? NONE : { t: String(v), cls: v >= u.attack ? 'good' : v * 2 <= u.attack ? 'bad' : '' }))] };
    }),
  };

  const others = {
    type: 'table', id: 'other-fighters', caption: lang === 'de' ? 'Weitere Kämpfer' : 'Other fighters',
    cols: [{ label: f.L('col.name') }, { label: f.L('col.attack'), num: true }, { label: f.L('col.armor'), num: true }, { label: f.L('col.hp'), num: true },
      { label: f.L('col.attackType') }, { label: f.L('col.armorType') }, { label: f.L('col.range'), num: true }, { label: f.L('col.cooldown'), num: true }],
    rows: [
      [named('army.militia', 'Miliz', lang), MILITIA, BALANCE.serf.hp],
      [named('serfs.title', 'Leibeigene', lang), SERF_COMBAT, BALANCE.serf.hp],
      [named('top.workers', 'Arbeiter', lang), { attack: 0, ...WORKER_COMBAT }, WORKER_COMBAT.hp],
    ].map(([n, d, hp]) => ({ cells: [n, d.attack || '–', d.armor ?? 0, hp, f.kind('atk', d.attackType), f.kind('arm', d.armorType),
      d.range ? f.tiles(d.range) : '–', d.cooldown ? f.ticks(d.cooldown) : '–'] })),
  };

  const combat = constTable(COMBAT, f, 'combat-constants', f.L('cap.combat'));
  return { id: 'units', icon: 'u-sword', blocks: [factorTable, matchup, others, combat], entries,
    vars: { sight: COMBAT.sight, leash: COMBAT.leash, ...weatherVars() } };
}

/** Constants object as a two-column table (key → explanation, value). */
function constTable(obj, f, id, caption) {
  return {
    type: 'table', id, caption,
    cols: [{ label: f.L('col.key') }, { label: f.L('col.value'), num: true }],
    rows: Object.entries(obj).filter(([, v]) => typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string')
      .map(([k, v]) => ({ cells: [f.key(k), typeof v === 'boolean' ? f.L(v ? 'yes' : 'no') : f.n(v)] })),
  };
}

const ABILITY_FMT = {
  cooldown: (v, f) => f.ticks(v), duration: (v, f) => f.ticks(v), fuse: (v, f) => f.ticks(v),
  radius: (v, f) => f.tiles(v), range: (v, f) => f.tiles(v), attackPercent: (v, f) => f.pct(v),
};

function heroesSection(lang, names, f) {
  const entries = Object.entries(HEROES).map(([id, h]) => {
    const facts = [[f.L('f.title'), names.heroTitle(id) ?? NONE], [f.L('col.attack'), f.n(h.attack)], [f.L('col.armor'), f.n(h.armor)], [f.L('col.hp'), f.n(h.hp)],
      [f.L('col.range'), f.tiles(h.range)], [f.L('col.cooldown'), f.ticks(h.cooldown)], [f.L('col.speed'), f.speed(h.speed)], [f.L('col.sight'), f.tilesN(VISION.units.hero)]];
    const abil = {
      type: 'table',
      cols: [{ label: f.L('col.ability') }, { label: f.L('col.description') }, { label: f.L('col.cooldown'), num: true }, { label: f.L('col.params') }],
      rows: Object.entries(h.abilities ?? {}).map(([aid, a]) => ({ cells: [{ t: names.ability(aid, a), icon: `ab-${aid}` }, names.abilityDesc(aid), f.ticks(a.cooldown),
        Object.entries(a).filter(([k, v]) => k !== 'name' && k !== 'cooldown' && typeof v === 'number')
          .map(([k, v]) => `${f.L(`ab.${k}`) === `ab.${k}` ? f.key(k) : f.L(`ab.${k}`)}: ${ABILITY_FMT[k] ? ABILITY_FMT[k](v, f) : f.n(v)}`).join(' · ')] })),
    };
    return { id: anchor.hero(id), title: `${names.hero(id)}`, icon: `hero-${id}`, sub: names.heroTitle(id), blocks: [{ type: 'facts', items: facts }, abil] };
  });
  const hp = Object.values(HEROES)[0]?.hp ?? 0;
  return { id: 'heroes', icon: 'hero-nelia', blocks: [], entries,
    vars: { heroHp: hp, reviveS: COMBAT.heroReviveTicks / 10, reviveR: COMBAT.heroReviveRadius } };
}

function effectText(e, names, f) {
  const who = e.lines?.length ? e.lines.map((l) => names.line(l)).join(', ') : f.L(`target.${e.target}`);
  const parts = [];
  for (const [k, v] of Object.entries(e)) {
    if (k === 'target' || k === 'lines' || typeof v !== 'number') continue;
    const val = k === 'range' ? `+${f.n(v / 1000)}` : (k === 'speed' || k === 'hpPercent') ? `+${v} %` : `+${v}`;
    parts.push(`${f.L(`eff.${k}`)} ${val}`);
  }
  return `${who}: ${parts.join(', ')}`;
}

function techsSection(lang, names, f) {
  const lines = TECH_LINES.map((_, i) => i);
  const tiers = [...new Set(Object.values(TECHS).map((x) => x.tier))].sort((a, b) => a - b);
  const grid = {
    type: 'table', id: 'tech-tree', caption: lang === 'de' ? 'Technologiebaum der Hochschule' : 'College technology tree',
    cols: [{ label: f.L('col.tier'), num: true }, ...lines.map((i) => ({ label: names.techLine(i) }))],
    rows: tiers.map((tier) => ({ cells: [tier, ...lines.map((ln) => {
      const x = Object.values(TECHS).find((tt) => tt.line === ln && tt.tier === tier);
      return x ? link(names.tech(x.id), anchor.tech(x.id)) : '–';
    })] })),
  };
  const all = {
    type: 'table', id: 'techs-table', caption: lang === 'de' ? 'Hochschul-Technologien' : 'College technologies',
    cols: [{ label: f.L('col.name') }, { label: f.L('col.line') }, { label: f.L('col.tier'), num: true }, { label: f.L('col.cost') }, { label: f.L('col.time'), num: true },
      { label: f.L('col.points'), num: true }, { label: f.L('col.requires') }, { label: f.L('col.unlocks') }],
    rows: Object.values(TECHS).map((x) => {
      const req = [];
      if (x.prev) req.push(link(names.tech(x.prev), anchor.tech(x.prev)));
      if (x.tier >= 2) req.push(f.L(`tierReq.${Math.min(4, x.tier)}`));
      return { id: anchor.tech(x.id), cells: [names.tech(x.id), names.techLine(x.line), x.tier, costCell(x.cost), f.s(x.time), f.n(researchPoints(x.id)),
        req.length ? { list: req } : f.L('none'), unlockCells(x.id, names, f)] };
    }),
  };
  const bt = researchBuildings().map((b) => ({
    type: 'table', id: `bt-${b}`, caption: names.building(b),
    cols: [{ label: f.L('col.name') }, { label: f.L('col.minLevel') }, { label: f.L('col.prev') }, { label: f.L('col.cost') }, { label: f.L('col.time'), num: true },
      { label: f.L('col.effect') }, { label: f.L('col.unlocks') }],
    rows: techsOfBuilding(b).map((x) => ({ id: anchor.tech(x.id), cells: [names.tech(x.id),
      `${names.building(b, x.minLevel)}${x.fortress ? ` + ${f.L('fortress')}` : ''}`,
      x.prev ? link(names.tech(x.prev), anchor.tech(x.prev)) : f.L('none'), costCell(x.cost), f.s(x.time),
      x.effects?.length ? x.effects.map((e) => effectText(e, names, f)).join('; ') : names.techDesc(x.id),
      x.unlocks ? link(names.building(x.unlocks), anchor.building(x.unlocks)) : f.L('none')] })),
  }));
  return { id: 'techs', icon: 'research', blocks: [grid, all, ...bt], entries: [] };
}

function resourcesSection(lang, names, f) {
  const refinerOf = (r) => Object.entries(PROFESSIONS).filter(([, p]) => p.kind === 'refine' && p.res === r);
  const mines = (r) => Object.values(BUILDINGS).filter((d) => d.shaftResource === r);
  const table = {
    type: 'table', id: 'resources-table', caption: f.L('sec.resources'),
    cols: [{ label: f.L('col.resource') }, { label: f.L('col.start'), num: true }, { label: f.L('col.price'), num: true }, { label: f.L('col.source') }, { label: f.L('col.refiner') }],
    rows: RESOURCES.map((r) => {
      const src = [];
      if (r === 'gold') src.push(f.L('src.tax'));
      else if (r === 'wood') src.push(f.L('src.trees'));
      else src.push(f.L('src.serfs'));
      for (const m of mines(r)) src.push(link(names.building(m.id), anchor.building(m.id)));
      const ref = refinerOf(r).map(([pid, p]) => link(`${names.building(p.building)} (×${p.yield})`, anchor.building(p.building)));
      for (const [pid, p] of Object.entries(PROFESSIONS)) if (p.kind === 'gold' && r === 'gold') ref.push(link(`${names.building(p.building)} (${names.prof(pid)})`, anchor.building(p.building)));
      return { id: anchor.res(r), cells: [{ t: names.res(r), icon: r }, f.n(START_RESOURCES[r] ?? 0), MARKET.basePrice[r] ? f.n(MARKET.basePrice[r] / 1000) : '–',
        { list: src }, ref.length ? { list: ref } : f.L('none')] };
    }),
  };
  const profs = {
    type: 'table', id: 'professions', caption: lang === 'de' ? 'Berufe' : 'Professions',
    cols: [{ label: f.L('col.profession') }, { label: f.L('col.building') }, { label: f.L('col.kind') }, { label: f.L('col.cycle'), num: true },
      { label: f.L('col.yield'), num: true }, { label: f.L('col.perMin'), num: true }],
    rows: Object.entries(PROFESSIONS).map(([pid, p]) => {
      const bld = p.building ? link(names.building(p.building), anchor.building(p.building)) : { list: Object.values(BUILDINGS).filter((d) => d.shaftResource).map((d) => link(names.building(d.id), anchor.building(d.id))) };
      const kind = f.L(`kind.${p.kind}`) + (p.res ? ` (${names.res(p.res)})` : '');
      return { id: anchor.prof(pid), cells: [names.prof(pid), bld, kind, f.ticks(p.cycle), p.yield ?? '–', p.yield ? f.n(Math.round((p.yield * 600) / p.cycle * 10) / 10) : '–'] };
    }),
  };
  const bless = {
    type: 'table', id: 'blessings', caption: lang === 'de' ? 'Segnungen der Kapelle' : 'Chapel blessings',
    cols: [{ label: f.L('col.name') }, { label: f.L('col.professions') }, { label: f.L('col.minLevel') }],
    rows: Object.entries(BLESSINGS).map(([id, b]) => ({ cells: [names.blessing(id),
      b.professions ? { list: b.professions.map((p) => link(names.prof(p), anchor.prof(p))) } : (lang === 'de' ? 'alle' : 'all'),
      names.building('chapel', b.minLevel ?? 0)] })),
  };
  const chains = RESOURCES.filter((r) => refinerOf(r).length).map((r) => {
    const [pid, p] = refinerOf(r)[0];
    const m = mines(r).map((d) => names.building(d.id)).join(' / ');
    return `- **${names.res(r)}**: ${r === 'wood' ? f.L('src.trees') : `${f.L('src.serfs')}${m ? `, ${m}` : ''}`} → ${names.building(p.building)} (${names.prof(pid)}) → ${p.yield}× ${names.res(r)}`;
  }).join('\n');
  const serf = constTable(BALANCE.serf, f, 'serf-constants', named('serfs.title', 'Leibeigene', lang));
  return { id: 'resources', icon: 'gold', blocks: [table, { type: 'md', text: chains }, profs, bless, serf], entries: [],
    vars: { fetch: WORKER.fetchAmount, chopYield: BALANCE.serf.chopYield, chopS: BALANCE.serf.chopTicks / 10, mineYield: BALANCE.serf.mineYield,
      mineS: BALANCE.serf.mineTicks / 10, treeWood: BALANCE.tree.wood, pile: BALANCE.pile.amount } };
}

function economySection(lang, names, f) {
  const tax = BALANCE.tax;
  const taxTable = {
    type: 'table', id: 'tax',
    cols: [{ label: f.L('col.taxLevel') }, { label: f.L('col.percent'), num: true }, { label: f.L('col.goldPerWorker'), num: true }, { label: f.L('col.motivation'), num: true }],
    rows: tax.factorsPercent.map((p, i) => ({ cells: [named(`bld.tax.${i}`, String(i), lang) + (i === tax.defaultLevel ? ' *' : ''), f.pct(p),
      f.n((tax.perWorker * p) / 100), signed(tax.motivation[i], ' %')] })),
  };
  const pop = {
    type: 'table', id: 'population', caption: lang === 'de' ? 'Bevölkerung je Dorfzentrum' : 'Population per village centre',
    cols: [{ label: f.L('col.level') }, { label: f.L('col.population'), num: true }],
    rows: Object.values(BUILDINGS).filter((d) => d.levels.some((l) => l.population)).flatMap((d) => d.levels.map((l, i) => ({ cells: [link(names.building(d.id, i), anchor.building(d.id)), l.population ?? 0] }))),
  };
  const ornaments = Object.values(BUILDINGS).filter((d) => d.motivationEffect);
  const orn = { type: 'table', id: 'ornaments', caption: lang === 'de' ? 'Ziergebäude' : 'Ornamental buildings',
    cols: [{ label: f.L('col.building') }, { label: f.L('col.cost') }, { label: f.L('f.motivationEffect'), num: true }],
    rows: ornaments.map((d) => ({ cells: [link(names.building(d.id), anchor.building(d.id), `b-${d.id}`), costCell(d.levels[0].cost), `+${d.motivationEffect} %`] })) };
  return { id: 'economy', icon: 'payday', blocks: [taxTable, pop, orn, constTable(WORKER, f, 'worker-constants', named('top.workers', 'Arbeiter', lang))], entries: [],
    vars: { paydayS: BALANCE.paydayTicks / 10, perWorker: tax.perWorker, wage: BALANCE.wagePerLeader, cycleCost: WORKER.cycleCost, maxStamina: WORKER.maxStamina,
      motCurve: WORKER.motivationCurve.filter(([m]) => m > 0).map(([m, e]) => `${m} % → ${e} %`).join(', ') } };
}

function weatherSection(lang, names, f) {
  let at = 0;
  const cycle = {
    type: 'table', id: 'weather-cycle', caption: lang === 'de' ? 'Wetterzyklus (Standard)' : 'Weather cycle (default)',
    cols: [{ label: f.L('col.order'), num: true }, { label: f.L('col.state') }, { label: f.L('col.duration'), num: true }, { label: f.L('col.startsAt'), num: true }],
    rows: WEATHER_CYCLE.map(([s, d], i) => { const row = { cells: [i + 1, { t: names.weather(s), icon: `weather-${s}` }, f.ticks(d), f.ticks(at)] }; at += d; return row; }),
  };
  const pctDelta = (p) => (num(p) && p !== 100 ? signed(p - 100, ' %') : '0');
  const states = [...new Set([...Object.keys(WEATHER_NAMES), ...Object.keys(WEATHER_EFFECTS), ...WEATHER_CYCLE.map(([st]) => st)])];
  const fx = {
    type: 'table', id: 'weather-effects',
    cols: [{ label: f.L('col.state') }, { label: f.L('col.sight'), num: true }, { label: f.L('col.ranged'), num: true }, { label: f.L('col.speed'), num: true }, { label: f.L('col.water') }],
    rows: states.map((s) => {
      const e = WEATHER_EFFECTS[s] ?? {};
      return { cells: [{ t: names.weather(s), icon: `weather-${s}` }, VISION.weather[s] ? `−${VISION.weather[s]}` : '0',
        pctDelta(e.rangedAttackPercent), pctDelta(e.speedPercent), e.freezesWater ? f.L('water.frozen') : NONE] };
    }),
  };
  const ctl = constTable(WEATHER_CONTROL, f, 'weather-control', `${names.building('weatherTower')} / ${names.building('weatherPlant')}`);
  return { id: 'weather', icon: 'weather-winter', blocks: [cycle, fx, ctl], entries: [], vars: weatherVars() };
}

/** Weather effects as text placeholders (introductions of units and weather). */
function weatherVars() {
  const d = (s, k) => signed((WEATHER_EFFECTS[s]?.[k] ?? 100) - 100, ' %');
  return { rainRanged: d('rain', 'rangedAttackPercent'), winterSpeed: d('winter', 'speedPercent') };
}

function experienceSection(lang, names, f) {
  const E = EXPERIENCE;
  const effects = {
    1: f.pct(E.critPercent), 2: `${f.tiles(E.rangeBonus)}, ${f.tilesN(E.sightBonus)}`, 3: `+${E.regenHp} / ${f.ticks(E.regenTicks)}`,
    4: `+${E.attackBonus}`, 5: `+${E.rangedAttackBonus} / +${E.meleeArmorBonus}`,
  };
  const table = {
    type: 'table', id: 'ranks',
    cols: [{ label: f.L('col.stars'), num: true }, { label: f.L('col.rank') }, { label: f.L('col.hits'), num: true }, { label: f.L('col.effect') }, { label: f.L('col.value') }],
    rows: [0, ...E.thresholds.map((_, i) => i + 1)].map((n) => ({ cells: [n, names.rank(n), n ? E.thresholds[n - 1] : 0, names.rankDesc(n) || f.L('none'), effects[n] ?? '–'] })),
  };
  return { id: 'experience', icon: 'star', blocks: [table, constTable(Object.fromEntries(Object.entries(E).filter(([k]) => k !== 'thresholds')), f, 'xp-constants', f.L('cap.xp'))], entries: [] };
}

function damageSection(lang, names, f) {
  return { id: 'damage', icon: 'fire', blocks: [constTable(DAMAGE, f, 'damage-constants', f.L('cap.damage'))], entries: [],
    vars: { burn: DAMAGE.burnBelowPercent, burnPerS: (DAMAGE.burnHp * 10) / DAMAGE.burnTicks, repair: DAMAGE.repairHpPerTick, ruinS: DAMAGE.ruinTicks / 10 } };
}

function marketSection(lang, names, f) {
  const sim = { market: createMarket() };
  const amounts = [MARKET.step, MARKET.step * 2, MARKET.step * 5, MARKET.maxAmount].filter((v, i, a) => a.indexOf(v) === i);
  const goods = RESOURCES.filter((r) => r !== 'gold');
  const table = {
    type: 'table', id: 'market-prices', caption: lang === 'de' ? 'Handel gegen Taler zu Grundpreisen' : 'Trading against thalers at base prices',
    cols: [{ label: f.L('col.resource') }, { label: f.L('col.price'), num: true }, ...amounts.map((a) => ({ label: f.L('col.buy', { n: a }), num: true })),
      ...amounts.map((a) => ({ label: f.L('col.sell', { n: a }), num: true }))],
    rows: goods.map((r) => {
      const buy = amounts.map((a) => tradeCost(sim, 'gold', r, a));
      // Selling: this much goods it costs to get a Taler
      const sell = amounts.map((a) => tradeCost(sim, r, 'gold', a));
      return { cells: [{ t: names.res(r), icon: r }, f.n(MARKET.basePrice[r] / 1000), ...buy, ...sell] };
    }),
  };
  return { id: 'market', icon: 'market', blocks: [table, constTable(MARKET, f, 'market-constants', f.L('cap.market'))], entries: [],
    vars: { step: MARKET.step, max: MARKET.maxAmount, change: MARKET.changePercent, min: MARKET.minPercent, maxP: MARKET.maxPercent, recoverS: MARKET.recoverTicks / 10, recover: MARKET.recoverPercent } };
}

function visionSection(lang, names, f) {
  const unitLabel = (k) => ({ serf: named('serfs.title', 'Leibeigene', lang), worker: named('top.workers', 'Arbeiter', lang), militia: named('army.militia', 'Miliz', lang),
    hero: named('army.hero', 'Held', lang), turret: named('ability.turret', 'turret', lang), trap: named('ability.trap', 'trap', lang), bomb: named('ability.bomb', 'bomb', lang) }[k] ?? k);
  const figures = {
    type: 'table', id: 'sight-units', caption: lang === 'de' ? 'Figuren' : 'Figures',
    cols: [{ label: f.L('col.source2') }, { label: f.L('col.sight'), num: true }],
    rows: [...Object.entries(VISION.units).map(([k, v]) => ({ cells: [unitLabel(k), v] })),
      ...Object.entries(VISION.fighterExtra).map(([ln, v]) => ({ cells: [link(names.line(ln), anchor.line(ln)), `${COMBAT.sight} + ${v} = ${COMBAT.sight + v}`] }))],
  };
  const maxLv = Math.max(...Object.values(BUILDINGS).map((d) => d.levels.length));
  const blds = {
    type: 'table', id: 'sight-buildings', caption: f.L('sec.buildings'),
    cols: [{ label: f.L('col.building') }, ...Array.from({ length: maxLv }, (_, i) => ({ label: f.L('level', { n: i + 1 }), num: true }))],
    rows: [...Object.keys(BUILDINGS).map((type) => ({ cells: [link(names.building(type), anchor.building(type)),
      ...Array.from({ length: maxLv }, (_, i) => (i < BUILDINGS[type].levels.length ? buildingSight(type, i, true) : '–'))] })),
    { cells: [f.key('site'), VISION.site, ...Array.from({ length: maxLv - 1 }, () => '–')] }],
  };
  const weather = {
    type: 'table', id: 'sight-weather', cols: [{ label: f.L('col.state') }, { label: f.L('col.sight'), num: true }],
    rows: Object.entries(VISION.weather).map(([s, v]) => ({ cells: [names.weather(s), v ? `−${v}` : '0'] })),
  };
  const consts = constTable({ updateTicks: VISION.updateTicks, startReveal: VISION.startReveal, minRadius: VISION.minRadius }, f, 'vision-constants', f.L('cap.vision'));
  return { id: 'vision', icon: 'map', blocks: [figures, blds, weather, consts], entries: [], vars: { minR: VISION.minRadius, sight: COMBAT.sight } };
}

function aiSection(lang, names, f) {
  const diffs = Object.keys(DIFFICULTY);
  const keys = [...new Set(diffs.flatMap((d) => Object.keys(DIFFICULTY[d])))].filter((k) => k !== 'name');
  const fmtVal = (k, v) => {
    if (v === undefined) return '–';
    if (typeof v === 'boolean') return f.L(v ? 'yes' : 'no');
    if (k === 'think') return f.ticks(v);
    if (k === 'firstAttack') return f.L('u.min', { n: f.n(v / 600) });
    return f.n(v);
  };
  const table = {
    type: 'table', id: 'ai-difficulty',
    cols: [{ label: f.L('col.key') }, ...diffs.map((d) => ({ label: f.L(`diff.${d}`), num: true }))],
    rows: keys.map((k) => ({ cells: [f.key(k), ...diffs.map((d) => fmtVal(k, DIFFICULTY[d][k] ?? (typeof DIFFICULTY.hard[k] === 'boolean' ? false : undefined)))] })),
  };
  const plan = {
    type: 'table', id: 'ai-build-plan', caption: f.L('ai.buildPlan'),
    cols: [{ label: f.L('col.order'), num: true }, { label: f.L('col.building') }, { label: f.L('col.count'), num: true }],
    rows: BUILD_PLAN.map(([type, n], i) => ({ cells: [i + 1, link(names.building(type), anchor.building(type)), n] })),
  };
  const research = { type: 'md', text: `**${f.L('ai.research')}:** ${AI_RESEARCH.map((id) => `[${names.tech(id)}](#${anchor.tech(id)})`).join(' → ')}\n\n`
    + `**${f.L('ai.buildingResearch')}:** ${AI_BUILDING_RESEARCH.filter((id) => BUILDING_TECHS[id]).map((id) => `[${names.tech(id)}](#${anchor.tech(id)})`).join(' → ')}` };
  return { id: 'ai', icon: 'attack', blocks: [table, plan, research], entries: [] };
}

function mapgenSection(lang, names, f) {
  const sizes = {
    type: 'table', id: 'map-sizes', cols: [{ label: f.L('map.size') }, { label: f.L('col.value'), num: true }],
    rows: Object.entries(MAP_SIZES).map(([k, v]) => ({ cells: [f.L(`map.${k}`), `${v} × ${v}`] })),
  };
  const consts = constTable({ WATER_PERCENT, CLIFF_SLOPE, PEAK_HEIGHT }, f, 'mapgen-constants', f.L('cap.mapgen'));
  return { id: 'mapgen', icon: 'dice', blocks: [{ type: 'mapPreview' }, sizes, consts], entries: [], vars: { cliff: CLIFF_SLOPE, peak: PEAK_HEIGHT } };
}

/**
 * Building on slopes: rules from BALANCE.maxSlope and a worked example that the simulation function itself levels
 * (levelSite from src/sim/systems/terrain.js on a small example map).
 */
export function slopeExample(type = 'residence') {
  const d = BUILDINGS[type] ?? Object.values(BUILDINGS).find((b) => b.placement === 'free') ?? Object.values(BUILDINGS)[0];
  const W = d.w + 2, H = d.h + 2;
  const map = new TileMap(W, H);
  // uniform ramp whose height difference across the area is ¾ of the allowed
  const step = Math.max(1, Math.floor((BALANCE.maxSlope * 3) / 4 / Math.max(1, d.w - 1 + d.h - 1)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) map.heights[map.idx(x, y)] = 1000 + (x + y) * step;
  const before = Array.from(map.heights);
  const preview = padPreview(map, 1, 1, d.w, d.h);
  levelSite({ map, events: [] }, 1, 1, d.w, d.h);
  return { type: d.id ?? type, w: d.w, h: d.h, W, H, step, before, after: Array.from(map.heights), preview };
}

function slopeSection(lang, names, f) {
  const ex = slopeExample();
  const grid = (vals, id, caption) => ({
    type: 'table', id, caption,
    cols: [{ label: '' }, ...Array.from({ length: ex.W }, (_, x) => ({ label: `x${x}`, num: true }))],
    rows: Array.from({ length: ex.H }, (_, y) => ({ cells: [`y${y}`, ...Array.from({ length: ex.W }, (_, x) => {
      const inside = x >= 1 && x <= ex.w && y >= 1 && y <= ex.h;
      return { t: f.n(vals[y * ex.W + x]), cls: inside ? 'pad' : '' };
    })] })),
  });
  const rules = {
    type: 'table', id: 'slope-rules',
    cols: [{ label: f.L('col.slope') }, { label: f.L('col.preview') }, { label: f.L('col.result') }],
    rows: [
      [`0 cm`, f.L('slope.flat'), f.L('slope.flatR')],
      [`1 … ${BALANCE.maxSlope} cm`, f.L('slope.level'), f.L('slope.levelR')],
      [`> ${BALANCE.maxSlope} cm`, f.L('slope.steep'), f.L('slope.steepR')],
    ].map((cells) => ({ cells })),
  };
  return {
    id: 'slope', icon: 'upgrade',
    blocks: [rules, grid(ex.before, 'slope-before', f.L('slope.before', { b: names.building(ex.type), w: ex.w, h: ex.h })),
      grid(ex.after, 'slope-after', f.L('slope.after', { t: f.n(ex.preview.target) }))],
    entries: [],
    vars: { maxSlope: BALANCE.maxSlope, exSlope: ex.preview.slope, exTarget: f.n(ex.preview.target), exCut: ex.preview.maxCut, exStep: ex.step },
  };
}

const SECTIONS = [buildingsSection, unitsSection, heroesSection, techsSection, resourcesSection, economySection, weatherSection,
  experienceSection, damageSection, marketSection, visionSection, slopeSection, aiSection, mapgenSection];

/**
 * The whole compendium in one language.
 * @param {'de'|'en'} lang
 */
export function compendiumModel(lang = 'de') {
  const names = namesFor(lang);
  const f = fmtFor(lang);
  const sections = SECTIONS.map((make) => {
    const s = make(lang, names, f);
    const intro = fill(INTROS[lang]?.[s.id] ?? INTROS.de[s.id] ?? '', s.vars ?? {});
    return { id: s.id, title: f.L(`sec.${s.id}`), icon: s.icon, intro, blocks: s.blocks, entries: s.entries };
  });
  return { sections, names, costText: (c) => costText(c, names) };
}

/** Text of a cell (for search and tests). */
export function cellText(c, names) {
  if (c == null) return '';
  if (typeof c !== 'object') return String(c);
  if (c.cost) return costText(c.cost, names);
  if (c.list) return c.list.map((x) => cellText(x, names)).join(', ');
  return c.t ?? '';
}
