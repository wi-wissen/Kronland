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

1. Datei in `src/sim/missions/campaign/` anlegen (Vorlage: `c1-new-start.js`).
2. In `src/sim/missions/registry.js` importieren und in `CAMPAIGN` einreihen.
3. `next` der vorigen Mission auf die neue ID setzen.
4. `npx vitest run tests/sim/missions.test.js` – der Test richtet jede Kampagnenmission auf
   mehreren Karten ein und prüft Warnungen, Bezüge und Erreichbarkeit.

Direktstart zum Ausprobieren: `play/?mission=c3` (optional `&seed=7`, `&no-models`).

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
  fog: true,              // Nebel des Krieges (Standard an)
  vision: { startReveal: 20 }, // erkundeter Umkreis um jede Burg zu Beginn (Tutorial: 34)
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
| `aiSerfs` | KI: höchstens so viele Leibeigene (weniger Wirtschaft und kleinere Miliz) |
| `militia` | KI: `false` = bewaffnet ihre Leibeigenen nie |

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
| `reveal` / `complete` / `fail` | `id` (oder Liste) – Ziel aufdecken, erfüllen, scheitern lassen |
| `reveal` mit `area` | `area`, `r` (Kacheln, Standard Radius des Orts + 4), `seconds` (Standard 30), `player` – Kartenbereich aufdecken: dauerhaft erkundet, so lange sichtbar (Nebel des Krieges) |
| `spawn` | `owner`, `at`, `units: [{ def, count, soldiers }]`, `order: 'attackMove'`, `target`, `ref`, `append` |
| `give` | `player`, `res`, `techs`, `serfs` |
| `build` | `building`, `near`, `minR`, `radius`, `ref` |
| `ai` | `player`, `difficulty`, `aggression`, `startIn`, `forbid`, `attackNow` |
| `weather` | `state`, `seconds` |
| `camera` | `at` – die Oberfläche springt dorthin (liegt das Ziel im Nebel, vorher `reveal` mit `area`) |
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
| 3 | `c3` | Die Furt am Grauen Bach | zweite Siedlung, 40 Arbeiter, Forschung; ruhende KI erwacht und greift die neue Siedlung an |
| 4 | `c4` | Eis über dem Spiegelsee | Wetter: Insel nur im Winter erreichbar, Befreiung, Rückweg vor dem Tauwetter |
| 5 | `c5` | Die Krone von Kronland | schwere KI mit Burg, Türmen und Kanonen; Angriffswellen, Wutangriffe ab Minute 25 |

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
  (Aura der Stärke vor dem Sturm, Wirbelschlag, Heilen, Fallen);
- Mission 4: Stoßtrupp mit Bertram ans Ufer, bei Frost übers Eis, Wachen schlagen, Hedda heimbringen,
  eine Truppe bleibt für den Winterüberfall zu Hause. Das Wetterkraftwerk braucht in Mission 4
  Alchimie → Alchimistenhütte → Wettervorhersage → Meteorologie und lädt danach Minuten – der
  natürliche Winter kommt nach 3 Minuten, darum nutzt der Bot es nicht (`MissionBot.weather()` gibt es trotzdem).

`playMission(id, seed, { passive })` spielt eine Mission headless und liefert einen Bericht
(Sieg/Niederlage, Dauer, Minute jedes Ziels, Rohstoffkurven je Minute, Heeresgröße, Verluste).
`passive: true` baut nur Wirtschaft (Gegenprobe: Mission 2 und 5 müssen dann verloren gehen).

```bash
node scripts/campaign-matrix.js            # 5 Missionen × 4 Karten + Gegenproben, Tabelle
node scripts/campaign-matrix.js c5 --json  # Rohdaten einer Mission
npx vitest run tests/sim/campaign.test.js  # Regression: 2 Karten je Mission + Gegenproben
```

### Vorgaben und Ergebnisse

Zeitlimit = spätester akzeptierter Sieg des Bots (Spielminuten). Ergebnisse auf den Karten
Missionsseed, 7, 99, 31337 (Stand nach der zweiten QA-Runde, `node scripts/campaign-matrix.js`):

| Mission | Limit | Vorher (alte Missionen, Bot) | Jetzt: Siege | Dauer (min) | Verluste Bot (Hauptleute/Soldaten) | Passiver Bot |
|---|---|---|---|---|---|---|
| c1 | 20 | 4/4, 3,5–3,9 min; Nebenziel nie | 4/4 | 3,2–4,0 | 0/0 | – |
| c2 | 30 | 4/4, 9,6 min, praktisch verlustfrei | 4/4 | 9,6–9,8 | 0 / 6–15 | verliert (Min. 6–8) |
| c3 | 40 | 2/4 (Siedlung blockiert, Gisbert griff nie an) | 4/4 | 16,3–19,7 | 0–2 / 0–14 | verliert bzw. kommt nicht weiter |
| c4 | 40 | 2/4 (Hedda im Kerker eingeschlossen) | 4/4 | 3,4–3,9 | 0 / 2–4 | verliert beim Tauwetter |
| c5 | 60 | 1–2/4 (Miliz-Abwehr, Zeitüberschreitung) | 4/4 | 16,5–23,1 | 0–1 / 0–17 | verliert (Min. 19–20) |

