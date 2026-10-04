# Missionen schreiben

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

1. Datei in `src/sim/missions/campaign/` anlegen (Vorlage: `c1-new-start.js`).
2. In `src/sim/missions/registry.js` importieren und in `CAMPAIGN` einreihen.
3. `next` der vorigen Mission auf die neue ID setzen.
4. `npx vitest run tests/sim/missions.test.js` – der Test richtet jede Kampagnenmission auf
   mehreren Karten ein und prüft Warnungen, Bezüge und Erreichbarkeit.

Direktstart zum Ausprobieren: `?mission=c3` (optional `&seed=7`, `&no-models`).

## Aufbau einer Missionsdatei

```js
import { t, say } from './common.js';

export default {
  id: 'c9', order: 9, seed: 9909, size: 96,
  title: t('Titel', 'Title'),
  summary: t('Ein Satz für die Liste', 'One line for the list'),
  briefing: t('Vorgeschichte …', 'Backstory …'),
  victoryText: t('…', '…'), debrief: t('Was danach geschieht …', '…'),
  defeatText: t('…', '…'),
  defeatTexts: { hq: t('…', '…'), protectVc: t('…', '…') }, // je Grund (Ziel-ID, 'hq', eigener Grund)
  next: 'c10',            // null = letzte Mission
  weatherCycle: [['summer', 1800], ['winter', 3000]], // optional, Takte
  noDefeat: false,        // true: keine Niederlage (Tutorial)
  players: [
    { kind: 'human', hero: 'bertram', serfs: 8, techs: ['conscription'], stock: { gold: 1000 } },
    { kind: 'ai', hero: 'gerold', difficulty: 'hard', aggression: 'normal', startDelay: 60, forbid: ['foundry'] },
    { kind: 'bandits' },  // neutraler Spielerplatz ohne Burg
  ],
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
| `hero` | `bertram`, `hedda`, `gerold` oder `null` |
| `stock` | Startrohstoffe (veredelt); fehlende bleiben beim Standard |
| `serfs`, `techs`, `team` | Leibeigene, Technologien, Team |
| `difficulty` | KI: `easy`, `normal`, `hard` |
| `aggression` | KI: `passive` (greift nie selbst an), `normal`, `aggressive` (früher, kleinere Heere) |
| `startDelay` | KI wartet so viele Sekunden |
| `forbid` | Gebäude, die die KI nicht baut |

Räuber (`bandits`) bauen nie. Ihre Lager werden mit `ctx.camp(…)` angelegt; die Wachen bleiben
stehen und greifen an, sobald Feinde ins Lager kommen. Danach kehren sie zurück. Angriffe
kommen nur über die Aktion `spawn`. Räuber zählen nicht als Gegner für den Sieg.

## Karte nachbearbeiten: `setup(ctx)`

**Niemals feste Koordinaten.** Der Kartengenerator ändert sich (Relief, Klippen). Alle Positionen
werden ausgehend von Burgen, Kartenmitte oder anderen gefundenen Punkten gesucht.

| Werkzeug | Zweck |
|---|---|
| `ctx.hqCenter(p)`, `ctx.mapCenter()` | Bezugspunkte |
| `ctx.ref(name, wert)` | Bezug merken: Entity-ID, ID-Liste oder Kreis `{x, y, r}` |
| `ctx.camp(name, nahe, truppen, { from, avoid, maxR, r })` | Räuberlager mit Wachen; legt `name`, `nameGuards`, `nameArea` an |
| `ctx.warn(text)` | Warnung (Tests schlagen dann fehl) |
| `api.toward(a, b, d)`, `api.dist(a, b)` | Punkt auf der Linie a→b, Abstand |
| `api.findOpen(sim, x, y, { minR, maxR, clear, from, avoid })` | freie begehbare Stelle, optional erreichbar von `from` |
| `api.placeBuilding(sim, p, typ, nahe, { minR, radius, done, level })` | Gebäude ohne Kosten |
| `api.spawnTroop(sim, p, def, nahe, soldaten)` | Hauptmann mit Soldaten |
| `api.addSpot`, `api.addShaft`, `api.ensureShaft` | Siedlungsplatz / Schacht anlegen bzw. sicherstellen |
| `api.addPile`, `api.plantTrees`, `api.clearNodes` | Haufen, Bäume, Lichtung |
| `api.makeIsland(sim, von, nach, { inner, width })` | Insel mit Wasserring, nur im Winter erreichbar |
| `api.reachable(sim, a, b, gefroren)` | Gegenprobe Wegsuche |

## Ziele

Gemeinsame Felder: `id`, `type`, `text`, `primary` (Hauptziel), `hidden` (erst durch `reveal`
sichtbar), `player` (Standard: Mensch), `onDone` / `onFail` (Aktionen), `showProgress: false`.

| `type` | Felder | erfüllt, wenn … |
|---|---|---|
| `build` | `building`, `count`, `level` (0-basiert) | so viele fertige Gebäude (mind. Stufe) |
| `workers` | `count` | Arbeiter |
| `population` | `count` | belegte Bevölkerungsplätze |
| `stock` | `res`, `amount` | Rohstoff vorhanden (roh + veredelt) |
| `research` | `tech` oder `techs[]` | alles erforscht |
| `recruit` | `count`, `line` | so viele Einheiten ausgehoben, seit das Ziel aktiv ist |
| `destroy` | `ref` | alle Entities des Bezugs zerstört |
| `destroyHq` | `target` (`'enemy'` oder Spieler) | Burg dieses Spielers zerstört |
| `defeatAll` | `bandits` (auch Lager) | alle Gegner besiegt |
| `survive` | `seconds` (ab Aktivierung) oder `until` (Spielzeit) | Zeit überstanden |
| `reach` | `area`, `who` (`any`, `hero`, `army`, `serf`, `leader`), `count` | genug Einheiten im Gebiet |
| `protect` | `ref`, `heroDownFails` | „halten“: scheitert, wenn alles verloren ist (Held bewusstlos zählt standardmäßig) |
| `motivation` | `value` | Durchschnittsmotivation |
| `flag` | `flag` | Missionsmerker gesetzt |
| `custom` | `progress(sim, m) → { cur, target, failed? }` | eigene Regel |

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
| `flag`, `heroDown`, `defeated` | … |
| `all`, `any`, `not` | `of: [ … ]` bzw. `cond` |
| `ui` | `check` – nur Tutorial, meldet die Oberfläche per Befehl |

## Aktionen

| Aktion | Felder |
|---|---|
| `dialog` | `speaker` (aus `speakers.js`), `text` |
| `reveal` / `complete` / `fail` | `id` (oder Liste) |
| `spawn` | `owner`, `at`, `units: [{ def, count, soldiers }]`, `order: 'attackMove'`, `target`, `ref`, `append` |
| `give` | `player`, `res`, `techs`, `serfs` |
| `build` | `building`, `near`, `minR`, `radius`, `ref` |
| `ai` | `player`, `difficulty`, `aggression`, `startIn`, `forbid`, `attackNow` |
| `weather` | `state`, `seconds` |
| `camera` | `at` – die Oberfläche springt dorthin |
| `flag` | `name`, `value` |
| `victory` / `defeat` | `reason` (wählt `defeatTexts[reason]`) |

Statt eines Objekts darf jede Aktion auch eine Funktion `(sim, m) => {}` sein.
Orte (`at`, `area`, `near`, `target`) sind Bezugsnamen, Kreise `{x, y, r}`, `'humanHq'` oder `'enemyHq'`.

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

- `hint.ui`: `data-testid`-Werte; der Coach umrandet das erste sichtbare Element der Liste.
- `hint.entity` / `hint.area`: 3D-Marke auf der Karte (`src/render/hints.js`).
- Überspringen geht immer; `onEnter` läuft trotzdem, damit spätere Schritte ihre Gebäude haben.

## Oberfläche

`Engine.uiState().mission` liefert `{ objectives, tutorial, messages, camera, result }`.
Komponenten in `src/ui/mission/`: `CampaignMenu`, `MissionHud` (Coach, Ziele, Dialog),
`MissionResult`. Feste Oberflächentexte stehen unter `mission.*` in `src/i18n/de.js`/`en.js`.
Tutorial-Hinweise (`hint.ui`) zeigen auf `data-testid`s, z. B. `quick-all`, `build-residence`,
`build-toggle`, `buy-serf`, `tech-education`, `payday`, `upgrade`, `recruit-full-sword`, `ability-whirl`;
zeigt ein Hinweis auf ein Gebäude, wechselt das Baumenü in dessen Kategorie. Kampagnenfortschritt (freigeschaltet, Bestzeit) liegt in
`localStorage['kronland-campaign-1']`.

## Die Kampagne

| # | ID | Titel | Neues |
|---|---|---|---|
| 0 | `tutorial` | Erste Schritte | alle Grundlagen geführt |
| 1 | `c1` | Neubeginn im Erlengrund | Wohnen, Essen, Grube, Arbeiter; Räuberposten optional |
| 2 | `c2` | Feuer im Wald | Kaserne, drei Räuberwellen, Dorfzentrum schützen, Gegenangriff |
| 3 | `c3` | Die Furt am Grauen Bach | zweite Siedlung, 25 Arbeiter, Forschung; ruhende KI erwacht |
| 4 | `c4` | Eis über dem Spiegelsee | Wetter: Insel nur im Winter erreichbar, Befreiung, Rückweg vor dem Tauwetter |
| 5 | `c5` | Die Krone von Kronland | schwere KI mit Festung, Türmen und Kanonen |
