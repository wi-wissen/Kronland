# Missionen schreiben

> Missionen lassen sich auch ganz in **Python** schreiben (Szenario-JSON, Welteneditor) – siehe
> [Skripte](SKRIPTE.md). Beide Wege nutzen dieselbe Missionslaufzeit.

Missionen, Kampagne und Tutorial laufen über dieselbe Missionslaufzeit
(`src/sim/missions/runtime.js`). Sie hängt sich über drei kleine Haken in die Simulation:

| Haken | Wann | Wozu |
|---|---|---|
| `setup(sim)` | Ende des `Sim`-Konstruktors | Karte nachbearbeiten, Startaufstellung, erster Tutorial-Schritt |
| `update(sim)` | Ende jedes Takts | Ziele, Auslöser, Räuberwachen, Tutorial, Sieg/Niederlage |
| `command(sim, cmd)` | Befehl `{ type: 'mission', action }` | Tutorial: `next`, `skip`, `ui` (Prüfungen, die nur die Oberfläche sieht) |

Alles ist deterministisch (Ganzzahlen, feste Reihenfolgen, eigener Zufall). Der Missionszustand
(`mission.state`) ist reines JSON und steckt im Spielstand; die Definition mit ihren Funktionen
wird beim Laden über die ID aus `registry.js` geholt.

## Neue Mission

1. Datei in `src/sim/missions/campaign/` anlegen (Vorlage: `c1-lindgrund.js`).
2. In `src/sim/missions/registry.js` importieren und in `CAMPAIGN` einreihen.
3. `next` der vorigen Mission auf die neue ID setzen.
4. `npx vitest run tests/sim/missions.test.js` – der Test richtet jede Kampagnenmission auf
   mehreren Karten ein und prüft Warnungen, Bezüge und Erreichbarkeit.

Direktstart zum Ausprobieren: `play/?mission=c3` (optional `&seed=7`, `&no-models`).

## Sonderkarten

Einzelne fertige Karten außerhalb der Kampagne, im Startmenü unter **Sonderkarten**
(`src/ui/mission/SpecialMapsMenu.vue`). Die Liste ist `SPECIAL_MAPS` in `src/sim/missions/registry.js`: neue
Karte als Missionsdatei anlegen, dort eintragen – sie erscheint mit Titel, Zusammenfassung, Briefing und den
Nebenzielen als „Orte auf der Karte“. Nach Sieg/Ende führt „Zurück“ wieder ins Sonderkarten-Menü.

### Schaukasten

`src/sim/missions/showcase.js` (ID `showcase`) ist keine Kampagnenmission, sondern eine Ausstellungskarte:
Zufallskarte 128×128 (Seed 1), um die Burg wird ein Rechteck eingeebnet, darauf steht alles, was das Spiel
zeichnen kann. Kein Nebel (`fog: false`), alle Parteien neutral, keine Hauptziele (kein Sieg), `noDefeat`.

- Laden: `play/?mission=showcase` (gern mit `&quality=high`) oder Startmenü → **Sonderkarten** → „Schaukasten“.
- Finden: Die Ziele-Liste ist ein Wegweiser – jedes Feld ist ein Nebenziel mit „Ziel zeigen“ (Kamerasprung).
- Felder (von oben nach unten): Helden, Feldgeschütz, Fußangeln, zwei Gesprächsfiguren · jede Truppe (alle Linien
  und Stufen) mit Hauptmann · Gebäude in allen Ausbaustufen (je Typ links Stufe 1) · Arbeiter jedes Berufs (stehen
  still) · Baustellen 10/30/55/85 % und ein Wohnhaus im Ausbau · Ruinen · zweiter Spieler (andere Wappenfarbe, ohne
  Wohnhaus/Hof, darum Lagerfeuer) · freie Schächte, Siedlungsplätze, Rohstoffhaufen jeder Art, Wald mit Leibeigenen.
  Außerhalb der Fläche: fertige Brücke und freie Brückenstelle am natürlichen Fluss, Räuberlager, Felsen/Berge.
- Die Simulation läuft normal weiter (Arbeiter ziehen ein, weitere Lagerfeuer entstehen, wo Betten fehlen);
  Baustellen bleiben stehen, solange niemand Leibeigene schickt; der Ausbau läuft dagegen von selbst und ist nach
  rund 25 s fertig (Ausbauten brauchen keine Leibeigenen).
- Test: `tests/sim/showcase.test.js` (Vollständigkeit, Frieden, Determinismus), `e2e/showcase.spec.js`
  (Bildschirmfotos aller Felder nach `test-results/showcase/`).


### Gewimmel (Belastungsprobe)

`src/sim/missions/stress.js` (ID `bustle`): Karte 160×160 (Seed 11), vier Spieler (Mensch + drei KI „schwer“),
kein Nebel, `noDefeat`, kein Sieg. Zweck: Darstellung und Simulation unter Last prüfen.

- Laden: `play/?mission=bustle` oder Startmenü → **Sonderkarten** → „Gewimmel“. Messen mit F3/`?dev=1`
  (Bilder/s, Zeichenaufrufe, Dreiecke, Figuren je Stufe).
- Aufbau (`setup`): je Spieler eine Stadt aus `TOWN` (Wohnhäuser und Höfe in Stufe 3, alle Werkstätten,
  Militärgebäude, Türme, Zierden, vier Schächte) mit allen Arbeitsplätzen besetzt, 50 Leibeigene im Wald, ein
  Heer vor der Burg (`HOME_ARMY`). Nahe der Kartenmitte zwei Schlachtfelder (`BATTLES`: Spieler 1 gegen 2 im
  Norden, 3 gegen 4 im Süden) auf offenem Land ohne Wasser und Steilhang (`findBattlefield`, die Mitte selbst kann
  ein Berg sein), mit je zwei Wellen (`WAVE`) pro Seite im Angriffsmarsch.
