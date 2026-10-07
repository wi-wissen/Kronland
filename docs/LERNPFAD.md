# Lernpfad: Programmieren lernen im Kronland (Konzept)

Konzept für einen Programmierkurs in mehreren **Missionsreihen**. Jede Reihe beginnt mit einer
**Eingangsprobe**, die das Grundniveau sichert – so kann man auf dem eigenen Niveau einsteigen. Grundlage
sind der bewährte Kara-Lernpfad (PythonKara) und das, was Kronland schon kann: eigene Python-VM, Helden-API,
Debugger, Code-Panel am Handy, fünf Lernabenteuer ([Skripte](SKRIPTE.md)). Stand: Entwurf, noch nichts
davon umgesetzt.

## Ziele

1. **Alle algorithmischen Grundstrukturen und Listen** einmal vollständig: Sequenz, Verzweigung
   (ein-, zweiseitig, mehrfach), Zählschleife, bedingte Schleife, Endlosschleife mit Abbruch, Verschachtelung,
   Funktionen (ohne/mit Parametern, mit Rückgabe), Variablen und Datentypen, logische Operatoren, Listen
   (lesen, durchlaufen, aufbauen, auswerten, verändern, zweidimensional), optional Rekursion.
2. **Kleiner, merkbarer Wortschatz** wie bei Kara: wenige Aktoren, wenige Sensoren, in jeder Reihe höchstens
   zwei neue Befehle.
3. **Spielsprache statt Gitterabstraktion:** Figuren, Orte und Gegenstände aus Kronland, die hübsch aussehen
   und einen Sinn in der Welt haben.
4. **Einstieg auf jedem Niveau:** Reihen sind einzeln spielbar; die Eingangsprobe zeigt, ob es passt.

## Herangehensweisen (Pitch)

| | A „Kara im Kronland“ | B „Werkzeug wächst mit der Geschichte“ | C „Zwei Linien“ |
|---|---|---|---|
| Idee | Eine Figur (Nelia), ein fester Wortschatz, Gitterwelt mit Bäumen, Wasser, Laternen. Reihen nach Struktur. | Jede Reihe eine Figur der Kampagne mit eigenen Fähigkeiten (Nelia läuft, Orrin handelt, Taran stellt Truppen auf, Baumeister baut). | Gitter-Linie (Kara: Sensoren, Bedingungen) und Zeichen-Linie (Turtle: Zählschleifen, Variablen, Parameter) parallel, Listen verbinden beide. |
| Stärke | Bewährt, gut merkbar, eng am bestehenden Unterricht | Viel Spielgefühl, Geschichte trägt | Jede Struktur dort, wo sie am natürlichsten ist (Spirale, Muster) |
| Schwäche | Weniger „Spiel“ | Wortschatz wächst stark, Reihen schwer einzeln spielbar | Zwei Welten erklären |

**Empfehlung: A als Kern, mit den guten Teilen von B und C.** Der Wortschatz bleibt bei Nelia und wächst nur
leicht. Figuren aus B werden **Gastgeber** der Reihen (Auftrag, Dialog, Belohnung), bringen aber keine
eigenen Befehle mit. Die Turtle-Idee aus C steckt in Reihe 3: Nelia stellt Laternen in Mustern auf.

## Der Wortschatz

### Gegenstand: die Laterne

Kara braucht einen Gegenstand, den man ablegen, aufheben und unter sich erkennen kann (Erdbeere). In Kronland:
die **Laterne**. Sie passt zum ewigen Winter der Kampagne („Krone aus Eis“), ist begehbar, leuchtet im Schnee
und macht aus jedem Programm ein sichtbares Bild: Laternenweg, Laternenspirale, Krone aus Laternen.
Alternativen, falls die Laterne nicht gefällt: Wegstein (Steinmännchen), Kornsack, Fackel.

### Grundwortschatz (Reihe 1 und 2) – 9 Befehle

| Art | Befehl | Kara-Gegenstück | Status |
|---|---|---|---|
| Aktor | `hero.step()` | `move()` | vorhanden |
| Aktor | `hero.turn_left()`, `hero.turn_right()` | `turnLeft()`, `turnRight()` | vorhanden |
| Aktor | `hero.put()` – Laterne abstellen | `putBerry()` | neu |
| Aktor | `hero.pick()` – Laterne aufheben | `removeBerry()` | neu |
| Sensor | `hero.can_step()` – vorn frei? | `not treeFront()` | vorhanden |
| Sensor | `hero.can_step("left")`, `hero.can_step("right")` | `not treeLeft()`, `not treeRight()` | Parameter neu |
| Sensor | `hero.on_lantern()` – steht Nelia auf einer Laterne? | `onBerry()` | neu |
| Ausgabe | `print()`, `hero.say(text)` | `print()` | vorhanden |

