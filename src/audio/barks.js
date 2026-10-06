// Short barks of the figures on selecting and on commands (voiced, see docs/AUDIO.md#stimmen).
// A few variants per role and occasion, bilingual. Serfs are not always enthusiastic – a
// wink, never refusal. Roles and voices: assets-src/voices/cast.json.
//
// Occasions: select (selected), move (sent off), build (construction site), gather (harvest resource),
// attack (attack), alarm (alarm call when the figure or the settlement is attacked), grumble (alternative to move/build/gather when the same figure gets
// several commands in quick succession).
//
// How often anything is spoken is governed by BARK_RULES (setting "Sprüche der Figuren"): mostly it stays silent,
// never two barks on top of each other, a quiet pause after every bark, no sentence twice in a row.
// One action = selecting and sending around the same figure in quick succession: at most one bark for it,
// and only on the first occasion (with "Selten"); whoever is sent back and forth says nothing any more.

const t = (de, en) => ({ de, en });

export const BARKS = {
  serf: {
    attack: [t('Na warte!', 'Just you wait!'), t('Dir zeig ich’s!', 'I’ll show you!')],
    alarm: [t('Hilfe! Wir werden angegriffen!', 'Help! We are under attack!'), t('Feinde im Dorf!', 'Enemies in the village!')],
    select: [t('Ja, Herr?', 'Yes, my lord?'), t('Was gibt’s?', 'What is it?'), t('Hm?', 'Hm?'), t('Zur Stelle.', 'At your service.')],
    move: [t('Ich geh ja schon.', 'I’m going, I’m going.'), t('Na gut.', 'Very well.'), t('Wird gemacht.', 'It shall be done.'), t('Bin unterwegs.', 'On my way.')],
    build: [t('Dann bau ich halt.', 'Building it is, then.'), t('Hammer und Nägel her.', 'Fetch the hammer and nails.'), t('Steht bald.', 'It’ll stand soon.')],
    gather: [t('Schon wieder schleppen …', 'Hauling again …'), t('Mein Rücken …', 'My poor back …')],
    grumble: [t('Immer ich …', 'Always me …'), t('Und wer bestellt mein Feld?', 'And who tends my field?'), t('Ja, ja, ja.', 'Aye, aye, aye.')],
  },
  serfF: {
    attack: [t('Pass bloß auf!', 'You watch yourself!'), t('Na komm schon!', 'Come on, then!')],
    alarm: [t('Hilfe! Man greift uns an!', 'Help! They are attacking us!'), t('Feinde! Schnell, Hilfe!', 'Enemies! Quick, help!')],
    select: [t('Ja, Herr?', 'Yes, my lord?'), t('Ich hör.', 'I’m listening.'), t('Was soll’s sein?', 'What shall it be?')],
    move: [t('Bin schon weg.', 'Already gone.'), t('Na schön.', 'Very well.'), t('Wird erledigt.', 'It shall be done.')],
    build: [t('Dann eben bauen.', 'Building, then.'), t('Mach ich.', 'I’ll see to it.')],
    gather: [t('Ich hol’s ja.', 'I’ll fetch it.'), t('Schwer genug ist’s.', 'Heavy enough, it is.')],
    grumble: [t('Schon wieder?', 'Again?'), t('Als hätt ich sonst nichts zu tun.', 'As if I’d naught else to do.'), t('Hmpf.', 'Hmph.')],
  },
  sword: {
    alarm: [t('Feindkontakt!', 'Enemy contact!'), t('Wir werden angegriffen!', 'We are under attack!')],
    select: [t('Schwerter bereit.', 'Swords ready.'), t('Euer Befehl?', 'Your command?')],
    move: [t('Zu Befehl!', 'At once!'), t('Wir rücken vor.', 'We advance.'), t('Mir nach!', 'Follow me!')],
    attack: [t('Drauf!', 'At them!'), t('Schilde hoch, vorwärts!', 'Shields up, forward!'), t('Für die Krone!', 'For the crown!')],
  },
  spear: {
    alarm: [t('Wir werden angegriffen!', 'We are under attack!')],
    select: [t('Speere bereit.', 'Spears ready.'), t('Wir halten stand.', 'We stand fast.')],
    move: [t('Jawohl.', 'Aye.'), t('In Reihe, marsch!', 'Form ranks, march!')],
    attack: [t('Speere vor!', 'Spears forward!'), t('Haltet die Reihe!', 'Hold the line!')],
  },
  bow: {
    alarm: [t('Wir werden angegriffen!', 'We are under attack!')],
    select: [t('Bogen gespannt.', 'Bows strung.'), t('Wir haben ein Auge drauf.', 'We’re watching.')],
    move: [t('Neue Stellung.', 'New position.'), t('Wir ziehen weiter.', 'Moving on.')],
    attack: [t('Pfeile los!', 'Loose!'), t('Zielt gut!', 'Aim true!'), t('Schießt!', 'Shoot!')],
  },
  cavalry: {
    alarm: [t('Wir werden angegriffen!', 'We are under attack!')],
    select: [t('Pferde gesattelt.', 'Horses saddled.'), t('Reiter bereit.', 'Riders ready.')],
    move: [t('Aufsitzen!', 'Mount up!'), t('Im Galopp!', 'At the gallop!')],
    attack: [t('Angriff!', 'Charge!'), t('Reitet sie nieder!', 'Ride them down!')],
  },
  cannon: {
    alarm: [t('Wir werden angegriffen!', 'We are under attack!')],
    select: [t('Das Pulver ist trocken.', 'The powder’s dry.'), t('Geschütz bereit.', 'Gun ready.')],
    move: [t('Zieht, Leute, zieht!', 'Heave, lads, heave!'), t('Das Ding ist schwer …', 'This beast is heavy …')],
    attack: [t('Feuer!', 'Fire!'), t('Ohren zu!', 'Cover your ears!')],
  },
  nelia: {
    alarm: [t('Ich werde angegriffen!', 'I am under attack!')],
    select: [t('Ich bin hier.', 'I’m here.'), t('Was nun?', 'What now?')],
    move: [t('Hier entlang!', 'This way!'), t('Ich geh voran.', 'I’ll lead.')],
    attack: [t('Jetzt oder nie!', 'Now or never!'), t('Für die Leute daheim!', 'For our folk at home!')],
  },
  orrin: {
    alarm: [t('Hilfe, man will mir ans Leder!', 'Help, they are after my hide!')],
    select: [t('Meine Prinzessin?', 'My princess?'), t('Ein gutes Geschäft in Sicht?', 'A good bargain in sight?')],
    move: [t('Bei allen Märkten, meine Füße!', 'By all the markets, my feet!'), t('Wenn’s denn sein muss.', 'If it must be.')],
    attack: [t('Ich bin Händler, kein Krieger!', 'I’m a merchant, not a warrior!'), t('Das kostet extra!', 'That costs extra!')],
  },
  taran: {
    alarm: [t('Angriff! Ich halte sie auf!', 'Attack! I will hold them off!')],
    select: [t('Hauptmann Taran.', 'Captain Taran.'), t('Sprecht.', 'Speak.')],
    move: [t('Vorwärts.', 'Forward.'), t('Ich übernehme das.', 'I’ll see to it.')],
    attack: [t('Formation halten!', 'Hold formation!'), t('Zeigt, was ihr könnt!', 'Show them your mettle!')],
  },
};