- Nachschub: Auslöser `waves` alle 40 s eine neue Welle je Seite, solange der Spieler unter 60 Truppen hat.
- Größenordnung: zu Beginn ~180 Gebäude und ~1 150 Figuren, nach vier Spielminuten ~1 600 (KI rekrutiert dazu);
  die Simulation braucht dann ~16 ms je Takt (Budget 100 ms).
- Ziele-Liste: Wegweiser zu beiden Schlachten und den vier Städten („Ziel zeigen“).
- `heavy: true`: rechenintensive Karte – der Dauertest `tests/sim/fuzz.test.js` läuft hier 800 statt 3000 Takte.
- Test: `tests/sim/stress.test.js` (Mindestzahlen, Nachschub, Determinismus), `e2e/special-maps.spec.js`
  (Menü, Bildschirmfotos Schlacht/Stadt/Überblick und Zeichenaufrufe nach `test-results/special-maps/`).
## Aufbau einer Missionsdatei

```js
import { t, say } from './common.js';

export default {
  id: 'c9', order: 9, seed: 9909, size: 96,
  title: t('Titel', 'Title'),
  summary: t('Ein Satz für die Liste', 'One line for the list'),
  briefing: t('Vorgeschichte …', 'Backstory …'),
  victoryText: t('…', '…'), debrief: t('Was danach geschieht …', '…'), // debrief auch als (state) => t(…), z. B. je nach gewähltem Weg (Merker)
  defeatText: t('…', '…'),
  defeatTexts: { hq: t('…', '…'), protectVc: t('…', '…') }, // je Grund (Ziel-ID, 'hq', eigener Grund)
  next: 'c10',            // null = letzte Mission
  weatherCycle: [['summer', 1800], ['winter', 3000]], // optional, Takte
  forest: 'conifer',      // optional, nur Darstellung: 'mixed' (Standard, Laub- und Mischwald), 'conifer' (kalt), 'leafy'
  noDefeat: false,        // true: keine Niederlage (Tutorial)
  fog: true,              // Nebel des Krieges (Standard an)
  vision: { startReveal: 20 }, // erkundeter Umkreis um jede Burg zu Beginn (Tutorial: 34)
  available: { buildings: ['residence', 'farm', …], techs: ['standingArmy'] }, // Kampagne: nur das ist freigeschaltet
  shafts: ['clay', 'stone'], // Grubenplätze nur für diese Rohstoffe (die übrigen werden normaler Boden)
  players: [
    { kind: 'human', heroes: ['nelia', 'orrin'], serfs: 8, techs: ['conscription'], stock: { gold: 1000 } },
    { kind: 'ai', hero: 'malvor', difficulty: 'hard', aggression: 'normal', startDelay: 60, forbid: ['foundry'] },
    { kind: 'bandits', look: 'soldiers' },  // Spielerplatz ohne Burg (Räuber, Wachposten)
    { kind: 'village', name: 'moor', diplomacy: { human: 'allied' } }, // Dorf: ohne Burg, sonst neutral
  ],
  tributes: { … },        // Angebote, die der Spieler bezahlen kann (siehe unten)
  npcs: { … },            // Gesprächsfiguren (siehe unten)
  landmarks: [{ at: 'vcRuin', model: 'ruin', building: 'villageCenter' }],
  // Wahrzeichen, nur Darstellung: Grundmauern eines Gebäudes (linke obere Ecke auf at; eigenes Ruinenmodell des Typs,
  // sonst die allgemeine Ruine; verschwinden, sobald dort gebaut wird)
  setup(ctx) { … },       // Karte nachbearbeiten (siehe unten)
  start: [ …Aktionen ],   // direkt nach dem Aufbau
  objectives: [ … ],
  events: [ … ],
  tutorial: [ … ],        // nur für Tutorials
};
```

Alle sichtbaren Texte sind zweisprachig `{ de, en }`. Die Oberfläche übersetzt mit
`tr(text)` aus `src/i18n/index.js` (früher `tr.js`, bleibt als Weiterleitung) (Sprache in `localStorage['kronland-lang']`, Standard Deutsch).
Ein Test prüft, dass jede Missionsdatei beide Sprachen enthält.

### Spieler

| Feld | Bedeutung |
|---|---|
| `kind` | `human` (immer Spieler 0), `ai`, `bandits` |
| `hero` / `heroes` | ein Held (`nelia`, `orrin`, `taran`, `malvor`), mehrere als Liste (erster = Haupt-Held) oder `null` |
| `hq` | `false`: ohne Burg, Dorfzentrum und Leibeigene (Kommandomission) |
| `stock` | Startrohstoffe (veredelt); fehlende bleiben beim Standard |
| `serfs`, `techs`, `team` | Leibeigene, Technologien, Team |
| `difficulty` | KI: `easy`, `normal`, `hard` |
| `aggression` | KI: `passive` (greift nie selbst an), `normal`, `aggressive` (früher, kleinere Heere) |
| `startDelay` | KI wartet so viele Sekunden |
| `forbid` | Gebäude, die die KI nicht baut |
| `aiSerfs` | KI: höchstens so viele Leibeigene (weniger Wirtschaft und kleinere Miliz) |
| `militia` | KI: `false` = bewaffnet ihre Leibeigenen nie |