Ab Reihe 2 kommt **`hero.ahead()`** dazu (liefert `"free"`, `"tree"`, `"water"`, `"pile"` …) – ein Sensor
mit Text statt Wahrheitswert, ideal für `elif`. Bäume und Wasser sind die Hindernisse (Kara: Bäume), Haufen
liegen nur in späteren Reihen. Kein Pilz zum Schieben: er bringt in Karas Pfad keine eigene Struktur.

**Strikter Modus wie bei Kara:** Nelia läuft nicht in Bäume oder Wasser und nicht über den Rand; der Versuch
endet mit einer freundlichen Fehlermeldung (`err.script.blocked`) und markierter Zeile.

**Warum `hero.` davor?** Die bestehende API und alle Abenteuer nutzen es, der Spieler lernt nebenbei die
Punktschreibweise, und in Reihe 5 können andere Figuren dieselben Befehle bekommen (`orrin.step()`).

### Wortschatz je Reihe

| Reihe | neu dazu |
|---|---|
| 1 | Grundwortschatz ohne `can_step("left"/"right")` |
| 2 | `can_step("left"/"right")`, `hero.ahead()` |
| 3 | – (nur Sprache: Variablen, Parameter, `return`) |
| 4 | `lanterns(reihe)`, `hero.chop()`, `hero.take()` (Listen von Orten und Dingen) |
| 5 | Dorf-API wie in `adv5` (`build`, `serfs`, Ereignisse) |

Jedes Szenario legt seinen Wortschatz fest (Feld `vocabulary`). Unbekannte Spielbefehle meldet der Compiler
schon heute; neu wäre der Hinweis „Diesen Befehl kennt Nelia in dieser Reihe noch nicht“. Die Befehlsliste
im Panel zeigt nur den Wortschatz der Mission.

## Die Missionsreihen

Jede Reihe: **Eingangsprobe** (x.0) → Missionen nach PRIMM bzw. Use-Modify-Create → **Meisterstück** (letzte
Mission, Transfer). Gastgeber in Klammern. Kara-Nummern zum Vergleich mit dem bisherigen Pfad.

Abkürzungen für den Aufgabentyp: **V** Vorhersagen, **Ä** Ändern (Modify), **S** selbst schreiben (Make),
**F** Fehler finden, **O** Optimieren, **P** Prüfung auf mehreren Zufallswelten.

### Reihe 1 – „Nelias erste Schritte“ (Nelia, Lindgrund)

Sequenz, Zählschleife, Verzweigung, bedingte Schleife. Einstieg ohne Vorwissen, daher keine Eingangsprobe.

| Nr. | Titel | Struktur | Aufgabe | Typ | Kara |
|---|---|---|---|---|---|
| 1.1 | Zum Brunnen | Sequenz | Programm mit 2 Schritten so ergänzen, dass Nelia am Brunnen steht | Ä | 1 |
| 1.2 | Der Laternenweg | Sequenz | Nach jedem Schritt eine Laterne abstellen | S | 2 |
| 1.3 | Um die Scheune | Sequenz mit Drehen | Erst vorhersagen, wo Nelia ankommt (Kachel antippen), dann ausführen; danach zum Tor bringen | V, S | – |
| 1.4 | Lange Wege | `for` + `range` | Zählschleife anpassen, bis Nelia beim Schatz ist (heute `adv1`) | Ä | 5 |
| 1.5 | Jede zweite Kachel | `for` mit mehreren Befehlen | Laterne nur auf jede zweite Kachel; 12 Kacheln Weg | S, O | – |
| 1.6 | Die vergessene Laterne | `if` | Am Ende des Wegs liegt manchmal eine Laterne: aufheben, wenn da | S, P | 3 |
| 1.7 | Lücken füllen | `if/else` in `for` | Laternenreihe fester Länge: fehlende ergänzen, sonst „Schon hell!“ sagen | S, P | 4 |
| 1.8 | Bis zum Wald | `while` | Unabhängig von der Entfernung bis vor den Baum laufen | S, P | 6 |
| 1.9 | Wo geht's lang? | `while not` | So lange links drehen, bis vorn frei ist | S, P | 15 |
| 1.10 | Meisterstück: Die Lichterreihe | `if/else` in `while` | Bis zum Baum laufen; Laternen aufheben, wo welche stehen, und abstellen, wo keine stehen | S, P | 8 |

