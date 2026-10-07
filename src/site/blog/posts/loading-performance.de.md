---
title: Laden, Caching und Figuren-Feinschliff
date: 2026-10-06T09:11:03+02:00
teaser: Erst messen, dann optimieren. Ein Inhalts-Hash im Dateinamen, ein Service-Worker, der nie zweimal fragt, und Nahmodelle erst beim Heranzoomen – ein freies Spiel lädt 19 statt 35 MB. Dazu: Wie man misst, ob Füße über den Boden rutschen.
milestone: true
---

## Worum es geht {#what}

Mit den eigenen Modellen aus [Artikel 13](blog/own-art/) ist Kronland schön geworden – und schwer. Ein Browserspiel
hat dabei ein Problem, das ein installiertes Spiel nicht kennt: Jede Datei muss erst über das Netz kommen, und ein
Handy im Mobilfunknetz merkt jedes Megabyte. Dieser Meilenstein beschäftigt sich deshalb vor allem mit der Frage:
**Was lädt das Spiel eigentlich, und muss es das?**

Was entsteht:

- **Laden und Caching:** Jede Spieldatei bekommt im Build einen Inhalts-Hash im Namen und darf danach für immer im
  Cache liegen. Ein Ladebericht misst, was jedes Szenario wirklich lädt.
- **Nahmodelle bei Bedarf:** Die detaillierten Figuren kommen erst, wenn man heranzoomt.
- **Rohdateien raus aus Git:** Ein Werkzeug packt die Zwischenstände der Asset-Pipeline in ein eigenes Archiv.
- **Bedrohung erkennen:** Sturmglocke, vertonte Hilferufe und ein roter Puls auf der Minikarte; Leibeigene fliehen bei
  einem Angriff oder wehren sich.
- **Figuren:** alle gleich groß, Beine laufen im Tempo der Bewegung, feste Plätze an Baustelle, Baum und Lagerfeuer.

## Erst messen {#measure}

Optimieren ohne Messen ist Raten. Deshalb steht am Anfang ein Werkzeug: `scripts/load-report.mjs` baut das Spiel,
startet einen lokalen Server und öffnet mit Playwright jedes Szenario dreimal im selben Browserprofil:

1. **erster Besuch** – der Cache ist leer,
2. **zweiter Besuch** – der Service-Worker ist installiert,
3. **dritter Besuch** – alles sollte aus dem Cache kommen.

Dabei zählt es jede Antwort des Servers, sortiert nach Art (Figuren, Gebäude, Bäume, Texturen, Code …). Das Ergebnis
vor dem Umbau war eindeutig: Die Hälfte der Startdaten waren **Nahmodelle der Figuren**, rund 2,4 MB pro Figur – obwohl
man sie erst sieht, wenn man nah heranzoomt.

```bash
npm run build
node scripts/load-report.mjs              # alle Szenarien
node scripts/load-report.mjs game --list  # jede geladene Datei einzeln
```

## Nur laden, was gebraucht wird {#lazy}

Warum wurden die Nahmodelle überhaupt sofort geladen? Weil nur sie Skelett und Animationen enthielten. Das Spielmodell
(die vereinfachte Fassung für die Ferne, siehe [Artikel 10](blog/characters-coding/)) lieh sich beides vom Nahmodell.
Also musste das Nahmodell immer zuerst kommen.

Der Umbau dreht das um: Die Animationen wandern ins **Spielmodell**. Das Nahmodell enthält nur noch Netz und Textur
und wird von `requestNearModel` erst angefordert, wenn eine Figur dieses Modells zum ersten Mal groß genug auf dem
Bildschirm erscheint (über ~80 Pixel). Bis es da ist, zeichnet das Spiel einfach weiter das Spielmodell – niemand
merkt die Verzögerung.