Räuber (`bandits`) bauen nie. Ihre Lager werden mit `ctx.camp(…)` angelegt; die Wachen bleiben
stehen und greifen an, sobald Feinde ins Lager kommen. Danach kehren sie zurück. Angriffe
kommen nur über die Aktion `spawn`. Räuber zählen nicht als Gegner für den Sieg. Mit `look: 'soldiers'`
sehen sie wie Soldaten aus (Wachposten, Belagerer eines Gegners ohne Burg).

**Dörfer** (`kind: 'village'`, mit `name`) sind eigene Spielerplätze ohne Burg und ohne KI, hinter den
übrigen Spielern. Zu Beginn sind sie zu allen neutral (wie im Vorbild); `diplomacy: { human: 'allied' }`
setzt Abweichungen. Gebäude bekommen sie in `setup` über `api.placeBuilding(sim, m.playerOf('moor'), …)`.
Überall, wo ein Spieler gemeint ist, darf der Dorfname stehen.

**Helden als Bezüge:** `hero` ist der Haupt-Held des Menschen, dazu steht jeder Held unter seinem Namen
(`nelia`, `taran` …, eigene vor fremden). Ziele/Auslöser mit `who` akzeptieren einen Heldennamen
(`{ type: 'reach', area: 'root', who: 'nelia' }`), `heroDown` ein `hero`.

## Karte nachbearbeiten: `setup(ctx)`

**Niemals feste Koordinaten.** Der Kartengenerator ändert sich (Relief, Klippen). Alle Positionen
werden ausgehend von Burgen, Kartenmitte oder anderen gefundenen Punkten gesucht.

| Werkzeug | Zweck |
|---|---|
| `ctx.hqCenter(p)`, `ctx.mapCenter()` | Bezugspunkte |
| `ctx.ref(name, wert)` | Bezug merken: Entity-ID, ID-Liste oder Kreis `{x, y, r}` |
| `ctx.camp(name, nahe, truppen, { from, avoid, maxR, r, anchor, onIce })` | Räuberlager mit Wachen; legt `name`, `nameGuards`, `nameArea` an. `anchor`: ID eines vorhandenen Räubergebäudes, das die Wachen statt einer Lagerhütte bewachen. Bestochene Wachen gehören nicht mehr zum Lager. Lager, Wachen und alles, was `api.findOpen`/`api.spawnTroop` aufstellt, meiden Wasser auch zugefroren; `onIce: true` erlaubt das Eis (Posten auf dem Fluss, Mission 3) |
| `ctx.warn(text)` | Warnung (Tests schlagen dann fehl) |
| `api.toward(a, b, d)`, `api.dist(a, b)` | Punkt auf der Linie a→b, Abstand |
| `api.findOpen(sim, x, y, { minR, maxR, clear, from, avoid })` | freie begehbare Stelle, optional erreichbar von `from` |
| `api.placeBuilding(sim, p, typ, nahe, { minR, radius, done, level })` | Gebäude ohne Kosten |
| `api.spawnTroop(sim, p, def, nahe, soldaten)` | Hauptmann mit Soldaten |
| `api.addSpot`, `api.addShaft`, `api.ensureShaft` | Siedlungsplatz / Schacht anlegen bzw. sicherstellen |
| `api.addPile`, `api.plantTrees`, `api.clearNodes` | Haufen, Bäume, Lichtung |
| `api.makeIsland(sim, von, nach, { inner, width, minDist, keep })` | Insel mit Wasserring, nur im Winter erreichbar; `keep`: Punkte, die im Sommer erreichbar bleiben müssen |
| `api.moat(sim, mitte, von, { inner, width })` | Wassergraben um einen festen Punkt (z. B. eine Burg) |
| `api.axis(von, nach)` | Achse: `p(x, y)` entlang, `q(x, y)` seitlich, `at(p, q)` → Kachel |
| `api.soften(sim, { divide, sites })` | Relief stauchen, Steilhänge und Gewässer entfernen; `sites`: auch Plätze, Schächte, Brückenstellen |
| `api.ridge(sim, achse, at, breite, { wobble })` | Bergkamm quer über die Karte (Steilhang, unpassierbar, auch über Eis) |
| `api.ridgeGap(sim, kamm, q, { width, water })` | Durchlass im Kamm: Pass oder (mit `water`) Schlucht mit Fluss; liefert `center`, `near`, `far` |
| `api.channel(sim, a, b, { width })` | Flusslauf von a nach b |
| `api.lakeIsland(sim, mitte, { inner, width, shore })` | See mit flacher Insel und Ufer an fester Stelle |
| `api.addRuin(sim, typ, nahe)` | dauerhafte Ruine (Kulisse) |
| `api.reachable(sim, a, b, gefroren)` | Gegenprobe Wegsuche |

Gebäude, die eine Mission für einen Computergegner hinstellt und die er nicht abreißen soll (etwa auf einer
Insel, die seine Leibeigenen nicht erreichen), bekommen `fixed = true`.

## Ziele

Gemeinsame Felder: `id`, `type`, `text`, `primary` (Hauptziel), `hidden` (erst durch `reveal`
sichtbar), `player` (Standard: Mensch), `onDone` / `onFail` (Aktionen), `showProgress: false`,
`hint` (`{ area }` oder `{ entity }`: Ort des Ziels; `ui`: Zeiger auf Knöpfe, siehe unten).

