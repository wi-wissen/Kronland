---
title: Simulationskern
date: 2026-10-03T11:51:52+02:00
teaser: Bevor irgendetwas zu sehen war, stand die Simulation: eine Spielschleife mit festem Takt, Ganzzahlen, Zufall mit Seed, ein Kachelraster und A*-Wegsuche – ein Spiel, das ganz ohne Bildschirm läuft.
milestone: true
---

## Was entstand {#what}

Der allererste Commit von Kronland enthält kein einziges Bild und keinen Knopf. Er besteht aus 25 Dateien: einer
Kachelkarte mit Kartengenerator, der Wegsuche, Leibeigenen, die bauen und Rohstoffe abbauen, dem Zahltag – und
automatischen Tests. Dazu kommen zwei Textdateien, die festhalten, *was* gebaut werden soll (`docs/SPIELREGELN.md`)
und *wie* (`docs/ARCHITEKTUR.md`).

Das klingt unspektakulär, ist aber die wichtigste Entscheidung des ganzen Projekts: **Die Spielregeln sind ein eigenes
Programm, das nichts von Grafik weiß.** Dieser Artikel erklärt, was das bedeutet und welche Ideen aus der Informatik
dahinterstecken: Spielschleife, Determinismus, Pseudozufall, Hashfunktionen, Raster, Graphen und die Wegsuche mit A\*.

## Ein Spiel ist eine Schleife {#loop}

