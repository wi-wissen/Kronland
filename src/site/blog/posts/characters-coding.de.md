---
title: Figuren-Pipeline und Programmier-Abenteuer
date: 2026-10-04T20:41:03+02:00
teaser: Wie aus einem gemalten Bogen eine animierte 3D-Figur wird – Polygone, Skelett, Gewichte, Animation auf der Grafikkarte. Und parallel dazu eine eigene kleine Python-Sprache mit Lexer, Parser, Compiler und virtueller Maschine.
milestone: true
---

## Worum es geht {#what}

Dieser Meilenstein hat zwei Hälften, die nichts miteinander zu tun haben und trotzdem gleichzeitig entstehen:

- **Figuren-Pipeline:** Aus einem Konzeptbogen mit vier Ansichten macht der Dienst Meshy ein 3D-Modell mit Skelett
  und Bewegungen; eigene Skripte bereiten es fürs Spiel auf. Die ersten eigenen Figuren sind Leibeigener und
  Leibeigene. Bis dahin standen im Spiel freie Figuren aus dem KayKit-Paket (siehe [Artikel 5](blog/first-package/)).
- **Programmieren im Spiel:** eine Teilmenge von Python mit eigener Bytecode-Maschine, Lernabenteuer mit
  Einzelschritt, Haltepunkten und Variablenansicht, die Skript-Mission „Der Überfall“ und ein Welteneditor.

Dazu kommen Feinschliff an der Oberfläche, Balance nach dem Vorbild und die englischen Adressen der Website mit dem
**Kompendium** – so heißt das Nachschlagewerk seitdem, weil niemand außer dem Spiel selbst mitschreibt.

Beide Hälften beantworten eine Frage, die man sich als Spieler selten stellt: Was steckt hinter einer Figur, die
läuft, und hinter einem Befehl, den man tippt?

## Wie eine 3D-Figur entsteht {#figure}

### Vom Bild zum Netz

Am Anfang steht ein **Konzeptbogen**: ein gemaltes Bild der Figur von vorn, von der Seite, von hinten und von der
anderen Seite, erzeugt mit einem Bildmodell. Eine Stilvorgabe (`docs/STIL.md`) sorgt dafür, dass alle Figuren
zusammenpassen: warme Farben, leicht überzeichnete Proportionen, und die Fläche, die später die Spielerfarbe tragen
soll, in reinem Magenta.

