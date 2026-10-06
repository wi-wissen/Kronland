# Modelle, Figuren und Detailstufen

Wie Modelle ins Spiel kommen, welches Format eigene Figuren (z. B. aus Tripo) haben müssen und wie die
Detailstufen (LOD) funktionieren.

## Überblick

| Was | Wo | Wie gezeichnet |
|---|---|---|
| Gebäude | `public/models/buildings/*.glb` (+ `.lod1.glb`, `.lod2.glb`) | eigenes Objekt je Gebäude, Stufe nach Abstand |
| Bäume, Busch | eigene Meshy-Modelle `public/models/buildings/tree_*.glb`, `bush.glb` (+ Winterfassung, `.lod2`/`.lod3`), siehe [Bäume und Büsche](#bäume-und-büsche); ohne Modelle prozedural (`src/render/nature.js`) | instanziert in Chunks (8×8 Kacheln), Stufe je Chunk |
| Deko | prozedural (`src/render/nature.js`) + KayKit-Felsen und -Felsgipfel; Felsbrocken, Stümpfe, Rohstoffhaufen und Schächte mit gemalter Struktur (Fels, Rinde; `natureDetail`, triplanar, [Naturtexturen](BODEN.md#naturtexturen-bäume-büsche-felsen); Vergleich: `?nature=off`) | instanziert in Chunks (12×12 bzw. 6×6 Kacheln) |
| Figuren | `public/models/characters/*.glb` + `manifest.json` | instanziert, GPU-Skinning aus gebackener Knochen-Textur |
| Rückfall | `src/render/models.js` (prozedurale Figuren) | dieselbe Instanzierung, Körperteile als „Knochen“ |

## Detailstufen (LOD)

Code: `src/render/lod.js`. Gebäude und Deko bekommen einen *effektiven Abstand*: echter Abstand zur
Kamera, korrigiert um das Sichtfeld (Handy hochkant = weiteres Sichtfeld = Objekte kleiner) und die Grafikstufe
(`niedrig` vereinfacht früher). **Figuren und Bäume** richten sich nach ihrer **Bildschirmhöhe** in CSS-Pixeln
(`screenHeightPx`, wie Unitys „Screen Relative Transition Height“): Gleich groß auf dem Bildschirm heißt gleiche
Stufe, auf Handy wie Desktop. Eine Hysterese von ±10–12 % verhindert Flackern an den Grenzen.

| Gruppe | Grenzen (Kacheln, Stufe „hoch“) | Stufen |
|---|---|---|
| Gebäude | 38 / 72 | Original → lod1 (~50–80 %, Textur des Originals) → lod2 (~15–45 %, **Eckfarben statt Textur**, eigenständig). Ist das Original noch nicht geladen, die lod2 aber schon, steht sie für das ganze Gebäude (`assetState` = 1) |
| Bäume | Bildschirmhöhe 80 / 40 px, gerechnet mit der halben Baumhöhe (`TREE_LOD_HEIGHT`: hoch 0,5, mittel 0,4, niedrig 0,3) – Modellbäume sind doppelt so hoch wie die früheren und wechseln so bei denselben Abständen (Desktop ~30 / 62 Kacheln), mittel/niedrig früher | Modell (~1000–2100 Dreiecke) → `.lod2` (~550–1400) → `.lod3` (~170–450, ohne Schattenwurf). Auf „niedrig“ fehlt das Original: `.lod2`, dann `.lod3`. Prozeduraler Rückfall: detailliert → einfach → Fernform (≈20–40 Dreiecke) |
| Busch (Modell) | 26 | `.lod2` (~950 Dreiecke, mit Schatten) → `.lod3` (~200, ohne Schattenwurf) |
| Figuren | Bildschirmhöhe 80 / 28 / 12 px (unter 3 px weg) | **Nahmodell**, flüssig → **Spielmodell** (lod1), 24 Bilder/s ohne Mischung → Spielmodell, 8 Bilder/s → starr. Wechsel Nah ↔ Spiel mit 0,35 s Dither-Überblendung |
| Felsen (prozedurale Büsche) | 62 | mit Schatten → ohne Schattenwurf (gleiche Geometrie) |
| Kleine Deko (Gras, Blumen, Kiesel) | ab 66 weg | schrumpft vorher im Shader in den Boden (kein Aufploppen); ein Chunk fällt weg, sobald er ganz hinter dem Ende des Schrumpfens liegt |

Faktor je Grafikstufe: hoch 1, mittel 0,8, niedrig 0,55 (Figuren, Bäume, Felsen und Büsche mindestens 0,8).
Werte stehen in `LOD_PROFILES` und `LOD_TIERS`. Hat eine Gruppe weniger Geometrien als Stufen, fallen die
feinsten weg (`[einfach, fern]` = Stufe 1 und 2).

Gelände und Wasser sind in Kacheln geteilt (`splitGridMesh`), damit die Sichtprüfung ganze Bereiche verwirft.
Bäume und Deko liegen je Chunk zusammen; sichtbare Chunks werden nur bei Kamerabewegung neu eingesammelt
und in ein InstancedMesh je Stufe kopiert (wenige Zeichenaufrufe, egal wie viele Chunks).

**Messen:** `?debug=1` zeigt Bilder/s, Zeichenaufrufe, Dreiecke und die Anzahl je Gruppe und Stufe.
Im Code: `window.__kronland.renderer.lodStats()`.

## Bäume und Büsche

Eigene Modelle aus der Gebäude-Pipeline (Konzept → Meshy, `assets-src/buildings/<name>/`), Tabelle und
Auswahl-Logik in `src/render/treeModels.js`, Geometrie und Material in `src/render/nature.js`
(`treeModelVariants`, `bushModelVariant`):

| Art | Modell | Winter | Höhe im Spiel (Kacheln, ×0,78–1,22) |
|---|---|---|---|
| Eiche (Laub) | `tree_oak` | `tree_oak_winter` (kahl, Kreuz) | 3,4 |
| Buche (Laub) | `tree_beech` | `tree_beech_winter` (kahl, Kreuz) | 3,8 |
| Birke (Laub, jeder 5.) | `tree_birch` (Kreuz) | `tree_birch_winter` (kahl, Kreuz) | 3,0 |
| Fichte (Nadel) | `tree_spruce` | `tree_spruce_winter` (verschneit) | 4,4 |
| Kiefer (Nadel) | `tree_pine` | `tree_pine_winter` (verschneit) | 4,8 |
| Busch (Deko) | `bush` | `bush_winter` (fehlt sie: Schnee aus dem Shader) | 0,95 |

Maßstab: Wohnhaus Stufe 1/2/3 ist auf 3×3 Kacheln 3,1 / 4,0 / 5,9 hoch (Modellbox nach `fittedModel`); Laubbäume
etwa so hoch wie das zweistöckige Wohnhaus, Nadelbäume höher. Die Modelle werden beim Laden auf den Boden gestellt,
mittig ausgerichtet und auf diese Höhe gebracht (`fitNatureGeometry`, Maß vom Original, damit alle Stufen
deckungsgleich sind).

- **Art je Baum**: Die Simulation kennt Bäume nur als Kachel. Die Darstellung wählt die Art aus Höhe über dem
  Wasser (Nadelanteil 10 % im Tal bis 100 % hoch oben) und einem Hash aus Kennung und Kachel (`treeHash`,
  `pickTreeVariant`) – derselbe Baum hat immer dieselbe Art; Drehung, Größe (0,78–1,22) und Farbton aus demselben
  Hash. Gefällte Bäume hinterlassen an derselben Stelle einen Stumpf (bei Modellbäumen 1,8× größer).
- **Kreuz für flache Modelle**: Kahle Winter-Laubbäume und die Sommerbirke sind fast flach; Original und eine um 90°
  gedrehte Kopie werden zu einer Geometrie zusammengeführt (`crossGeometry`) – von allen Seiten voll, ein
  Zeichenaufruf, doppelte Dreiecke.
- **Detailstufen**: `.lod2` (vorhanden) und `.lod3` (Fernform, `node scripts/build-lods.mjs <datei> --ratios 0.1
  --errors 0.6 --out <name>.lod3.glb`). Nur Original, `.lod2` und `.lod3` werden geladen (Textur und
  Normalen-Textur 1024 stecken im Original); ein `.lod1` erzeugt `build-lods.mjs` mit, es wird nicht ausgeliefert (löschen).
- **Material**: Textur und Normalen-Textur des Modells, weich schattiert, beidseitig; Wind über `natureMaterial`
  (Krone wiegt ab der Biegehöhe `bend`, der Stamm darunter steht fest), Farbton je Instanz.
- **Winter**: `applyWeather` → `setNatureSeason` tauscht je Chunk-Gruppe nur Geometrie und Material der
  Stufen (`applySeason`); Instanz-Matrizen und Farben bleiben, keine Arbeit pro Bild. Die Winterfassungen werden
  beim ersten Winter nachgeladen (`loadNatureModels`, ~4 MB); bis dahin – oder ohne Datei (z. B. `bush_winter`) –
  trägt die Sommerfassung die Schneekappe des Shaders. Die Winterfassungen selbst haben Schnee im Modell (Shader-Schnee
  aus) und eine nur schwache Farbvariation (kein gelb getönter Schnee).
- **Leistung** (Karte Seed 42, 611 Bäume, Burg im Blick, Dreiecke samt Schattenpass, Zoom 28): hoch Desktop
  ~1,4 Mio. (vorher ~0,33 Mio.), niedrig Handy ~48 000 (vorher ~27 000), niedrig Desktop ~140 000 (vorher ~36 000) – vor allem die Bäume der mittleren
  Stufe. Download: Sommerfassungen (Original, `.lod2`, `.lod3`) 3,8 MB beim Start, Winterfassungen 3,4 MB beim
  ersten Winter.
- **Rückfall**: Fehlt ein Sommermodell (`?no-models`, Ladefehler), zeichnet das Spiel die prozeduralen Bäume
  und Büsche wie früher.


**Verteilung der Arten** (`treeSpecies` in `src/render/treeModels.js`, nur Darstellung): gleiche Arten stehen in
Beständen (glattes Rauschen, etwa 7 Kacheln), nur ~12 % tanzen aus der Reihe; der Nadelanteil steigt mit der Höhe;
Waldtyp der Welt (`forestType`): normal Laub- und Mischwald, Nadelwald erst im Gebirge; in kalten Welten (≥ 40 % Winter im
Wetterzyklus) oder mit `forest: 'conifer'` in der Mission überwiegend Nadelwald (`'leafy'`: fast nur Laub);
Kiefern (kahler Stamm, Krone oben) nur im dichten Wald (≥ 8 Nachbarbäume im Umkreis von 2 Kacheln), sonst Fichten;
einzeln stehende Bäume sind meist Eichen, an Waldrändern Birken.

## Detailstufen erzeugen

```bash
node scripts/build-lods.mjs                                  # alle Gebäude und Figuren
node scripts/build-lods.mjs public/models/characters/Neu.glb # nur eine Datei
node scripts/build-lods.mjs --ratios 0.5,0.2 --errors 0.01,0.04 datei.glb
```

Vereinfacht wird mit meshoptimizer (`simplifyWithAttributes`, Normalen und UV gewichtet, damit Farben der
Paletten-Textur nicht verrutschen). Skinning bleibt erhalten. Die LOD-Dateien enthalten keine Animationen
und keine Texturbilder – das Spiel nimmt Material und Clips vom Original. `scripts/build-assets.sh` ruft das
Skript am Ende automatisch auf. Optionen: `--keep-textures` (Stufe behält eine eigene Textur),
`--strict-seams` (UV-Nähte nicht verschieben, sonst Farbstreifen über Inselgrenzen), `--bake` (letzte Stufe mit
Eckfarben, siehe unten), `--out pfad/x.lod{n}.glb`. Gewicht der UV beim Vereinfachen: Gebäude 5, Figuren 2
(`LOD_UV_WEIGHT` überschreibt).

**Fernstufe der Gebäude (lod2, „bake“)**: Die Meshy-Gebäude haben einen Texturatlas mit Hunderten UV-Inseln. Bei
starker Vereinfachung zog meshoptimizer („Permissive“) Kanten über die Inselgrenzen – Streifen in fremden Farben,
besonders an Burg und Dächern, von oben am deutlichsten. Mit `--strict-seams` bleibt das Netz dagegen fast so groß
wie das Original (Burg 12 082 → 7 009 Dreiecke). Darum backt das Skript die letzte Gebäudestufe (Standard
`[0.12, 0.02, 'bake']`): Texturfarbe je Dreiecksecke (etwas zur Dreiecksmitte hin abgetastet, nie auf dem Inselrand,
256er-Verkleinerung, linear), Ecken gleicher Lage und Normale verschmolzen (Nähte verschwinden, harte Kanten
bleiben), dann nach Lage, Normale und Farbe vereinfacht. Die Datei hat `COLOR_0`, kein UV und keine Textur; das
Spiel übernimmt dafür nicht das Material des Originals (`isBakedGeometry` in `assets.js`), die Teamfarbe
(Magenta in den Eckfarben) wirkt trotzdem. Burg: 2 171 Dreiecke mit Streifen → 2 533 sauber, 57 → 53 KB.

## Figuren: das Manifest

`public/models/characters/manifest.json` ordnet **Rollen** einem **Modell** zu. Fehlt ein Modell oder kann es
nicht geladen werden, nimmt das Spiel die prozedurale Figur (`procedural`), ebenfalls instanziert.

```jsonc
{
  "fps": 24,                         // Abtastrate beim Backen der Animationen
  "models": {
    "Farmer": {
      "file": "Farmer.glb",           // optional, Standard: <Name>.glb
      "lods": 1,                     // Anzahl Farmer.lod1.glb … (Pipeline-Figuren: 1 = Spielmodell)
      "height": 0.95,                // Zielhöhe in Kacheln (1 Kachel ≈ 1 m im Spiel); oder "scale"
      "yaw": 0,                      // Drehung, falls das Modell nicht nach +Z schaut (Bogenmaß)
      "uvGrid": [8, 4],              // Raster für uvCells (KayKit: 8×4 Farbfelder)
      "clips": {                     // Spiel-Schlüssel → Clip-Name in der GLB
        "idle": "Idle", "walk": "Walk", "run": "Run",
        "chop": "Chop", "mine": "Pickaxe", "hammer": "Hammer", "build": "Build", "carry": "Carry",
        "attack": "Attack", "shoot": "Shoot", "die": "Death", "sit": "Sit", "ride": "Ride", "cheer": "Cheer"
      },
      "include": ["Axe"],            // starre Teile (Waffen, Hüte), die sichtbar sein sollen; "Modell:Teil" leiht von anderen Modellen
      "team": { "materials": ["Team"] },          // Spielerfarbe: Material-Name, Teilnamen ("parts"), "uvCells" oder "uvRects"
      "tint": { "uvCells": [[0, 1]], "color": "#b08452" }, // zweite Färbung (Berufskittel, Räuber); Farbe pro Instanz überschreibbar
      "mask": ["Farmer.mask.png", null], // Masken-Textur je Stufe (R = Spielerfarbe, G = Tönung); ein Name gilt für alle
      "rim": 0,                      // optional: Randlicht an den Kanten (Standard aus – wirkte als helle Linien)
      "props": { "Axe": ["chop"], "Hammer": ["hammer", "build"] } // Werkzeuge: nur in diesen Clips sichtbar
    }
  },
  "roles": {
    "serf":                 { "variants": [{ "model": "Farmer", "weight": 1 }, { "model": "FarmerF", "weight": 1 }],
                              "procedural": "serf" },
    "soldier.sword.leader": { "fallback": "soldier.sword" },
    "soldier.heavyCav":     { "model": "Ritter", "seatOffset": -0.26, "clipAlias": { "walk": "ride", "idle": "ride" },
                              "attach": [{ "role": "mount.horse", "offset": [0, 0, 0.1], "scale": 1.06 }] },
    "mount.horse":          { "model": "Horse", "procedural": "horse", "procScale": 1.7 } // Reittier: Sattel im Modell (unten)
  }
}
```

**Varianten:** Eine Rolle mit `variants` wählt je Einheit eine Variante, gewichtet und über einen Hash
der Einheiten-ID. Das wirkt zufällig, bleibt aber über Laden und Wiederholung gleich. Es betrifft nur die
Darstellung, die Simulation kennt keine Varianten. Jeder Eintrag darf Rollenfelder überschreiben (`include`,
`tint`, `clips` …). Fehlt das Modell einer Variante, wird die nächste verfügbare genommen. Helden sind
feste Rollen (`hero.nelia` …) mit eigenen Figuren (Konzeptbögen in `assets-src/characters/<hero>/`, siehe [STIL.md](STIL.md)).

**Masken-Textur:** Statt Zellen oder Rechtecken kann eine Bilddatei die Spielerfarbe (Rotkanal) und die
Tönung (Grünkanal) festlegen. Der Shader liest sie je Bildpunkt (`uMaskMap`). Die Pipeline erzeugt sie aus
der Markerfarbe Magenta. Als Liste gilt je Detailstufe eine eigene Datei (Lücken erben die Stufe davor).

**Eigene Darstellung je Stufe:** Bringt eine LOD-Datei eine eigene Textur mit, nutzt das Spiel für diese Stufe
ein eigenes Material (Textur + Maske der Stufe). So kann das Spielmodell flach gefärbt sein, während das
Nahmodell die Detailtextur trägt. Skelett und Animationen teilen sich alle Stufen.

**Werkzeuge mit Clip-Sichtbarkeit (`props`):** Starre Teile (Kind der Hand), die nur in bestimmten Clips
erscheinen. Beim Backen bekommt jedes Werkzeug einen eigenen „Knochen“: die Lage des Werkzeug-Knotens
(darf eigene Animation haben, z. B. zwischen beiden Händen ausgerichtet). In anderen Clips wird er auf
einen Punkt zusammengezogen. Kein Shader-Zweig, keine zusätzlichen Zeichenaufrufe.

**Rollen**, die das Spiel verwendet (Schlüssel werden von hinten gekürzt, bis einer passt:
`soldier.bow.leader` → `soldier.bow` → `soldier`):

| Rolle | Wer |
|---|---|
| `serf` | Leibeigener |
| `worker` | Arbeiter (Kittelfarbe je Beruf über `tint`) |
| `soldier.<line>` / `soldier.<line>.leader` | `sword`, `spear`, `bow`, `lightCav`, `heavyCav`, `cannon` |
| `hero.<id>` | `nelia`, `orrin`, `taran`, `malvor` |
| Gesprächsfigur | Rolle aus `look` der Mission (`serf`, `worker` …) |
| `bandit`, `bandit.bow` | Räuber (neutraler Missionsspieler) |
| `mount.horse`, `crew` | Reittier, Kanonenmannschaft (über `attach`) |

**Animations-Schlüssel** und Rückfälle (fehlt einer, wird der nächste genommen):
`mine → chop → attack → idle`, `build → hammer → chop`, `run → walk → idle`, `carry → walk`,
`shoot → attack`, `cheer/sit → idle`. `die` wird einmal abgespielt und bleibt auf dem letzten Bild.

## Format für eigene Figuren (Tripo u. a.)

| Punkt | Vorgabe |
|---|---|
| Dateiformat | glTF 2.0 binär (`.glb`), eine Figur je Datei, ein Skelett (`skin`) |
| Achsen | Y nach oben, Figur schaut nach **+Z**, steht mit den Füßen auf y = 0 (Ursprung zwischen den Füßen) |
| Einheiten | Meter; die Größe wird über `height` im Manifest angepasst. **Alle Figuren gleich hoch (0,81 Kachel)** – auch Helden und Hauptleute (kein Rollen-`scale`); gemessen wird das erste Bild von `idle` ohne Werkzeuge (`props`); die Grundhaltung (Bild 0) ist bei Helden und Soldaten gebückt und machte sie früher ~20 % zu groß. Lauftempo: siehe „Lauftempo“ unten |
| Skelett | ≤ 64 Knochen (Humanoid, z. B. Mixamo-/Tripo-Rig), max. 4 Gewichte je Ecke; alle Teile am **selben** Skelett |
| Waffen, Hüte | als eigene Netze an Knochen gehängt (Kind eines Hand-/Kopf-Knochens) oder mitgeskinnt; Namen eindeutig, im Manifest unter `include` |
| Animationen | in derselben GLB, Namen frei (Zuordnung im Manifest). Schleifen (Idle, Walk, Run, Arbeit) nahtlos, 0,6–2 s; Death einmalig |
| Material | ein Material mit Basisfarb-Textur (PNG/JPG, ≤ 2048²; die niedrige Grafikstufe verkleinert beim Laden auf 1024, `characterTexture`), unbeleuchtet wirkende Bemalung ist ok (Licht kommt vom Spiel) |
| Spielerfarbe | **eines** davon: eigenes Material `Team` (empfohlen), eigene Teile (Umhang, Wappen) unter `team.parts`, oder Texturbereiche (`uvRects`). Die Fläche sollte in der Textur mittelhell und wenig gesättigt sein (wird umgefärbt, Helligkeit bleibt) |
| Zweitfarbe | optional wie oben unter `tint` (Kittel je Beruf, Räuberkleidung) |
| Polygone (LOD0) | Leibeigener/Arbeiter ≈ 10 000 Dreiecke, Soldat ≤ 12 000, Held/Reiter ≤ 15 000 (Nahansicht; weiter weg greifen die Detailstufen) |
| Detailstufen | Pipeline-Figuren: lod1 = eigenes Spielmodell (≈ 1 500–2 000 Dreiecke, siehe unten). Sonst per `build-lods.mjs`: lod1 ≈ 35 %, lod2 ≈ 15 %, lod3 ≈ 6 % |
| Texturen in LODs | optional eigene (Spielmodell flach gefärbt); ohne eigene Textur gilt die des Originals (UV müssen dann gleich bleiben – das Skript sorgt dafür) |

Tripo-Ausgabe ist oft hochaufgelöst (20–50 k Dreiecke). Vorher auf das LOD0-Budget reduzieren:

```bash
npx gltf-transform simplify roh.glb mittel.glb --ratio 0.25 --error 0.002
npx gltf-transform optimize mittel.glb public/models/characters/Farmer.glb --compress meshopt --texture-compress false --simplify false
```

## Eigene Figuren erzeugen (Pipeline `scripts/asset-gen/`)

Ablauf: Konzeptbogen → Ansichten → Meshy (Mehransichten → 3D, Auto-Rig, Animationen) → Nachbearbeitung →
Manifest. Alles je Figur unter `assets-src/characters/<id>/`. Stimmen der Figuren entstehen nach demselben
Muster (Ausgangsquelle unter `assets-src/voices/<rolle>/`), siehe [AUDIO.md](AUDIO.md#stimmen):

| Datei | Inhalt |
|---|---|
| `sheet.png` (+ `sheet-vN.*`) | Konzeptbogen, vier Ansichten (Stil: [STIL.md](STIL.md)); ältere Fassungen bleiben |
| `concept.json` | Bildmodell, Prompts, Kosten der Bildschritte |
| `spec.json` | Modellname, Rolle, Polygonzahl, Texturgröße, Höhe, Animations-Satz, Werkzeuge |
| `job.json` | Meshy-Task-IDs (Modell, Rig, je Clip), damit jeder Schritt wiederholbar ist |
| `previews/` | Vorschauen und Spiel-Ausschnitte (WebP) – die Bildersammlung zur Figur |
| `*.glb`, `view-*.png` | Zwischenstände, nicht in Git (aus `job.json` bzw. `sheet.png` wieder erzeugbar) |

Animations-Sätze (Spiel-Schlüssel → Meshy-Bibliothek oder Text → Bewegung) stehen in
`assets-src/characters/animations.json`, das Credit-Budget in `assets-src/credits.json`
(`limit`, oder `ASSET_CREDIT_LIMIT`). Jeder kostenpflichtige Schritt wird vorher gebucht und bricht über der
Grenze ab. Schlüssel: `MESHY_API_KEY`, `OPENROUTER_API_KEY` (oder ein Proxy, der sie ergänzt).

```bash
node scripts/asset-gen/concept.mjs edit|new|female <id> …      # Konzeptbogen (OpenRouter-Bildmodell)
node scripts/asset-gen/views.mjs <id>                          # Bogen → view-1…4.png
node scripts/asset-gen/model.mjs all <id>                      # Meshy: Modell, Rig, Bewegungen, Clips
node scripts/asset-gen/postprocess.mjs <id>                    # → public/models/characters/<Modell>.glb (+ Maske, LODs)
node scripts/asset-gen/render.mjs out.png <glb> [--clip chop --ts 0,0.25,0.5 --team 2f6fd6 --hide Axe]
node scripts/asset-gen/lineup.mjs out.png a.glb b.glb [--px 40]       # nur die Figuren, Spielgröße auf Gras und Erde
node scripts/asset-gen/ingame.mjs [ordner] [--army lightCav1 --march]  # Spiel-Screenshots Desktop + Handy (Trupp, laufend)
```

### Zwei Darstellungen je Figur

Jede Figur hat ein **Nahmodell** und ein **Spielmodell** – mit eigenem Netz und eigenem Aussehen, aber demselben
Skelett und denselben Animationen:

| | Nahmodell (Stufe 0) | Spielmodell (Stufe 1, darunter nur gedrosselt) |
|---|---|---|
| wann | Figur über ~80 px hoch (Zoom „nah“, auch am Handy) | mittlerer Zoom und weiter (Standardzoom: ~25 px) |
| Netz | Meshy 7.1 mit PBR, ~11 000 Dreiecke | dasselbe Modell per Meshy-Remesh auf ~2 000 Dreiecke, ohne eigenes Rig (Gewichte vom Nahmodell) |
| Aussehen | Textur 2048 + Normal-Map, Farben wie von Meshy | Textur 1024 + Normal-Map, gleiche Farben |
| Datei | `<Modell>.glb` (ohne Animationen) | `<Modell>.lod1.glb` (mit Skelett, Werkzeugen und **allen Animationen**) |
| geladen | erst, wenn eine Figur die Nahstufe bräuchte (heranzoomen, Dialogkamera) | sobald die Rolle auftaucht |

**Nahmodell bei Bedarf.** Das Spiel backt die Knochen-Textur aus der Datei mit den Animationen – das ist das
Spielmodell (~0,8 MB statt 0,6 MB + 2,4 MB). Das Nahmodell (2048er-Textur, ~2,2 MB) fordert `requestNearModel`
an, sobald eine Figur dieses Modells die Stufe 0 erreicht; bis dahin zeigt sie auch nah das Spielmodell. Kommt
die Datei an, baut `variantStale` die Darstellung mit beiden Stufen neu (gleiche Knochen-Textur, gleiche Größe –
Maß ist immer das Modell mit den Animationen). Ältere Figuren mit Animationen nur im Nahmodell laden es wie
früher gleich mit. Umstellung bestehender Dateien: `node scripts/asset-gen/anims-to-game.mjs [Modell …]`
(postprocess.mjs ruft es für neue Figuren selbst auf). Dabei rückt das Skript bei animierten Werkzeug-Knoten die
Entquantisierung in einen Kindknoten (`<Teil>_netz`), sonst überschriebe die Animation sie und das Werkzeug säße
falsch in der Hand. Prüfung: `tests/render/characterBake.test.js` vergleicht für jede Figur die gebackene Pose
des Nahmodells mit dem CPU-Skinning von three.js (Körper exakt, Werkzeuge auch im Spielmodell an derselben Stelle).

Teamfläche: Magenta in der Textur (Manifest `teamMarker: true`), der Shader färbt sie beim Zeichnen in die
Spielerfarbe (`charMarker`, gleiche Regel wie `markerWeight`). Die Lücken zwischen den UV-Inseln sind vollständig
gefüllt, damit beim Verkleinern über Mipmaps keine fremden Farben in die Kanten laufen.

Älterer Weg (ohne `keepColors`, noch im Code): eigenes vereinfachtes Fernmodell aus einem Fernkonzept mit flachen
Eckfarben je Dreieck und Masken-Datei `<Modell>.mask.png`. Für Meshy-7.1-Modelle nicht mehr nötig: Das reduzierte
Nahmodell liest sich in Spielgröße genauso gut und springt beim Umschalten nicht.

**Alter Weg – Kleidung ohne Grün** (`spec.greenToBrown: { hue: 62, maxChroma: 38 }`): Das Konzept bleibt
maßgeblich – Helligkeit, Schattierung und gedämpfte Farben werden übernommen, nichts wird verstärkt. Nur grüne und
olivfarbene Kleidung dreht `postprocess.mjs` im Farbton (Lab) zu Braun, in Nah- und Spielmodell gleich. Grün tarnt
auf Gras und ist eine Spielerfarbe (Blau, Rot, Grün, Ocker); kräftige Farbe gehört nur in die Teamfläche. Kopf und
Haut bleiben unberührt. `postprocess.mjs <id> --game-only --out-dir review/x --spec '{…}'` erzeugt schnell
Varianten des Spielmodells, `lineup.mjs` zeigt Figuren in Spielgröße auf Gras und Erde.

`postprocess.mjs` übernimmt die Clips (nur Drehungen + Hüfte), hält Schleifen auf der Stelle, blendet die
Naht weich und glättet die Normalen (Meshy liefert facettiert). Für das Spielmodell setzt es das Fernmodell
auf die Ruhelage des Nahmodells (gleiche Höhe und Mitte) und überträgt die Skin-Gewichte von den nächsten Ecken
des Nahmodells (`farmesh.mjs`).

**Texturen aus den Dreiecken** (`texraster.mjs`): Jedes Dreieck wird in die Textur gerastert, jeder Bildpunkt weiß
also, zu welchem Dreieck er gehört. Daraus:
- **Teamfarben-Maske:** Dreiecke mit reiner Markerfarbe sind der Keim; angrenzende Dreiecke mit der von Meshy
  abgedunkelten Markerfarbe (Karmin, Weinrot) wachsen dazu (`growMarker`). Rote Flächen ohne Verbindung zur
  Teamfläche bleiben unberührt; Magenta-Sprenkel in anderen Dreiecken werden mit deren Grundfarbe übermalt.
  Inselränder füllen sich aus der eigenen Insel – keine Farbe läuft in fremde Bereiche.
- **Teamfläche des Spielmodells** je Dreieck (als Eckattribut `_TEAM`).
- **Bereiche** (`regions.mjs`): Kopf über die Skin-Gewichte, Gesicht (vorn, unter dem Haaransatz), Haare
  (hinten), Bart (vorn unten, dunkel). `spec.beard = "hair"` gleicht den Bart per Lab-Verschiebung an die
  Haarfarbe an.

Werkzeuge: Zweihändige (`aim` in `spec.props`) werden je Bild ausgerichtet: Stiel von der Brust durch die Hände,
Klinge in Schlagrichtung; einhändige (`aim` = eigene Hand, `hands: 0`) zeigen von der Brust durch die Hand.
Generierte Bewegungen kennen kein Werkzeug, eine feste Lage in der Hand sähe falsch aus.

`spec.json` (Auszug): `model`, `polycount`, `textureSize`, `height`, `animations`, `props`, `far` (Ordner des
Fernmodells), `beard`, `greenToBrown`, `flat` (Palette des Spielmodells), `markerHueMin` (violett verschobene
Teamfläche auf Magenta drehen, z. B. 275 – Nelia). Das Fernmodell hat ein eigenes `spec.json` mit `"rig": false`.

### Checkliste: erfolgreicher Durchlauf (Stand: Meshy 7.1)

Der schlanke Weg, mit dem die Leibeigenen jetzt entstehen (`spec.keepColors`). Billig vor teuer prüfen:
Konzept → Vorschau (`render.mjs`, `lineup.mjs`) → Spiel (`ingame.mjs`). Nach jedem Konzeptschritt gibt der Nutzer frei.

1. **Vorbereitung:** `npm install`; Schlüssel `MESHY_API_KEY`, `OPENROUTER_API_KEY` (oder ein Proxy, der sie
   ergänzt). Budget in `assets-src/credits.json` (`limit`); eine Figur kostet rund 65 Credits.
2. **Konzept** (`concept.mjs new <id> --ref serf,serf_f "…"`, weiblich: `female`): vier Ansichten in A-Pose,
   Magenta nur auf Stoff an **Kopfbedeckung** (Mütze, Haarband – von oben sichtbar) und Halstuch, nicht am Gürtel;
   keine Werkzeuge. Fernkonzept entfällt. Freigabe. Danach `views.mjs <id>`.
3. **`spec.json`** nach Vorlage `assets-src/characters/serf_m/spec.json`: `aiModel: "meshy-7.1"`, `enablePbr: true`,
   `polycount` 11000, `keepColors: true`, `height`, `animations`, `props`, `far: "<id>_far"`, `farTextureSize` 1024.
   Fernmodell: `assets-src/characters/<id>_far/spec.json` = `{ "remeshOf": "<id>", "polycount": 2000, "rig": false }`.
4. **Meshy:** `model.mjs all <id>` (Modell 30, Rig 5, je Clip 3 Credits; Text-Bewegungen hält Meshy nur 3 Tage),
   dann `model.mjs remesh <id>_far` (5 Credits). Jeder Schritt steht in `job.json` und wird fortgesetzt statt neu bezahlt.
   Dauer: Modell ~4 min, Rig ~1 min, Clips je ~1 min.
5. **Nachbearbeitung** (`postprocess.mjs <id>`): Farben und Normal-Map bleiben wie von Meshy; Lücken zwischen den
   UV-Inseln werden vollständig gefüllt (keine hellen Linien beim Verkleinern), Werkzeuge kommen an die Hände.
   Schreibt `<Modell>.glb` und `<Modell>.lod1.glb` und gibt den Manifest-Eintrag aus (`teamMarker: true`: das Spiel
   färbt Magenta beim Zeichnen in die Spielerfarbe, keine Masken-Datei).
6. **Manifest:** Eintrag unter `models`, Rolle unter `roles` – Paare als `variants` (wie `serf`).
7. **Prüfen:** `render.mjs out.png <glb> --clip chop --ts 0,0.3,0.55,0.8 --hide Hammer,Pickaxe` (Werkzeug in der
   Hand?), `render.mjs … --zoom head` (Gesicht), `ingame.mjs <ordner>` (Spielfotos je Zoomstufe, Desktop und Handy).
8. **Tests und Ablage:** `npm test`, `npm run build`, `e2e/figures.spec.js` (mit `PW_CHROMIUM=/opt/pw-browsers/chromium`).
   Vorschauen als WebP nach `assets-src/characters/<id>/previews/`, Herkunft in CREDITS.md.

**Warum so (Vergleich Oktober 2026, gleiche Ansichten):** Meshy 7.1 mit PBR liefert glatte Gesichter und eine
Normal-Map; das ältere Modell ohne PBR zeigte sichtbare Polygone. Ob Meshy direkt reduziert oder erst in voller
Auflösung erzeugt und danach reduziert, macht keinen sichtbaren Unterschied – der direkte Weg ist billiger. Ein eigenes
vereinfachtes Fernkonzept brachte in Spielgröße nichts gegenüber dem reduzierten Nahmodell (die Details stecken in der
Textur). Flache Eckfarben, Grün → Braun und Bart-Angleichung (alter Weg, ohne `keepColors`) gibt es weiter, werden aber
für neue Figuren nicht mehr gebraucht.

**Stolperfallen:**
- Meshy verschiebt Magenta Richtung Karmin – die Maske wächst aus reinen Magenta-Keimen (`growMarker`); mit
  `render.mjs --team` prüfen, ob die ganze Fläche umfärbt.
- Kleine Text-Bewegungen (Hämmern) wirken aus Spielhöhe nicht – dann eine Bibliotheks-Aktion nehmen.
  Generierte Bewegungen kennen kein Werkzeug, deshalb richtet `aim` es je Bild aus: zweihändig läuft der Stiel durch
  beide Handflächen (Handgelenk + 35 % der Unterarmlänge, `palm`), einhändig von der Brust durch die Hand.
- Ruheclip: Bibliothek 0 („Idle“) steht gebückt, 338 („Short_Breathe_and_Look_Around“) aufrecht.
- Meshys Texturen bestehen aus Hunderten kleiner UV-Inseln; ungefüllte Lücken ergeben beim Verkleinern helle Linien.
- Spielmodell **nie mit Textur** (Mipmaps lassen Farbinseln ineinanderlaufen: helle Linien) und **nicht sättigen**
  (aus Oliv wird grelles Grün) – die gedämpften Konzeptfarben übernehmen, nur Grün → Braun.
- Kein Randlicht auf Figuren (wirkte als helle Kanten).
- Ohne echte GPU zeigt das Spiel prozedurale Figuren – Prüfungen mit `?quality=high`. Das Spiel liegt unter `play/`.
- Figuren nur in Spielgröße beurteilen (Lineup, Spielfotos); in der Großansicht fällt Rauschen nicht auf.

Kosten (Stand Leibeigene): Modell 30, Rig 5, je Clip 3, je Text-Bewegung 10 Credits (einmal je Satz, 3 Tage
nutzbar), Fernmodell 30. Eine Figur mit 9 Clips und Fernmodell kostet rund 95 Credits, ein Paar rund 190.
Arbeitsbewegungen: Holzhacken und Spitzhacke als Text-Bewegung, Hämmern aus der Meshy-Bibliothek
(„Heavy_Hammer_Swing“) – Text-Bewegungen fürs Hämmern blieben zu klein, um aus Spielhöhe zu wirken.

## Neue Figur einbauen

1. GLB nach `public/models/characters/` legen (Format siehe oben).
2. Im Manifest unter `models` eintragen (Clips, Größe, Teamfarbe) und die Rolle(n) unter `roles` darauf zeigen lassen.
3. `node scripts/trim-animations.mjs public/models/characters/Farmer.glb` – entfernt Clips, die das Manifest nicht nennt.
4. `node scripts/build-lods.mjs public/models/characters/Farmer.glb` – erzeugt `Bauer.lod1…3.glb`; `"lods": 3` im Manifest.
5. `node scripts/asset-gen/anims-to-game.mjs Farmer` – Animationen ins Spielmodell, damit das Nahmodell erst bei
   Bedarf geladen wird.
6. Prüfen: `npx vitest run tests/render` (Manifest gültig, Posen stimmen?), Spiel mit `?debug=1&quality=high` öffnen.

## Technik der Figuren

- Beim ersten Auftreten einer Rolle werden alle benötigten Clips mit 24 Bildern/s abgetastet und als
  Matrizen in eine Float-Textur geschrieben (Breite = Knochen × 4, Höhe = Bilder). Das kostet einmalig
  wenige Millisekunden je Modell.
- Teile und Detailstufen werden zu **einem** Netz mit Knochen-Index/-Gewicht je Ecke zusammengeführt
  (starre Teile hängen mit Gewicht 1 an ihrem Knochen).
- Pro Bild schreibt die CPU je Figur nur Matrix, Animationsbild A/B + Mischung und zwei Farben in ein
  InstancedMesh je (Rolle, Stufe). Der Vertex-Shader liest die Knochen per `texelFetch` (WebGL 2).
- Sichtprüfung je Figur (Kugel gegen Frustum), Stufe nach Bildschirmhöhe mit Hysterese,
  Animation ab Stufe 1 ohne Bildmischung, ab Stufe 2 mit 8 Bildern/s, Stufe 3 starr.
- Wechselt eine Figur das Netz (Nah- ↔ Spielmodell), zeichnet das Spiel 0,35 s lang beide: Die kommende Stufe
  zeigt die Bildpunkte unter dem Überblendwert eines 4×4-Bayer-Musters, die gehende die übrigen (`aFade`).
  Ohne Transparenz und ohne Sortierung, kein sichtbares Umschalten.
- Schatten wirft nur Stufe 0; auf der niedrigen Grafikstufe gibt es stattdessen weiche Blob-Schatten.
- Ohne echte GPU (Software-Rasterizer) nutzt das Spiel die prozeduralen Figuren (wenige Dreiecke).

## Gebäude aus den Symbolen (`scripts/asset-gen/building.mjs`)

Vorlagen: das Gebäudesymbol aus dem Atlas (`public/icons/symbols.webp`, z. B. `b-residence`) für den Entwurf und
`assets-src/buildings/style-house.webp` für den Stil (polierte, handgemalte Spielgrafik – nicht Knete, nicht Pastell).
Bildmodell: Seedream 5.0 Flash über `/api/v1/images` (0,02 $ je Bild).

```bash
node scripts/asset-gen/building.mjs concept wohnhaus   # Konzept → assets-src/buildings/house/concept.png (Freigabe)
node scripts/asset-gen/building.mjs concept wohnhaus --out x [--model …]   # Variante zum Vergleich, pick wohnhaus x übernimmt
node scripts/asset-gen/building.mjs model wohnhaus     # Meshy 7.1, ein Bild → 3D mit PBR (~30 Credits, ~4 min)
node scripts/asset-gen/building.mjs build wohnhaus     # → public/models/buildings/wohnhaus_<farbe>.glb + .lod1/.lod2
```

- `assets-src/buildings/<id>/spec.json`: `icon` (Atlasname) oder `from` (Ordner der Vorstufe), `file` (Dateiname im
  Spiel), `level` (1–3), `polycount`, `describe` (kurz, englisch, ohne Gebäudenamen – sonst malt das Modell Schrift).
- **Alle Stufen in einem Bild** (`set burg,castle2_old,castle3_old`): gleiche Bauweise und gleicher Maßstab, Vorlagen Symbol,
  Stilbild und das fertige Wohnhaus; das Bild (`set-vN.png`) wird in Inhaltsspalten zerlegt (Beschriftungen unter den
  Gebäuden fallen weg) und je Stufe als `concept.png` abgelegt. Stufen im Prompt nach Lage benennen („left building“),
  nicht „Level 1“ – sonst schreibt das Modell Beschriftungen ins Bild.
- **Ausbaumuster** (`SET_PATTERN`, für alle Gebäude gleich): gleiche Grundfläche, gleiche Terrakotta-Ziegel, je Stufe
  ein Geschoss mehr und wertiger – Stufe 1 Holz und Putz, Stufe 2 Steinsockelgeschoss mit Läden und Laternen, Stufe 3
  überwiegend behauener Stein, geschnitzte Balken, kleine goldene Spitzen.
- **Hof-Muster** (`spec.layout: "yard"`, `spec.footprint` aus den Spieldaten): Stufe 1 belegt nur etwa die Hälfte des
  Grundstücks, daneben ein Hof mit passenden Dingen (Kirchhof mit Glocke, Pferde am Stall, Zielscheiben am
  Schießplatz); Stufe 2 drei Viertel, Stufe 3 alles. So wird der Ausbau auch von oben deutlich. Grundstücksboden
  ebenerdig (festgetretene Erde), keine erhöhte Platte. `cut a,b,c set-vN.png` schneidet einen gewählten Satz erneut aus.
- **Einheitliche Dächer:** `build` färbt Blau (Schiefer aus den Symbolen; Blau ist Spielerfarbe) zu Terrakotta
  (`blueToTerracotta`, abschaltbar mit `spec.keepBlue`). `spec.rotate` dreht ein Modell um die Hochachse, falls Meshy
  den Eingang nicht nach vorn legt (vorher mit `render.mjs <raw.glb>` prüfen: Ansicht 1 = vorn).
  Das Spiel skaliert jedes Modell auf seine Grundfläche; die Höhe ergibt sich nur aus den Proportionen des Konzepts –
  deshalb Geschosse benennen, keine Zahlen. Einzelstufen (`concept`) nutzen `LEVEL_RULES` und `from` (Vorstufe).
- Feste Regeln im Prompt: freigestellt, kein Boden und keine Bodenplatte, kein Rauch, keine Schrift, nur eine Tür,
  ein Wimpel in Magenta (Teamfarbe).
- Teamfarbe: `build` färbt den Wimpel je Spielerfarbe um (Blau, Rot, Grün, Ocker) und schreibt vier Dateien.
  Lücken zwischen den UV-Inseln werden gefüllt.
- Einbinden: `BUILDING_ASSETS` in `src/render/assets.js` (Typ → Datei je Stufe) und `OWN_BUILDING_MODELS` (eigene
  Modelle stehen ohne den grauen Steinsockel, den das Spiel unter KayKit-Gebäude legt).
- Prüfen: `node scripts/asset-gen/ingame.mjs <ordner> --build residence --levels 3` stellt Stufe 1–3 nebeneinander.
- Alle Konzeptbilder samt Vorgängerfassungen bleiben in `assets-src/buildings/<id>/` (Artwork-Ablage).
- **Zwei Ansichten:** `back <id>` erzeugt eine Rückansicht (`concept-back.png`); `model` schickt dann beide Bilder an
  `multi-image-to-3d` (gleicher Preis, echte Rückseite). Meshy dreht solche Modelle um 90°, `build` gleicht das aus.
  Passt die Rückansicht nicht zur Vorderansicht (anderes Seitenverhältnis), nur aus der Vorderansicht bauen.
- **Ohne Wimpel** (`spec.banner: false`): Ruinen und neutrale Objekte. **Ohne Symbol** (kein `spec.icon`): Bild 1 bleibt
  leer, die Beschreibung trägt allein (Brücke, Lagerfeuer).
- **Einpassen im Spiel:** je Achse auf die Grundfläche (`OWN_BUILDING_FILL` vergrößert einzelne Modelle),
  Gruben versenkt mit dunkler Öffnung (`OWN_BUILDING_PIT`: `ground` = Anteil unter der Bodenscheibe, das Modell liegt
  3 cm über dem Gelände). Darunter liegt eine „Folie“ (`src/render/pit.js`, einmal je Modell gerechnet): Draufsicht
  gerastert (höchste Fläche je Zelle bis knapp über der Bodenscheibe), tiefe Zellen ohne Verbindung nach außen
  (Flood-Fill, Lücken im Wall bis 2 Zellen überbrückt) = Loch; Inseln (Eimer) gefüllt, zugebaute Stücke (Hütte,
  Kohlenhaufen) verworfen; weichgezeichnete Kontur per Marching Squares, nicht konvex, nie über den Randwall hinaus.
  Gemalte Textur: Erde in der Farbe `rim` am Rand (weich ausgeblendet) → Schwarz in der Mitte (Abstand zum Rand),
  Erdklumpen als Rauschen. Kein Loch gefunden → alte schwarze Hülle (`shrink`).
  `gallows`: stellt zwei Holzpfosten mit Querbalken unter einen frei schwebenden Eimerklotz (`hangerBeam`) – Notbehelf,
  falls Meshy die Stützen verliert. Derzeit ungenutzt: `clay_mine` ist neu erzeugt (nur Vorderansicht; mit Rückansicht
  hatte Meshy den Galgen verloren und den Boden zum Erdklotz gemacht, alte Fassung in `assets-src/buildings/clay_mine/old-v1/`).
- **Baustelle und Trümmer** (Gerüst, Bauphasen stage_A–C, `destroyed` aus dem KayKit-Paket): gemalte Bretter und
  Mauerwerk triplanar darübergelegt (`src/render/painted.js`, Texturen `planks`/`masonry` aus `ground.mjs`); bläuliche
  Steine werden warm grau. Vergleich mit `?nature=off`, auf Stufe „niedrig“ aus.
- **Sonderfälle:** Brücke (`bridge`) als ganzes Modell, nur der Mittelteil wird gestreckt (`bridgeAssetModel`);
  Ruinen je Typ (`RUIN_ASSETS`: `village_ruin`, `house_ruin`, sonst Trümmer); Siedlungsplätze (nur dort darf ein
  Dorfzentrum stehen) zeigen die Dorfzentrum-Ruine – wie im Vorbild ein verlassenes Dorfzentrum zum Wiederaufbau; Lagerfeuer (`campfire`) mit Flammen als
  Partikel. Alle werden bei Bedarf nachgeladen.

## Pferd (Reittier)

Alle Reiter (leichte und schwere Reiterei, Hauptleute) sitzen auf `Horse` (Rolle `mount.horse`, als `attach` der
Reiter-Rollen). Modell aus der Figuren-Pipeline (Meshy 7.1, `assets-src/characters/horse/`), **Rig von Hand in der
Meshy-Oberfläche** (die Schnittstelle riggt nur Menschengestalten), **Bewegungen selbst geschrieben**:

```bash
node scripts/asset-gen/horse.mjs                    # rigged.glb → Horse.glb (Nahmodell) + Horse.lod1.glb (Spielmodell, Clips)
node scripts/asset-gen/horse.mjs --preview out.glb  # nur Rig + Clips (für render.mjs … --clip gallop --ts 0,0.25,0.5 --az 1.57)
```

- **Knochen** (`RIG` in `horse.mjs`): Meshy nennt sie `Bone_000`…`Bone_064`; zugeordnet nach Lage und Hierarchie –
  Wurzel/Becken `Bone_000/001`, Rücken `Bone_010` (davor `009`, `008`), Schweif `Bone_007`→`002`, Hals `Bone_040/039/038`,
  Kopf `Bone_037`, Ohren `Bone_062/064`; Beine (Schulter/Hüfte, Ellbogen/Knie, Vorderfußwurzel/Sprunggelenk, Fessel, Huf):
  links vorn `033, 047, 046, 045, 044`, rechts vorn `035, 054, 053, 052, 051`, links hinten `022…018`, rechts hinten
  `016…012` (+x ist die linke Seite des Pferds). Steigbügel, Zügel und kleine Nebenäste bleiben starr.
- **Clips:** `idle` (4 s: Atmen, Kopf schaut umher, Schweif schlägt, Ohren zucken), `walk` (Viertakt-Schritt, 0,75 s,
  1 Einheit/s), `gallop` (Dreitakt-Galopp mit Schwebephase, 0,5 s, 3,4 Einheiten/s; Manifest-Schlüssel `run`), `die`
  (knickt ein, kippt zur Seite). Gangarten, Hufbahnen und Körperkurven in `scripts/asset-gen/gait.mjs`.
- **Beine per IK:** Je Bild bekommt jeder Huf ein Ziel – in der Standphase gleitet er linear mit der Bodengeschwindigkeit
  nach hinten (kein Rutschen), in der Schwungphase hebt er im Bogen ab. Ein kleiner Löser (gedämpfte kleinste
  Quadrate in der Seitenebene) setzt Schulter/Hüfte und die Gelenke so, dass der Huf trifft und die Gelenke nah an
  einer Wunschbeugung bleiben (Vorderfußwurzel klappt nach hinten, Sprunggelenk nach vorn, Fessel und Huf rollen ab).
  Der Huf steht in der Standphase flach. Weil die Vorderbeine in Ruhe fast gestreckt sind, geht der Rumpf im Schritt und
  Galopp etwas tiefer.
- **Tempo:** `stride` im Manifest (Modelleinheiten/s je Clip-Schlüssel) ersetzt die Messung (`strideSpeed` wird bei
  vier Hufen ungenau). Das Abspieltempo des Reiters und des Pferds richtet sich nach dem Pferd (`Variant.moveSpeed`).
  Die Reiterei schreitet bis 1,3 Kacheln/s und galoppiert ab 1,7 (`cavalryGait`, dazwischen bleibt die Gangart).
- **Sattel:** `saddle: { bone, at }` – Sattelpunkt in Modellkoordinaten am Rückenknochen. Daraus Sattelhöhe (Welt)
  und je gebackenem Bild das Heben/Senken (`saddleTrack`); der Reiter folgt dem Rücken. Sitzhöhe des Reiters = Sattel
  × Maßstab des Anhangs + `seatOffset` der Reiter-Rolle (−0,26: Gesäß im Sattel, Füße darunter). Größe: Pferd 1,1 Kacheln
  bis zu den Ohren (schwere Reiterei ×1,06), Figuren 0,81.
- **Angriff im Sattel:** Die Meshy-Angriffe der Reiter sind im Stehen aufgenommen (Hüfte dreht bis ~40°, Beine stehen) –
  auf dem Pferd saßen Reiter damit quer. `node scripts/asset-gen/ride-clips.mjs` schreibt je Reiter-Figur den Clip
  `rideAttack` (Oberkörper aus `attack`, Hüfte und Beine aus der Reitpose, Brustdrehung auf 30 % gedämpft); die
  Reiter-Rollen nehmen ihn für `attack`/`shoot`, Jubeln wird zur Reitpose. Prüfung: Hüfte und Brust weichen in keinem
  Sattel-Clip mehr als 25° vom Pferd ab (`mount.test.js`, `CharacterSystem.facing` im E2E).
- **Teamfarbe:** Satteldecke in Magenta (`teamMarker`). Magenta-Sprenkel von Meshy außerhalb der Decke (Mähne,
  Schweif, Hufe) übermalt `cleanMarker` (Bereich `CLOTH_BOX`), auch die Lücken zwischen den UV-Inseln.
- **Dateien:** Nahmodell 11 400 Dreiecke, Textur und Normal-Map 2048 (~1,6 MB, erst beim Heranzoomen); Spielmodell
  2 065 Dreiecke aus einem Meshy-Remesh des gerigten Modells (`assets-src/characters/horse_far/`, `model.mjs remesh
  horse_far`, 5 Credits): eingepasst auf die Ruhelage des Rigs, Gewichte von den nächsten Rig-Ecken (`farmesh.mjs`),
  eigene UV und Textur (1024), alle Clips (~0,6 MB). Ohne Remesh (`--no-remesh`) vereinfacht `horse.mjs` das
  Nahmodell (feste UV-Nähte, ~5 500 Dreiecke). Rückfall bis zum Laden: prozedurales Pferd (`procScale` 1,7).
- **Prüfen:** `tests/tools/gait.test.js` (Hufbahnen, Fußfolge, IK), `tests/render/mount.test.js` (Sattel, Tempo, Hufe der
  Datei rutschen nicht), `e2e/cavalry.spec.js`; Spielfotos: `node scripts/asset-gen/ingame.mjs <ordner> --army lightCav1 --march`.

## Lauftempo

Die Beine laufen mit der Bodengeschwindigkeit mit (`strideSpeed`/`strideRate` in `src/render/characters.js`):
Beim Laden wird je Lauf-Clip (`walk`, `run`, `carry`) gemessen, wie schnell der Standfuß relativ zum Körper nach
hinten gleitet (Median über alle Bildpaare). Abspieltempo = tatsächliche Geschwindigkeit (Weg je Takt × Spieltempo)
/ diese natürliche Geschwindigkeit, geglättet und ohne Phasensprung. Die Meshy-Lauf-Clips gehen mit kurzen
Schritten fast auf der Stelle (~0,3 Kacheln/s); volles Schritthalten wäre ×7, darum ist das Tempo auf 0,6–2,2
begrenzt. Ein Clip mit echter Schrittlänge (Meshy „Walking“ ohne „in place“-Dämpfung) bräuchte keine Grenze.