**Reihenfolge:** Schleife vor Verzweigung. Ein einzelnes `if` hat erst Sinn, wenn die Welt sich ändert –
das leisten die Zufallswelten mit **P** (Programm muss auf drei Karten klappen). Die Zählschleife zahlt sich
dagegen sofort aus („nicht 14-mal `step()`“).

### Reihe 2 – „Durch Wald und Winter“ (Nelia und Orrin unterwegs)

Kombination, Verschachtelung, Endlosschleife mit `break`, Funktionen ohne Parameter, `elif`, `and/or/not`.

| Nr. | Titel | Struktur | Aufgabe | Typ | Kara |
|---|---|---|---|---|---|
| 2.0 | Eingangsprobe: Der Wächterpfad | `if/else` in `while` | Bis zum Baum laufen, Lücken mit Laternen füllen, am Ende sagen, ob etwas fehlte | S, P | 18 |
| 2.1 | Kracht es? | Lesen | Fertiges Programm: läuft Nelia gegen den Baum? Vorhersagen, dann prüfen und reparieren | V, F | 7 |
| 2.2 | Der umgestürzte Baum | Sequenz in `if` in `while` | Zum Ziel laufen, einen Baum im Weg umgehen | S, P | 17 |
| 2.3 | Viele Hindernisse | Schleife + Umgehen | Einzelne Bäume an zufälligen Stellen umgehen | S, P | 9 |
| 2.4 | Durchs Unterholz | verschachtelte Schleifen | Baumgruppen unterschiedlicher Länge umgehen | S, P | 10 |
| 2.5 | Die Wachrunde | `while True` + `break` | Im Uhrzeigersinn um das Wäldchen patrouillieren, bis Nelia auf einer Laterne steht | S | 11 |
| 2.6 | Slalom am Thronsee | lange Befehlsfolge | Slalom um drei Bäume hin und zurück | S | 12 |
| 2.7 | Weniger ist mehr | `def` (DRY) | **Dein eigener Code aus 2.6** wird geladen: mit einer Funktion `half_round()` kürzen | Ä, O | 13 |
| 2.8 | An der Mauer entlang | `elif`, `and/or/not` | Rechte-Hand-Regel mit `can_step("right")`, `ahead()`: rechts frei → rechts, sonst geradeaus, sonst links | S, P | – |
| 2.9 | Meisterstück: Das Eislabyrinth | alles bisher | Pro Baumreihe den Ausgang finden, nie vorbeilaufen; Zufallslabyrinth | S, P | 22 |

**Funktionen:** Der Lernanlass bleibt erhalten, ist aber stärker als bei Kara: 2.7 lädt den **eigenen**
Slalom-Code aus 2.6. Wer früher Funktionen will (Karel-Weg), bekommt in 2.3 den Tipp, `go_around()` selbst
zu definieren – Pflicht wird `def` erst in 2.7.

### Reihe 3 – „Die Feldmesserin“ (Feldmesserin aus Lindgrund)

Variablen, Datentypen, Parameter, Rückgabewerte. Die Turtle-Linie: Laternen werden zu Mustern.

| Nr. | Titel | Struktur | Aufgabe | Typ | Kara |
|---|---|---|---|---|---|
| 3.0 | Eingangsprobe: Das Laternenquadrat | Funktion + verschachtelte Schleife | Mit `side()` ein Quadrat aus Laternen (Seite 4) stellen | S | – |
| 3.1 | Wie viele Bäume? | Zählvariable | Slalom: Nelia zählt die Bäume selbst und meldet die Zahl (Idee aus `adv3`) | S, P | 20 |
| 3.2 | Bis zum Fluss und zurück | Variable als Speicher | Schritte bis zum Wasser zählen, mit `print(f"…")` melden, genauso weit zurück | S, P | – |
| 3.3 | Felder abstecken | Parameter | `walk(n)`, dann `field(width, height)`: Rechtecke nach Auftrag | Ä, S | – |
| 3.4 | Die Laternenspirale | Variable in Schleife | Erste Seite 14, jede Seite eine kürzer | S | 21 |
| 3.5 | Genau in die Mitte | Rückgabewert, `//` | Eigener Sensor `distance()` liefert Schritte bis zum Baum; Nelia stellt sich in die Mitte zwischen zwei Bäume | S, P | – |
| 3.6 | Gefunden? | Wahrheitswert als Merker | Reihe absuchen, `found = True` setzen, am Ende melden; Vergleich mit `break` | S, P | – |
| 3.7 | Meisterstück: Die Treppe zur Burg | Parameter + Schleifen | `stairs(steps, width)` – Treppe aus Laternen in verschiedenen Größen | S, P | – |