**Zielorte:** Ein offenes Ziel mit Ort – `reach` immer (sein `area`), andere über `hint` – bekommt auf der Karte
Ring und Pfeil (wie Tutorial-Hinweise; das erste solche Ziel, Hauptziele zuerst) und im Zielpanel einen Knopf,
der die Kamera hinfährt. Damit Spieler wissen, wo „der alte Baum am Waldrand“ ist; ein Wahrzeichen (`landmarks`)
zeigt dort zusätzlich etwas Passendes.

**Zeiger auf Knöpfe:** `hint.ui` (Liste von `data-testid`s, z. B. `['build-clayMine', 'quick-all']`) umrandet den
ersten sichtbaren Knopf mit demselben leuchtenden Rahmen wie im Tutorial (`UiPointer.vue`) und hebt die Kachel im
Baumenü hervor; es zeigt das erste offene Ziel mit Zeiger (Hauptziele zuerst), im Tutorial der Schritt. Bei
`build`-Zielen verschwindet der Zeiger, sobald genug Baustellen stehen; sonst gilt `hint.uiWhile` (Bedingung wie bei
Auslösern), z. B. `{ type: 'not', cond: { type: 'built', building: 'clayMine', placed: true } }`.

**Schrittweise freischalten (Kampagne):** Mit `available` gibt es für den Menschen nur die genannten Gebäude und
Forschungen (Hochschule); alles andere steht ausgegraut mit Schloss im Menü („In dieser Mission nicht verfügbar“) und
wird von der Simulation abgelehnt (`err.notInMission`). Die Aktion `unlock` schaltet im Lauf frei. Ohne
`available` (freies Spiel, eigene Szenarien, Mission 6) gibt es alles; Computergegner sind nie betroffen.

| `type` | Felder | erfüllt, wenn … |
|---|---|---|
| `build` | `building`, `count`, `level` (0-basiert) | so viele fertige Gebäude (mind. Stufe) |
| `workers` | `count` | Arbeiter |
| `population` | `count` | belegte Bevölkerungsplätze |
| `stock` | `res`, `amount` | Rohstoff vorhanden (roh + veredelt) |
| `research` | `tech` oder `techs[]` | alles erforscht |
| `recruit` | `count`, `line` | so viele Einheiten ausgehoben, seit das Ziel aktiv ist |
| `destroy` | `ref` | alle Entities des Bezugs zerstört (bestochene Truppen zählen als erledigt) |
| `destroyHq` | `target` (`'enemy'` oder Spieler) | Burg dieses Spielers zerstört |
| `defeatAll` | `bandits` (auch Lager) | alle Gegner besiegt |
| `survive` | `seconds` (ab Aktivierung) oder `until` (Spielzeit) | Zeit überstanden |
| `reach` | `area`, `who` (`any`, `hero`, Heldenname, `army`, `serf`, `leader`), `count` | genug Einheiten im Gebiet |
| `protect` | `ref`, `heroDownFails` | „halten“: scheitert, wenn alles verloren ist (Held bewusstlos zählt standardmäßig) |
| `motivation` | `value` | Durchschnittsmotivation |
| `flag` | `flag` | Missionsmerker gesetzt |
| `custom` | `progress(sim, m) → { cur, target, done?, failed? }` | eigene Regel (`done: false` hält das Ziel offen, auch wenn `cur` = `target`, z. B. für einen Ladebalken) |

Sieg: alle Hauptziele erfüllt (`protect`-Ziele dürfen dabei noch aktiv sein).
Niederlage: eigene Burg fällt oder ein Hauptziel scheitert (außer `noDefeat`).

## Auslöser

```js
{ id: 'welle1', when: { type: 'time', at: 150 }, do: [ …Aktionen ], times: 1, every: 60 }
```

`times` (Standard 1; mit `every` unbegrenzt) und `every` (Sekunden Mindestabstand) erlauben
Wiederholungen. `when` kann auch eine Funktion `(sim, m) => boolean` sein.

| Bedingung | Felder |
|---|---|
| `time` | `at` (Sekunden Spielzeit) |
| `delay` | `after` (Auslöser-ID oder `'start'`) bzw. `afterStep`, `seconds` |
| `objective` | `id`, `status` (Standard `done`) |
| `fired` | `id` eines Auslösers |
| `built` | `building`, `count`, `level`, `placed` (Baustelle genügt) |
| `dead` / `destroyed` | `ref` – alle Entities weg (Held: bewusstlos) |
| `area` | `area`, `who`, `count`, `player` |
| `resource` | `res`, `amount` |
| `workers`, `serfs` | `count` |
| `tech` | `tech` |
| `job` | `res` (Leibeigene bauen das gerade ab) |
| `event` | `event` (Ereignistyp der Simulation dieses Takts), `match` |
| `weather` | `state` |
| `flag`, `defeated` | … |
| `heroDown` | `hero` (Name, Standard: Haupt-Held) – bewusstlos oder weg |
| `tribute` | `id` – Tribut bezahlt |
| `talked` | `id` – Gesprächsfigur angesprochen |
| `diplomacy` | `a` (Standard Mensch), `b`, `state` |
| `all`, `any`, `not` | `of: [ … ]` bzw. `cond` |
| `ui` | `check` – nur Tutorial, meldet die Oberfläche per Befehl |

## Aktionen

