---
title: Feinschliff: Gewimmel, Nahkampf, Reittier
date: 2026-10-06T19:12:10+02:00
teaser: Eine Belastungsprobe mit rund 2 500 Figuren deckt Hänger auf. Wie man einen Engpass findet, warum ein Suchraster 42 % Rechenzeit spart, wie eine Spielschleife der Todesspirale entkommt – und wie ein Pferd mit selbst gerechneten Gangarten und inverser Kinematik galoppiert.
milestone: true
---

## Worum es geht {#what}

Am Nachmittag des 6. Oktober laufen sieben Aufgaben parallel und sind innerhalb von 22 Minuten auf `main`:

- gemalte Symbole fürs Menü,
- **Doppelklick** wählt alle sichtbaren eigenen Figuren derselben Art,
- **Nahkampf im Kreis:** Angreifer umzingeln ihr Ziel, statt auf einem Punkt zu stehen,
- Gebäude ohne **Farbstreifen** in der weitesten Zoomstufe,
- **Hänger im „Gewimmel“** behoben,
- eine neue **Nelia**,
- das Meshy-**Pferd** als Reittier mit selbst geschriebenen Gangarten.

Drei davon sind kleine Lehrstücke der Informatik: die Suche nach dem Engpass, die Geometrie des Umzingelns und die
Bewegung eines Vierbeiners.

## Gewimmel: die Belastungsprobe {#stress}

Wie verhält sich das Spiel, wenn sehr viel los ist? Um das herauszufinden, gibt es seit dem letzten Meilenstein eine
Sonderkarte, die man ganz normal starten kann: `?mission=bustle`, „Gewimmel“. Auf ihr stehen rund 2 500 Objekte, vier
Computergegner bauen Städte, und zwei Schlachten laufen ohne Ende.

![Das Gewimmel am Stand dieses Meilensteins: volle Städte, oben rechts zieht ein Heer vorbei. Die Kopfleiste zeigt 377 Siedler bei Platz für 75 – die Karte setzt sie absichtlich über jede Grenze.](blog/polish/bustle.webp)

Auf dieser Karte hing das Spiel immer wieder für Sekunden. Aber woran lag es?

### Messen ohne Grafik

