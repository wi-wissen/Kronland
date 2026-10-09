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
| Level | `src/sim/missions/levels/<ordner>/` | ein Ordner je Level: Lernabenteuer 1–5, Skript-Mission „Der Überfall“, Kampagne: Tutorial und die Kapitel 1–6 |

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
  - **Warten:** Ein Native (z. B. `wait`, `nelia.step`) liefert `new Suspend(wait)`; die Aufgabe parkt, der
    Gastgeber setzt sie mit `resume(task, wert)` fort. So blockiert `nelia.step()` im Code, während die
    Simulation die Heldin laufen lässt.
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
# Figuren (player): Helden unter ihrem Namen, Leibeigene und Trupps mit denselben Grundbefehlen
nelia.step(n=1)  nelia.turn_left()  nelia.turn_right()  nelia.turn_to("north")
nelia.front()  nelia.left()  nelia.right()  nelia.here()   # "free", "tree", "water", "coin", "track" … (nur schauen)
nelia.can_step()  nelia.move_to(ziel, wait=True)  nelia.is_at(ziel)  nelia.take()  nelia.put()  nelia.say(text)
for s in serfs():  s.step()  s.chop()  s.work_on(baum)      # Leibeigene fällen nach Spielregeln
t = troops()[0]    t.move_to(ziel, wait=False)  t.attack(feind)  t.hold()  t.defend()
place("goal")  tile(x, y)  trees_near(ziel)  figures_near(ziel, 8, side="enemy")  items_near(ziel, kind="coin")
weather()  forecast()  stock("wood")  count("farm")  serfs(idle=True)
hq()  find_spot("residence", hq())  build("residence", x, y)  serf.work_on(baustelle)
wait(sekunden)  wait_until(lambda: …, timeout=None)  time()  print(…)  notify(text)
nelia  orrin  taran  malvor        # jeder Held unter seinem Namen (eigener zuerst, sonst ein sichtbarer); hero = erster Held
diplomacy(HUMAN, ENEMY)            # "allied", "neutral" oder "hostile"

# Mission (zusätzlich)
say("nelia", de="Da hinten!", en="Over there!")   # zweisprachig oder ein Text; wartet, bis die Zeile vorbei ist
say("orrin", de="…", en="…", wait=False)          # nur einreihen, sofort weiter
step("farm", until=lambda: count("farm", placed=True) >= 1, de=…, en=…, hint={"ui": "build-farm"})   # Tutorial-Schritt
camera.fly_to(place("camp"), seconds=3)   camera.jump_to(hero)   reveal(ort)   message(de=…, en=…)
objective("homes", lambda: (count("residence"), 2), de="Baue 2 Wohnhäuser", en="Build 2 residences")
complete(id)  fail(id)  show_objective(id)  victory("gold")  defeat("hq")
hint("homes", ui=["build-residence"], area="square", ui_until=lambda: count("residence", placed=True) >= 2)
offer("buy", {"gold": 300}, de=…, en=…, group="way")   withdraw("buy")   unlock("barracks", "standingArmy")
alchemist = npc("alchemist", look="worker.alchemist", at=place("tower"))   alchemist.stop_talking()
program.status  program.runs  program.get("guess")   # das Spielerprogramm lesen (Kopie)
program.stop()                     # Spielerprogramm anhalten (vor dem Wechsel in den nächsten Abschnitt)
note("maid", code, de="Zettel der Magd", en="The maid's note", editable=True)   # Zettel einer Figur ins Code-Panel
reset(False)                       # Ausführen startet die Etappe nicht neu (Aufbau-Missionen); reset() wieder an
spawn(BANDITS, "sword1", place("gate"), count=3)   attack(truppen, hq())   give(HUMAN, wood=200)
hero_of(HUMAN, "orrin")   set_diplomacy(HUMAN, ENEMY, "neutral")   orrin.teleport((6, 8))   orrin.kill()
place_building(BANDITS, "banditCamp", ort, level=0, min_r=0, radius=20, fixed=False)   make_place("name", x, y, r)
find_open(nahe, max_r=16, clear=2, reachable_from=hq(), avoid=[(x, y, 10)], on_ice=False)   toward(a, b, d)
camp("outpost", ort, [("spear1", 2, 3)], r=7)   add_hero(HUMAN, "orrin", ort)   convert(trupps, HUMAN)
add_shaft("clay", hq())   add_ruin("residence", ort)   player("moorbrook")   remove(fremder)  # spurlos
count("farm", placed=True, level=1)   researched("conscription")   ai(ENEMY, forbid=["weatherPlant"])   give(ENEMY, energy=1000)
plant_trees(ziel, anzahl)  add_tree(x, y, amount=None)  add_pile("stone", x, y)  clear_area(ziel, r)
add_item("coin", x, y)  remove_item(x, y)  items("coin")  world.set_track(x, y)  hints(False)
world.width  world.height_at(x, y)  world.set_height(x, y, h)  world.set_water(x, y)  world.noise(x, y, 16)
units_in(ziel, HUMAN, who="hero")  # ältere Form von figures_near (sieht durch den Nebel)

