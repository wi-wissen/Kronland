# Missionen schreiben

Jede Mission ist ein **Level-Ordner in Python**: `scenario.json` sagt, was es gibt, `world.py` baut die Karte um,
`mission.py` erzählt (Format, Felder und die ganze API in [SKRIPTE.md](SKRIPTE.md#kampagne-in-python), Befehle mit
Beispielen in der Programmier-Referenz `scripting/`). Kampagne (`c1`–`c6`), Tutorial, Skript-Missionen und
Kursmissionen liegen in `src/sim/missions/levels/`; nur die Entwicklerkarten Schaukasten und Gewimmel sind JS
(siehe [Sonderkarten](#sonderkarten)).

Alle Missionen laufen über dieselbe Missionslaufzeit (`src/sim/missions/runtime.js`). Sie hängt sich über drei kleine
Haken in die Simulation:

| Haken | Wann | Wozu |
|---|---|---|
| `setup(sim)` | Ende des `Sim`-Konstruktors | Spieler, Räuber, Dörfer, Wetter, Schächte; dann das Missionsprogramm (Weltaufbau, Ziele, Handler) |
| `update(sim)` | Ende jedes Takts | Räuberwachen, Gesprächsfiguren, Ziele, Missionsprogramm, Sieg/Niederlage |
| `command(sim, cmd)` | Befehl `{ type: 'mission', action }` | `tribute` (Angebot bezahlen), Tutorial: `next`, `skip`, `ui` |

Die Laufzeit hält, was das Programm aufruft: Ziele und Endregel, Räuberlager, Dörfer, Gesprächsfiguren, Tribute,
Freischaltungen, geführte Schritte, Dialog und Kamera. **Wann** etwas geschieht, steht nur im Python-Programm – die
frühere JSON-Sprache aus Zieltypen, Auslösern und Aktionen gibt es nicht mehr. Alles ist deterministisch
(Ganzzahlen, feste Reihenfolgen, eigener Zufall). Der Missionszustand (`mission.state`) ist reines JSON und steckt
mit dem ganzen Szenario samt Code im Spielstand; Spielstände der früheren Missionsdateien lassen sich nicht
fortsetzen (`saves.err.missionChanged`).

## Neue Mission

1. Ordner `src/sim/missions/levels/<id>-<name>/` mit `scenario.json`, `world.py`, `mission.py` anlegen; Vorlagen sind
   die Kampagnenkapitel (`c1-lindgrund` Aufbau und Gespräche, `c3-hagenfurt` geformte Landschaft, `c6-thronsee`
   Gegner mit Wetterkraftwerk) und das Tutorial. `"kind": "campaign"` (mit `order`, `next`) reiht das Kapitel in die
   Kampagne ein, `"tutorial"`, `"mission"` und `"adventure"` entsprechend – der Ordner wird von selbst gefunden.
2. `next` der vorigen Mission auf die neue ID setzen.
3. `npx vitest run tests/sim/missions.test.js` richtet jede Kampagnenmission auf mehreren Karten ein (Skriptfehler,
   Orte erreichbar); für die Kampagne zusätzlich eine Strategie im Test-Bot (`tests/sim/missionBot.js`) und
   `node scripts/campaign-matrix.js <id>`.

Direktstart zum Ausprobieren: `play/?mission=c3` (optional `&seed=7`, `&no-models`).

**Niemals feste Koordinaten.** Der Kartengenerator ändert sich (Relief, Klippen). Alle Plätze werden von Burgen,
Startplätzen, der Kartenmitte oder anderen gefundenen Punkten aus gesucht (`find_open`, `toward`, `place_building`,
`camp`); ganze Landschaften formen die `world.*`-Befehle entlang einer Achse (`world.ridge`, `world.ridge_gap`,
`world.lake_island`, `world.moat`, `world.island` …), Gegenproben macht `world.reachable`.

### Spieler (`players` in scenario.json)

| Feld | Bedeutung |
|---|---|
| `kind` | `human` (immer Spieler 0), `ai`, `bandits`, `village` |
| `hero` / `heroes` | ein Held (`nelia`, `orrin`, `taran`, `malvor`), mehrere als Liste (erster = Haupt-Held) oder `null` |
| `hq` | `false`: ohne Burg, Dorfzentrum und Leibeigene (Kommandomission, Kursmission) |
| `stock` | Startrohstoffe (veredelt); fehlende bleiben beim Standard |
| `serfs`, `techs`, `team` | Leibeigene, Technologien, Team |
| `difficulty` | KI: `easy`, `normal`, `hard` |
| `aggression` | KI: `passive` (greift nie selbst an), `normal`, `aggressive` (früher, kleinere Heere) |
| `startDelay` | KI wartet so viele Sekunden |
| `forbid` | Gebäude, die die KI nicht baut |
| `aiSerfs` | KI: höchstens so viele Leibeigene (weniger Wirtschaft und kleinere Miliz) |
| `militia` | KI: `false` = bewaffnet ihre Leibeigenen nie |
| `look` | Räuber: `soldiers` – sie sehen aus wie Soldaten (Wachposten, Belagerer eines Gegners ohne Burg) |
| `name`, `diplomacy` | Dorf: Name (im Code `player("moorbrook")`) und Abweichungen, z. B. `{ "human": "allied" }` |

**Räuber** bauen nie und zählen nicht als Gegner für den Sieg. Ihre Lager legt `camp()` an; die Wachen bleiben stehen
und greifen an, sobald Feinde näher als `r` + 3 Kacheln kommen, danach kehren sie zurück. Angriffe kommen über
`spawn()` + `attack()`. **Dörfer** sind eigene Spielerplätze ohne Burg und ohne KI, zu Beginn zu allen neutral;
Gebäude bekommen sie mit `place_building("moorbrook", …)`, Freundschaft mit `set_diplomacy()`.

Weitere Felder: `available` (schrittweise Freischaltung, unten), `shafts` (Grubenplätze nur für diese Rohstoffe),
`landmarks` (Wahrzeichen, nur Darstellung: Grundmauern eines Gebäudes an einem Ort), `weatherCycle` (Wetterfolge in
Takten), `world.fog`/`world.vision`, `noDefeat` (Tutorial), Texte `briefing`, `victoryText`, `debrief`,
`defeatTexts` und `debriefs` je Grund. Alle sichtbaren Texte sind zweisprachig `{ de, en }`, im Code `de=`/`en=`.

## Ziele

Ziele legt das Missionsprogramm an: `objective(id, bedingung, de=…, en=…, primary=True, hidden=False)`. Die
Bedingung liefert `True`/`False`, ein Paar `(stand, ziel)` für den Fortschritt oder ein Tripel
`(stand, ziel, erfüllt)` (Balken, der nicht von selbst erfüllt, z. B. Malvors Ladung in Mission 6).
`hold=True` macht ein **Halteziel** („Schütze die Höfe“): erfüllt, solange die Bedingung gilt, gescheitert, sobald
sie es nicht mehr tut. `clock=True` zeigt das Paar als Uhr (Countdown vor dem Tauwetter in Mission 3).
`show_objective()`, `complete()`, `fail()` steuern von Hand, `@on_objective` reagiert. Menüs lesen die Ziele vorab aus
dem Code (`scenarioGoals`, `outline.js`).

**Ende** (`"end": "objectives"`, Standard): gewonnen, sobald alle Hauptziele erfüllt sind (Halteziele dürfen noch
laufen und zählen dann als erfüllt); ein laufendes Gespräch hört man vorher zu Ende. Verloren, wenn die eigene Burg
fällt (Grund `hq`) oder ein Hauptziel scheitert (Grund = seine ID). `ending("stormed")` wählt Siegestext und
Nachgeschichte nach dem genommenen Weg (Mission 2), `victory()`/`defeat(reason)` beenden sofort.

**Zielorte und Zeiger:** `hint(id, area=…, entity=…, ui=…, ui_until=…)` – Ring und Pfeil auf der Karte, im Zielpanel
ein Knopf, der die Kamera hinfährt; `ui` (Liste von `data-testid`s, z. B. `["build-clayMine", "quick-all"]`) umrandet
den ersten sichtbaren Knopf mit dem leuchtenden Rahmen des Tutorials (`UiPointer.vue`), bis `ui_until` gilt (z. B.
die Baustelle steht).

**Schrittweise freischalten (Kampagne):** Mit `available` gibt es für den Menschen nur die genannten Gebäude und
Forschungen; alles andere steht ausgegraut mit Schloss im Menü („In dieser Mission nicht verfügbar“) und wird von der
Simulation abgelehnt (`err.notInMission`). `unlock("barracks")` schaltet im Lauf frei. Ohne `available` (freies
Spiel, eigene Szenarien, Mission 6) gibt es alles; Computergegner sind nie betroffen.

## Tribute (Kaufen oder Kämpfen)

Wie im Vorbild: Ein Tribut ist ein Angebot im Missionsfeld („Angebote“). `offer(id, {"gold": 1200}, de=…, en=…,
group="shard")` bietet an, Bezahlen zieht die Kosten ab und löst `@on_event("tribute", id=…)` aus; Angebote derselben
`group` schließen einander aus – so entsteht eine Wahl (Söldner oder geflohene Leibeigene, Freikauf oder Sturm aufs
Lager). `withdraw()` zieht zurück. Befehl der Oberfläche: `{ type: 'mission', action: 'tribute', id }` (Ablehnung
`err.noTribute` bzw. `err.notEnoughResources`). Lieferquests sind ebenfalls Tribute (Mission 5).

## Gesprächsfiguren

`npc(id, look=…, at=…, speaker=…, owner=…)` stellt eine Figur mit Ausrufezeichen auf. Ein Held geht hin, wenn man ihn
auswählt und die Figur antippt (Befehl `order: 'talk'`); dort startet `@on_talk(id)` mit dem Helden – die Mission
entscheidet, ob es der richtige ist (sonst ein Hinweis wie „Ich warte auf Orrin“). `look` ist eine Rolle des
Figuren-Manifests (`serf`, `worker.miner`, auch ein Held wie `hero.orrin`, der sich nach dem Gespräch per
`remove()` + `add_hero()` anschließt), `speaker` lenkt die Dialogkamera auf die Figur. Die Figur ist ein eigenes
Entity (`kind: 'npc'`), kämpft nicht und kann nicht angegriffen werden.

## Tutorial-Schritte

Das Tutorial ist ein Python-Programm (`levels/tutorial/mission.py`): Jeder Schritt ist ein Aufruf von `step()`, der
wartet, bis seine Handlung erledigt, „Weiter“ gedrückt oder der Schritt übersprungen ist; was davor steht (Kamera,
Gebäude, Räuber), läuft beim Betreten.

```python
farm = first("farm")
step("workers", until=lambda: count("worker") >= 1, next=True,          # next=True: „Weiter“ trotz Bedingung
     title={"de": "Arbeiter ziehen ein", "en": "Workers arrive"},
     de="Arbeiter kommen von selbst …", en="Workers come …",
     touch={"de": "…", "en": "…"},                                      # optional: Text für Touch-Geräte
     hint={"entity": farm})                                             # oder "ui": [...], "area": "shaft"
step("camera", ui="camera", next=True, …)                              # Prüfung, die nur die Oberfläche sieht
```

- `hint["ui"]`: `data-testid`-Werte; der Zeiger (`UiPointer.vue`, auch für Missionsziele) umrandet das erste sichtbare Element der Liste.
- `hint["entity"]` / `hint["area"]`: 3D-Marke auf der Karte (`src/render/hints.js`).
- `ui="camera"`/`"selectSerfs"`: Die Engine liest die Prüfung aus `uiState().tutorial.watch` und meldet sie einmal als
  Befehl `{ type: 'mission', action: 'ui', check }`; nur Meldungen nach Beginn des Schritts zählen.
- „Weiter“ (`next`) gibt es bei Lese-Schritten (ohne `until`/`ui`) und mit `next=True`, „Überspringen“ (`skip`)
  immer; beide sind Sim-Befehle. Was vor dem nächsten `step()` steht, läuft trotzdem, damit spätere Schritte ihre
  Gebäude haben. Die Zahl der Schritte liest `scenarioSteps` (`outline.js`) aus dem Code, Zeilen im Tutorial
  (`say(…, wait=False)`) halten keinen Schritt auf.

## Sonderkarten

Einzelne fertige Karten außerhalb der Kampagne, im Startmenü unter **Freies Spiel → Karte auswählen**
(`src/ui/FreePlay.vue`). Die Liste ist `SPECIAL_MAPS` in `src/sim/missions/registry.js`; sie
erscheinen mit Titel, Zusammenfassung, Briefing und den Wegweisern als „Orte auf der Karte“. Nach dem Ende führt
„Zurück“ wieder ins Freie Spiel.

Schaukasten und Gewimmel sind **Entwicklerwerkzeuge** und bleiben JS-Module im Repo (nie aus einer Level-Datei
erreichbar). Sie haben dieselben Datenfelder wie `scenario.json` (`players`, `weatherCycle`, `fog`, `noDefeat` …) und
einen kleinen Haken statt Python:

| Feld | Wozu |
|---|---|
| `setup(ctx)` | Karte aufbauen; `ctx.sim`, `ctx.api` (`setupApi.js`), `ctx.hqCenter(p)`, `ctx.mapCenter()`, `ctx.ref(name, wert)` (Orte und Figuren in `state.refs`), `ctx.warn(text)` (Tests schlagen dann fehl), `ctx.camp(name, nahe, truppen, o)` (Lager, Bezüge `name`, `nameGuards`, `nameArea`), `ctx.npc(id, { at, look, speaker })` |
| `tick(sim, m)` | jeden Takt (z. B. Nachschub im Gewimmel) |
| `talk(sim, m, id, held)` | ein Held ist bei einer Gesprächsfigur angekommen |
| `objectives` | Wegweiser `{ id, type: 'signpost', text, hint: { area } }` – Nebenziele ohne Bedingung, nur „Ziel zeigen“ |
| `lines` | Dialogzeilen der Karte für die Sprachaufnahmen (`dialogLines.js`) |

### Schaukasten

`src/sim/missions/showcase.js` (ID `showcase`) ist eine Ausstellungskarte: Zufallskarte 128×128 (Seed 1), um die Burg
wird ein Rechteck eingeebnet, darauf steht alles, was das Spiel zeichnen kann. Kein Nebel (`fog: false`), alle
Parteien neutral, keine Hauptziele (kein Sieg), `noDefeat`.

- Laden: `play/?mission=showcase` (gern mit `&quality=high`) oder Startmenü → **Freies Spiel** → „Karte auswählen“ → „Schaukasten“.
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

- Laden: `play/?mission=bustle` oder Startmenü → **Freies Spiel** → „Karte auswählen“ → „Gewimmel“. Messen mit F3/`?dev=1`
  (Bilder/s, Zeichenaufrufe, Dreiecke, Figuren je Stufe).
- Aufbau (`setup`): je Spieler eine Stadt aus `TOWN` (Wohnhäuser und Höfe in Stufe 3, alle Werkstätten,
  Militärgebäude, Türme, Zierden, vier Schächte) mit allen Arbeitsplätzen besetzt, 50 Leibeigene im Wald, ein
  Heer vor der Burg (`HOME_ARMY`). Nahe der Kartenmitte zwei Schlachtfelder (`BATTLES`: Spieler 1 gegen 2 im
  Norden, 3 gegen 4 im Süden) auf offenem Land ohne Wasser und Steilhang (`findBattlefield`, die Mitte selbst kann
  ein Berg sein), mit je zwei Wellen (`WAVE`) pro Seite im Angriffsmarsch.
- Nachschub (`tick`): alle 40 s eine neue Welle je Seite, solange der Spieler unter 60 Truppen hat
  (`state.refs.waves` zählt mit).
- Größenordnung: zu Beginn ~180 Gebäude und ~1 150 Figuren, nach vier Spielminuten ~1 600 (KI rekrutiert dazu);
  die Simulation braucht dann ~16 ms je Takt (Budget 100 ms).
- Ziele-Liste: Wegweiser zu beiden Schlachten und den vier Städten („Ziel zeigen“).
- `heavy: true`: rechenintensive Karte – der Dauertest `tests/sim/fuzz.test.js` läuft hier 800 statt 3000 Takte.
- Test: `tests/sim/stress.test.js` (Mindestzahlen, Nachschub, Determinismus), `e2e/special-maps.spec.js`
  (Menü, Bildschirmfotos Schlacht/Stadt/Überblick und Zeichenaufrufe nach `test-results/special-maps/`).

## Oberfläche

`Engine.uiState().mission` liefert `{ objectives, tutorial, messages, tributes, camera, result, pointer }`
(`pointer`: Knöpfe, auf die gerade gezeigt wird – Tutorial-Schritt oder erstes Ziel mit `hint.ui`).
Komponenten in `src/ui/mission/`: `MissionHud` (Coach, Ziele, Angebote, Dialog, Zeiger),
`MissionResult`.

**Dialoge** (`DialogBox.vue`): eine Mitteilung nach der anderen. Weiter geht es erst, wenn die Anzeigezeit um ist
(Skript: so lange, wie die Simulation wartet; sonst Lesezeit, mit Aufnahme mindestens 2,5 s) **und** die Aufnahme
zu Ende gesprochen ist (plus 0,45 s Pause) – so fällt kein Sprecher dem anderen ins Wort. ✕ beendet den Satz,
„Gespräch überspringen“ alle wartenden Sätze. Vor dem ersten Satz
wartet der Dialog auf den Index der Aufnahmen. Solange eine Stimme spricht, sinken Musik (auf 22 %) und Umgebung
(55 %) und kommen danach weich zurück (`AudioEngine.duck`). Die Aufnahmen gehören zum Text (Index
`sprecher|sprache|text`), darum bleiben Dialogzeilen beim Umbau wortgleich; ein Test prüft, dass jede `say()`-Zeile
aller Kapitel vertont ist (außer den Hinweisen für den falschen Helden).
**Dialogkamera** (`Engine.dialogFocus`, Einstellung „Kamera bei Dialogen“): Spricht eine sichtbare Figur (Held
oder Gesprächsfigur), fährt die Kamera in 1,1 s auf Abstand 8 an sie heran (Nahansicht mit flachem Blick); nach
dem letzten Satz fährt sie zurück. Bewegt der Spieler die Kamera selbst, bleibt sie dort.
**Freie Sicht** (`src/render/sightline.js`, `Engine.viewTurn`): Skriptkamera (`camera.jump_to`/`fly_to`, Tutorial-
Kamerasprünge) und Dialogkamera prüfen, ob Baumkronen, große Felsen, Rohstoffhaufen, Häuser oder Gelände zwischen
Kamera und den Figuren am Ziel stehen (bis 6 sichtbare Figuren im Umkreis von 2,5 Feldern, sonst der Zielpunkt;
vereinfachte Formen: Zylinder und Quader statt Meshes). Ist die Sicht verdeckt, dreht die Kamera in Schritten
bis 180° (kleinste Drehung zuerst), reicht das nicht, blickt sie zusätzlich steiler. Bei Fahrten gleitet die Drehung
mit; die Dialogkamera dreht beim Zurückfahren wieder zurück. Nur Darstellung, die Simulation merkt davon nichts.

Feste Oberflächentexte stehen unter `mission.*` in `src/i18n/de.js`/`en.js`.
Tutorial-Hinweise (`hint.ui`) zeigen auf `data-testid`s, z. B. `quick-all`, `build-residence`,
`build-toggle`, `buy-serf`, `tech-education`, `payday`, `upgrade`, `recruit-full-sword`, `ability-courage`;
zeigt ein Hinweis auf ein Gebäude, wechselt das Baumenü in dessen Kategorie. Kampagnenfortschritt (freigeschaltet, Bestzeit) liegt in
`localStorage['kronland-campaign-1']`.

## Die Kampagne

| # | ID | Ordner | Titel | Neues |
|---|---|---|---|---|
| 0 | `tutorial` | `levels/tutorial/` | Erste Schritte | alle Grundlagen geführt (`step()`) |
| 1 | `c1` | `levels/c1-lindgrund/` | Lindgrund | Winter; Nelia trifft Orrin (Gesprächsfigur, schließt sich an), erste Zacke, Wohnen/Essen/Arbeiter, Eintreiber vertreiben; Nachbardorf über Orrins Gespräch verbündet (optional) |
| 2 | `c2` | `levels/c2-beaucroix/` | Beaucroix | Winter; Marktplatz und Handel, nach dem ersten Tausch: Malvors Herold, Kaserne frei, Zacke freikaufen (Tribut) oder Räuberlager stürmen (andere Nachgeschichte, `ending`), Lehmschuld beim Kaufmann als Nebenquest |
| 3 | `c3` | `levels/c3-hagenfurt/` | Das Wetterwerk | Kommandomission ohne Burg in einem mit `world.*` geformten Tal: Tor oder zugefrorener Fluss (Posten bestechen), Wetterwerk auf der Insel, Flucht vor dem Tauwetter (60 s, Uhr), Baupläne sichern |
| 4 | `c4` | `levels/c4-eisenhain/` | Eisenhain | Belagerung brechen, Taran als feindlicher Held, Söldner oder Leibeigene (Tribute), Bergmeister übergibt die Zacke |
| 5 | `c5` | `levels/c5-morvale/` | Morvale | Herold macht die Dörfer neutral, Taran läuft nach den Regeln des Bestechens über (`convert`) und wird spielbar, Höfe schützen (Halteziel), Dörfer per Lieferung zurückgewinnen |
| 6 | `c6` | `levels/c6-thronsee/` | Der Thronsee | Inselschloss im See (`world.moat`), Wetterkraftwerk erforschen oder Wissen kaufen, Winter auslösen, Sturm übers Eis; Malvors eigenes Kraftwerk (`world.island`, gleiche Regeln: `change_weather`) taut den See, Orrin wird verwundet |

Story, Figuren und die Zuordnung zu den Siedler-5-Mechaniken: [Kampagne](KAMPAGNE.md).

## Balancing und Test-Bot

Die Kampagne wird mit einem Spieler-Bot geprüft (`tests/sim/missionBot.js`, Klasse `MissionBot`).
Er gibt nur Befehle, die auch die Oberfläche geben kann, liest aber den ganzen Zustand
(perfekte Information) – Orte und Figuren der Level über `ref()` (Orte und Variablen des Python-Programms) und
`point()`. Je Mission gibt es eine Strategie (`STRATEGIES`): Bauplan, Forschung, Ausbauten, Gebäude-Technologien,
Rekrutierplan, Steuerpolitik und ein kleines Skript für die Ziele. Allgemein kann er:

- Leibeigene kaufen und verteilen (Baustellen zuerst, dann Holz bzw. knappe Rohstoffe an Haufen
  außerhalb von Räuberlagern), Wohnhäuser/Bauernhöfe nach Bedarf der Arbeitsplätze, weitere
  Dorfzentren bzw. Ausbau bei voller Bevölkerung, Minen auf sicheren Schächten, Veredler,
  Marktplatz-Handel (Überschuss gegen Taler), Steuern nach Motivation, Reparatur;
- Truppen ausheben, auffüllen und aufwerten, am Sammelpunkt halten, Burg/Schutzziele verteidigen
  (Miliz, wenn es eng wird), Ziele angreifen (Sammelpunkt vor dem Ziel außer Reichweite der Türme,
  dann gezielter Sturm, Rückzug bei hohen Verlusten, Nachschub wartet), Kleinsteuerung (wer ein
  Gebäude schlägt, während Feinde danebenstehen, wird umgelenkt), Heldenfähigkeiten
  (Mut machen vor dem Sturm, Schildstoß, Einschüchtern, Wundsalbe, Bestechen mit Rücklage);
- Missionsbausteine wie ein Mensch bedienen: Tribute bezahlen (`payTribute`), Helden zu Gesprächsfiguren schicken
  (`talkTo`, wie ein Tippen), Kommandomission ohne Burg (nur Skript und Fähigkeiten).
- Je Mission ein kleines Skript: Mission 1 Orrin treffen, Nelia zur Wurzel und beide Helden gegen die Eintreiber,
  Mission 2 Lehmschuld, Markt, Lehm/Stein gegen Taler, dann Freikauf, Mission 3 Trupp zur Insel (Helden dahinter),
  Mission 4 Leibeigene aufnehmen, dann Belagerer angreifen, Mission 5 Lieferungen zuerst, Mission 6 Wissen kaufen,
  Wetterkraftwerk vor dem Heer, Malvors Kraftwerk vom Ufer beschießen, Winter mit 9 Truppen und voller Energie, dann
  Sturm aufs Schloss.

`playMission(id, seed, { passive })` spielt eine Mission headless und liefert einen Bericht
(Sieg/Niederlage, Dauer, Minute jedes Ziels, Rohstoffkurven je Minute, Heeresgröße, Verluste, Skriptfehler als
Warnungen). `passive: true` baut nur Wirtschaft (Gegenprobe: Mission 5 gewinnt er nie, Mission 6 verliert er).

```bash
node scripts/campaign-matrix.js            # 6 Missionen × 4 Karten + Gegenproben, Tabelle
node scripts/campaign-matrix.js c6 --json  # Rohdaten einer Mission
npx vitest run tests/sim/campaign.test.js  # Regression: 2 Karten je Mission + Gegenproben
```

### Vorgaben und Ergebnisse

Zeitlimit = spätester akzeptierter Sieg des Bots (Spielminuten). Ergebnisse auf den Karten Missionsseed, 7, 99,
31337 (`node scripts/campaign-matrix.js`, Kampagne „Krone aus Eis“ als Python-Level):

| Mission | Limit | Siege | Dauer (min) | Verluste Bot (Hauptleute/Soldaten) | Weg des Bots | Passiver Bot |
|---|---|---|---|---|---|---|
| c1 Lindgrund | 20 | 4/4 | 6,3–7,1 | 0/0 | Helden gegen Eintreiber, Nachbardorf mit | – |
| c2 Beaucroix | 30 | 4/4 | 8,4–9,6 | 0/0 | Freikauf (Lehmrabatt) | – |
| c3 Wetterwerk | 20 | 4/4 | 3,6–4,2 | 0 / 4–9 | Schlucht, Posten bestechen | – |
| c4 Eisenhain | 40 | 4/4 | 15,6–31,2 | 0–3 / 0–17 | Leibeigene, eigene Truppen | – |
| c5 Morvale | 40 | 4/4 | 12,4–14,0 | 0–2 / 2–8 | Lieferungen | gewinnt nie (ohne Lieferungen kehren die Dörfer nicht zurück) |
| c6 Thronsee | 60 | 4/4 | 40,3–46,8 | 0–1 / 1–12 | Wissen gekauft | verliert (Min. 32–37) |

Mission 4 schwankt stark je Karte: Auf 24 weiteren Karten gewinnt der Bot 22-mal, im Mittel nach etwa 19 Minuten
(als Missionsdatei 21-mal nach etwa 17 Minuten). Der andere Weg der Kauf-oder-Kampf-Entscheidungen (Lager stürmen, Söldner) ist durch Tests in
`tests/sim/missions.test.js` und `tests/sim/campaign.test.js` abgedeckt, aber nicht mit dem Bot durchgespielt.

### Designnotizen

- **Gold ist der Engpass.** In Mission 2 bringt erst der Marktplatz (Lehm und Stein gegen Taler) das Geld für den
  Freikauf. Freikauf in Holz statt Eisen: Eisen gibt es in Beaucroix nicht.
- **Mission 5:** Erlenhof verlangte zuerst 600 Taler – der Bot brauchte dann 30–50 Minuten. Jetzt 300 Taler und
  500 Lehm, jede Lieferung fordert andere Rohstoffe.
- **Mission 6:** Das Wissen der Gelehrten ist sofort bezahlbar, danach reicht es für das Wetterkraftwerk. Wer erst
  Truppen kauft, hat kein Geld für das Kraftwerk. Der See (Breite 4) liegt so nah wie möglich um die Burg (Ring
  11–18 Kacheln, ohne Gebäude zu fluten). Malvor taut, sobald jemand auf dem Eis steht (geprüft in jedem Takt).
- **Mission 3:** Die Wachen am Werk (2 Schwert-, 1 Bogentrupp) und der Alarm (2 Schwerttrupps) schaffen drei
  Trupps nur mit beiden Helden; stärkere Wachen ließen den Bot ohne Helden scheitern und mit Helden sterben.
- **Lagerwachen** bekommen nur dann einen neuen Angriffsbefehl, wenn sie gerade keinen Gegner im Visier haben.
- **Zeitpunkte:** Wellen und Ausfälle rechnen von einem festen Zeitpunkt aus (`wait_until(lambda: time() >= …)`),
  nicht ab dem Ende der Zeilen davor – sonst verschöbe jede Dialogzeile den Rhythmus.

### Bekannte Grenzen

- Gebäude haben hohe Rüstung; Nahkämpfer machen fast nur Mindestschaden. Burgen fallen nur mit
  vielen Truppen und „Mut machen“; Kanonen ab Metallurgie sind der eigentliche Belagerungsweg
  (Spielregel, kein Fehler).
- Behobene Befunde der QA-Runden (Wasserecken, Angriffe auf Gebäude, erreichbare KI-Ziele) stehen in
  `QA-BERICHT.md`.
