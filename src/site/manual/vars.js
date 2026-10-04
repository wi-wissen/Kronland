// Placeholders {{name}} in the manual: numbers and lists taken directly from the game data so the text does not go stale.

import { BALANCE } from '../../sim/data/balance.js';
import { START_RESOURCES } from '../../sim/data/resources.js';
import { BUILDINGS } from '../../sim/data/buildings.js';
import { WORKER } from '../../sim/data/professions.js';
import { HEROES, LINES, UNITS } from '../../sim/data/units.js';
import { COMBAT } from '../../sim/data/combat.js';
import { VISION } from '../../sim/data/vision.js';
import { MARKET } from '../../sim/data/market.js';
import { DAMAGE } from '../../sim/systems/damage.js';
import { CAMPAIGN } from '../../sim/missions/registry.js';
import { t, tr, heroName, has } from '../../i18n/index.js';

const named = (key, fallback, lang) => (has(key) ? t(key, null, lang) : (fallback ?? key));

const levelsOf = (type, key) => BUILDINGS[type]?.levels.map((l) => l[key] ?? 0).join(' / ') ?? '';
const fmt = (n, lang) => Number(n).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB');

/** Acknowledgements from CREDITS.md: headings one level deeper, links to repository files as text. */
export function creditsMarkdown(raw) {
  return String(raw ?? '')
    .replace(/^# .*\n+/m, '')
    .replace(/^(#{2,3}) /gm, '$1# ')
    .replace(/\[([^\]]+)\]\((?!https?:)[^)]+\)/g, '$1');
}

/**
 * All placeholders for one language.
 * @param {'de'|'en'} lang
 * @param {string} [credits] content of CREDITS.md
 */
export function manualVars(lang, credits = '') {
  const tax = BALANCE.tax;
  const taxHead = lang === 'de'
    ? '| Steuersatz | Taler je Arbeiter | Motivation je Zahltag |\n|---|---:|---:|'
    : '| Tax rate | Thalers per worker | Motivation per payday |\n|---|---:|---:|';
  const taxRows = tax.factorsPercent.map((f, i) => {
    const m = tax.motivation[i];
    const gold = (tax.perWorker * f) / 100;
    return `| ${t(`bld.tax.${i}`, null, lang)} | ${fmt(gold, lang)} | ${m > 0 ? '+' : ''}${m} % |`;
  });
  const heroList = Object.entries(HEROES).map(([id, h]) => {
    const abil = Object.entries(h.abilities).map(([a, d]) => `*${named(`ability.${a}`, d.name, lang)}*${has(`adesc.${a}`) ? ` – ${t(`adesc.${a}`, null, lang)}` : ''}`);
    return `- **${heroName(id)}**, ${named(`hero.${id}.title`, h.title, lang)}: ${abil.join('; ')}`;
  }).join('\n');
  return {
    startSerfs: BALANCE.startSerfs,
    startGold: fmt(START_RESOURCES.gold, lang),
    startClay: fmt(START_RESOURCES.clay, lang),
    startWood: fmt(START_RESOURCES.wood, lang),
    startStone: fmt(START_RESOURCES.stone, lang),
    startIron: fmt(START_RESOURCES.iron, lang),
    startSulfur: fmt(START_RESOURCES.sulfur, lang),
    serfCost: BALANCE.serf.cost.gold,
    maxBuilders: BALANCE.serf.maxBuildersPerSite,
    maxSlope: BALANCE.maxSlope,
    paydaySec: BALANCE.paydayTicks / 10,
    wage: BALANCE.wagePerLeader,
    popLevels: levelsOf('villageCenter', 'population'),
    residenceBeds: levelsOf('residence', 'beds'),
    farmSeats: levelsOf('farm', 'seats'),
    startMotivation: WORKER.startMotivation,
    baseMaxMotivation: WORKER.baseMaxMotivation,
    hardMaxMotivation: WORKER.hardMaxMotivation,
    noNewSettlers: WORKER.noNewSettlersBelow,
    leaveBelow: WORKER.leaveBelow,
    reviveSec: COMBAT.heroReviveTicks / 10,
    startReveal: VISION.startReveal,
    marketStep: MARKET.step,
    burnBelow: DAMAGE.burnBelowPercent,
    lineCount: Object.keys(LINES).length,
    taxTable: [taxHead, ...taxRows].join('\n'),
    heroList,
    heroNames: Object.entries(HEROES).map(([id, h]) => `${heroName(id)} (${named(`hero.${id}.title`, h.title, lang)})`).join(', '),
    campaignCount: CAMPAIGN.length,
    // Population slots per class (level 1), e.g. "Schwertkämpfer 1, Reiterei 2 …"
    popByLine: [...new Set(Object.values(UNITS).map((u) => u.line))].map((ln) => {
      const u = Object.values(UNITS).filter((x) => x.line === ln).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))[0];
      return `${named(`line.${ln}`, LINES[ln]?.name ?? ln, lang)} ${u.pop ?? 1}`;
    }).join(', '),
    campaignList: CAMPAIGN.map((m, i) => `${i + 1}. **${tr(m.title, lang)}**`).join('\n'),
    credits: creditsMarkdown(credits),
  };
}