# Ereignisse (Dekoratoren) – außer @on_start und @on_talk auch im Spielerprogramm
@on_start  @every(10)  @on_building_done("farm")  @on_building_placed  @on_destroyed("headquarters")
@on_killed  @on_recruited  @on_research("conscription")  @on_enter(place("camp"), who="hero")
@on_objective("goal")  @on_weather("winter")  @on_talk("alchemist")
@on_event("talk", id="alchemist")    # ein Dekorator für jedes Ereignis, die Namen oben sind Kurzformen
@on_event("payday")  @on_event("serf_bought")  @on_event("research_started")  @on_event("upgrade_started")
@on_event("ability", ability="courage")  @on_event("trade")  @on_event("tribute", id="buy")   # nur als @on_event
```

Spielobjekte sind Handles (`Hero`, `Serf`, `Troop`, `Building`, `Tree`, `Pile`, `Npc`, `Place`) mit Eigenschaften
wie `x`, `y`, `alive`, `type`, `level`, `facing`, `side` und Methoden je Klasse; gespeichert wird nur Klasse + ID.
Ziele akzeptieren Orte, Spielobjekte, Tupel `(x, y)` oder Ortsnamen.

### Figuren Kachel für Kachel

Helden, Leibeigene und Trupps teilen die Grundbefehle (`FIGURE_METHODS`): `step`, `turn_left/right/to`, die Sensoren
`front/left/right/here`, `can_step`, `move_to`, `is_at`, `say`. Beim Trupp ist der Hauptmann die Figur, die Soldaten
folgen. Jede Aktion ist ein vorhandener Sim-Befehl (Leibeigene `move`, Helden, Trupps und Miliz `order`, Aufheben
`item`, Fällen `assignWork` mit `once`), Drehen setzt nur `face`. Dazu je Art:

| Art | zusätzlich |
|---|---|
| Held | `take()`, `put()`, `attack()`, `hold()`, `defend()` – **kein Fällen** |
| Leibeigener | `take()`, `put()`, `chop()` (Baum vorn, nach den Spielregeln, echte Dauer), `work_on()`, `attack()` (Fäuste) |
| Trupp | `attack()`, `hold()`, `defend()` |

**Warteregel:** Was die Figur selbst bald beendet, wartet (`step`, `turn_*`, `take`, `put`, `chop`, `move_to`). Aufträge,
die nach den Spielregeln weiterlaufen, kehren sofort zurück (`work_on`, `attack`, `hold`, `defend`,
`move_to(…, wait=False)`), wie ein Klick in der Oberfläche. Gewartet wird im Host (`checkWalk`, `checkChop`): ein Schritt
muss seine Kachel erreichen, sonst `blocked`; `chop()` ist fertig, wenn der Baum weg ist und der Leibeigene wieder auf
seiner Kachel steht; ein anderer Befehl dazwischen gibt `interrupted`. **Stopp** hält alle Helden und jede Figur an, auf
die das Programm gerade wartet; laufende Aufträge bleiben. `ahead()` ist der alte Name von `front()` und `hero` der des
ersten eigenen Helden – Level der Version 1 laufen weiter, nur das alte `hero.chop()`/`hero.take()` gibt es nicht mehr.

### Boden: Sensoren, Gegenstände, Spuren

`src/sim/systems/ground.js` (Regeln: [SPIELREGELN.md §14](SPIELREGELN.md#14-spuren-und-gegenstände)):

- `tileKind(sim, x, y)` liefert ein Wort mit festem Vorrang: `edge`, `cliff`, `tree`/`pile`/`ruin`/`building`, `water`,
  `coin`/`flower`, `ice`, `track`, `free`. Eine fertige Brücke ist Boden; `step()` und `can_step()` prüfen
  `map.walkable` (also auch Eis, Taler, Spur). `tile(x, y)` liefert dasselbe, im unerkundeten Nebel `"unknown"`.
- Gegenstände: `TileMap.items` (Kachel → `"coin"`/`"flower"`), `occupy()` räumt sie, Tauwetter und eingestürzte
  Brücken auch. Befehl `{ type: 'item', action: 'take'|'put', unit, kind }` mit `err.nothingHere`, `err.somethingHere`,
  `err.onlyCoins`, `err.notEnoughGold`, `err.cannotCarry`.
- Spuren: `TileMap.tracks` (ein Byte je Kachel, 0 … 255), `updateTracks` einmal je Takt nach dem Militär: Zuwachs
  je Durchgang abnehmend, Besen aus dem Takt, Schwelle „getreten“ je Boden (Gras 48, Schnee 16; Modell und Zahlen in
  [SPIELREGELN.md §14](SPIELREGELN.md#14-spuren-und-gegenstände)). Spieloption `sim.trackMode` (`off`, `fading`,
  `permanent`) aus den Einstellungen, im Spiel per Befehl `{ type: 'setTracks', mode }`; `world.tracks` in
  scenario.json (`mode`, `threshold`, `who`).
- Beides steht im Spielstand und im State-Hash.
- Darstellung (liest nur): `src/render/ground.js` füllt eine Datentextur mit einem Texel je Kachel (R = Stärke ab der
  Schwelle, G = Achse der Fußabdrücke aus den Nachbarkacheln), höchstens alle 5 Takte und nur hochgeladen, wenn sich
  etwas geändert hat. Nur gerade gesehene Kacheln übernehmen den Sim-Wert, erkundete behalten den zuletzt gesehenen,
  unerkundete zeigen nichts. Der Gelände-Shader (`terrain.js`) macht daraus im Sommer und Regen Trampelpfade (Erde
  statt Gras), im Winter getretenen Schnee mit Fußabdrücken (alle Grafikstufen). `src/render/items.js` zeichnet Taler
  (aufrecht, drehend, wippend) und Christrosen als Instanzen, neu aufgebaut bei `map.groundVersion`; aus der Ferne
  (Übersicht, Handy) wachsen sie bis 1,8-fach, im unerkundeten Nebel bleiben sie verborgen. Aufheben glitzert und klingt.

`figures_near(ziel, radius, kind, side)` sucht Helden, Leibeigene, Trupps (Hauptmann) und Arbeiter draußen, nach Abstand
in Milli-Kacheln, dann Nummer; ein Spielerprogramm sieht nur, was der Spieler sieht (`canSee`), Missionen alles.
`forecast()` braucht im Spielerprogramm einen Wetterturm (`script.game.noForecast`).

### Hinweise

Code, der in Python erlaubt ist und läuft, aber fast nie tut, was gemeint war, bekommt einen **Hinweis**
(`src/script/hints.js`): ein Durchlauf über den Syntaxbaum vor dem Start, das Programm hält nicht an. Das Vokabular
kommt aus `API_DOC` (`query: true`, `answers`) über `hintVocab(level)`, der Sprachkern kennt keine Spielnamen.

| Code | Muster |
|---|---|
| `lookOnly` | `nelia.left()`/`right()` als Anweisung – schaut nur, dreht nicht |
| `unusedResult` | Sensor oder Abfrage als Anweisung (`nelia.front()`, `tile(3, 4)`) |
| `notCalled` / `alwaysTrue` | Methode ohne Klammern als Anweisung bzw. in `if`/`while` |
| `unknownAnswer` | Vergleich einer Sensor-Antwort mit einem Wort, das nie kommt (`"Tree"`), mit Vorschlag und Liste |
| `compareStatement` | `count == count + 1` als Anweisung |
| `unknownMethod` | unbekannte Methode an `nelia`, `hero` … schon beim Übersetzen |
| `busyLoop` | zur Laufzeit: 50 Takte (≈ 5 s) volles Budget ohne Warten und ohne Sim-Befehl |

Hinweise stehen mit Abschnitt und Zeile in `state.player.hints` (Missionsabschnitte: `state.missionHints`, für den
Editor) und in `uiState()`. Das Code-Panel zeigt sie bernsteinfarben: Zeilennummer und Zeile markiert, darunter
höchstens zwei Kästen „Hinweis · Zeile 4“ (der Rest gezählt, `shownHints` in `panelState.js`); das Programm läuft weiter,
und wie Fehler verschwinden sie, sobald der Abschnitt bearbeitet wird. Hinweise der Missionsabschnitte zeigt nur das
Testspielen aus dem Welteneditor. Am Handy steht in der Laufleiste „Spiel ansehen“ ein Knopf „Hinweis“, der zum Code
führt (kein automatischer Wechsel wie bei Fehlern). Eine Mission
schaltet sie mit `hints(False)` ab, etwa für eine „Finde den Fehler“-Etappe. Texte: `script.hint.*` in
`src/i18n/script.js`.

**Dialoge** dauern eine feste Zeit (aus der Textlänge der deutschen Fassung oder `voiceLength`) – das
Vorlesen beeinflusst den Ablauf nie. Wegklicken schickt `skipDialog` und beendet das Warten sofort.
**Gespräche:** Die `say()`-Zeilen einer Aufgabe sind ein Gespräch. Spricht gerade eine andere Aufgabe, wartet die
Zeile (`wait.k = 'say'`), bis deren Gespräch vorbei ist (`state.talk`: Aufgabe und Ende der Zeile plus ein Takt, damit
die nächste Zeile desselben Gesprächs anschließt) – zwei Ereignisse reden nie durcheinander. „Gespräch überspringen“
(`skipDialog` mit `all`) beendet die laufende Zeile; die restlichen Zeilen dieses Gesprächs landen im selben Takt als
`skipped` im Protokoll, das Dialogfenster zeigt sie nicht. `say(…, wait=False)` reiht eine Zeile ohne Dauer ein
(das Fenster zeigt sie nach Lesezeit bzw. Aufnahme), das Skript läuft weiter. Zeilen mit Dauer verwirft das
Dialogfenster nie als veraltet. Endet ein Level nach seinen Zielen, wartet der Sieg, bis ein laufendes Gespräch
fertig ist (höchstens 60 s) – die Zeilen nach dem letzten Ziel gehen nicht verloren.
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
scenario.json bekommt die Figur einen Namen im Dialogfenster; `speaker` lässt sie für jemand anderen sprechen (der Fremde auf dem
Dorfplatz ist Orrin: `speaker="orrin"`, die Dialogkamera schaut zu ihr), `owner` gibt sie einem Spieler (einem
Dorf).

**Das Spielerprogramm lesen:** `program.status` (`"idle"`, `"running"`, `"paused"`, `"done"`, `"error"`,
`"stopped"`), `program.runs` und `program.get(name, default)` – eine Kopie der Variablen (Zahlen, Texte, Listen,
Wörterbücher, Spielobjekte; Funktionen werden `None`). Damit prüft eine Mission Vorhersage- und Variablen-Aufgaben.

## Kampagne in Python

Die ganze Kampagne – Kapitel 1–6 (`levels/c1-lindgrund/` … `levels/c6-thronsee/`) – und das Tutorial
(`levels/tutorial/`) sind Level-Ordner wie die Abenteuer, mit `"kind": "campaign"` bzw. `"tutorial"`; die Registry
reiht sie nach `order` mit ihren IDs, `next` und Fortschrittsschlüsseln in die Kampagne ein (`?mission=c3`,
`?mission=tutorial`). Eine deklarative Missionssprache (Zieltypen, Auslöser, Aktionen in JS-Dateien) gibt es nicht
mehr; nur die Entwicklerkarten Schaukasten und Gewimmel bleiben JS mit einem kleinen Haken (docs/MISSIONEN.md). `scenario.json` trägt die
Daten (Titel, Briefing, Texte je Ende, Spieler mit Dorf und Räubern, Vorrat, `available`, `shafts`, `landmarks`,
`weatherCycle`), `world.py` baut die Karte um, `mission.py` erzählt. Bausteine:

| Baustein | Wofür |
|---|---|
| `find_open(…, clear, reachable_from, avoid, on_ice)` | Plätze suchen, die auf jeder Karte passen (nie feste Koordinaten) |
| `place_building(…, level, min_r, radius, fixed)` | Gebäude für Dörfer, Räuber und Gegner; ohne Platz `None` |
| `add_shaft(res, near)`, `add_ruin(kind, near)` | Schacht in Reichweite, Ruinen als Kulisse |
| `camp(name, near, units, r, anchor, on_ice)` | Räuberlager mit Wachen, die bei Annäherung angreifen |
| `npc()` + `@on_talk`, `add_hero()` | Gesprächsfiguren, Helden, die sich anschließen |
| `offer()`/`withdraw()` + `@on_event("tribute")`, `unlock()` | Tribute (mit Gruppen als Wahl), Freischaltungen |
| `objective()` + `hint(…, ui_until=…)` | Ziele mit Fortschritt und Zeiger (Ring, Leuchtrahmen bis zur Handlung) |
| `convert()`, `remove()`/`obj.kill()`, `player("moorbrook")` | Seitenwechsel, spurlos entfernen bzw. mit Ereignis, Dörfer |
| `count(…, placed, level)`, `researched()`, `Serf.res`, `Building.max_hp`, `stock("energy")` | Abfragen für Bedingungen |
| `objective(…, hold=True)`, `clock=True`, `(stand, ziel, erfüllt)` | Halteziele („Schütze …“), Countdown, Ladebalken |
| `ending(reason)` | Nachgeschichte nach dem gewählten Weg, wenn die Ziele die Mission beenden |
| `spawn(owner, [("sword1", 2, 4), …], at, spread=False)` | eine Welle aus mehreren Truppenarten, Trupps genau am Ort |
| `Building.change_weather(state)`, `can_change_weather()`, `give(energy=)` | Wetterkraftwerk nach den Spielregeln (auch für Gegner) |
| `start_spot()`, `world.*`-Formung (unten) | Landschaft ohne feste Koordinaten |
| `step()` | geführte Schritte des Tutorials |

`count()` liest den **Zensus** des Takts (`runtime.count`: ein Durchlauf über alle Objekte, geteilt mit allen Zielen
und Bedingungen); jeder Befehl, der das Spiel ändert, verwirft ihn, damit er nie veraltet ist. Die Dialogzeilen
bleiben wortgleich mit den Aufnahmen (`public/audio/voice/index.json`, Schlüssel `sprecher|sprache|text`):
`scripts/asset-gen/voice.mjs` sammelt die `say()`-Zeilen aus dem Python-Syntaxbaum (`scenarioLines` in `outline.js`,
`src/sim/missions/dialogLines.js`), ein Test prüft, dass jede Zeile aller Kapitel und des Tutorials vertont ist
(außer den Hinweisen für den falschen Helden, die es nie als Aufnahme gab). Spielstände der früheren
Missionsdateien lassen sich nicht fortsetzen (`saves.err.missionChanged`); neue Spielstände tragen das Szenario mit.

**Zeitpunkte:** `say()` wartet, bis die Zeile gesprochen ist. Was zur selben Zeit geschehen soll wie eine Zeile
(eine Welle, eine Freischaltung, ein Seitenwechsel), steht darum *vor* den Zeilen; Wiederholungen rechnen von
einem festen Zeitpunkt aus statt ab dem Ende der Zeilen:

```python
@on_start
def sorties():
    wait_until(lambda: count("troop") > 0 or time() >= 600)    # Meilenstein: erste eigene Truppe
    first = time() + 120
    for i in range(3):
        wait_until(lambda: time() >= first + 300 * i)          # alle fünf Minuten, genau
        attack(spawn(BANDITS, "sword1", place("siegeB"), count=2, soldiers=3), base)
        say("taran", de="Schlagt das Lager dieser Prinzessin, bevor es wächst!", en="Hit this princess’s camp before it grows!")