Jedes Echtzeitspiel ist im Kern eine Schleife: Eingaben lesen, die Welt einen kleinen Schritt weiterrechnen, das
Ergebnis zeigen – und das immer wieder. Diese [Spielschleife](https://de.wikipedia.org/wiki/Game_Loop) kennst du
vielleicht aus Scratch oder Processing, wo `draw()` 60-mal pro Sekunde aufgerufen wird.

Kronland trennt dabei zwei Dinge, die oft vermischt werden: das **Rechnen** und das **Zeichnen**. Gerechnet wird in
festen Schritten, den *Takten* (englisch *ticks*): genau zehn pro Sekunde, jeder steht für 100 ms Spielzeit.
Gezeichnet wird so oft, wie der Bildschirm kann. Ein Takt sieht so aus (gekürzt):

```js src/sim/sim.js
/** Compute one tick (100 ms). */
step(commands = []) {
  this.events = [];
  const cmds = this.pending.concat(commands);
  this.pending = [];
  for (const c of cmds) this.applyCommand(c);    // 1. Befehle anwenden

  for (const e of [...this.entities.values()]) { // 2. jede Figur einen Schritt
    if (e.kind === 'unit') updateSerf(this, e);
  }
  updatePayday(this);                            // 3. Zahltag alle 120 s
  this.tick++;
  return this.events;                            // 4. Ereignisse für die Anzeige
}
```

Warum ein fester Takt? Weil dann jede Regel in Takten formuliert werden kann: Ein Leibeigener schlägt in 40 Takten
Holz, der Zahltag kommt alle 1 200 Takte. Ob dein Rechner 30 oder 144 Bilder pro Sekunde schafft, ändert nichts am
Spielablauf – nur daran, wie flüssig er aussieht. Wie aus zehn Takten pro Sekunde trotzdem eine flüssige Bewegung
wird, steht im [nächsten Artikel](blog/rendering/#loop).

## Gleiche Eingabe, gleiches Spiel {#determinism}

Die strengste Regel des Projekts lautet: Die Simulation ist
[deterministisch](https://de.wikipedia.org/wiki/Determinismus_%28Algorithmus%29). Gleicher Startwert und gleiche
Befehle ergeben auf jedem Rechner, in jedem Browser und bei jedem Durchlauf *bitgenau* denselben Spielverlauf. Drei
Dinge machen das schwierig – und für alle drei gibt es eine Lösung.

### Keine Kommazahlen

[Gleitkommazahlen](https://de.wikipedia.org/wiki/Gleitkommazahl) sind nur Näherungen: `0.1 + 0.2` ergibt in
JavaScript `0.30000000000000004`. Verschiedene Rechenwege oder Bibliotheken können im letzten Bit unterschiedlich
runden, und in einem Spiel, das zehntausende Takte läuft, wächst so ein Bit zu einer anderen Spielwelt heran.
Kronland rechnet deshalb nur mit **ganzen Zahlen**: Positionen stehen in *Milli-Kacheln* (eine Kachel = 1 000
Einheiten), Abstände berechnet eine ganzzahlige Quadratwurzel:

```js src/sim/fixed.js
export const UNIT = 1000;             // 1 Kachel = 1000 Milli-Kacheln

/** Integer square root (rounded down). */
export function isqrt(n) {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;              // Ergebnis absichern …
  while ((r + 1) * (r + 1) <= n) r++; // … in beide Richtungen
  return r;
}
```

Auch Winkelfunktionen wie `Math.sin` sind in der Spiellogik tabu; wo Richtungen nötig sind, stehen sie als Tabelle
im Code.

### Zufall, der sich wiederholt

`Math.random()` liefert bei jedem Aufruf etwas anderes – für ein deterministisches Spiel unbrauchbar. Kronland benutzt
stattdessen einen [Pseudozufallszahlengenerator](https://de.wikipedia.org/wiki/Pseudozufallszahlengenerator): Aus
einem Startwert, dem **Seed**, berechnet er eine Zahlenfolge, die zufällig *aussieht*, aber vollständig festgelegt
ist. Das Verfahren heißt *sfc32* und braucht nur Additionen, Bitverschiebungen und XOR auf 32-Bit-Zahlen:

```js src/sim/rng.js
next() {
  let { a, b, c, d } = this;           // Zustand: vier 32-Bit-Zahlen
  const t = (((a + b) | 0) + d) | 0;   // | 0 schneidet auf 32 Bit ab
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  this.a = a; this.b = b; this.c = c; this.d = d;
  return t >>> 0;                      // 0 … 2^32 − 1
}
```

Wer den Zustand – die vier Zahlen – kennt, kennt alle folgenden „Zufallszahlen“. Genau das braucht man später zum
Speichern: Ein Spielstand merkt sich einfach die vier Zahlen mit.

### Eine Zahl für den ganzen Zustand

Wie prüft man, ob zwei Spielverläufe *wirklich* gleich sind? Man fasst den ganzen Zustand – jeden Vorrat, jede
Position, jeden Zähler – zu einer einzigen Zahl zusammen, einem [Hashwert](https://de.wikipedia.org/wiki/Hashfunktion).
Kronland benutzt dafür *FNV-1a*: Jedes Byte wird per XOR mit dem bisherigen Wert verknüpft, das Ergebnis mit einer
großen Primzahl multipliziert. Ändert sich irgendwo ein einziges Bit, ist der Hash ein völlig anderer. Ein Test lässt
dasselbe Szenario zweimal laufen und vergleicht die Hashes:

```js tests/sim/determinism.test.js
it('same seed and same commands yield exactly the same course', () => {
  const a = scenario(42), b = scenario(42);
  expect(a.hashes).toEqual(b.hashes);
});
```

Wofür der Aufwand? Er macht vier Dinge möglich, die das Projekt später alle braucht: **Tests**, die immer dasselbe
Ergebnis liefern; **Spielstände**, die nach dem Laden exakt so weiterlaufen; **Bots**, die tausende Partien ohne Grafik
spielen; und **Mehrspieler im Gleichschritt** (*Lockstep*). Dabei rechnet jeder Rechner die ganze Simulation selbst,
und über das Netz gehen nur die Befehle – ein paar Bytes statt der Positionen hunderter Figuren. Weicht ein Hash ab,
ist ein Rechner aus dem Tritt geraten, und man weiß sofort, in welchem Takt.

## Befehle als einzige Eingabe {#commands}

Wenn der Spieler ein Haus baut, ruft die Oberfläche nicht etwa `createBuilding()` auf. Sie schickt einen
**Befehl** – ein einfaches Objekt:

```js
{ type: 'placeBuilding', player: 0, building: 'residence', x: 41, y: 37, units: [12, 13] }
```

Die Simulation prüft ihn im nächsten Takt: Gibt es den Spieler? Ist der Platz frei, eben genug, bezahlbar? Wenn nicht,
lehnt sie ihn ab und meldet den Grund als Ereignis. Einen anderen Weg, den Zustand zu ändern, gibt es nicht.

![Der Aufbau: Alles, was das Spiel verändert, kommt als Befehl herein; Darstellung und Oberfläche lesen nur.](blog/simulation-core/architecture-de.svg)

Das hat einen schönen Nebeneffekt: Für die Simulation ist es egal, *wer* einen Befehl schickt – ein Mensch mit der
Maus, ein Computergegner, ein Test oder später ein Mitspieler übers Netz. Alle benutzen dieselbe
[Schnittstelle](https://de.wikipedia.org/wiki/Schnittstelle), und niemand kann schummeln. In der Softwaretechnik
heißt dieses Muster [Kommando](https://de.wikipedia.org/wiki/Kommando_%28Entwurfsmuster%29).

## Ein Spiel ohne Bildschirm {#headless}

Weil die Simulation weder ein Browserfenster noch eine Grafikkarte braucht, läuft sie überall, wo JavaScript läuft –
zum Beispiel mit [Node.js](https://de.wikipedia.org/wiki/Node.js) auf der Kommandozeile. Das folgende kleine Skript
wurde für diesen Artikel gegen den Code des ersten Commits geschrieben. Es startet ein Spiel, schickt einen
Baubefehl, rechnet 600 Takte (eine Minute Spielzeit) und gibt einen Ausschnitt der Karte als Text aus:

```js demo/headless.mjs
import { Sim } from '../src/sim/sim.js';

const sim = new Sim({ seed: 42 });
const hq = sim.findBuilding(0, 'headquarters');
const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === 0).map((e) => e.id);
const pos = sim.findPlacement(0, 'residence', hq.x + 2, hq.y + 2);
sim.command({ type: 'placeBuilding', player: 0, building: 'residence', x: pos.x, y: pos.y, units: serfs });

for (let t = 1; t <= 600; t++) {
  sim.step();
  if (t % 150 === 0) console.log(`Tick ${t}: hash ${sim.hash().toString(16)}`);
}
// … danach die Karte rund um die Burg Zeichen für Zeichen ausgeben
```

Die Ausgabe – bei jedem Aufruf und auf jedem Rechner dieselbe:

```text
Tick 150: hash bf6560f2
Tick 300: hash 3d08d762
Tick 450: hash f9fa5a1e
Tick 600: hash a601ae71
TTTT......HHHHH..DDDD...............
..........HHHHH..DDDD...............
..........HHHHH..DDDD...............
..........HHHHH..DDDD...............
..........HHHHHs....................
...............sWWW.................
................WWW.................
..o.TT.o........WWW.................
```

`H` ist die Burg, `D` das Dorfzentrum, `W` das neue Wohnhaus, `s` sind Leibeigene, `T` Bäume und `o`
Rohstoffhaufen. Das ist die ganze Welt des ersten Meilensteins – ohne ein einziges Polygon.

Genauso arbeiten die Tests. [Vitest](https://vitest.dev/) startet Simulationen, schickt Befehle und prüft
Behauptungen, etwa „vier Leibeigene bauen ein Haus in etwa der Bauzeit“ oder „ein Leibeigener braucht etwa viermal so
lange“. Alle Tests des ersten Commits zusammen laufen in unter vier Sekunden:

```text
$ npx vitest run --reporter=verbose
 ✓ tests/sim/mapgen.test.js > Map generator > is deterministic
 ✓ tests/sim/economy.test.js > Building > 4 serfs finish building a house in about the build time
 ✓ tests/sim/economy.test.js > Building > 1 serf needs about 4 times as long
 ✓ tests/sim/economy.test.js > Mining resources > serfs fell wood and then go to the next tree
 ✓ tests/sim/determinism.test.js > Determinism > same seed and same commands yield exactly the same course
 ✓ tests/sim/basics.test.js > Pathfinding > does not cut corners
 …
 Test Files  4 passed (4)
```

Zum Vergleich: Ein einziger Test, der das Spiel im Browser startet, dauert ohne Grafikkarte eine halbe Minute.

## Die Welt als Raster {#grid}

Wie stellt man eine Spielwelt im Speicher dar? Es gibt zwei große Familien. Viele 3D-Spiele beschreiben begehbare
Flächen mit **Polygonen**, einem sogenannten Navigationsnetz (*navmesh*): Die Welt wird in konvexe Vielecke zerlegt,
und Figuren laufen von Vieleck zu Vieleck. Das ist genau und spart Speicher bei großen, offenen Flächen. Die andere
Familie ist das **Raster** – die Welt als Schachbrett aus gleich großen Kacheln.

Kronland benutzt ein Raster, und zwar aus guten Gründen: Gebäude stehen ohnehin auf Kacheln (ein Wohnhaus belegt
3 × 3), Bäume und Rohstoffhaufen auf einer. Ob ein Platz frei ist, ist eine einfache Abfrage. Vor allem lässt sich ein
Raster exakt mit ganzen Zahlen beschreiben – ein Navigationsnetz bräuchte Geometrie mit Kommazahlen. Die Karte ist
nichts anderes als ein paar lange Arrays, eines pro Eigenschaft:

```js src/sim/map.js
export const WATER = 1;      // nicht begehbar, nicht bebaubar
export const OCCUPIED = 2;   // Gebäude, Baum, Rohstoffhaufen
export const RESERVED = 4;   // Siedlungsplatz oder Schacht

export class TileMap {
  constructor(width, height) {
    this.heights = new Int32Array(width * height); // Höhe in cm
    this.flags = new Uint8Array(width * height);   // Bits: WATER | OCCUPIED | RESERVED
    this.owner = new Int32Array(width * height);   // welches Objekt steht hier?
  }
  idx(x, y) { return y * this.width + x; }         // 2D → 1D
  walkable(x, y) {
    return this.inBounds(x, y) && (this.flags[this.idx(x, y)] & (WATER | OCCUPIED)) === 0;
  }
}
```

Zwei Tricks stecken darin: Ein zweidimensionales Feld wird als eindimensionales Array gespeichert (`y * Breite + x`),
und mehrere Ja/Nein-Eigenschaften teilen sich ein Byte als [Bitmaske](https://de.wikipedia.org/wiki/Bitmaske):
`flags & WATER` fragt genau ein Bit ab.

## Zufällige Karten, die sich wiederholen {#mapgen}

Jede neue Partie bekommt eine neue Karte – und trotzdem ergibt dieselbe Kartennummer immer dieselbe Welt, denn die
Kartennummer *ist* der Seed. Der Generator in `src/sim/mapgen.js` arbeitet in Schritten:

1. **Höhen aus Rauschen.** Für jede Kachel wird eine Höhe aus *Value-Noise* berechnet: Auf einem groben Gitter bekommt
   jeder Gitterpunkt per [Hashfunktion](https://de.wikipedia.org/wiki/Hashfunktion) aus (x, y, Seed) einen
   Zufallswert, dazwischen wird weich überblendet. Drei solcher Schichten mit 32, 16 und 8 Kacheln Gitterweite werden
   gewichtet addiert (4 : 2 : 1) – die grobe formt Hügel, die feine Unebenheiten. Mehr dazu im Artikel
   [Gelände und Grafik](blog/terrain-graphics/#noise).
2. **Wasserspiegel als Quantil.** Statt einer festen Höhe sortiert der Generator alle Höhen und legt den Wasserspiegel
   so, dass genau die tiefsten 12 % unter Wasser liegen. So hat jede Karte ähnlich viel Wasser.
3. **Starts in den Ecken, eingeebnet.** Die Burgen stehen in festen Ecken; im Umkreis von 14 Kacheln wird das Gelände
   flach gezogen, damit man dort bauen kann.
4. **Für alle dasselbe.** Jeder Spieler bekommt denselben Satz: sechs Schächte (Lehm, Stein, zweimal Eisen, zweimal
   Schwefel) im Abstand von 12 bis 20 Kacheln, sechs Rohstoffhaufen näher dran und Siedlungsplätze auf dem Weg zur
   Kartenmitte. Die genaue Lage würfelt der Generator mit dem Seed aus, bis ein freier Platz gefunden ist.
5. **Wälder.** Ein weiteres Rauschen bestimmt, wo Wald dicht steht; ein Hain nahe jeder Burg garantiert Holz für den
   Anfang.

![Links die Höhen von Karte 42 (hell = hoch), in der Mitte dieselbe Karte mit Wasser, Wald, Burgen (rot), Schächten und Siedlungsplätzen (weiße Rahmen), rechts Karte 7 – erzeugt mit dem Generator des ersten Commits.](blog/simulation-core/maps.webp)

Gerecht sind die Karten also nicht, weil sie spiegelbildlich wären, sondern weil der Generator jedem Spieler dieselben
Zusagen macht – und ein Test prüft das für mehrere Seeds.

## Wie Figuren ihren Weg finden {#pathfinding}

Schickst du einen Leibeigenen zu einem Baum hinter einem See, läuft er nicht stur geradeaus ins Wasser, sondern außen
herum. Wie findet er diesen Weg?

### Die Karte als Graph

Für die Wegsuche ist die Karte ein [Graph](https://de.wikipedia.org/wiki/Graph_%28Graphentheorie%29): Jede begehbare
Kachel ist ein Knoten und mit ihren bis zu acht Nachbarn verbunden. Ein gerader Schritt kostet 10, ein schräger 14 –
denn die Diagonale eines Quadrats ist √2 ≈ 1,414-mal so lang, und 14 ist die ganzzahlige Näherung davon. Gesucht ist
der *billigste* Weg vom Start zum Ziel.

### Breitensuche: alles der Reihe nach

Die einfachste Idee ist die [Breitensuche](https://de.wikipedia.org/wiki/Breitensuche): Vom Start aus untersucht man
erst alle Nachbarn, dann deren Nachbarn und so weiter – wie Wellen, die sich auf einem Teich ausbreiten. Für jede
erreichte Kachel merkt man sich, woher man kam. Am Ziel läuft man diese Zeiger rückwärts und hat den Weg.

```pseudo
funktion breitensuche(start, ziel):
  warteschlange = [start]
  herkunft = { start: nichts }
  solange warteschlange nicht leer:
    k = warteschlange.vorne_entnehmen()
    wenn k == ziel: gib weg_rückwärts(herkunft, ziel) zurück
    für jeden nachbarn n von k:
      wenn n begehbar und n nicht in herkunft:
        herkunft[n] = k
        warteschlange.hinten_anfügen(n)
  gib „kein Weg“ zurück
```

Die Breitensuche findet den Weg mit den wenigsten *Schritten*. Sind die Schritte aber unterschiedlich teuer (gerade 10,
schräg 14), braucht man ihre große Schwester, den
[Dijkstra-Algorithmus](https://de.wikipedia.org/wiki/Dijkstra-Algorithmus): Statt einer einfachen Warteschlange nimmt
er als Nächstes immer die Kachel mit den bisher *kleinsten Kosten*. Beide haben dasselbe Problem: Sie suchen in alle
Richtungen gleichzeitig, auch dort, wo das Ziel garantiert nicht liegt.

### A\*: mit einer Schätzung zum Ziel

Der [A\*-Algorithmus](https://de.wikipedia.org/wiki/A%2A-Algorithmus) ergänzt Dijkstra um eine **Schätzung**, wie
weit es von einer Kachel noch bis zum Ziel ist. Für jede Kachel kennt er:

- **g** – die tatsächlichen Kosten vom Start bis hierher,
- **h** – die geschätzten Restkosten bis zum Ziel, die [Heuristik](https://de.wikipedia.org/wiki/Heuristik),
- **f = g + h** – die geschätzten Gesamtkosten eines Weges über diese Kachel.

Untersucht wird immer die Kachel mit dem kleinsten f. Kacheln in Richtung Ziel haben ein kleines h und kommen deshalb
zuerst dran; Umwege werden erst angefasst, wenn der direkte Weg versperrt ist.

![Dieselbe Suche zweimal: links ohne Schätzung (Dijkstra), rechts mit Schätzung (A*). Beide finden einen gleich kurzen Weg, A* untersucht aber nur ein Viertel der Kacheln. Berechnet mit denselben Regeln wie im Spiel.](blog/simulation-core/astar-de.svg)

Kronland schätzt mit der *Oktil-Distanz*: so viele Schrägschritte wie möglich, der Rest gerade. Auf freiem Feld ist
das genau der richtige Wert; mit Hindernissen ist der echte Weg länger – die Schätzung ist also nie zu hoch. Das ist die
entscheidende Bedingung (man nennt sie *zulässig*): Nur dann findet A\* garantiert einen kürzesten Weg.

```js src/sim/pathfinding.js
const STRAIGHT = 10, DIAG = 14;

function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return STRAIGHT * (dx + dy) + (DIAG - 2 * STRAIGHT) * Math.min(dx, dy);
}
```

Der Kern der Suche, gekürzt und leicht vereinfacht:

```js src/sim/pathfinding.js
while (open.size) {
  const cur = open.pop();                      // Kachel mit dem kleinsten f
  if (closed.has(cur.i)) continue;
  if (goalSet.has(cur.i)) return reconstruct(cur.i); // Zeiger rückwärts ablaufen
  closed.add(cur.i);
  if (++expanded > maxNodes) return null;      // Notbremse: 20 000 Kacheln
  for (let d = 0; d < 8; d++) {
    const nx = cx + DX[d], ny = cy + DY[d];
    if (!map.walkable(nx, ny)) continue;
    // schräg nur, wenn beide Nachbarn frei sind: keine Ecken schneiden
    if (d >= 4 && (!map.walkable(cx + DX[d], cy) || !map.walkable(cx, cy + DY[d]))) continue;
    const ni = ny * W + nx, ng = cg + (d < 4 ? STRAIGHT : DIAG);
    if (g.has(ni) && g.get(ni) <= ng) continue; // schon billiger erreicht
    g.set(ni, ng);
    parent.set(ni, cur.i);
    open.push({ i: ni, f: ng + h(nx, ny), h: h(nx, ny) });
  }
}
```

Drei Details sind typisch für ein Spiel:

- **Die offene Liste ist ein Heap.** Die Kandidaten liegen in einem
  [binären Heap](https://de.wikipedia.org/wiki/Bin%C3%A4rer_Heap), der das Minimum in O(log n) herausgibt – eine
  sortierte Liste wäre bei tausenden Kacheln viel zu langsam.
- **Gleichstände werden fest entschieden.** Haben zwei Kacheln dasselbe f, gewinnt das kleinere h, dann die kleinere
  Kachelnummer. Sonst könnten zwei Rechner unterschiedliche, gleich lange Wege wählen – und der Determinismus wäre dahin.
- **Mehrere Ziele.** Wer zu einem Gebäude will, darf an jeder freien Kachel rundherum ankommen; die Schätzung nimmt
  den Abstand zum nächsten dieser Ziele.

## Was nicht klappte {#problems}

In diesem Schritt gab es keinen Fehlschlag – der Wert der strengen Regeln zeigte sich erst später. Als eine QA-Sitzung
am nächsten Morgen [Fuzz-Tests](blog/qa-fog/#fuzz) schrieb, konnten Befehlsfolgen protokolliert und bitgenau wiederholt
werden, und Speichern und Laden mitten im Spiel musste denselben Endzustand ergeben. Das geht nur mit einer
deterministischen Simulation.

Eine Schwäche der Wegsuche fiel ebenfalls erst dort auf: A\* weiß nicht, ob ein Ziel *überhaupt* erreichbar ist. Liegt
es auf einer Insel, durchsucht er die ganze erreichbare Fläche, bis die Notbremse greift – bis zu 20 000 Kacheln. Bei
Computergegnern, die oft unerreichbare Ziele wählten, führte das zu Rucklern von über einer Sekunde. Die Lösung mit
Gebietsnummern steht im Artikel [QA-Runden](blog/qa-fog/#regions).

## Zum Nachmachen {#tips}

- **Fang mit Regeln und Simulation an, nicht mit Grafik.** Eine Simulation ohne Darstellung lässt sich in Millisekunden
  testen, und du merkst früh, ob deine Spielidee trägt.
- **Verbiete `Math.random`, `Date` und Kommazahlen in der Spiellogik von Anfang an** – nachträglich ist das mühsam.
- **Probier es selbst:** Der Code dieses Meilensteins ist oben verlinkt. Nach `npm install` laufen die Tests mit
  `npx vitest run`, und ein Skript wie das obige startest du mit `node`.
- **Schreib Regeln und Architektur als Markdown ins Repository.** Jede neue Sitzung – ob Mensch oder KI – liest sie mit.