Diese vier Ansichten gehen an [Meshy](https://www.meshy.ai), einen Dienst, der aus Bildern ein 3D-Modell rechnet.
Heraus kommt ein **Polygonnetz**: Tausende kleiner Dreiecke, deren Ecken im Raum liegen, dazu eine Textur – ein Bild,
das wie Geschenkpapier über die Dreiecke gelegt wird. Welche Stelle der Textur auf welches Dreieck kommt, steht in
den UV-Koordinaten jeder Ecke. Grafikkarten können nur Dreiecke zeichnen; jede gekrümmte Fläche im Spiel ist in
Wahrheit aus vielen flachen Dreiecken zusammengesetzt. Mehr dazu unter
[Polygonnetz](https://de.wikipedia.org/wiki/Polygonnetz) und [UV-Mapping](https://de.wikipedia.org/wiki/UV-Mapping).

![Der Leibeigene aus diesem Meilenstein: links das Nahmodell mit Textur, daneben dasselbe Netz als Drahtgitter (11 429 Dreiecke), das vereinfachte Spielmodell (2 087 Dreiecke) und rechts das Skelett in einer Laufpose.](blog/characters-coding/serf-lod-de.webp)

### Das Skelett

Ein Netz allein kann sich nicht bewegen. Dafür bekommt die Figur ein **Skelett** (englisch *rig*): eine Hierarchie
von Knochen. Die Hüfte ist die Wurzel, an ihr hängen Wirbelsäule und Oberschenkel, an der Wirbelsäule Hals und
Schultern, an den Schultern die Oberarme und so weiter. Der Leibeigene hat 24 Knochen:

```
Hips → Spine02 → Spine01 → Spine → neck → Head
                                 → LeftShoulder → LeftArm → LeftForeArm → LeftHand
                                 → RightShoulder → …
     → LeftUpLeg → LeftLeg → LeftFoot → LeftToeBase
     → RightUpLeg → …
```

Jeder Knochen hat eine Lage relativ zu seinem Elternknochen. Dreht man den Oberarm, drehen sich Unterarm und Hand
automatisch mit – genau wie bei einem echten Arm. Meshy setzt dieses Skelett automatisch ein („Auto-Rig“). In der
Meshy-Oberfläche sieht man dabei die Figur mit eingezeichneten Gelenkpunkten, bevor die Bewegungen dazukommen.

### Skinning: welche Ecke zu welchem Knochen gehört

Nun muss jede Ecke des Netzes wissen, welchem Knochen sie folgt. Eine Ecke an der Hand folgt der Hand. Aber eine Ecke
am Ellenbogen? Die soll halb dem Oberarm und halb dem Unterarm folgen, sonst knickt der Ärmel wie ein Strohhalm.
Deshalb bekommt jede Ecke bis zu **vier Knochen mit Gewichten**, die zusammen 1 ergeben. Das nennt man
[Skinning](https://en.wikipedia.org/wiki/Skeletal_animation).

![Gewichte sichtbar gemacht: Rot heißt „folgt diesem Knochen voll“, Blau „gar nicht“. Links der Oberarm, in der Mitte der rechte Oberschenkel – am Übergang zur Hüfte wird es grün und gelb, dort teilen sich mehrere Knochen die Ecken. Rechts derselbe Oberarm mitten in einer Bewegung.](blog/characters-coding/weights-de.webp)

Für jede Ecke rechnet das Programm dann:

```
neue_Lage = Σ  gewicht[i] · Matrix(knochen[i]) · ruhelage
           i=1..4
```

Die Matrix eines Knochens beschreibt, wie weit er sich gegenüber der Ruhehaltung verschoben und gedreht hat. Wer
Matrizen aus dem Mathematikunterricht kennt: Es sind 4×4-Matrizen in
[homogenen Koordinaten](https://de.wikipedia.org/wiki/Homogene_Koordinaten), damit Drehung und Verschiebung in einer
einzigen Multiplikation stecken.

### Bewegungen

Eine **Animation** (ein *Clip*) ist eine Liste von Schlüsselbildern: Zu bestimmten Zeitpunkten steht fest, wie jeder
Knochen gedreht ist; dazwischen wird gemischt. Meshy liefert für jede Rolle eine Reihe von Clips. Der Leibeigene hat
neun: `idle`, `walk`, `run`, `chop`, `mine`, `hammer`, `carry`, `cheer` und `die`. Fehlt einer Figur ein Clip, nimmt
das Spiel einen verwandten – `mine` fällt auf `chop` zurück, `chop` auf `attack`, `attack` auf `idle`.

Werkzeuge wie Axt, Hammer und Spitzhacke hängen als starre Teile an der Hand und sind nur in passenden Clips sichtbar.
Im Bild oben sind sie ausgeblendet.

## Polygone sparen: Detailstufen {#lod}

11 429 Dreiecke für einen einzigen Leibeigenen sind viel, wenn hundert davon herumlaufen. Gleichzeitig ist eine Figur
beim normalen Zoom nur etwa 25 Pixel hoch – feine Gesichtszüge sieht man da nicht. Die Lösung heißt
[Level of Detail](https://de.wikipedia.org/wiki/Level_of_Detail) (LOD): mehrere Fassungen desselben Modells, je
nachdem, wie groß es gerade auf dem Bildschirm erscheint.

Jede Figur hat deshalb zwei Netze mit demselben Skelett:

| | Nahmodell | Spielmodell |
|---|---|---|
| wann | Figur über ~80 px hoch | mittlerer Zoom und weiter |
| Netz | Meshy 7.1, ~11 000 Dreiecke | dasselbe Modell, per „Remesh“ auf ~2 000 reduziert |
| Textur | 2048 × 2048 + Normal-Map | 1024 × 1024 + Normal-Map |

Entscheidend ist die **Bildschirmhöhe in Pixeln**, nicht der Abstand zur Kamera. So wechselt die Stufe auf Handy und
Desktop bei gleicher sichtbarer Größe. Unterhalb von 80 px läuft das Spielmodell mit 24 Bildern pro Sekunde ohne
Zwischenmischung, unter 28 px nur noch mit 8, und unter 12 px bleibt die Figur in ihrer Haltung stehen. Damit die Grenze nicht flackert, wenn eine Figur genau auf ihr steht, gibt es
eine [Hysterese](https://de.wikipedia.org/wiki/Hysterese) von etwa ±10 %: Hoch schaltet die Stufe etwas später als
herunter. Der Wechsel selbst wird über 0,35 Sekunden mit einem Punktmuster (Dithering) überblendet.

Die Normal-Map ist ein Trick, um mit wenigen Dreiecken viele Details zu zeigen: Ein zweites Bild speichert für jeden
Punkt, in welche Richtung die Oberfläche „eigentlich“ zeigt. Die Beleuchtung rechnet damit, als wären Falten und
Nähte echt ([Normal Mapping](https://de.wikipedia.org/wiki/Normal_Mapping)).

## Hunderte Figuren auf der Grafikkarte {#gpu}

Jetzt wird es technisch, aber es lohnt sich. Würde das Spiel für jede Figur die Gleichung oben auf dem Prozessor
rechnen, wären das bei 100 Figuren mit je 2 000 Ecken 200 000 Matrixrechnungen pro Bild – zu viel für ein Handy.
Und jede Figur einzeln an die Grafikkarte zu schicken, kostet einen eigenen Zeichenaufruf.

Kronland macht es anders:

1. **Backen:** Beim Laden spielt das Spiel jeden Clip einmal ab, 24 Bilder pro Sekunde, und schreibt für jedes Bild
   die Matrizen aller Knochen in eine **Textur**. Eine Zeile ist ein Bild, je Knochen vier Pixel (jedes Pixel hat vier
   Zahlen RGBA, also eine Spalte der 4×4-Matrix).
2. **Instanzierung:** Alle Figuren mit demselben Modell werden in *einem* Zeichenaufruf gezeichnet
   ([Instancing](https://en.wikipedia.org/wiki/Geometry_instancing)). Je Figur schickt der Prozessor nur wenige
   Zahlen: Lage, Bildnummer, Mischanteil und Farben.
3. **Skinning im Shader:** Die Grafikkarte liest für jede Ecke die Matrizen ihrer Knochen aus der Textur und rechnet
   die Gleichung selbst – für alle Ecken gleichzeitig.

![So liegt eine Animation in der Textur: eine Zeile je Bild, vier Texel je Knochen. Eine Ecke kennt ihre Knochen und Gewichte; die Grafikkarte holt sich die passenden Matrizen.](blog/characters-coding/bone-texture-de.svg)

Der Shader-Code dafür (in [GLSL](https://de.wikipedia.org/wiki/OpenGL_Shading_Language), der Sprache für
Grafikkarten-Programme) ist erstaunlich kurz:

```glsl
// src/render/characters.js (gekürzt)
uniform highp sampler2D uBones;   // die gebackene Knochen-Textur
attribute vec4 aBoneIdx;           // bis zu vier Knochen je Ecke …
attribute vec4 aBoneW;             // … und ihre Gewichte
attribute vec3 aAnim;              // Bild A, Bild B, Mischanteil (je Figur)

mat4 charBone(float frame, float b) {
  int x = int(b) * 4, y = int(frame);
  return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0),
              texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0));
}
mat4 charSkin() {
  mat4 m = charBoneMix(aBoneIdx.x) * aBoneW.x;
  if (aBoneW.y > 0.0) m += charBoneMix(aBoneIdx.y) * aBoneW.y;
  …
  return m;
}
```

`texelFetch` liest ein einzelnes Pixel aus der Textur, vier davon ergeben eine Matrix. Hunderte Figuren kosten so
eine Handvoll Zeichenaufrufe.

### Spielerfarbe aus Magenta

Jeder Spieler hat eine Farbe – Blau, Rot, Grün, Ocker. Statt für jede Farbe eine eigene Textur zu speichern, ist die
Teamfläche im Konzept magenta gemalt (oben an Kopftuch und Halstuch gut zu sehen). Der Shader erkennt beim Zeichnen
Pixel in der Nähe von Magenta und färbt sie in die Spielerfarbe um; die Helligkeit bleibt, damit Falten und Schatten
erhalten bleiben. Eine Textur reicht für alle Spieler.

## Eine eigene Programmiersprache {#language}

Die zweite Hälfte des Meilensteins klingt größenwahnsinnig: eine eigene Programmiersprache. Genauer: eine Teilmenge
von Python, die im Spiel läuft. Wozu? Für **Lernabenteuer**, in denen man den Helden mit Code steuert, und für
**Missionsskripte**, die auf Ereignisse reagieren.

Man könnte fragen, warum nicht einfach JavaScript im Browser ausführen. Drei Gründe:

- **Determinismus:** Skripte laufen *in* der Simulation. Sie müssen auf jedem Rechner exakt gleich rechnen, auch mit
  Kommazahlen und Zufall (siehe [Artikel 1](blog/simulation-core/)).
- **Anhalten und Fortsetzen:** `hero.step()` soll im Code warten, bis der Held einen Schritt gegangen ist – ohne das
  Spiel einzufrieren. Und ein Spielstand soll ein laufendes Skript mitten in einer Schleife speichern können.
- **Sicherheit und Lernen:** Ein Programm soll nur die Befehle kennen, die es kennen darf, und Fehlermeldungen sollen
  auf Deutsch und Englisch verständlich sein.

So läuft ein Programm durch die Maschine:

```
Quelltext → Lexer → Tokens → Parser → Syntaxbaum → Compiler → Bytecode → VM
```

![Was mit der Zeile x = 2 + 3 * 4 passiert. Die Tokens, der Baum und der Bytecode sind echte Ausgaben der Kronland-Python vom Stand dieses Meilensteins.](blog/characters-coding/compiler-de.svg)

### 1. Der Lexer

Der [Lexer](https://de.wikipedia.org/wiki/Tokenizer) liest den Text Zeichen für Zeichen und fasst sie zu **Tokens**
zusammen: Namen, Schlüsselwörter, Zahlen, Texte, Operatoren. Aus diesem kleinen Lernprogramm

```python
while hero.can_step():
    hero.step()
hero.say("Da!")
```

macht er diese Folge (echte Ausgabe von `tokenize`):

```
kw:while  name:hero  op:.  name:can_step  op:(  op:)  op::  newline
indent  name:hero  op:.  name:step  op:(  op:)  newline
dedent  name:hero  op:.  name:say  op:(  str:"Da!"  op:)  newline  eof
```

Bemerkenswert sind `indent` und `dedent`. In Python bestimmt die Einrückung, welche Zeilen zur Schleife gehören. Der
Lexer führt dafür einen [Stapel](https://de.wikipedia.org/wiki/Stapelspeicher) der aktuellen Einrückungstiefen: Wird
eine Zeile tiefer eingerückt, legt er die neue Tiefe oben drauf und gibt `indent` aus; geht es zurück, nimmt er Tiefen
herunter und gibt für jede ein `dedent` aus. Danach sieht der Parser Einrückung wie geschweifte Klammern in anderen
Sprachen.

### 2. Der Parser

Der [Parser](https://de.wikipedia.org/wiki/Parser) baut aus der flachen Tokenfolge einen
[Syntaxbaum](https://de.wikipedia.org/wiki/Abstrakter_Syntaxbaum). Er ist ein *rekursiver Abstieg*: Für jede Regel
der Grammatik gibt es eine Funktion, die sich selbst und andere aufruft. Die Regel „Punkt vor Strich“ steckt in der
Reihenfolge dieser Funktionen – eine Summe besteht aus Produkten, ein Produkt aus Faktoren. Deshalb landet `3 * 4`
tiefer im Baum als das `+` und wird zuerst ausgerechnet.

### 3. Der Compiler

Der [Compiler](https://de.wikipedia.org/wiki/Compiler) läuft durch den Baum und erzeugt **Bytecode**: eine Liste
einfacher Befehle für eine gedachte Maschine. Für die `while`-Schleife oben sieht das so aus (echte Ausgabe):

```
 0 LOAD_GLOBAL  hero
 1 LOAD_ATTR    can_step
 2 CALL         0          ← Funktion ohne Argumente aufrufen
 3 JUMP_IF_FALSE 9         ← Bedingung falsch? Hinter die Schleife springen
 4 LOAD_GLOBAL  hero
 5 LOAD_ATTR    step
 6 CALL         0
 7 POP                     ← Rückgabewert wegwerfen
 8 JUMP         0          ← zurück zur Bedingung
 9 LOAD_GLOBAL  hero
10 LOAD_ATTR    say
11 LOAD_CONST   "Da!"
12 CALL         1
…
```

Eine Schleife ist also nichts anderes als ein bedingter Sprung nach vorn und ein unbedingter Sprung zurück. Der
Compiler kennt auch schon alle Namen. Schreibt man `hero.stpe()`, meldet er den Fehler, bevor irgendetwas läuft, und
schlägt das ähnlichste bekannte Wort vor („Meintest du `step`?“) – berechnet mit der
[Levenshtein-Distanz](https://de.wikipedia.org/wiki/Levenshtein-Distanz).

### 4. Die virtuelle Maschine

Die VM ist eine [Stapelmaschine](https://de.wikipedia.org/wiki/Stapelspeicher): `LOAD_CONST` legt einen Wert auf den
Stapel, `BINARY` nimmt zwei herunter und legt das Ergebnis drauf. Im Kern ist sie eine einzige große Schleife:

```js
// src/script/vm.js (gekürzt)
execute(task, budget) {
  for (;;) {
    if (used >= budget) break;                 // Zeitbudget aufgebraucht: später weiter
    if (debug && code.stmt[pc] && this.debugStop(…)) { task.state = 'paused'; break; }
    const op = code.ops[pc], arg = code.args[pc];
    frame.pc = pc + 1; used++;
    switch (op) {
      case OP.LOAD_CONST: stack.push(code.consts[arg]); break;
      case OP.BINARY: { const b = stack.pop(); stack.push(binary(BIN_OPS[arg], stack.pop(), b)); break; }
      case OP.JUMP_IF_FALSE: if (!truthy(stack.pop())) frame.pc = arg; break;
      …
    }
  }
}
```

Drei Eigenschaften machen sie spieltauglich:

- **Budget:** Je Spieltakt darf ein Missionsskript höchstens 60 000 Befehle ausführen, ein Spielerprogramm 20 000.
  Eine Endlosschleife friert deshalb nie das Spiel ein, sie läuft nur langsam weiter.
- **Warten:** Ein Befehl wie `hero.step()` gibt statt eines Wertes ein `Suspend`-Objekt zurück. Die Aufgabe parkt,
  die Simulation lässt den Helden laufen, und wenn er angekommen ist, setzt der Gastgeber das Programm genau dort fort.
  Das geht nur, weil die VM ihren eigenen Aufrufstapel hat und nicht die Rekursion von JavaScript benutzt.
- **Debugger:** Der Compiler markiert jeden Anweisungsanfang (`stmt[pc]`). Dort prüft die VM Haltepunkte und den
  Einzelschrittmodus. So entstehen „Schritt“, „Über“ und „Heraus“, wie man sie aus Entwicklungsumgebungen kennt.

![Ein Lernabenteuer am Abend des 4. Oktober: Bertram soll zum Schatz. Das Programm steht im Einzelschritt in Zeile 3, unten zeigt der Debugger die Variable steps = 2.](blog/characters-coding/debugger.webp)

Ganzzahlen werden ab 2⁵³ automatisch zu `BigInt` – `2 ** 100` geht wie in Python. Kommazahlen rechnen `+ − * /` nach
[IEEE 754](https://de.wikipedia.org/wiki/IEEE_754) und sind darum überall gleich; Funktionen wie `sin` oder `log`
fehlen bewusst, weil Browser sie unterschiedlich genau berechnen. Tests vergleichen die Ausgaben vieler kleiner
Programme mit dem echten Python (CPython).

### Missionen und Welteneditor

Mit derselben Sprache entstehen Skript-Missionen im Stil der Auslöser des Vorbilds:

```python
@on_building_done("farm")
def first_farm():
    say("bertram", "Der erste Hof steht!")
    spawn(BANDITS, "sword1", place("gate"), count=3)
```

Ein [Dekorator](https://de.wikipedia.org/wiki/Decorator) wie `@on_building_done` meldet die Funktion als
Ereignisbehandlung an. Missionsskripte dürfen mehr als Spielerprogramme (Truppen erzeugen, Kamera fahren). Welche
Namen ein Programm überhaupt kennt, hängt von seiner Rechtestufe ab. Der Welteneditor schließlich formt Gelände,
Wasser und Wald auf einer Vorschau-Simulation und speichert das Ergebnis im selben Szenario-Format.

## Was nicht klappte {#problems}

- Das ältere Meshy-Modell zeigte im Gesicht sichtbare Polygone. Meshy 7.1 mit PBR (physikalisch basierten
  Materialien) liefert glatte Gesichter und eine Normal-Map.
- Ein eigenes, vereinfachtes Konzept für das Spielmodell brachte in Spielgröße nichts. Das Spielmodell ist jetzt das
  per Remesh auf rund 2 000 Dreiecke reduzierte Nahmodell (5 Credits) – es springt beim Umschalten auch nicht.
- Flache Eckfarben und nachträgliches Sättigen machten aus Oliv „Malkastengrün“. Am Ende wurden Meshys Farben einfach
  übernommen.
- Ein Randlicht, das Figuren vom Hintergrund abheben sollte, wirkte als helle Kanten und flog wieder raus.
- Wörterbücher mit Tupeln als Schlüssel überstanden in der Skript-VM das Speichern und Laden nicht – ein eigener Fix.

## Zum Nachmachen {#tips}

- Beurteile Figuren in Spielgröße (bei uns rund 25 Pixel), nicht in der Großansicht.
- Billiges zuerst: Konzept und Vorschau prüfen, bevor Meshy-Credits fließen; ein Budget-Buch zählt mit.
- Wenn viele gleiche Dinge animiert werden, lohnt sich Animation auf der Grafikkarte mit einer gebackenen Textur.
- Eine eigene kleine Sprache ist machbar, wenn man sie in klare Stufen teilt: Lexer, Parser, Compiler, VM. Jede Stufe
  lässt sich einzeln testen.
- Eine VM mit eigenem Aufrufstapel kann jederzeit anhalten, speichern und fortsetzen – das ist der Schlüssel für
  Debugger und wartende Befehle.