```

Mehrere `@on_objective(…)`-Handler für dasselbe Ziel laufen als eigene Aufgaben nebeneinander (Mission 3: Zeilen,
Verstärkung nach 5 s, Warnung nach 45 s, Tauwetter nach 60 s).

### Landschaft formen: `world.*`

Ganze Landschaften entstehen mit wenigen Aufrufen, die jeweils die ganze Karte in einem Schritt bearbeiten
(Natives über `src/sim/missions/setupApi.js`: ganzzahlig, ohne Zufall, Millisekunden statt einer Python-Schleife
über jede Kachel; höchstens 200 solcher Aufrufe je Takt bzw. im Weltaufbau). Gelegt wird entlang einer **Achse**
von einem Punkt zu einem anderen, z. B. vom Start zur gegenüberliegenden Ecke – so passt dieselbe Landschaft auf
jede Karte. Mission 3 „Das Wetterwerk“ (`levels/c3-hagenfurt/world.py`) baut so ihr Tal:

```python
start = start_spot()                                         # Burg oder Startkachel
far = (world.width - 1 - start.x, world.height - 1 - start.y)
world.soften(sites=True)                                     # flach, ohne Felsen, Wasser und Bauplätze
front = world.ridge(start, far, 20, 7)                       # Bergkamm quer über die Karte, 20 Kacheln vom Start
gate = world.ridge_gap(front, 24, width=4)                   # Pass, 24 Kacheln rechts der Achse
gorge = world.ridge_gap(front, -22, width=3, water=True)     # Schlucht mit Fluss (nur zugefroren begehbar)
lake = world.axis_point(start, far, 50)                      # 50 Kacheln entlang der Achse
isle = world.lake_island(lake, inner=6, width=4)             # See mit Insel, im Sommer abgeschnitten
world.channel(gorge["far"], toward(lake, gorge["far"], 8))   # Fluss von der Schlucht in den See
print(world.reachable(start, isle, frozen=False), world.reachable(start, isle, frozen=True))   # False True
```

| Befehl | Wofür |
|---|---|
| `world.soften(divide, floor, sites)` | ganze Karte glätten; `sites=True` entfernt Siedlungsplätze, Schächte, Brückenstellen |
| `world.ridge(a, b, at, width, wobble)` | Bergkamm (Fels, auch über das Eis unpassierbar) rechtwinklig zur Achse a → b; liefert den Kamm als dict |
| `world.ridge_gap(kamm, side, width, water)` | Pass oder Schlucht; liefert `{"center", "near", "far"}` |
| `world.channel(a, b, width)` | Flussbett |
| `world.lake_island(mitte, inner, width, shore)` | See mit flacher Insel |
| `world.moat(mitte, reachable_from, inner, width)` | Wasserring um eine Burg, nur im Winter erreichbar (sonst None) |
| `world.island(a, b, inner, width, min_dist, keep)` | Insel auf dem Weg a → b; `keep` bleibt im Sommer erreichbar |
| `world.axis_point(a, b, along, side)`, `world.axis_coords(a, b, ziel)` | rechnen entlang der Achse und zurück |
| `world.reachable(a, b, frozen)`, `world.nearest_walkable(ziel, max_r)` | Gegenprobe Wegsuche (Sommer/Winter), nächste begehbare Kachel |

Der Kamm ist ein dict aus Zahlen und Punkten und reist mit dem Spielstand; gleiche Karte und gleiche Aufrufe ergeben
dieselbe Landschaft (Test `tests/sim/missionApi.test.js`, Hash gleich nach Speichern und Laden). Mission 6 legt den
Thronsee mit `world.moat` in einer Schleife über `inner` so eng wie möglich um Malvors Burg und Malvors Werkinsel mit
`world.island(…, keep=…)`, damit Ufer und Hinterland erreichbar bleiben.

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
| `players[i].hq` | `false`: ohne Burg, Dorfzentrum und Leibeigene – nur der Held (Lernabenteuer); ohne `stock` mit leerem Lager |
| `world.tracks` | Spuren im Level: `{ "mode": "permanent", "threshold": 16, "who": "heroes" }` – `mode` legt die Spieloption fest (`off`, `fading`, `permanent`; ohne `mode` gilt die Einstellung des Spielers, das Menü zeigt die Festlegung an), `threshold` 1 … 255 ab wann `"track"` gilt (Standard: Gras 48, Schnee 16), wer Spuren macht: `all`, `none`, `heroes`. Ältere Level: `"fade": 0` = `"mode": "permanent"`. Braucht ein Level eine Spur (Fährte, Kurs), immer `mode` setzen. |
| `players[i].stock/techs/serfs` | Startvorrat, Technologien, Leibeigene (alle Spielerfelder: `docs/MISSIONEN.md`) |
| `available` | Freischaltungen zu Beginn: `{ "buildings": […], "techs": […] }` (sonst alles) |
| `shafts`, `landmarks`, `weatherCycle` | Grubenplätze nur für diese Rohstoffe, Wahrzeichen, Wetterfolge (`docs/MISSIONEN.md`) |
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

## Ereignisse im Spielerprogramm

Auch das Spielerprogramm kennt die Ereignisse, die seine Oberfläche sieht: `@every`, `@on_enter`,
`@on_building_done`, `@on_building_placed`, `@on_destroyed`, `@on_killed`, `@on_recruited`, `@on_research`,
`@on_objective`, `@on_weather` und `@on_event` (nicht `start` und `talk`). Der Host bedient beide Programme mit
derselben Mechanik (`.handlers` je VM), erst die Mission, dann den Spieler, beide in fester Reihenfolge aus
`sim.events`; `@every`/`@on_enter` des Spielers stehen in `state.player.every/enter` und beginnen mit jedem Lauf neu.

- **Nur Eigenes:** Filter `player`/`owner` gelten im Spielerprogramm immer für HUMAN; `@on_enter` sieht nur Figuren,
  die der Spieler sieht (Nebel, `api.inArea`).
- **Wartet auf Ereignisse:** Ist das Hauptprogramm fertig und sind Ereignisfunktionen angemeldet, bleibt der Status
  `running` mit `listening` – das Panel zeigt „wartet auf Ereignisse“ (am Handy in der Laufleiste), Stopp beendet es.
- **Debugger:** Haltepunkte gelten auch in Ereignisfunktionen. Hält eine Aufgabe an (oder geht sie im Einzelschritt),
  halten alle anderen Aufgaben des Spielerprogramms mit, neue Ereignisse starten erst danach; Schritt/Über/Heraus
  gelten der angezeigten Aufgabe, Weiter gibt alle frei. Das Panel zeigt die Zeile der angehaltenen bzw. zuletzt
  gelaufenen Aufgabe.
- **Beschäftigt:** Will eine zweite Aufgabe eine Figur bewegen, drehen oder etwas aufheben lassen, auf die eine andere
  gerade wartet, gibt es `GameError` „… ist beschäftigt“. Ein Fehler in einer Aufgabe beendet das ganze Programm.

## Neustart je Etappe

Etappen sind Unterziele. **Ausführen startet die Etappe neu** (`src/sim/stage.js`, Test `tests/sim/stage.test.js`):
Beim ersten Ausführen nach einem neuen aktiven Unterziel merkt sich die Engine die Welt als normalen Spielstand
(`saveGame`, Schlüssel = die aktiven Ziele), jedes weitere Ausführen – auch „Schritt“ – lädt ihn wieder
(`loadGame`) und tauscht die Simulation mit `Engine.restart` ohne Ladebildschirm: Renderer und KI neu, Kamera,
Raster, Code und Haltepunkte bleiben. Der wiederhergestellte Stand hat denselben State-Hash wie beim Merken; nur die
Zähler für die Anzeige (`seq` von Dialog, Konsole, Zettel) laufen weiter, damit Panel und Dialogbox alles Neue als neu
erkennen. Auch `program.runs` und damit die Zufallszahlen des Spielerprogramms kommen aus dem Schnappschuss – dasselbe
Programm gibt denselben Lauf. Der Schnappschuss reist im Umschlag des Spielstands mit (`extra.stage`).

Abschalten: `"reset": false` in scenario.json (z. B. `adv5`) oder `reset(False)` im Missionsprogramm.

**Lockstep:** Schnappschuss und Wiederherstellen nutzen nur das Speicherformat und geschehen zwischen zwei Takten,
unmittelbar bevor der `run`-Befehl angewandt wird. Im Mehrspieler würde jeder Teilnehmer beim ersten `run` einer
Etappe den Stand merken und bei jedem weiteren `run` seine eigene Kopie einsetzen – alle haben in diesem Takt denselben
Stand, also tauschen alle auf dieselbe Welt. Einzige Eingabe bleibt der Befehl.

## Zettel

`note(speaker, code, title/de/en, editable=True)` im Missionsprogramm: Eine Figur steckt dem Spieler Code zu
(`state.note` im Script-Zustand, `uiState().note`). Das Panel ersetzt damit den Code des ersten bearbeitbaren
Spielerabschnitts und zeigt darüber das **Siegel** der Figur (Porträt oder Anfangsbuchstabe in ihrer Farbe, wie in
der Dialogbox) mit „Zettel der Magd“ bzw. „Zettel von …“. **Zurück zu meinem Code** holt den eigenen Code zurück,
„Zum Zettel“ wieder den (womöglich geänderten) Zettel; der Browser merkt sich den eigenen Code. Mit
`editable=False` lässt sich der Zettel nur ausführen. Ob eine Vorhersage stimmt, prüft die Mission mit
`program.get("guess")` und `program.status`.

## Auftrag im Panel

Oben im Code-Panel (am Handy im Blatt, Reiter Code) steht das aktive Hauptziel wie in der Zielliste, mit Fortschritt
und „2 von 3 geschafft“ bei mehreren Etappen.

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
| 3 | `adv3` | Taler für den Winter | `while` mit Bedingung, Rückgabewerte, Zähler (Talerreihe zufällig lang, `take()`) |
| 4 | `adv4` | Taler am Wegesrand | eigene Funktionen, Funktionen als Argument (Taler links und rechts, `left()`/`right()`) |
| 5 | `adv5` | Ein Dorf per Programm | Listen, Objekte und Methoden, Befehle wie in der Oberfläche (`reset: false`) |
| I.4 | `r1-4` | Im Schneetreiben | `while` mit Bedingung, Zählen, Vorhersagen (Kursmission, siehe unten) |

**I.4 „Im Schneetreiben“** (`levels/r1-4-blizzard/`, Musterlösung `tests/levels/blizzard.test.js`): eine Karte im
Winter mit drei Abschnitten, getrennt durch Felsbänder (Reihen 8–9 und 18–19). Jede Etappe ist ein Unterziel; die
Mission bringt Nelia mit `program.stop()`, `teleport` und `camera.fly_to` in den nächsten Abschnitt.
1. Die Magd Hedda steckt einen **Zettel** mit Zählschleife zu (`while nelia.can_step(): … steps = steps + 1`). Wie
   viele Schritte bis zum Waldrand? Die Vermutung kommt in `guess`; die Mission prüft nach dem Lauf
   `program.get("guess")` gegen die gegangenen Schritte und sagt sonst, wie weit es war – Ausführen beginnt von vorn.
2. Ein Taler im Schnee: den Zettel ändern, damit Nelia auf ihm stehen bleibt (`while nelia.here() != "coin"`) und
   ihn aufhebt.
3. Der Spur der Geflohenen folgen, durch alle Kurven bis zur Hütte (`front()/left()/right() == "track"`); im Schnee
   hinterlässt auch Nelia Fußabdrücke (`world.tracks.mode: "permanent"` – die Fährte bleibt unabhängig von der
   Spuren-Einstellung des Spielers).

Jedes Abenteuer hat eine Musterlösung im Test (`tests/sim/scripting.test.js`). Der Code der Spieler wird pro
Abenteuer im Browser gemerkt (`kronland-code-<id>`).

Die Abenteuer spielen auf offenen Wiesen; Hindernisse sind Landschaft mit Sinn (Fluss, See, Wäldchen,
Mauerreste), keine Baumgänge. Die Kamera zeigt ruhig die ganze Karte (Norden oben, am Desktop im Spielbereich
links vom Code-Panel) und läuft dem Helden nicht hinterher. Am Handy („Spiel ansehen“ während eines Laufs) gleitet
sie der Figur nach, die das Programm zuletzt gesteuert hat, sobald sie den freien Bildbereich verlässt
(`Engine.followWatched`); verschiebt, dreht oder zoomt der Spieler selbst, pausiert das 5 s. Das **Raster** (Knopf „# Raster“ im Panel, Vorliebe bleibt im
Browser; auch im Welteneditor) zeigt die Kacheln, jede fünfte Linie kräftiger – so lassen sich Schritte
abzählen. Der Held startet mit Blick nach Osten; `nelia.step()` geht immer in Blickrichtung und dreht die Figur
dabei nicht zur Laufrichtung. Mehrere Helden ohne Burg starten auf eigenen Kacheln.

Taler und Blumen liegen sichtbar auf ihren Kacheln, Spuren erscheinen im Gelände (siehe „Boden“ oben).

## Code-Panel und Debugger

Editor nach dem Vorbild von python.jetzt: ein echtes `<textarea>` über einem eingefärbten `<pre>` (gleicher
Lexer wie die VM). Tab/Umschalt+Tab rücken ein und aus, Enter übernimmt die Einrückung (nach `:` eine
Stufe tiefer), Rücktaste löscht eine Einrückstufe. **Alt+↑/↓** verschiebt die Zeile (oder die markierten Zeilen) –
für Parsons-Aufgaben, in denen die Zeilen stimmen, aber nicht ihre Reihenfolge; am Handy dasselbe mit ⇡ ⇣ in der
Tastenleiste (`editText.js`, Test `tests/ui/editText.test.js`). Klick auf eine Zeilennummer setzt einen Haltepunkt.

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
  (⇥ ⇤ ⇡ ⇣ : ( ) " " = == [ ] . _ #). **Ausführen** schaltet auf **Spiel ansehen**: Spiel im Vollbild, unten eine
  Leiste mit der aktuellen Zeile, Anhalten/Weiter, Stopp und „Code“; ist der Held nicht im freien Bildbereich zu
  sehen, rückt ihn die Kamera über die Leiste (`Engine.watchFocus`), sonst bleibt die Ansicht. Bei einem Fehler (oder Haltepunkt) springt
  das Blatt zurück zum Code, die Fehlerzeile ist sichtbar. Geöffnet wird das Blatt auch über die goldene Münze
  „Code“ im Schnellzugriff (mit grünem Punkt, solange das Programm läuft) oder „Spiel“ im Kopf geschlossen.

**Befehlshilfe im Code** (`hoverDoc.js`, `docCards.js`, `DocCard.vue`, Test `tests/ui/hoverDoc.test.js`): Bleibt
die Maus etwa eine halbe Sekunde auf einem Befehl, erscheint eine Karte mit Signatur, Kurzbeschreibung, Parametern
und Rückgabe (Texte aus `commandDocs.js`, erst beim ersten Bedarf nachgeladen, ~60 kB je Sprache). Sie
verschwindet beim Verlassen, Tippen oder mit Escape. **Strg+Klick** (Mac: **⌘+Klick**) öffnet die
Programmier-Referenz am Eintrag (`scripting/#<name>`) in einem neuen Tab; solange Strg/⌘ gedrückt ist, ist der
Befehl unterstrichen und der Zeiger eine Hand. Erkannt werden Punktketten (`nelia.step`, `math.sqrt`), Methoden
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
  Siedlungsplatz, **Gegenstand** (Taler oder Christrose auf die Kachel unter dem Zeiger, Ziehen legt eine Reihe),
  **Spur** (Pinsel mit Stärke 1 … 255: ab 16 Fußabdrücke im Schnee, ab 48 niedergetretenes Gras, ab 128 Erdpfad), Startplatz,
  Ort. Der Radierer nimmt auch Gegenstände und Spuren, Wasser und Felsen ebenso. Pinselgröße und Stärke. Rückgängig/Wiederholen (Strg+Z/Strg+Y), Raster (`#`).
