---
title: Gelände und Grafik
date: 2026-10-03T19:45:30+02:00
teaser: Gebirge, Flüsse mit Furten, Klippen, Wasser-Shader und Himmel – wie fraktales Rauschen, Dijkstra und Floodfill eine faire Zufallskarte bauen, wie Shader sie einfärben, und warum es eine eigene Runde für schwache Geräte brauchte.
milestone: true
---

## Was entstand {#what}

Am Nachmittag des 3. Oktober wird aus dem Prototyp eine Landschaft. Der Kartengenerator erzeugt Relief mit Gebirgen,
einen Fluss, der den Tälern folgt, Furten, Klippen, einen Erzberg je Spieler und drei Kartengrößen (96, 128 und 160
Kacheln Kantenlänge). Die Grafik bekommt Grafikstufen, texturiertes Gelände, einen Wasser-Shader, Himmel, Bäume und
Dekoration. Der Generator wächst dabei von 172 auf rund 700 Zeilen.

![Der Start auf Karte 42 in diesem Stand: Die Burg steht auf einem eingeebneten Plateau, ringsum steigen Felshänge an.](blog/terrain-graphics/start.webp)

Dieser Artikel schaut zuerst in den Generator – dort steckt erstaunlich viel klassische Informatik – und dann auf die
Grafikkarte.

## Hügel aus Rauschen {#noise}

Echtes Gelände ist weder völlig zufällig (dann sähe es aus wie Fernsehrauschen) noch regelmäßig. Es hat große Formen
(Täler, Hügelketten) und darauf immer kleinere Details. Genau das bildet **fraktales Rauschen** nach.

Grundbaustein ist *Value-Noise*: Auf einem groben Gitter bekommt jeder Gitterpunkt einen Zufallswert – nicht aus einem
Generator, der hintereinander Zahlen ausgibt, sondern aus einer Hashfunktion von (x, y, Seed). So hängt jeder Punkt
nur von seinen Koordinaten ab, egal in welcher Reihenfolge man rechnet. Zwischen den Gitterpunkten wird mit der Kurve
3t² − 2t³ weich überblendet, damit keine Knicke entstehen – ganzzahlig, versteht sich:

```js src/sim/mapgen.js
export function valueNoise(x, y, cell, s) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);   // Gitterzelle
  const fx = x - gx * cell, fy = y - gy * cell;                 // Lage in der Zelle
  const c2 = cell * cell;
  const wx = Math.trunc((fx * fx * (3 * cell - 2 * fx)) / c2);  // 3t² − 2t³, skaliert
  const wy = Math.trunc((fy * fy * (3 * cell - 2 * fy)) / c2);
  const v00 = hash32(gx, gy, s) & 1023, v10 = hash32(gx + 1, gy, s) & 1023;
  const v01 = hash32(gx, gy + 1, s) & 1023, v11 = hash32(gx + 1, gy + 1, s) & 1023;
  const a = v00 * (cell - wx) + v10 * wx;                       // oben überblenden
  const b = v01 * (cell - wx) + v11 * wx;                       // unten überblenden
  return Math.trunc((a * (cell - wy) + b * wy) / c2);           // dann senkrecht: 0 … 1023
}
```