/**
 * Frequency per setting: probability to speak per occasion, quiet after a bark (s, from the
 * end of the recording). followUp: whether a figure may still speak on further occasions of the same action (within
 * TOUCH_WINDOW seconds after the last) – with "Oft" yes, then from grumbleAfter occasions on
 * with grumbling. Model: city builders mostly keep the figures silent, otherwise the barks get annoying.
 */
export const BARK_RULES = {
  off: null,
  rare: { select: 0.2, order: 0.3, attack: 0.5, hero: 0.5, rest: 8, followUp: false, grumbleAfter: Infinity },
  often: { select: 0.7, order: 0.8, attack: 1, hero: 0.9, rest: 2.5, followUp: true, grumbleAfter: 3 },
};
export const BARK_MODES = /** @type {const} */ (['off', 'rare', 'often']);
/** Seconds without select/command after which a figure counts as "newly addressed" again */
const TOUCH_WINDOW = 12;

/**
 * Decides whether and what is spoken (without Web Audio, time in seconds – testable).
 */
export class BarkGate {
  constructor() {
    /** until when nothing new is spoken (running recording + quiet) */
    this.busyUntil = -Infinity;
    /** last sentence spoken per role */
    this.lastLine = new Map();
    /** Occasions (selection, command) per figure: count of the running action and time of the last */
    this.touches = new Map();
  }

  /**
   * Record a selection or command for a figure. If the last occasion is less than TOUCH_WINDOW seconds
   * ago, it belongs to the same action. @returns {number} which occasion of the action this is (1 = new)
   */
  touch(id, now) {
    const t = this.touches.get(id);
    const n = t && now - t.last < TOUCH_WINDOW ? t.n + 1 : 1;
    this.touches.set(id, { n, last: now });
    if (this.touches.size > 200) for (const [k, v] of this.touches) if (now - v.last > TOUCH_WINDOW) this.touches.delete(k);
    return n;
  }

  /**
   * Bark for an occasion or null (silence).
   * @param {{ mode: string, role: string, event: string, hero?: boolean, nth?: number, now: number, rnd: () => number, busy?: boolean }} o
   *   nth: which occasion of the running action (touch)
   */
  choose({ mode, role, event, hero = false, nth = 1, now, rnd, busy = false }) {
    const rules = mode in BARK_RULES ? BARK_RULES[mode] : BARK_RULES.rare;
    const set = BARKS[role];
    if (!rules || !set || busy || now < this.busyUntil) return null;
    if (nth > 1 && !rules.followUp) return null;
    const p = hero ? rules.hero : event === 'select' ? rules.select : event === 'attack' ? rules.attack : rules.order;
    if (rnd() >= p) return null;
    const line = chooseBark(set, event, rnd, event !== 'select' && nth >= rules.grumbleAfter, this.lastLine.get(role));
    if (line) this.lastLine.set(role, line);
    return line;
  }