- **Panel:** Szenario (Titel, Art, Auftrag zweisprachig, Spieler mit/ohne Burg, Nebel), Orte,
  Code (Abschnitte mit Stufe, Sichtbarkeit, bearbeitbar; Befehlsreferenz), Dateien (Bilder, Töne, 3D-Modelle
  hinzufügen und entfernen; sie gelten, solange die Seite offen ist, und reisen in der .zip), Beispiele
  (mitgelieferte Level als Vorlage). Den Reiter Texte gibt es nur noch für Szenarien der Version 1.
- **Code aus der Karte:** Doppelklick (Handy: lange drücken, nicht mit Heben/Senken/Ebnen/Glätten, die beim Halten
  weiterwirken) fügt Code an der Schreibmarke des zuletzt bearbeiteten Abschnitts ein (sonst „Mission“, ans Ende).
  Ort → `place("camp")`, eigene Burg → `hq()`, Held → `nelia`, Gesprächsfigur (Vorschau) → `"id"`, Baum, Haufen,
  Gebäude, Startplatz, Gegenstand … → `(x, y)`. Auf einer freien Kachel ein Menü: „Ort hier anlegen“
  (`make_place("place1", x, y, 2)`, Name markiert), „Gesprächsfigur hier“ (Baustein unten mit `at=(x, y)`),
  „Koordinaten einfügen“. Was das Werkzeug bei den zwei Klicks getan hat, wird zurückgenommen. Einfügen geht über
  den Browser (Strg+Z nimmt es zurück, am Handy ohne Tastatur direkt), Einrückung passend: Ausdrücke genau an die
  Marke, Anweisungen in eine eigene Zeile mit der Einrückung des Blocks (nie zwischen Dekorator und `def` oder in
  eine mehrzeilige Klammer), Definitionen mit Dekorator immer auf oberster Ebene hinter den umgebenden Block, mit
  Leerzeile. Logik: `src/ui/editor/codeInsert.js`, Kachel-Erkennung `EditorView.targetAt()`.