| Aktion | Felder |
|---|---|
| `dialog` | `speaker` (aus `speakers.js`), `text` |
| `reveal` / `complete` / `fail` | `id` (oder Liste) – Ziel aufdecken, erfüllen, scheitern lassen |
| `reveal` mit `area` | `area`, `r` (Kacheln, Standard Radius des Orts + 4), `seconds` (Standard 30), `player` – Kartenbereich aufdecken: dauerhaft erkundet, so lange sichtbar (Nebel des Krieges) |
| `spawn` | `owner`, `at`, `units: [{ def, count, soldiers }]`, `order: 'attackMove'`, `target`, `ref`, `append` |
| `give` | `player`, `res`, `techs`, `serfs` |
| `build` | `building`, `near`, `minR`, `radius`, `ref` |
| `ai` | `player`, `difficulty`, `aggression`, `startIn`, `forbid`, `attackNow` |
| `weather` | `state`, `seconds` |
| `camera` | `at` – die Oberfläche springt dorthin (liegt das Ziel im Nebel, vorher `reveal` mit `area`) |
| `flag` | `name`, `value` (Questgegenstände wie die Kronenzacken sind einfach Merker) |
| `unlock` | `buildings`, `techs` – zu `available` hinzufügen (Kampagne: Neues mitten in der Mission) |
| `diplomacy` | `a` (Standard Mensch), `b`, `state` (`allied`, `neutral`, `hostile`) |
| `tribute` / `closeTribute` | `id` – Angebot aus `tributes` öffnen bzw. zurückziehen |
| `npc` | `id` – Gesprächsfigur aus `npcs` aufstellen |
| `hero` | `hero`, `player`, `at`, `ref` – Held mitten in der Mission dazuholen (z. B. Überläufer) |
| `remove` | `ref` – Figuren oder Gebäude ohne Kampf aus dem Spiel nehmen (Zwischenszene) |
| `victory` / `defeat` | `reason` (wählt `defeatTexts[reason]`) |

Statt eines Objekts darf jede Aktion auch eine Funktion `(sim, m) => {}` sein.
Orte (`at`, `area`, `near`, `target`) sind Bezugsnamen, Kreise `{x, y, r}`, `'humanHq'` oder `'enemyHq'`.

## Tribute (Kaufen oder Kämpfen)

Wie im Vorbild: Ein Tribut ist ein Angebot im Missionsfeld („Angebote“). Bezahlen zieht die Kosten ab und
führt `onPaid` aus. Angebote derselben `group` schließen einander aus – so entsteht eine Wahl, etwa Söldner
gegen geflohene Leibeigene oder Freikauf gegen Sturm aufs Lager.

```js
tributes: {
  buyShard: { group: 'shard', cost: { gold: 1500, wood: 500 }, text: t('Zacke freikaufen', '…'),
              onPaid: [{ type: 'flag', name: 'shard2' }] },
},
start: [{ type: 'tribute', id: 'buyShard' }],
```

Befehl der Oberfläche: `{ type: 'mission', action: 'tribute', id }` (Ablehnung `err.noTribute` bzw.
`err.notEnoughResources`). Lieferquests sind ebenfalls Tribute (Mission 5).

## Gesprächsfiguren

Figur mit Ausrufezeichen; geht der genannte Held (`hero`, auch Liste; ohne = jeder Held) bis auf `radius`
(Standard 2) Kacheln heran, läuft `onTalk`. Ein anderer Held bekommt höchstens den Hinweis `wrongHero`.

```js
npcs: {
  elder: { at: 'villageArea', owner: 'neighbors', look: 'serf', hero: 'orrin', speaker: 'elder',
           wrongHero: t('Schick mir den Händler.', '…'), onTalk: [ …Aktionen ] },
},
```

`look` ist eine Rolle des Figuren-Manifests (`serf`, `worker`, auch ein Held wie `hero.orrin`, der sich nach dem
Gespräch per `remove` + `hero` anschließt – Mission 1). `speaker` lenkt die Dialogkamera auf die Figur.
Aufstellen mit `{ type: 'npc', id }`; Bezug und Zustand unter `refs[id]` bzw. `state.npcs[id]`. Die Figur
ist ein eigenes Entity (`kind: 'npc'`), kämpft nicht und kann nicht angegriffen werden.

## Tutorial-Schritte

```js
{
  id: 'farm',
  title: t('Bauernhof', 'Farm'),
  text: t('Desktop-Text', '…'),
  touch: t('Text für Touch-Geräte', '…'),          // optional
  hint: { ui: ['build-farm', 'build-toggle'], entity: 'farm', area: 'tutShaft' },
  onEnter: [ …Aktionen ], onDone: [ …Aktionen ],
  done: { type: 'built', building: 'farm', placed: true }, // ohne done: „Weiter“-Knopf
  allowNext: true,                                         // „Weiter“ trotz done
}
```

- `hint.ui`: `data-testid`-Werte; der Zeiger (`UiPointer.vue`, auch für Missionsziele) umrandet das erste sichtbare Element der Liste.
- `hint.entity` / `hint.area`: 3D-Marke auf der Karte (`src/render/hints.js`).
- Überspringen geht immer; `onEnter` läuft trotzdem, damit spätere Schritte ihre Gebäude haben.

## Oberfläche

`Engine.uiState().mission` liefert `{ objectives, tutorial, messages, tributes, camera, result, pointer }`
(`pointer`: Knöpfe, auf die gerade gezeigt wird – Tutorial-Schritt oder erstes Ziel mit `hint.ui`).
Komponenten in `src/ui/mission/`: `CampaignMenu`, `MissionHud` (Coach, Ziele, Angebote, Dialog, Zeiger),
`MissionResult`.

