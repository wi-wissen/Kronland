# Laden, Caching und Datenmengen

Wie das Spiel seine Dateien ausliefert, damit nichts zweimal geladen wird, und wie viele Daten ein Spiel
wirklich braucht. Messwerkzeug: `scripts/load-report.mjs`. Rohdateien der Pipeline: [ROHDATEIEN.md](ROHDATEIEN.md).

## Grundsatz

1. **Nur laden, was gebraucht wird.** Beim Start nur die Gebäude der ersten Stufe, die Leibeigenen, Bäume und
   Texturen der Grafikstufe; alle übrigen Gebäude, Berufe, Truppen, Winterbäume und Musikstücke erst, wenn sie
   auftauchen (`src/render/assets.js`, `src/render/characters.js`, `src/audio/`).
2. **Jede Datei hat einen Inhalts-Hash im Namen.** Gleicher Name = gleicher Inhalt. Darum darf alles für immer
   gecacht werden; eine geänderte Datei bekommt einen neuen Namen und wird als einzige neu geladen.
3. **Service-Worker (PWA) hält alles vor.** Beim zweiten Besuch lädt das Spiel nichts mehr aus dem Netz und
   startet auch offline.

## Inhalts-Hash im Build

Vite hasht seine eigenen Bundles (`assets/play-BySqDWCD.js`), kopiert `public/` aber unverändert. Das Plugin
`scripts/vite-hashed-assets.js` übernimmt das Kopieren im Build:

```
public/models/buildings/castle.lod1.glb  →  dist/models/buildings/castle.lod1.6792949877.glb
public/audio/manifest.json              →  dist/audio/manifest.4b1c…….json
```

- Gehasht werden alle Spiel- und Websitedateien unter `models/`, `textures/`, `audio/`, `icons/`, `portraits/`,
  `art/`, `site/` (Endungen glb, json, webp, png, jpg, mp3, mp4 …). Wurzeldateien (Favicon, App-Symbole fürs
  Manifest) und Lizenztexte bleiben ungehasht. Stimmen-Rohaufnahmen (`*.wav`, `*.src.mp3`) werden nicht ausgeliefert.
- Die Zuordnung logischer Pfad → gehashter Pfad (~850 Einträge, ~15 KB gepackt) landet als `__KRONLAND_ASSETS__`
  im Spielcode. `src/paths.js` löst damit auf:
  - `siteUrl('models/characters/manifest.json')` – Adresse einer Datei relativ zur Website-Wurzel,
  - `assetUrl(\`${base}characters/${f}\`)` – bereits zusammengesetzte Adresse (Ordner + Name),
  - `assetPath(p)` – nur der Pfad (z. B. für Porträts mit eigenem Präfix).
- **Regel:** Jede Adresse einer Datei aus `public/` geht durch eine dieser Funktionen. Wer `fetch('../models/x.glb')`
  direkt schreibt, bekommt im Build einen 404.
- Im Entwicklungsserver, in Vitest und in Node-Skripten fehlt die Zuordnung: Pfade bleiben, wie sie sind.
- Test: `tests/build/hashedAssets.test.js`.

## Service-Worker

`vite-plugin-pwa` (generateSW, Workbox), Einstellungen in `vite.config.js`:

| Was | Strategie | Wann |
|---|---|---|
| Code, Seiten, CSS, Oberflächenbilder (Symbol-Atlas, Porträts, Menükulissen) | Vorab-Cache (~3,6 MB) | beim ersten Besuch, im Hintergrund |
| Modelle, Figuren-Manifest | CacheFirst `models` | beim ersten Laden |
| Boden- und Naturtexturen | CacheFirst `textures` | beim ersten Laden (nur die Größe der Grafikstufe) |
| Musik, Effekte, Stimmen, Ton-Manifeste | CacheFirst `audio` | beim ersten Abspielen |
| Website-Bilder | CacheFirst `site-images` | beim ersten Ansehen |

CacheFirst heißt: liegt die Datei im Cache, fragt der Browser nie wieder beim Server nach. Das ist nur mit
Inhalts-Hash richtig – sonst bliebe eine geänderte Datei für immer alt. Nach einem Update liegen die alten
Fassungen noch im Cache; `src/cacheCleanup.js` löscht 30 s nach dem Laden alle gehashten Einträge, die der
aktuelle Build nicht mehr kennt.

