# Skripte, Lernabenteuer und Welteneditor

Kronland lässt sich in **Python** programmieren – mit einer eigenen, kleinen Python-Teilmenge, die im
Spiel läuft. Damit entstehen Missionen im Stil der Original-Trigger (Ereignis → Kamerafahrt, Dialog,
Angriffswelle), Lernabenteuer, in denen man Nelia mit Code steuert, und eigene Welten im Welteneditor.
Bezeichner sind englisch, Oberfläche, Erklärungen und Fehlermeldungen deutsch bzw. englisch.

## Überblick

| Teil | Ort | Aufgabe |
|---|---|---|
| Sprache | `src/script/` | Lexer, Parser, Compiler, Bytecode-VM, Grundfunktionen, Speichern – ohne DOM, ohne Simulation |
| Spiel-API | `src/sim/scripting/api.js` | englische Funktionen und Spielobjekte, zwei Rechtestufen |
| Gastgeber | `src/sim/scripting/host.js` | führt die Abschnitte eines Szenarios in der Simulation aus |
| Szenario | `src/sim/scripting/scenario.js` | Format, Prüfung, Ordner packen/entpacken, Umwandlung in eine Missionsdefinition |
| Überblick | `src/sim/scripting/outline.js` | liest Ziele aus dem Code, ohne ihn auszuführen (Menüs) |
| Pakete | `src/levels/` | `.zip` lesen und schreiben, Level per Link, Dateien des laufenden Levels (`levelAssetUrl`) |
| Welten | `src/sim/world.js` | flache Grundkarte, gespeicherte Editor-Karte, Zufallskarte |
| Editor-Werkzeuge | `src/sim/editor/edit.js` | Heben, Senken, Wasser, Wald … auf einer Vorschau-Simulation |
| Oberfläche | `src/ui/script/`, `src/ui/editor/`, `src/game/EditorView.js` | Code-Panel, Debugger, Abenteuer-Menü, Welteneditor |
| Level | `src/sim/missions/levels/<ordner>/` | ein Ordner je Level: Lernabenteuer 1–5, Skript-Mission „Der Überfall“ |

