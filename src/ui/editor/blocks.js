// Building blocks ("Bausteine") of the world editor's code tab: typical pieces of a mission as Python code with
// placeholder names. They go in at the caret (codeInsert.js) at the tile last picked on the map (or the middle).
// Code uses English names; the texts for the player come in both languages (de=, en=), comments in the UI language.
// Every block compiles and runs in a test scenario (tests/ui/codeInsert.test.js).

import { uniqueName } from './codeInsert.js';

/**
 * @typedef {{ x: number, y: number, lang: 'de'|'en', codes: string[], hero: string|null, hq: boolean,
 *   width: number, height: number }} BlockCtx
 *   x/y: target tile, codes: all section codes (for unique names), hero: hero of the human player, hq: with castle
 */

const c = (ctx, de, en) => `# ${ctx.lang === 'en' ? en : de}`;
const speaker = (ctx) => ctx.hero ?? 'nelia';

/** Talk figure: npc() at the tile and @on_talk with a short conversation. */
export function talkBlock(ctx) {
  const id = uniqueName('figure', ctx.codes);
  return {
    kind: 'top',
    code: [
      c(ctx, 'Gesprächsfigur: Tippe sie mit einem Helden an, dann läuft on_talk', 'Talk figure: tap it with a hero, then on_talk runs'),
      `${id} = npc("${id}", look="serf", at=(${ctx.x}, ${ctx.y}), de="«Alte Frau»", en="Old woman")`,
      '',
      `@on_talk("${id}")`,
      `def talk_${id}(hero):`,
      `    say("${id}", de="Schön, dass du vorbeikommst!", en="Nice of you to stop by!")`,
      `    say(hero.name, de="Kann ich helfen?", en="Can I help?")`,
    ].join('\n'),
  };
}

/** Objective with a progress pair (current, target): the goal list shows "1/2". */
function objectiveBlock(ctx) {
  const id = uniqueName('goal', ctx.codes);
  return {
    kind: 'top',
    code: [
      c(ctx, 'Ziel mit Fortschritt: lambda liefert (erreicht, Ziel)', 'Objective with progress: lambda returns (reached, target)'),
      '@on_start',
      `def start_${id}():`,
      `    objective("${id}", lambda: (count("residence"), 2),`,
      '              de="Baue 2 Wohnhäuser", en="Build 2 residences")',
      '',
      `@on_objective("${id}")`,
      `def done_${id}(id, status):`,
      `    say("${speaker(ctx)}", de="Geschafft!", en="Done!")`,
    ].join('\n'),
  };
}

/** Attack wave: every 2 minutes bandits come from the tile, at most three times. */
function waveBlock(ctx) {
  const n = uniqueName('waves', ctx.codes);
  const target = ctx.hq ? 'hq()' : ctx.hero ?? `(${ctx.x}, ${ctx.y})`;
  return {
    kind: 'top',
    needs: 'bandits',
    code: [
      c(ctx, 'Angriffswelle: alle 120 Sekunden Räuber, höchstens dreimal', 'Attack wave: bandits every 120 seconds, at most three times'),
      `${n} = 0`,
      '',
      '@every(120)',
      `def attack_${n}():`,
      `    global ${n}`,
      `    if ${n} >= 3:`,
      '        return',
      `    ${n} += 1`,
      `    attackers = spawn(BANDITS, "sword1", (${ctx.x}, ${ctx.y}), count=${n}, soldiers=3)`,
      `    attack(attackers, ${target})`,
    ].join('\n'),
  };
}

/** Dialogue sequence: several lines one after another (in a function: right there, otherwise in @on_start). */
function dialogueBlock(ctx) {
  const who = speaker(ctx);
  return {
    kind: 'stmt',
    wrap: `@on_start\ndef ${uniqueName('dialogue', ctx.codes)}():`,
    code: [
      `say("${who}", de="Was für ein schöner Morgen.", en="What a fine morning.")`,
      `say("${who}", de="Heute bauen wir unser Dorf auf.", en="Today we build our village.")`,
      'wait(1)',
      'message(de="Tipp: Tippe den Helden an und schicke ihn los.", en="Tip: tap the hero and send them off.")',
    ].join('\n'),
  };
}

/** Coin trail: a row of coins from the tile to the east. */
function coinsBlock(ctx) {
  const len = Math.max(1, Math.min(5, ctx.width - ctx.x));
  return {
    kind: 'stmt',
    code: [
      c(ctx, `Talerspur: ${len} Taler nach Osten`, `Coin trail: ${len} coins to the east`),
      `for i in range(${len}):`,
      `    add_item("coin", ${ctx.x} + i, ${ctx.y})`,
    ].join('\n'),
  };
}

/** All blocks in the order of the menu; labels and explanations: editor.block.<id>, editor.blockHint.<id>. */
export const BLOCKS = [
  { id: 'talk', build: talkBlock },
  { id: 'objective', build: objectiveBlock },
  { id: 'wave', build: waveBlock },
  { id: 'dialogue', build: dialogueBlock },
  { id: 'coins', build: coinsBlock },
];

/**
 * Snippet of a block.
 * @param {string} id @param {BlockCtx} ctx
 */
export function buildBlock(id, ctx) {
  const b = BLOCKS.find((x) => x.id === id);
  return b ? b.build(ctx) : null;
}