**Server-Einstellung (empfohlen):** Gehashte Dateien dürfen auch im HTTP-Cache ewig liegen, z. B. Netlify/
Cloudflare Pages (`_headers`):

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/models/*
  Cache-Control: public, max-age=31536000, immutable
/textures/*
  Cache-Control: public, max-age=31536000, immutable
/audio/*
  Cache-Control: public, max-age=31536000, immutable
/sw.js
  Cache-Control: no-cache
```

`sw.js` und die HTML-Seiten dagegen immer frisch (`no-cache`), sonst erfährt der Browser nichts vom Update.

## Wie viele Daten braucht ein Spiel?

Gemessen mit `npm run build && node scripts/load-report.mjs` (Chromium, Oktober 2026). Größen sind die
Dateigrößen; Code und JSON gehen zusätzlich gepackt über die Leitung (gzip: Spielcode 1,4 MB → 0,4 MB), Modelle,
Bilder und Ton sind schon komprimiert. Ton fehlt in der Messung (startet erst nach der ersten Berührung):
Effekte 0,2 MB, je Musikstück ~2 MB, je Satz einer Stimme ~30 KB.

| Szenario | 1. Besuch | vorher (Nahmodelle sofort) | davon Figuren | 2. Besuch: aus dem Netz |
|---|--:|--:|--:|--:|
| Startmenü (Spiel noch nicht begonnen) | 2,9 MB | 2,9 MB | – | 0 |
| Freies Spiel, 2 Spieler, Desktop „hoch“ | **19 MB** | 35 MB | 6,5 MB | 0 |
| Freies Spiel, Handy „niedrig“ | **14,5 MB** | 19 MB | 2,1 MB | 0 |
| Freies Spiel, 4 Spieler, Desktop „hoch“ | **19 MB** | 35 MB | 6,5 MB | 0 |
| Kampagne Mission 1 | **25 MB** | 43 MB | 7,3 MB | 0 |
| Schaukasten (fast alles einmal) | **116 MB** | 192 MB | 31,1 MB (Pferd +0,6) | 0 |
| Gewimmel (Belastungsprobe) | **79 MB** | 164 MB | 34,8 MB | 0 |

„vorher“: Messung vor dem Umbau der Figuren (Nahmodelle wurden mit jeder Rolle sofort geladen). Ein Nahmodell
(~2,2 MB) kommt jetzt erst, wenn eine Figur dieses Modells nah genug für die Nahstufe ist (siehe unten).

Bei längerem Spiel kommen nach und nach weitere Gebäudestufen, Berufe und Truppen dazu (Obergrenze: alles
zusammen, ~250 MB). Zum Vergleich: Alles in `public/` sind ~250 MB – geladen wird davon beim Start weniger als ein
Zehntel.

Aufteilung beim freien Spiel (Desktop):

| Art | Dateien | MB |
|---|--:|--:|
| Figuren, Spielmodell (mit Skelett und Animationen) | 7 | 6,5 |
| Gebäude der ersten Stufe, Gerüst, Felsen (je mit 2 Detailstufen) | 25 | 4,5 |
| Bäume und Büsche (Sommer, 3 Stufen) | 18 | 3,8 |
| Code, Seiten | 8 | 2,0 |
| Boden- und Naturtexturen | 12 | 1,6 |
| Oberflächenbilder | 8 | 1,0 |

### Nahmodelle der Figuren erst bei Bedarf

Früher war die Hälfte der Startdaten die **Nahmodelle** der Figuren (~2,4 MB je Figur: 2048×2080-JPEG plus
Normalen-Textur), obwohl sie erst beim Heranzoomen sichtbar werden (Figur über ~80 px hoch). Sie wurden sofort
geladen, weil nur sie Skelett und Animationen enthielten. Jetzt liegen die Animationen im Spielmodell; das
Nahmodell lädt `requestNearModel` beim ersten Heranzoomen nach (Ablauf und Prüfung: [MODELLE.md](MODELLE.md#zwei-darstellungen-je-figur)).

Weitere Kandidaten: Animationen quantisieren (sie sind Float32, ~0,2–0,4 MB je Figur), Texturen als KTX2
(weniger Grafikspeicher), Musik als Opus statt MP3 (~40 % kleiner).

## Messwerkzeug: `scripts/load-report.mjs`

```bash
npm run build
node scripts/load-report.mjs                    # alle Szenarien (menu, game, phone, four, c1, showcase, bustle)
node scripts/load-report.mjs game phone         # nur diese
node scripts/load-report.mjs game --list        # jede geladene Datei einzeln
node scripts/load-report.mjs --json b.json      # Rohdaten speichern; --from-json b.json gibt die Tabellen neu aus
```

Startet `vite preview` (Port `--port`, Standard 4311), öffnet jedes Szenario dreimal in einem Browserprofil:
leer (1. Besuch), nach Installation des Service-Workers (2. Besuch) und noch einmal (3. Besuch, alles aus dem
Cache). Gezählt wird jede Antwort nach Art (Pfad). Passt die Playwright-Version nicht zum vorinstallierten
Browser: `PW_CHROMIUM=/opt/pw-browsers/chromium`.

### Fernstufe der Gebäude mit Eckfarben

Seit die lod2 der Gebäude Eckfarben statt UV trägt (docs/MODELLE.md#detailstufen-erzeugen), sind die
Detailstufen aller 66 eigenen Gebäudemodelle neu erzeugt: lod2 zusammen 6,00 → 6,15 MB, lod1 (UV stärker
gewichtet, weniger Verschmieren) 13,5 → 15,0 MB. Je Gebäude im Spiel ~+20 KB bei lod1, lod2 etwa gleich
(Burg: lod1 139 → 150 KB, lod2 57 → 53 KB). Geladen wird wie bisher (Original und Stufen bei Bedarf).

## Aufgeräumt

Nie geladen und darum entfernt: `chapel3_old` (ersetzt durch `chapel3`), die `.lod1`-Stufen der Bäume und des
Buschs (benutzt werden Original, `.lod2`, `.lod3`), die 1024er-Naturtexturen (geladen wird nur `-512`; die große
Fassung schreibt `ground.mjs` jetzt nach `assets-src/nature/`). Zusammen ~3 MB.

## Große Karten im laufenden Spiel (Gewimmel)

Belastungsprobe „Gewimmel“ (`?mission=bustle`, ~2500 Entities, vier Computergegner, zwei Dauerschlachten).
Messung ohne Grafik: `node scripts/stress-run.js bustle 20` (je Spielminute Takt Ø/max, Figuren, Gebiete,
Spielstand); `--build=5` lässt den Spieler zusätzlich alle 5 s ein Gebäude setzen. Werte Node 22, Cloud-Rechner:

| | vorher | nachher |
|---|---|---|
| Takt Ø nach 10 Spielminuten | 19,9 ms | ~7 ms |
| Gesamtlauf 10 Spielminuten (allein auf dem Rechner) | 80 s | 29 s |
| Anteil `nearestEnemy` an der Rechenzeit | 42 % | 16 % |
| Gebietsrechnungen, KI-Dauerlauf 20 min (843×) | 468 ms | 129 ms |

Zustands-Hashes nach jeder Spielminute (Gewimmel 10 min, KI-Dauerlauf 20 min) sind vorher und nachher gleich: Das
Spiel verhält sich genau wie zuvor, es rechnet nur weniger.

- **Feindsuche** (`nearestEnemy`, heißester Pfad im Getümmel): Feindschaft je Besitzer einmal je Aufruf, Doppelte
  nur bei Gebäuden prüfen, Abstand quadratisch vorfiltern, `targetable` erst für mögliche Bestwerte. Gleiches
  Ergebnis wie die einfache Fassung (Test in `tests/sim/stress.test.js`).
- **Gebiete** (`map.regionAt`): nicht mehr die ganze Karte nach jedem Bauen/Abriss/Baumfällen. Freigaben, die an
  genau ein Gebiet grenzen (Baum gefällt), bekommen dessen Nummer direkt (`joinFreed`); sonst werden nur die
  berührten Gebiete neu geflutet (`updateRegions`). Zahlenschlüssel statt Text je Aufruf, Puffer wiederverwendet.
  Eine vollständige Rechnung kostet auf 160×160 ~0,5–1 ms.
- **Autosave**: Text ohne tiefe Kopie (vorher `structuredClone` + `JSON.stringify`, jetzt nur `JSON.stringify`),
  ~0,7 MB Text, ~20 ms auf dem Hauptfaden im Browser (`engine.autosaveStats`), Kompression asynchron (~170 ms bis
  zur fertigen Ablage). Das Vorschaubild entsteht auf einer Zeichenfläche im Hauptspeicher (`willReadFrequently`):
  `toDataURL` auf einer GPU-Zeichenfläche wartete auf alle anstehenden WebGL-Bilder und hielt das Spiel im
  Browserprofil sekundenlang an (64 % eines 35-s-Bildes unter Software-Grafik).
- **Shader mitten im Spiel**: Modelle, die erst später auftauchen (Lagerfeuer, Baustellenphasen, Gerüst, Ruine),
  werden beim Aufwärmen einmal mitgezeichnet; ein neu zu übersetzender Shader hielt sonst das Spiel an (im Profil
  `getShaderInfoLog`, unter Software-Grafik bis 70 s, auf echten Grafikkarten Bruchteile einer Sekunde bis Sekunden).
- **Spielschleife**: Zeitbudget je Bild und verworfener Rückstand statt Todesspirale, Fehler abgefangen
  (docs/ARCHITEKTUR.md#spielschleife-und-fehler).
