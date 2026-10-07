---
title: 3D-Darstellung und Steuerung
date: 2026-10-03T12:08:15+02:00
teaser: Three.js zeigt die Welt, Maus und Touch steuern sie, und Playwright prüft sie vom ersten Tag an auf Desktop und Handy – dazu Szenengraph, Dreiecke, Kamera und warum zehn Takte pro Sekunde trotzdem flüssig aussehen.
milestone: true
---

## Was entstand {#what}

Sechzehn Minuten nach dem Simulationskern kommt die Darstellung: [Three.js](https://en.wikipedia.org/wiki/Three.js)
zeichnet Gelände, Gebäude und Figuren, die Steuerung funktioniert mit Maus und Touch, und eine erste Oberfläche zeigt
Vorräte und ein Baumenü. Dazu kommen die ersten drei Playwright-Tests. Eine Minute später folgt eine einzeilige
Änderung: Der Build bekommt einen relativen Basispfad.

![Die allererste 3D-Fassung (Karte 42): Burg, Dorfzentrum, Bäume, Schächte und vier Leibeigene – alles aus einfachen Grundkörpern im Code gebaut, noch ohne ein einziges geladenes Modell.](blog/rendering/first-3d.webp)

Alles, was du hier siehst, ist im Code aus Quadern, Zylindern und Kegeln zusammengesetzt. Spannend ist, *wie* das
Bild aus der Simulation entsteht, ohne dass die Grafik je die Spielregeln anfasst.

## Rechnen im Takt, zeichnen im Fluss {#loop}

Die Simulation macht zehn Schritte pro Sekunde, der Bildschirm zeigt sechzig oder mehr Bilder. Den Takt gibt
`requestAnimationFrame` vor: Der Browser ruft eine Funktion auf, kurz bevor er das nächste Bild malt. Die Engine
sammelt die vergangene Zeit in einem „Topf“ und rechnet so viele Takte, wie hineinpassen – das Muster heißt *fester
Zeitschritt mit Akkumulator*:

```js src/game/Engine.js
frame(now) {
  const dt = Math.min(0.1, (now - this.last) / 1000);  // Sekunden seit dem letzten Bild
  this.last = now;
  if (!this.paused) this.acc += dt * 1000 * this.speed; // Tempo 1×, 2×, 4×
  let steps = 0;
  while (this.acc >= TICK_MS && steps < 8) {            // TICK_MS = 100
    this.stepOnce();                                     // KI + sim.step()
    this.acc -= TICK_MS; steps++;
  }
  // Rest im Topf = wie weit wir zwischen zwei Takten sind (0 … 1)
  this.renderer.frame(this.acc / TICK_MS, dt, this.prev, { … });
}
```

Würde man Figuren nur an ihren Takt-Positionen zeichnen, würden sie zehnmal pro Sekunde springen. Deshalb merkt sich
die Engine vor jedem Takt die alten Positionen, und die Darstellung **interpoliert** zwischen alt und neu:

```js src/render/Renderer.js
const px = prev ? prev.px + (e.px - prev.px) * alpha : e.px;
const py = prev ? prev.py + (e.py - prev.py) * alpha : e.py;
```

![Takte und Bilder: Zwischen zwei Takten zeigt jedes Bild eine Zwischenposition. Der Anteil α ist der Rest im Topf.](blog/rendering/ticks-de.svg)

Das ist [lineare Interpolation](https://de.wikipedia.org/wiki/Interpolation_%28Mathematik%29) – dieselbe Formel wie
für eine Gerade durch zwei Punkte. Die Simulation bleibt ganzzahlig und deterministisch; nur die Darstellung rechnet
mit Kommazahlen, und das darf sie, weil sie nichts zurückschreibt. Die Grenze von acht Takten pro Bild verhindert
übrigens die „Todesspirale“: Ist der Rechner zu langsam, wird das Spiel lieber langsamer, statt immer mehr Takte
nachholen zu wollen.

## Was eine 3D-Szene ist {#scene}

Three.js organisiert alles, was gezeichnet wird, in einem **Szenengraph** – einem [Baum](https://de.wikipedia.org/wiki/Baum_%28Datenstruktur%29)
aus Knoten. Jeder Knoten hat Position, Drehung und Größe *relativ zu seinem Elternknoten*. Bewegst du eine Gruppe
„Leibeigener“, bewegen sich Beine, Kopf und Werkzeug automatisch mit.

![Der Szenengraph der ersten Fassung: Kamera und Licht, Gelände und Wasser, Bäume als ein Instanzen-Objekt, Gebäude und Figuren als Gruppen aus einfachen Teilen.](blog/rendering/scene-graph-de.svg)

Die Blätter des Baums sind **Meshes**: eine Form (*Geometrie*) plus ein Material (Farbe, Glanz). Und jede Form besteht
am Ende aus [Dreiecken](https://de.wikipedia.org/wiki/Polygonnetz). Grafikkarten können eigentlich nur eines
richtig schnell: Millionen Dreiecke auf den Bildschirm projizieren und einfärben. Ein Zylinder ist ein Ring aus
schmalen Rechtecken – also Dreieckspaaren –, eine Kugel ein Netz aus vielen kleinen Dreiecken. Ein Leibeigener der
ersten Fassung ist so gebaut:

```js src/render/models.js
export function serfModel(owner) {
  const g = new THREE.Group();
  const b = new THREE.Group(); g.add(b);
  for (const s of [-1, 1]) {                         // zwei Beine mit Hüftgelenk
    const hip = new THREE.Group(); hip.position.set(s * 0.05, 0.25, 0);
    hip.add(box(0.07, 0.25, 0.07, 0x4a3a2a, 0, -0.25, 0)); b.add(hip);
  }
  b.add(cyl(0.1, 0.15, 0.32, 0xc39a5e, 0, 0.24, 0));  // Körper
  const head = mesh(new THREE.SphereGeometry(0.09, 8, 6), 0xe6c2a0);
  head.position.y = 0.64; b.add(head);
  b.add(cyl(0.06, 0.11, 0.08, PLAYER_COLORS[owner % 4], 0, 0.7, 0)); // Mütze in Spielerfarbe
  …
}
```

Schaltet man im Material `wireframe` ein, sieht man, woraus die Welt wirklich besteht. Die Szene oben hat rund
300 Meshes mit zusammen etwa 125 000 Dreiecken:

![Dieselbe Szene als Drahtgitter: das Gelände ist ein regelmäßiges Netz aus Dreiecken, Bäume sind gestapelte Kegel.](blog/rendering/wireframe.webp)

## Gelände aus dem Höhenraster {#terrain}

Die Simulation kennt eine Höhe pro *Kachel*. Für ein Dreiecksnetz braucht man aber Höhen an den *Ecken*. Die
Darstellung nimmt für jede Ecke den Mittelwert der bis zu vier angrenzenden Kacheln und legt dann über jede Kachel zwei
Dreiecke:

![Vom Höhenraster zum Dreiecksnetz: Höhe je Kachel, Eckpunkte als Mittelwert, zwei Dreiecke je Kachel.](blog/rendering/terrain-mesh-de.svg)

```js src/render/terrain.js
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const h00 = this.cornerY(x, y),     h10 = this.cornerY(x + 1, y);
  const h01 = this.cornerY(x, y + 1), h11 = this.cornerY(x + 1, y + 1);
  // zwei Dreiecke: (oben links, unten links, oben rechts) und (oben rechts, unten links, unten rechts)
  const quad = [[x, y, h00], [x, y + 1, h01], [x + 1, y, h10],
                [x + 1, y, h10], [x, y + 1, h01], [x + 1, y + 1, h11]];
  …
}
```

Die Farbe jeder Kachel hängt von Wasser, Ufernähe und Steigung ab: steil wird Fels, flach wird Wiese. Mit
`heightAt(x, z)` kann die Darstellung außerdem die Höhe an *jeder* Stelle abfragen (bilinear zwischen den vier Ecken) –
damit stehen Figuren und Gebäude auf dem Boden statt darin oder darüber.

## Kamera, Klicks und Touch {#camera}

Die Kamera eines Aufbauspiels schaut schräg von oben auf einen Punkt am Boden. Statt Position und Blickrichtung direkt
zu speichern, merkt sich `CameraRig` drei Zahlen: Drehung um die senkrechte Achse (`yaw`), Neigung (`pitch`) und
Abstand (`dist`). Daraus berechnet es jedes Bild die Kameraposition – das sind
[Kugelkoordinaten](https://de.wikipedia.org/wiki/Kugelkoordinaten):

```js src/render/CameraRig.js
const cp = Math.cos(this.pitch);
this.camera.position.set(
  this.target.x + Math.sin(this.yaw) * cp * this.dist,
  this.target.y + Math.sin(this.pitch) * this.dist,
  this.target.z + Math.cos(this.yaw) * cp * this.dist,
);
this.camera.lookAt(this.target);
```

Zoomen ändert nur `dist`, Drehen nur `yaw` – viel einfacher, als die Kamera direkt zu bewegen.

Und wie weiß das Spiel, worauf du geklickt hast? Es schießt einen Strahl von der Kamera durch den Mauspunkt in die
Szene (*Raycasting*) und prüft, welches Dreieck er zuerst trifft: das Gelände, ein Gebäude oder eine Figur. Aus dem
Treffer wird – natürlich – ein Befehl an die Simulation.

Die Eingabe benutzt [Pointer Events](https://developer.mozilla.org/de/docs/Web/API/Pointer_events): Maus, Stift und
Finger kommen über dieselben Ereignisse herein. Auf dem Desktop wählt Linksklick aus, Rechtsklick befiehlt, Ziehen mit
der rechten Taste dreht. Auf dem Handy verschiebt ein Finger die Karte, Tippen wählt aus, zwei Finger zoomen und drehen
(der Abstand der Finger ergibt den Zoom, ihr Winkel die Drehung). Ein Hover-Effekt kommt bewusst nirgends vor: Auf
einem Touchscreen gibt es ihn nicht.

## Bäume im Tausenderpack {#instancing}

Eine Karte hat über tausend Bäume. Für jeden Baum ein eigenes Mesh hieße: über tausend *Zeichenaufrufe*
(*draw calls*) pro Bild, und jeder davon kostet den Prozessor Zeit. Schon die erste Fassung benutzt deshalb
`InstancedMesh`: Die Form eines Baums wird einmal an die Grafikkarte geschickt, dazu eine Tabelle mit einer Matrix
(Position, Drehung, Größe) pro Baum. Ein Aufruf zeichnet dann alle. Drei solche Objekte – Stämme, Nadelbäume,
Laubbäume – reichen für den ganzen Wald. Später werden auf dieselbe Weise auch alle Figuren gezeichnet, samt Animation
(siehe [Parallele Zweige](blog/parallel-branches/#graphics)).

## Tests im Browser {#tests}

Die Simulation testet Vitest in Millisekunden. Aber ob man im Browser wirklich ein Haus bauen kann, prüft nur ein
Test, der den Browser fernsteuert. Dafür gibt es [Playwright](https://playwright.dev/): Es startet Chromium, lädt das
Spiel, klickt und tippt wie ein Mensch und prüft, was danach auf dem Bildschirm steht. Jeder Test läuft in zwei
Profilen – Desktop und das Handy Pixel 7 mit Touch:

```js e2e/game.spec.js
test('Place a house via the build menu', async ({ page }, info) => {
  await boot(page);
  await page.getByRole('button', { name: 'Alle' }).click();
  if (info.project.name === 'mobile') await page.getByTestId('build-toggle').click();
  await page.getByTestId('build-residence').click();
  const pos = await screenPosFor(page, 'residence');   // Bauplatz → Bildschirmpunkt
  if (info.project.name === 'mobile') {
    await page.touchscreen.tap(pos.x, pos.y);
    await page.getByRole('button', { name: 'Hier bauen' }).click();
  } else {
    await page.mouse.click(pos.x, pos.y);
  }
  await expect(page.getByTestId('res-wood')).toHaveText('1600'); // Holz wurde bezahlt
});
```

Der Test liest die Bauplatz-Position direkt aus der Simulation und rechnet sie mit `project()` in einen Bildschirmpunkt
um – die Umkehrung des Raycastings.

## Was nicht klappte {#problems}

Absolute Pfade hätten das Spiel an die Wurzel eines Servers gebunden (`/assets/…`). Wer es in einen Unterordner wie
`meinserver.de/spiele/kronland/` legt, hätte nur eine leere Seite gesehen – deshalb der schnelle Nachtrag
`base: './'` in der Vite-Konfiguration.

Später zeigte sich die Kehrseite der Browser-Tests: Ohne Grafikkarte laufen sie über Software-WebGL (SwiftShader), und
jedes Bild berechnet dann der Prozessor. Immer wieder mussten Zeitlimits angehoben werden; die Regel lautet seitdem:
großzügige Timeouts, nur betroffene Specs laufen lassen, eigener Port je Sitzung.

## Zum Nachmachen {#tips}

- **Trenne Simulation und Darstellung streng.** Dann kann die Grafik später komplett getauscht werden, ohne die Regeln
  anzufassen – genau das passierte zwei Tage später.
- **Interpoliere zwischen Takten,** statt den Takt zu erhöhen. Zehn Takte pro Sekunde reichen für ein Aufbauspiel.
- **Richte Playwright mit einem Handy-Profil ein, bevor die Oberfläche groß wird** – Touch nachzurüsten ist teurer.
- **Experimentiere:** In der Browser-Konsole erreichst du die Engine als `window.__kronland`. Probier
  `__kronland.renderer.scene.traverse(o => o.material && (o.material.wireframe = true))`.