- **Bausteine** (Reiter Code): Gesprächsfigur (`npc` + `@on_talk`), Ziel mit Fortschritt (`objective` mit
  `(erreicht, Ziel)` + `@on_objective`), Angriffswelle (`@every` + `spawn` + `attack`, legt fehlende Räuber als
  Spieler an), Dialogfolge (mehrere `say`, auf oberster Ebene in `@on_start` verpackt), Talerspur (`add_item` in
  einer Schleife). Sie kommen an die zuletzt auf der Karte gewählte Kachel (sonst die Mitte), mit eindeutigen
  Platzhalternamen (`figure1`, `goal1` …), Texten de/en und Kommentaren in der Sprache der Oberfläche
  (`src/ui/editor/blocks.js`; jeder Baustein wird in `tests/ui/codeInsert.test.js` übersetzt und ausgeführt).
- **Wie in der Programmierumgebung:** Befehlskarten beim Überfahren, Strg+Klick zur Referenz, langes Drücken am
  Handy (derselbe `CodeEditor`); in der Vorschau Fehler mit roter und Hinweise mit gelber Zeilenmarke (verschwinden,
  sobald der Abschnitt bearbeitet wird); beim Testspielen Debugger und Hinweise im Code-Panel.
- **Welt aus Code:** „Weltaufbau ausführen“ zeigt das Ergebnis der Missionsabschnitte als Vorschau;
  „Ins Gelände übernehmen“ macht es zur Karte (und kommentiert den Abschnitt `world` aus).