Rohausgabe:

```
Mission Seed   Bot     Ergebnis                   Zeit    Limit  Heer  Verluste (H/S/L/Gb)  Ziele (Minute)
c1      1101   aktiv   Sieg                       3.2m    20m    0     0/0/0/0              homes:1.5 lookout:2.3 pit:3 farms:3.1 workers:3.2
c1      7      aktiv   Sieg                       4m      20m    0     0/0/0/0              homes:1.4 lookout:1.9 pit:2.7 workers:3 farms:4
c1      99     aktiv   Sieg                       3.5m    20m    0     0/0/0/0              homes:1.4 lookout:2 farms:2.8 pit:3.3 workers:3.5
c1      31337  aktiv   Sieg                       3.5m    20m    0     0/0/0/0              homes:1.4 lookout:2 farms:2.7 pit:3.4 workers:3.5
c2      2202   aktiv   Sieg                       9.8m    30m    7     0/10/6/0             barracks:1.5 army:1.6 militia:5.1 survive:9 camp:9.8 protectVc:null bigArmy:–
c2      7      aktiv   Sieg                       9.7m    30m    8     0/6/4/0              barracks:1.7 army:1.7 survive:9 bigArmy:9 camp:9.7 protectVc:null militia:–
c2      99     aktiv   Sieg                       9.7m    30m    8     0/11/48/0            barracks:1.5 army:1.6 survive:9 bigArmy:9 camp:9.7 protectVc:null militia:–
c2      31337  aktiv   Sieg                       9.6m    30m    7     0/15/2/0             barracks:1.6 army:1.6 survive:9 camp:9.6 protectVc:null bigArmy:– militia:–
c3      3303   aktiv   Sieg                       17.9m   40m    6     0/2/2/0              science:6.3 mood:10 ford:10.5 settle:14.8 people:17.9
c3      7      aktiv   Sieg                       16.3m   40m    6     2/14/0/0             science:4.5 mood:10 ford:10.6 settle:13.6 people:16.3
c3      99     aktiv   Sieg                       19.7m   40m    7     0/0/0/0              science:4.8 mood:10 ford:10.5 settle:12.9 people:19.7
c3      31337  aktiv   Sieg                       17.3m   40m    5     0/6/6/0              science:4.9 mood:10 ford:10.8 settle:14.7 people:17.3
c4      4404   aktiv   Sieg                       3.9m    40m    5     0/4/0/0              prepare:0.1 firewood:3.2 cross:3.6 guards:3.6 home:3.9 bertram:null
c4      7      aktiv   Sieg                       3.5m    40m    5     0/3/0/0              prepare:0.1 cross:3.1 firewood:3.1 guards:3.3 home:3.5 bertram:null
c4      99     aktiv   Sieg                       3.5m    40m    5     0/2/0/0              prepare:0.1 firewood:3.1 cross:3.1 guards:3.3 home:3.5 bertram:null
c4      31337  aktiv   Sieg                       3.4m    40m    5     0/4/0/0              prepare:0.1 cross:3.2 firewood:3.2 guards:3.2 home:3.4 bertram:null
c5      5505   aktiv   Sieg                       19m     60m    12    0/0/0/0              army:1.2 castle:19 towers:– cannons:–
c5      7      aktiv   Sieg                       23.1m   60m    11    0/10/17/0            army:1.2 castle:23.1 towers:– cannons:–
c5      99     aktiv   Sieg                       16.5m   60m    12    0/17/0/0             army:1.2 castle:16.5 towers:– cannons:–
c5      31337  aktiv   Sieg                       17.2m   60m    12    1/12/3/0             army:1.2 castle:17.2 towers:– cannons:–
c2      2202   passiv  Niederlage (protectVc)     5.8m           0     0/0/46/5             barracks:1.5 protectVc:✗5.8 army:– survive:– camp:– bigArmy:– militia:–
c2      7      passiv  Niederlage (protectVc)     7.8m           0     0/0/57/7             barracks:1.7 protectVc:✗7.8 army:– survive:– camp:– bigArmy:– militia:–
c5      5505   passiv  Niederlage (hq)            18.6m          0     0/0/95/27            castle:– army:– towers:– cannons:–
c5      7      passiv  Niederlage (hq)            19.8m          0     0/0/105/28           castle:– army:– towers:– cannons:–
```