Spielen: Startmenü → **Programmier-Abenteuer**. Direktstart: `?mission=adv1` … `?mission=adv5`, `?mission=m1`,
ein Level von einem anderen Server mit `?level=https://…/lindgrund.zip` (siehe [Level-Ordner](#level-ordner)).

## Die Sprache

Eine Python-Teilmenge, die sich wie Python anfühlt und dieselben Ausgaben liefert (Tests vergleichen mit
CPython, siehe unten).

- **Vorhanden:** Zahlen (int beliebig groß, float), `True/False/None`, Texte mit f-Strings und `format`,
  Listen, Tupel, Wörterbücher, Slices, `if/elif/else`, `while`, `for` (auch mit `else`), `break`,
  `continue`, `pass`, `def` mit Standardwerten, `*args`, `**kwargs`, Closures, `global`, `nonlocal`,
  `lambda`, Dekoratoren, List- und Dict-Comprehensions, Generator-Ausdrücke (als Liste), Entpacken
  (`a, *b = …`), `del`, `assert`, `import math`/`random`.
- **Grundfunktionen:** `print len range int float str bool list tuple dict abs min max sum sorted reversed
  enumerate zip round type isinstance any all map filter chr ord divmod pow repr hex bin oct iter next callable`.
- **Module:** `math` (`sqrt floor ceil trunc fabs hypot isqrt gcd dist pi e inf tau`) und `random`
  (`random randint randrange choice shuffle uniform seed`, mit eigenem gespeicherten Zufall).
- **Bewusst nicht:** `class`, `try/except`, Mengen (auch `set()`), `input()`, `sin/cos/log` (nicht auf allen
  Rechnern gleich). Der Compiler meldet sie freundlich („Das gibt es in Kronland-Python (noch) nicht“).
- **Fehlermeldungen für Anfänger:** fehlender Doppelpunkt, `=` statt `==` in `if`/`while`, leerer Block (mit Tipp
  „pass“, am Programmende an der Zeile mit dem Doppelpunkt), Listen-Index mit Index und Länge („die Liste hat 3
  Elemente, Index 0 bis 2“), `serfs[0]` ohne Klammern, `None` aus einer Funktion ohne `return`, `true`/`none` →
  `True`/`None`.

**Kommazahlen sind deterministisch:** `+ − * /` und `sqrt` sind nach IEEE 754 überall exakt gleich;
`//` und `%` folgen dem Algorithmus von CPython Bit für Bit, `float ** int` rechnet mit Quadrieren statt
`Math.pow`, `round()` (auch mit negativen Stellen) und `format(…, '.2f')` runden exakt (BigInt) mit „gerade bei
Hälfte“ wie Python, Zehnerpotenzen sind exakt. Ganzzahlen werden ab 2^53 zu BigInt – `2 ** 100` geht.
`tests/sim/rules.test.js` verbietet in `src/script` (wie in `src/sim` und `src/ai`) alle Rechenfunktionen, die
Browser verschieden runden dürfen.

### Grenzen

Gleich auf jedem Gerät – nie entscheidet der JS-Stapel des Browsers, wo ein Programm scheitert:

| Grenze | Wert | Meldung |
|---|---|---|
| Aufrufe ineinander (auch über `map`, `sorted(key=…)`, Bedingungen) | 1000 wie CPython (Flutfüllung bis 31×31) | RecursionError, nennt die Funktion („„ice“ hat sich 1000-mal …“) |
| Synchrone Aufrufe ineinander (`map(f, …)` in `f`) | 50 | RecursionError |
| Verschachtelte Daten bei `==`, `<`, `str`, Schlüsseln | 500 Ebenen | RecursionError; Speichern klappt immer (ohne JS-Rekursion) |
| Länge einer Liste, eines Textes | 1 000 000 Elemente, 10 000 000 Zeichen | OverflowError (`list(range(10**7))`, Verdoppeln) |
| Befehle je Takt | Mission 60 000, Spieler 20 000 | – (es geht im nächsten Takt weiter) |
| Synchrone Aufrufe je Takt (Zielbedingungen, `wait_until`, `sorted(key=…)`) | je Programm 200 000 | „Das dauert zu lange“, die Bedingung wird abgeschaltet |
| Weltaufbau | 8 000 000 Befehle | „Der Weltaufbau braucht zu lange“ |

Der Aufrufstapel in Fehlern fasst gleiche Aufrufe zusammen und zeigt die ersten 3 und letzten 10; der Debugger
zeigt die Aufrufe mit einfachen Argumenten (`ice(4, 3, …)`), bei tiefen Stapeln die ersten 2 und letzten 8.

## Wie die VM funktioniert

```
Quelltext → Lexer (INDENT/DEDENT) → Parser (Syntaxbaum) → Compiler (Gültigkeitsbereiche, Bytecode) → VM
```

- **Compiler** (`compiler.js`): Pro Funktion ein Code-Objekt mit parallelen Feldern `ops/args/lines/stmt`.
  Python-Regel für lokale Namen; Variablen, die innere Funktionen mitnehmen, werden zu Zellen. Unbekannte
  Namen meldet schon der Compiler – mit Vorschlag („Meintest du `turn_left`?“, Levenshtein mit Vertauschung).
- **VM** (`vm.js`): Stapelmaschine mit eigenem Rahmen-Stapel (keine JS-Rekursion). Darum kann sie nach jedem
  Befehl anhalten und genau dort weitermachen:
  - **Budget:** `run(task, n)` führt höchstens n Befehle aus. Eine Endlosschleife friert nichts ein.
  - **Warten:** Ein Native (z. B. `wait`, `hero.step`) liefert `new Suspend(wait)`; die Aufgabe parkt, der
    Gastgeber setzt sie mit `resume(task, wert)` fort. So blockiert `hero.step()` im Code, während die
    Simulation den Helden laufen lässt.
  - **Aufgaben:** Hauptprogramm, jeder Ereignis-Handler und das Spielerprogramm sind eigene Tasks.
  - **Debugger:** `stmt[pc]` markiert Anweisungsanfänge; dort prüft die VM Haltepunkte und Schrittmodus
    (`into`, `over`, `out`). `inspect(task)` liefert globale, übergebene und lokale Variablen und den Aufrufstapel.
- **Speichern** (`serialize.js`): Der Objektgraph wird mit Nummern als JSON abgelegt (geteilte Objekte und
  Zyklen bleiben erhalten). Das Programm wird beim Laden aus dem Quelltext neu übersetzt.
- **Fehler** (`errors.js`): `ScriptError` mit Code `err.script.…`, Python-Namen (`NameError` …), Zeile und
  Aufrufstapel; Texte in `src/i18n/script.js`, zusammengesetzt von `scriptErrorText()`.

## Spiel-API

Zwei Rechtestufen. Die Stufe entscheidet, welche Namen ein Programm überhaupt kennt.

- **player** (Lernabenteuer, Spielerprogramme): nur, was auch die Oberfläche darf. Jeder Befehl läuft als
  normaler Sim-Befehl mit denselben Regeln und Kosten; Ablehnungen werden zu `GameError` mit dem Grund der
  Simulation.
- **mission**: alles – Truppen erzeugen, Rohstoffe geben, Dialoge, Kamera, Ziele, Gelände formen.

Im Spiel erklärt die Karte beim Überfahren (Handy: langes Drücken) jeden Befehl im Code, der Knopf **Referenz**
im Code-Panel öffnet die Website; eine eigene Befehlsliste gibt es nur noch im Welteneditor (`ApiHelp.vue`). Die
vollständige Liste steht ausführlich mit Parametern, Rückgabe, Fehlern und Beispielen in der **Programmier-Referenz** (`scripting/`,
siehe [WEBSITE.md](WEBSITE.md)); Quelle ist `API_DOC` (`api.js`). Die wichtigsten:

```python
# Held (player)
hero.step(n=1)  hero.turn_left()  hero.turn_right()  hero.turn_to("north")
hero.ahead()    # "free", "tree", "pile", "water", "cliff", "building", "edge" …
hero.can_step()  hero.move_to(ziel)  hero.is_at(ziel)  hero.take()  hero.chop()  hero.say(text)
place("goal")  tile(x, y)  trees_near(ziel)  stock("wood")  count("farm")  serfs(idle=True)
hq()  find_spot("residence", hq())  build("residence", x, y)  serf.work_on(baustelle)
wait(sekunden)  wait_until(lambda: …, timeout=None)  time()  print(…)  notify(text)
nelia  orrin  taran  malvor        # jeder Held unter seinem Namen (eigener zuerst, sonst None); hero = Haupt-Held
diplomacy(HUMAN, ENEMY)            # "allied", "neutral" oder "hostile"

# Mission (zusätzlich)
say("nelia", de="Da hinten!", en="Over there!")   # zweisprachig oder ein Text; wartet, bis der Dialog vorbei ist
camera.fly_to(place("camp"), seconds=3)   camera.jump_to(hero)   reveal(ort)   message(de=…, en=…)
objective("homes", lambda: (count("residence"), 2), de="Baue 2 Wohnhäuser", en="Build 2 residences")
complete(id)  fail(id)  show_objective(id)  victory("gold")  defeat("hq")
alchemist = npc("alchemist", look="worker.alchemist", at=place("tower"))   alchemist.stop_talking()
program.status  program.runs  program.get("guess")   # das Spielerprogramm lesen (Kopie)
spawn(BANDITS, "sword1", place("gate"), count=3)   attack(truppen, hq())   give(HUMAN, wood=200)
hero_of(HUMAN, "orrin")   set_diplomacy(HUMAN, ENEMY, "neutral")   orrin.teleport((6, 8))   orrin.kill()
place_building(BANDITS, "banditCamp", ort)   make_place("name", x, y, r)   find_open(nahe)   toward(a, b, d)
plant_trees(ziel, anzahl)  add_tree(x, y)  add_pile("stone", x, y)  clear_area(ziel, r)
world.width  world.height_at(x, y)  world.set_height(x, y, h)  world.set_water(x, y)  world.noise(x, y, 16)

# Ereignisse (Dekoratoren)
@on_start  @every(10)  @on_building_done("farm")  @on_building_placed  @on_destroyed("headquarters")
@on_killed  @on_recruited  @on_research("conscription")  @on_enter(place("camp"), who="hero")
@on_objective("goal")  @on_weather("winter")  @on_talk("alchemist")
@on_event("talk", id="alchemist")    # ein Dekorator für jedes Ereignis, die Namen oben sind Kurzformen
```

Spielobjekte sind Handles (`Hero`, `Serf`, `Troop`, `Building`, `Tree`, `Pile`, `Npc`, `Place`) mit Eigenschaften
wie `x`, `y`, `alive`, `type`, `level` und Methoden je Klasse; gespeichert wird nur Klasse + ID.
Ziele akzeptieren Orte, Spielobjekte, Tupel `(x, y)` oder Ortsnamen.

**Dialoge** dauern eine feste Zeit (aus der Textlänge der deutschen Fassung oder `voiceLength`) – das
Vorlesen beeinflusst den Ablauf nie. Wegklicken schickt `skipDialog` und beendet das Warten sofort.
Vorgelesen wird eine Aufnahme des Levels (`say(…, voice="assets/hallo.mp3")`), eine vertonte Zeile der Kampagne
oder die Sprachausgabe des Browsers (Einstellung „Dialoge vorlesen“). Lädt eine Aufnahme nicht, liest die
Sprachausgabe den Text (`src/audio/speech.js`).

**Ziele:** `objective(id, Bedingung, de=…, en=…)`. Die Bedingung liefert wahr/falsch oder ein Paar
`(geschafft, nötig)` – dann zeigt die Zielliste „1/2“. Nur ein Tupel ist ein Paar; eine Liste mit zwei Figuren
gilt als „wahr“. Die alte Reihenfolge `objective(id, text, Bedingung)` funktioniert weiter. Menüs lesen die
Zieltexte direkt aus dem Code, ohne ihn auszuführen (`scenarioGoals`, `outline.js`): nur wörtliche Texte, sonst
erscheint die Kennung.

**Gesprächsfiguren:** `npc(id, look=…, at=…, name=None)` stellt eine Figur mit Ausrufezeichen auf, etwa einen
Alchemisten. Wählt man einen Helden und tippt die Figur an (Rechtsklick), geht er hin (Sim-Befehl `order`
`talk`, nur Helden, Feld `talkTo`); steht er daneben, läuft `@on_talk(id)` mit dem Helden. Bloßes Vorbeilaufen
löst nichts aus, ein anderer Befehl bricht das Gespräch ab. Was passiert, entscheidet das Missionsprogramm – auch,
ob es der richtige Held ist. `stop_talking()`/`start_talking()` schalten das Ausrufezeichen. Das Aussehen ist eine
Rolle des Figuren-Manifests (`"serf"`, `"worker.alchemist"`, `"hero.orrin"`) oder ein eigenes Modell des Levels
(`"assets/alchemist.glb"`, `src/render/levelModels.js`, auf Figurengröße skaliert, Animation „idle“ wenn
vorhanden); bis es geladen ist oder wenn es fehlt, steht die normale Figur da. Mit `name` oder `speakers` in
scenario.json bekommt die Figur einen Namen im Dialogfenster. Figuren aus Missionsdateien (Kampagne) sprechen bis
zu ihrem Umzug noch beim Herankommen.

**Das Spielerprogramm lesen:** `program.status` (`"idle"`, `"running"`, `"paused"`, `"done"`, `"error"`,
`"stopped"`), `program.runs` und `program.get(name, default)` – eine Kopie der Variablen (Zahlen, Texte, Listen,
Wörterbücher, Spielobjekte; Funktionen werden `None`). Damit prüft eine Mission Vorhersage- und Variablen-Aufgaben.

## Level-Ordner

Ein Level ist ein **Ordner**: `scenario.json` (was es gibt), `.py`-Dateien (was passiert) und `assets/`
(Bilder, Aufnahmen, 3D-Modelle). So liegen die mitgelieferten Level im Repo (`src/sim/missions/levels/`, neue
Ordner werden von selbst gefunden: `levels/index.js` über Vite-Glob, in Node-Skripten über das Dateisystem). Zum
Weitergeben wird derselbe Ordner eine ganz normale **.zip** – der Welteneditor speichert und öffnet sie, jedes Kind
kann sie im Explorer öffnen, die `.py`-Dateien ändern und wieder zippen (ein umschließender Ordner in der .zip
stört nicht). Ein Level lässt sich auch **per Link** öffnen: `play/?level=https://…/lindgrund.zip` oder der
entpackte Ordner (`…/lindgrund/` bzw. seine `scenario.json`) auf einem statischen Host; der Host muss Abrufe
anderer Seiten erlauben (CORS, GitHub Pages tut das). Im Abenteuer-Menü gibt es dafür „Level öffnen“ und ein Feld
für den Link.

```
lindgrund/
  scenario.json
  world.py        # Weltaufbau
  mission.py      # Ablauf: Ereignisse, Dialoge, Ziele
  player.py       # Startcode des Spielerprogramms (Lernabenteuer)
  assets/alchemist.glb  assets/hallo.mp3  assets/alchemist.png
```

```json
{
  "format": "kronland-scenario", "version": 2,
  "id": "adv1", "kind": "adventure", "end": "script",
  "title": { "de": "Der Weg zum Schatz", "en": "The Path to the Treasure" },
  "summary": { "de": "…", "en": "…" }, "briefing": { "de": "…", "en": "…" },
  "world": { "base": "flat", "width": 24, "height": 13, "fog": false, "starts": [{ "x": 4, "y": 6 }],
             "places": { "treasure": { "x": 14, "y": 6, "r": 0 } } },
  "players": [{ "kind": "human", "hero": "nelia", "hq": false }],
  "speakers": { "alchemist": { "name": { "de": "Alchemist", "en": "Alchemist" }, "portrait": "assets/alchemist.png" } },
  "sections": [
    { "id": "world",   "file": "world.py",   "level": "mission", "visibility": "collapsed", "editable": false },
    { "id": "mission", "file": "mission.py", "level": "mission", "visibility": "hidden",    "editable": false },
    { "id": "player",  "file": "player.py",  "level": "player",  "visibility": "open",      "editable": true }
  ]
}
```

| Feld | Bedeutung |
|---|---|
| `kind` | `adventure` (Code-Panel sichtbar) oder `mission` (Code unsichtbar, normales Spiel) |
| `end` | `objectives` (Standard): gewonnen, wenn alle Hauptziele erfüllt sind; verloren mit der Burg oder einem gescheiterten Hauptziel. `script`: nur `victory()`/`defeat()` |
| `world.base` | `flat` (Wiese, `width`/`height`), `generate` (Zufallskarte, `seed`/`size`) oder `terrain` (Editor-Karte in `world.terrain`) |
| `world.places` | benannte Orte (Kreise), im Code `place("name")`; mit `make_place` eine gemeinsame Tabelle |
| `players[i].hq` | `false`: ohne Burg, Dorfzentrum und Leibeigene – nur der Held (Lernabenteuer) |
| `players[i].stock/techs/serfs` | wie in Missionsdateien (`docs/MISSIONEN.md`) |
| `available` | Freischaltungen zu Beginn: `{ "buildings": […], "techs": […] }` (sonst alles) |
| `shafts`, `landmarks`, `weatherCycle` | wie in Missionsdateien |
| `victoryText`, `defeatText` | Text am Ende; `victoryTexts`, `defeatTexts`, `debriefs` je Grund (`victory("gold")`) |
| `speakers` | eigene Sprecher: Name, Farbe `#rrggbb`, Porträt `assets/….png` |
| `sections` | Python-Abschnitte: `file` (Name im Ordner), `level` mission/player, `visibility` open/collapsed/hidden, `editable`. Gepackt (Spielstand, Editor) trägt jeder Abschnitt seinen `code` |

**Texte stehen im Code:** `say("orrin", de="Bei allen Märkten!", en="By all markets!")`; einsprachige Level
schreiben einfach `say("orrin", "Hallo!")`. Version 1 (Texttabelle `texts` mit Schlüsseln, `voice`/`voiceLength`
je Schlüssel, Ende nur per Skript) lädt weiter.

**Dateien eines Levels** (`assets/`, nur PNG, JPG, WebP, MP3, OGG, GLB, je höchstens 15 MB, zusammen 60 MB, 300
Dateien) dienen nur der Darstellung; die Simulation kennt nur ihren Pfad, ein Spielstand braucht sie nicht.
Verweise gehen immer relativ zum Level (`assets/…`): aus der .zip (im Speicher), vom selben Server wie der Link
oder bei mitgelieferten Leveln aus ihrem Ordner (mit Inhalts-Hash). Fremde Adressen gibt es nicht. Für jede Datei
gibt es einen Ersatz: fehlt ein 3D-Modell, steht die normale Figur da; fehlt eine Aufnahme oder lädt sie nicht,
liest die Sprachausgabe; fehlt ein Porträt, zeigt das Siegel den Anfangsbuchstaben.

**Grenzen für Pakete** (`src/levels/package.js`): `scenario.json` bis 1 MB, `.py` bis 200 000 Zeichen,
andere Dateien werden einfach nicht benutzt. Ein Link darf nur `http(s)` sein.

Alle Missionsabschnitte bilden ein Programm (Zeilen laufen über die Abschnitte durch, Fehler werden dem
Abschnitt und seiner Zeile zugeordnet). Spielerabschnitte laufen erst auf **Ausführen**; ihr Code kommt
dabei als Befehl `{ type: 'script', action: 'run', sections }` in die Simulation – Lockstep-tauglich.

## In der Simulation

`MissionRuntime` (runtime.js) erzeugt für Szenarien einen `ScriptHost`:

- **Aufbau** (Ende des Sim-Konstruktors): Missionsprogramm übersetzen und mit großem Budget ausführen –
  Weltaufbau, `make_place`, Handler registrieren. Wartet es (`wait`, `say`), geht es im Takt weiter.
- **Takt** (Ende von `update`): `on_start` einmal, Sim-Ereignisse an passende Handler, `@every` und
  `@on_enter` prüfen, wartende Aufgaben prüfen (`wait_until` ruft die Bedingung synchron auf), dann alle
  Aufgaben in fester Reihenfolge mit Budget (Mission 60 000, Spieler 20 000 Befehle je Takt). Zu Beginn jedes
  Takts (`beginTick`, vor den Zielen) bekommt jedes Programm sein Budget für synchrone Aufrufe neu.
- **Zahlen in die Simulation:** Jede Zahl aus Python geht über `toInt` (ganzzahlig, abgeschnitten, höchstens
  ±1 000 000 000) oder `toTicks` (Sekunden → Takte, gerundet) in die Simulation (`api.js`). NaN, `inf` und zu große
  Werte werden zum Skriptfehler, nie zu einem kaputten Spielstand (`wait(float("inf"))`, `@every(0.5)` = alle 5 Takte).
- **Namen aus dem Programm:** sind nur Buchstaben, Ziffern, `_` und `-`, am Anfang ein Buchstabe
  (`make_place`, `objective`). Gesucht wird nur in eigenen Einträgen – `message("constructor")` ist ein Text.
  Heldennamen (`nelia`, `orrin` …) und `HUMAN`/`ENEMY` werden bei jedem Zugriff nachgeschlagen: Ein Held, der
  später dazukommt, ist sofort da, vor und nach dem Laden gleich.
- **Level von anderen:** Sprachaufnahmen (`voice`) nur als Pfad im Level, nie als Webadresse; je Aufruf höchstens
  Radius 64, 2000 Bäume, 50 Trupps, 100 Leibeigene; je Level höchstens 500 Orte, 100 Ziele, 200 Ereignis-Handler;
  Texte bis 2000 Zeichen. `validateScenario` prüft Dateien vor dem Laden (Kartengröße bis 256, bis 8 Spieler, bis
  32 Abschnitte à 200 000 Zeichen, Textschlüssel, Pfade).
- **Befehle** `type: 'script'`: `run`, `stop`, `debug` (`into`/`over`/`out`/`continue`/`pause`, Haltepunkte
  je Abschnitt), `skipDialog`.
- **Speichern/Hash:** VM-Zustände, Orte und Zähler stecken in `mission.script` im Spielstand und im
  State-Hash. Das Szenario mit allem Code steckt immer im Spielstand (`mission.scenario`, dazu `mission.custom`
  für eigene Level) – eine Korrektur an einem Level bricht alte Spielstände nicht. Dateien (`assets/`) werden nicht
  gespeichert; nach dem Laden kommen sie aus dem Ordner bzw. dem noch offenen Paket, sonst springt der Ersatz ein.
- Gelände- und Naturänderungen eines Takts gehen gesammelt als `terrainChanged`/`natureChanged` an den Renderer.

## Lernabenteuer

| # | ID | Titel | Lernziel |
|---|---|---|---|
| 1 | `adv1` | Der Weg zum Schatz | Anweisungen, `for`, `range()` |
| 2 | `adv2` | Der Weg zur Ruine | `while`, `if/else`, Bedingungen |
| 3 | `adv3` | Holz für den Winter | `while` mit Bedingung, Rückgabewerte, Zähler (Reihe zufällig lang) |
| 4 | `adv4` | Steine am Wegesrand | eigene Funktionen, Funktionen als Argument (Steine zufällig verteilt) |
| 5 | `adv5` | Ein Dorf per Programm | Listen, Objekte und Methoden, Befehle wie in der Oberfläche |

Jedes Abenteuer hat eine Musterlösung im Test (`tests/sim/scripting.test.js`). Der Code der Spieler wird pro
Abenteuer im Browser gemerkt (`kronland-code-<id>`).

Die Abenteuer spielen auf offenen Wiesen; Hindernisse sind Landschaft mit Sinn (Fluss, See, Wäldchen,
Mauerreste), keine Baumgänge. Die Kamera zeigt ruhig die ganze Karte (Norden oben, am Desktop im Spielbereich
links vom Code-Panel) und läuft dem Helden nicht hinterher. Das **Raster** (Knopf „# Raster“ im Panel, Vorliebe bleibt im
Browser; auch im Welteneditor) zeigt die Kacheln, jede fünfte Linie kräftiger – so lassen sich Schritte
abzählen. Der Held startet mit Blick nach Osten; `hero.step()` geht immer in Blickrichtung und dreht die Figur
dabei nicht zur Laufrichtung.

## Code-Panel und Debugger

Editor nach dem Vorbild von python.jetzt: ein echtes `<textarea>` über einem eingefärbten `<pre>` (gleicher
Lexer wie die VM). Tab/Umschalt+Tab rücken ein und aus, Enter übernimmt die Einrückung (nach `:` eine
Stufe tiefer), Rücktaste löscht eine Einrückstufe. Klick auf eine Zeilennummer setzt einen Haltepunkt.

**Aufteilung** (`src/ui/script/splitLayout.js`, Test `tests/ui/splitLayout.test.js`):

- **Desktop und Tablet quer – geteilter Bildschirm:** Spiel links, Programm rechts (anfangs 46 % der Breite).
  Die Trennlinie lässt sich mit Maus oder Finger ziehen, mindestens 340 px Programm und 420 px Spiel. Beim
  Ziehen wandert nur eine goldene Vorschaulinie (CSS-Transform, kein Neulayout); Panelbreite und Spiel-Canvas
  ändern sich einmal beim Loslassen (`Renderer.setSize` genau einmal je Zug). Pfeiltasten auf der Trennlinie
  verschieben die Linie in 32-px-Schritten, die Breite folgt 250 ms nach dem letzten Tastendruck. › im Kopf
  klappt das Programm zu einer schmalen Leiste „‹ Programm“ ein. Breite und Zustand merkt sich der Browser (`kronland-code-split`). Das Spiel wird wirklich
  schmaler: `.game` bekommt rechts die Panelbreite und `contain: layout`, damit Leiste, Minimap und Meldungen
  im Spielbereich bleiben; Canvas, Kamera-Seitenverhältnis und Randscrollen folgen (Ziehen der Trennlinie scrollt die Karte nicht). Die HUD-Stufen
  (`compact`, `mid`, `narrow`) richten sich nach der Breite des Spielbereichs. Werkzeugleiste: Ausführen,
  Schritt, Über, Heraus, Stopp | Speichern, Öffnen | Raster, **Referenz**; darunter immer der Code (Abschnitte,
  Fehlerkasten, Variablen) und unten die **Ausgabe** – ohne Reiter. **Referenz** (Buch) öffnet die
  Programmier-Referenz der Website (`scripting/`) in einem neuen Tab; eine Befehlsliste im Panel gibt es nicht
  (Erklärungen liefern die Karten beim Überfahren und die Referenz). Eingeklappte Abschnitte (z. B. „Welt aufbauen“) zeigen links Pfeil und Titel, rechts
  Zeilenzahl und das Schild „gesperrt“, wenn sie nicht bearbeitbar sind. Einen Status-Text im Kopf gibt es nicht
  – den Zustand zeigen die markierte Zeile und der Knopf Ausführen/Anhalten/Weiter.
- **Handy (hochkant oder niedrig) – Blatt:** Das Programm füllt den Bildschirm, Reiter **Code**, **Ausgabe**
  (mit Fehlerzähler). Unten Ausführen, Schritt, Stopp und „⋯“
  (Speichern .py, Öffnen, Raster, Vorlage wiederherstellen, Referenz), darüber beim Tippen die Tastenleiste
  (⇥ ⇤ : ( ) " " = == [ ] . _ #). **Ausführen** schaltet auf **Spiel ansehen**: Spiel im Vollbild, unten eine
  Leiste mit der aktuellen Zeile, Anhalten/Weiter, Stopp und „Code“; ist der Held nicht im freien Bildbereich zu
  sehen, rückt ihn die Kamera über die Leiste (`Engine.watchFocus`), sonst bleibt die Ansicht. Bei einem Fehler (oder Haltepunkt) springt
  das Blatt zurück zum Code, die Fehlerzeile ist sichtbar. Geöffnet wird das Blatt auch über die goldene Münze
  „Code“ im Schnellzugriff (mit grünem Punkt, solange das Programm läuft) oder „Spiel“ im Kopf geschlossen.

**Befehlshilfe im Code** (`hoverDoc.js`, `docCards.js`, `DocCard.vue`, Test `tests/ui/hoverDoc.test.js`): Bleibt
die Maus etwa eine halbe Sekunde auf einem Befehl, erscheint eine Karte mit Signatur, Kurzbeschreibung, Parametern
und Rückgabe (Texte aus `commandDocs.js`, erst beim ersten Bedarf nachgeladen, ~60 kB je Sprache). Sie
verschwindet beim Verlassen, Tippen oder mit Escape. **Strg+Klick** (Mac: **⌘+Klick**) öffnet die
Programmier-Referenz am Eintrag (`scripting/#<name>`) in einem neuen Tab; solange Strg/⌘ gedrückt ist, ist der
Befehl unterstrichen und der Zeiger eine Hand. Erkannt werden Punktketten (`hero.step`, `math.sqrt`), Methoden
an Literalen (`"a b".split` → `str.split`), Methoden an unbekannten Werten nach Name (`xs.append` →
`list.append`) und eingebaute Funktionen (`len`); Strings und Kommentare nicht. Grundlage ist der Highlighter
des Editors (`highlightRanges`). Am Handy ersetzt **langes Drücken** auf einen Befehl das Überfahren: Die Karte
zeigt die ausführliche Erklärung, ein Beispiel und „In der Referenz öffnen“.

Knöpfe: **Ausführen**, **Schritt** (hinein; startet auch im Schrittmodus), **Über**, **Heraus**, **Stopp**,
**Weiter**/**Anhalten**. Beim Halt: aktuelle Zeile grün, Variablen (global, übergeben, lokal) und Aufrufstapel.
Fehler: rote Zeile und Kasten mit Python-Namen, Abschnitt, Zeile, Erklärung und Vorschlag. Sobald der Abschnitt
bearbeitet wird, verschwinden Markierung und Kasten (der Fehler steht dann womöglich nicht mehr im Programm), der
Status springt auf „bereit“.

**Ausgabe und Meldungen:** `print()` schreibt nur unter „Ausgabe“ im Code-Panel (Desktop unter dem Code, Handy
eigener Reiter). Eine Meldung im Spiel sendet `notify(text)` („Meldung senden“, Spieler- und Missionsskripte):
Kategorie `script`, niedrigster Vorrang, höchstens eine; weitere Meldungen ersetzen den Text und zählen mit –
„… (12 Meldungen)“, eine Schleife flutet also nicht. Die Simulation meldet sie als Ereignis `scriptNotify` (nur
Anzeige, kein Sim-Zustand; alle Aufrufe eines Ticks werden zu einem Ereignis mit Zähler `n` zusammengefasst).
`message(text)` (nur Missionen) ist dagegen eine Dialogzeile ohne Sprecher. Das Panel zeigt nur den aktuellen Lauf (`player.since` = Konsolen-Zähler beim Start). Anzeige-Logik:
`src/ui/script/panelState.js` (Test `tests/ui/scriptPanel.test.js`).

**Dateien:** **Speichern** lädt den Code als `<szenario>.py` herunter (Blob, auch am Handy), **Öffnen** lädt eine
`.py`- oder `.txt`-Datei vom Gerät in den Abschnitt (den fokussierten bearbeitbaren, sonst das Spielerprogramm;
höchstens 200 KB, Windows-Zeilenenden und BOM werden bereinigt).

## Welteneditor

Startmenü → Programmier-Abenteuer → **Welteneditor**. Die Vorschau-Simulation läuft nie; Werkzeuge ändern sie
über `applyEdit()` (`src/sim/editor/edit.js`), der Renderer bekommt dieselben Ereignisse wie im Spiel.

- **Werkzeuge:** Kamera, Heben, Senken, Ebnen, Glätten (gedrückt halten wirkt weiter), Wasser und Land (Wasser
  und Felsen folgen aus der Höhe wie im Kartengenerator), Wald, Radierer, Rohstoffhaufen, Schacht,
  Siedlungsplatz, Startplatz, Ort. Pinselgröße und Stärke. Rückgängig/Wiederholen (Strg+Z/Strg+Y), Raster (`#`).
- **Panel:** Szenario (Titel, Art, Auftrag zweisprachig, Spieler mit/ohne Burg, Nebel), Orte,
  Code (Abschnitte mit Stufe, Sichtbarkeit, bearbeitbar; Befehlsreferenz), Dateien (Bilder, Töne, 3D-Modelle
  hinzufügen und entfernen; sie gelten, solange die Seite offen ist, und reisen in der .zip), Beispiele
  (mitgelieferte Level als Vorlage). Den Reiter Texte gibt es nur noch für Szenarien der Version 1.
- **Welt aus Code:** „Weltaufbau ausführen“ zeigt das Ergebnis der Missionsabschnitte als Vorschau;
  „Ins Gelände übernehmen“ macht es zur Karte (und kommentiert den Abschnitt `world` aus).
- **Speichern/Öffnen** als `.zip` (Level-Ordner mit Dateien; Öffnen nimmt auch eine `.json`); ein Entwurf wird im
  Browser gemerkt (ohne Dateien). **Testspielen** startet das
  Szenario mit allen Abschnitten im Code-Panel und Debugger fürs Missionsskript (Haltepunkte halten das Spiel an);
  danach geht es zurück in den Editor.
- Gespeichert wird die Karte als `world.terrain` (Höhen und Flags Base64, Bäume/Haufen/Plätze/Schächte, Startplätze).

## Tests

```bash
npx vitest run tests/script      # Sprache: CPython-Vergleich, Fehler, Debugger, Speichern mitten im Lauf
npx vitest run tests/sim/scripting.test.js tests/sim/scenarioV2.test.js tests/sim/editor.test.js tests/levels
E2E_PORT=4310 npx playwright test e2e/script.spec.js
```

`tests/script/cases/*.py` laufen in der VM und müssen dieselbe Ausgabe liefern wie `*.out` (mit `python3`
erzeugt; ist Python installiert, prüft der Test auch die `.out`-Dateien). Neuer Fall: Datei anlegen,
`python3 fall.py > fall.out`. Passt die installierte Chromium-Version nicht zu Playwright:
`PW_CHROMIUM=/pfad/zu/chrome npx playwright test …`.