### Reihe 4 – „Orrins Kontor“ (Orrin, Händler)

Listen. Orrin führt Buch – Listen sind für ihn natürlich: Lieferlisten, Wegpläne, Lagerbestand.

| Nr. | Titel | Struktur | Aufgabe | Typ |
|---|---|---|---|---|
| 4.0 | Eingangsprobe: Die Inventur | Funktion mit Rückgabe, Zähler | `count_row()` zählt Laternen einer Reihe und gibt die Zahl zurück | S, P |
| 4.1 | Orrins Wegbeschreibung | Liste lesen, Index | `route = [3, 2, 5]`: Schritte je Abschnitt, dazwischen rechts drehen; erst mit `route[0]`, dann mit `for` | Ä |
| 4.2 | Der Befehlszettel | `for` über Liste + `elif` | Liste aus Texten (`"step"`, `"left"`, `"lantern"`) abarbeiten – ein kleiner eigener Interpreter | S |
| 4.3 | Notieren | Liste aufbauen (`append`) | Reihe ablaufen, je Kachel `True`/`False` notieren, Liste ausgeben | S, P |
| 4.4 | Die vollste Reihe | Summe, Maximum selbst bauen | `lanterns(reihe)` liefert Listen; welche Reihe hat die meisten? Dorthin laufen | S, P |
| 4.5 | Nur Stein, kein Lehm | Filtern, Objekte in Listen | Haufen am Weg: nur Steinhaufen aufheben (`p.res == "stone"`), Zahl melden | S, P |
| 4.6 | Das Balkenlager | Liste verändern, Sortieren | Laternenreihen unterschiedlicher Länge als Liste lesen, selbst sortieren (Tauschen), sortiert neu aufstellen | S |
| 4.7 | Die Krone aus Licht | 2D-Liste, verschachtelte Schleifen | Plan `["..#..", ".###.", …]`: Laternen nach Plan stellen – ein Bild entsteht | Ä, S |
| 4.8 | Meisterstück: Der Heimweg | Liste als Stapel | Nelia merkt sich im Labyrinth jeden Zug und läuft mit `reversed` zurück | S, P |

### Reihe 5 – „Ein Dorf per Programm“ (Baumeister, Orrin)

Transfer in das eigentliche Spiel: Objekte und Methoden, Listen von Leibeigenen und Gebäuden, Ereignisse.
Optional Rekursion. Bestehendes `adv5` wird hier eingeordnet.

| Nr. | Titel | Struktur | Aufgabe |
|---|---|---|---|
| 5.0 | Eingangsprobe: Die Holzliste | Listen von Objekten filtern | Aus `trees_near()` nur Bäume einer Reihe fällen |
| 5.1 | Ein Dorf per Programm | Objekte, Methoden | Zwei Wohnhäuser und einen Bauernhof bauen (heute `adv5`) |
| 5.2 | Arbeit für alle | Listen verteilen | Untätige Leibeigene gleichmäßig auf Baustellen verteilen |
| 5.3 | Der Wächter | Ereignis (`@every`, `@on_enter`) | Wenn Räuber den Ort betreten, Nelia warnen lassen |
| 5.4 | Lichtung erhellen (optional) | Rekursion | Jede erreichbare Kachel einer Lichtung mit Laterne füllen (Flutfüllung) |
| 5.5 | Meisterstück: Winterfest | alles | Kleine Wirtschaft per Programm aufbauen, bis eine Vorgabe erreicht ist |

## Abdeckung der Grundstrukturen

| Struktur | eingeführt | vertieft |
|---|---|---|
| Sequenz | 1.1–1.3 | überall |
| Zählschleife `for`/`range` | 1.4 | 1.5, 3.4, 4.7 |
| `if` / `if-else` | 1.6 / 1.7 | 1.10, 2.0 |
| Mehrfachverzweigung `elif` | 2.8 | 4.2 |
| bedingte Schleife `while` / `while not` | 1.8 / 1.9 | 2.x |
| Endlosschleife + `break` | 2.5 | 3.6 |
| Verschachtelung | 2.4 | 3.0, 4.7 |
| Funktion ohne Parameter | 2.7 | 3.0 |
| Parameter | 3.3 | 3.7 |
| Rückgabewert | 3.5 | 4.0 |
| Variablen, Zähler, Merker | 3.1, 3.6 | 4.x |
| logische Operatoren | 2.8 | 2.9 |
| Listen: lesen, durchlaufen, aufbauen, auswerten, filtern, verändern | 4.1–4.6 | 5.x |
| 2D-Listen, Stapel | 4.7, 4.8 | – |
| Objekte, Ereignisse | 5.1, 5.3 | 5.5 |
| Rekursion (optional) | 5.4 | – |

