---
title: Startmenü, Speichern, PWA und CC0-Modelle
date: 2026-10-03T12:48:26+02:00
teaser: Mit freien KayKit-Modellen, Startmenü, Spielständen, PWA und CI ist Kronland eine Stunde nach dem ersten Commit zum ersten Mal ganz spielbar – und zeigt, wie man Grafik austauscht, ohne die Regeln anzufassen.
milestone: true
---

## Was entstand {#what}

Der Schritt mit den meisten Dateien des ersten Tages (116): freie 3D-Modelle aus zwei KayKit-Paketen von Kay Lousberg,
ein Startmenü, Speichern und Laden, Offline-Fähigkeit als Progressive Web App und eine CI-Pipeline, die bei jedem Push
alle Tests laufen lässt. Drei Minuten später wird die Dateiendung der Modelle einstellbar. Knapp eine Stunde nach dem
ersten Commit kann man Kronland zum ersten Mal von Anfang bis Ende spielen: Spiel starten, aufbauen, kämpfen,
speichern, später weiterspielen.

![Das erste Startmenü: Zahl und Stärke der Gegner, eigener Held – und das Feld „Karte“. Die Zahl darin ist der Seed: Wer dieselbe Zahl eingibt, bekommt dieselbe Welt.](blog/first-package/start-menu.webp)

## Freie Modelle: glTF und CC0 {#assets}

