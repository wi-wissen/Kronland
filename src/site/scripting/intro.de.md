## Was Skripte können {#intro}

In Kronland kannst du programmieren – in [Python](https://de.wikipedia.org/wiki/Python_%28Programmiersprache%29),
genauer in einer kleinen Teilmenge davon, die direkt im Spiel läuft („Kronland-Python“). Programme kommen an drei
Stellen vor:

- **Kursmissionen** (Startmenü → **Programmier-Abenteuer**): Du steuerst die Heldin Nelia mit Code durch den Schnee,
  legst Taler aus, findest durchs Unterholz und baust zum Schluss Lindgrund wieder auf. Die Missionen gehören zu
  Reihen des Programmierkurses (I.2 ist Reihe I, Mission 2; M ist das Meisterstück), jede führt etwas Neues ein:
  {{adventures}}.
- **Missionsskripte**: Der Ablauf einer Mission – Dialoge, Kamerafahrten, Angriffswellen, Ziele, Sieg und Niederlage –
  ist selbst ein Python-Programm. Die Beispielmission „Der Überfall“ ist komplett so geschrieben.
- **Welteneditor**: Eigene Karten bauen und mit Missions- und Spielerabschnitten zu eigenen Abenteuern machen.

Es gibt zwei **Rechtestufen**. Spielerprogramme (Kursmissionen) dürfen nur, was du auch mit der Maus darfst – jeder
Befehl läuft durch dieselben Regeln, kostet dieselben Rohstoffe und wird genauso abgelehnt. Missionsskripte dürfen
alles: Truppen erzeugen, Rohstoffe verschenken, Gelände formen. In der Referenz unten sind Befehle, die es nur in
Missionsskripten gibt, mit **nur Mission** markiert.

Die Namen der Befehle sind englisch (`nelia.step()`, `stock("wood")`), Erklärungen und Fehlermeldungen gibt es auf
Deutsch und Englisch. Kronland-Python liefert für dieselben Programme dieselben Ausgaben wie das „echte“ Python –
automatische Tests vergleichen das.

> **Ausprobieren:** Alle Beispiele zu den Grundfunktionen (Abschnitt [Grundfunktionen](#ref-pyfunc) und folgende)
> laufen hier auf der Seite in derselben Maschine wie im Spiel – die angezeigte **Ausgabe** ist echt. Beispiele mit
> Spielbefehlen laufen im Spiel; ein automatischer Test prüft jedes davon in einer Testkarte.

## Den Editor öffnen {#editor}

1. Startmenü → **Programmier-Abenteuer** → eine Mission wählen → **Mission starten**.
2. Rechts erscheint das **Code-Panel** mit deinem Programm, am Handy öffnest du es über die goldene Münze **Code**.
3. Code eintippen und **Ausführen** drücken. Unter dem Code steht die **Konsole** mit allem, was `print()` ausgibt.

| Knopf | Wirkung |
|---|---|
| **Ausführen** | startet das Programm von vorn |
| **Stopp** | beendet es (der Held bleibt stehen) |
| **Schritt** | führt eine Anweisung aus, auch in Funktionen hinein |
| **Über** | nächste Zeile – Funktionsaufrufe laufen am Stück |
| **Heraus** | weiter, bis die aktuelle Funktion fertig ist |
| **Weiter** / **Anhalten** | bis zum nächsten Haltepunkt laufen bzw. anhalten |

Ein Tipp auf eine **Zeilennummer** setzt einen [Haltepunkt](https://de.wikipedia.org/wiki/Haltepunkt_%28Programmierung%29).
Hält das Programm, ist die Zeile grün, und du siehst globale, übergebene und lokale Variablen und den Aufrufstapel –
ein kleiner [Debugger](https://de.wikipedia.org/wiki/Debugger). Bleibst du mit der Maus auf einem Befehl (am Handy:
lange drücken), erklärt ihn eine Karte; der Knopf **Referenz** öffnet diese Seite. Der Knopf **# Raster** blendet die Kacheln ein, damit du Schritte
abzählen kannst. Dein Code wird im Browser gemerkt. Mehr zur Bedienung im [Handbuch](manual/#coding).

Im **Welteneditor** (Programmier-Abenteuer → Welteneditor) gibt es den Reiter **Code** mit allen Abschnitten eines
Szenarios: Missionsabschnitte (alles erlaubt) und Spielerabschnitte (wie die Oberfläche).

## So läuft ein Programm {#run}

**Übersetzen.** Beim Ausführen zerlegt ein [Lexer](https://de.wikipedia.org/wiki/Lexikalische_Analyse) den Text in
Wörter und Zeichen und erkennt die Einrückung, ein [Parser](https://de.wikipedia.org/wiki/Parser) baut daraus einen
Syntaxbaum, und ein [Compiler](https://de.wikipedia.org/wiki/Compiler) macht daraus
[Bytecode](https://de.wikipedia.org/wiki/Bytecode): einfache Befehle wie „lade Variable“, „addiere“, „rufe auf“.
Schon dabei fallen Tippfehler auf – ein unbekannter Name wird gemeldet, bevor überhaupt etwas läuft.

**Ausführen.** Den Bytecode führt eine eigene [virtuelle Maschine](https://de.wikipedia.org/wiki/Virtuelle_Maschine)
aus, eine Stapelmaschine (Werte liegen auf einem [Stapel](https://de.wikipedia.org/wiki/Stapelspeicher)). Sie kann nach
jedem einzelnen Befehl anhalten und genau dort weitermachen. Darum kann `nelia.step()` im Code einfach „warten“, bis der
Held angekommen ist, während das Spiel weiterläuft.

**Im Takt des Spiels.** Das Spiel rechnet in festen **Takten**: {{ticks}} pro Sekunde Spielzeit. In jedem Takt darf
ein Programm eine begrenzte Zahl von Bytecode-Befehlen ausführen (das **Budget**):

| Was | Befehle pro Takt |
|---|---|
| Spielerprogramm (Kursmission) | {{budgetPlayer}} |
| alle Missionsskripte zusammen | {{budgetMission}} |
| Weltaufbau beim Laden der Karte (einmalig) | {{budgetSetup}} |
| eine Bedingung (`wait_until`, `objective`, `sorted(key=…)`) am Stück | {{syncLimit}} |

Ist das Budget aufgebraucht, macht das Programm im nächsten Takt weiter. Eine
Endlosschleife ohne `wait` friert das Spiel also **nicht** ein – sie
kommt nur nie zum Ende; beende sie mit **Stopp**. Nur eine Bedingung, die nicht fertig wird, bricht mit
„Das dauert zu lange“ ab. Funktionen dürfen sich selbst aufrufen
([Rekursion](https://de.wikipedia.org/wiki/Rekursion)), aber höchstens {{maxDepth}} Aufrufe tief.

**Warten.** Befehle, die im Spiel Zeit brauchen, halten das Programm an, bis sie fertig sind: `wait()`,
`wait_until()`, `nelia.step()`, `nelia.move_to()`, `nelia.turn_left()`, `nelia.take()`, `say()`, `camera.fly_to()` …
Befehle wie `build()` oder `serf.work_on()` geben dagegen nur den Auftrag und kehren sofort zurück.

**Aufgaben.** Das Hauptprogramm und jede Ereignisfunktion (`@every`, `@on_enter` …) laufen als eigene **Aufgaben**
nebeneinander, immer in fester Reihenfolge. Wartet eine, laufen die anderen weiter.

**Deterministisch.** Dasselbe Programm auf derselben Karte macht immer genau dasselbe
([Determinismus](https://de.wikipedia.org/wiki/Determinismus_%28Algorithmus%29)): Es gibt keine Uhrzeit, der
[Zufall](https://de.wikipedia.org/wiki/Zufallszahlengenerator) von `random` ist vorhersehbar und wird mitgespeichert,
und [Kommazahlen](https://de.wikipedia.org/wiki/Gleitkommazahl) rechnen auf jedem Rechner Bit für Bit gleich. Deshalb
lässt sich ein Spiel mitten im laufenden Programm speichern und laden, und das Programm macht danach genau dort weiter.

## Die Sprache {#language}

Kronland-Python kennt die wichtigsten Teile von Python. Die Beispiele mit **Ausgabe** laufen hier auf der Seite.

### Kommentare und Anweisungen {#lang-comments}

Alles hinter `#` ist ein [Kommentar](https://de.wikipedia.org/wiki/Kommentar_%28Programmierung%29) und wird
übersprungen. Jede Zeile ist eine [Anweisung](https://de.wikipedia.org/wiki/Anweisung_%28Programmierung%29); mehrere
gehen mit `;` in eine Zeile. Blöcke (nach `if`, `for`, `def` …) beginnen mit einem Doppelpunkt und werden
**eingerückt** – üblich sind 4 Leerzeichen ([Abseitsregel](https://de.wikipedia.org/wiki/Abseitsregel)).
Tabulatoren und Leerzeichen dürfen nicht gemischt werden.

```py
# Das ist ein Kommentar
a = 1; b = 2
if a < b:
    print("a ist kleiner")  # eingerückt: gehört zum if
```

### Ausgabe mit print {#lang-print}

`print()` schreibt Werte in die Konsole, getrennt durch Leerzeichen.

```py
print("Hallo, Kronland!")
print("Holz:", 120, "Stein:", 40)
```

### Variablen {#lang-variables}

Eine [Variable](https://de.wikipedia.org/wiki/Variable_%28Programmierung%29) ist ein Name für einen Wert. `=` gibt
ihr einen (neuen) Wert, `+=`, `-=`, `*=` … ändern ihn. Namen aus Buchstaben, Ziffern und `_`, nicht mit einer Ziffer
vorn; Groß- und Kleinschreibung zählt. Mehrere Werte lassen sich auf einmal zuweisen und tauschen.

```py
wood = 120
wood += 30
x, y = 4, 7
x, y = y, x
first, *rest = [1, 2, 3]
print(wood, x, y, first, rest)
```

### Zahlen und Rechnen {#lang-numbers}

[Ganzzahlen](https://de.wikipedia.org/wiki/Ganze_Zahl) (`int`, beliebig groß) und Kommazahlen (`float`, mit Punkt:
`2.5`). Wahrheitswerte sind `True` und `False`, „nichts“ ist `None`.

| Operator | Bedeutung | Beispiel |
|---|---|---|
| `+ - *` | plus, minus, mal | `3 * 4` → `12` |
| `/` | geteilt (immer Kommazahl) | `7 / 2` → `3.5` |
| `//` `%` | ganzzahlig geteilt, Rest | `7 // 2` → `3`, `7 % 2` → `1` |
| `**` | hoch | `2 ** 10` → `1024` |
| `== != < > <= >=` | Vergleiche (auch verkettet: `1 < x < 5`) | `3 == 3` → `True` |
| `and or not` | und, oder, nicht | `x > 0 and x < 9` |
| `in`, `not in` | enthalten | `"a" in "Kranz"` |
| `is`, `is not` | dasselbe Objekt (für `None`) | `x is None` |
| `& ^ ~ << >>` | Bit-Operationen (und, exklusiv oder, nicht, schieben) | `5 & 3` → `1` |

```py
print(7 / 2, 7 // 2, 7 % 2, -7 // 2)
print(2 ** 100)
print(0.1 + 0.2, round(0.1 + 0.2, 2))
print(1 < 3 < 5, not True, None is None)
```

### Texte und f-Strings {#lang-strings}

[Texte](https://de.wikipedia.org/wiki/Zeichenkette) stehen in `"…"` oder `'…'`, mehrzeilig in `"""…"""`. Mit `+`
hängt man sie aneinander, `*` wiederholt, `[i]` holt ein Zeichen, `[a:b]` einen Ausschnitt. Ein **f-String**
(`f"…"`) setzt Werte in `{}` direkt ein, mit Formatangabe nach `:`. Es gibt auch `"%d Holz" % 5` und
[`str.format`](#str.format).

```py
name = "Nelia"
wood = 120.456
print("Hallo " + name + "!", name * 2)
print(name[0], name[-1], name[1:3], len(name))
print(f"{name} hat {wood:.1f} Holz, {wood:>8.2f}|")
print("Zeile 1\nZeile 2\tmit Tab")
```

### Bedingungen: if, elif, else {#lang-if}

Mit einer [bedingten Anweisung](https://de.wikipedia.org/wiki/Bedingte_Anweisung_und_Verzweigung) läuft ein Block
nur, wenn die Bedingung wahr ist. `elif` prüft weiter, `else` fängt den Rest. Als „falsch“ gelten auch `0`, `""`,
leere Listen und `None`. Kurzform: `a if bedingung else b`.

```py
wood = 80
if wood >= 100:
    print("genug Holz")
elif wood >= 50:
    print("fast genug")
else:
    print("zu wenig")
print("voll" if wood > 200 else "Platz frei")
```

### Schleifen: while {#lang-while}

Eine [Schleife](https://de.wikipedia.org/wiki/Schleife_%28Programmierung%29) wiederholt einen Block. `while`
wiederholt, **solange** die Bedingung wahr ist. `break` beendet die Schleife sofort, `continue` springt zur nächsten
Runde; ein `else`-Block läuft, wenn die Schleife ohne `break` zu Ende ging.

```py
n = 1
while n < 100:
    n = n * 2
print(n)
```

Im Spiel typisch: `while nelia.can_step(): nelia.step()` – laufen, bis etwas im Weg ist.

### Schleifen: for und range {#lang-for}

`for` läuft über die Elemente einer Folge: eine Liste, einen Text, ein Wörterbuch (dessen Schlüssel) oder
`range(…)` für Zahlen.

```py
for i in range(3):
    print("Runde", i)
for res in ["wood", "stone"]:
    print(res.upper())
for i, c in enumerate("abc"):
    if c == "b":
        continue
    print(i, c)
else:
    print("fertig")
```

### Funktionen {#lang-def}

Eine [Funktion](https://de.wikipedia.org/wiki/Funktion_%28Programmierung%29) ist ein benannter Block, der
[Parameter](https://de.wikipedia.org/wiki/Parameter_%28Informatik%29) bekommt und mit `return` ein Ergebnis
zurückgibt (ohne `return`: `None`). Parameter können Standardwerte haben und beim Aufruf mit Namen übergeben
werden; `*args` sammelt weitere Werte, `**kwargs` weitere benannte. Funktionen sind Werte: man kann sie übergeben
(etwa als `key` an `sorted`) – oder kurz als `lambda` schreiben. Innere Funktionen sehen die Variablen außen
([Closure](https://de.wikipedia.org/wiki/Closure_%28Funktion%29)); ändern lassen sie sich mit `global` bzw.
`nonlocal`.

```py
def cost(n, price=50):
    return n * price

print(cost(3), cost(3, price=20))

def total(*amounts, **extra):
    return sum(amounts) + sum(extra.values())

print(total(1, 2, 3, gold=10))

double = lambda x: x * 2
print(list(map(double, [1, 2, 3])))

count = 0
def tick():
    global count
    count += 1
tick(); tick()
print(count)
```

### Listen {#lang-lists}

Eine [Liste](https://de.wikipedia.org/wiki/Liste_%28Datenstruktur%29) hält mehrere Werte der Reihe nach. Gezählt
wird ab 0, negative Indizes zählen von hinten. Ausschnitte (`xs[1:3]`, `xs[::-1]`) liefern neue Listen. Eine
**List-Comprehension** baut eine Liste in einer Zeile. Spielbefehle wie `serfs()` oder `trees_near()` liefern Listen.

```py
xs = [3, 1, 4, 1, 5]
xs.append(9)
print(xs[0], xs[-1], xs[1:3], len(xs))
print(sorted(xs), xs[::-1])
print([x * x for x in xs if x > 2])
print(4 in xs, xs.count(1))
del xs[0]
print(xs)
```

### Tupel {#lang-tuples}

[Tupel](https://de.wikipedia.org/wiki/Tupel_%28Informatik%29) sind unveränderliche Listen in runden Klammern –
ideal für Koordinaten. `find_spot()` liefert zum Beispiel ein Tupel `(x, y)`, und überall, wo ein Ziel erwartet wird,
darf ein Tupel stehen.

```py
spot = (12, 7)
x, y = spot
print(spot, x, y, spot[0])
print((1, 2) + (3,))
```

### Wörterbücher {#lang-dicts}

Ein Wörterbuch (`dict`, eine [Zuordnungstabelle](https://de.wikipedia.org/wiki/Zuordnungstabelle)) speichert Werte
unter **Schlüsseln**. Fehlt ein Schlüssel, gibt es einen `KeyError` – mit `get` kommt stattdessen ein Ersatzwert.

```py
stock = {"wood": 120, "stone": 40}
stock["gold"] = 300
stock["wood"] -= 20
print(stock["wood"], stock.get("iron", 0), len(stock))
for res, n in stock.items():
    print(res, n)
print({r: n * 2 for r, n in stock.items()})
```

### Module: math und random {#lang-import}

Mit `import` lädt man ein Modul. Es gibt genau zwei: [`math`](#ref-pymath) und [`random`](#ref-pyrandom).
`from math import sqrt` holt einzelne Namen, `import math as m` gibt einen Kurznamen.

```py
import math
from random import randint, seed
seed(1)
print(math.sqrt(2), math.floor(2.7), randint(1, 6))
```

### Dekoratoren und Ereignisse {#lang-decorators}

In Missionsskripten meldet ein Dekorator wie `@every(10)` oder `@on_start` die folgende Funktion für ein
[Ereignis](https://de.wikipedia.org/wiki/Ereignis_%28Programmierung%29) an – siehe [Ereignisse](#ref-events).

```
@on_building_done("farm")
def farm_ready(building):
    say("nelia", "Der Bauernhof ist fertig!")
```

## Was es (noch) nicht gibt {#missing}

Kronland-Python ist bewusst klein. Was fehlt, meldet schon der Compiler mit einer verständlichen Nachricht
(„Das gibt es in Kronland-Python (noch) nicht“):

| Aus Python | In Kronland | Stattdessen |
|---|---|---|
| `class` (eigene Klassen) | nicht vorhanden | Wörterbücher und Funktionen; Spielobjekte gibt es fertig |
| `try` / `except` / `finally`, `raise` | nicht vorhanden – ein Fehler beendet das Programm | vorher prüfen: `if nelia.can_step():`, `d.get(k)`, `x in xs` ([Ausnahmebehandlung](https://de.wikipedia.org/wiki/Ausnahmebehandlung)) |
| Mengen `{1, 2}`, `set()` | nicht vorhanden | Listen oder Wörterbücher |
| `yield`, Generatoren | nicht vorhanden; `(x for x in …)` liefert eine Liste | Liste zurückgeben |
| `with`, `async` / `await` | nicht vorhanden | `wait()` und `wait_until()` zum Warten |
| `:=` (Walross), Parameter nach `*` | nicht vorhanden | eigene Zeile für die Zuweisung |
| `input()` | nicht vorhanden | Werte ins Programm schreiben oder aus dem Spiel lesen |
| `math.sin`, `cos`, `log`, `exp` … | bewusst weggelassen (rechnen nicht überall gleich) | `math.sqrt`, `math.hypot`, `math.dist` |
| andere Module (`time`, `os` …) | nur `math` und `random` | `time()` und `wait()` aus dem Spiel |
| `dir`, `id`, `hash`, `open`, `set`, `eval` … | nicht vorhanden | – |
| Bytes `b"…"`, komplexe Zahlen `1j`, `@` | nicht vorhanden | – |
| `float ** float` | nur `** 0.5` | `math.sqrt` |

Typangaben (`x: int = 5`) sind erlaubt und werden ignoriert.

## Fehlermeldungen {#errors}

Läuft etwas schief, hält das Programm an: Die Zeile wird rot, und ein Kasten zeigt die Art des Fehlers (wie in
Python), den Abschnitt, die Zeile und eine Erklärung – oft mit Vorschlag („Meintest du `turn_left`?“).

| Art | Bedeutet | Beispiel |
|---|---|---|
| `SyntaxError` | So lässt sich der Text nicht lesen | `if x > 3` ohne Doppelpunkt |
| `IndentationError` | Einrückung passt nicht | Block nach `:` nicht eingerückt |
| `NameError` | Name unbekannt (Tippfehler?) | `Nelia.step()`, `pirnt(1)` |
| `TypeError` | falscher Typ oder falsche Argumente | `"Holz: " + 5`, `wait("2")` |
| `ValueError` | Wert passt nicht | `int("zwölf")` |
| `IndexError` / `KeyError` | Position bzw. Schlüssel fehlt | `[1, 2][5]`, `{}["gold"]` |
| `ZeroDivisionError` | durch null geteilt | `5 / 0` |
| `AttributeError` | Objekt hat das nicht | `nelia.jump()` |
| `RecursionError` | zu tief verschachtelt oder zu lange gerechnet | Funktion ruft sich endlos selbst auf |
| `GameError` | das Spiel lehnt ab | `nelia.step()` vor einem Baum, `build()` ohne Rohstoffe |

Jeder Eintrag der Referenz nennt unter **Typische Fehler** die Meldungen, die dort vorkommen können.

### Hinweise {#hints}

Manches ist erlaubtes Python und läuft, tut aber fast nie, was gemeint war – Nelia steht still, und niemand weiß
warum. Dafür gibt es **Hinweise**: Sie erscheinen gleich beim Ausführen in Bernstein an der Zeile, das Programm hält
aber nicht an (in einer Aufgabe „Finde den Fehler“ kann der Code ja Absicht sein; eine Mission schaltet sie mit
`hints(False)` ab).

| Code | Was passiert | Hinweis |
|---|---|---|
| `nelia.left()` | schaut nach links, die Antwort geht verloren – sie dreht nicht | Zum Drehen: `nelia.turn_left()` |
| `nelia.step` | nichts: ohne Klammern wird der Befehl nicht ausgeführt | Meintest du `nelia.step()`? |
| `while nelia.can_step:` | Endlosschleife: eine Methode ohne Klammern gilt als wahr | Meintest du `can_step()`? |
| `if nelia.front() == "Tree":` | nie wahr, die Antwort heißt `"tree"` | mit der Liste der möglichen Antworten |
| `count == count + 1` | vergleicht nur, `count` bleibt gleich | Meintest du `count = count + 1`? |
| `nelia.turnleft()` | gibt es nicht (Fehler, sobald die Zeile drankommt) | schon vor dem Start: Meintest du `turn_left`? |
| Schleife ohne Aktion | das Programm rechnet, im Spiel passiert nichts | nach etwa 5 Sekunden |

## Ausführliche Beispiele {#examples}

### Aus den Kursmissionen {#ex-adventures}

Musterlösungen einzelner Etappen – probiere es aber erst selbst! Jede Lösung wird in einem automatischen Test in
ihrer Etappe gespielt und muss sie schaffen.

I.2 „Taler für die Mägde“, Etappe „Hang“: eine Schleife mit mehreren Befehlen.

{{ex_zigzag}}

I.5 „Holz für die erste Nacht“, Etappe „Bach“: eine Variable zählt die Schritte, eine zweite Schleife läuft genauso
oft zurück.

{{ex_brook}}

I.M „Heimweg durchs Unterholz“: die Rechte-Hand-Regel findet aus jedem Unterholz hinaus.

{{ex_thicket}}

II.1 „Orrins Abkürzung“: eigene Befehle mit `def`.

{{ex_fetch}}

III.M „Lindgrund steht wieder“: ein Bauplan als Liste von Listen.

{{ex_village}}

### Leibeigene Holz fällen lassen {#ex-lumber}

Eine Funktion schickt untätige Leibeigene an die nächsten Bäume: `zip` paart Leibeigene und Bäume, bis eine der
Listen zu Ende ist. Danach misst das Programm, wie viel Holz in 30 Sekunden hereinkommt.

{{ex_lumber}}

### Über Gebäude und Truppen laufen {#ex-report}

Ein Wörterbuch zählt die Gebäude je Art, eine Schleife läuft über alle Trupps, und `max(…, key=stock)` findet den
Rohstoff, von dem am meisten da ist – Funktionen als Argument.

{{ex_report}}

### Auf Ereignisse reagieren: eine Mission {#ex-waves}

Ein Missionsskript (Welteneditor): Alle 60 Sekunden kommt eine größere Welle, `wait_until` wartet, bis sie besiegt
ist, und das Ziel wird nach drei Wellen erfüllt. `@on_objective` und `@on_destroyed` entscheiden über Sieg und
Niederlage.

{{ex_waves}}

### Eine Welt aus Code {#ex-world}

Ein Abschnitt „Welt aufbauen“: Hügel aus Rauschen, ein Bach quer über die Karte, ein Wäldchen zwischen Burg und
Kartenmitte und ein Zielort. Im Welteneditor macht „Ins Gelände übernehmen“ das Ergebnis zur festen Karte.

{{ex_world}}