## Was das Spiel besser kann als Kara

- **Zufallswelten (P):** Jede Mission läuft auf drei Seeds. Ein Programm aus lauter `step()` scheitert, wo
  `while` gewinnt – der Unterschied zwischen „für diese Karte“ und „allgemein“ wird spürbar.
- **Drei Sterne:** gelöst · auf allen Welten · höchstens N Anweisungen (Optimieren wie Kara 16). Nur der
  erste Stern ist Pflicht.
- **Vorhersage im Spiel:** Vor dem Ausführen tippt man die Zielkachel an (Geist-Markierung), danach zeigt das
  Spiel den Vergleich. So wird PRIMM-„Predict“ eine Spielhandlung statt einer Arbeitsblattfrage.
- **Eigener Code als Material:** Missionen können den Code einer früheren Mission laden (2.6 → 2.7).
- **Bilder als Belohnung:** Laternenmuster bleiben stehen; Spirale, Treppe, Krone sind Erfolgserlebnisse
  zum Herzeigen (Screenshot).
- **Geschichte:** Jede Reihe ist eine kleine Episode vor der Kampagne; Gastgeber sprechen mit Stimme.
- **Debugger:** Schritt, Haltepunkt, Variablen – schon vorhanden, ab Reihe 3 bewusst in Aufgaben eingebaut
  (Typ **F**).

## Eingangsprobe

- Eine Mission, die alle Voraussetzungen der Reihe in einer Aufgabe verlangt (siehe x.0).
- Gelöst → Reihe läuft normal. Nach drei Fehlversuchen schlägt das Spiel die passende Mission der Vorreihe vor
  („Diese Mission übt genau das“), sperrt aber nichts.
- Alle Reihen sind von Anfang an offen; der Fortschritt (Sterne, gelöste Missionen) wird im Browser gemerkt.

## Was gebaut werden müsste

1. **Laterne:** begehbares Objekt auf einer Kachel (Sim-Zustand, `serialize.js`, State-Hash), Modell mit
   Lichtschein, Platzierung im Szenario (`add_lantern(x, y)`).
2. **API:** `hero.put()`, `hero.pick()`, `hero.on_lantern()`, `hero.can_step(side)`, `lanterns(row)`;
   Fehler `err.script.blocked`, `noLantern`, `alreadyLantern`; Referenz in `API_DOC`, beide Sprachen.
3. **Wortschatz je Szenario** (`vocabulary`) mit Compiler-Hinweis und gefilterter Befehlsliste.
4. **Prüfung auf mehreren Seeds** und Sterne (Anweisungen zählen über den Syntaxbaum).
5. **Vorhersage-Modus** (Kachel antippen, Vergleich nach dem Lauf; Handy: Antippen statt Hover).
6. **Reihen-Menü** im Programmier-Abenteuer mit Eingangsprobe, Sternen, Code-Übernahme aus früheren Missionen.
7. **Missionen** als Szenario-Dateien (`src/sim/missions/scenarios/`), je Mission Musterlösung im Test auf
   allen Seeds. Die bisherigen Abenteuer gehen auf: `adv1` → 1.4, `adv2` → 2.8, `adv3` → 3.1, `adv4` → 2.7 (zweite Funktionsaufgabe), `adv5` → 5.1.
8. **Lehrkräfte:** Übersicht der Reihen mit Lernzielen auf der Website, Musterlösungen getrennt.

Sinnvolle Reihenfolge: 1–3 und Reihe 1 zuerst (trägt allein), dann 4–6, Reihen 2–5 nacheinander.

## Offene Entscheidungen

1. **Gegenstand:** Laterne (Empfehlung), Wegstein oder Kornsack?
2. **`hero.` oder kurze Befehle** (`step()` wie Kara)? Empfehlung: `hero.` – passt zur bestehenden API.
3. **Schleife vor Verzweigung** (Empfehlung, wegen Zufallswelten) oder wie im Kara-Pfad umgekehrt?
4. **Funktionen:** Pflicht erst in 2.7 mit eigenem Code (Empfehlung) oder Karel-Weg schon in 2.3?
5. **Reihe 5** als Teil des Kurses oder als Ausblick ins freie Spiel?
6. **Umfang:** Gut 40 Missionen sind viel. Für einen ersten Wurf reichen Reihe 1 und 2 (20 Missionen).