- **Speichern/Öffnen** als `.zip` (Level-Ordner mit Dateien; Öffnen nimmt auch eine `.json`); ein Entwurf wird im
  Browser gemerkt (ohne Dateien). **Testspielen** startet das
  Szenario mit allen Abschnitten im Code-Panel und Debugger fürs Missionsskript (Haltepunkte halten das Spiel an);
  danach geht es zurück in den Editor.
- Gespeichert wird die Karte als `world.terrain` (Höhen und Flags Base64, Bäume/Haufen/Plätze/Schächte, Gegenstände
  `{kind: "coin"|"flower", x, y}` und Spuren `{kind: "track", x, y, strength}` in `features`, Startplätze); beim
  Testspielen und Öffnen kommt alles zurück.

## Tests

```bash
npx vitest run tests/script      # Sprache: CPython-Vergleich, Fehler, Debugger, Speichern mitten im Lauf
npx vitest run tests/sim/scripting.test.js tests/sim/scenarioV2.test.js tests/sim/editor.test.js tests/levels
npx vitest run tests/sim/ground.test.js tests/sim/figures.test.js tests/script/hints.test.js
npx vitest run tests/sim/stage.test.js tests/sim/playerEvents.test.js tests/levels/blizzard.test.js tests/ui/editText.test.js tests/ui/codeInsert.test.js
E2E_PORT=4310 npx playwright test e2e/script.spec.js e2e/stage.spec.js e2e/editor-code.spec.js
```

`tests/script/cases/*.py` laufen in der VM und müssen dieselbe Ausgabe liefern wie `*.out` (mit `python3`
erzeugt; ist Python installiert, prüft der Test auch die `.out`-Dateien). Neuer Fall: Datei anlegen,
`python3 fall.py > fall.out`. Passt die installierte Chromium-Version nicht zu Playwright:
`PW_CHROMIUM=/pfad/zu/chrome npx playwright test …`.