Mehrere solcher Schichten – **Oktaven** – mit halber Gitterweite und halbem Gewicht übereinandergelegt ergeben ein
Höhenprofil mit großen und kleinen Formen. Man nennt das *fBm* (*fractional Brownian motion*, nach der
[gebrochenen brownschen Bewegung](https://de.wikipedia.org/wiki/Gebrochene_Brownsche_Bewegung)); eine verwandte, bekanntere Technik
ist [Perlin-Noise](https://de.wikipedia.org/wiki/Perlin-Noise).

![Vier Oktaven entlang einer Linie quer über Karte 42 und ihre gewichtete Summe. Die Werte sind mit der Rauschfunktion aus dem Code dieses Meilensteins berechnet.](blog/terrain-graphics/noise-de.svg)

Zwei Kniffe machen das Gelände natürlicher:

- **Verzerren** (*domain warping*): Bevor das Rauschen nachgeschlagen wird, verschiebt ein *zweites* Rauschen die
  Koordinaten um bis zu sechs Kacheln. Aus rundlichen Hügeln werden gewundene Täler.
- **Grat-Rauschen** (*ridged noise*) für Gebirge: `1023 − |2 · n − 1023|` spiegelt die Werte an der Mitte. Wo das
  Rauschen die Mitte kreuzt, entsteht ein scharfer Kamm – genau wie bei echten Bergrücken.

## Berge, Erzberge und ein Fluss {#features}

Auf das Flachland setzt der Generator **Gebirgsmassive**. Kandidaten sind feste Stellen – freie Ecken, Kantenmitten,
die Kartenmitte –, sofern sie weit genug von allen Burgen entfernt sind. Die Reihenfolge wird mit dem Seed gemischt
([Fisher-Yates](https://de.wikipedia.org/wiki/Fisher-Yates-Verfahren)), die ersten werden
zu Bergen. Jeder Spieler bekommt außerdem einen kleinen **Erzberg** in fester Entfernung zu seiner Burg, an dessen
Flanken die Schächte liegen. Von 16 möglichen Richtungen gewinnt die, die *nicht* zur Kartenmitte zeigt – dort laufen
später die Wege zum Gegner.

Der **Fluss** ist das schönste Beispiel dafür, wie ein Graphenalgorithmus zu Landschaft wird. Er soll von Kartenrand
zu Kartenrand fließen und dabei den Tälern folgen. Das ist eine Wegsuche! Der Generator benutzt den
[Dijkstra-Algorithmus](https://de.wikipedia.org/wiki/Dijkstra-Algorithmus) aus dem
[ersten Artikel](blog/simulation-core/#pathfinding) – nur dass die Kosten einer Kachel diesmal von ihrer Höhe abhängen:

```js src/sim/mapgen.js
const cost = (k) => {
  let c = 20 + Math.max(0, H[k] - waterLevel) / 6;          // hoch = teuer, tief = billig
  const ds = minStartDist(x, y);
  if (ds < 22) c += (22 - ds) * 60;                         // Abstand zu den Burgen halten
  for (const m of mineHills) if (dist(x, y, m.x, m.y) < m.r + 4) c += 400;  // nicht durch Erzberge
  return Math.trunc(c + (valueNoise(x * 8, y * 8, 64, seed + 77) >> 1) + …); // Rauschen: Mäander
};
const path = dijkstra(S, start, end, cost);
```

Der billigste Weg schlängelt sich durch die Täler, und das zusätzliche Rauschen in den Kosten lässt ihn mäandern, statt
gerade Linien zu ziehen. Entlang des Weges wird das Gelände abgesenkt – oben schmal, unten breiter. An zwei bis drei
Stellen bleibt eine flache, begehbare **Furt**.

Wo das Gelände sehr steil ist oder sehr hoch liegt, wird es zu **Fels** – unpassierbar und unbebaubar.

![Karte 42 in diesem Stand: links die Höhen, rechts Wasser (blau), Fels (braungrau), Wald, Burgen (rot), Schächte und Siedlungsplätze (weiße Rahmen).](blog/terrain-graphics/map.webp)

## Erzwingen statt hoffen: Erreichbarkeit {#reachable}

Berge, Klippen und ein Fluss haben einen Haken: Sie können eine Burg vom Rest der Welt abschneiden oder einen Schacht
unerreichbar machen. Zufall darf ein Spiel aber nicht unspielbar machen. Deshalb prüft der Generator am Ende, ob alles
zusammenhängt – mit einem [Floodfill](https://de.wikipedia.org/wiki/Floodfill), also einer Breitensuche, die einfach
alles markiert, was vom Start aus zu Fuß erreichbar ist:

```js src/sim/mapgen.js
const label = (from) => {
  const seen = new Uint8Array(N);
  const q = [from]; seen[from] = 1;
  for (let qi = 0; qi < q.length; qi++) {          // das Array ist die Warteschlange
    const k = q[qi], x = k % S, y = (k / S) | 0;
    if (x > 0     && !seen[k - 1] && passable(k - 1)) { seen[k - 1] = 1; q.push(k - 1); }
    if (x < S - 1 && !seen[k + 1] && passable(k + 1)) { seen[k + 1] = 1; q.push(k + 1); }
    if (y > 0     && !seen[k - S] && passable(k - S)) { seen[k - S] = 1; q.push(k - S); }
    if (y < S - 1 && !seen[k + S] && passable(k + S)) { seen[k + S] = 1; q.push(k + S); }
  }
  return seen;
};
```

Ist eine Burg, ein Schacht oder ein Siedlungsplatz nicht markiert, **gräbt** der Generator eine Verbindung: Dijkstra
sucht den günstigsten Weg durch Fels und Wasser (Fels und Wasser sind teuer, freies Land billig), und entlang dieses
Weges wird das Gelände zu einer Rampe mit begrenzter Steigung oder einer Furt geformt. Danach wird erneut geprüft – bis
alles verbunden ist.

Die Tests bestehen auf diesen Zusagen, für viele Kombinationen aus Seed, Kartengröße und Spielerzahl:

```text
✓ has real relief: mountains, valleys and cliffs
✓ cliffs are neither walkable nor buildable, not even in winter
✓ start regions are flat and freely buildable
✓ Seed 5, size 128, 3 players: all castles connected, shafts reachable
```

## Was ein Shader ist {#shaders}

Jetzt zur Grafik. Bisher hatte jede Kachel eine Farbe. Jetzt soll der Boden aussehen wie Gras, Wiese, Erde, Sand, Fels
oder Schnee – mit weichen Übergängen. Dafür braucht man einen eigenen [Shader](https://de.wikipedia.org/wiki/Shader):
ein kleines Programm in der Sprache GLSL, das *auf der Grafikkarte* läuft, und zwar für jeden einzelnen Bildpunkt,
millionenfach parallel.

Das Verfahren heißt *Splatting*. Für jede Ecke des Geländenetzes berechnet JavaScript einmalig Gewichte: Wie viel Fels
(aus der Steigung), wie viel Sand (aus der Nähe zum Ufer), wie viel Schnee (aus der Höhe)? Die Grafikkarte überblendet
diese Gewichte zwischen den Ecken automatisch, und der Shader mischt pro Bildpunkt die passenden Texturen:

```text src/render/terrain.js (GLSL, gekürzt)
// Fels dreiseitig projiziert, damit Klippen nicht verzerrt sind
vec3 bw = pow(abs(normalize(vWNrm)), vec3(4.0));    // wie stark zeigt die Fläche nach x, y, z?
bw /= (bw.x + bw.y + bw.z);
vec3 cRock = texture2D(tRock, vWPos.zy * uRockRep).rgb * bw.x
           + texture2D(tRock, vWPos.xz * uRockRep).rgb * bw.y
           + texture2D(tRock, vWPos.xy * uRockRep).rgb * bw.z;
…
albedo = mix(albedo, cSnow, sMask);                  // Schnee darüber mischen
```

Der Trick mit dem Fels heißt *triplanare Projektion*: Eine Textur auf einen fast senkrechten Hang „von oben“ zu legen,
würde sie in lange Streifen ziehen. Also wird sie aus allen drei Richtungen aufgetragen und je nach Neigung der Fläche
gewichtet.

Auch das **Wasser** ist ein eigener Shader: Wellen bewegen sich über die Zeit, flaches Wasser ist türkis, tiefes blau,
und am Ufer schäumt es. Woher weiß der Shader die Tiefe? Aus einer kleinen Textur, in der für jede halbe Kachel die
Geländehöhe unter dem Wasserspiegel steht – Daten, die die Grafikkarte wie ein Bild nachschlagen kann.

## Grafikstufen für jedes Gerät {#quality}

Ein Spiel im Browser läuft auf dem Gaming-PC genauso wie auf einem fünf Jahre alten Handy. Deshalb gibt es drei
Grafikstufen, und jede ist eine Tabelle von Einstellungen:

| Einstellung | niedrig | mittel | hoch |
|---|---:|---:|---:|
| max. Pixeldichte | 1,25 | 1,5 | 2 |
| Schattenauflösung | 1024 | 2048 | 4096 |
| Texturgröße | 256 | 512 | 1024 |
| Dekoration (Gras, Blumen, Steine) | 25 % | 60 % | 100 % |
| Wellen und Schaum auf dem Wasser | nein | ja | ja |

Die Stufe wird automatisch gewählt: Handy oder kleiner Bildschirm → niedrig; erkennbar schwache Grafikchips → mittel;
sonst hoch. Wer will, überschreibt das mit `?quality=low` in der Adresse. Den Namen des Grafikchips verrät der Browser
über eine WebGL-Erweiterung – steht dort „SwiftShader“ oder „llvmpipe“, rechnet gar keine Grafikkarte, sondern der
Prozessor.

![Dieselbe Karte von weiter oben, auf der niedrigen Stufe: Wälder, Felsringe um die Startplateaus und der Erzberg mit den Schächten rechts der Burg.](blog/terrain-graphics/overview.webp)

## Was nicht klappte {#problems}

Auf schwachen Geräten und unter Software-Grafik startete das Spiel zäh – das erste Bild brauchte viele Sekunden, und
danach ruckelte es. Ein eigener Arbeitsschritt „Leistung auf schwachen Geräten“ nahm sich das vor:

- Eine Software-GPU wird erkannt und bekommt die niedrige Stufe mit halber Auflösung, ohne Schatten und mit wenig Deko.
- Bäume und Deko werden beim ersten Bild in einem Rutsch aufgebaut, statt nach und nach.
- Die Shader werden beim Laden „vorgewärmt“: Die Grafikkarte übersetzt jedes Shader-Programm beim ersten Gebrauch, und
  das kostet spürbar Zeit – besser hinter dem Ladebildschirm als mitten im Spiel.
- Alle Naturmaterialien teilen sich ein Shader-Programm statt vieler.

Und die Felsgipfel waren zu häufig – ein kleiner Nachtrag machte sie seltener.

## Zum Nachmachen {#tips}

- **Erzwinge und teste spielwichtige Eigenschaften der Zufallskarte** (Erreichbarkeit, ebene Startflächen) statt auf
  Glück zu hoffen. Floodfill und Dijkstra sind dafür die richtigen Werkzeuge.
- **Probier Rauschen selbst aus:** Ein paar Zeilen Value-Noise und eine Schleife, die Grauwerte in ein Canvas malt –
  und du siehst sofort, was Oktaven und Verzerren bewirken.
- **Prüfe Grafik früh auf dem schwächsten Ziel.** Eine automatische Grafikstufe ist billiger als Beschwerden.