  /** Recording runs from now for dur seconds; then quiet according to the setting. */
  spoke(now, dur, mode) {
    /** until when the recording itself runs (without quiet) – alarm calls only wait for this */
    this.playingUntil = now + dur;
    this.busyUntil = now + dur + ((mode in BARK_RULES ? BARK_RULES[mode]?.rest : null) ?? BARK_RULES.rare.rest);
  }
}

/**
 * Which speaking role does a figure have? Serfs speak to match their look (variant from the
 * figure manifest, field `voice`), squads by type, heroes by name.
 * @param {any} e entity @param {string|undefined} line squad type @param {(e:any) => string|null} [serfVoice]
 */
export function barkRole(e, line, serfVoice) {
  if (e.kind === 'hero') return BARKS[e.hero] ? e.hero : null;
  if (e.kind === 'unit') return e.militia ? 'spear' : serfVoice?.(e) ?? 'serf';
  if (e.kind === 'leader') return { sword: 'sword', spear: 'spear', bow: 'bow', lightCav: 'cavalry', heavyCav: 'cavalry', cannon: 'cannon' }[line] ?? 'sword';
  return null;
}

/**
 * Choose a bark. If a sentence is missing for the occasion, move (serfs) or select applies; serfs sent around
 * in quick succession sometimes grumble (grumble). The last sentence said does not come again directly.
 * @param {Record<string, {de:string,en:string}[]>|undefined} set @param {string} event @param {() => number} rnd
 * @param {boolean} [again] the same figure has just received several commands
 * @param {{de:string,en:string}} [last] last sentence said by this role
 */
export function chooseBark(set, event, rnd, again = false, last = undefined) {
  if (!set) return null;
  let list = set[event] ?? (event === 'select' || event === 'alarm' ? null : set.move) ?? null;
  if (again && set.grumble && event !== 'select' && rnd() < 0.5) list = set.grumble;
  if (!list?.length) return null;
  const pool = list.length > 1 && last ? list.filter((l) => l !== last) : list;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

/** Minimum gap between two alarm calls (seconds), so a long fight does not call constantly */
export const ALARM_REST = 20;
/** Gap of the alarm call after the bell (s); if a bark is still running, the call waits at most ALARM_WAIT s */
export const ALARM_DELAY = 0.8, ALARM_WAIT = 5;

/**
 * Notices (Engine.attackToast) for which an alarm call is spoken. Other notices (hero fallen,
 * building burning/destroyed, objective met) have no voice line, only an effect (GameAudio.onEvents).
 * Per notice the kind of figures hit, for which an alarm call with recording (de + en) must exist.
 */
export const ALARM_TOASTS = {
  'toast.attackBuilding': ['building'],
  'toast.attackSettlers': ['worker', 'unit'],
  'toast.attackTroops': ['leader', 'soldier', 'hero'],
};

/** Squad type → speaking role */
const LINE_ROLE = { sword: 'sword', spear: 'spear', bow: 'bow', lightCav: 'cavalry', heavyCav: 'cavalry', cannon: 'cannon' };

/**
 * Who calls when something of the player's own is attacked: the figure hit itself (hero, squad, serf,
 * worker with serf sentences); for buildings a serf calls for the village.
 * @param {any} target @param {string|undefined} line squad type @param {(e:any) => string|null} [serfVoice]
 */
export function alarmRole(target, line, serfVoice) {
  if (target.kind === 'building') return 'serf';
  // Workers and militia (armed serfs) call with the serf voice of their sex
  // (serf/serfF, see GameAudio.voiceOf and alarmVoiceOf)
  if (target.kind === 'worker' || target.kind === 'unit') return serfVoice?.(target) ?? 'serf';
  // Soldiers of a group call like their captain (before: no role → silent, although squads are reported)
  if (target.kind === 'soldier') return LINE_ROLE[line] ?? 'sword';
  return barkRole(target, line, serfVoice);
}

/**
 * Who calls with which voice, in order of choice: first the figure hit, otherwise (no
 * sentences or no recording in this voice) a substitute – serf for civilians, swordsman for
 * squads and heroes without their own alarm calls.
 * @param {any} target @param {string|undefined} line @param {(e:any) => string} voiceOf voice of a figure
 * @returns {{ role: string, voice: string }[]}
 */
export function alarmVoices(target, line, voiceOf) {
  const civil = target.kind === 'building' || target.kind === 'worker' || target.kind === 'unit';
  const out = [];
  const role = alarmRole(target, line, civil ? voiceOf : undefined);
  if (role && BARKS[role]) out.push({ role, voice: target.kind === 'building' ? 'serf' : voiceOf(target) });
  out.push(civil ? { role: 'serf', voice: 'serf' } : { role: 'sword', voice: 'sword' });
  return out;
}