Nebenziele: c1 Posten, c2 6 Einheiten, c3 Furt und Motivation, c4 Brennholz (jetzt 2500 statt 3000, vorher in der kurzen Mission kaum möglich) erreicht der Bot regelmäßig;
c2 „Miliz“ nur, wenn es eng wird; c5 „Türme“ schafft er, wenn er sie zuerst angreift
(`attack(['towers', 'castle'], …)`, getestet auf 3 von 4 Karten), „Kanonen“ liegt hinter Metallurgie.

### Designnotizen

- **c1 Neubeginn** (Einstieg, 3,5–4 min): reiner Aufbau. Das Nebenziel ist jetzt „Räuber vom Posten
  vertreiben“ (Wachen besiegen); danach brennt der Posten von selbst ab. Vorher musste Bertram allein
  ein Lager mit 1200 LP einreißen (über 4 Minuten). Mit Aura der Stärke schafft er die drei
  Speerträger in gut einer Minute.
- **c2 Feuer im Wald** (≈ 10 min, Zeit fest durch drei Wellen bis Minute 9): Wellen deutlich stärker
  (3 → 7 → 8 Truppen), das Lager hat jetzt 5 Wachtrupps. Mit 6–8 Einheiten und Bertram hält man stand
  und verliert ein paar Soldaten; ohne Truppen fällt das Dorfzentrum zwischen Minute 7 und 10.
  Nebenziel „6 Einheiten“ ist mit den Startrohstoffen plus Eisengrube erreichbar.
- Dauer und Schwierigkeit steigen nicht im Gleichschritt: c4 ist bewusst kurz (Wetterfenster), aber
  durch Zeitdruck und Eiskampf fordernder als c3; c5 ist die längste und verlustreichste Mission.
- **c3 Die Furt** (15–25 min): 40 statt 25 Arbeiter – die Bevölkerung reicht nur mit dem zweiten
  Dorfzentrum (75 Plätze für Leibeigene, Arbeiter und Soldaten). Gisbert erwachte zwar beim
  Siedeln, hatte aber meist kein Heer und griff nie an; jetzt zieht 4 Minuten nach der Baustelle
  sicher seine Hauswache (8 Trupps) gegen die neue Siedlung, dazu sein eigenes Heer. Ohne Truppen
  fällt danach die Burg.
- **c4 Spiegelsee** (≈ 4–5 min, durch das Wetter begrenzt): kurze Kommandomission, schwer durch
  Zeitdruck und Kampf auf dem Eis. Fehler mit dem neuen Gelände: Liegt das Kerkerlager in der
  Inselmitte, erschien Hedda im Lager eingeschlossen und kam nie heim (Karten 99, 7). Sie erscheint
  jetzt auf festem, freiem Inselboden neben dem Kerker. Tauwetter beendet die Mission auch, wenn
  Hedda frei, aber noch nicht daheim ist (vorher saß sie sonst bis zum nächsten Winter fest).
  Herbst/Winter stehen als `AUTUMN`/`WINTER` in der Datei, Warnung und Niederlage richten sich danach.
  Stärkere Kerkerwachen (5 Trupps) und Überfall (4 Trupps, 40 s nach dem Frost); vorzubereiten sind
  4 statt 2 Einheiten. Tests prüfen auf vier Karten: Insel, Kerker und Wachen nur über das Eis
  erreichbar, Überfallweg erreichbar, Frost nach 3 und Tauwetter nach 8 Minuten.
- **c5 Krone** (≈ 16–23 min): Morwald startet mit der Burg (nicht Festung; er baut selbst aus, die Wache rückt bei halber Burg-LP aus),
  höchstens 20 Leibeigenen und **ohne Miliz** („seine Knechte greifen für ihn nicht zu den Waffen“,
  steht im Briefing). Mit Miliz (28 Leibeigene mit Angriff 10, 200 LP) war jeder Sturm auf die Burg
  aussichtslos – der Bot gewann je nach Karte nach 15 Minuten oder gar nicht. Startgold 3000 statt
  2500. Ohne Heer fällt die eigene
  Burg spätestens bei den Wutangriffen ab Minute 25.
- Neue Missionsfelder für Computergegner: `aiSerfs` und `militia` (siehe Tabelle „Spieler“).

### Bekannte Grenzen

- Gebäude haben hohe Rüstung; Nahkämpfer machen fast nur Mindestschaden. Burgen fallen nur mit
  vielen Truppen und Aura der Stärke; Kanonen ab Metallurgie sind der eigentliche Belagerungsweg
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