**Dialoge** (`DialogBox.vue`): eine Mitteilung nach der anderen. Weiter geht es erst, wenn die Anzeigezeit um ist
(Skript: so lange, wie die Simulation wartet; sonst Lesezeit, mit Aufnahme mindestens 2,5 s) **und** die Aufnahme
zu Ende gesprochen ist (plus 0,45 s Pause) – so fällt kein Sprecher dem anderen ins Wort. ✕ beendet den Satz,
„Gespräch überspringen“ alle wartenden Sätze. Vor dem ersten Satz
wartet der Dialog auf den Index der Aufnahmen. Solange eine Stimme spricht, sinken Musik (auf 22 %) und Umgebung
(55 %) und kommen danach weich zurück (`AudioEngine.duck`).
**Dialogkamera** (`Engine.dialogFocus`, Einstellung „Kamera bei Dialogen“): Spricht eine sichtbare Figur (Held
oder Gesprächsfigur), fährt die Kamera in 1,1 s auf Abstand 8 an sie heran (Nahansicht mit flachem Blick); nach
dem letzten Satz fährt sie zurück. Bewegt der Spieler die Kamera selbst, bleibt sie dort.

Feste Oberflächentexte stehen unter `mission.*` in `src/i18n/de.js`/`en.js`.
Tutorial-Hinweise (`hint.ui`) zeigen auf `data-testid`s, z. B. `quick-all`, `build-residence`,
`build-toggle`, `buy-serf`, `tech-education`, `payday`, `upgrade`, `recruit-full-sword`, `ability-courage`;
zeigt ein Hinweis auf ein Gebäude, wechselt das Baumenü in dessen Kategorie. Kampagnenfortschritt (freigeschaltet, Bestzeit) liegt in
`localStorage['kronland-campaign-1']`.

## Die Kampagne

| # | ID | Titel | Neues |
|---|---|---|---|
| 0 | `tutorial` | Erste Schritte | alle Grundlagen geführt |
| 1 | `c1` | Lindgrund | Winter; Nelia und Orrin, erste Zacke (Merker), Wohnen/Essen/Arbeiter, Eintreiber vertreiben; Nachbardorf über Orrins Gespräch verbündet (optional) |
| 2 | `c2` | Beaucroix | Winter; Marktplatz und Handel, nach dem ersten Tausch: Malvors Herold, Kaserne frei, Zacke freikaufen (Tribut, Taler über den Markt) oder Räuberlager stürmen, Lehmschuld als Nebenquest |
| 3 | `c3` | Das Wetterwerk | Kommandomission ohne Burg in einem fest geformten Tal: Tor oder zugefrorener Fluss (Posten bestechen), Wetterwerk auf der Insel, Flucht vor dem Tauwetter (60 s), Baupläne sichern |
| 4 | `c4` | Eisenhain | Belagerung brechen, Taran als feindlicher Held, Söldner oder Leibeigene (Tribute), Bergmeister übergibt die Zacke |
| 5 | `c5` | Morvale | Herold macht die Dörfer neutral, Taran läuft über und wird spielbar, Höfe schützen, Dörfer per Lieferung zurückgewinnen |
| 6 | `c6` | Der Thronsee | Inselschloss im See, Wetterkraftwerk erforschen oder Wissen kaufen, Winter auslösen, Sturm übers Eis; Malvors eigenes Kraftwerk (gleiche Regeln) taut den See, Orrin wird verwundet |

Story, Figuren und die Zuordnung zu den Siedler-5-Mechaniken: [Kampagne](KAMPAGNE.md).

## Balancing und Test-Bot

Die Kampagne wird mit einem Spieler-Bot geprüft (`tests/sim/missionBot.js`, Klasse `MissionBot`).
Er gibt nur Befehle, die auch die Oberfläche geben kann, liest aber den ganzen Zustand
(perfekte Information). Je Mission gibt es eine Strategie (`STRATEGIES`): Bauplan, Forschung,
Ausbauten, Gebäude-Technologien, Rekrutierplan, Steuerpolitik und ein kleines Skript für die Ziele.
Allgemein kann er:

- Leibeigene kaufen und verteilen (Baustellen zuerst, dann Holz bzw. knappe Rohstoffe an Haufen
  außerhalb von Räuberlagern), Wohnhäuser/Bauernhöfe nach Bedarf der Arbeitsplätze, weitere
  Dorfzentren bzw. Ausbau bei voller Bevölkerung, Minen auf sicheren Schächten, Veredler,
  Marktplatz-Handel (Überschuss gegen Taler), Steuern nach Motivation, Reparatur;
- Truppen ausheben, auffüllen und aufwerten, am Sammelpunkt halten, Burg/Schutzziele verteidigen
  (Miliz, wenn es eng wird), Ziele angreifen (Sammelpunkt vor dem Ziel außer Reichweite der Türme,
  dann gezielter Sturm, Rückzug bei hohen Verlusten, Nachschub wartet), Kleinsteuerung (wer ein
  Gebäude schlägt, während Feinde danebenstehen, wird umgelenkt), Heldenfähigkeiten
  (Mut machen vor dem Sturm, Schildstoß, Einschüchtern, Wundsalbe, Bestechen mit Rücklage);
- Missionsbausteine wie ein Mensch bedienen: Tribute bezahlen (`payTribute`), Helden einzeln zu
  Gesprächsfiguren schicken (`heroNamed`, `npcAt`), Kommandomission ohne Burg (nur Skript und Fähigkeiten).
