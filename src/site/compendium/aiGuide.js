// Compendium: how the computer opponents behave – as far as it matters for players.
// Written against src/ai/AiPlayer.js; numbers from DIFFICULTY come in as placeholders {{name}} (generate.js aiSection).
// Fixed thresholds of the AI code (22 tiles, 35 %, 8/9 tiles, 15 minutes) are spelled out here – keep in sync with AiPlayer.js.

/** Percent-encode a Wikipedia title so that the small Markdown converter keeps the link intact ( ) * … */
const enc = (t) => encodeURIComponent(t.replace(/ /g, '_')).replace(/[()*!']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
/** Link to German Wikipedia. */
export const wDe = (title) => `https://de.wikipedia.org/wiki/${enc(title)}`;
/** Link to English Wikipedia. */
export const wEn = (title) => `https://en.wikipedia.org/wiki/${enc(title)}`;

/** Labels of the state diagram (AiStates.vue). */
export const AI_LABELS = {
  de: {
    'ai.gather': 'Sammeln', 'ai.attack': 'Angriff', 'ai.defend': 'Verteidigen',
    'ai.toAttack': 'genug Truppen und Mindestzeit vorbei', 'ai.toGather': 'Stärke unter 35 % oder Ziel weg',
    'ai.toDefend': 'Feinde nahe der Burg (Vorrang)', 'ai.fromDefend': 'Feinde vertrieben',
    'ai.diagram': 'Zustände der KI-Armee: Sammeln, Angriff, Verteidigen',
  },
  en: {
    'ai.gather': 'Gather', 'ai.attack': 'Attack', 'ai.defend': 'Defend',
    'ai.toAttack': 'enough troops and minimum time passed', 'ai.toGather': 'strength below 35 % or target gone',
    'ai.toDefend': 'enemies near the castle (priority)', 'ai.fromDefend': 'enemies driven off',
    'ai.diagram': 'States of the AI army: gather, attack, defend',
  },
};

/** Entries (same ids in both languages, tests check this). */
export const AI_GUIDE = {
  de: {
    'ai-rules': {
      title: 'Gleiche Regeln, gleicher Nebel',
      text: `- **Nur Befehle:** Die KI klickt gewissermaßen wie du. Sie erteilt dieselben Befehle („Gebäude setzen“, „Truppe ausbilden“,
  „Angriff auf Punkt“ …), zahlt dieselben Preise und wird von denselben Regeln gebremst. Abkürzungen gibt es nicht.
- **Nebel:** Sie sieht nur, was ihr Team sieht ([Nebel des Krieges](${wDe('Nebel des Krieges')})). Deine Gebäude kennt sie so, wie sie
  sie zuletzt gesehen hat; bekannt sind ihr – wie dir – nur die Startpositionen. Deine Armee im Nebel bemerkt sie nicht.
- **Reaktionszeit:** Sie denkt nur alle {{thinkEasy}} / {{thinkNormal}} / {{thinkHard}} nach (Leicht / Normal / Schwer).
- **Vorteile nur auf „Schwer“:** Wachen melden Feinde bis 22 Kacheln um ihre Burg auch im Nebel, und alle 2 Minuten bekommt sie
  {{bonusGold}} Taler Zuschuss.
- **Berechenbar:** Sie folgt festen Regeln und Listen und lernt nicht dazu. In derselben Lage entscheidet sie immer gleich
  ([deterministisch](${wDe('Determinismus (Algorithmus)')})) – ein geladener Spielstand läuft also genauso weiter.`,
    },
    'ai-build': {
      title: 'Was die KI baut',
      text: `1. **Dringendes zuerst:** fehlende Betten oder Essplätze (Wohnhaus, Hof), ein Dorfzentrum, wenn die Bevölkerungsgrenze drückt,
   und ein Lager, wenn sich ein Rohstoff staut, während ein anderer fehlt (später wird es zum Marktplatz ausgebaut).
2. **Danach der [Bauplan](#ai-build-plan)** von oben nach unten. Was sie sich noch nicht leisten kann, überspringt sie. Zerstörte Gebäude
   fehlen in ihrer Zählung und werden deshalb wieder aufgebaut. Höchstens {{sitesEasy}} / {{sitesNormal}} / {{sitesHard}} Baustellen gleichzeitig.
3. **Wo:** Minen und Dorfzentren nahe der Burg, Wohnen und Werkstätten wenige Kacheln um die Burg, **Kaserne, Schießplatz, Gießerei
   und Türme rund 9 Kacheln vor der Burg in deiner Richtung.**
4. **Ausbau** in fester Rangfolge: Burg zur Festung (sobald Ziegelei und Hochschule stehen), Hochschule, Dorfzentrum, Wohnhäuser, Höfe …
5. **Leibeigene:** zuerst auf Baustellen, dann zwei Drittel ins Holz und ein Drittel zum knappsten Rohstoff.
6. **Brücke und Zierbauten** erst, wenn Kaserne und mindestens drei Truppen stehen und reichlich Rohstoffe da sind. Die Brücke setzt sie
   in die Nähe der Mitte zwischen ihrer und deiner Burg.`,
    },
    'ai-attack': {
      title: 'Wann und wie sie angreift',
      text: `Die Armee der KI wechselt zwischen drei Zuständen ([endlicher Automat](${wDe('Endlicher Automat')})):

- **Sammeln:** Neue Truppen – reihum Schwert, Bogen, Speer, Schwert, Bogen, Kanone (höchstens drei Kanonen) – warten am Sammelpunkt
  8 Kacheln vor ihrer Burg in deiner Richtung. Für Truppen gibt sie bis etwa {{shareEasy}} / {{shareNormal}} / {{shareHard}} % ihrer
  Taler aus.
- **Angriff,** sobald {{sizeEasy}} / {{sizeNormal}} / {{sizeHard}} Hauptleute bereitstehen **und** die Mindestzeit von
  {{firstEasy}} / {{firstNormal}} / {{firstHard}} vorbei ist. Hat sie die Truppenzahl nicht erreicht, zieht sie 15 Minuten später
  trotzdem los, sobald sie drei Truppen hat. Alle Truppen und Helden marschieren mit „Angriff auf Punkt“ zu deiner Burg und kämpfen
  unterwegs gegen alles, was sie sehen.
- **Rückzug:** Fällt die Stärke der Armee (Angriffswert × Köpfe) unter 35 % des Werts beim Aufbruch, kehrt sie zum Sammelpunkt zurück
  und sammelt neu.
- In Missionen kann sie *passiv* sein (greift nie von selbst an) oder *aggressiv* (erster Angriff nach einem Drittel der Zeit, mit
  zwei Hauptleuten weniger).

Ziel ist nur eine Burg, die ihre Truppen **zu Fuß erreichen** können. Über zugefrorenes Wasser plant sie nie – ohne Furt oder Brücke
bleibt sie auf ihrer Flussseite, bis sie selbst eine Brücke baut.`,
    },
    'ai-defend': {
      title: 'Wie sie sich verteidigt',
      text: `- **Verteidigen hat Vorrang:** Sieht sie Feinde (Truppen oder Helden) bis 22 Kacheln um ihre Burg, schickt sie **alle** Truppen und
  Helden dorthin – auch mitten aus einem Angriff heraus.
- **Miliz:** Ist der Eindringling deutlich stärker als ihre Armee, bewaffnet sie ihre Leibeigenen. Solange die Miliz kämpft, ruht die
  Arbeit. Sind die Feinde fort, legt sie die Waffen wieder ab.
- **Reparatur:** Beschädigte Gebäude (brennende zuerst) lässt sie von Leibeigenen reparieren – aber nicht, solange mehr als zwei Feinde
  in der Nähe sind.
- **Helden** setzen ihre Fähigkeiten ein, sobald sie bereit sind und ein Gegner in der Nähe ist; Bestechen nur mit genug Talern im Rücken.`,
    },
    'ai-counter': {
      title: 'So hältst du dagegen',
      text: `- **Die Uhr kennen:** Vor der Mindestzeit (Tabelle oben) greift sie nicht an – Zeit für Wirtschaft und Forschung.
- **Den Weg kennen:** Sie sammelt vor ihrer Burg in deiner Richtung und marschiert von dort zu deiner Burg. Türme und Truppen auf dieser
  Linie treffen sie zuerst; kämpfe am besten in Reichweite deiner Türme.
- **Rückzug erzwingen:** Ihr Angriff bricht ab, wenn rund zwei Drittel seiner Stärke verloren sind. Fernkämpfer hinter Speerträgern und
  ein Held mit Heilung halten lange genug.
- **Ablenken:** Ein kleiner Trupp, der nahe ihrer Burg gesehen wird, ruft ihre ganze Armee zurück. Auf „Leicht“ und „Normal“ muss sie
  ihn dafür sehen, auf „Schwer“ melden ihn ihre Wachen auch im Nebel.
- **Überraschen:** Deine Armee im Nebel sieht sie nicht. Ein starker Angriff, der erst kurz vor ihrer Burg auftaucht, trifft sie
  unvorbereitet; ist er viel stärker, ruft sie die Miliz und legt damit ihre eigene Wirtschaft still.
- **Wasser nutzen:** Ohne Furt oder Brücke erreicht sie dich nicht. Ihre Brücke baut sie etwa auf halbem Weg zwischen den Burgen – dort
  lässt sich der Übergang gut halten.`,
    },
  },

  en: {
    'ai-rules': {
      title: 'Same rules, same fog',
      text: `- **Commands only:** the AI clicks, so to speak, like you do. It issues the same commands ("place building", "train troop",
  "attack-move" …), pays the same prices and is held back by the same rules. There are no shortcuts.
- **Fog:** it only sees what its team sees ([fog of war](${wEn('Fog of war')})). It knows your buildings as last seen; like you, it only
  knows the start positions. It does not notice your army in the fog.
- **Reaction time:** it only thinks every {{thinkEasy}} / {{thinkNormal}} / {{thinkHard}} (Easy / Normal / Hard).
- **Advantages only on "Hard":** guards report enemies within 22 tiles of its castle even in the fog, and every 2 minutes it receives a
  bonus of {{bonusGold}} thalers.
- **Predictable:** it follows fixed rules and lists and does not learn. In the same situation it always decides the same way
  ([deterministic](${wEn('Deterministic algorithm')})) – a loaded game continues exactly the same.`,
    },
    'ai-build': {
      title: 'What the AI builds',
      text: `1. **Urgent things first:** missing beds or seats (residence, farm), a village centre when the population limit presses, and a
   storehouse when one resource piles up while another is lacking (later upgraded to a marketplace).
2. **Then the [build plan](#ai-build-plan)** from top to bottom. Whatever it cannot afford yet, it skips. Destroyed buildings are missing
   from its count and are therefore rebuilt. At most {{sitesEasy}} / {{sitesNormal}} / {{sitesHard}} building sites at once.
3. **Where:** mines and village centres near the castle, housing and workshops a few tiles around the castle, **barracks, archery range,
   foundry and towers about 9 tiles in front of the castle in your direction.**
4. **Upgrades** in a fixed ranking: castle to fortress (as soon as brickworks and college stand), college, village centre, residences, farms …
5. **Serfs:** building sites first, then two thirds to wood and one third to the scarcest resource.
6. **Bridge and ornaments** only once barracks and at least three troops stand and resources are plentiful. It places the bridge near the
   middle between its castle and yours.`,
    },
    'ai-attack': {
      title: 'When and how it attacks',
      text: `The AI's army switches between three states ([finite-state machine](${wEn('Finite-state machine')})):

- **Gather:** new troops – in turn sword, bow, spear, sword, bow, cannon (at most three cannons) – wait at the rally point 8 tiles in
  front of its castle in your direction. It spends up to about {{shareEasy}} / {{shareNormal}} / {{shareHard}} % of its thalers on troops.
- **Attack** as soon as {{sizeEasy}} / {{sizeNormal}} / {{sizeHard}} captains are ready **and** the minimum time of
  {{firstEasy}} / {{firstNormal}} / {{firstHard}} has passed. If it has not reached the troop count, it sets off 15 minutes later anyway
  once it has three troops. All troops and heroes march to your castle with "attack-move" and fight everything they see on the way.
- **Retreat:** if the army's strength (attack value × heads) drops below 35 % of its value at departure, it returns to the rally point and
  gathers again.
- In missions it can be *passive* (never attacks on its own) or *aggressive* (first attack after a third of the time, with two captains
  fewer).

It only targets a castle its troops can **reach on foot**. It never plans across frozen water – without a ford or bridge it stays on its
side of the river until it builds a bridge itself.`,
    },
    'ai-defend': {
      title: 'How it defends',
      text: `- **Defending has priority:** if it sees enemies (troops or heroes) within 22 tiles of its castle, it sends **all** troops and heroes
  there – even in the middle of an attack.
- **Militia:** if the intruder is clearly stronger than its army, it arms its serfs. While the militia fights, work stops. Once the enemies
  are gone, it lays down arms again.
- **Repairs:** damaged buildings (burning ones first) are repaired by serfs – but not while more than two enemies are nearby.
- **Heroes** use their abilities as soon as they are ready and an opponent is near; bribery only with enough thalers in reserve.`,
    },
    'ai-counter': {
      title: 'How to hold your own',
      text: `- **Know the clock:** before the minimum time (table above) it does not attack – time for economy and research.
- **Know the route:** it gathers in front of its castle in your direction and marches from there to your castle. Towers and troops on
  that line meet it first; ideally fight within range of your towers.
- **Force a retreat:** its attack breaks off once about two thirds of its strength are lost. Ranged troops behind spearmen and a hero
  with healing hold long enough.
- **Distract:** a small squad seen near its castle calls its whole army back. On "Easy" and "Normal" it has to see the squad; on "Hard"
  its guards report it even in the fog.
- **Surprise:** it does not see your army in the fog. A strong attack that only appears close to its castle catches it unprepared; if it
  is much stronger, it calls up the militia and thereby halts its own economy.
- **Use water:** without a ford or bridge it cannot reach you. It builds its bridge roughly halfway between the castles – a good
  place to hold the crossing.`,
    },
  },
};

/** Order of the entries in the "Computer opponents" section. */
export const AI_GUIDE_ENTRIES = ['ai-rules', 'ai-build', 'ai-attack', 'ai-defend', 'ai-counter'];

/** Figure after the text of an entry. */
export const AI_GUIDE_FIGURES = { 'ai-attack': 'aiStates' };