Weil Simulation und Darstellung getrennt sind (siehe [Artikel 1](blog/simulation-core/)), kann man die Simulation
allein laufen lassen, in Node, ohne Browser. Das Skript `scripts/stress-run.js` spielt das Gewimmel so schnell es
geht und misst je Spielminute die Rechenzeit pro Takt, die Zahl der Figuren und die Kosten eines Spielstands. Ein
[Profiler](https://de.wikipedia.org/wiki/Profiler_%28Programmierung%29) zeigt dazu, in welcher Funktion die Zeit steckt.

Das Ergebnis war deutlich: **42 % der gesamten Rechenzeit** verbrachte das Spiel in einer einzigen Funktion,
`nearestEnemy` – der Suche nach dem nächsten Feind. Jeder Soldat ruft sie in jedem Takt auf.

### Warum ein Raster hilft

Die naive Feindsuche vergleicht jede Figur mit jeder anderen. Bei *n* Figuren sind das *n · n* Vergleiche: Bei 2 500
Figuren über sechs Millionen pro Takt. Informatiker schreiben dafür [O(n²)](https://de.wikipedia.org/wiki/Landau-Symbole)
– wächst die Zahl der Figuren auf das Doppelte, wird die Arbeit viermal so groß.

Die Simulation hatte schon ein **Suchraster**: Die Karte ist in Zellen von 8 × 8 Kacheln geteilt, und jede Zelle kennt
die Figuren, die gerade in ihr stehen. Wer Feinde im Umkreis *r* sucht, muss nur die Zellen ansehen, die das Quadrat
um diesen Kreis berühren. Diese Datenstruktur heißt
[räumliches Hashing](https://en.wikipedia.org/wiki/Spatial_hashing) oder einfach *Gitter*.

![Feindsuche mit Raster: Statt alle Figuren der Karte zu prüfen, zählen nur die Zellen im Quadrat um den Suchkreis.](blog/polish/spatial-grid-de.svg)

Das Raster war also nicht das Problem. Das Problem war, was *innerhalb* der Zellen passierte: Für jede Figur in jeder
Zelle wurde zuerst geprüft, ob sie ein Feind ist (eine Abfrage über die Diplomatie), dann der genaue Abstand
gerechnet, dann ob sie angreifbar ist. Die Lösung: **billige Prüfungen zuerst**.

```js src/sim/systems/military.js
export function nearestEnemy(sim, e, radius, opts) {
  const foe = [];                                   // Feindschaft je Besitzer – nur einmal je Aufruf
  const far = (radius + 1) * (radius + 1);
  for (/* jede Zelle im Quadrat um den Suchkreis */) {
    for (const t of sim.grid.get(cy * 4096 + cx)) {
      if (!(t.owner in foe)) foe[t.owner] = isEnemy(sim, e.owner, t.owner);
      if (!foe[t.owner]) continue;                               // billig: kein Feind
      const dx = q.x - p.x, dy = q.y - p.y;
      if (dx * dx + dy * dy >= far) continue;         // billig: sicher zu weit (ohne Wurzel)
      const d = distTo(e, t);                         // teurer: genauer Abstand
      if (d > radius || d >= best) continue;
      if (!targetable(sim, t)) continue;              // am teuersten, nur für mögliche Bestwerte
      best = d; bestUnit = t;
    }
  }
  return bestUnit;
}
```

Wieder der Trick mit dem Quadrat: Statt `√(dx² + dy²) < r` zu prüfen, vergleicht man `dx² + dy² < r²`. Das ist
mathematisch gleichwertig, spart aber die Wurzel. Dazu wird gemerkt, ob ein Besitzer feindlich ist, statt es für
jede seiner Figuren neu zu fragen.

Zusammen mit einer schnelleren Gebietsrechnung (welche Kacheln zusammenhängend erreichbar sind, siehe
[Artikel 8](blog/qa-fog/)) – die jetzt nur noch die berührten Gebiete neu flutet statt der ganzen Karte – ergibt das:

| | vorher | nachher |
|---|--:|--:|
| Rechenzeit je Takt, Durchschnitt nach 10 Spielminuten | 19,9 ms | ~7 ms |
| 10 Spielminuten Gewimmel, Gesamtlauf | 80 s | 29 s |
| Anteil `nearestEnemy` an der Rechenzeit | 42 % | 16 % |
| Gebietsrechnungen in einem 20-Minuten-Lauf (843 Stück) | 468 ms | 129 ms |

### Beweisen statt hoffen

Wie weiß man, dass die schnellere Fassung *genau dasselbe* tut wie die langsame? Hier zahlt sich der Zustands-Hash
aus [Artikel 1](blog/simulation-core/) aus: Nach jeder Spielminute wird der Hash des ganzen Spielzustands notiert –
vor und nach der Optimierung. Sind alle Hashes gleich, hat sich das Verhalten nicht um ein einziges Bit geändert. Das
Spiel rechnet nur weniger.

## Die Spielschleife und die Todesspirale {#loop}

Die Simulation rechnet in festen Takten von 100 ms. Der Browser zeichnet aber 60 Bilder pro Sekunde, also alle
16,7 ms. Die Spielschleife verbindet beides mit einem *Akkumulator*: Sie zählt, wie viel Zeit vergangen ist, und
rechnet so viele Takte, wie fällig sind. Das ist das bekannte Muster
[Fixed Timestep](https://gafferongames.com/post/fix_your_timestep/).

Was passiert aber, wenn ein Takt länger dauert als 100 ms? Dann sind beim nächsten Bild zwei Takte fällig. Die dauern
zusammen noch länger, also sind danach drei fällig … Das Spiel verbringt immer mehr Zeit mit Nachholen und kommt nie
wieder hinterher. Man nennt das die **Todesspirale**.

![Ein Bild der Spielschleife: Nach 45 ms ist Schluss, übrig gebliebene Takte werden verworfen.](blog/polish/game-loop-de.svg)

Die neue Schleife hat ein **Zeitbudget**:

```js src/game/loop.js
export const TICK_MS = 100, MAX_STEPS = 8, STEP_BUDGET_MS = 45;

export function runSteps(acc, step, { now = () => performance.now(), budget = STEP_BUDGET_MS, maxSteps = MAX_STEPS } = {}) {
  const t0 = now();
  let steps = 0;
  while (acc >= TICK_MS && steps < maxSteps) {
    step();
    acc -= TICK_MS;
    steps++;
    if (now() - t0 >= budget) break;          // Budget aufgebraucht – mindestens ein Takt lief
  }
  let dropped = 0;
  if (acc >= TICK_MS) { dropped = Math.floor(acc / TICK_MS); acc -= dropped * TICK_MS; }
  return { acc, steps, dropped };
}
```

Höchstens acht Takte und höchstens 45 ms pro Bild; was danach noch fällig wäre, wird verworfen. Ist die Simulation
langsamer als die Uhr, läuft das Spiel also langsamer – aber es bleibt bedienbar. Weil die Funktion `now` als
Parameter bekommt, lässt sie sich mit einer erfundenen Uhr in Vitest testen, ohne wirklich zu warten.

Außerdem fordert die Schleife das nächste Bild jetzt an, **bevor** sie rechnet und zeichnet. Wirft dabei irgendetwas
einen Fehler, geht es im nächsten Bild trotzdem weiter. Ein Wächter (`FaultGuard`) zählt Fehler je Bereich; erst wenn
die Simulation dreimal hintereinander scheitert, hält das Spiel an und bietet an, den letzten Spielstand zu laden.

## Zwei unsichtbare Bremsen {#hitches}

Der Profiler im Browser fand zwei weitere Hänger, die mit Rechenzeit nichts zu tun hatten.

**Das Vorschaubild des Autosaves.** Beim automatischen Speichern macht das Spiel ein kleines Bild der aktuellen Szene
für die Liste der Spielstände. Dafür rief es `toDataURL` auf der WebGL-Zeichenfläche auf. Klingt harmlos – aber die
Grafikkarte arbeitet asynchron, mehrere Bilder hinter dem Programm. Um die Pixel herauszugeben, muss der Browser
warten, bis die Grafikkarte *alle* anstehenden Bilder fertig hat. Unter Software-Grafik dauerte ein einzelnes Bild so
35 Sekunden, 64 % davon in genau diesem Aufruf. Jetzt wird das Vorschaubild auf eine normale 2D-Zeichenfläche im
Hauptspeicher kopiert und dort umgewandelt. Den Spielstand selbst verwandelt das Spiel ohne tiefe Kopie direkt in Text
(rund 0,7 MB, etwa 20 ms); das Komprimieren und Ablegen läuft danach asynchron.

**Shader mitten im Spiel.** Ein [Shader](https://de.wikipedia.org/wiki/Shader) ist ein Programm für die Grafikkarte, und
er muss vor der ersten Benutzung übersetzt werden. Taucht ein Modell zum ersten Mal auf – ein Lagerfeuer, eine Ruine –,
hält das Spiel an, bis sein Shader fertig ist. Auf echten Grafikkarten Bruchteile einer Sekunde, unter Software-Grafik
bis zu 70 Sekunden. Jetzt werden solche Modelle beim Aufwärmen am Spielstart einmal unsichtbar mitgezeichnet.

## Nahkampf im Kreis {#surround}

Bisher liefen alle Angreifer auf denselben Punkt: das Ziel. Zehn Schwertkämpfer standen dann ineinander. Jetzt gibt es
um jedes Ziel zwei Ringe mit festen Plätzen: innen 8, außen 12, beide in Reichweite der Klingen.

![Plätze um ein Ziel. Ein Angreifer nimmt den Platz in seiner Anflugrichtung; ist der belegt, den nächsten daneben.](blog/polish/surround-de.svg)

Wie findet ein Angreifer seinen Platz? Er nimmt den Platz, dessen Richtung am besten zu seiner Anflugrichtung passt.
„Am besten passen“ heißt: das größte [Skalarprodukt](https://de.wikipedia.org/wiki/Skalarprodukt) zwischen der
Richtung zum Platz und dem Vektor vom Ziel zum Angreifer. Ist der Platz belegt, probiert er abwechselnd die Nachbarn
links und rechts, dann den äußeren Ring. So läuft niemand quer um das Ziel herum.

Die Simulation darf aber kein `Math.sin` benutzen – das ist nicht auf jedem Rechner bitgleich. Deshalb stehen die
Richtungen als Ganzzahlen in einer Tabelle:

```js src/sim/systems/military.js
/** 24 Richtungen im 15°-Raster als Ganzzahl-Vektoren (Länge 1000) – keine Kommazahl-Winkel in der Sim. */
const SIN15 = [0, 259, 500, 707, 866, 966, 1000];     // sin(0°), sin(15°), … sin(90°) · 1000
const DIR24 = Array.from({ length: 24 }, (_, k) => {
  const s = (i) => { const j = ((i % 24) + 24) % 24; return j <= 6 ? SIN15[j] : j <= 12 ? SIN15[12 - j] : -s(j - 12); };
  return { x: s(k + 6), y: s(k) };                     // cos(k·15°) = sin(k·15° + 90°)
});
```

Sieben Zahlen genügen für alle 24 Richtungen, weil der Sinus symmetrisch ist: Von 90° bis 180° läuft er rückwärts
dieselben Werte, von 180° bis 360° dieselben mit Minus. Und der Kosinus ist nur ein um 90° verschobener Sinus.

## Farbstreifen in der Ferne {#streaks}

In der weitesten Zoomstufe hatten Gebäude bunte Streifen. Die Ursache ist eine Verwandte der Nähte aus
[Artikel 13](blog/own-art/): Die fernste Detailstufe wird mit der Bibliothek meshoptimizer stark vereinfacht. Dabei
zog sie Kanten über die Grenzen der Textur-Inseln, und ein Dreieck, das vorher auf einer Insel lag, griff nun in die
Farben einer ganz anderen Stelle. Verbietet man ihr das, bleibt das Netz fast so groß wie das Original (Burg: 12 082 →
7 009 Dreiecke) – zu viel für die Ferne.

Die Lösung: Die fernste Stufe benutzt gar keine Textur mehr, sondern **Eckfarben**. Jede Ecke bekommt beim Erzeugen die
Farbe, die die Textur an dieser Stelle hatte (etwas zur Dreiecksmitte hin abgetastet, nie auf dem Inselrand), erst
danach wird vereinfacht. Die Grafikkarte mischt die Farben über das Dreieck. In dieser Größe sieht man keinen
Unterschied – nur die Streifen sind weg. Die Burg hat in der Ferne jetzt 2 533 Dreiecke ohne Streifen statt 2 171 mit.

## Nelia, neu gestaltet {#nelia}

Die Heldin der Kampagne war bisher ein Platzhalter. Ihre neue Figur entstand diesmal nicht neu, sondern durch
**Bearbeiten** des Konzeptbogens der Leibeigenen: gleiche Statur, nur Haare, Umhang und Hose geändert. Der Umhang
trägt die Teamfarbe Magenta, damit Nelia sich von oben deutlich von den Leibeigenen abhebt.

![Die vier Ansichten der neuen Nelia, aus denen Meshy das 3D-Modell baut.](blog/polish/nelia-views.webp)

![Das Ergebnis aus Meshy, vorn und hinten, dazu Nah- und Spielmodell als Drahtgitter.](blog/polish/nelia-de.webp)

## Ein Pferd lernt laufen {#horse}

Das Pferd war das letzte Modell, das vor dem leeren Guthaben noch fertig wurde (siehe [Artikel 13](blog/own-art/)).
Meshys automatisches Skelett ist aber für Menschen gemacht; für den Vierbeiner setzte der Projektinhaber die Knochen
von Hand in der Meshy-Oberfläche – 65 Stück, von den Hufen bis zu den Ohren und sechs Gliedern im Schweif.

![Das Skelett des Pferdes mit seinen 65 Knochen, hier in einer Schrittpose.](blog/polish/horse-bones-de.webp)

Die Bewegungen wurden nicht generiert, sondern **berechnet** – mit einem eigenen Skript (`scripts/asset-gen/gait.mjs`), das die Bewegung aus wenigen Zahlen erzeugt.

### Gangarten als Zahlen

Wie läuft ein Pferd? Jedes Bein wechselt zwischen **Standphase** (Huf am Boden, gleitet relativ zum Körper nach hinten)
und **Schwungphase** (Huf in der Luft, schwingt nach vorn). Eine Gangart legt fest, wie lange die Standphase dauert
(der *Duty-Faktor*) und wann jedes Bein aufsetzt:

```js scripts/asset-gen/gait.mjs
export const GAITS = {
  // Schritt: Viertakt (links hinten, links vorn, rechts hinten, rechts vorn), immer 2–3 Hufe am Boden
  walk:   { period: 0.75, stride: 0.75, duty: 0.62, touch: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }, lift: 0.1, flex: 0.75 },
  // Galopp (Rechtsgalopp, Dreitakt): links hinten – rechts hinten + links vorn – rechts vorn, dann Schwebephase
  gallop: { period: 0.5, stride: 1.7, duty: 0.36, touch: { LH: 0, RH: 0.16, LF: 0.2, RF: 0.38 }, lift: 0.18, flex: 1.25 },
};
```

![Gangdiagramm aus genau diesen Zahlen: Im Schritt stehen immer zwei bis drei Hufe am Boden, im Galopp gibt es eine Phase ganz ohne Bodenkontakt.](blog/polish/gaits-de.svg)

Aus der Phase ergibt sich für jeden Huf eine Bahn: In der Standphase gleitet er gleichmäßig mit Bodentempo nach
hinten – so rutscht nichts –, in der Schwungphase hebt er sich auf einem Sinusbogen und kommt nach vorn.

### Inverse Kinematik: vom Huf zurück zu den Gelenken

Jetzt kennt man, wo jeder Huf sein soll. Gesucht sind aber die *Winkel* der Gelenke – Schulter, Ellbogen, Karpalgelenk,
Fessel –, damit der Huf genau dort landet. Das ist die umgekehrte Frage zur normalen Kinematik (Winkel bekannt → wo
ist der Huf?) und heißt deshalb [inverse Kinematik](https://de.wikipedia.org/wiki/Inverse_Kinematik).

Für ein Bein mit vier Gelenken gibt es unendlich viele Lösungen. Das Skript wählt die, die einer *bevorzugten Haltung*
am nächsten kommt (ein Pferdeknie knickt nun einmal nach hinten), und löst das Schritt für Schritt:

```pseudo
wiederhole bis zu 80-mal:
    berechne aus den aktuellen Winkeln, wo der Huf ist      (Vorwärtskinematik)
    r = Ziel − Huf                                          (wie weit daneben?)
    J = wie stark bewegt jedes Gelenk den Huf?              (Jacobi-Matrix)
    löse (W·JᵀJ + Λ) · Δ = W·Jᵀr − Λ·(Winkel − bevorzugt)   (Gauß-Verfahren)
    Winkel += Δ (jeweils höchstens 0,3 rad)
    stopp, wenn sich nichts mehr ändert
```

Das Verfahren heißt *Damped Least Squares*. Die [Jacobi-Matrix](https://de.wikipedia.org/wiki/Jacobi-Matrix) sagt,
in welche Richtung sich der Huf bewegt, wenn man ein Gelenk ein wenig dreht – in der Ebene ist das einfach der
Vektor vom Gelenk zum Huf, um 90° gedreht. Das kleine Gleichungssystem löst das Skript mit dem
[gaußschen Eliminationsverfahren](https://de.wikipedia.org/wiki/Gau%C3%9Fsches_Eliminationsverfahren), wie man es
aus dem Mathematikunterricht kennt.

Dazu kommen Körperbewegungen als Sinuskurven: Im Galopp hebt und senkt sich der Rumpf und schaukelt vor und zurück,
der Kopf nickt im Takt der Vorderhufe, der Schweif schwingt mit Verzögerung von Glied zu Glied. Alle Kurven haben
ganzzahlige Frequenzen über einen Zyklus, deshalb springt die Schleife am Ende nicht.

![Der fertige Galopp in sechs Momenten eines Zyklus (0,5 Sekunden).](blog/polish/gallop.webp)

## Was nicht klappte {#problems}

- **Hänger:** Die Feindsuche kostete 42 % der Rechenzeit, das Vorschaubild des Autosaves hielt das Spiel an, und
  Shader-Übersetzungen mitten im Spiel froren unter Software-Grafik bis zu 70 Sekunden ein – alle drei oben beschrieben.
- **Nelia neu erzeugt** wurde klobig, obwohl die Vorlage zierlich war. Erst das Bearbeiten des Bogens der Leibeigenen
  traf die Statur.
- **Farben:** Gemini malte den Umhang himbeerrot statt magenta, und Meshy schob ihn Richtung Violett. Ein
  Nachfärbeschritt dreht beides auf die Teamfarbe zurück.

## Zum Nachmachen {#tips}

- Bau dir eine Belastungsprobe als normale Karte – dann ist sie jederzeit spielbar und messbar.
- Miss mit einem Profiler, bevor du optimierst. Der Engpass ist selten dort, wo man ihn vermutet.
- Optimiere mit Hash-Vergleich: Gleiches Verhalten ist beweisbar, nicht nur gefühlt.
- Gib der Spielschleife ein Zeitbudget und verwirf Rückstand, statt ihn nachzuholen.
- Billige Prüfungen zuerst, teure zuletzt – und vergleiche Abstände im Quadrat.
- Wenn ein Generator die Figur verfehlt, bearbeite eine gelungene Vorlage, statt neu zu würfeln.