- Je Mission ein kleines Skript: Mission 1 Nelia zur Wurzel und beide Helden gegen die Eintreiber, Mission 2
  Lehmschuld, Markt, Lehm/Stein gegen Taler, dann Freikauf, Mission 3 Trupp zur Insel (Helden dahinter),
  Mission 4 Söldner, dann Belagerer angreifen, Mission 5 Lieferungen zuerst, Mission 6 Wissen kaufen,
  Wetterkraftwerk vor dem Heer, Winter erst mit 9 Truppen und voller Energie, dann Sturm aufs Schloss.

`playMission(id, seed, { passive })` spielt eine Mission headless und liefert einen Bericht
(Sieg/Niederlage, Dauer, Minute jedes Ziels, Rohstoffkurven je Minute, Heeresgröße, Verluste).
`passive: true` baut nur Wirtschaft (Gegenprobe: Mission 5 gewinnt er nie, Mission 6 verliert er).

```bash
node scripts/campaign-matrix.js            # 6 Missionen × 4 Karten + Gegenproben, Tabelle
node scripts/campaign-matrix.js c6 --json  # Rohdaten einer Mission
npx vitest run tests/sim/campaign.test.js  # Regression: 2 Karten je Mission + Gegenproben
```

### Vorgaben und Ergebnisse

Zeitlimit = spätester akzeptierter Sieg des Bots (Spielminuten). Ergebnisse auf den Karten
Missionsseed, 7, 99, 31337 (`node scripts/campaign-matrix.js`, Kampagne „Krone aus Eis“):

| Mission | Limit | Siege | Dauer (min) | Verluste Bot (Hauptleute/Soldaten) | Weg des Bots | Passiver Bot |
|---|---|---|---|---|---|---|
| c1 Lindgrund | 20 | 4/4 | 3,3–5,3 | 0/0 | Helden gegen Eintreiber, Nachbardorf meist mit | – |
| c2 Beaucroix | 30 | 4/4 | 4,4–11,9 | 0–1 / 0–16 | Freikauf (Lehmrabatt) | – |
| c3 Wetterwerk | 20 | 4/4 | 2,1–8,3 | 0–3 / 0–11 | mitten durch | – |
| c4 Eisenhain | 40 | 4/4 | 9,3–21,1 | 0–1 / 0–7 | Söldner | – |
| c5 Morvale | 40 | 4/4 | 8,4–11,4 | 0 / 1–6 | Lieferungen | gewinnt nie (ohne Lieferungen kehren die Dörfer nicht zurück); Taran und seine Überläufer halten die Höfe meist allein |
| c6 Thronsee | 60 | 4/4 | 14,6–17,0 | 0 / 0–6 | Wissen gekauft | verliert (Min. 20–21) |

Rohausgabe:

```
Mission Seed   Bot     Ergebnis                   Zeit    Limit  Heer  Verluste (H/S/L/Gb)  Ziele (Minute)
c1      1101   aktiv   Sieg                       4.7m    20m    0     0/0/1/0              homes:1.5 workers:3.2 farms:4.2 collectors:4.6 root:4.7 neighbors:–
c1      7      aktiv   Sieg                       3.3m    20m    0     0/0/0/0              root:0.2 neighbors:0.4 homes:1.4 workers:3 collectors:3 farms:3.3
c1      99     aktiv   Sieg                       5.3m    20m    0     0/0/0/0              homes:1.4 farms:2.8 collectors:4.6 root:4.9 neighbors:5.1 workers:5.3
c1      31337  aktiv   Sieg                       4.3m    20m    0     0/0/0/0              root:0.1 neighbors:0.2 homes:1.4 farms:2.8 collectors:3 workers:4.3
c2      2202   aktiv   Sieg                       5.7m    30m    1     1/3/0/0              clay:1 farms:2.8 market:5.3 trade:5.7 shard:5.7
c2      7      aktiv   Sieg                       11.9m   30m    2     1/16/6/0             clay:0.7 farms:4.3 market:8.3 trade:8.7 shard:11.9
c2      99     aktiv   Sieg                       4.4m    30m    0     0/0/0/0              clay:0.8 farms:3.9 market:4 shard:4 trade:4.4
c2      31337  aktiv   Sieg                       5.7m    30m    1     0/0/0/0              clay:0.7 farms:2.9 market:5.3 shard:5.3 trade:5.7
c3      3303   aktiv   Sieg                       8.3m    20m    5     0/2/0/0              pass:1.2 plans:4.6 works:8.3 heroes:null
c3      7      aktiv   Sieg                       2.1m    20m    5     0/0/0/0              pass:0.3 plans:1 works:2.1 heroes:null
c3      99     aktiv   Sieg                       4.8m    20m    5     3/11/0/0             pass:0.9 works:4.8 plans:4.8 heroes:null
c3      31337  aktiv   Sieg                       3.1m    20m    5     0/5/0/0              pass:0.2 works:3 plans:3.1 heroes:null
c4      4404   aktiv   Sieg                       9.3m    40m    6     0/0/0/0              iron:1.3 sulfur:2.5 siege:9.1 shard:9.3 army:–
c4      7      aktiv   Sieg                       21.1m   40m    6     0/4/14/0             sulfur:1.4 iron:10.8 siege:20.9 shard:21.1 army:–
c4      99     aktiv   Sieg                       21.1m   40m    5     1/4/16/0             iron:10.2 sulfur:11.4 siege:21 shard:21.1 army:–
c4      31337  aktiv   Sieg                       16.9m   40m    6     0/7/10/0             iron:1.3 sulfur:6.2 siege:16.8 shard:16.9 army:–
c5      5505   aktiv   Sieg                       11.4m   40m    7     0/6/0/0              farms:7.1 regain:7.1 drive:11.2 shard:11.4 granaries:null
c5      7      aktiv   Sieg                       9m      40m    7     0/1/0/0              drive:5.8 farms:8.8 regain:8.8 shard:9 granaries:null
c5      99     aktiv   Sieg                       9.8m    40m    7     0/2/0/0              drive:5.8 farms:5.9 regain:9.4 shard:9.8 granaries:null
c5      31337  aktiv   Sieg                       8.4m    40m    7     0/2/0/0              drive:5.8 farms:8.2 regain:8.2 shard:8.4 granaries:null
c6      6606   aktiv   Sieg                       17m     60m    11    0/6/1/0              plant:7.1 army:14 freeze:14 castle:17 tower:–
c6      7      aktiv   Sieg                       16.4m   60m    10    0/2/4/0              plant:4.7 army:14 freeze:14 castle:16.4 tower:–
c6      99     aktiv   Sieg                       16.4m   60m    10    0/5/0/0              plant:3.8 army:14 freeze:14 castle:16.4 tower:–
c6      31337  aktiv   Sieg                       14.6m   60m    9     0/0/9/0              plant:3.1 army:12 freeze:12 castle:14.6 tower:–
c5      5505   passiv  Niederlage (hq)            34.9m          2     2/8/15/8             drive:5.8 farms:7.1 granaries:– regain:– shard:–
c5      7      passiv  Niederlage (timeout)       60m            2     1/6/0/0              drive:5.8 farms:8.8 granaries:– regain:– shard:–
c6      6606   passiv  Niederlage (hq)            20m            0     0/0/111/21           plant:– freeze:– castle:– tower:– army:–
c6      7      passiv  Niederlage (hq)            21.1m          0     0/0/107/16           plant:– freeze:– castle:– tower:– army:–
```