Eigene 3D-Grafik herzustellen dauert lange – bei Kronland kam sie erst zwei Tage später. Um sofort etwas Ansehnliches
zu haben, nimmt das Projekt fertige Modelle unter der Lizenz [CC0](https://de.wikipedia.org/wiki/Creative_Commons#CC0):
Der Urheber verzichtet auf alle Rechte, man darf die Dateien ohne Bedingungen benutzen. Trotzdem steht er in der
Danksagung – das gehört sich so.

Die Modelle kommen im Format [glTF](https://en.wikipedia.org/wiki/GlTF) (genauer: `.glb`, die binäre Variante). glTF
wird oft „das JPEG für 3D“ genannt: Es enthält Dreiecksnetze, Materialien, Texturen, Knochen und Animationen in einer
Form, die der Browser direkt laden kann. Ein Skript bereitet die Rohdateien auf und komprimiert sie mit
*meshopt*, damit das Spiel schneller lädt:

```bash scripts/build-assets.sh
opt() { npx gltf-transform optimize "$1" "$2" --compress meshopt … ; }
for c in blue red green yellow; do
  for b in castle tavern home_A home_B windmill blacksmith lumbermill mine barracks …; do
    opt "$HEX/buildings/$c/building_${b}_$c.gltf" "$OUT/buildings/${b}_$c.glb"
  done
done
```

Welches Modell zu welchem Gebäudetyp gehört, steht in einer Zuordnungstabelle in der Darstellung:

```js src/render/assets.js
export const BUILDING_ASSETS = {
  headquarters: ['castle'],
  villageCenter: ['tavern'],
  residence: ['home_A', 'home_B'],    // Stufe 1, Stufe 2
  farm: ['windmill'],
  smithy: ['blacksmith'],
  …
};
```

## Grafik austauschen, Regeln behalten {#swap}

Hier zahlt sich die strenge Trennung aus dem [ersten Artikel](blog/simulation-core/#commands) aus. Die Simulation
kennt nur Typen und Stufen: „Wohnhaus, Stufe 1, auf Kachel (41, 37)“. *Wie* ein Wohnhaus aussieht, entscheidet allein
die Darstellung. Fehlt ein Modell (oder lädt es noch), springen die selbst gebauten Platzhalter aus Quadern und Kegeln
ein.

Das kann man sichtbar machen: Dasselbe Testskript, das im Artikel [Wirtschaft](blog/economy/#what) die Siedlung gebaut
hat, wurde hier noch einmal gegen den neuen Stand ausgeführt. Gleicher Seed, gleiche Befehle – also exakt derselbe
Spielzustand, nur anders gezeichnet:

![Derselbe Spielzustand zweimal: links mit den selbst gebauten Formen des vorigen Meilensteins, rechts mit den KayKit-Modellen. Jedes Gebäude steht auf derselben Kachel, jede Zahl in der Kopfleiste ist gleich.](blog/first-package/same-state.webp)

Die Darstellung erfährt übrigens nur über eine Abfrage von der Simulation, was da ist – sie hat keinen eigenen
Spielzustand. Das Muster kennt man aus der Softwaretechnik als [Model-View-Controller](https://de.wikipedia.org/wiki/Model_View_Controller):
Die Simulation ist das Modell, Three.js und Vue sind Ansichten, und die Eingabe übersetzt Klicks in Befehle.

## Speichern heißt: Zustand als Text {#save}

Wie speichert man ein laufendes Spiel? Eigentlich ganz einfach – wenn die Simulation sauber gebaut ist. Man schreibt
ihren *gesamten* Zustand in ein JavaScript-Objekt, macht daraus mit `JSON.stringify` Text und legt ihn im Browser ab
(`localStorage`). Beim Laden geht es rückwärts.

```js src/sim/serialize.js
export function saveGame(sim, extra = {}) {
  return {
    version: SAVE_VERSION,
    seed: sim.seed,
    tick: sim.tick,
    nextId: sim.nextId,
    rng: sim.rng.getState(),      // die vier Zahlen des Zufallsgenerators!
    weather: sim.weather,
    pending: sim.pending,         // Befehle, die auf den nächsten Takt warten
    map: { width: sim.map.width, height: sim.map.height, heights: toB64(sim.map.heights), … },
    …
  };
}
```

Zwei Details sind lehrreich:

- **Der Zufallsgenerator wird mitgespeichert.** Ohne seinen Zustand würde das geladene Spiel andere „Zufallszahlen“
  ziehen als das Original – und anders weiterlaufen.
- **Große Zahlenfelder als Base64.** Die Höhenkarte ist ein `Int32Array` mit über 9 000 Einträgen. Als JSON-Liste wäre
  sie riesig; als [Base64](https://de.wikipedia.org/wiki/Base64)-kodierte Bytes ist sie kompakt.

Ob das Speichern *wirklich* vollständig ist, prüft ein Test, der nur dank Determinismus möglich ist: Zwei KI-Spieler
spielen 4 000 Takte, das Spiel wird gespeichert und geladen, dann laufen Original und Kopie je 3 000 weitere Takte.
Am Ende müssen die Hashes gleich sein.

```js tests/sim/save.test.js
const json = JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) }));
const sim2 = loadGame(JSON.parse(json));
expect(sim2.hash()).toBe(sim.hash());                       // sofort gleich …
for (let i = 0; i < 3000; i++) { tick(sim, ais); tick(sim2, ais2); }
expect(sim2.hash()).toBe(sim.hash());                       // … und auch 5 Minuten später
```

Vergisst jemand später, ein neues Feld zu speichern, schlägt dieser Test fehl. Deshalb steht in den Projektregeln:
Neuer Simulationszustand gehört in `serialize.js` und in den Hash.

## Offline wie eine App {#pwa}

Eine [Progressive Web App](https://de.wikipedia.org/wiki/Progressive_Web_App) ist eine Website, die sich wie eine
installierte App verhält: Man kann sie zum Startbildschirm hinzufügen, sie startet im Vollbild – und sie läuft ohne
Internet. Möglich macht das ein **Service Worker**: ein Skript, das zwischen Seite und Netz sitzt und Anfragen aus einem
eigenen Zwischenspeicher beantworten kann.

Kronland lässt den Service Worker vom Plugin `vite-plugin-pwa` erzeugen. Code, Seiten und Symbole werden beim ersten
Besuch vorab gespeichert; die großen Modelle erst, wenn sie gebraucht werden:

```js vite.config.js
workbox: {
  globPatterns: ['**/*.{js,css,html,png}'],   // vorab: Code, Seiten, Symbole
  globIgnores: ['models/**'],                 // Modelle nicht vorab (zu groß)
  runtimeCaching: [
    { urlPattern: /\/models\/.*\.glb$/, handler: 'CacheFirst', … },  // erst beim Laden merken
  ],
},
```

*CacheFirst* heißt: Liegt die Datei schon im Zwischenspeicher, wird das Netz gar nicht erst gefragt. Wie man dabei
verhindert, dass Spieler ewig alte Dateien behalten, beschäftigt das Projekt später noch einmal gründlich (Stichwort
Inhalts-Hash im Dateinamen).

## Tests bei jedem Push {#ci}

[Kontinuierliche Integration](https://de.wikipedia.org/wiki/Kontinuierliche_Integration) (CI) bedeutet: Bei jeder
Änderung, die im Repository landet, baut ein Server das Projekt neu und lässt alle Tests laufen. Bei GitHub heißt das
GitHub Actions und ist eine kleine YAML-Datei:

```text .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test                                  # Vitest
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e                          # Playwright
      - uses: actions/upload-artifact@v4               # bei Fehlern: Bilder und Protokolle
        if: failure()
```

Für ein Projekt, in dem KI-Agenten den Code schreiben, ist das besonders wertvoll: Eine Sitzung mag vergessen haben,
alle Tests laufen zu lassen – die CI vergisst es nie.

## Was nicht klappte {#problems}

Manche Webhoster liefern `.glb`-Dateien nicht aus (unbekannter Dateityp, Fehler 403 oder falscher MIME-Typ). Lösung:
Vor dem Laden des Spiels kann `window.KRONLAND_MODEL_EXT` eine andere Endung festlegen (z. B. `.json` für eine
eingebettete Fassung).

Die KayKit-Modelle selbst blieben nur zwei Tage: Am 5. Oktober ersetzte eigene Grafik sie fast vollständig, erzeugt
mit Bild-KI und Meshy. Geblieben sind Baugerüst, Bauphasen, Trümmer und Felsen. Dass dieser Austausch ohne eine einzige
Änderung an den Spielregeln möglich war, ist der beste Beweis für die Trennung von Simulation und Darstellung.

## Zum Nachmachen {#tips}

- **Mit CC0-Paketen früh spielbar werden, eigene Grafik später.** Die Lizenz erspart jede Rechtsfrage; trag die
  Urheber trotzdem in die Danksagung ein.
- **Teste Speichern mit „speichern, laden, weiterspielen, vergleichen“** – nicht nur „lässt sich laden“.
- **CI am ersten Tag einrichten.** Agenten verlassen sich auf grüne Tests, und die CI sieht, was eine Sitzung vergessen hat.