Dasselbe Prinzip gilt überall: Beim Start lädt das Spiel nur die Gebäude der ersten Ausbaustufe, die Leibeigenen, die
Bäume der aktuellen Jahreszeit und die Texturen der eingestellten Grafikstufe. Höhere Gebäudestufen, Berufe, Truppen,
Winterbäume und Musikstücke kommen, wenn sie zum ersten Mal auftauchen. Das nennt man
[Lazy Loading](https://de.wikipedia.org/wiki/Lazy_Loading).

![Geladene Daten beim ersten Besuch, vor und nach dem Umbau. Gemessen mit load-report.mjs im Oktober 2026.](blog/loading-performance/load-chart-de.svg)

| Szenario | 1. Besuch | vorher | davon Figuren | 2. Besuch aus dem Netz |
|---|--:|--:|--:|--:|
| Startmenü | 2,9 MB | 2,9 MB | – | 0 |
| Freies Spiel, Desktop „hoch“ | **19 MB** | 35 MB | 6,5 MB | 0 |
| Freies Spiel, Handy „niedrig“ | **14,5 MB** | 19 MB | 2,1 MB | 0 |
| Kampagne Mission 1 | **25 MB** | 43 MB | 7,3 MB | 0 |
| Schaukasten (fast alles einmal) | **116 MB** | 192 MB | 30,5 MB | 0 |

Alles in `public/` zusammen sind rund 250 MB. Ein freies Spiel lädt beim Start also weniger als ein Zehntel davon.

## Der Inhalts-Hash {#hash}

Jetzt zum eigentlich interessanten Teil: Wie sorgt man dafür, dass ein Browser eine Datei **nie zweimal** lädt – und
trotzdem sofort die neue Fassung bekommt, wenn sie sich ändert?

### Das Dilemma des Caches

Browser haben einen [Cache](https://de.wikipedia.org/wiki/Cache): Sie merken sich geladene Dateien. Beim nächsten Mal
fragen sie den Server höchstens „Hat sich `castle.lod1.glb` geändert?“. Schon diese Frage kostet eine Rundreise übers
Netz, bei 100 Dateien also 100 Rundreisen. Sagt man dem Browser dagegen „Diese Datei ändert sich nie“, fragt er nie
wieder – und bekommt eine geänderte Fassung auch nie zu sehen.

### Name aus dem Inhalt

Die Lösung: Der Dateiname enthält einen **Fingerabdruck des Inhalts**. Im Build berechnet ein Vite-Plugin für jede
Datei einen [SHA-256-Hash](https://de.wikipedia.org/wiki/SHA-2) und hängt die ersten zehn Hexadezimalziffern an den
Namen:

```
public/models/buildings/castle.lod1.glb  →  dist/models/buildings/castle.lod1.6792949877.glb
```

```js
// scripts/vite-hashed-assets.js (gekürzt)
export function buildAssetMap(publicDir) {
  const map = {};
  for (const f of listFiles(publicDir)) {
    if (!isHashed(f) || EXCLUDE.test(f)) continue;
    const hash = createHash('sha256').update(readFileSync(join(publicDir, f))).digest('hex');
    map[f] = hashedName(f, hash);          // 'models/a/b.glb' → 'models/a/b.<10 Hex>.glb'
  }
  return map;
}
```

Eine [kryptografische Hashfunktion](https://de.wikipedia.org/wiki/Kryptographische_Hashfunktion) wie SHA-256 hat genau
die richtigen Eigenschaften: Gleicher Inhalt ergibt immer denselben Hash, und schon ein einziges geändertes Bit ergibt
einen völlig anderen. Damit gilt: **Gleicher Name heißt gleicher Inhalt.** Eine Datei mit Hash im Namen darf also für
immer im Cache liegen. Ändert sie sich, hat sie einen neuen Namen, und der Browser lädt nur sie neu.

Vite macht das für den JavaScript-Code schon von sich aus (`assets/play-BySqDWCD.js`), kopiert aber den Ordner
`public/` unverändert. Das eigene Plugin schließt diese Lücke für ~850 Spieldateien.

### Wie der Code die Dateien findet

Der Spielcode kennt die gehashten Namen natürlich nicht – er will `models/buildings/castle.lod1.glb` laden. Deshalb
schreibt das Plugin die Zuordnung „logischer Pfad → Datei“ als Konstante `__KRONLAND_ASSETS__` in den Code (rund
15 KB, gepackt). Jeder Zugriff auf eine Datei geht über eine kleine Funktion:

```js
// src/paths.js (gekürzt)
export function assetPath(path, map = ASSETS) {
  const p = clean(path);
  return map?.[p] ?? p;     // im Build: gehashter Name; im Entwicklungsserver: unverändert
}
export function siteUrl(path) {
  return siteRoot() + assetPath(path);
}
```

Daraus folgt eine Regel für alle Sitzungen, die seitdem in `CLAUDE.md` steht: Jede Adresse einer Datei aus `public/`
geht durch `siteUrl()` oder `assetUrl()`. Wer `fetch('../models/x.glb')` direkt schreibt, bekommt im Build einen 404,
denn die Datei heißt dort anders.

## Der Service-Worker {#sw}

Ein [Service Worker](https://developer.mozilla.org/de/docs/Web/API/Service_Worker_API) ist ein kleines Programm, das der
Browser zwischen Seite und Netz schaltet. Jede Anfrage der Seite geht erst an ihn, und er entscheidet: aus dem eigenen
Speicher antworten oder ans Netz weitergeben. Damit wird Kronland zur [PWA](https://de.wikipedia.org/wiki/Progressive_Web_App),
die auch offline startet.

Für gehashte Dateien gilt die Strategie **CacheFirst**: Liegt die Datei im Cache, wird nie wieder beim Server
nachgefragt.

![Oben der Build: Der Inhalt bestimmt den Namen. Unten der Browser: Was im Cache liegt, kommt ohne Netz.](blog/loading-performance/hash-cache-de.svg)

| Was | Strategie |
|---|---|
| Code, Seiten, CSS, Oberflächenbilder | vorab beim ersten Besuch im Hintergrund (~3,6 MB) |
| Modelle, Figuren-Manifest | CacheFirst, beim ersten Laden |
| Boden- und Naturtexturen | CacheFirst, nur die Größe der Grafikstufe |
| Musik, Effekte, Stimmen | CacheFirst, beim ersten Abspielen |

CacheFirst wäre ohne Hash gefährlich: Eine geänderte Datei mit altem Namen bliebe für immer veraltet. Mit Hash ist es
genau richtig. Nach einem Update liegen allerdings die alten Fassungen noch im Cache. `src/cacheCleanup.js` löscht
deshalb 30 Sekunden nach dem Laden alle gehashten Einträge, die der aktuelle Build nicht mehr kennt.

Die einzigen Dateien, die immer frisch geholt werden müssen, sind die HTML-Seiten und `sw.js` selbst – sonst erfährt
der Browser nie, dass es eine neue Version gibt.

Das Ergebnis steht in der letzten Spalte der Tabelle oben: Beim zweiten Besuch kommt **nichts** mehr aus dem Netz.

### Komprimieren

Code und JSON gehen zusätzlich mit [gzip](https://de.wikipedia.org/wiki/Gzip) gepackt über die Leitung: Der Spielcode
schrumpft von 1,4 MB auf 0,4 MB. Modelle, Bilder und Ton sind dagegen schon komprimiert (Meshopt, WebP, MP3); sie
noch einmal zu packen, bringt fast nichts.

## Figuren-Feinschliff {#figures}

### Alle gleich groß

Helden und Hauptleute waren im Spiel größer als Leibeigene. Das lag nicht an Absicht, sondern an der Messung: Das Spiel
skaliert jede Figur auf eine Zielhöhe und maß dafür die Grundhaltung des Modells (Bild 0). Bei Helden und Soldaten ist
diese Grundhaltung aber gebückt, sie wurden also zu klein gemessen und darum zu groß gezeichnet – um etwa 20 %.

Jetzt misst das Spiel die **Ruhehaltung**: das erste Bild der `idle`-Animation, ohne Werkzeuge. Weil die Animationen
nun im Spielmodell liegen, misst es immer an derselben Datei – die Größe springt also nicht, wenn später das Nahmodell
nachkommt. Alle Figuren sind seither 0,81 Kacheln hoch.

### Füße, die nicht rutschen

Ein Klassiker der Spieleprogrammierung: Die Figur bewegt sich mit einer Geschwindigkeit über die Karte, die
Laufanimation hat aber ihr eigenes Tempo. Passen beide nicht zusammen, rutschen die Füße über den Boden wie auf Eis.
Man nennt das *Foot Sliding*.

Die Lösung: Man misst, wie schnell die Animation „von sich aus“ läuft, und spielt sie dann so schnell ab, wie die
Figur sich bewegt. Wie misst man das? Der Fuß, der gerade am Boden steht, gleitet relativ zum Körper mit genau der
Laufgeschwindigkeit nach hinten. Das Spiel sucht deshalb in jedem Bild der gebackenen Animation die tiefsten Punkte
des Netzes (die untersten 3 % der Höhe, die Sohle) und verfolgt, wie schnell sie sich bewegen:

```js
// src/render/characters.js (gekürzt)
export function strideSpeed(geo, bake, clip) {
  const feet = [];
  for (let f = 0; f < clip.frames; f++) {
    // alle Ecken in diesem Bild: Lage = Σ Gewicht · Knochenmatrix · Ruhelage
    …
    const lim = minY + (maxY - minY) * 0.03;            // Sohle: unterste 3 %
    feet.push(mittelwert der Punkte mit y ≤ lim);
  }
  const vel = [];
  for (let f = 0; f < feet.length; f++) {
    const p = feet[f], q = feet[(f + 1) % feet.length];
    vel.push(Math.hypot(q[0] - p[0], q[1] - p[1]) / dt);  // Geschwindigkeit der Sohle
  }
  vel.sort((x, y) => x - y);
  return vel[vel.length >> 1];                            // Median
}
```

Warum der [Median](https://de.wikipedia.org/wiki/Median) und nicht der Mittelwert? Beim Fußwechsel springt der tiefste
Punkt plötzlich vom einen Fuß zum anderen – das ergibt in einzelnen Bildern riesige Geschwindigkeiten. Der Median
ignoriert solche Ausreißer, der Mittelwert nicht.

Das Abspieltempo ist dann einfach Bodengeschwindigkeit geteilt durch natürliche Geschwindigkeit – begrenzt auf 0,6 bis
2,2. Die Meshy-Laufanimationen gehen nämlich fast auf der Stelle; ganz mitzuhalten hieße siebenfaches Tempo, und das
sähe nach Zappeln aus.

```js
export function strideRate(natural, ground, fallback = 1) {
  if (!natural || !(ground > 0)) return fallback;
  return Math.min(STRIDE_RATE_MAX, Math.max(STRIDE_RATE_MIN, ground / natural));
}
```

### Feste Arbeitsplätze

Bisher standen mehrere Leibeigene, die an derselben Baustelle arbeiteten, oft genau übereinander. Jetzt bekommt jeder
eine eigene Kachel neben der Baustelle, am Baum und am Lagerfeuer. Weil das den Spielzustand betrifft, steht der Platz
in der Simulation und geht in den Zustands-Hash ein. Im nächsten Meilenstein wird daraus ein Kreis (siehe
[Artikel 16](blog/polish-2/)).

## Was nicht klappte {#problems}

- **404 im Build:** Wer eine Datei direkt mit `fetch('../models/x.glb')` lud, bekam im Build einen Fehler, im
  Entwicklungsserver aber nicht – dort gibt es keine Hashes. Darum die Regel oben und ein Muster `hashed()` für
  E2E-Tests, das beide Namensformen akzeptiert.
- **Vergrößerte Helden und Hauptleute** wirkten falsch; erst die Messung an der Ruhehaltung machte alle gleich groß.
- **Ein E2E-Test zur Angriffswarnung** scheiterte, weil die Gegner-KI die Testfigur wegschickte. Sie wird jetzt direkt
  vor dem Klick platziert.

## Zum Nachmachen {#tips}

- Messen vor optimieren: Ein Ladebericht je Szenario zeigt sofort, wo die Megabytes stecken.
- Inhalts-Hash im Dateinamen plus CacheFirst im Service-Worker: einmal laden, nie wieder fragen.
- Alle Dateipfade über eine einzige Funktion auflösen – dann kann der Build die Namen ändern.
- Lade Details erst, wenn man sie sehen kann.
- Nimm bei Messreihen mit Ausreißern den Median.
- Rohdateien der Asset-Pipeline früh aus dem Git halten, sonst wächst das Repository mit jedem Durchlauf.