Der andere Weg der Kauf-oder-Kampf-Entscheidungen (Lager stürmen, Leibeigene aufnehmen) ist durch Tests in
`tests/sim/missions.test.js` abgedeckt, aber nicht mit dem Bot durchgespielt.

### Designnotizen

- **Gold ist der Engpass.** In Mission 2 bringt erst der Marktplatz (Lehm und Stein gegen Taler) das Geld für den
  Freikauf – ohne Markt kam der Bot auf Karte 7 nie auf 1000 Taler. Deshalb startet die Mission mit Handelswesen
  (die Forschung bräuchte sonst eine Festung) und 1500 Talern. Freikauf in Holz statt Eisen: Eisen gibt es in
  Beaucroix nicht.
- **Mission 4:** 2000 Taler zu Beginn, damit die Wahl (Söldner 1400 / Leibeigene 400) sofort möglich ist.
- **Mission 5:** Erlenhof verlangte zuerst 600 Taler – der Bot brauchte dann 30–50 Minuten. Jetzt 300 Taler und
  500 Lehm, jede Lieferung fordert andere Rohstoffe.
- **Mission 6:** 3500 Taler: das Wissen der Gelehrten (2200 + 500 Schwefel) ist sofort bezahlbar, danach reicht
  es für das Wetterkraftwerk. Wer erst Truppen kauft, hat kein Geld für das Kraftwerk (der Bot baute es sonst erst
  nach 70 Minuten). Der See (Breite 4) liegt so nah wie möglich um die Burg (Ring 11–18 Kacheln, ohne Gebäude zu
  fluten). Wer nach dem Tauwetter auf der Insel steht, kämpft weiter – nur auf dem Eis ertrinkt man.
- **Mission 3:** Die Wachen am Werk (2 Schwert-, 1 Bogentrupp) und der Alarm (2 Schwerttrupps) schaffen drei
  Trupps nur mit beiden Helden; stärkere Wachen ließen den Bot ohne Helden scheitern und mit Helden sterben.
- **Lagerwachen** bekamen jede Sekunde einen neuen Angriffsbefehl (der Ziel und Weg zurücksetzt); jetzt nur noch
  Wachen, die gerade keinen Gegner im Visier haben.

### Bekannte Grenzen

- Gebäude haben hohe Rüstung; Nahkämpfer machen fast nur Mindestschaden. Burgen fallen nur mit
  vielen Truppen und „Mut machen“; Kanonen ab Metallurgie sind der eigentliche Belagerungsweg
  (Spielregel, kein Fehler).

Behoben (zweite QA-Runde, siehe `QA-BERICHT.md` Befunde 19–22):

- Truppen schnitten beim Laufen Wasserecken und blieben im Wasser stecken (Mission 5, Karte 7).
  Ursache war `stepToward`/`moveAlong` (Diagonalschritt ohne Prüfung der Nachbarkacheln); jetzt
  `canStep()` für jeden Teilschritt und `unstickAll()` für Figuren auf gesperrten Kacheln. Die Regel
  in `targetable()` (Hauptmann angreifbar, wenn kein Soldat bei ihm ist) bleibt als Absicherung und
  zählt Soldaten jenseits von Wasser/Felsen als abgeschnitten.
- Mit Angriff/Angriffsbewegung auf ein Gebäude wenden sich Einheiten jetzt selbst angreifenden
  Truppen in Sichtweite zu und kehren danach zum Gebäude zurück; `micro()` des Bots ist dafür nicht
  mehr nötig (bleibt als menschenähnliche Kleinsteuerung).
- Die KI (auch Morwald, Gisbert) plant nur noch erreichbare Bauplätze, Rohstoffe und Angriffsziele.
  Das macht sie spürbar stärker: In c5 greift Morwald früher an; der Bot gewinnt c5 jetzt in
  16–23 min (vorher 17–33 min, Matrix unten).
